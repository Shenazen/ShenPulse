"use strict";

/** Patch rapide envoyé au renderer authentifié.
 * Conserve le match courant, sans charger catalogues ni autres profils.
 * Ne pas retirer matchSession : les scores attendraient le prochain snapshot
 * structurel même quand le connecteur et le relais sont déjà à jour.
 */
const { getRuntimeState } = require("../state/projections");

function createCoreRuntimeSnapshot(store, timerScheduler) {
  const state = store.getRuntimeState?.() || getRuntimeState(store.state || store.getState());
  return { state: {
    activity: state.activity, statistics: state.statistics, session: state.session,
    matchSession: state.matchSession, overlaySession: state.overlaySession,
    settings: { tiktok: state.settings.tiktok }
  }, timerRuntime: timerScheduler.runtime() };
}

module.exports = { createCoreRuntimeSnapshot };
