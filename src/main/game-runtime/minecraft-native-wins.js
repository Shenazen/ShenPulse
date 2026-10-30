"use strict";
/** Trusted console endpoints; never accept a command name from a saved interaction. */
const NATIVE_WIN_COMMANDS = Object.freeze({
  "minecraft-lavarise": "shenpulse_lava",
  "minecraft-diamond-rush": "shenpulse_dr",
  "minecraft-box-cyber": "shenpulse_box"
});
function nativeMinecraftWinCommand(gameId) { return NATIVE_WIN_COMMANDS[gameId] || ""; }
module.exports = { nativeMinecraftWinCommand };
