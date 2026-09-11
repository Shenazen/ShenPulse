"use strict";

const PRIVATE_RENDERER_CHANNELS = new Set([
  "deal-host-state",
  "game-effect",
  "game-install-progress",
  "game-round-timeout",
  "live-event",
  "overlay-completion-fired",
  "playback",
  "public-overlay-relay-status"
]);
const ADMIN_OWNER_EMAIL = "alexandre.leuridan@gmail.com";

const PREVIEW_OVERLAY_KEYS = new Set([
  "base",
  "coinJar",
  "game",
  "likeGoal",
  "matchCoffre",
  "matchEnigma",
  "matchGants",
  "matchQuiereme",
  "matchSnipe",
  "matchTapTap",
  "matchX2",
  "matchX3",
  "multiplierTimer",
  "myActions",
  "timer",
  "topDonors",
  "topTappers",
  "wheel",
  "winCounter"
]);

function hasAuthenticatedAccount(store) {
  const account = store?.getState?.()?.settings?.account || {};
  const email = String(account.email || "").trim().toLowerCase();
  const uid = String(account.uid || "").trim();
  const secretId = String(account.refreshTokenSecretId || "").trim();
  if (!email || !uid || !secretId) return false;
  if (
    typeof store?.getActiveAccountUid === "function" &&
    store.getActiveAccountUid() !== uid
  ) {
    return false;
  }
  return Boolean(String(store?.getSecret?.(secretId) || "").trim());
}

function assertAuthenticatedAccount(store) {
  if (!hasAuthenticatedAccount(store)) {
    const error = new Error(
      "Connectez-vous à votre compte ShenPulse pour utiliser cette fonction."
    );
    error.code = "ACCOUNT_REQUIRED";
    throw error;
  }
  return true;
}

function assertAdminAccount(store) {
  assertAuthenticatedAccount(store);
  const account = store.getState().settings.account || {};
  if (
    String(account.email || "").trim().toLowerCase() !==
      ADMIN_OWNER_EMAIL ||
    account.emailVerified !== true ||
    !String(account.uid || "").trim()
  ) {
    const error = new Error(
      "Ce compte n’est pas autorisé à administrer ShenPulse."
    );
    error.code = "ADMIN_ACCOUNT_REQUIRED";
    throw error;
  }
  return true;
}

function snapshotForRenderer(snapshot, store) {
  const visibleSnapshot = canUseOwnerOnlyCatalog(store)
    ? snapshot
    : withoutOwnerOnlyPacks(snapshot);
  return hasAuthenticatedAccount(store)
    ? visibleSnapshot
    : createGuestSnapshot(visibleSnapshot);
}

function canUseOwnerOnlyCatalog(store) {
  try {
    return assertAdminAccount(store);
  } catch {
    return false;
  }
}

function withoutOwnerOnlyPacks(snapshot = {}) {
  if (!(snapshot.packs || []).some((pack) => pack?.ownerOnly === true)) {
    return snapshot;
  }
  return {
    ...snapshot,
    packs: snapshot.packs.filter((pack) => pack?.ownerOnly !== true)
  };
}

function createGuestSnapshot(snapshot = {}) {
  const originalState = snapshot.state || {};
  const customSoundIds = new Set(
    (originalState.customSounds || []).flatMap((item) => [
      String(item?.id || ""),
      String(item?.url || "")
    ])
  );
  const customMediaIds = new Set(
    (originalState.customMedia || []).flatMap((item) => [
      String(item?.id || ""),
      String(item?.url || "")
    ])
  );
  const state = redactSensitiveValues(originalState);
  const localOverlayUrls = snapshot.localOverlayUrls || {};
  const previewOverlayUrls = Object.fromEntries(
    Object.entries(localOverlayUrls).filter(
      ([key, value]) =>
        PREVIEW_OVERLAY_KEYS.has(key) &&
        /^https?:\/\/127\.0\.0\.1(?::\d+)?\//i.test(String(value || ""))
    )
  );

  state.activity = [];
  state.connections = [];
  state.customSounds = [];
  state.customMedia = [];
  state.statistics = {
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
  };
  state.session = {
    ...(state.session || {}),
    running: false,
    startedAt: null,
    startedBy: "",
    activeConnectionIds: [],
    game: {
      ...(state.session?.game || {}),
      running: false,
      packId: "",
      startedAt: null,
      roundStartedAt: null,
      roundEndsAt: null,
      roundStatus: "stopped"
    }
  };
  state.settings = {
    ...(state.settings || {}),
    account: emptyAccount(),
    admin: emptyAccount(),
    matchAccess: { accessKey: "" },
    irl: { enabled: false, devices: [] },
    tiktok: {
      username: "",
      relayUrl: "",
      status: "unconfigured",
      roomId: "",
      lastCheckedAt: "",
      lastEventAt: "",
      autoConnect: true
    }
  };
  state.game = {
    ...(state.game || {}),
    connectorOverrides: {},
    installations: {},
    activeEffects: []
  };

  return {
    ...snapshot,
    state,
    soundCatalog: (snapshot.soundCatalog || []).filter(
      (item) =>
        !customSoundIds.has(String(item?.id || "")) &&
        !customSoundIds.has(String(item?.url || ""))
    ),
    mediaCatalog: (snapshot.mediaCatalog || []).filter(
      (item) =>
        !customMediaIds.has(String(item?.id || "")) &&
        !customMediaIds.has(String(item?.url || ""))
    ),
    overlayUrls: {},
    localOverlayUrls: {},
    previewOverlayUrls,
    publicOverlayRelay: {
      connected: false,
      status: "account-required"
    }
  };
}

function redactSensitiveValues(value, key = "", depth = 0) {
  if (depth > 30) return null;
  if (Array.isArray(value)) {
    return value.map((entry) =>
      redactSensitiveValues(entry, "", depth + 1)
    );
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entry]) => [
        entryKey,
        redactSensitiveValues(entry, entryKey, depth + 1)
      ])
    );
  }
  if (typeof value !== "string") return value;
  if (
    /(?:url|uri|token|secret|password|endpoint|callback)$/i.test(key) ||
    /^(?:https?|wss?):\/\//i.test(value.trim())
  ) {
    return "";
  }
  return value;
}

function emptyAccount() {
  return {
    email: "",
    uid: "",
    displayName: "",
    photoUrl: "",
    providerId: "",
    emailVerified: false,
    refreshTokenSecretId: "",
    lastAuthenticatedAt: ""
  };
}

function shouldSuppressRendererChannel(channel, store) {
  return (
    !hasAuthenticatedAccount(store) &&
    PRIVATE_RENDERER_CHANNELS.has(channel)
  );
}

module.exports = {
  ADMIN_OWNER_EMAIL,
  assertAdminAccount,
  assertAuthenticatedAccount,
  createGuestSnapshot,
  hasAuthenticatedAccount,
  shouldSuppressRendererChannel,
  snapshotForRenderer
};
