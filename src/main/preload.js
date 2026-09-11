"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
const listeners = new Map();

contextBridge.exposeInMainWorld("shenPulse", {
  getSnapshot: () => invoke("snapshot:get"),
  updates: {
    check: (options) => invoke("updates:check", options),
    install: () => invoke("updates:install")
  },
  account: {
    status: () => invoke("account:status"),
    login: (credentials) => invoke("account:login", credentials),
    register: (credentials) =>
      invoke("account:register", credentials),
    loginWithBrowser: (options) =>
      invoke("account:login-browser", options),
    requestPasswordReset: (payload) =>
      invoke("account:password-reset", payload),
    cancelCheckout: (payload) =>
      invoke("account:checkout-cancel", payload),
    startGameCheckout: (payload) =>
      invoke("account:game-checkout", payload),
    startSubscriptionCheckout: (payload) =>
      invoke("account:subscription-checkout", payload),
    stopSubscription: () =>
      invoke("account:subscription-stop"),
    gameCheatAccess: () =>
      invoke("account:game-cheat-access"),
    syncEntitlements: () =>
      invoke("account:sync-entitlements"),
    logout: () => invoke("account:logout")
  },
  admin: {
    status: () => invoke("admin:status"),
    login: (credentials) => invoke("admin:login", credentials),
    logout: () => invoke("admin:logout"),
    visibility: () => invoke("admin:visibility-public"),
    dashboard: () => invoke("admin:dashboard"),
    saveSiteSettings: (settings) => invoke("admin:site-save", settings),
    saveCommerce: (payload) => invoke("admin:commerce-save", payload),
    grantTrial: (payload) => invoke("admin:trial-grant", payload),
    updateTrial: (payload) => invoke("admin:trial-update", payload),
    revokeTrial: (payload) => invoke("admin:trial-revoke", payload)
  },
  searchGifts: (query, limit) => invoke("catalog:gifts", query, limit),
  searchSounds: (options) => invoke("catalog:sounds", options),
  searchMedia: (options) => invoke("catalog:media", options),
  uploadCustomSound: () => invoke("sound:upload"),
  uploadCustomMedia: (kind) => invoke("media:upload", kind),
  startSession: () => invoke("session:start"),
  stopSession: () => invoke("session:stop"),
  testEvent: (type) => invoke("event:test", type),
  simulateEvent: (event) => invoke("event:simulate", event),
  testRule: (id, event) => invoke("rule:test", id, event),
  testAction: (action) => invoke("action:test", action),
  testTimer: (id) => invoke("timer:test", id),
  irl: {
    status: () => invoke("irl:status"),
    scan: (options) => invoke("irl:scan", options),
    pair: (options) => invoke("irl:pair", options),
    add: (options) => invoke("irl:add", options),
    remove: (id) => invoke("irl:remove", id),
    rename: (id, name) => invoke("irl:rename", id, name),
    setEnabled: (enabled) => invoke("irl:enabled", enabled),
    test: (options) => invoke("irl:test", options)
  },
  restartServers: () => invoke("server:restart"),
  rotatePublicOverlayUrls: () => invoke("overlay:public-urls-rotate"),
  rotateMatchOverlayUrl: () => invoke("overlay:match-url-rotate"),
  upsert: (collection, item) => invoke("entity:upsert", collection, item),
  remove: (collection, id) => invoke("entity:remove", collection, id),
  saveConnection: (connection) => invoke("connection:save", connection),
  startConnection: (id) => invoke("connection:start", id),
  stopConnection: (id) => invoke("connection:stop", id),
  saveTikTok: (settings) => invoke("tiktok:save", settings),
  startTikTok: () => invoke("tiktok:start"),
  stopTikTok: () => invoke("tiktok:stop"),
  assignPremiumSeat: (payload) => invoke("premium-seat:assign", payload),
  saveSettings: (settings) => invoke("settings:save", settings),
  publishOverlayConfiguration: (key, configuration) =>
    invoke("overlay:configuration", key, configuration),
  selectProfile: (id) => invoke("profile:select", id),
  selectGame: (id) => invoke("game:select", id),
  configureGame: (id, config) => invoke("game:configure", id, config),
  publishDealHostState: (state) =>
    invoke("game:deal-host-state", state),
  brumeluneLan: {
    start: (payload) => invoke("game:brumelune-lan:start", payload),
    update: (payload) => invoke("game:brumelune-lan:update", payload),
    poll: () => invoke("game:brumelune-lan:poll"),
    stop: () => invoke("game:brumelune-lan:stop")
  },
  initializeGameInteractions: (id) =>
    invoke("game:initialize-interactions", id),
  saveGameInteraction: (id, rule) =>
    invoke("game:interaction:save", id, rule),
  removeGameInteraction: (id, ruleId) =>
    invoke("game:interaction:remove", id, ruleId),
  startGameSession: (id) => invoke("game:session:start", id),
  stopGameSession: () => invoke("game:session:stop"),
  saveGameRoundSettings: (id, settings) =>
    invoke("game:round-settings:save", id, settings),
  testGame: (id) => invoke("game:test", id),
  triggerEffect: (id, options) => invoke("game:effect", id, options),
  auditGameInteraction: (id, effectId, progress) =>
    invoke("game:interaction-audit", id, effectId, progress),
  getGameRuntimeStatus: (id) => invoke("game:runtime-status", id),
  installGame: (id) => invoke("game:install", id),
  launchGame: (id) => invoke("game:launch", id),
  testObs: () => invoke("obs:test"),
  connectSpotify: () => invoke("spotify:connect"),
  disconnectSpotify: () => invoke("spotify:disconnect"),
  getSpotifyStatus: () => invoke("spotify:status"),
  controlSpotify: (config) => invoke("spotify:control", config),
  copy: (text) => invoke("clipboard:write", text),
  openExternal: (url) => invoke("external:open", url),
  exportData: () => invoke("data:export"),
  importData: () => invoke("data:import"),
  clearData: () => invoke("data:clear"),
  window: {
    minimize: () => invoke("window:minimize"),
    maximize: () => invoke("window:maximize"),
    close: () => invoke("window:close")
  },
  on: (channel, callback) => {
    const allowed = new Set([
      "state-changed",
      "live-event",
      "playback",
      "game-effect",
      "deal-host-state",
      "game-install-progress",
      "game-round-timeout",
      "overlay-completion-fired",
      "public-overlay-relay-status"
    ]);
    if (!allowed.has(channel) || typeof callback !== "function") return () => {};
    const key = `${channel}:${Math.random()}`;
    const listener = (_event, value) => callback(value);
    listeners.set(key, listener);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
      listeners.delete(key);
    };
  }
});
