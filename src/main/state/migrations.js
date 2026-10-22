"use strict";

const { createDefaultState } = require("../defaults");
const { clone } = require("../utils");
const { normalizeIrlSettings } = require("../shelly-service");
const { normalizeMatchAccess } = require("../match-access");
const sceneLayout = require("../../../resources/overlays/scene-layout");
const { normalizeProfileOverlayConfigs } = require("./overlay-configs");
const { makeDemoConnectionsManual, removeLegacyAutomaticDemoActivity } = require("./legacy-demo");
const { normalizeLiveStatistics } = require("../../shared/live-statistics");
const { synchronizeLikeGoalWithLive } = require("../overlay-session-state");
const { normalizeViewerDatabase } = require("../viewers/normalization");
const { migrateVisibility } = require("../../shared/visibility-catalog");
const { normalizeMatchesConfig, createMatchSession } = require("../../shared/matches-contract");
const { normalizeLiveDirectoryPreference } = require("../../shared/live-directory-protocol");

/** Met à niveau le schéma en conservant les configurations et en réinitialisant uniquement le runtime arrêté. */
function migrateState(store) {
  const defaults = createDefaultState();
  store.state.schemaVersion = 2;
  store.state.viewerDatabase = normalizeViewerDatabase(store.state.viewerDatabase);
  store.state.settings = { ...defaults.settings, ...(store.state.settings || {}) };
  store.state.settings.matches = normalizeMatchesConfig(store.state.settings.matches);
  store.state.matchSession = createMatchSession(store.state.matchSession, { disconnected: true });
  store.state.settings.siteVisibility = migrateVisibility(store.state.settings.siteVisibility);
  store.state.settings.liveDirectory = normalizeLiveDirectoryPreference(store.state.settings.liveDirectory);
  store.state.settings.tts = {
    ...defaults.settings.tts,
    ...(store.state.settings.tts || {})
  };
  store.state.settings.obs = {
    ...defaults.settings.obs,
    ...(store.state.settings.obs || {})
  };
  store.state.settings.spotify = {
    ...defaults.settings.spotify,
    ...(store.state.settings.spotify || {})
  };
  store.state.settings.backblaze = {
    ...defaults.settings.backblaze,
    ...(store.state.settings.backblaze || {})
  };
  store.storage.recoverBackblazeSecretReferences(store.state, store.secrets, store.filePath);
  store.state.settings.admin = {
    ...defaults.settings.admin,
    ...(store.state.settings.admin || {})
  };
  store.state.settings.account = {
    ...defaults.settings.account,
    ...(store.state.settings.account || {})
  };
  store.state.settings.publicOverlayRelay = {
    ...defaults.settings.publicOverlayRelay,
    ...(store.state.settings.publicOverlayRelay || {})
  };
  store.state.settings.matchAccess = normalizeMatchAccess(
    store.state.settings.matchAccess
  );
  store.state.settings.tiktok = {
    ...defaults.settings.tiktok,
    ...(store.state.settings.tiktok || {})
  };
  store.state.settings.irl = normalizeIrlSettings(store.state.settings.irl);
  store.state.settings.overlayScene = sceneLayout.normalizeScene(store.state.settings.overlayScene);
  store.state.settings.overlayConfigs = normalizeProfileOverlayConfigs(store.state.settings.overlayConfigs);
  for (const key of [
    "connections",
    "profiles",
    "rules",
    "goals",
    "commands",
    "timers",
    "customSounds",
    "customMedia",
    "activity"
  ]) {
    if (!Array.isArray(store.state[key])) store.state[key] = defaults[key];
  }
  store.state.connections = makeDemoConnectionsManual(store.state.connections);
  const tiktokUsername = String(store.state.settings.tiktok.username || "")
    .trim()
    .replace(/^@+/, "");
  if (tiktokUsername) {
    const tiktokConnection = store.state.connections.find(
      (item) => item.id === "source_tiktok"
    );
    const nextConnection = {
      ...(tiktokConnection || {}),
      id: "source_tiktok",
      name: `TikTok @${tiktokUsername}`,
      type: "tiktok-direct",
      enabled: store.state.settings.tiktok.autoConnect !== false,
      status: "disconnected",
      config: { username: tiktokUsername }
    };
    if (tiktokConnection) {
      Object.assign(tiktokConnection, nextConnection);
    } else {
      store.state.connections.push(nextConnection);
    }
    store.state.settings.tiktok.username = tiktokUsername;
    store.state.settings.tiktok.relayUrl = "";
    store.state.settings.tiktok.status = "disconnected";
    store.state.settings.tiktok.roomId = "";
  } else {
    store.state.settings.tiktok.status = "unconfigured";
  }
  store.state.settings.tiktok.broadcaster = null;
  store.state.settings.tiktok.currentViewers = null;
  store.state.session = { ...defaults.session, ...(store.state.session || {}) };
  store.state.session.game = {
    ...defaults.session.game,
    ...(store.state.session.game || {})
  };
  // Un LIVE ne survit pas au redémarrage : un état persisté ne doit pas afficher un faux direct.
  store.state.session.running = false;
  store.state.session.startedAt = null;
  store.state.session.startedBy = "";
  store.state.session.tiktokRoomId = "";
  store.state.session.tiktokInterruptedAt = null;
  store.state.session.activeConnectionIds = [];
  store.state.session.game = clone(defaults.session.game);
  store.state.statistics = {
    ...defaults.statistics,
    ...(store.state.statistics || {})
  };
  store.state.statistics.sessionEvents = 0;
  store.state.statistics.sessionActions = 0;
  store.state.statistics.sessionLikes = 0;
  store.state.statistics.sessionUniqueViewers = [];
  // Réinitialiser le runtime ancien, mais conserver le bilan réel du dernier LIVE.
  store.state.statistics.liveSession = normalizeLiveStatistics(store.state.statistics.liveSession);
  if (store.state.statistics.liveSession.hasData && !store.state.statistics.liveSession.endedAt) {
    store.state.statistics.liveSession.endedAt = new Date().toISOString();
  }
  store.state.overlaySession = removeLegacyAutomaticDemoActivity(
    store.state.overlaySession
  );
  store.state.overlaySession.active = false;
  synchronizeLikeGoalWithLive(store.state);
  if (store.state.overlaySession.hasData && !store.state.overlaySession.endedAt) {
    store.state.overlaySession.endedAt = new Date().toISOString();
  }
  store.state.game = { ...defaults.game, ...(store.state.game || {}) };
  store.state.commerce = {
    ...defaults.commerce,
    ...(store.state.commerce || {}),
    subscription: {
      ...defaults.commerce.subscription,
      ...(store.state.commerce?.subscription || {})
    },
    premiumSeat: {
      ...defaults.commerce.premiumSeat,
      ...(store.state.commerce?.premiumSeat || {})
    },
    gameEntitlements: Array.isArray(store.state.commerce?.gameEntitlements)
      ? store.state.commerce.gameEntitlements
      : [],
    trial: {
      ...defaults.commerce.trial,
      ...(store.state.commerce?.trial || {}),
      gameIds: Array.isArray(store.state.commerce?.trial?.gameIds)
        ? store.state.commerce.trial.gameIds
        : [],
      grants: Array.isArray(store.state.commerce?.trial?.grants)
        ? store.state.commerce.trial.grants
        : [],
      cachedGrants: Array.isArray(
        store.state.commerce?.trial?.cachedGrants
      )
        ? store.state.commerce.trial.cachedGrants
        : []
    }
  };
  store.state.commerce.premiumSeat.beneficiaryEmail = String(
    store.state.commerce.premiumSeat.beneficiaryEmail || ""
  )
    .trim()
    .toLowerCase();
  store.state.commerce.premiumSeat.beneficiaryEmails = Array.isArray(
    store.state.commerce.premiumSeat.beneficiaryEmails
  )
    ? store.state.commerce.premiumSeat.beneficiaryEmails
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
    : store.state.commerce.premiumSeat.beneficiaryEmail
      ? [store.state.commerce.premiumSeat.beneficiaryEmail]
      : [];
  delete store.state.commerce.premiumSeat.beneficiaryUsername;
  delete store.state.commerce.premiumSeat.beneficiaryUsernames;
  store.workspaces.migrateProfileWorkspaces();
  store.workspaces.migrateAccountWorkspaces();
}


module.exports = { migrateState };
