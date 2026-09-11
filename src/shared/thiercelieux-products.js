"use strict";

const THIERCELIEUX_EXTENSION_PRICE = 3.99;

const THIERCELIEUX_EXTENSION_PRODUCTS = Object.freeze([
  Object.freeze({
    id: "thiercelieux-extension-nouvelle-lune",
    packId: "nouvelle-lune",
    name: "Nouvelle Lune",
    price: THIERCELIEUX_EXTENSION_PRICE,
    currency: "EUR",
    description: "5 personnages, 36 emplacements Événement et 9 variantes de partie.",
    includes: Object.freeze([
      "5 personnages",
      "36 événements",
      "9 variantes"
    ])
  }),
  Object.freeze({
    id: "thiercelieux-extension-le-village",
    packId: "village",
    name: "Le Village",
    price: THIERCELIEUX_EXTENSION_PRICE,
    currency: "EUR",
    description: "3 personnages et les 14 bâtiments publics du Village.",
    includes: Object.freeze(["3 personnages", "14 bâtiments"])
  }),
  Object.freeze({
    id: "thiercelieux-extension-personnages",
    packId: "personnages",
    name: "Personnages",
    price: THIERCELIEUX_EXTENSION_PRICE,
    currency: "EUR",
    description: "16 personnages avancés et leurs conditions de victoire.",
    includes: Object.freeze(["16 personnages avancés"])
  }),
  Object.freeze({
    id: "thiercelieux-extension-25-ans",
    packId: "25-ans",
    name: "Édition 25 ans",
    price: THIERCELIEUX_EXTENSION_PRICE,
    currency: "EUR",
    description: "4 personnages anniversaire pour enrichir les compositions.",
    includes: Object.freeze(["4 personnages anniversaire"])
  })
]);

const THIERCELIEUX_ROLE_PACKS = Object.freeze({
  "simple-villageois": "base",
  "simple-loup-garou": "base",
  voyante: "base",
  sorciere: "base",
  chasseur: "base",
  cupidon: "base",
  "petite-fille": "base",
  voleur: "base",
  salvateur: "nouvelle-lune",
  ancien: "nouvelle-lune",
  "idiot-du-village": "nouvelle-lune",
  "bouc-emissaire": "nouvelle-lune",
  "joueur-de-flute": "nouvelle-lune",
  corbeau: "village",
  pyromane: "village",
  "loup-garou-blanc": "village",
  "villageois-villageois": "personnages",
  "deux-soeurs": "personnages",
  "trois-freres": "personnages",
  renard: "personnages",
  "montreur-ours": "personnages",
  "juge-begue": "personnages",
  "chevalier-epee-rouillee": "personnages",
  "servante-devouee": "personnages",
  comedien: "personnages",
  "enfant-sauvage": "personnages",
  "chien-loup": "personnages",
  "grand-mechant-loup": "personnages",
  "infect-pere-des-loups": "personnages",
  ange: "personnages",
  "abominable-sectaire": "personnages",
  "gitane-sans-philtre": "personnages",
  colosse: "25-ans",
  "singe-savant": "25-ans",
  marionnettiste: "25-ans",
  "puissante-mere-des-loups": "25-ans"
});

const THIERCELIEUX_VARIANT_IDS = Object.freeze([
  "clair-de-lune",
  "communaute-hameaux",
  "pas-lui",
  "murs-murs",
  "double-je",
  "fete-moisson",
  "peste-noire",
  "fascination",
  "nouvelle-lune"
]);

function entitlementProductId(entry) {
  return String(
    typeof entry === "string"
      ? entry
      : entry?.productId || entry?.gameId || entry?.id || ""
  ).trim();
}

function entitlementExpiryMs(entry) {
  const numeric = Number(entry?.expiresAtMs || 0);
  if (numeric > 0) return numeric;
  const parsed = Date.parse(String(entry?.expiresAt || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function activeProductEntitlement(entry, nowMs = Date.now()) {
  if (typeof entry === "string") return Boolean(entry.trim());
  if (!entry || typeof entry !== "object") return false;
  const source = String(entry.source || "").trim().toLowerCase();
  const status = String(entry.status || "").trim().toLowerCase();
  if (source === "trial" || status === "trial") {
    return entitlementExpiryMs(entry) > nowMs;
  }
  return (
    !status ||
    ["active", "captured", "completed", "paid", "purchased"].includes(status)
  );
}

function ownedThiercelieuxPackIds(state = {}, nowMs = Date.now()) {
  const entitlements = Array.isArray(state?.commerce?.gameEntitlements)
    ? state.commerce.gameEntitlements
    : [];
  const activeIds = new Set(
    entitlements
      .filter((entry) => activeProductEntitlement(entry, nowMs))
      .map(entitlementProductId)
      .filter(Boolean)
  );
  return new Set([
    "base",
    ...THIERCELIEUX_EXTENSION_PRODUCTS
      .filter((product) => activeIds.has(product.id))
      .map((product) => product.packId)
  ]);
}

function sanitizeThiercelieuxEntitlements(config = {}, state = {}) {
  const ownedPacks = ownedThiercelieuxPackIds(state);
  const requestedPacks = Array.isArray(config.packs) ? config.packs : ["base"];
  const packs = [...new Set(["base", ...requestedPacks])].filter((packId) =>
    ownedPacks.has(String(packId))
  );
  const enabledPacks = new Set(packs);
  const roleIds = (Array.isArray(config.roleIds) ? config.roleIds : [])
    .slice(0, 8)
    .map((roleId) => {
      const normalized = String(roleId || "");
      const rolePack = THIERCELIEUX_ROLE_PACKS[normalized];
      return rolePack && ownedPacks.has(rolePack) && enabledPacks.has(rolePack)
        ? normalized
        : "simple-villageois";
    });
  const nouvelleLuneEnabled = enabledPacks.has("nouvelle-lune");
  const villageEnabled = enabledPacks.has("village");
  return {
    ...config,
    packs,
    roleIds,
    selectedVariantIds: nouvelleLuneEnabled
      ? (Array.isArray(config.selectedVariantIds) ? config.selectedVariantIds : [])
          .map(String)
          .filter((id) => THIERCELIEUX_VARIANT_IDS.includes(id))
      : [],
    buildingsEnabled: villageEnabled && config.buildingsEnabled === true,
    eventsEnabled: nouvelleLuneEnabled && config.eventsEnabled === true
  };
}

module.exports = {
  THIERCELIEUX_EXTENSION_PRICE,
  THIERCELIEUX_EXTENSION_PRODUCTS,
  THIERCELIEUX_ROLE_PACKS,
  THIERCELIEUX_VARIANT_IDS,
  activeProductEntitlement,
  entitlementProductId,
  ownedThiercelieuxPackIds,
  sanitizeThiercelieuxEntitlements
};
