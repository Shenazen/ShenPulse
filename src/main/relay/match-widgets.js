"use strict";

/** Contrat des widgets HTTPS du canal Match dédié.
 * Les URL locales, les secrets et le canal des autres overlays restent exclus.
 * Ce module ne modifie ni le compte, ni les réglages, ni les compteurs LIVE.
 */
const { hasAuthenticatedAccount } = require("../account-access");
const { PRO_ACCESS_PATHS, proFeatureAllowed } = require("../pro-feature-access");
const { MATCH_OVERLAY_STATE_PATHS, projectMatchesOverlayState } = require("../matches-overlay-state");
const { matchAccountNumber } = require("../match-access");
const { createHash } = require("node:crypto");

const MATCH_WIDGET_URL_KEYS = Object.freeze({
  wins: "matchesWins", starDonor: "matchesStarDonor", topDonor: "matchesTopDonor",
  donors: "matchesDonors", timer: "matchesTimer", victory: "matchesVictory",
  scoreboard: "matchesScoreboard"
});
const MATCH_WIDGET_CONTEXT_PATHS = Object.freeze([...new Set([
  "settings.publicOverlayRelay", "settings.overlayPort", "settings.tiktok.roomId",
  ...PRO_ACCESS_PATHS, ...MATCH_OVERLAY_STATE_PATHS
])]);

function hasPublicMatchWidgetAccess(store, state) {
  return hasAuthenticatedAccount(store) && proFeatureAllowed(state, "matches");
}

function addPublicMatchWidgetUrls(urls, { store, state, includeRestricted = false }) {
  const allowed = includeRestricted || hasPublicMatchWidgetAccess(store, state);
  return { ...urls, ...Object.fromEntries(Object.entries(MATCH_WIDGET_URL_KEYS)
    .map(([widget, key]) => [key, allowed && urls.matchPlayer
      ? `${urls.matchPlayer}?widget=${encodeURIComponent(widget)}` : ""])) };
}

function publicMatchWidgetState(state, allowed) {
  return { matches: allowed ? projectMatchesOverlayState(state) : null };
}

/** Identité de diffusion opaque : permet au lecteur de couper un ancien
 * effet au changement de profil ou de LIVE, sans exposer UID/profil/room. */
function matchPublicContextId(state) {
  return createHash("sha256").update(JSON.stringify([
    state.settings?.account?.uid || "", state.session?.profileId || "", state.settings?.tiktok?.roomId || ""
  ])).digest("hex");
}

function publicMatchSource(state, proAccess, widgetsAccess) {
  const port = Number(state.settings?.overlayPort || 0);
  return { enabled: proAccess, widgetsEnabled: widgetsAccess, localEntryVersion: 1,
    contextId: matchPublicContextId(state),
    accountNumber: matchAccountNumber(state.settings?.account?.uid),
    localPort: Number.isInteger(port) && port >= 1 && port <= 65_535 ? port : 0 };
}

module.exports = { MATCH_WIDGET_CONTEXT_PATHS, hasPublicMatchWidgetAccess, addPublicMatchWidgetUrls, publicMatchWidgetState, publicMatchSource, matchPublicContextId };
