"use strict";

/** catalogs : module « gifts », sans initialisation externe au chargement. */
const fs = require("node:fs");
const path = require("node:path");
const { safeString } = require("../utils");
const { COMMUNITY_HEART_IMAGE_URL, canonicalGiftName, findCatalogGift, giftFamily, giftImageIdentity } = require("../../shared/gift-identity");
const { normalizeSearch } = require("./common");

const LOCALIZED_GIFT_REFRESH_MS = 6 * 60 * 60 * 1000;
const MAX_GIFT_CATALOG_RESULTS = 10000;
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

  async refreshLocalized(username = "", { force = false } = {}) {
    const targetUsername = String(username || "tiktok")
      .trim()
      .replace(/^@+/, "") || "tiktok";
    if (
      !force &&
      this.localizedUsername === targetUsername &&
      Date.now() - this.localizedAtMs < LOCALIZED_GIFT_REFRESH_MS
    ) {
      return this.gifts;
    }
    if (this.refreshPromise && !force) return this.refreshPromise;
    const refresh = Promise.resolve(
      this.fetchLocalizedGifts(targetUsername)
    ).then((values) => {
      const gifts = dedupeLocalizedGifts(values);
      if (!gifts.length) {
        throw new Error("Le catalogue TikTok de la salle est vide.");
      }
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
      this.generatedAt = new Date().toISOString();
      this.localizedAtMs = Date.now();
      this.localizedUsername = targetUsername;
      return this.gifts;
    });
    const pending = refresh.finally(() => {
      if (this.refreshPromise === pending) this.refreshPromise = null;
    });
    this.refreshPromise = pending;
    return pending;
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
          normalizeSearch(
            `${gift.name} ${gift.originalName || ""} ${gift.id} ${gift.cost} ` +
              `${(gift.alternateNames || []).join(" ")} ` +
              `${(gift.alternateIds || []).join(" ")}`
          ).includes(needle)
        )
      : this.gifts;
    return {
      generatedAt: this.generatedAt,
      total: source.length,
      gifts: source.slice(0, max)
    };
  }
}

async function fetchFrenchTikTokGifts(
  username = "tiktok",
  { createConnection } = {}
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
  // fetchAvailableGifts() n'associe pas la salle tout seul dans la version
  // embarquée du connecteur. Sans room_id, TikTok renvoie son catalogue
  // mondial générique au lieu des cadeaux rattachés au créateur.
  connection.clientParams.room_id = String(roomId);
  return connection.fetchAvailableGifts();
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
  const originalName = safeString(value.name ?? value.giftName, 200);
  const rawId = safeString(value.id ?? value.giftId ?? value.gift_id, 160);
  const inferredNumericId = inferNumericGiftId(rawId);
  const alternateIds = uniqueStrings([
    ...(Array.isArray(value.alternateIds) ? value.alternateIds : []),
    ...(Array.isArray(value.giftIds) ? value.giftIds : []),
    inferredNumericId
  ], 160).filter((id) => id !== rawId);
  const alternateNames = uniqueStrings([
    ...(Array.isArray(value.alternateNames) ? value.alternateNames : []),
    value.originalName,
    ...([rawId, ...alternateIds].flatMap((id) => LEGACY_GIFT_NAMES_BY_ID[id] || []))
  ], 200).filter((name) => name !== originalName);
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
    // Un regroupement d'identifiants ne doit pas remettre le dessin historique
    // de Heart Me à la place du cœur de communauté actuel. Les visuels reçus
    // dans les événements LIVE restent intacts ; seul le catalogue est harmonisé.
    imageUrl: family === "community-heart" ? COMMUNITY_HEART_IMAGE_URL : gift.imageUrl,
    name: family ? canonicalGiftName(gift, originalName) : originalName,
    originalName:
      family && originalName !== canonicalGiftName(gift, originalName)
        ? originalName
        : safeString(value.originalName, 200),
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

module.exports = { LOCALIZED_GIFT_REFRESH_MS, GiftCatalog, fetchFrenchTikTokGifts, dedupeLocalizedGifts, normalizeGift, dedupeGiftCatalog, dedupeGiftCatalogPass, giftCatalogSignature, giftDedupeKeys, mergeGiftEntries, giftQuality, uniqueStrings, inferNumericGiftId, compareGifts };

