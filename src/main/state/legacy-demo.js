"use strict";

const { normalizeOverlaySession } = require("../overlay-session-state");
const { LEGACY_AUTOMATIC_DEMO_VIEWER_IDS } = require("./constants");

/** Désactive seulement le démarrage automatique des sources de démonstration héritées. */
function makeDemoConnectionsManual(connections) {
  if (!Array.isArray(connections)) return [];
  return connections.map((connection) =>
    connection?.type === "demo"
      ? {
          ...connection,
          enabled: false,
          status: "disconnected",
          error: ""
        }
      : connection
  );
}

/** Nettoie les participants fictifs connus sans retirer l'activité de l'audience réelle. */
function removeLegacyAutomaticDemoActivity(value) {
  const runtime = normalizeOverlaySession(value);
  const demoEvent = (event) =>
    event?.source === "source_demo" ||
    LEGACY_AUTOMATIC_DEMO_VIEWER_IDS.has(String(event?.user?.id || ""));
  const demoLeaderboardEntry = (entry) =>
    LEGACY_AUTOMATIC_DEMO_VIEWER_IDS.has(String(entry?.id || ""));
  const removedRecentEvents = runtime.recentEvents.filter(demoEvent);
  const removedDonors = runtime.leaderboards.donors.filter(
    demoLeaderboardEntry
  );
  const removedTappers = runtime.leaderboards.tappers.filter(
    demoLeaderboardEntry
  );

  if (
    !removedRecentEvents.length &&
    !removedDonors.length &&
    !removedTappers.length
  ) {
    return runtime;
  }

  runtime.recentEvents = runtime.recentEvents.filter(
    (event) => !demoEvent(event)
  );
  runtime.leaderboards.donors = runtime.leaderboards.donors.filter(
    (entry) => !demoLeaderboardEntry(entry)
  );
  runtime.leaderboards.tappers = runtime.leaderboards.tappers.filter(
    (entry) => !demoLeaderboardEntry(entry)
  );
  runtime.coinJarCurrent = Math.max(
    0,
    runtime.coinJarCurrent -
      removedDonors.reduce((total, entry) => total + entry.score, 0)
  );
  runtime.likeGoalCurrent = Math.max(
    0,
    runtime.likeGoalCurrent -
      removedTappers.reduce((total, entry) => total + entry.score, 0)
  );

  const hasRealAudienceActivity =
    runtime.recentEvents.length > 0 ||
    runtime.leaderboards.donors.length > 0 ||
    runtime.leaderboards.tappers.length > 0;
  if (!hasRealAudienceActivity) runtime.winCounterCurrent = 0;
  return runtime;
}

module.exports = { makeDemoConnectionsManual, removeLegacyAutomaticDemoActivity };
