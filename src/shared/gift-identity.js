(function exposeGiftIdentity(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ShenPulseGiftIdentity = api;
})(typeof globalThis === "object" ? globalThis : this, function createGiftIdentityApi() {
"use strict";

const catalogIndexes = new WeakMap();
const COMMUNITY_HEART_CANONICAL_NAME = "Cœur sur moi";
// Base neutre Heart Me fournie par TikTok : cœur rouge au clin d'œil, bord doré,
// sans accessoires de créateur. Un cadeau personnalisé avec un autre ID
// conserve son identité et son nom exact : son détourage ne prouve rien.
// Ne pas confondre avec l'icône dorée entrelacée du catalogue brut 17712 ni
// avec les variantes personnalisées « resource/composed.* » du cadeau 7934.
const COMMUNITY_HEART_IMAGE_URL = "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/heartme_outfit/base_heartme_composition.png~tplv-obj.webp";
const COMMUNITY_HEART_GIFT_IDS = new Set([
  "heart-me",
  "7934"
]);
const COMMUNITY_HEART_NAMES = new Set([
  "coeur de la communaute",
  "community heart",
  "coeur sur moi",
  "envoie moi un coeur",
  "heart me"
]);

/**
 * Identifie un cadeau indépendamment du libellé traduit par TikTok.
 *
 * Le nom reste utile comme solution de secours, mais l'identifiant technique
 * est prioritaire. Le visuel n'est jamais une identité : TikTok peut le
 * personnaliser pour un créateur sans changer la famille logique du cadeau.
 */

function normalizeGiftName(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[œŒ]/g, "oe")
    .replace(/[æÆ]/g, "ae")
    .replace(/[’'`]/g, " ")
    // Garder les lettres non latines : « TikTok 화산 » et « TikTok » ne sont
    // pas le même cadeau, même si le catalogue propose des traductions.
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function giftImageIdentity(value = "") {
  const clean = String(value || "")
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/~.*$/, "");
  if (!clean) return "";
  const filename = clean.split("/").filter(Boolean).pop()?.toLowerCase() || "";
  // Le CDN TikTok expose le même hash avec ou sans extension. Ne généraliser
  // cette équivalence ni aux noms de fichiers ordinaires ni à l'identité du cadeau.
  return filename.match(/^([a-f0-9]{32})(?:\.(?:png|jpe?g|webp))?$/i)?.[1] || filename;
}

function isCommunityHeartGiftId(value) {
  return COMMUNITY_HEART_GIFT_IDS.has(String(value || "").trim().toLowerCase());
}

function giftFamily(value = {}) {
  const gift = {
    ...(value.extendedGiftInfo || {}),
    ...(value.giftDetails || {}),
    ...(value.gift || {})
  };
  const id = String(
    value.giftId ?? value.id ?? gift.giftId ?? gift.id ?? ""
  ).trim().toLowerCase();
  const nameKey = normalizeGiftName(
    value.giftName ?? value.name ?? gift.giftName ?? gift.name
  );
  if (isCommunityHeartGiftId(id)) return "community-heart";
  const explicit = String(value.giftFamily ?? value.family ?? "").trim().toLowerCase();
  // Older versions persisted this incorrect family for unrelated custom IDs.
  // A precise non-heart ID takes priority over that stale family or its name.
  if (id) return explicit === "community-heart" ? "" : explicit;
  if (explicit) return explicit;
  return COMMUNITY_HEART_NAMES.has(nameKey) ? "community-heart" : "";
}

function canonicalGiftName(value = {}, fallback = "Cadeau") {
  if (giftFamily(value) === "community-heart") {
    return COMMUNITY_HEART_CANONICAL_NAME;
  }
  return String(value.giftName ?? value.name ?? fallback).trim() || fallback;
}

function giftIdentity(value = {}) {
  const cost = Number(
    value.giftCost ?? value.cost ?? value.value ?? value.diamondCount ?? 0
  );
  const id = String(value.giftId ?? value.id ?? "").trim().toLowerCase();
  const family = giftFamily(value);
  const alternateIds = [
    ...(Array.isArray(value.alternateIds) ? value.alternateIds : []),
    ...(Array.isArray(value.giftIds) ? value.giftIds : [])
  ]
    .map((entry) => String(entry || "").trim().toLowerCase())
    .filter(Boolean);
  return {
    id,
    ids: [...new Set([id, ...alternateIds].filter(Boolean))].filter((candidate) =>
      id ? candidate === id || isCommunityHeartGiftId(candidate) === isCommunityHeartGiftId(id)
        : family !== "community-heart" || isCommunityHeartGiftId(candidate)),
    family,
    name: canonicalGiftName(value, ""),
    nameKey: normalizeGiftName(canonicalGiftName(value, "")),
    imageUrl: String(
      value.giftImageUrl ?? value.imageUrl ?? value.image ?? ""
    ).trim(),
    imageKey: giftImageIdentity(
      value.giftImageUrl ?? value.imageUrl ?? value.image
    ),
    cost: Number.isFinite(cost) && cost > 0 ? cost : 0
  };
}

function giftCatalogIndex(gifts) {
  if (!Array.isArray(gifts)) {
    return { byId: new Map(), byName: new Map() };
  }
  const cached = catalogIndexes.get(gifts);
  if (cached && cached.length === gifts.length) return cached;
  const index = { byId: new Map(), byName: new Map(), length: gifts.length };
  for (const gift of gifts) {
    const identity = giftIdentity(gift);
    for (const id of identity.ids) {
      const matches = index.byId.get(id) || new Set();
      matches.add(gift);
      index.byId.set(id, matches);
    }
    const nameKeys = new Set([
      identity.nameKey,
      normalizeGiftName(gift.originalName),
      ...(Array.isArray(gift.alternateNames)
        ? gift.alternateNames.map(normalizeGiftName)
        : [])
    ]);
    for (const nameKey of nameKeys) {
      if (!nameKey) continue;
      const matches = index.byName.get(nameKey) || [];
      matches.push({ gift, cost: identity.cost });
      index.byName.set(nameKey, matches);
    }
  }
  catalogIndexes.set(gifts, index);
  return index;
}

/**
 * Résout une référence enregistrée sans modifier le choix de l'utilisateur.
 * L'ID exact prime, puis les alias techniques déjà connus. Un ID inconnu ne
 * peut jamais être remplacé sur la seule base du nom, du prix ou du dessin.
 * Les anciens choix sans ID sont repris uniquement si le nom (et le prix,
 * lorsqu'il est enregistré) désigne un seul cadeau du catalogue.
 */
function findCatalogGift(gifts = [], candidate = {}) {
  const identity = giftIdentity(candidate);
  const index = giftCatalogIndex(gifts);
  if (identity.id && index.byId.has(identity.id)) {
    const matches = index.byId.get(identity.id);
    return matches.size === 1 ? matches.values().next().value : null;
  }
  const aliases = new Set();
  for (const id of identity.ids) {
    for (const gift of index.byId.get(id) || []) aliases.add(gift);
  }
  if (aliases.size) return aliases.size === 1 ? aliases.values().next().value : null;
  if (identity.ids.length) return null;
  if (!identity.nameKey) return null;
  const byName = index.byName.get(identity.nameKey) || [];
  const matches = new Set(byName
    .filter((entry) => !identity.cost || entry.cost === identity.cost)
    .map((entry) => entry.gift));
  return matches.size === 1 ? matches.values().next().value : null;
}

/**
 * Retrouve seulement un visuel, jamais un identifiant ou des alias à déclencher.
 * Certaines anciennes sélections ne contiennent qu'un nom. Plusieurs variantes
 * régionales peuvent avoir exactement ce nom, le même prix et la même image :
 * leur dessin commun peut être affiché sans choisir arbitrairement un ID.
 * Dès que les dessins/prix diffèrent ou qu'un ID inconnu est présent, aucun
 * repli de ce type n'est permis. La résolution technique reste distincte.
 */
function giftVisualUrl(gifts = [], candidate = {}) {
  const resolved = findCatalogGift(gifts, candidate);
  if (resolved) return giftIdentity(resolved).imageUrl;
  const identity = giftIdentity(candidate);
  if (identity.ids.length || !identity.nameKey) return "";
  const matches = giftCatalogIndex(gifts).byName.get(identity.nameKey) || [];
  const compatible = matches.filter((entry) => !identity.cost || entry.cost === identity.cost);
  if (!compatible.length) return "";
  const first = giftIdentity(compatible[0].gift);
  if (!first.imageKey || !first.imageUrl || !first.cost) return "";
  const allShareVisual = compatible.every(({ gift }) => {
    const next = giftIdentity(gift);
    return next.cost === first.cost && next.imageKey === first.imageKey;
  });
  return allShareVisual ? first.imageUrl : "";
}

function mergeIdentity(primary = {}, fallback = null) {
  const direct = giftIdentity(primary);
  const resolved = giftIdentity(fallback || {});
  const resolvedSupportsDirect =
    !direct.ids.length ||
    direct.ids.some((id) => resolved.ids.includes(id));
  return {
    id: direct.id || resolved.id,
    ids: direct.ids.length
      ? resolvedSupportsDirect
        ? [...new Set([...direct.ids, ...resolved.ids])]
        : direct.ids
      : resolved.ids,
    family: direct.family || resolved.family,
    name: direct.name || resolved.name,
    nameKey: direct.nameKey || resolved.nameKey,
    imageUrl: direct.imageUrl || resolved.imageUrl,
    imageKey: direct.imageKey || resolved.imageKey,
    cost: direct.cost || resolved.cost
  };
}

function sameGiftIdentity(expected, actual) {
  if (expected.ids?.some((id) => actual.ids?.includes(id))) return true;
  if (expected.id && actual.id) {
    return Boolean(
      expected.family && actual.family && expected.family === actual.family
    );
  }
  if (expected.family && expected.family === actual.family) return true;
  return Boolean(expected.nameKey && expected.nameKey === actual.nameKey);
}

function giftConditionMatches(condition = {}, event = {}, gifts = []) {
  const eventData = event?.data || {};
  const conditionData = {
    giftId: condition.giftId,
    giftIds: condition.giftIds,
    giftFamily: condition.giftFamily,
    giftName: condition.value,
    giftImageUrl: condition.giftImageUrl,
    giftCost: condition.giftCost
  };
  const expected = mergeIdentity(
    conditionData,
    findCatalogGift(gifts, conditionData)
  );
  const actual = mergeIdentity(
    eventData,
    findCatalogGift(gifts, eventData)
  );
  return sameGiftIdentity(expected, actual);
}

function enrichGiftEvent(event = {}, gifts = []) {
  if (event?.type !== "gift") return event;
  const data = event.data || {};
  const catalogGift = findCatalogGift(gifts, event.data || {});
  const directIdentity = giftIdentity(data);
  const catalogIdentity = giftIdentity(catalogGift || {});
  const family = directIdentity.family || catalogIdentity.family;
  if (!catalogGift && !family) return event;
  const canonicalName = family === "community-heart"
    ? COMMUNITY_HEART_CANONICAL_NAME
    : directIdentity.name;
  return {
    ...event,
    data: {
      ...data,
      giftId: String(data.giftId || catalogGift?.id || ""),
      giftFamily: family,
      giftOriginalName:
        canonicalName !== String(data.giftName || "").trim()
          ? String(data.giftName || "").trim()
          : String(data.giftOriginalName || "").trim(),
      giftName: canonicalName,
      giftCatalogName:
        family === "community-heart"
          ? COMMUNITY_HEART_CANONICAL_NAME
          : catalogIdentity.name,
      giftCatalogImageUrl: catalogIdentity.imageUrl
    }
  };
}

return Object.freeze({
  COMMUNITY_HEART_CANONICAL_NAME,
  COMMUNITY_HEART_IMAGE_URL,
  canonicalGiftName,
  enrichGiftEvent,
  findCatalogGift,
  giftConditionMatches,
  giftFamily,
  giftIdentity,
  isCommunityHeartGiftId,
  giftImageIdentity,
  giftVisualUrl,
  normalizeGiftName,
  sameGiftIdentity
});
});
