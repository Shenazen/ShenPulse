"use strict";

/** Façade stable des catalogues Minecraft, organisés par mode de jeu. */
const { CATALOG_VERSION, SANDBOX_COLORS, withSortOrder } = require("./game-catalog/minecraft/builders");
const { BEDROCK_EFFECTS } = require("./game-catalog/minecraft/bedrock");
const { SANDBOX_EFFECTS } = require("./game-catalog/minecraft/sandbox");
const { SURVIVAL_EFFECTS } = require("./game-catalog/minecraft/survival");
const { BEDROCK_DEFAULT_MAPPINGS, SANDBOX_DEFAULT_MAPPINGS } = require("./game-catalog/minecraft/mappings");

const MINECRAFT_BEDROCK_EFFECTS = withSortOrder(BEDROCK_EFFECTS);
const MINECRAFT_SANDBOX_EFFECTS = withSortOrder(SANDBOX_EFFECTS);
const MINECRAFT_SURVIVAL_EFFECTS = withSortOrder(SURVIVAL_EFFECTS);

module.exports = {
  MINECRAFT_BEDROCK_DEFAULT_MAPPINGS: Object.freeze(
    BEDROCK_DEFAULT_MAPPINGS
  ),
  MINECRAFT_BEDROCK_EFFECTS,
  MINECRAFT_BEDROCK_INTERACTION_CATALOG_VERSION: CATALOG_VERSION,
  MINECRAFT_SANDBOX_DEFAULT_MAPPINGS: Object.freeze(
    SANDBOX_DEFAULT_MAPPINGS
  ),
  MINECRAFT_SANDBOX_EFFECTS,
  MINECRAFT_SANDBOX_INTERACTION_CATALOG_VERSION: CATALOG_VERSION,
  MINECRAFT_SURVIVAL_DEFAULT_MAPPINGS: Object.freeze([]),
  MINECRAFT_SURVIVAL_EFFECTS,
  MINECRAFT_SURVIVAL_INTERACTION_CATALOG_VERSION: CATALOG_VERSION,
  SANDBOX_COLORS
};
