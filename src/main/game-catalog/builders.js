"use strict";

/** Catalogue de jeux : domaine « builders », données et identifiants conservés. */
const { effectFromTitle } = require("./effects");

function game(id, name, options = {}) {
  const included = options.included === true;
  const community = new Set([
    "thiercelieux", "coin-pusher", "connect-four", "deal-or-no-deal",
    "diamond-drop", "diamond-bridge", "color-strike", "tiklive-climb",
    "tiklive-cube-wars", "tiklive-stack-tower", "clash-of-live"
  ]).has(id);
  const requiresPro = included && community;
  return {
    schemaVersion: 1,
    id,
    name,
    publisher: "ShenPulse",
    ...(options.workspaceLayout==="shared"?{workspaceLayout:"shared"}:{}),
    ...(Array.isArray(options.storefronts)?{storefronts:[...options.storefronts]}:{}),
    version: options.version || "1.0.0",
    description: options.description || `Interactions TikTok LIVE configurables pour ${name}.`,
    platform: "Windows",
    tags: (options.tags || [
      requiresPro ? "Pro" : included ? "gratuit" : "achat unique",
      included ? "inclus" : "achat unique",
      "shenazenoverlay"
    ]).filter((tag) => requiresPro || !/abonnement requis/i.test(String(tag))),
    artwork: options.artwork || "",
    ...(options.coverArtwork ? { coverArtwork: String(options.coverArtwork) } : {}),
    ...(options.sceneArtwork?{sceneArtwork:String(options.sceneArtwork)}:{}),
    ...(options.serverAddress ? { serverAddress: String(options.serverAddress) } : {}),
    ...(options.minecraftVersion ? { minecraftVersion: String(options.minecraftVersion) } : {}),
    artworkUrl: options.artworkUrl || "",
    accessMode: included ? "included" : "purchase",
    included,
    requiresPro,
    price: included ? 0 : Number(options.price || 19.99),
    currency: "EUR",
    source: options.source || "ShenazenOverlay",
    ...(options.ownerOnly === true ? { ownerOnly: true } : {}),
    ...(options.minAppVersion ? { minAppVersion: String(options.minAppVersion) } : {}),
    connector: { ...(options.connector || { type: "demo" }) },
    effects: (options.effects || []).map((effect, index) =>
      typeof effect === "string"
        ? effectFromTitle(effect, index)
        : structuredClone(effect)
    ),
    defaultMappings: structuredClone(options.defaultMappings || []),
    deprecatedDefaultMappingIds: structuredClone(
      options.deprecatedDefaultMappingIds || []
    ),
    wheelPresets: structuredClone(options.wheelPresets || []),
    interactionCatalogVersion: Number(
      options.interactionCatalogVersion || 0
    ),
    installerVersion: String(options.installerVersion || ""),
    addOns: (options.addOns || []).map((addOn) => ({
      id: String(addOn.id || ""),
      packId: String(addOn.packId || ""),
      name: String(addOn.name || ""),
      price: Number(addOn.price || 0),
      currency: String(addOn.currency || "EUR"),
      description: String(addOn.description || ""),
      includes: (addOn.includes || []).map(String)
    }))
  };
}

function liveGame(id, name, effects) {
  return game(id, name, {
    included: true,
    requiresPro: true,
    source: "LiveInteractive Studio",
    effects
  });
}

function external(id, name, artworkUrl, source) {
  return game(id, name, {
    included: true,
    artworkUrl,
    source,
    description: `Catalogue d’interactions pour ${name}. L’intégration autonome ShenPulse n’est pas encore disponible ; ces références ne sont pas exécutables.`,
    effects: []
  });
}

module.exports = { game, liveGame, external };

