"use strict";
const { game } = require("./builders");
const { manualShopMapping } = require("./shop-game-presets");
const effects = require("../../../resources/catalogs/palworld-effects.json");

module.exports = game("palworld", "Palworld", {
  included: true,
  source: "ShenPulse",
  installerVersion: "1.0.0",
  interactionCatalogVersion: 20261028,
  artwork: "catalog/palworld.jpg",
  sceneArtwork: "covers/palworld-hero.jpg",
  tags: ["inclus", "interactions PC", "Steam", "Xbox / Game Pass", "solo"],
  description: "Pals, soins, ressources, expérience, caméra et événements dans votre monde solo.",
  connector: { type: "shop-mod", timeoutMs: 30000, launchConnectionTimeoutMs: 600000, durationMultiplier: 1 },
  effects,
  defaultMappings: effects.map(manualShopMapping)
});
