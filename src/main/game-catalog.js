"use strict";

/** Façade publique du catalogue de jeux ; assemblage et copie isolée pour les consommateurs. */
const path = require("node:path");
const { LOCAL_BRIDGE } = require("./game-catalog/connectors");
const { INTERNAL_GAMES } = require("./game-catalog/internal-games");
const { EXTERNAL_GAMES } = require("./game-catalog/external-games");
const { buildGameGuide } = require("./game-catalog/guides");
const { interactionEffects } = require("./game-catalog/effects");

function loadShenazenGameCatalog(resourcesDirectory) {
  const interactionsDirectory = path.join(resourcesDirectory, "game-interactions");
  const external = EXTERNAL_GAMES.map((entry) => {
    const effects = interactionEffects(interactionsDirectory, entry.id);
    const hasNativeEffects = effects.some((effect) => effect.available);
    return {
      ...entry,
      connector: hasNativeEffects ? { ...LOCAL_BRIDGE } : { type: "demo" },
      effects,
      guide: buildGameGuide(entry, effects)
    };
  });
  return [
    ...INTERNAL_GAMES.map((entry) => ({
      ...entry,
      guide: buildGameGuide(entry, entry.effects)
    })),
    ...external
  ].map((entry) => structuredClone(entry));
}

module.exports = { loadShenazenGameCatalog };
