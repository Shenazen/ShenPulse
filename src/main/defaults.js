"use strict";

/** Façade stable des valeurs initiales ; chaque appel fournit un objet indépendant. */
const { createDefaultOverlayConfigs } = require("./state/defaults/overlays");
const { createDefaultState, createEmptyProfileWorkspace } = require("./state/defaults/state");

module.exports = { createDefaultOverlayConfigs, createDefaultState, createEmptyProfileWorkspace };
