"use strict";

/** Façade publique du catalogue de jeux ; assemblage et copie isolée pour les consommateurs. */
const path = require("node:path");
const { INTERNAL_GAMES } = require("./game-catalog/internal-games");
const { EXTERNAL_GAMES } = require("./game-catalog/external-games");
const { buildGameGuide } = require("./game-catalog/guides");
const { interactionEffects } = require("./game-catalog/effects");
const { interactionArtwork } = require("./game-catalog/interaction-art");
const {prepareGamePresentation}=require("./game-catalog/presentation");
const gameCategories = require("../shared/game-categories");

function loadShenazenGameCatalog(resourcesDirectory) {
  const interactionsDirectory = path.join(resourcesDirectory, "game-interactions");
  const external = EXTERNAL_GAMES.map((entry) => {
    if (entry.effects?.length) return { ...entry, guide: buildGameGuide(entry, entry.effects) };
    const effects = interactionEffects(interactionsDirectory, entry.id);
    // Une illustration marquée « native » ne fournit aucun module exécutable.
    // Les fiches sans intégration restent consultables, sans envoyer de commandes
    // à l’ancien port générique d’une passerelle tierce.
    const unavailableReason = "Le module autonome ShenPulse de ce jeu n’est pas encore disponible.";
    return {
      ...entry,
      connector: { type: "demo" },
      effects: effects.map(effect => ({ ...effect, available: false, unavailableReason, description: unavailableReason })),
      guide: buildGameGuide(entry, effects.map(effect => ({ ...effect, available: false })))
    };
  });
  return [
    ...INTERNAL_GAMES.map((entry) => ({
      ...entry,
      guide: buildGameGuide(entry, entry.effects)
    })),
    ...external,
    ...require("./game-catalog/shen-native-games").SHEN_NATIVE_GAMES.map(entry=>({...entry,guide:buildGameGuide(entry,entry.effects)}))
  ].map(interactionArtwork(resourcesDirectory)).map(prepareGamePresentation).map((entry) => structuredClone({
    ...entry,
    catalogCategory: gameCategories.categoryFor(entry),
    catalogCategories: gameCategories.categoriesFor(entry)
  }));
}

module.exports = { loadShenazenGameCatalog };
