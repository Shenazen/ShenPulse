"use strict";

const GAME_INTERACTION_ACTION_TYPES = Object.freeze([
  "game.effect",
  "overlay.win-counter",
  "audio.play"
]);

const gameInteractionActionTypeSet = new Set(
  GAME_INTERACTION_ACTION_TYPES
);

function isGameInteractionActionType(value) {
  return gameInteractionActionTypeSet.has(String(value || ""));
}

module.exports = {
  GAME_INTERACTION_ACTION_TYPES,
  isGameInteractionActionType
};
