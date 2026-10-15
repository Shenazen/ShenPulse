"use strict";
const { normalizeLiveStatistics } = require("../../shared/live-statistics");
const { normalizeViewerDatabase } = require("../viewers/normalization");
const { createMatchSession } = require("../../shared/matches-contract");

const { clone } = require("../utils");
const { createDefaultState } = require("../defaults");
const { normalizeOverlaySession, synchronizeLikeGoalWithLive } = require("../overlay-session-state");
const { ACCOUNT_WORKSPACE_SCHEMA_VERSION, ACCOUNT_SETTING_KEYS } = require("./constants");
const { normalizeProfileWorkspace } = require("./profile-workspace");
const { normalizeGameInteractionRules } = require("./rule-normalization");
const { normalizeObjectMap } = require("./normalization-utils");
const { makeDemoConnectionsManual, removeLegacyAutomaticDemoActivity } = require("./legacy-demo");

/** Valide un identifiant de propriétaire sans imposer un format spécifique à Firebase. */
function cleanAccountUid(value) {
  const uid = String(value || "").trim();
  if (
    !uid ||
    uid.length > 200 ||
    /[\u0000-\u001f\u007f]/.test(uid)
  ) {
    return "";
  }
  return uid;
}

/** Clé persistée stable qui ne peut pas viser une propriété spéciale du prototype. */
function accountWorkspaceKey(uid) {
  const clean = cleanAccountUid(uid);
  return clean
    ? `uid_${Buffer.from(clean, "utf8").toString("base64url")}`
    : "";
}

function accountSettingsFromState(settings = {}) {
  return Object.fromEntries(
    ACCOUNT_SETTING_KEYS.map((key) => [key, clone(settings[key])])
  );
}

/** Capture isolée des seuls réglages et données appartenant au propriétaire. */
function createAccountWorkspaceFromState(state, ownerUid = "") {
  const now = new Date().toISOString();
  return {
    schemaVersion: ACCOUNT_WORKSPACE_SCHEMA_VERSION,
    ownerUid: cleanAccountUid(ownerUid),
    settings: accountSettingsFromState(state.settings || {}),
    connections: clone(state.connections || []),
    profiles: clone(state.profiles || []),
    session: {
      profileId: String(state.session?.profileId || ""),
      activeGamePackId: String(
        state.session?.activeGamePackId || "coin-pusher"
      )
    },
    game: clone(state.game || {}),
    commerce: clone(state.commerce || {}),
    customSounds: clone(state.customSounds || []),
    customMedia: clone(state.customMedia || []),
    activity: clone(state.activity || []),
    overlaySession: clone(state.overlaySession || {}),
    matchSession: clone(state.matchSession || createMatchSession()),
    statistics: clone(state.statistics || {}),
    viewerDatabase: clone(state.viewerDatabase || {}),
    createdAt: String(state.createdAt || now),
    updatedAt: now
  };
}

/** Espace vierge sans héritage des données d'un autre compte. */
function createEmptyAccountWorkspace(ownerUid = "") {
  return createAccountWorkspaceFromState(
    createDefaultState(),
    ownerUid
  );
}

/** Restaure la forme persistée et conserve les droits, achats, médias et profils du propriétaire. */
function normalizeAccountWorkspace(workspace, ownerUid = "") {
  const defaults = createEmptyAccountWorkspace(ownerUid);
  const saved =
    workspace && typeof workspace === "object" ? clone(workspace) : {};
  const settings =
    saved.settings && typeof saved.settings === "object"
      ? saved.settings
      : {};
  const game =
    saved.game && typeof saved.game === "object" ? saved.game : {};
  const commerce =
    saved.commerce && typeof saved.commerce === "object"
      ? saved.commerce
      : {};
  const savedTrial =
    commerce.trial && typeof commerce.trial === "object"
      ? commerce.trial
      : {};
  const savedPremiumSeat =
    commerce.premiumSeat &&
    typeof commerce.premiumSeat === "object"
      ? commerce.premiumSeat
      : {};
  const profiles = Array.isArray(saved.profiles) && saved.profiles.length
    ? saved.profiles
    : defaults.profiles;
  const normalizedTrial = {
    ...clone(defaults.commerce.trial),
    ...clone(savedTrial),
    email: String(savedTrial.email || "").trim().toLowerCase(),
    gameIds: Array.isArray(savedTrial.gameIds)
      ? clone(savedTrial.gameIds)
      : [],
    grants: Array.isArray(savedTrial.grants)
      ? clone(savedTrial.grants)
      : [],
    cachedGrants: Array.isArray(savedTrial.cachedGrants)
      ? clone(savedTrial.cachedGrants)
      : []
  };
  delete normalizedTrial.username;

  return {
    ...defaults,
    ...saved,
    schemaVersion: ACCOUNT_WORKSPACE_SCHEMA_VERSION,
    ownerUid:
      cleanAccountUid(ownerUid) ||
      cleanAccountUid(saved.ownerUid),
    settings: Object.fromEntries(
      ACCOUNT_SETTING_KEYS.map((key) => {
        const defaultValue = defaults.settings[key];
        const savedValue = settings[key];
        if (
          defaultValue &&
          typeof defaultValue === "object" &&
          !Array.isArray(defaultValue)
        ) {
          return [
            key,
            {
              ...clone(defaultValue),
              ...(savedValue &&
              typeof savedValue === "object" &&
              !Array.isArray(savedValue)
                ? clone(savedValue)
                : {})
            }
          ];
        }
        return [
          key,
          savedValue === undefined
            ? clone(defaultValue)
            : clone(savedValue)
        ];
      })
    ),
    connections: makeDemoConnectionsManual(
      Array.isArray(saved.connections)
        ? clone(saved.connections)
        : clone(defaults.connections)
    ),
    profiles: profiles.map((profile, index) => {
      const profileWorkspace = normalizeProfileWorkspace(
        profile?.workspace,
        { ttsFallback: settings.tts, songRequestSettingsFallback: settings.spotify?.songRequests }
      );
      return {
        ...clone(profile),
        id:
          String(profile?.id || "").trim() ||
          `profile_${index + 1}`,
        name:
          String(profile?.name || "").trim() ||
          `Profil ${index + 1}`,
        workspace: profileWorkspace,
        enabledRuleIds: profileWorkspace.rules.map(
          (rule) => rule.id
        )
      };
    }),
    session: {
      profileId: String(
        saved.session?.profileId ||
        profiles[0]?.id ||
        "profile_starter"
      ),
      activeGamePackId:
        String(
          saved.session?.activeGamePackId ||
          game.activeGamePackId ||
          "coin-pusher"
        ).trim() || "coin-pusher"
    },
    game: {
      ...clone(defaults.game),
      ...clone(game),
      connectorOverrides: normalizeObjectMap(
        game.connectorOverrides
      ),
      interactionCatalogVersions: normalizeObjectMap(
        game.interactionCatalogVersions
      ),
      interactionRulesByPack: normalizeGameInteractionRules(
        game.interactionRulesByPack
      ),
      roundSettingsByPack: normalizeObjectMap(
        game.roundSettingsByPack
      ),
      installations: normalizeObjectMap(game.installations),
      activeEffects: [],
      recentPacks: Array.isArray(game.recentPacks)
        ? clone(game.recentPacks)
        : clone(defaults.game.recentPacks)
    },
    commerce: {
      ...clone(defaults.commerce),
      ...clone(commerce),
      subscription: {
        ...clone(defaults.commerce.subscription),
        ...(commerce.subscription || {})
      },
      premiumSeat: {
        ...clone(defaults.commerce.premiumSeat),
        ...clone(savedPremiumSeat)
      },
      gameEntitlements: Array.isArray(commerce.gameEntitlements)
        ? clone(commerce.gameEntitlements)
        : [],
      trial: normalizedTrial
    },
    customSounds: Array.isArray(saved.customSounds)
      ? clone(saved.customSounds)
      : [],
    customMedia: Array.isArray(saved.customMedia)
      ? clone(saved.customMedia)
      : [],
    activity: Array.isArray(saved.activity)
      ? clone(saved.activity)
      : [],
    overlaySession: removeLegacyAutomaticDemoActivity(saved.overlaySession),
    statistics: {
      ...clone(defaults.statistics),
      ...(saved.statistics || {})
    },
    viewerDatabase: normalizeViewerDatabase(saved.viewerDatabase),
    createdAt: String(saved.createdAt || defaults.createdAt),
    updatedAt: String(saved.updatedAt || new Date().toISOString())
  };
}

/** Remplace la configuration active, puis réinitialise connexions et compteurs de session. */
function applyAccountWorkspace(state, workspace) {
  const normalized = normalizeAccountWorkspace(
    workspace,
    workspace?.ownerUid
  );
  for (const key of ACCOUNT_SETTING_KEYS) {
    state.settings[key] = clone(normalized.settings[key]);
  }

  state.connections = normalized.connections.map((connection) => ({
    ...clone(connection),
    status: "disconnected",
    liveStatus:
      connection.type === "tiktok-direct"
        ? "disconnected"
        : connection.liveStatus,
    roomId: "",
    error: ""
  }));
  state.profiles = clone(normalized.profiles);
  state.session = {
    ...createDefaultState().session,
    profileId: state.profiles.some(
      (profile) =>
        profile.id === normalized.session.profileId
    )
      ? normalized.session.profileId
      : state.profiles[0].id,
    activeGamePackId:
      normalized.session.activeGamePackId || "coin-pusher"
  };
  state.game = {
    ...clone(normalized.game),
    activeEffects: []
  };
  state.commerce = clone(normalized.commerce);
  state.customSounds = clone(normalized.customSounds);
  state.customMedia = clone(normalized.customMedia);
  state.activity = clone(normalized.activity);
  state.matchSession = createMatchSession(normalized.matchSession, { disconnected: true });
  state.overlaySession = normalizeOverlaySession(
    normalized.overlaySession
  );
  state.overlaySession.active = false;
  if (
    state.overlaySession.hasData &&
    !state.overlaySession.endedAt
  ) {
    state.overlaySession.endedAt = new Date().toISOString();
  }
  state.statistics = {
    ...clone(normalized.statistics),
    sessionEvents: 0,
    sessionActions: 0,
    sessionLikes: 0,
    sessionUniqueViewers: []
  };
  state.viewerDatabase = normalized.viewerDatabase;
  state.statistics.liveSession = normalizeLiveStatistics(normalized.statistics.liveSession);
  synchronizeLikeGoalWithLive(state);
  if (state.statistics.liveSession.hasData && !state.statistics.liveSession.endedAt) {
    state.statistics.liveSession.endedAt = new Date().toISOString();
  }
  state.settings.tiktok.status = state.settings.tiktok.username
    ? "disconnected"
    : "unconfigured";
  state.settings.tiktok.roomId = "";
  state.settings.tiktok.broadcaster = null;
  state.settings.tiktok.currentViewers = null;
}

module.exports = { cleanAccountUid, accountWorkspaceKey, createAccountWorkspaceFromState, createEmptyAccountWorkspace, normalizeAccountWorkspace, applyAccountWorkspace };
