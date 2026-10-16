"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
const listeners = new Map();

contextBridge.exposeInMainWorld("shenPulse", {
  getSnapshot: () => invoke("snapshot:get"),
  startupReady: () => invoke("startup:ready"),
  liveDirectoryConfigure: (options) => invoke("live-directory:configure", options),
  chatbot: {
    transportStatus: () => invoke("chatbot:transport-status"),
    configureTransport: (options) => invoke("chatbot:transport-configure", options)
  },
  matches: {
    status: () => invoke("matches:status"),
    visualStatus: () => invoke("matches:visual-status"),
    visualSources: () => invoke("matches:visual-sources"),
    visualPreview: (sourceId, scope) => invoke("matches:visual-preview", sourceId, scope),
    saveVisual: (config, scope) => invoke("matches:visual-save", config, scope),
    saveConfig: (config, scope) => invoke("matches:config-save", config, scope),
    saveAutomation: (automation, scope) => invoke("matches:automation-save", automation, scope),
    removeAutomation: (id, scope) => invoke("matches:automation-remove", id, scope),
    testAutomation: (id, scope) => invoke("matches:automation-test", id, scope),
    testWidget: (key, scope) => invoke("matches:widget-test", key, scope),
    adjustWins: (options, scope) => invoke("matches:wins-adjust", options, scope),
    resetWins: (scope) => invoke("matches:wins-reset", scope),
    resetContributors: (scope) => invoke("matches:contributors-reset", scope)
  },
  users: {
    snapshot: (options) => invoke("users:snapshot", options),
    setBlocked: (id, blocked) => invoke("users:block", id, blocked),
    setBlockedList: (usernames, options) => invoke("users:block-list", usernames, options),
    unblock: (options, expectedUid) => invoke("users:unblock", options, expectedUid),
    remove: (id) => invoke("users:remove", id),
    cleanup: (options) => invoke("users:cleanup", options),
    clear: (options) => invoke("users:clear", options),
    import: (data) => invoke("users:import", data),
    export: (options) => invoke("users:export", options),
    merge: (options) => invoke("users:merge", options)
  },
  kick: {
    status: () => invoke("kick:status"),
    configure: (options) => invoke("kick:configure", options),
    connect: () => invoke("kick:connect"),
    disconnect: () => invoke("kick:disconnect")
  },
  controllers: {
    status: () => invoke("controllers:status"),
    pair: () => invoke("controllers:pair"),
    install: () => invoke("controllers:install"),
    revoke: (id) => invoke("controllers:revoke", id),
    saveMapping: (mapping) => invoke("controllers:mapping-save", mapping),
    removeMapping: (id) => invoke("controllers:mapping-remove", id),
    execute: (options) => invoke("controllers:execute", options)
  },
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
  removeCustomSound: (id, expectedUid) => invoke("sound:remove", id, expectedUid),
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
  publishThiercelieuxHostState: (state) =>
    invoke("game:thiercelieux-host-state", state),
  sendThiercelieuxCommand: (command) =>
    invoke("game:thiercelieux-command", command),
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
  selectGameRom: (id) => invoke("game:select-rom", id),
  launchGame: (id) => invoke("game:launch", id),
  setGameWindowFormat: (id, format) =>
    invoke("game:window-format", id, format),
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
      "runtime-state-changed",
      "live-event",
      "gift-catalog-updated",
      "gift-room-catalog-updated",
      "users-changed",
      "song-requests-changed",
      "playback",
      "game-effect",
      "deal-host-state",
      "thiercelieux-host-state",
      "thiercelieux-command",
      "game-install-progress",
      "game-round-timeout",
      "overlay-completion-fired",
      "public-overlay-relay-status",
      "live-directory-status",
      "chat-transport-changed",
      "renderer-visibility",
      "persistence-status"
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
