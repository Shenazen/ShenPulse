"use strict";

const crypto = require("node:crypto");
const sceneLayout = require("../../../../resources/overlays/scene-layout");
const { normalizeMatchAccess } = require("../../match-access");
const { createDefaultOverlaySession } = require("../../overlay-session-state");
const { createLiveStatistics } = require("../../../shared/live-statistics");
const { createViewerDatabase } = require("../../viewers/normalization");
const { createDefaultOverlayConfigs } = require("./overlays");
const { normalizeMatchesConfig, createMatchSession } = require("../../../shared/matches-contract");
const { createDefaultTtsSettings } = require("./preferences");
const { normalizeSongRequestSettings } = require("../../spotify/song-request-settings");

/** Configuration de profil vierge, sans actions ni droits de compte. */
function createEmptyProfileWorkspace() {
  return {
    schemaVersion: 2,
    rules: [],
    goals: [],
    commands: [],
    timers: [],
    tts: createDefaultTtsSettings(),
    songRequestSettings: normalizeSongRequestSettings(),
    matches: normalizeMatchesConfig(),
    matchSession: createMatchSession(),
    overlayConfigs: createDefaultOverlayConfigs(),
    overlayScene: sceneLayout.createDefaultScene(),
    game: {
      connectorOverrides: {},
      interactionCatalogVersions: {},
      interactionRulesByPack: {},
      activeGamePackId: "coin-pusher"
    }
  };
}

/** Nouvel état complet ; dates et jetons locaux sont créés à chaque appel. */
function createDefaultState() {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    settings: {
      locale: "fr-FR",
      theme: "dark",
      overlayPort: 17654,
      apiPort: 21213,
      overlayToken: crypto.randomBytes(18).toString("base64url"),
      apiToken: crypto.randomBytes(24).toString("base64url"),
      historyLimit: 2000,
      startOverlayServer: true,
      matchAccess: normalizeMatchAccess(),
      matches: normalizeMatchesConfig(),
      publicOverlayRelay: {
        enabled: true,
        publicBaseUrl: "https://shenpulse-overlays.web.app",
        databaseUrl:
          "https://shenazenoverlay-default-rtdb.firebaseio.com",
        apiKey: "AIzaSyDHcC8ngIhy2Av8N7J-XdCQq9G8KimGGJk",
        channelId: "",
        matchChannelId: "",
        email: "",
        uid: "",
        passwordSecretId: "",
        refreshTokenSecretId: ""
      },
      minimizeToTray: true,
      launchAtStartup: false,
      allowKeystrokes: false,
      telemetry: false,
      liveDirectory: { publishEnabled: false },
      irl: {
        enabled: false,
        devices: []
      },
      tts: createDefaultTtsSettings(),
      obs: {
        url: "ws://127.0.0.1:4455",
        passwordSecretId: ""
      },
      spotify: {
        clientId: "",
        redirectPort: 21215,
        accessTokenSecretId: "",
        refreshTokenSecretId: "",
        expiresAt: 0,
        account: null
      },
      backblaze: {
        bucket: "shenpulse-media",
        endpoint: "s3.eu-central-003.backblazeb2.com",
        region: "eu-central-003",
        prefix: "mediauploads",
        publicBaseUrl:
          "https://f003.backblazeb2.com/file/shenpulse-media",
        maxBytes: 209715200,
        keyIdSecretId: "",
        applicationKeySecretId: ""
      },
      admin: {
        email: "",
        emailVerified: false,
        uid: "",
        refreshTokenSecretId: "",
        lastAuthenticatedAt: ""
      },
      account: {
        email: "",
        uid: "",
        displayName: "",
        photoUrl: "",
        providerId: "",
        emailVerified: false,
        refreshTokenSecretId: "",
        lastAuthenticatedAt: ""
      },
      siteVisibility: {
        schemaVersion: 9,
        navigation: {},
        features: {},
        actionTypes: {},
        overlays: {},
        games: {}
      },
      tiktok: {
        username: "",
        relayUrl: "",
        status: "unconfigured",
        roomId: "",
        broadcaster: null,
        currentViewers: null,
        lastCheckedAt: "",
        lastEventAt: "",
        autoConnect: true
      },
      kick: { clientId: "", clientSecretId: "", refreshTokenSecretId: "", port: 21218, webhookUrl: "" },
      controllers: { port: 21217, devices: [], mappings: [] },
      overlayScene: sceneLayout.createDefaultScene(),
      overlayConfigs: createDefaultOverlayConfigs()
    },
    session: {
      running: false,
      startedAt: null,
      startedBy: "",
      tiktokRoomId: "",
      tiktokInterruptedAt: null,
      profileId: "profile_starter",
      activeGamePackId: "coin-pusher",
      game: {
        running: false,
        packId: "",
        profileId: "",
        startedAt: null,
        roundId: "",
        roundStartedAt: null,
        roundEndsAt: null,
        roundDurationSeconds: 0,
        roundAutoRestart: false,
        roundStatus: "stopped",
        roundTimeoutCount: 0,
        lastRoundTimeoutAt: null
      },
      activeConnectionIds: []
    },
    connections: [
      {
        id: "source_demo",
        name: "Mode Démo (manuel)",
        type: "demo",
        enabled: false,
        status: "disconnected",
        config: { intervalMs: 5000 }
      }
    ],
    profiles: [
      {
        id: "profile_starter",
        name: "Démarrage",
        description: "Profil vierge prêt à être configuré.",
        enabledRuleIds: [],
        workspace: createEmptyProfileWorkspace(),
        createdAt: now,
        updatedAt: now
      }
    ],
    rules: [],
    goals: [],
    commands: [],
    timers: [],
    game: {
      connectorOverrides: {},
      interactionCatalogVersions: {},
      interactionRulesByPack: {},
      roundSettingsByPack: {},
      installations: {},
      activeEffects: [],
      recentPacks: ["coin-pusher", "connect-four"]
    },
    commerce: {
      subscription: {
        tier: "free",
        source: "free",
        status: "free",
        priceMonthly: 0,
        renewalDate: "",
        pendingChange: null
      },
      premiumSeat: {
        beneficiaryEmail: "",
        beneficiaryEmails: [],
        grantedAt: "",
        source: "premium",
        status: "inactive",
        tier: "pro",
        updatedAt: ""
      },
      gameEntitlements: [],
      trial: {
        email: "",
        active: false,
        subscription: false,
        subscriptionExpiresAtMs: 0,
        gameIds: [],
        grants: [],
        cachedGrants: [],
        syncedAt: ""
      }
    },
    customSounds: [],
    customMedia: [],
    activity: [],
    viewerDatabase: createViewerDatabase(),
    overlaySession: createDefaultOverlaySession(),
    matchSession: createMatchSession(),
    statistics: {
      liveSession: createLiveStatistics(),
      sessionEvents: 0,
      sessionActions: 0,
      sessionLikes: 0,
      sessionUniqueViewers: [],
      lifetimeEvents: 0,
      lifetimeActions: 0,
      gifts: 0,
      likes: 0,
      follows: 0,
      subscribers: 0,
      uniqueViewers: []
    },
    createdAt: now,
    updatedAt: now
  };
}

module.exports = { createDefaultState, createEmptyProfileWorkspace };
