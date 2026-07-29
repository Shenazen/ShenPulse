"use strict";

const crypto = require("node:crypto");
const {
  createDefaultOverlaySession
} = require("./overlay-session-state");

function createDefaultWheelSettings(overrides = {}) {
  return {
    font: "Inter",
    fontSize: 19,
    textOrientation: "radial",
    textColor: "#ffffff",
    textShadowColor: "#000000",
    textShadowStrength: 7,
    textRadius: 34,
    textSegmentOffset: 0,
    textBoxWidth: 112,
    textBoxHeight: 42,
    textAngleOffset: 0,
    textAlign: "center",
    textClamp: true,
    textMaxLines: 2,
    lineSpacing: 1,
    letterSpacing: 0,
    showBase: true,
    soundActive: true,
    announceDuration: 0,
    spinDuration: 6,
    waitDuration: 1,
    scale: 100,
    glow: 72,
    showWinner: true,
    pointerPosition: "top",
    alwaysVisible: true,
    entranceAnimation: "zoom",
    exitAnimation: "fade",
    resultDuration: 4,
    ...overrides
  };
}

function createWheelSegment(label, color, action = "none", actionId = "") {
  const signature = crypto
    .createHash("sha1")
    .update(`${label}|${color}|${action}|${actionId}`)
    .digest("hex")
    .slice(0, 12);
  return { id: `segment_${signature}`, label, color, action, actionId };
}

function createDefaultWheels() {
  return [
    {
      id: "wheel_classic",
      name: "Roue Orange Classique - Actions LIVE",
      enabled: true,
      trigger: "",
      design: "classic",
      settings: createDefaultWheelSettings(),
      segments: [
        createWheelSegment("10 pompes", "#ff6a00"),
        createWheelSegment("Choisis un défi", "#111111"),
        createWheelSegment("x2 pendant 1 min", "#f59f00"),
        createWheelSegment("Question chat", "#2a1207"),
        createWheelSegment("Danse 15 sec", "#ff8a1f"),
        createWheelSegment("Rien du tout", "#1e1e1e"),
        createWheelSegment("Action mystère", "#ffb04a"),
        createWheelSegment("Relance", "#371707", "spin")
      ]
    },
    {
      id: "wheel_royal",
      name: "Roue Royale Prestige - Défis Sport",
      enabled: false,
      trigger: "",
      design: "royal",
      settings: createDefaultWheelSettings({
        font: "Georgia",
        fontSize: 17,
        textColor: "#fff5cb",
        glow: 100,
        spinDuration: 7
      }),
      segments: [
        createWheelSegment("15s pompes", "#7b1fa2"),
        createWheelSegment("4x gainage", "#f59f00"),
        createWheelSegment("Rien", "#2f8f00"),
        createWheelSegment("3x abdos", "#0067b8"),
        createWheelSegment("10x pompes", "#c51f12"),
        createWheelSegment("1x relance", "#9b168d", "spin"),
        createWheelSegment("20x abdos", "#008d8f"),
        createWheelSegment("5x gainage", "#d77a00"),
        createWheelSegment("15s pompes", "#005fae"),
        createWheelSegment("1x abdo", "#2e8b00"),
        createWheelSegment("20x pompes", "#d52a16"),
        createWheelSegment("5x abdos", "#0094a3")
      ]
    }
  ];
}

function createDefaultOverlayConfigs() {
  const positioned = {
    enabled: true,
    scale: 100,
    xOffset: 0,
    yOffset: 0,
    accentColor: "#22d3ee",
    textColor: "#ffffff",
    showWhenIdle: true
  };
  const themed = { ...positioned, theme: "classic", showHeader: true };
  const match = {
    ...positioned,
    scale: 100,
    variant: "tikcontrol",
    fit: "contain",
    autoplay: true,
    loop: true
  };
  const wheels = createDefaultWheels();
  return {
    wheel: {
      ...positioned,
      schemaVersion: 11,
      selectedWheelId: wheels[0].id,
      wheels,
      design: "classic",
      title: "ROUE DES ACTIONS",
      choices: wheels[0].segments.map((segment) => segment.label),
      colors: wheels[0].segments.map((segment) => segment.color),
      ...createDefaultWheelSettings()
    },
    myActions: {
      ...positioned,
      title: "MY ACTIONS",
      maxRows: 5,
      showHeader: true
    },
    topDonors: {
      ...themed,
      title: "CLASSEMENT DONATEURS",
      maxRows: 5,
      showRank: true
    },
    topTappers: {
      ...themed,
      title: "CLASSEMENT TAPOTEURS",
      maxRows: 5,
      showRank: true
    },
    likeGoal: {
      ...themed,
      schemaVersion: 2,
      title: "LIKE GOAL",
      current: 0,
      target: 50000,
      whenReached: "increase",
      completionActionId: "",
      showPercent: true,
      scale: 100
    },
    coinJar: {
      ...positioned,
      model: "fantasy",
      title: "COIN JAR",
      current: 0,
      target: 1000,
      minCoins: 0,
      showGoal: true
    },
    timer: {
      ...themed,
      theme: "gta",
      title: "TEMPS RESTANT",
      seconds: 300,
      completionActionId: "",
      showHours: true,
      showGoal: true
    },
    multiplierTimer: {
      ...themed,
      theme: "gta",
      title: "BONUS ACTIF",
      seconds: 120,
      multiplier: 2,
      showHours: false,
      showGoal: true
    },
    winCounter: {
      ...themed,
      theme: "gta",
      title: "WIN",
      current: 0,
      target: 20,
      showGoal: false,
      allowNegative: true
    },
    matchX2: { ...match },
    matchX3: { ...match },
    matchGants: { ...match },
    matchCoffre: { ...match },
    matchSnipe: { ...match },
    matchTapTap: { ...match },
    matchQuiereme: { ...match },
    matchEnigma: { ...match, variant: "tikcontrol" }
  };
}

function createEmptyProfileWorkspace() {
  return {
    schemaVersion: 1,
    rules: [],
    goals: [],
    commands: [],
    timers: [],
    overlayConfigs: createDefaultOverlayConfigs(),
    game: {
      connectorOverrides: {},
      interactionCatalogVersions: {},
      interactionRulesByPack: {},
      activeGamePackId: "coin-pusher"
    }
  };
}

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
      publicOverlayRelay: {
        enabled: true,
        publicBaseUrl: "https://shenpulse-overlays.web.app",
        databaseUrl:
          "https://shenazenoverlay-default-rtdb.firebaseio.com",
        apiKey: "AIzaSyDHcC8ngIhy2Av8N7J-XdCQq9G8KimGGJk",
        channelId: "",
        email: "",
        uid: "",
        passwordSecretId: "",
        refreshTokenSecretId: ""
      },
      minimizeToTray: true,
      launchAtStartup: false,
      allowKeystrokes: false,
      telemetry: false,
      tts: {
        enabled: true,
        language: "fr-FR",
        voice: "",
        rate: 1,
        pitch: 1,
        volume: 0.9,
        profanityFilter: true
      },
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
        schemaVersion: 7,
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
        lastCheckedAt: "",
        lastEventAt: "",
        autoConnect: true
      },
      overlayConfigs: createDefaultOverlayConfigs()
    },
    session: {
      running: false,
      startedAt: null,
      startedBy: "",
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
        name: "Mode Démo",
        type: "demo",
        enabled: true,
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
        renewalDate: ""
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
    overlaySession: createDefaultOverlaySession(),
    statistics: {
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

module.exports = {
  createDefaultOverlayConfigs,
  createDefaultState,
  createEmptyProfileWorkspace
};
