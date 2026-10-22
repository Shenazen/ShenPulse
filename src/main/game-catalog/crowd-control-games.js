"use strict";

const { game } = require("./builders");

function crowdControlGame(id, name, connector) {
  const effects = require(`../../../resources/catalogs/${id}-effects.json`);
  return game(id, name, {
    included: true,
    source: `Crowd Control · ${name}`,
    artworkUrl: `https://resources.crowdcontrol.live/images/${id === "balatro" ? "Balatro" : "BluePrince"}/box.jpg`,
    description: id === "balatro"
      ? "Les cadeaux du LIVE modifient l’argent, les mises, les mains, les cartes, les jokers et les boosters. Installation Steam ou Xbox Game Pass."
      : "Les cadeaux du LIVE modifient les ressources, la vitesse, les objets et les plans des pièces. Installation Steam ou Xbox Game Pass.",
    tags: ["inclus", "mod PC", "Steam", "Game Pass"],
    installerVersion: id === "blue-prince" ? "1.0.1" : "1.0.0",
    interactionCatalogVersion: 20261021,
    connector,
    effects,
    defaultMappings: effects.map(effect => ({
      id: `catalog-${effect.id}`, effectId: effect.id, title: effect.name,
      triggerType: "gift", threshold: 1, cooldownSeconds: 0,
      duration: effect.duration || 0, enabled: effect.available !== false, triggerEnabled: false,
      parameters: {}
    }))
  });
}

const BALATRO = crowdControlGame("balatro", "Balatro", {
  type: "tcp-server", host: "127.0.0.1", port: 58437,
  timeoutMs: 12000, expectResponse: true, launchConnectionTimeoutMs: 45000,
  focusProcessOnManualTrigger: "Balatro"
});
const BLUE_PRINCE = crowdControlGame("blue-prince", "Blue Prince", {
  type: "tcp-server", host: "127.0.0.1", port: 58442,
  timeoutMs: 12000, durationMultiplier: 1000, expectResponse: true,
  launchConnectionTimeoutMs: 90000,
  temporaryFailureRetryMs: 5000,
  temporaryFailureRetryIntervalMs: 500,
  temporaryFailureMessage: "L’effet Blue Prince n’est pas disponible dans cette situation. Fermez les menus et vérifiez les ressources ou l’écran de sélection des pièces, puis réessayez.",
  focusProcessOnManualTrigger: "BLUE PRINCE"
});

module.exports = { BALATRO, BLUE_PRINCE };
