"use strict";

/** API stable des installateurs. Un manifeste par jeu, assemblé dans l’ordre historique. */
const { INTEGRATED_GAME_IDS } = require("./game-installers/constants");

const GAME_INSTALLERS = Object.freeze({
  "crash-bandicoot-n-sane-trilogy": require("./game-installers/crash-bandicoot-n-sane-trilogy"),
  unturned: require("./game-installers/unturned"),
  "clash-of-live": require("./game-installers/clash-of-live"),
  "color-strike": require("./game-installers/color-strike"),
  "tiklive-climb": require("./game-installers/tiklive-climb"),
  "tiklive-cube-wars": require("./game-installers/tiklive-cube-wars"),
  "tiklive-stack-tower": require("./game-installers/tiklive-stack-tower"),
  demonologist: require("./game-installers/demonologist"),
  "find-the-needle-demo": require("./game-installers/find-the-needle-demo"),
  "euro-truck-simulator-2": require("./game-installers/euro-truck-simulator-2"),
  "resident-evil-3": require("./game-installers/resident-evil-3"),
  "gtav-montchiliad": require("./game-installers/gtav-montchiliad"),
  "cult-of-the-lamb": require("./game-installers/cult-of-the-lamb"),
  "stardew-valley": require("./game-installers/stardew-valley"),
  terraria: require("./game-installers/terraria"),
  "the-mortuary-assistant": require("./game-installers/the-mortuary-assistant"),
  "minecraft-bedrock-box": require("./game-installers/minecraft-bedrock-box"),
  "minecraft-sandbox-3": require("./game-installers/minecraft-sandbox-3"),
  "minecraft-survival-plugin": require("./game-installers/minecraft-survival-plugin"),
  "pokemon-red-blue": require("./game-installers/pokemon-red-blue"),
  "super-mario-kart": require("./game-installers/super-mario-kart"),
});

function installerForGame(gameId) {
  return GAME_INSTALLERS[gameId] || null;
}

function isIntegratedGame(gameId) {
  return INTEGRATED_GAME_IDS.includes(gameId);
}

module.exports = {
  GAME_INSTALLERS,
  INTEGRATED_GAME_IDS,
  installerForGame,
  isIntegratedGame
};
