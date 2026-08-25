"use strict";

/**
 * Aperçu navigateur de ShenPulse pour Codex.
 *
 * Electron expose normalement `window.shenPulse` via son preload. Le navigateur
 * intégré ne charge pas ce preload : ce serveur fournit donc un pont minimal et
 * isolé. L'authentification e-mail est réelle (Firebase), mais la session reste
 * volontairement en mémoire et aucun mot de passe ni jeton n'est écrit sur disque.
 */

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { createDefaultState } = require("../src/main/defaults");
const {
  GiftCatalog,
  SOUND_CATALOG,
  createMediaCatalog,
  searchMyInstantsSounds,
  searchWikimediaMedia
} = require("../src/main/catalogs");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { normalizeEvent } = require("../src/main/event-normalizer");
const overlayCatalog = require("../resources/overlays/overlay-catalog");
const pkg = require("../package.json");

const HOST = "127.0.0.1";
const PORT = Number(process.env.SHENPULSE_CODEX_PREVIEW_PORT) || 41738;
const FIREBASE_API_KEY = "AIzaSyDHcC8ngIhy2Av8N7J-XdCQq9G8KimGGJk";
const IDENTITY_BASE_URL = "https://identitytoolkit.googleapis.com/v1";
const MAX_BODY_BYTES = 64 * 1024;

const root = path.resolve(__dirname, "..");
const resourcesDirectory = path.join(root, "resources");
const previewBase = `http://${HOST}:${PORT}`;
const giftCatalog = new GiftCatalog(resourcesDirectory);
const gamePacks = loadShenazenGameCatalog(resourcesDirectory);
const includedMediaCatalog = createMediaCatalog(resourcesDirectory);
const defaultPreviewState = createDefaultState();
defaultPreviewState.settings.overlayToken = "codex-preview";
defaultPreviewState.settings.apiToken = "codex-preview";
defaultPreviewState.settings.publicOverlayRelay = {
  enabled: false,
  publicBaseUrl: "",
  databaseUrl: "",
  apiKey: "",
  channelId: "",
  email: "",
  uid: "",
  passwordSecretId: "",
  refreshTokenSecretId: ""
};

let accountStatus = signedOutAccount();
let selectedGameId = "";
const previewSettingsByUid = new Map();

function signedOutAccount() {
  return {
    authenticated: false,
    email: "",
    uid: "",
    displayName: "",
    photoUrl: "",
    providerId: "",
    emailVerified: false,
    lastAuthenticatedAt: "",
    offline: false
  };
}

function accountSettings(status = accountStatus) {
  return {
    email: status.authenticated ? status.email : "",
    uid: status.authenticated ? status.uid : "",
    displayName: status.authenticated ? status.displayName : "",
    photoUrl: status.authenticated ? status.photoUrl : "",
    providerId: status.authenticated ? status.providerId : "",
    emailVerified: status.authenticated && status.emailVerified === true,
    refreshTokenSecretId: "",
    lastAuthenticatedAt: status.authenticated
      ? status.lastAuthenticatedAt
      : ""
  };
}

function snapshot() {
  const currentState = accountStatus.authenticated
    ? loadPersistedAccountState(accountStatus.uid)
    : structuredClone(defaultPreviewState);
  const previewSettings = accountStatus.authenticated
    ? previewSettingsByUid.get(accountStatus.uid)
    : null;
  if (previewSettings) {
    currentState.settings = {
      ...currentState.settings,
      ...structuredClone(previewSettings)
    };
  }
  currentState.settings.account = accountSettings();
  if (
    selectedGameId &&
    gamePacks.some((pack) => pack.id === selectedGameId)
  ) {
    currentState.session.activeGamePackId = selectedGameId;
  }
  const customSounds = Array.isArray(currentState.customSounds)
    ? currentState.customSounds
    : [];
  const customMedia = Array.isArray(currentState.customMedia)
    ? currentState.customMedia
    : [];
  const previewOverlayUrls = overlayCatalog.buildUrls({
    baseUrl: previewBase,
    credentialName: "token",
    credentialValue: "codex-preview",
    proAccess: true,
    includeRestricted: true
  });
  const runtime = accountStatus.authenticated
    ? loadLocalRuntime(accountStatus.uid)
    : null;
  const localOverlayUrls = runtime?.overlayPort && runtime.overlayToken
    ? overlayCatalog.buildUrls({
        baseUrl: `http://127.0.0.1:${runtime.overlayPort}`,
        credentialName: "token",
        credentialValue: runtime.overlayToken,
        proAccess: hasProAccess(currentState),
        includeRestricted: true
      })
    : previewOverlayUrls;
  return {
    appVersion: pkg.version,
    state: currentState,
    packs: structuredClone(gamePacks),
    soundCatalog: [...structuredClone(SOUND_CATALOG), ...customSounds],
    mediaCatalog: [...structuredClone(includedMediaCatalog), ...customMedia],
    catalogCounts: {
      sounds: SOUND_CATALOG.length + customSounds.length,
      media: includedMediaCatalog.length + customMedia.length,
      gifts: giftCatalog.gifts.length
    },
    timerRuntime: {},
    overlayUrls: {
      ...localOverlayUrls,
      api: runtime?.apiPort && runtime.apiToken
        ? `ws://127.0.0.1:${runtime.apiPort}/?token=${encodeURIComponent(runtime.apiToken)}`
        : "",
      compatibilityApi: runtime?.apiPort
        ? `ws://127.0.0.1:${runtime.apiPort}/`
        : ""
    },
    localOverlayUrls,
    previewOverlayUrls,
    publicOverlayRelay: { connected: false, enabled: false }
  };
}

function savePreviewSettings(settings, uid = accountStatus.uid) {
  const ownerUid = String(uid || "").trim();
  if (!accountStatus.authenticated || ownerUid !== accountStatus.uid) {
    throw clientError(
      "ACCOUNT_REQUIRED",
      "Connectez d'abord votre compte ShenPulse."
    );
  }
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw clientError("INVALID_SETTINGS", "Les réglages envoyés sont invalides.");
  }
  const sanitized = structuredClone(settings);
  sanitized.overlayToken = "codex-preview";
  sanitized.apiToken = "codex-preview";
  sanitized.account = accountSettings();
  sanitized.publicOverlayRelay = {
    ...(sanitized.publicOverlayRelay || {}),
    enabled: false,
    passwordSecretId: "",
    refreshTokenSecretId: ""
  };
  previewSettingsByUid.set(ownerUid, sanitized);
  return snapshot();
}

function hasProAccess(currentState) {
  const subscription = currentState?.commerce?.subscription || {};
  if (!["pro", "premium"].includes(subscription.tier)) return false;
  if (
    subscription.source === "trial" ||
    subscription.status === "trial"
  ) {
    const expiresAt = Number(subscription.expiresAtMs) ||
      Date.parse(String(subscription.expiresAt || ""));
    return (
      ["active", "trial"].includes(subscription.status) &&
      Number.isFinite(expiresAt) &&
      expiresAt > Date.now()
    );
  }
  return ["active", "paid"].includes(subscription.status);
}

/**
 * Recharge uniquement l'espace actif qui appartient à l'UID authentifié.
 * Les espaces des autres comptes et les références internes sont retirés avant
 * d'envoyer l'état au navigateur. Le fichier de secrets n'est jamais ouvert.
 */
function loadPersistedAccountState(
  uid,
  stateFile = defaultStateFile()
) {
  const stored = readStoredAccount(uid, stateFile);
  if (!stored) return structuredClone(defaultPreviewState);
  try {
    delete stored.accountWorkspaces;
    delete stored.accountWorkspaceSchemaVersion;
    delete stored.unclaimedAccountWorkspace;
    delete stored.activeAccountUid;
    stored.settings ||= {};

    // Les jetons de l'application Electron ne sont pas nécessaires à l'aperçu.
    stored.settings.overlayToken = "codex-preview";
    stored.settings.apiToken = "codex-preview";
    stored.settings.publicOverlayRelay = {
      ...(stored.settings.publicOverlayRelay || {}),
      enabled: false,
      passwordSecretId: "",
      refreshTokenSecretId: ""
    };

    stored.connections = Array.isArray(stored.connections)
      ? stored.connections.map((connection) => {
          const sanitized = { ...connection };
          sanitized.hasSecret = Boolean(sanitized.secretId);
          sanitized.status = "disconnected";
          sanitized.liveStatus = "disconnected";
          sanitized.roomId = "";
          sanitized.error = "";
          delete sanitized.secret;
          return sanitized;
        })
      : [];
    if (stored.session && typeof stored.session === "object") {
      stored.session.live = false;
    }
    if (stored.game && typeof stored.game === "object") {
      stored.game.activeEffects = [];
    }
    return stored;
  } catch {
    return structuredClone(defaultPreviewState);
  }
}

function defaultStateFile() {
  return path.join(
    process.env.SHENPULSE_USER_DATA_DIR ||
      path.join(process.env.APPDATA || "", "shenpulse"),
    "shenpulse-state.json"
  );
}

function readStoredAccount(uid, stateFile = defaultStateFile()) {
  const targetUid = String(uid || "").trim();
  if (!targetUid || !stateFile || !fs.existsSync(stateFile)) return null;
  try {
    const stored = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    const activeUid = String(stored.activeAccountUid || "").trim();
    const sessionUid = String(stored.settings?.account?.uid || "").trim();
    return activeUid === targetUid && sessionUid === targetUid
      ? stored
      : null;
  } catch {
    return null;
  }
}

function loadLocalRuntime(uid, stateFile = defaultStateFile()) {
  const stored = readStoredAccount(uid, stateFile);
  if (!stored) return null;
  const settings = stored.settings || {};
  return {
    apiPort: Math.max(0, Number(settings.apiPort) || 0),
    apiToken: String(settings.apiToken || ""),
    overlayPort: Math.max(0, Number(settings.overlayPort) || 0),
    overlayToken: String(settings.overlayToken || "")
  };
}

function createRawTestEvent(type = "gift", overrides = {}) {
  const eventType = String(type || "gift").trim().toLowerCase();
  const currentState = accountStatus.authenticated
    ? loadPersistedAccountState(accountStatus.uid)
    : defaultPreviewState;
  const viewer = String(
    overrides.username || overrides.uniqueId || "test_viewer"
  ).replace(/^@+/, "") || "test_viewer";
  const nickname = String(
    overrides.nickname || overrides.displayName || "Spectateur test"
  );
  const count = Math.max(
    1,
    Number(
      overrides.count ??
        (eventType === "like" ? 25 : eventType === "gift" ? 5 : 1)
    ) || 1
  );
  const shared = {
    uniqueId: viewer,
    nickname,
    channelUsername:
      String(currentState.settings?.tiktok?.username || "shenpulse"),
    profilePictureUrl: String(
      overrides.avatarUrl || overrides.profilePictureUrl || ""
    )
  };
  const samples = {
    gift: {
      event: "gift",
      data: {
        ...shared,
        giftId: String(overrides.giftId || "rose"),
        giftName: String(overrides.giftName || "Rose"),
        giftImageUrl: String(overrides.giftImageUrl || ""),
        repeatCount: Math.max(1, Number(overrides.repeatCount ?? count) || 1),
        value: Math.max(1, Number(overrides.value || 1) || 1)
      }
    },
    follow: { event: "follow", data: shared },
    like: {
      event: "like",
      data: {
        ...shared,
        likeCount: Math.max(1, Number(overrides.likeCount ?? count) || 1)
      }
    },
    chat: {
      event: "chat",
      data: {
        ...shared,
        comment: String(overrides.message || overrides.comment || "!help")
      }
    },
    share: { event: "share", data: shared },
    subscribe: { event: "subscribe", data: shared },
    join: { event: "join", data: shared },
    raid: {
      event: "raid",
      data: { ...shared, count, viewers: Number(overrides.viewers || count) }
    }
  };
  return samples[eventType] || samples.gift;
}

async function callLocalApi(pathname, body) {
  if (!accountStatus.authenticated) {
    throw clientError("ACCOUNT_REQUIRED", "Connectez d'abord votre compte ShenPulse.");
  }
  const runtime = loadLocalRuntime(accountStatus.uid);
  if (!runtime?.apiPort || !runtime.apiToken) {
    throw clientError(
      "LOCAL_API_UNAVAILABLE",
      "Le serveur local ShenPulse n'est pas configuré."
    );
  }
  const response = await fetch(
    `http://127.0.0.1:${runtime.apiPort}${pathname}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runtime.apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body || {}),
      signal: AbortSignal.timeout(15000)
    }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      payload.error || "Le serveur local ShenPulse a refusé le test."
    );
    error.code = "LOCAL_API_ERROR";
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

async function simulateLocalEvent(incoming = {}) {
  const raw = createRawTestEvent(incoming.type, incoming);
  await callLocalApi("/api/events", raw);
  return normalizeEvent(raw, "codex-preview");
}

async function triggerLocalEffect(effectId, options = {}) {
  const currentState = loadPersistedAccountState(accountStatus.uid);
  const packId = String(
    options.packId ||
      selectedGameId ||
      currentState.session?.activeGamePackId ||
      ""
  );
  return callLocalApi("/api/effects", {
    ...options,
    effectId: String(effectId || ""),
    packId
  });
}

async function firebaseRequest(action, body) {
  const response = await fetch(
    `${IDENTITY_BASE_URL}/${action}?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw firebaseError(payload);
  return payload;
}

async function loginWithEmail(credentials = {}) {
  const email = String(credentials.email || "").trim().toLowerCase();
  const password = String(credentials.password || "");
  if (!email || !email.includes("@")) {
    throw clientError("INVALID_EMAIL", "Cette adresse e-mail n'est pas valide.");
  }
  if (!password) {
    throw clientError("MISSING_PASSWORD", "Le mot de passe est requis.");
  }

  const auth = await firebaseRequest("accounts:signInWithPassword", {
    email,
    password,
    returnSecureToken: true
  });
  const lookup = await firebaseRequest("accounts:lookup", {
    idToken: auth.idToken
  });
  const user = Array.isArray(lookup.users) ? lookup.users[0] || {} : {};
  const provider = Array.isArray(user.providerUserInfo)
    ? user.providerUserInfo[0] || {}
    : {};
  const uid = String(user.localId || auth.localId || "").trim();
  if (!uid) {
    throw clientError(
      "INVALID_IDENTITY",
      "Firebase n'a pas confirmé l'identité du compte."
    );
  }

  accountStatus = {
    authenticated: true,
    email: String(user.email || auth.email || email).trim().toLowerCase(),
    uid,
    displayName: String(user.displayName || "").trim(),
    photoUrl: String(user.photoUrl || "").trim(),
    providerId: String(provider.providerId || "password").trim(),
    emailVerified: user.emailVerified === true,
    lastAuthenticatedAt: new Date().toISOString(),
    offline: false
  };
  selectedGameId = String(
    loadPersistedAccountState(uid).session?.activeGamePackId || ""
  );
  return structuredClone(accountStatus);
}

function clientError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function firebaseError(payload = {}) {
  const raw = String(payload?.error?.message || "");
  const code = raw.split(" : ")[0].trim() || "AUTHENTICATION_FAILED";
  const messages = {
    EMAIL_NOT_FOUND: "Adresse ou mot de passe incorrect.",
    INVALID_EMAIL: "Cette adresse e-mail n'est pas valide.",
    INVALID_PASSWORD: "Adresse ou mot de passe incorrect.",
    INVALID_LOGIN_CREDENTIALS: "Adresse ou mot de passe incorrect.",
    USER_DISABLED: "Ce compte ShenPulse a été désactivé.",
    TOO_MANY_ATTEMPTS_TRY_LATER:
      "Trop de tentatives. Réessayez dans quelques minutes."
  };
  const error = new Error(
    messages[code] || "Connexion au compte ShenPulse impossible."
  );
  error.code = code;
  error.statusCode = Number(payload?.error?.code) || 502;
  return error;
}

function bridgeSource() {
  return `"use strict";
(() => {
  const request = async (pathname, options = {}) => {
    const response = await fetch(pathname, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || "Action impossible.");
      error.code = payload.code || "PREVIEW_REQUEST_FAILED";
      throw error;
    }
    return payload;
  };
  const noop = async () => ({ ok: true });
  const api = {
    getSnapshot: () => request("/__codex-preview-api/snapshot"),
    searchGifts: (query = "", limit = 80) => request(
      "/__codex-preview-api/catalog/gifts?query=" + encodeURIComponent(query) +
        "&limit=" + encodeURIComponent(limit)
    ),
    searchSounds: (options) => request("/__codex-preview-api/catalog/sounds", {
      method: "POST",
      body: JSON.stringify(options || {})
    }),
    searchMedia: (options) => request("/__codex-preview-api/catalog/media", {
      method: "POST",
      body: JSON.stringify(options || {})
    }),
    getGameRuntimeStatus: async () => null,
    getSpotifyStatus: async () => ({ configured: false, connected: false, devices: [] }),
    saveSettings: (settings) => request("/__codex-preview-api/settings", {
      method: "POST",
      body: JSON.stringify(settings || {})
    }),
    publishOverlayConfiguration: noop,
    testEvent: (type) => request("/__codex-preview-api/event/test", {
      method: "POST",
      body: JSON.stringify({ type })
    }),
    simulateEvent: (event) => request("/__codex-preview-api/event/simulate", {
      method: "POST",
      body: JSON.stringify(event || {})
    }),
    testAction: (action) => request("/__codex-preview-api/action/test", {
      method: "POST",
      body: JSON.stringify(action || {})
    }),
    selectGame: (id) => request("/__codex-preview-api/game/select", {
      method: "POST",
      body: JSON.stringify({ id })
    }),
    triggerEffect: (id, options) => request("/__codex-preview-api/game/effect", {
      method: "POST",
      body: JSON.stringify({ id, options: options || {} })
    }),
    on: () => () => {},
    updates: { check: async () => ({ available: false }), install: noop },
    account: {
      status: () => request("/__codex-preview-api/account/status"),
      gameCheatAccess: async () => ({ allowed: false, checkedAt: "" }),
      syncEntitlements: async () => null,
      login: (credentials) => request("/__codex-preview-api/account/login", {
        method: "POST",
        body: JSON.stringify(credentials || {})
      }),
      register: async () => { throw new Error("L'inscription n'est pas disponible dans l'aperçu Codex."); },
      loginWithBrowser: async () => { throw new Error("Utilisez l'application Electron pour la connexion Google."); },
      requestPasswordReset: noop,
      cancelCheckout: noop,
      startGameCheckout: noop,
      startSubscriptionCheckout: noop,
      stopSubscription: noop,
      logout: () => request("/__codex-preview-api/account/logout", { method: "POST", body: "{}" })
    },
    admin: {
      status: async () => ({ authorized: false }),
      visibility: async () => structuredClone((await request("/__codex-preview-api/snapshot")).state.settings.siteVisibility),
      dashboard: async () => ({}),
      login: noop,
      logout: noop,
      saveSiteSettings: noop,
      saveCommerce: noop,
      grantTrial: noop,
      updateTrial: noop,
      revokeTrial: noop
    },
    irl: {
      status: noop,
      scan: async () => ({ accessPoints: [], currentNetwork: "" }),
      pair: noop,
      add: noop,
      remove: noop,
      rename: noop,
      setEnabled: noop,
      test: noop
    },
    window: { minimize: noop, maximize: noop, close: noop }
  };
  window.shenPulse = new Proxy(api, {
    get(target, property) {
      return property in target ? target[property] : noop;
    }
  });
  document.documentElement.dataset.codexPreview = "true";
})();`;
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function send(response, statusCode, contentType, body) {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(body);
}

function sendJson(response, statusCode, payload) {
  send(
    response,
    statusCode,
    "application/json; charset=utf-8",
    JSON.stringify(payload)
  );
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(clientError("PAYLOAD_TOO_LARGE", "Requête trop volumineuse."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(clientError("INVALID_JSON", "Requête invalide."));
      }
    });
    request.on("error", reject);
  });
}

function resolveStaticTarget(requestPath) {
  let relative;
  if (requestPath === "/") relative = "src/renderer/index.html";
  else if (requestPath === "/overlay" || requestPath === "/overlay/") {
    relative = "resources/overlays/index.html";
  } else if (requestPath.startsWith("/overlay/")) {
    relative = `resources/overlays/${requestPath.slice("/overlay/".length)}`;
  } else {
    relative = requestPath.replace(/^\/+/, "");
  }
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return "";
  return target;
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, previewBase);
    const requestPath = decodeURIComponent(requestUrl.pathname);

    if (requestPath === "/__codex-preview-bridge.js") {
      return send(response, 200, mimeTypes[".js"], bridgeSource());
    }
    if (requestPath === "/__codex-preview-api/snapshot") {
      return sendJson(response, 200, snapshot());
    }
    if (requestPath === "/__codex-preview-api/account/status") {
      return sendJson(response, 200, accountStatus);
    }
    if (
      requestPath === "/__codex-preview-api/settings" &&
      request.method === "POST"
    ) {
      return sendJson(
        response,
        200,
        savePreviewSettings(await readJsonBody(request))
      );
    }
    if (requestPath === "/__codex-preview-api/catalog/gifts") {
      return sendJson(
        response,
        200,
        giftCatalog.search(
          requestUrl.searchParams.get("query") || "",
          Number(requestUrl.searchParams.get("limit")) || 80
        )
      );
    }
    if (
      requestPath === "/__codex-preview-api/catalog/sounds" &&
      request.method === "POST"
    ) {
      const options = await readJsonBody(request);
      return sendJson(response, 200, await searchMyInstantsSounds(options));
    }
    if (
      requestPath === "/__codex-preview-api/catalog/media" &&
      request.method === "POST"
    ) {
      const options = await readJsonBody(request);
      return sendJson(response, 200, await searchWikimediaMedia(options));
    }
    if (
      requestPath === "/__codex-preview-api/event/test" &&
      request.method === "POST"
    ) {
      const incoming = await readJsonBody(request);
      return sendJson(
        response,
        200,
        await simulateLocalEvent({ type: incoming.type || "gift" })
      );
    }
    if (
      requestPath === "/__codex-preview-api/event/simulate" &&
      request.method === "POST"
    ) {
      return sendJson(
        response,
        200,
        await simulateLocalEvent(await readJsonBody(request))
      );
    }
    if (
      requestPath === "/__codex-preview-api/action/test" &&
      request.method === "POST"
    ) {
      const action = await readJsonBody(request);
      if (action.type === "game.effect") {
        return sendJson(
          response,
          200,
          await triggerLocalEffect(
            action.config?.effectId || action.config?.id,
            action.config || {}
          )
        );
      }
      return sendJson(response, 200, action.config || { ok: true });
    }
    if (
      requestPath === "/__codex-preview-api/game/select" &&
      request.method === "POST"
    ) {
      const incoming = await readJsonBody(request);
      const requestedId = String(incoming.id || "");
      if (!gamePacks.some((pack) => pack.id === requestedId)) {
        throw clientError("GAME_NOT_FOUND", "Jeu ShenPulse introuvable.");
      }
      selectedGameId = requestedId;
      return sendJson(response, 200, snapshot());
    }
    if (
      requestPath === "/__codex-preview-api/game/effect" &&
      request.method === "POST"
    ) {
      const incoming = await readJsonBody(request);
      return sendJson(
        response,
        200,
        await triggerLocalEffect(incoming.id, incoming.options || {})
      );
    }
    if (
      requestPath === "/__codex-preview-api/account/login" &&
      request.method === "POST"
    ) {
      return sendJson(response, 200, await loginWithEmail(await readJsonBody(request)));
    }
    if (
      requestPath === "/__codex-preview-api/account/logout" &&
      request.method === "POST"
    ) {
      accountStatus = signedOutAccount();
      selectedGameId = "";
      return sendJson(response, 200, accountStatus);
    }
    if (requestPath === "/overlay/events" || requestPath === "/overlay/state") {
      return send(response, 204, "text/plain; charset=utf-8", "");
    }

    const target = resolveStaticTarget(requestPath);
    if (!target) return send(response, 403, "text/plain; charset=utf-8", "Accès refusé");
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      return send(response, 404, "text/plain; charset=utf-8", "Introuvable");
    }
    let body = fs.readFileSync(target);
    if (target.endsWith(path.join("src", "renderer", "index.html"))) {
      body = Buffer.from(
        body
          .toString("utf8")
          .replace(
            "<head>",
            '<head>\n    <script src="/__codex-preview-bridge.js"></script>'
          )
      );
    }
    return send(
      response,
      200,
      mimeTypes[path.extname(target).toLowerCase()] || "application/octet-stream",
      body
    );
  } catch (error) {
    return sendJson(response, error.statusCode || 500, {
      code: error.code || "PREVIEW_SERVER_ERROR",
      message: error.message || "Erreur de l'aperçu ShenPulse."
    });
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    process.stdout.write(`Aperçu ShenPulse prêt : ${previewBase}\n`);
  });
}

module.exports = {
  bridgeSource,
  loadPersistedAccountState,
  loadLocalRuntime,
  savePreviewSettings,
  snapshot,
  signedOutAccount
};
