"use strict";

const fs = require("node:fs");
const path = require("node:path");

// Résolution commune : mêmes images dans les cartes, l’éditeur et les overlays.
// Le registre ne modifie aucun identifiant, paramètre, déclencheur ou effet.
function interactionArtwork(resourcesDirectory) {
  const file = path.join(resourcesDirectory, "catalogs/game-interaction-art.json");
  const registry = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { entries: [] };
  const images = new Map();
  for (const entry of registry.entries || []) {
    const expected = `${entry.gameId}/${entry.effectId}.png`;
    if (entry.file !== expected || !/^[a-z0-9_-]+\/[a-z0-9_-]+\.png$/i.test(expected)) continue;
    if (fs.existsSync(path.join(resourcesDirectory, "game-interaction-art", expected)))
      images.set(`${entry.gameId}/${entry.effectId}`, `../../resources/game-interaction-art/${expected}`);
  }
  return pack => ({ ...pack, effects: pack.effects.map(effect => {
    const image = images.get(`${pack.id}/${effect.id}`);
    return !effect.image && image ? { ...effect, image } : effect;
  }) });
}

module.exports = { interactionArtwork };
