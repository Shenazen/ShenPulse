"use strict";

const catalogIndexes = new WeakMap();
const COMMUNITY_HEART_CANONICAL_NAME = "Cœur sur moi";
const COMMUNITY_HEART_GIFT_IDS = new Set([
  "7934",
  "17712",
  "62816",
  "601333"
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
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function giftImageIdentity(value = "") {
  const clean = String(value || "")
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/~.*$/, "");
  if (!clean) return "";
  return clean.split("/").filter(Boolean).pop()?.toLowerCase() || "";
}

function giftFamily(value = {}) {
  const explicit = String(value.giftFamily ?? value.family ?? "")
    .trim()
    .toLowerCase();
  if (explicit) return explicit;

  const gift = {
    ...(value.extendedGiftInfo || {}),
    ...(value.giftDetails || {}),
    ...(value.gift || {})
  };
  const id = String(
    value.giftId ?? value.id ?? gift.giftId ?? gift.id ?? ""
  ).trim();
  const nameKey = normalizeGiftName(
    value.giftName ?? value.name ?? gift.giftName ?? gift.name
  );
  if (
    COMMUNITY_HEART_GIFT_IDS.has(id) ||
    COMMUNITY_HEART_NAMES.has(nameKey)
  ) {
    return "community-heart";
  }

  const cost = Number(
    value.giftCost ??
      value.cost ??
      value.value ??
      value.diamondCount ??
      gift.cost ??
      gift.diamondCount ??
      gift.diamond_count ??
      0
  );
  const combo = Boolean(
    value.giftCombo ?? value.combo ?? gift.combo ?? gift.isCombo
  );
  const imageUri = String(
    value.giftImageUri ??
      value.imageUri ??
      gift.imageUri ??
      gift.image?.uri ??
      gift.icon?.uri ??
      ""
  );
  if (cost === 1 && combo && /(?:^|\/)saliency_seg_/i.test(imageUri)) {
    return "community-heart";
  }
  return "";
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
  return {
    id: String(value.giftId ?? value.id ?? "").trim().toLowerCase(),
    family: giftFamily(value),
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
    return { byId: new Map(), byImage: new Map(), byName: new Map() };
  }
  const cached = catalogIndexes.get(gifts);
  if (cached) return cached;
  const index = { byId: new Map(), byImage: new Map(), byName: new Map() };
  for (const gift of gifts) {
    const identity = giftIdentity(gift);
    if (identity.id && !index.byId.has(identity.id)) {
      index.byId.set(identity.id, gift);
    }
    if (identity.imageKey && !index.byImage.has(identity.imageKey)) {
      index.byImage.set(identity.imageKey, gift);
    }
    if (identity.nameKey) {
      const matches = index.byName.get(identity.nameKey) || [];
      matches.push({ gift, cost: identity.cost });
      index.byName.set(identity.nameKey, matches);
    }
  }
  catalogIndexes.set(gifts, index);
  return index;
}

function findCatalogGift(gifts = [], candidate = {}) {
  const identity = giftIdentity(candidate);
  const index = giftCatalogIndex(gifts);
  if (identity.id && index.byId.has(identity.id)) {
    return index.byId.get(identity.id);
  }
  if (identity.imageKey && index.byImage.has(identity.imageKey)) {
    return index.byImage.get(identity.imageKey);
  }
  if (!identity.nameKey) return null;
  const byName = index.byName.get(identity.nameKey) || [];
  if (!byName.length) return null;
  if (identity.cost) {
    return (
      byName.find((entry) => entry.cost === identity.cost)?.gift ||
      null
    );
  }
  return byName.length === 1 ? byName[0].gift : null;
}

function mergeIdentity(primary = {}, fallback = null) {
  const direct = giftIdentity(primary);
  const resolved = giftIdentity(fallback || {});
  return {
    id: direct.id || resolved.id,
    family: direct.family || resolved.family,
    name: direct.name || resolved.name,
    nameKey: direct.nameKey || resolved.nameKey,
    imageUrl: direct.imageUrl || resolved.imageUrl,
    imageKey: direct.imageKey || resolved.imageKey,
    cost: direct.cost || resolved.cost
  };
}

function sameGiftIdentity(expected, actual) {
  if (expected.id && actual.id) {
    if (expected.id === actual.id) return true;
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

module.exports = {
  COMMUNITY_HEART_CANONICAL_NAME,
  canonicalGiftName,
  enrichGiftEvent,
  findCatalogGift,
  giftConditionMatches,
  giftFamily,
  giftIdentity,
  giftImageIdentity,
  normalizeGiftName,
  sameGiftIdentity
};
