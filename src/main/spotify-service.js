"use strict";
const { assertCommandContext } = require("./commands/context-guard");

const { readState } = require("./state-projection");

const crypto = require("node:crypto");
const http = require("node:http");
const { shell } = require("electron");
const { safeString } = require("./utils");
const { SongRequestsService } = require("./spotify/song-requests");
const { runLibraryControl } = require("./spotify/library-controls");
const { spotifyCapabilities } = require("../shared/spotify-capabilities");

const ACCOUNTS_BASE = "https://accounts.spotify.com";
const API_BASE = "https://api.spotify.com/v1";
// A Spotify Client ID is public by design. Shipping ShenPulse's own ID lets
// creators authorize their account without creating or configuring an app.
const SHENPULSE_SPOTIFY_CLIENT_ID = "996de28fa8b542f4958f4d49051d9406";
const SCOPES = [
  "user-read-playback-state",
  "user-read-currently-playing",
  "user-modify-playback-state",
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative"
];

class SpotifyService {
  constructor({ store, notifyRenderer }) {
    this.store = store;
    this.notifyRenderer = notifyRenderer;
    this.pendingServer = null;
    this.refreshPromise = null;
    this.authorizationEpoch = 0;
    this.songRequests = new SongRequestsService({ store, spotify: this, notifyRenderer });
  }

  async connect() {
    const settings = this.#settings();
    const clientId = this.#clientId();
    if (!clientId) {
      throw new Error(
        "Renseignez d’abord le Client ID de l’application Spotify dans Paramètres."
      );
    }
    if (this.pendingServer) {
      throw new Error("Une connexion Spotify est déjà en cours.");
    }
    this.authorizationEpoch += 1;
    const owner = this.#ownerKey();

    const verifier = crypto.randomBytes(64).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const state = crypto.randomBytes(24).toString("base64url");
    const port = Math.min(65535, Math.max(1024, Number(settings.redirectPort) || 21215));
    const redirectUri = `http://127.0.0.1:${port}/spotify/callback`;

    const resultPromise = this.#waitForCallback({ port, state });
    const pendingServer = this.pendingServer;
    resultPromise.catch(() => {}); // Une ouverture de navigateur refusée ne laisse pas de rejet non géré.
    const authorizationUrl = new URL("/authorize", ACCOUNTS_BASE);
    authorizationUrl.searchParams.set("client_id", clientId);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("scope", SCOPES.join(" "));
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("show_dialog", "true");
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
    authorizationUrl.searchParams.set("code_challenge", challenge);

    try {
      await shell.openExternal(authorizationUrl.toString());
      const code = await resultPromise;
      if (owner !== this.#ownerKey()) throw new Error("Le compte ShenPulse a changé pendant la connexion Spotify. Réessayez depuis votre compte.");
      const tokens = await this.#tokenRequest({
        client_id: clientId,
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri
      });
      if (owner !== this.#ownerKey()) throw new Error("Le compte ShenPulse a changé pendant la connexion Spotify. Réessayez depuis votre compte.");
      await this.#saveTokens(tokens);
      return this.status();
    } catch (error) {
      this.#closePendingServer(pendingServer);
      throw error;
    }
  }

  async disconnect() {
    this.authorizationEpoch += 1;
    const settings = this.#settings();
    if (settings.accessTokenSecretId) {
      this.store.setSecret(settings.accessTokenSecretId, "");
    }
    if (settings.refreshTokenSecretId) {
      this.store.setSecret(settings.refreshTokenSecretId, "");
    }
    this.store.set("settings.spotify", {
      ...settings,
      accessTokenSecretId: "",
      refreshTokenSecretId: "",
      expiresAt: 0,
      account: null
    });
    return this.status();
  }

  async status() {
    const configured = Boolean(this.#clientId());
    const settings = this.#settings();
    const owner = this.#ownerKey();
    if (!configured || !settings.refreshTokenSecretId) {
      return {
        configured,
        connected: false,
        redirectUri: this.redirectUri(),
        devices: [],
        account: settings.account || null,
        playback: null,
        songRequests: this.songRequests.status()
      };
    }
    try {
      const [devicesResult, playbackResult] = await Promise.allSettled([
        this.#request("/me/player/devices"),
        this.#request("/me/player/currently-playing")
      ]);
      const devices =
        devicesResult.status === "fulfilled" && Array.isArray(devicesResult.value?.devices)
          ? devicesResult.value.devices.map(normalizeDevice)
          : [];
      const errors = [devicesResult, playbackResult].filter((result) => result.status === "rejected");
      const authError = errors.find((result) => Number(result.reason?.statusCode) === 401 || result.reason?.oauthError === "invalid_grant");
      const currentSettings = this.#settings();
      const sameOwner = owner === this.#ownerKey();
      const status = {
        configured,
        connected: sameOwner && Boolean(currentSettings.refreshTokenSecretId) && !authError,
        redirectUri: this.redirectUri(),
        account: currentSettings.account || null,
        devices: sameOwner ? devices : [],
        activeDevice: sameOwner ? devices.find((device) => device.isActive) || null : null,
        playback:
          sameOwner && playbackResult.status === "fulfilled"
            ? normalizePlayback(playbackResult.value)
            : null,
        premiumRequired: true,
        songRequests: this.songRequests.status(),
        scopes: currentSettings.scopes || [],
        scopesKnown: currentSettings.scopesKnown === true,
        devicesKnown: sameOwner && devicesResult.status === "fulfilled",
        ...(errors.length ? { message: errors.map((result) => result.reason?.message).filter(Boolean).join(" · ") } : {})
      };
      status.capabilities = spotifyCapabilities(status);
      return status;
    } catch (error) {
      if (Number(error.statusCode) === 401) {
        return {
          configured,
          connected: false,
          redirectUri: this.redirectUri(),
          devices: [],
          account: settings.account || null,
          playback: null,
          message: error.message,
          songRequests: this.songRequests.status()
        };
      }
      throw error;
    }
  }

  redirectUri() {
    const port = Math.min(
      65535,
      Math.max(1024, Number(this.#settings().redirectPort) || 21215)
    );
    return `http://127.0.0.1:${port}/spotify/callback`;
  }

  async control(config = {}, { shouldExecute } = {}) {
    assertCommandContext(shouldExecute);
    const owner = this.#ownerKey();
    const operation = String(config.operation || config.action || "queue")
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, "_");
    if (["next", "skip", "pause", "play", "resume", "previous", "volume", "volume_up", "volume_down", "seek", "queue", "request", "play_track", "play_tracks", "play_playlist", "requests_play_next", "requests_skip"].includes(operation)) {
      const settings = this.#settings();
      const capabilities = spotifyCapabilities({ connected: Boolean(settings.refreshTokenSecretId), account: settings.account,
        scopes: settings.scopes, scopesKnown: settings.scopesKnown });
      if (!capabilities.canControlPlayback) throw new Error(capabilities.reason);
    }
    if (operation.startsWith("requests_")) {
      if (operation === "requests_status") return this.songRequests.status();
      if (operation === "requests_settings") return this.songRequests.configure(config.settings || {});
      if (operation === "requests_add") return this.songRequests.add({ query: config.query, uri: config.uri, user: config.user, creator: true });
      if (operation === "requests_remove") return this.songRequests.remove(config.id);
      if (operation === "requests_clear") return this.songRequests.clear();
      if (operation === "requests_play_next") return this.songRequests.playNext();
      if (operation === "requests_skip") return this.songRequests.skip();
      throw new Error("Opération de demandes musicales inconnue.");
    }
    const library = await runLibraryControl({ operation, config,
      request: (path, options) => this.#request(path, options, false, owner, shouldExecute),
      ensureDevice: () => this.#ensurePlaybackDevice({ volume: operation === "volume", owner, shouldExecute }), normalizeTrack });
    if (library !== undefined) return library;
    if (operation === "queue" || operation === "request") {
      return this.#requestTrack(config, owner, shouldExecute);
    }
    if (operation === "next" || operation === "skip") {
      await this.#ensurePlaybackDevice({ owner, shouldExecute });
      await this.#request("/me/player/next", { method: "POST" }, false, owner, shouldExecute);
      return { ok: true, operation: "next" };
    }
    if (operation === "pause") {
      await this.#ensurePlaybackDevice({ owner, shouldExecute });
      await this.#request("/me/player/pause", { method: "PUT" }, false, owner, shouldExecute);
      return { ok: true, operation };
    }
    if (operation === "play" || operation === "resume") {
      await this.#ensurePlaybackDevice({ owner, shouldExecute });
      await this.#request("/me/player/play", { method: "PUT" }, false, owner, shouldExecute);
      return { ok: true, operation: "play" };
    }
    if (operation === "now_playing") {
      return {
        ok: true,
        operation,
        playback: normalizePlayback(
          await this.#request("/me/player/currently-playing", {}, false, owner)
        )
      };
    }
    if (operation === "volume_up" || operation === "volume_down") {
      return this.#changeVolume(operation === "volume_up" ? 10 : -10, owner, shouldExecute);
    }
    throw new Error("Opération Spotify inconnue.");
  }

  async #requestTrack(config, owner, shouldExecute) {
    const track = await this.resolveTrack(config, owner, shouldExecute);
    if (config.allowExplicit === false && track.explicit === true) {
      throw new Error("Ce titre est explicite et le filtre est actif.");
    }
    const maxMinutes = Math.max(0, Number(config.maxDurationMinutes) || 0);
    if (maxMinutes && track.durationMs > maxMinutes * 60000) {
      throw new Error("Ce titre dépasse la durée maximale configurée.");
    }
    await this.#ensurePlaybackDevice({ owner, shouldExecute });
    if (config.mode === "play" || config.playNow === true) {
      await this.#request("/me/player/play", { method: "PUT", body: { uris: [track.uri] } }, false, owner, shouldExecute);
      return { ok: true, operation: "play", track };
    }
    await this.#request(`/me/player/queue?uri=${encodeURIComponent(track.uri)}`, { method: "POST" }, false, owner, shouldExecute);
    return { ok: true, operation: "queue", track };
  }

  /** Résolution sans lecture : les demandes sont validées avant toute action Spotify. */
  async resolveTrack(config = {}, owner = this.#ownerKey(), shouldExecute) {
    const raw = safeString(config.uri || config.query || config.track, 300).trim();
    if (!raw) throw new Error("Indiquez un titre, une URL ou un URI Spotify.");
    let track = null;
    const uri = spotifyTrackUri(raw);
    if (uri) {
      track = await this.#request(`/tracks/${encodeURIComponent(uri.split(":").pop())}`, {}, false, owner, shouldExecute);
    } else {
      const payload = await this.#request(
        `/search?type=track&limit=1&q=${encodeURIComponent(raw)}`, {}, false, owner, shouldExecute
      );
      track = payload?.tracks?.items?.[0] || null;
    }
    if (!track?.uri) throw new Error("Aucun titre Spotify trouvé.");
    return normalizeTrack(track);
  }

  async #changeVolume(delta, owner, shouldExecute) {
    await this.#ensurePlaybackDevice({ volume: true, owner, shouldExecute });
    const playback = await this.#request("/me/player", {}, false, owner, shouldExecute);
    const volume = Math.min(
      100,
      Math.max(0, Number(playback?.device?.volume_percent ?? 50) + delta)
    );
    await this.#request(`/me/player/volume?volume_percent=${volume}`, {
      method: "PUT"
    }, false, owner, shouldExecute);
    return { ok: true, operation: delta > 0 ? "volume_up" : "volume_down", volume };
  }

  async #ensurePlaybackDevice({ volume = false, owner = this.#ownerKey(), shouldExecute } = {}) {
    const payload = await this.#request("/me/player/devices", {}, false, owner, shouldExecute);
    const devices = Array.isArray(payload?.devices) ? payload.devices : [];
    const active = devices.find((device) => device?.is_active);
    if (active && !active.is_restricted) {
      if (volume && active.supports_volume === false) throw new Error("Le volume de cet appareil ne peut pas être modifié par l’API Spotify.");
      return;
    }
    const target = devices.find((device) => device?.id && !device.is_restricted);
    if (!target) {
      throw new Error(
        "Ouvrez Spotify sur votre PC ou téléphone, lancez une musique, puis réessayez."
      );
    }
    if (volume && target.supports_volume === false) throw new Error("Le volume de cet appareil ne peut pas être modifié par l’API Spotify.");
    await this.#request("/me/player", {
      method: "PUT",
      body: { device_ids: [target.id], play: false }
    }, false, owner, shouldExecute);
  }

  async #request(apiPath, options = {}, retried = false, owner = this.#ownerKey(), shouldExecute) {
    assertCommandContext(shouldExecute);
    if (owner !== this.#ownerKey()) throw new Error("Le compte Spotify a changé pendant la requête. Réessayez.");
    const token = await this.#accessToken();
    assertCommandContext(shouldExecute);
    if (owner !== this.#ownerKey()) throw new Error("Le compte Spotify a changé pendant la requête. Réessayez.");
    const response = await fetch(`${API_BASE}${apiPath}`, {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" })
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(15_000)
    });
    assertCommandContext(shouldExecute);
    if (owner !== this.#ownerKey()) throw new Error("Le compte Spotify a changé pendant la requête. Réessayez.");
    if (response.status === 204) return null;
    const text = await response.text();
    if (owner !== this.#ownerKey()) throw new Error("Le compte Spotify a changé pendant la requête. Réessayez.");
    const payload = parseJson(text, null);
    if (response.status === 401 && !retried) {
      await this.#refresh();
      if (owner !== this.#ownerKey()) throw new Error("Le compte Spotify a changé pendant la requête. Réessayez.");
      return this.#request(apiPath, options, true, owner, shouldExecute);
    }
    if (!response.ok) {
      const error = new Error(spotifyError(payload, text, response.statusText));
      error.statusCode = response.status;
      if (response.status === 403) error.message = `Spotify refuse cette opération (Premium, permissions ou accès de l’application). ${error.message}`;
      if (response.status === 429) error.message = `Spotify limite temporairement les requêtes. Réessayez plus tard. ${error.message}`;
      throw error;
    }
    return payload;
  }

  async #accessToken() {
    const settings = this.#settings();
    if (!settings.refreshTokenSecretId) {
      const error = new Error("Spotify n’est pas connecté.");
      error.statusCode = 401;
      throw error;
    }
    if (Number(settings.expiresAt || 0) <= Date.now() + 60000) {
      await this.#refresh();
    }
    const token = this.store.getSecret(this.#settings().accessTokenSecretId);
    if (!token) {
      const error = new Error("Jeton Spotify introuvable. Reconnectez votre compte Spotify.");
      error.statusCode = 401;
      throw error;
    }
    return token;
  }

  async #refresh() {
    const owner = this.#ownerKey();
    if (this.refreshPromise?.owner === owner) return this.refreshPromise.promise;
    const pending = { owner, promise: this.#performRefresh() };
    this.refreshPromise = pending;
    try { return await pending.promise; } finally { if (this.refreshPromise === pending) this.refreshPromise = null; }
  }

  async #performRefresh() {
    const settings = this.#settings();
    const owner = this.#ownerKey();
    const refreshToken = this.store.getSecret(settings.refreshTokenSecretId);
    if (!refreshToken) {
      const error = new Error("Reconnectez votre compte Spotify.");
      error.statusCode = 401;
      throw error;
    }
    const tokens = await this.#tokenRequest({
      client_id: this.#clientId(),
      grant_type: "refresh_token",
      refresh_token: refreshToken
    });
    if (owner !== this.#ownerKey()) throw new Error("Le compte Spotify actif a changé pendant le renouvellement. Réessayez.");
    await this.#saveTokens(tokens, refreshToken);
  }

  async #saveTokens(tokens, fallbackRefreshToken = "") {
    const settings = this.#settings();
    const owner = this.#ownerKey();
    const accessToken = safeString(tokens.access_token, 5000);
    const refreshToken = safeString(tokens.refresh_token || fallbackRefreshToken, 5000);
    if (!accessToken || !refreshToken) {
      throw new Error("Spotify n’a pas renvoyé les jetons attendus.");
    }
    let account = settings.account || null;
    try {
      account = normalizeAccount(
        await spotifyFetch("/me", accessToken, { method: "GET" })
      );
    } catch {
      // A token can remain usable even if the profile endpoint is momentarily down.
    }
    if (owner !== this.#ownerKey()) throw new Error("Le compte ShenPulse a changé pendant la connexion Spotify. Réessayez depuis votre compte.");
    // La réponse /me peut être lente : conserver les demandes/réglages modifiés
    // entre-temps et ne fusionner que le résultat de cette autorisation.
    const currentSettings = this.#settings();
    const accessTokenSecretId = this.store.setSecret(currentSettings.accessTokenSecretId, accessToken);
    const refreshTokenSecretId = this.store.setSecret(currentSettings.refreshTokenSecretId, refreshToken);
    this.store.set("settings.spotify", {
      ...currentSettings,
      accessTokenSecretId,
      refreshTokenSecretId,
      expiresAt:
        Date.now() + Math.max(1, Number(tokens.expires_in || 3600)) * 1000,
      account,
      scopes: Object.hasOwn(tokens, "scope") ? String(tokens.scope || "").split(/\s+/).filter(Boolean) : currentSettings.scopes || [],
      scopesKnown: Object.hasOwn(tokens, "scope") || currentSettings.scopesKnown === true
    });
  }

  async #tokenRequest(values) {
    const body = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined && value !== null) body.set(key, String(value));
    });
    const response = await fetch(`${ACCOUNTS_BASE}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15_000)
    });
    const text = await response.text();
    const payload = parseJson(text, {});
    if (!response.ok) {
      const error = new Error(spotifyError(payload, text, response.statusText));
      error.statusCode = response.status;
      error.oauthError = typeof payload.error === "string" ? payload.error : "";
      if (error.oauthError === "invalid_grant") error.message = "L’autorisation Spotify a expiré ou a été révoquée. Reconnectez votre compte Spotify.";
      throw error;
    }
    return payload;
  }

  #waitForCallback({ port, state }) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (handler, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.#closePendingServer(server);
        handler(value);
      };
      const server = http.createServer((request, response) => {
        const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
        if (url.pathname !== "/spotify/callback") {
          response.writeHead(404);
          response.end();
          return;
        }
        const denied = url.searchParams.get("error");
        const returnedState = url.searchParams.get("state");
        const code = url.searchParams.get("code");
        const ok = !denied && returnedState === state && Boolean(code);
        response.writeHead(ok ? 200 : 400, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        });
        response.end(callbackPage(ok, denied));
        if (!ok) {
          settle(
            reject,
            new Error(
              denied
                ? `Spotify a refusé la connexion : ${denied}`
                : "Retour Spotify invalide."
            )
          );
          return;
        }
        settle(resolve, code);
      });
      server.once("error", (error) =>
        settle(
          reject,
          new Error(`Le port OAuth Spotify ${port} est indisponible : ${error.message}`)
        )
      );
      server.listen(port, "127.0.0.1");
      this.pendingServer = server;
      const timeout = setTimeout(
        () => settle(reject, new Error("La connexion Spotify a expiré.")),
        180000
      );
    });
  }

  #closePendingServer(server = this.pendingServer) {
    if (!server) return;
    try {
      server.close();
    } catch {
      // Best effort.
    }
    // Une ancienne réponse OAuth ne doit pas fermer/effacer le serveur
    // d'une autorisation plus récente (autre compte ou nouvelle tentative).
    if (this.pendingServer === server) this.pendingServer = null;
  }

  #clientId() {
    return safeString(
      process.env.SPOTIFY_CLIENT_ID || SHENPULSE_SPOTIFY_CLIENT_ID,
      300
    ).trim();
  }

  #settings() {
    return readState(this.store, ["settings.spotify"]).settings.spotify || {};
  }

  #ownerKey() {
    const account = readState(this.store, ["settings.account.uid"]).settings?.account || {};
    return JSON.stringify([this.store.getActiveAccountUid?.() ?? account.uid ?? "", account.uid || "",
      this.#settings().refreshTokenSecretId || "", this.#clientId(), Number(this.#settings().redirectPort) || 21215,
      this.authorizationEpoch]);
  }
}

async function spotifyFetch(apiPath, accessToken, options = {}) {
  const response = await fetch(`${API_BASE}${apiPath}`, {
    method: options.method || "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000)
  });
  if (response.status === 204) return null;
  const text = await response.text();
  const payload = parseJson(text, null);
  if (!response.ok) throw new Error(spotifyError(payload, text, response.statusText));
  return payload;
}

function spotifyTrackUri(value) {
  const text = String(value || "").trim();
  const uri = text.match(/^spotify:track:([a-zA-Z0-9]{22})$/);
  if (uri) return `spotify:track:${uri[1]}`;
  const url = text.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]{22})/);
  if (url) return `spotify:track:${url[1]}`;
  return /^[a-zA-Z0-9]{22}$/.test(text) ? `spotify:track:${text}` : "";
}

function normalizeAccount(value = {}) {
  return {
    id: safeString(value.id, 200),
    displayName: safeString(value.display_name || value.id, 200),
    email: safeString(value.email, 300),
    product: safeString(value.product, 40),
    country: safeString(value.country, 20)
  };
}

function normalizeDevice(value = {}) {
  return {
    id: safeString(value.id, 300),
    name: safeString(value.name, 200),
    type: safeString(value.type, 100),
    isActive: value.is_active === true,
    isRestricted: value.is_restricted === true,
    volume: Number(value.volume_percent || 0),
    ...(typeof value.supports_volume === "boolean" ? { supportsVolume: value.supports_volume } : {})
  };
}

function normalizePlayback(value) {
  if (!value || typeof value !== "object") return null;
  return {
    isPlaying: value.is_playing === true,
    progressMs: Number(value.progress_ms || 0),
    item: value.item ? normalizeTrack(value.item) : null
  };
}

function normalizeTrack(value = {}) {
  return {
    id: safeString(value.id, 200),
    name: safeString(value.name, 300),
    artists: (Array.isArray(value.artists) ? value.artists : [])
      .map((artist) => safeString(artist?.name, 200))
      .filter(Boolean),
    album: safeString(value.album?.name, 300),
    imageUrl: safeString(value.album?.images?.[0]?.url, 2000),
    durationMs: Number(value.duration_ms || 0),
    explicit: value.explicit === true,
    uri: safeString(value.uri, 300),
    url: safeString(value.external_urls?.spotify, 1000)
  };
}

function spotifyError(payload, text, fallback) {
  if (typeof payload?.error === "string") return payload.error;
  if (payload?.error?.message) return String(payload.error.message);
  if (payload?.error_description) return String(payload.error_description);
  return safeString(text || fallback || "Erreur Spotify.", 500);
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function callbackPage(ok, error) {
  const message = ok
    ? "Spotify est connecté à ShenPulse. Vous pouvez fermer cette fenêtre."
    : `Connexion Spotify impossible${error ? ` : ${escapeHtml(error)}` : "."}`;
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Spotify · ShenPulse</title><style>body{background:#090b14;color:#fff;font-family:Segoe UI,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0}main{max-width:560px;text-align:center;padding:32px}h1{color:${ok ? "#1ed760" : "#ec4899"}}</style><main><h1>${ok ? "Spotify connecté" : "Connexion impossible"}</h1><p>${message}</p></main><script>setTimeout(function(){window.close()},1200)</script></html>`;
}

function escapeHtml(value) {
  return safeString(value, 200)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = {
  SpotifyService,
  normalizeAccount,
  normalizeDevice,
  normalizePlayback,
  normalizeTrack,
  spotifyTrackUri
};
