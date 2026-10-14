"use strict";

/** Aperçu local : pont navigateur sans accès direct aux fichiers ni jetons persistés. */

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

function previewIndexHtml(source) {
  return String(source).replace(
    "<head>",
    '<head>\n    <base href="/src/renderer/" />\n    <script src="/__codex-preview-bridge.js"></script>'
  );
}

module.exports = { bridgeSource, previewIndexHtml };

