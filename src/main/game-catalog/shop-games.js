"use strict";

const { game } = require("./builders");
const { manualShopMapping, supermarketDefaultMappings, SUPERMARKET_STARTER_VERSION } = require("./shop-game-presets");
const assets = require("../../../resources/catalogs/shop-game-assets.json");
const definitions = {
  "hogwarts-legacy": ["Hogwarts Legacy", "990080", "Magie, ressources, météo, créatures et ennemis dans une sauvegarde jouable."],
  "tcg-card-shop-simulator": ["TCG Card Shop Simulator", "3070070", "Clients, finances, employés, rayons et effets temporaires dans votre boutique."],
  "supermarket-simulator": ["Supermarket Simulator", "2670630", "Clients, produits, finances, employés et événements dans votre supermarché."],
  "shift-at-midnight": ["Shift At Midnight", "3722330", "Clients humains ou sosies, créatures, ressources et surprises pendant la nuit."]
};

module.exports = Object.entries(definitions).map(([id, [name, steamId, description]]) => {
  const effects = require(`../../../resources/catalogs/${id}-effects.json`);
  return game(id, name, {
    included: true, source: "ShenPulse", description, installerVersion: assets[id].version, interactionCatalogVersion: id === "supermarket-simulator" ? SUPERMARKET_STARTER_VERSION : id === "shift-at-midnight" ? 20261023 : 20261022,
    artwork: `catalog/${id}.${id==='shift-at-midnight'?'png':'jpg'}`,
    tags: ["inclus", "interactions PC", "Steam", "Xbox / Game Pass"],
    connector: { type: "shop-mod", timeoutMs: 12000, launchConnectionTimeoutMs: 600000, durationMultiplier: 1 }, effects,
    defaultMappings: id === "supermarket-simulator" ? supermarketDefaultMappings(effects) : effects.map(manualShopMapping)
  });
});
