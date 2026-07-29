"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const { shell } = require("electron");
const { safeString } = require("./utils");

const ACCOUNTS_BASE = "https://accounts.spotify.com";
const API_BASE = "https://api.spotify.com/v1";
const SCOPES = [
  "user-read-playback-state",
  "user-read-currently-playing",
  "user-modify-playback-state"
];

class SpotifyService {
  constructor({ store, notifyRenderer }) {
    this.store = store;
    this.notifyRenderer = notifyRenderer;
    this.pendingServer = null;
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

    const verifier = crypto.randomBytes(64).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const state = crypto.randomBytes(24).toString("base64url");
    const port = Math.min(65535, Math.max(1024, Number(settings.redirectPort) || 21215));
    const redirectUri = `http://127.0.0.1:${port}/spotify/callback`;

    const resultPromise = this.#waitForCallback({ port, state });
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
      const tokens = await this.#tokenRequest({
        client_id: clientId,
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri
      });
      await this.#saveTokens(tokens);
      return this.status();
    } catch (error) {
      this.#closePendingServer();
      throw error;
    }
  }

  async disconnect() {
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
    if (!configured || !settings.refreshTokenSecretId) {
      return {
        configured,
        connected: false,
        redirectUri: this.redirectUri(),
        devices: [],
        account: settings.account || null,
        playback: null
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
      return {
        configured,
        connected: true,
        redirectUri: this.redirectUri(),
        account: settings.account || null,
        devices,
        activeDevice: devices.find((device) => device.isActive) || null,
        playback:
          playbackResult.status === "fulfilled"
            ? normalizePlayback(playbackResult.value)
            : null,
        premiumRequired: true
      };
    } catch (error) {
      if (Number(error.statusCode) === 401) {
        return {
          configured,
          connected: false,
          redirectUri: this.redirectUri(),
          devices: [],
          account: settings.account || null,
          playback: null,
          message: error.message
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

  async control(config = {}) {
    const operation = String(config.operation || config.action || "queue")
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, "_");
    if (operation === "queue" || operation === "request") {
      return this.#requestTrack(config);
    }
    if (operation === "next" || operation === "skip") {
      await this.#ensurePlaybackDevice();
      await this.#request("/me/player/next", { method: "POST" });
      return { ok: true, operation: "next" };
    }
    if (operation === "pause") {
      await this.#ensurePlaybackDevice();
      await this.#request("/me/player/pause", { method: "PUT" });
      return { ok: true, operation };
    }
    if (operation === "play" || operation === "resume") {
      await this.#ensurePlaybackDevice();
      await this.#request("/me/player/play", { method: "PUT" });
      return { ok: true, operation: "play" };
    }
    if (operation === "now_playing") {
      return {
        ok: true,
        operation,
        playback: normalizePlayback(
          await this.#request("/me/player/currently-playing")
        )
      };
    }
    if (operation === "volume_up" || operation === "volume_down") {
      return this.#changeVolume(operation === "volume_up" ? 10 : -10);
    }
    throw new Error("Opération Spotify inconnue.");
  }

  async #requestTrack(config) {
    const raw = safeString(config.uri || config.query || config.track, 300).trim();
    if (!raw) throw new Error("Indiquez un titre, une URL ou un URI Spotify.");
    let track = null;
    const uri = spotifyTrackUri(raw);
    if (uri) {
      track = await this.#request(`/tracks/${encodeURIComponent(uri.split(":").pop())}`);
    } else {
      const payload = await this.#request(
        `/search?type=track&limit=1&q=${encodeURIComponent(raw)}`
      );
      track = payload?.tracks?.items?.[0] || null;
    }
    if (!track?.uri) throw new Error("Aucun titre Spotify trouvé.");
    if (config.allowExplicit === false && track.explicit === true) {
      throw new Error("Ce titre est explicite et le filtre est actif.");
    }
    const maxMinutes = Math.max(0, Number(config.maxDurationMinutes) || 0);
    if (maxMinutes && Number(track.duration_ms) > maxMinutes * 60000) {
      throw new Error("Ce titre dépasse la durée maximale configurée.");
    }
    await this.#ensurePlaybackDevice();
    if (config.mode === "play" || config.playNow === true) {
      await this.#request("/me/player/play", {
        method: "PUT",
        body: { uris: [track.uri] }
      });
      return { ok: true, operation: "play", track: normalizeTrack(track) };
    }
    await this.#request(
      `/me/player/queue?uri=${encodeURIComponent(track.uri)}`,
      { method: "POST" }
    );
    return { ok: true, operation: "queue", track: normalizeTrack(track) };
  }

  async #changeVolume(delta) {
    await this.#ensurePlaybackDevice();
    const playback = await this.#request("/me/player");
    const volume = Math.min(
      100,
      Math.max(0, Number(playback?.device?.volume_percent ?? 50) + delta)
    );
    await this.#request(`/me/player/volume?volume_percent=${volume}`, {
      method: "PUT"
    });
    return { ok: true, operation: delta > 0 ? "volume_up" : "volume_down", volume };
  }

  async #ensurePlaybackDevice() {
    const payload = await this.#request("/me/player/devices");
    const devices = Array.isArray(payload?.devices) ? payload.devices : [];
    if (devices.some((device) => device?.is_active)) return;
    const target = devices.find((device) => device?.id);
    if (!target) {
      throw new Error(
        "Ouvrez Spotify sur votre PC ou téléphone, lancez une musique, puis réessayez."
      );
    }
    await this.#request("/me/player", {
      method: "PUT",
      body: { device_ids: [target.id], play: false }
    });
  }

  async #request(apiPath, options = {}, retried = false) {
    const token = await this.#accessToken();
    const response = await fetch(`${API_BASE}${apiPath}`, {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" })
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    if (response.status === 204) return null;
    const text = await response.text();
    const payload = parseJson(text, null);
    if (response.status === 401 && !retried) {
      await this.#refresh();
      return this.#request(apiPath, options, true);
    }
    if (!response.ok) {
      const error = new Error(spotifyError(payload, text, response.statusText));
      error.statusCode = response.status;
      throw error;
    }
    return payload;
  }

  async #accessToken() {
    const settings = this.#settings();
    if (!settings.refreshTokenSecretId) {
      throw new Error("Spotify n’est pas connecté.");
    }
    if (Number(settings.expiresAt || 0) <= Date.now() + 60000) {
      await this.#refresh();
    }
    const token = this.store.getSecret(this.#settings().accessTokenSecretId);
    if (!token) throw new Error("Jeton Spotify introuvable.");
    return token;
  }

  async #refresh() {
    const settings = this.#settings();
    const refreshToken = this.store.getSecret(settings.refreshTokenSecretId);
    if (!refreshToken) throw new Error("Reconnectez votre compte Spotify.");
    const tokens = await this.#tokenRequest({
      client_id: this.#clientId(),
      grant_type: "refresh_token",
      refresh_token: refreshToken
    });
    await this.#saveTokens(tokens, refreshToken);
  }

  async #saveTokens(tokens, fallbackRefreshToken = "") {
    const settings = this.#settings();
    const accessToken = safeString(tokens.access_token, 5000);
    const refreshToken = safeString(tokens.refresh_token || fallbackRefreshToken, 5000);
    if (!accessToken || !refreshToken) {
      throw new Error("Spotify n’a pas renvoyé les jetons attendus.");
    }
    const accessTokenSecretId = this.store.setSecret(
      settings.accessTokenSecretId,
      accessToken
    );
    const refreshTokenSecretId = this.store.setSecret(
      settings.refreshTokenSecretId,
      refreshToken
    );
    let account = settings.account || null;
    try {
      account = normalizeAccount(
        await spotifyFetch("/me", accessToken, { method: "GET" })
      );
    } catch {
      // A token can remain usable even if the profile endpoint is momentarily down.
    }
    this.store.set("settings.spotify", {
      ...settings,
      accessTokenSecretId,
      refreshTokenSecretId,
      expiresAt:
        Date.now() + Math.max(1, Number(tokens.expires_in || 3600)) * 1000,
      account
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
      body
    });
    const text = await response.text();
    const payload = parseJson(text, {});
    if (!response.ok) {
      throw new Error(spotifyError(payload, text, response.statusText));
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
        this.#closePendingServer();
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

  #closePendingServer() {
    if (!this.pendingServer) return;
    try {
      this.pendingServer.close();
    } catch {
      // Best effort.
    }
    this.pendingServer = null;
  }

  #clientId() {
    return safeString(
      this.#settings().clientId || process.env.SPOTIFY_CLIENT_ID,
      300
    ).trim();
  }

  #settings() {
    return this.store.getState().settings.spotify || {};
  }
}

async function spotifyFetch(apiPath, accessToken, options = {}) {
  const response = await fetch(`${API_BASE}${apiPath}`, {
    method: options.method || "GET",
    headers: { Authorization: `Bearer ${accessToken}` }
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
    volume: Number(value.volume_percent || 0)
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
