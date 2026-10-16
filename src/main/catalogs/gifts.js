"use strict";

/** catalogs : module « gifts », sans initialisation externe au chargement. */
const fs = require("node:fs");
const path = require("node:path");
const { safeString } = require("../utils");
const { COMMUNITY_HEART_IMAGE_URL, canonicalGiftName, findCatalogGift, giftFamily, giftImageIdentity, normalizeGiftName } = require("../../shared/gift-identity");
const { normalizeSearch } = require("./common");

const LOCALIZED_GIFT_REFRESH_MS = 6 * 60 * 60 * 1000;
const MAX_GIFT_CATALOG_RESULTS = 10000;
const MAX_ROOM_GIFT_CACHES = 12;
const roomUsername = (value) => safeString(value, 200).trim().replace(/^@+/, "").toLowerCase();
const roomIdentifier = (value) => safeString(value, 160).trim();
const roomKey = (username, roomId) => JSON.stringify([username, roomId]);
const TRUE_HEART_IDS = new Set(["7934", "heart-me"]);
const SEPARATE_GIFT_IDS = new Set(["17712", "62816", "601333", "157842"]);
const OLD_HEART_NAMES = new Set(["coeur sur moi", "coeur de la communaute", "community heart", "heart me", "envoie moi un coeur"]);
// Correspondance vérifiée avec l'ID 8259 du catalogue TikTok embarqué :
// « Amour en langage des signes » / « Sign language love ». Ce libellé
// historique de ShenPulse ne doit pas devenir un autre cadeau par proximité.
const LEGACY_GIFT_NAMES_BY_ID = Object.freeze({
  "8259": Object.freeze(["Amour en langue des signes"])
});

class GiftCatalog {
  constructor(resourcesDirectory, {
    fetchLocalizedGifts = fetchFrenchTikTokGifts,
    fileNames = ["tiktok-gifts.json", "tiklive-gifts.json"]
  } = {}) {
    this.filePaths = fileNames.map((fileName) =>
      path.join(resourcesDirectory, "catalogs", fileName)
    );
    this.fetchLocalizedGifts = fetchLocalizedGifts;
    this.baseGifts = [];
    this.localizedGifts = [];
    this.learnedGifts = [];
    this.gifts = [];
    this.generatedAt = "";
    this.localizedAtMs = 0;
    this.localizedUsername = "";
    this.refreshPromise = null;
    this.roomScope = { username: "", roomId: "" };
    this.roomGeneration = 0;
    this.roomRefreshSequence = 0;
    this.roomCache = new Map();
    this.roomPending = new Map();
    this.roomObserved = [];
    this.load();
  }

  load() {
    const values = [];
    const generatedAt = [];
    for (const filePath of this.filePaths) {
      try {
        const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const source = path.basename(filePath) === "tiklive-gifts.json"
          ? "tiklive"
          : "catalog";
        if (payload.generatedAt) generatedAt.push(safeString(payload.generatedAt, 100));
        for (const gift of Array.isArray(payload.gifts) ? payload.gifts : []) {
          values.push({
            ...gift,
            source: safeString(gift?.source || source, 40)
          });
        }
      } catch {
        // Chaque source est optionnelle : le catalogue restant reste utilisable.
      }
    }
    this.baseGifts = dedupeGiftCatalog(values);
    this.gifts = [...this.baseGifts];
    this.generatedAt = generatedAt.filter(Boolean).sort().at(-1) || "";
    return this.gifts;
  }

  setRoomScope(username = "", { roomId = "", force = false } = {}) {
    const next = { username: roomUsername(username), roomId: roomIdentifier(roomId) };
    if (!next.username) next.roomId = "";
    if (force || roomKey(next.username, next.roomId) !== roomKey(this.roomScope.username, this.roomScope.roomId)) {
      this.roomGeneration += 1;
      this.roomScope = next;
      this.roomObserved = [];
    }
    return this.roomSnapshot();
  }

  roomSnapshot(query = "", limit = MAX_GIFT_CATALOG_RESULTS) {
    const scope = this.roomScope, cached = this.roomCache.get(roomKey(scope.username, scope.roomId));
    const available = Boolean(scope.username && cached?.available && cached.roomId &&
      Date.now() - cached.fetchedAtMs < LOCALIZED_GIFT_REFRESH_MS);
    const byId = new Map((available ? cached.gifts : []).map((gift) => [gift.id, gift]));
    // A verified gift actually received in this room is fresher than its
    // panel artwork, even when TikTok changed the asset's filename format.
    for (const gift of this.roomObserved) byId.set(gift.id, mergeRoomGiftEntries(byId.get(gift.id), gift, true));
    const rows = [...byId.values()].filter((gift) => gift.selectable !== false).sort(compareGifts);
    const needle = normalizeSearch(query), matching = needle ? rows.filter((gift) => giftSearchText(gift).includes(needle)) : rows;
    return { room: { username: scope.username, roomId: scope.roomId || cached?.roomId || "",
      available, partial: !available && this.roomObserved.length > 0, fetchedAt: available ? cached.fetchedAt : "",
      total: rows.length }, roomGifts: matching.slice(0, limit).map((gift) => ({ ...gift,
      alternateIds: [...gift.alternateIds], alternateNames: [...gift.alternateNames] })) };
  }

  getRoomCatalog() { return this.roomSnapshot(); }

  async refreshLocalized(username = "", { force = false, roomId = "" } = {}) {
    const targetUsername = roomUsername(username || "tiktok") || "tiktok";
    const targetRoomId = roomIdentifier(roomId);
    this.setRoomScope(targetUsername, { roomId: targetRoomId });
    const scopeKey = roomKey(targetUsername, targetRoomId), generation = this.roomGeneration;
    const cached = this.roomCache.get(scopeKey);
    if (!force && cached && Date.now() - cached.fetchedAtMs < LOCALIZED_GIFT_REFRESH_MS) return this.gifts;
    const previous = this.roomPending.get(scopeKey);
    if (!force && previous?.generation === generation) return previous.promise;
    const sequence = ++this.roomRefreshSequence;
    const current = () => generation === this.roomGeneration &&
      roomKey(this.roomScope.username, this.roomScope.roomId) === scopeKey && this.roomPending.get(scopeKey)?.sequence === sequence;
    // Defer the call so a synchronous implementation cannot publish before
    // the operation and its scope have been registered.
    const refresh = Promise.resolve().then(() => this.fetchLocalizedGifts(targetUsername, { roomId: targetRoomId })).then((response) => {
      if (!current()) return this.gifts;
      const values = Array.isArray(response) ? response : response?.gifts;
      const resolvedRoomId = roomIdentifier(response?.roomId || targetRoomId);
      if (targetRoomId && resolvedRoomId !== targetRoomId) throw new Error("La salle TikTok du catalogue a changé.");
      const gifts = dedupeLocalizedGifts(values);
      if (!gifts.length) {
        throw new Error("Le catalogue TikTok de la salle est vide.");
      }
      const fetchedAtMs = Date.now(), fetchedAt = new Date(fetchedAtMs).toISOString();
      this.roomCache.delete(scopeKey);
      this.roomCache.set(scopeKey, { available: Boolean(resolvedRoomId), roomId: resolvedRoomId,
        gifts: dedupeRoomGifts(values), fetchedAtMs, fetchedAt });
      while (this.roomCache.size > MAX_ROOM_GIFT_CACHES) this.roomCache.delete(this.roomCache.keys().next().value);
      // Une salle peut ne renvoyer qu'une partie des cadeaux. Les cadeaux déjà
      // identifiés restent disponibles pour les règles et les sélections
      // historiques ; la réponse la plus récente enrichit les mêmes ID.
      this.localizedGifts = dedupeGiftCatalog([
        ...this.localizedGifts,
        ...gifts
      ]).slice(0, MAX_GIFT_CATALOG_RESULTS);
      this.gifts = dedupeGiftCatalog([
        ...this.baseGifts,
        ...this.learnedGifts,
        ...this.localizedGifts
      ]);
      this.generatedAt = fetchedAt;
      this.localizedAtMs = fetchedAtMs;
      this.localizedUsername = targetUsername;
      return this.gifts;
    });
    const pending = refresh.finally(() => {
      if (this.roomPending.get(scopeKey)?.sequence === sequence) this.roomPending.delete(scopeKey);
      if (this.refreshPromise === pending) this.refreshPromise = null;
    });
    this.roomPending.set(scopeKey, { generation, sequence, promise: pending });
    this.refreshPromise = pending;
    return pending;
  }

  acceptRoomLiveGift(value = {}, context = {}) {
    if (context.verified !== true || !this.roomScope.username || !this.roomScope.roomId ||
      roomUsername(context.username) !== this.roomScope.username || roomIdentifier(context.roomId) !== this.roomScope.roomId) return false;
    const id = safeString(value.id ?? value.giftId ?? value.gift_id, 160);
    const previous = this.roomObserved.find((row) => row.id === id);
    const cached = this.roomCache.get(roomKey(this.roomScope.username, this.roomScope.roomId))?.gifts.find((row) => row.id === id);
    const [gift] = dedupeRoomGifts([{ ...value, name: value.name ?? value.giftName ?? previous?.name ?? cached?.name }]);
    if (!gift) return false;
    const merged = mergeRoomGiftEntries(previous || cached, gift, true);
    if ((previous || cached) && sameGiftCatalogEntry(previous || cached, merged)) return false;
    this.roomObserved = [...this.roomObserved.filter((row) => row.id !== gift.id), merged].slice(-MAX_GIFT_CATALOG_RESULTS);
    return true;
  }

  mergeLiveGift(value = {}) {
    let gift = normalizeGift({
      ...value,
      cost:
        value.giftCost ??
        value.cost ??
        value.value ??
        value.diamondCount ??
        value.diamond_count,
      id: value.giftId ?? value.id,
      imageUrl:
        value.giftImageUrl ??
        value.imageUrl ??
        value.giftPictureUrl ??
        value.image,
      name: value.giftName ?? value.name,
      source: "live"
    });
    if (!gift.id) return false;

    const known = findCatalogGift(this.gifts, gift);
    const knownIds = new Set([
      String(known?.id || ""),
      ...(Array.isArray(known?.alternateIds) ? known.alternateIds : [])
    ]);
    if (known && knownIds.has(gift.id)) {
      // Un événement peut apporter le dessin ou le libellé qui manquait à
      // l'entrée embarquée. Un ID connu ne signifie pas que ses données sont
      // déjà complètes. Ne pas effacer les métadonnées absentes de l'événement.
      gift = mergeGiftEntries(known, {
        ...gift,
        id: known.id,
        alternateIds: uniqueStrings([
          ...known.alternateIds,
          gift.id,
          ...gift.alternateIds
        ], 160).filter((id) => id !== known.id),
        name: known.name,
        alternateNames: uniqueStrings([
          ...gift.alternateNames,
          gift.name,
          gift.originalName
        ], 200).filter((name) => name !== known.name),
        cost: gift.cost || known.cost,
        imageUrl: gift.imageUrl || known.imageUrl,
        giftType: gift.giftType || known.giftType,
        combo: gift.combo || known.combo,
        imageUri: gift.imageUri || known.imageUri,
        primaryEffectId: gift.primaryEffectId || known.primaryEffectId,
        isGlobalGift: gift.isGlobalGift || known.isGlobalGift,
        isDisplayedOnPanel: gift.isDisplayedOnPanel || known.isDisplayedOnPanel
      });
      if (sameGiftCatalogEntry(known, gift)) return false;
    }
    if (!gift.name) return false;

    const learned = findCatalogGift(this.learnedGifts, gift);
    // Le cache LIVE est borné lui aussi. Garder l'entrée nouvelle/enrichie à
    // la fin évite de l'évincer aussitôt selon son prix ou son nom. Les
    // événements identiques sont déjà sortis plus haut, sans reconstruction.
    this.learnedGifts = [
      ...this.learnedGifts.filter((entry) => entry !== learned),
      learned ? mergeGiftEntries(learned, gift) : gift
    ].slice(-MAX_GIFT_CATALOG_RESULTS);
    this.gifts = dedupeGiftCatalog([
      ...this.baseGifts,
      ...this.learnedGifts,
      ...this.localizedGifts
    ]);
    return true;
  }

  search(query = "", limit = 80) {
    const needle = normalizeSearch(query);
    // Le chargement initial des références doit couvrir les cadeaux de tous
    // les prix : un millier de cadeaux personnalisés à 1 diamant peut sinon
    // masquer les cadeaux sélectionnés dans les actions et les jeux.
    const max = Math.min(MAX_GIFT_CATALOG_RESULTS, Math.max(1, Number(limit) || 80));
    const source = needle
      ? this.gifts.filter((gift) =>
          giftSearchText(gift).includes(needle)
        )
      : this.gifts;
    return {
      generatedAt: this.generatedAt,
      total: source.length,
      gifts: source.slice(0, max),
      ...this.roomSnapshot(query, max)
    };
  }
}

async function fetchFrenchTikTokGifts(
  username = "tiktok",
  { createConnection, roomId: expectedRoomId = "" } = {}
) {
  const connectionOptions = {
    processInitialData: false,
    fetchRoomInfoOnConnect: false,
    webClientParams: {
      app_language: "fr",
      browser_language: "fr-FR",
      priority_region: "FR",
      region: "FR",
      tz_name: "Europe/Paris",
      webcast_language: "fr"
    },
    webClientHeaders: {
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.7"
    },
    webClientOptions: {
      timeout: 10000
    }
  };
  const connection = createConnection
    ? createConnection(username, connectionOptions)
    : new (require("tiktok-live-connector").TikTokLiveConnection)(
        username,
        connectionOptions
      );
  const roomId = await connection.fetchRoomId();
  if (!roomId) {
    throw new Error("La salle TikTok du créateur est introuvable.");
  }
  if (expectedRoomId && String(roomId) !== String(expectedRoomId)) throw new Error("La salle TikTok du créateur a changé.");
  // fetchAvailableGifts() n'associe pas la salle tout seul dans la version
  // embarquée du connecteur. Sans room_id, TikTok renvoie son catalogue
  // mondial générique au lieu des cadeaux rattachés au créateur.
  connection.clientParams.room_id = String(roomId);
  const gifts = await connection.fetchAvailableGifts();
  // Keep the historical array API while carrying the exact public room that
  // supplied this response. No account, session or credentials are included.
  const result = Array.isArray(gifts) ? [...gifts] : [];
  Object.defineProperty(result, "roomId", { value: String(roomId) });
  return result;
}

function giftSearchText(gift) {
  return normalizeSearch(`${gift.name} ${gift.originalName || ""} ${gift.id} ${gift.cost} ` +
    `${(gift.alternateNames || []).join(" ")} ${(gift.alternateIds || []).join(" ")}`);
}

function roomGiftValue(value = {}) {
  return { ...value,
    id: value.id ?? value.giftId ?? value.gift_id,
    name: value.name ?? value.giftName,
    cost: value.cost ?? value.giftCost ?? value.value ?? value.diamondCount ?? value.diamond_count,
    imageUrl: value.imageUrl || value.giftImageUrl || value.giftPictureUrl || value.image?.url_list?.[0] ||
      value.image?.urlList?.[0] || value.icon?.url_list?.[0] || value.icon?.urlList?.[0],
    imageUri: value.imageUri ?? value.giftImageUri ?? value.image?.uri ?? value.icon?.uri,
    combo: value.combo ?? value.giftCombo ?? value.isCombo,
    giftType: value.giftType ?? value.type,
    primaryEffectId: value.primaryEffectId ?? value.primary_effect_id,
    isGlobalGift: value.isGlobalGift ?? value.is_global_gift,
    isDisplayedOnPanel: value.isDisplayedOnPanel ?? value.is_displayed_on_panel,
    source: "tiktok-room" };
}

function mergeRoomGiftEntries(previous, gift, preferIncomingArtwork = false) {
  if (!previous) return gift;
  const artworkRank = (row) => (/(?:composed\.|saliency_seg_)/i.test(`${row.imageUri} ${row.imageUrl}`) ? 4 : 0) +
    (row.isDisplayedOnPanel ? 2 : 0) + (row.imageUrl ? 1 : 0);
  const artwork = !preferIncomingArtwork && artworkRank(previous) > artworkRank(gift) ? previous : gift;
  return normalizeGift({ ...previous, ...gift, cost: gift.cost || previous.cost,
    imageUrl: artwork.imageUrl || gift.imageUrl || previous.imageUrl,
    imageUri: artwork.imageUri || gift.imageUri || previous.imageUri,
    giftType: gift.giftType || previous.giftType, combo: gift.combo || previous.combo,
    name: gift.name || previous.name,
    alternateNames: uniqueStrings([...previous.alternateNames, previous.name, ...gift.alternateNames], 200) });
}

function dedupeRoomGifts(values = []) {
  const byId = new Map();
  // A creator's returned panel is an availability list, not evidence that two
  // gift IDs are aliases. Keep even same-name/same-image family members apart.
  for (const value of (Array.isArray(values) ? values : []).slice(0, MAX_GIFT_CATALOG_RESULTS)) {
    // A second normalization retains the original localized name as a search
    // alias immediately; repeated identical LIVE events then stay idempotent.
    const gift = normalizeGift(normalizeGift(roomGiftValue(value)));
    if (!gift.id || !gift.name || gift.selectable === false) continue;
    byId.set(gift.id, mergeRoomGiftEntries(byId.get(gift.id), gift));
  }
  return [...byId.values()].sort(compareGifts);
}

function dedupeLocalizedGifts(values = []) {
  return dedupeGiftCatalog(
    (Array.isArray(values) ? values : []).map((value) => ({
      cost: value?.cost ?? value?.diamondCount ?? value?.diamond_count,
      id: value?.id ?? value?.giftId ?? value?.gift_id,
      imageUrl:
        value?.imageUrl ||
        value?.giftPictureUrl ||
        value?.image?.url_list?.[0] ||
        value?.image?.urlList?.[0] ||
        value?.icon?.url_list?.[0] ||
        value?.icon?.urlList?.[0],
      name: value?.name ?? value?.giftName,
      combo: value?.combo ?? value?.isCombo,
      giftType: value?.type ?? value?.giftType,
      imageUri: value?.image?.uri ?? value?.icon?.uri,
      isDisplayedOnPanel:
        value?.is_displayed_on_panel ?? value?.isDisplayedOnPanel,
      isGlobalGift: value?.is_global_gift ?? value?.isGlobalGift,
      primaryEffectId:
        value?.primary_effect_id ?? value?.primaryEffectId,
      source: "tiktok-fr"
    }))
  );
}

function normalizeGift(value = {}) {
  const rawId = safeString(value.id ?? value.giftId ?? value.gift_id, 160);
  const rawName = safeString(value.name ?? value.giftName, 200);
  const savedOriginalName = safeString(value.originalName, 200);
  const trueHeart = TRUE_HEART_IDS.has(rawId);
  // Restore a name actually retained alongside the former automatic label;
  // never guess a missing creator name from its image, price or gift ID.
  const originalName = !trueHeart && normalizeGiftName(rawName) === "coeur sur moi" &&
    savedOriginalName && !OLD_HEART_NAMES.has(normalizeGiftName(savedOriginalName)) ? savedOriginalName : rawName;
  const oldFalseFamily = !trueHeart && (SEPARATE_GIFT_IDS.has(rawId) || value.giftFamily === "community-heart" || value.family === "community-heart");
  const inferredNumericId = inferNumericGiftId(rawId);
  const alternateIds = uniqueStrings([
    ...(Array.isArray(value.alternateIds) ? value.alternateIds : []),
    ...(Array.isArray(value.giftIds) ? value.giftIds : []),
    inferredNumericId
  ], 160).filter((id) => id !== rawId && !(trueHeart && SEPARATE_GIFT_IDS.has(id)) &&
    !(oldFalseFamily && (TRUE_HEART_IDS.has(id) || SEPARATE_GIFT_IDS.has(id))));
  const alternateNames = uniqueStrings([
    ...(Array.isArray(value.alternateNames) ? value.alternateNames : []),
    value.originalName,
    ...([rawId, ...alternateIds].flatMap((id) => LEGACY_GIFT_NAMES_BY_ID[id] || []))
  ], 200).filter((name) => name !== originalName && !(oldFalseFamily && OLD_HEART_NAMES.has(normalizeGiftName(name))));
  const gift = {
    id: rawId,
    alternateIds,
    alternateNames,
    name: originalName,
    cost: Math.max(
      0,
      Number(value.cost ?? value.diamondCount ?? value.diamond_count) || 0
    ),
    imageUrl: /^https:\/\//i.test(
      String(value.imageUrl || value.image_url || value.giftPictureUrl || "")
    )
      ? safeString(
          value.imageUrl || value.image_url || value.giftPictureUrl,
          1000
        )
      : "",
    source: safeString(value.source || "catalog", 40),
    giftType: Math.max(0, Number(value.giftType) || 0),
    combo: Boolean(value.combo),
    imageUri: safeString(value.imageUri, 1000),
    primaryEffectId: Math.max(0, Number(value.primaryEffectId) || 0),
    isGlobalGift: Boolean(value.isGlobalGift),
    isDisplayedOnPanel: Boolean(value.isDisplayedOnPanel)
  };
  const family = giftFamily(gift);
  return {
    ...gift,
    // Heart Me is always the same red heart. A creator's separate segmented
    // gift keeps its own exact name/art; segmentation is not a gift identity.
    imageUrl: family === "community-heart" ? COMMUNITY_HEART_IMAGE_URL : gift.imageUrl,
    selectable: rawId !== "17712",
    name: family ? canonicalGiftName(gift, originalName) : originalName,
    originalName:
      family && originalName !== canonicalGiftName(gift, originalName)
        ? originalName
        : oldFalseFamily && OLD_HEART_NAMES.has(normalizeGiftName(savedOriginalName)) ? "" : savedOriginalName,
    giftFamily: family
  };
}

function dedupeGiftCatalog(values = []) {
  let current = Array.isArray(values) ? values : [];
  let previousSignature = "";
  for (let pass = 0; pass < 8; pass += 1) {
    const next = dedupeGiftCatalogPass(current);
    const signature = giftCatalogSignature(next);
    if (signature === previousSignature) return next;
    previousSignature = signature;
    current = next;
  }
  return current;
}

function dedupeGiftCatalogPass(values = []) {
  const normalized = (Array.isArray(values) ? values : [])
    .map(normalizeGift)
    .filter((gift) => gift.id && gift.name);
  const parents = normalized.map((_gift, index) => index);
  const ranks = normalized.map(() => 0);
  const keys = new Map();

  const find = (index) => {
    let root = index;
    while (parents[root] !== root) root = parents[root];
    while (parents[index] !== index) {
      const parent = parents[index];
      parents[index] = root;
      index = parent;
    }
    return root;
  };
  const union = (left, right) => {
    let leftRoot = find(left);
    let rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    if (ranks[leftRoot] < ranks[rightRoot]) {
      [leftRoot, rightRoot] = [rightRoot, leftRoot];
    }
    parents[rightRoot] = leftRoot;
    if (ranks[leftRoot] === ranks[rightRoot]) ranks[leftRoot] += 1;
  };

  normalized.forEach((gift, index) => {
    for (const key of giftDedupeKeys(gift)) {
      if (keys.has(key)) union(index, keys.get(key));
      else keys.set(key, index);
    }
  });

  const imageGroups = new Map();
  normalized.forEach((gift, index) => {
    const imageKey = giftImageIdentity(gift.imageUrl);
    if (!imageKey) return;
    const key = `${imageKey}:${gift.cost}`;
    const group = imageGroups.get(key) || { legacy: [], numeric: [] };
    const ids = [gift.id, ...(gift.alternateIds || [])];
    group[ids.some((id) => /^\d+$/.test(id)) ? "numeric" : "legacy"].push(index);
    imageGroups.set(key, group);
  });
  for (const group of imageGroups.values()) {
    const numericRoots = [...new Set(group.numeric.map(find))];
    // La source historique utilise des slugs, pas des ID TikTok. On peut la
    // raccorder à un ID actuel uniquement si le dessin ET le coût désignent
    // un seul groupe technique. Deux ID numériques restent distincts, même
    // s'ils ont le même nom/prix/dessin ; deux slugs seuls restent distincts.
    if (numericRoots.length === 1) {
      for (const index of group.legacy) union(index, numericRoots[0]);
    }
  }

  const groups = new Map();
  normalized.forEach((gift, index) => {
    const root = find(index);
    const group = groups.get(root) || [];
    group.push(gift);
    groups.set(root, group);
  });

  return [...groups.values()]
    .map((group) => group.reduce(mergeGiftEntries))
    .sort(compareGifts);
}

function giftCatalogSignature(gifts) {
  return gifts
    .map((gift) =>
      [
        gift.id,
        ...(gift.alternateIds || []),
        gift.name,
        ...(gift.alternateNames || []),
        gift.cost,
        gift.imageUrl
      ].join("\u0001")
    )
    .join("\u0002");
}

function giftDedupeKeys(gift) {
  const keys = [];
  for (const id of [gift.id, ...(gift.alternateIds || [])]) {
    if (id) keys.push(`id:${String(id).toLowerCase()}`);
  }
  // Cette famille est explicitement identifiée par le résolveur partagé.
  // Une famille inconnue, un nom ou un prix ne créent jamais d'alias d'ID.
  if (gift.giftFamily === "community-heart") keys.push("family:community-heart");
  return keys;
}

function mergeGiftEntries(left, right) {
  const preferred = giftQuality(right) >= giftQuality(left) ? right : left;
  const fallback = preferred === right ? left : right;
  const allIds = uniqueStrings([
    preferred.id,
    ...(preferred.alternateIds || []),
    fallback.id,
    ...(fallback.alternateIds || [])
  ], 160);
  const id = /^\d+$/.test(preferred.id)
    ? preferred.id
    : allIds.find((value) => /^\d+$/.test(value)) || preferred.id || fallback.id;
  const allNames = uniqueStrings([
    preferred.name,
    preferred.originalName,
    ...(preferred.alternateNames || []),
    fallback.name,
    fallback.originalName,
    ...(fallback.alternateNames || [])
  ], 200);
  const name = preferred.name || fallback.name;
  return normalizeGift({
    ...fallback,
    ...preferred,
    id,
    alternateIds: allIds.filter((value) => value !== id),
    alternateNames: allNames.filter((value) => value !== name),
    imageUrl: preferred.imageUrl || fallback.imageUrl,
    name
  });
}

function giftQuality(gift) {
  const sourceRank = {
    // Le LIVE fournit le dessin effectivement reçu, même si son ID faisait
    // déjà partie d'un ancien catalogue localisé ou embarqué.
    live: 5,
    "tiktok-fr": 4,
    catalog: 3,
    tiklive: 2
  }[gift.source] || 1;
  return (
    sourceRank * 100 +
    (/^\d+$/.test(gift.id) ? 20 : 0) +
    (gift.imageUrl ? 10 : 0) +
    (gift.cost ? 4 : 0) +
    (gift.giftType ? 2 : 0) +
    (gift.combo ? 1 : 0)
  );
}

function sameGiftCatalogEntry(left, right) {
  return giftCatalogSignature([left]) === giftCatalogSignature([right]) &&
    left.giftType === right.giftType && left.combo === right.combo &&
    left.imageUri === right.imageUri &&
    left.primaryEffectId === right.primaryEffectId &&
    left.isGlobalGift === right.isGlobalGift &&
    left.isDisplayedOnPanel === right.isDisplayedOnPanel;
}

function uniqueStrings(values, maximumLength) {
  return [...new Set(
    values
      .map((value) => safeString(value, maximumLength))
      .filter(Boolean)
  )];
}

function inferNumericGiftId(value) {
  const match = String(value || "").match(/(?:^gift-|[-_])(\d{4,})$/i);
  return match?.[1] || "";
}

function compareGifts(left, right) {
  return (
    left.cost - right.cost ||
    left.name.localeCompare(right.name, "fr", {
      sensitivity: "base",
      numeric: true
    }) ||
    left.id.localeCompare(right.id, "en", { numeric: true })
  );
}

module.exports = { LOCALIZED_GIFT_REFRESH_MS, MAX_ROOM_GIFT_CACHES, GiftCatalog, fetchFrenchTikTokGifts, dedupeLocalizedGifts, dedupeRoomGifts, normalizeGift, dedupeGiftCatalog, dedupeGiftCatalogPass, giftCatalogSignature, giftDedupeKeys, mergeGiftEntries, giftQuality, uniqueStrings, inferNumericGiftId, compareGifts };

