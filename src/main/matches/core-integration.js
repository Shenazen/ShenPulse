"use strict";

/** Fabrique Matchs : les dépendances publiques restent explicites, les
 * callbacks privés du noyau sont injectés sans accès à ses champs privés.
 */
const { MatchesService } = require("./service");
function createCoreMatches(core, onActivity, onChanged) {
  return new MatchesService({ store: core.store, actionRunner: core.actionRunner,
    overlayServer: core.overlayServer, onActivity, onChanged });
}
module.exports = { createCoreMatches };
