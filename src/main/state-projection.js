"use strict";

const { selectStatePaths, getStateProjection } = require("./state/projections");

/** Lit une projection ; le repli conserve les anciens doubles de test et petits stores. */
function readState(store, paths) {
  return typeof store?.getStateProjection === "function"
    ? store.getStateProjection(paths)
    : getStateProjection(store.getState(), undefined, paths);
}

module.exports = { readState, selectStatePaths };
