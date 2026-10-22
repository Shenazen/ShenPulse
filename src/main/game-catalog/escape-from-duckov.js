"use strict";

const { game } = require("./builders");
const effects = require("../../../resources/catalogs/escape-from-duckov-effects.json");

module.exports = game("escape-from-duckov", "Escape From Duckov", {
  included: true, ownerOnly: true, minAppVersion: "2.0.5",
  artwork: "catalog/escape-from-duckov.jpg", source: "Crowd Control · Escape From Duckov",
  description: "83 interactions sur la santé, les ressources, les armes, les ennemis, la météo et le canard. Jeu Steam requis.",
  tags: ["inclus", "Steam", "privé", "action", "mod local"],
  installerVersion: "1.1.1", interactionCatalogVersion: 20261022,
  connector: {
    type: "tcp-server", host: "127.0.0.1", port: 58440, timeoutMs: 12000,
    durationMultiplier: 1000, expectResponse: true, launchConnectionTimeoutMs: 90000,
    focusProcessOnManualTrigger: "Duckov",
    temporaryFailureMessage: "Cet effet nécessite une expédition chargée, hors du refuge et des menus. Vérifiez aussi l’arme tenue, les altérations et les ressources nécessaires."
  },
  effects,
  defaultMappings: effects.map(effect => ({
    id: `catalog-${effect.id}`, effectId: effect.id, title: effect.name,
    triggerType: "gift", threshold: 1, cooldownSeconds: 0,
    duration: effect.duration || 0, enabled: true, triggerEnabled: false
  }))
});
