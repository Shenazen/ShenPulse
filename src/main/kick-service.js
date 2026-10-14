"use strict";

const { readState } = require("./state-projection");

const crypto = require("node:crypto");
const http = require("node:http");
const { EventEmitter } = require("node:events");
const { normalizeEvent } = require("./event-normalizer");
const { safeString, timingSafeToken } = require("./utils");
const { jsonResponse, readRequestBody, listenLoopback, closeServer } = require("./integration-http");

const KICK_API = "https://api.kick.com/public/v1";
const KICK_AUTH = "https://id.kick.com/oauth";
const KICK_EVENTS = ["chat.message.sent", "channel.followed", "channel.subscription.new", "channel.subscription.renewal", "channel.subscription.gifts", "kicks.gifted", "livestream.status.updated"];
const KICK_GRAPHEMES = new Intl.Segmenter("fr", { granularity: "grapheme" });

function kickUser(value = {}) {
  const badges = value.identity?.badges || [];
  return {
    id: safeString(value.user_id || "anonymous", 120),
    username: safeString(value.username || "anonymous", 120),
    displayName: safeString(value.username || "Anonyme", 160),
    avatarUrl: safeString(value.profile_picture, 1000),
    subscriber: badges.some((badge) => badge.type === "subscriber"),
    moderator: badges.some((badge) => ["moderator", "broadcaster"].includes(badge.type))
  };
}

function normalizeKickEvent(type, payload = {}, messageId = "", source = "source_kick") {
  const eventType = {
    "chat.message.sent": "chat",
    "channel.followed": "follow",
    "channel.subscription.new": "subscribe",
    "channel.subscription.renewal": "subscribe",
    "channel.subscription.gifts": "subscribe",
    "kicks.gifted": "gift"
  }[type];
  if (!eventType) return null;
  const sender = payload.sender || payload.follower || payload.subscriber || payload.gifter || {};
  const data = {
    id: safeString(messageId || payload.message_id, 160),
    user: kickUser(sender),
    message: safeString(payload.content || payload.gift?.message, 1000),
    count: type === "channel.subscription.gifts" ? Math.max(1, payload.giftees?.length || 1) : 1,
    giftId: type === "kicks.gifted" ? safeString(payload.gift?.type || payload.gift?.name, 120) : "",
    giftName: safeString(payload.gift?.name, 160),
    value: type === "kicks.gifted" ? Math.max(0, Number(payload.gift?.amount) || 0) : 0,
    platform: "kick"
  };
  return normalizeEvent({ event: eventType, data }, source);
}

function verifyKickSignature({ publicKey, id, timestamp, signature, rawBody, now = Date.now() }) {
  if (!id || !timestamp || !signature || !publicKey) return false;
  const sentAt = Date.parse(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > 5 * 60000) return false;
  try {
    return crypto.verify("RSA-SHA256", Buffer.concat([Buffer.from(`${id}.${timestamp}.`), Buffer.from(rawBody)]), publicKey, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

class KickService extends EventEmitter {
  constructor({ store, openExternal, fetchImpl = globalThis.fetch }) {
    super();
    this.store = store;
    this.openExternal = openExternal;
    this.fetch = fetchImpl;
    this.server = null;
    this.pending = null;
    this.runtime = null;
    this.publicKey = null;
    this.publicKeyFetchedAt = 0;
    this.seenIds = new Map();
    this.refreshPromise = null;
    this.authorizationEpoch = 0;
    this.authorizationError = null;
  }

  settings() { return readState(this.store, ["settings.kick"]).settings.kick || {}; }
  port() { return Math.min(65535, Math.max(1024, Math.round(Number(this.settings().port) || 21218))); }
  redirectUri() { return `http://127.0.0.1:${this.port()}/kick/callback`; }

  /** Toute attente OAuth/HTTP reste attachée au propriétaire et à l'autorisation initiale. */
  ownerKey() {
    const account = readState(this.store, ["settings.account.uid"]).settings?.account || {};
    const settings = this.settings();
    return JSON.stringify([this.store.getActiveAccountUid?.() ?? account.uid ?? "", account.uid || "",
      settings.clientId || "", settings.clientSecretId || "", Number(settings.port) || 21218, this.authorizationEpoch]);
  }

  assertOwner(owner) {
    if (owner === this.ownerKey()) return;
    const error = new Error("Le compte ou l'autorisation Kick a changé. Réessayez depuis votre compte ShenPulse.");
    error.code = "INTEGRATION_CONTEXT_CHANGED";
    throw error;
  }

  markAuthorizationError(error, owner) {
    if (owner === this.ownerKey() && (error.statusCode === 401 || error.oauthError === "invalid_grant")) {
      this.authorizationError = { owner, message: "L’autorisation Kick a expiré ou a été révoquée. Autorisez à nouveau le compte." };
    }
  }

  status() {
    const settings = this.settings();
    const authorizationError = this.authorizationError?.owner === this.ownerKey() ? this.authorizationError.message : "";
    return {
      configured: Boolean(settings.clientId && settings.clientSecretId && this.store.getSecret(settings.clientSecretId)),
      connected: Boolean(settings.refreshTokenSecretId && this.store.getSecret(settings.refreshTokenSecretId)) && !authorizationError,
      receiving: Boolean(this.runtime && (!this.runtime.owner || this.runtime.owner === this.ownerKey())) && !authorizationError,
      callbackUri: this.redirectUri(),
      webhookLocalUrl: `http://127.0.0.1:${this.port()}/kick/webhook`,
      webhookUrl: settings.webhookUrl || "",
      account: settings.account || null,
      live: settings.live === true,
      lastEventAt: settings.lastEventAt || "",
      subscriptions: settings.subscriptions || [],
      message: authorizationError || settings.error || "",
      scopes: settings.scopes || [],
      scopesKnown: settings.scopesKnown === true
    };
  }

  async configure(incoming = {}) {
    const owner = this.ownerKey();
    const clientId = safeString(incoming.clientId || this.settings().clientId, 300).trim();
    const port = Number(incoming.port || this.port());
    if (!clientId || !Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Client ID ou port Kick invalide.");
    const webhookUrl = safeString(incoming.webhookUrl || this.settings().webhookUrl, 1200).trim();
    let url;
    try { url = new URL(webhookUrl); } catch { throw new Error("Renseignez l’URL HTTPS publique de votre webhook Kick."); }
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Le webhook Kick doit être une URL HTTPS publique.");
    const clientSecretId = incoming.clientSecret
      ? this.store.setSecret(this.settings().clientSecretId || "", safeString(incoming.clientSecret, 5000))
      : this.settings().clientSecretId;
    if (!clientSecretId || !this.store.getSecret(clientSecretId)) throw new Error("Le secret de l’application Kick est requis.");
    const changed = clientId !== this.settings().clientId || port !== this.port();
    await this.stop();
    if (this.pending) this.pending.reject(new Error("Configuration Kick modifiée."));
    await closeServer(this.server);
    this.assertOwner(owner);
    this.authorizationEpoch += 1;
    this.server = null;
    this.store.set("settings.kick", { ...this.settings(), clientId, clientSecretId, port, webhookUrl, error: "" });
    if (changed) await this.clearTokens();
    return this.status();
  }

  async ensureServer() {
    if (this.server?.listening) return;
    const server = http.createServer((request, response) => {
      this.handleRequest(request, response).catch((error) => {
        if (!response.headersSent) jsonResponse(response, error.statusCode || 400, { error: error.message });
      });
    });
    server.requestTimeout = 10000;
    server.headersTimeout = 10000;
    await listenLoopback(server, this.port());
    this.server = server;
  }

  async connect() {
    if (!this.status().configured) throw new Error("Configurez votre application Kick avant de connecter le compte.");
    if (this.pending) throw new Error("Une connexion Kick est déjà en cours.");
    this.authorizationEpoch += 1;
    const owner = this.ownerKey();
    await this.ensureServer();
    this.assertOwner(owner);
    const verifier = crypto.randomBytes(64).toString("base64url");
    const state = crypto.randomBytes(32).toString("base64url");
    const url = new URL(`${KICK_AUTH}/authorize`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.settings().clientId);
    // Kick's documented NextJS workaround preserves the loopback redirect URI.
    url.searchParams.set("redirect", "127.0.0.1");
    url.searchParams.set("redirect_uri", this.redirectUri());
    url.searchParams.set("scope", "user:read channel:read chat:write events:subscribe");
    url.searchParams.set("code_challenge", crypto.createHash("sha256").update(verifier).digest("base64url"));
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", state);
    let pending;
    const callback = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("La connexion Kick a expiré.")), 180000);
      this.pending = pending = { state, resolve, reject, timeout };
    });
    // Handle rejection immediately even if opening the system browser fails.
    callback.catch(() => {});
    try {
      await this.openExternal(url.toString());
      const code = await callback;
      this.assertOwner(owner);
      const tokens = await this.tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: this.redirectUri() }, owner);
      // Valider l'identité avant d'écraser une ancienne autorisation utilisable.
      const response = await this.fetch(`${KICK_API}/users`, { headers: { Authorization: `Bearer ${safeString(tokens.access_token, 12000)}` }, signal: AbortSignal.timeout(15000) });
      this.assertOwner(owner);
      const users = await this.parseResponse(response);
      this.assertOwner(owner);
      const user = users?.data?.[0];
      if (!user?.user_id) throw new Error("Kick n’a pas renvoyé l’identité du compte.");
      await this.saveTokens(tokens, "", owner);
      this.assertOwner(owner);
      this.store.set("settings.kick", {
        ...this.settings(),
        account: { id: String(user.user_id), name: safeString(user.name, 160), avatarUrl: safeString(user.profile_picture, 1000) },
        error: ""
      });
      this.store.mutate((draft) => {
        const previous = draft.connections.find((entry) => entry.id === "source_kick");
        const connection = { ...previous, id: "source_kick", name: "Kick LIVE", type: "kick-native", enabled: true, status: "disconnected", config: {} };
        draft.connections = [...draft.connections.filter((entry) => entry.id !== connection.id), connection];
      }, true);
      return this.status();
    } finally {
      clearTimeout(pending?.timeout);
      if (this.pending === pending) this.pending = null;
    }
  }

  async clearTokens() {
    this.authorizationEpoch += 1;
    this.authorizationError = null;
    for (const key of ["accessTokenSecretId", "refreshTokenSecretId"]) {
      if (this.settings()[key]) this.store.setSecret(this.settings()[key], "");
    }
    this.store.set("settings.kick", { ...this.settings(), accessTokenSecretId: "", refreshTokenSecretId: "", expiresAt: 0, account: null, live: false, subscriptions: [], lastEventAt: "" });
  }

  async disconnect() {
    const owner = this.ownerKey();
    await this.stop();
    this.assertOwner(owner);
    const subscriptions = this.settings().subscriptions || [];
    if (subscriptions.length && this.status().connected) {
      try {
        const query = new URLSearchParams();
        subscriptions.forEach((entry) => query.append("id", entry.id));
        await this.request(`/events/subscriptions?${query}`, { method: "DELETE" });
      } catch { /* The local listener is already stopped if Kick is unavailable. */ }
    }
    this.assertOwner(owner);
    const token = this.store.getSecret(this.settings().accessTokenSecretId || "");
    if (token) {
      try {
        const url = new URL(`${KICK_AUTH}/revoke`);
        url.searchParams.set("token", token);
        url.searchParams.set("token_hint_type", "access_token");
        await this.fetch(url, { method: "POST", signal: AbortSignal.timeout(8000) });
      } catch { /* Local revocation remains effective offline. */ }
    }
    this.assertOwner(owner);
    await this.clearTokens();
    this.store.mutate((state) => {
      const connection = state.connections.find((entry) => entry.id === "source_kick");
      if (connection) { connection.enabled = false; connection.status = "disconnected"; }
    }, true);
    return this.status();
  }

  async start(connection = { id: "source_kick" }) {
    const owner = this.ownerKey();
    if (!this.status().connected) throw new Error("Connectez votre compte Kick dans Connexions.");
    if ((this.settings().scopesKnown === true || this.settings().scopes?.length) && !this.settings().scopes?.includes("events:subscribe")) throw new Error("Autorisez à nouveau Kick pour accorder la réception des événements (events:subscribe).");
    if (!this.settings().webhookUrl) throw new Error("Configurez le webhook HTTPS de votre application Kick.");
    await this.ensureServer();
    this.assertOwner(owner);
    await this.stop();
    this.assertOwner(owner);
    const existing = await this.request("/events/subscriptions");
    this.assertOwner(owner);
    const names = new Set((existing?.data || []).filter((entry) => String(entry.broadcaster_user_id) === this.settings().account?.id).map((entry) => entry.event));
    const missing = KICK_EVENTS.filter((name) => !names.has(name));
    let created = [];
    if (missing.length) {
      const result = await this.request("/events/subscriptions", {
        method: "POST",
        body: { method: "webhook", events: missing.map((name) => ({ name, version: 1 })) }
      });
      created = result?.data || [];
      this.assertOwner(owner);
      const failures = created.filter((entry) => entry.error);
      if (failures.length) throw new Error(`Abonnement Kick refusé : ${safeString(failures.map((entry) => entry.error).join(", "), 400)}`);
    }
    const subscriptions = [
      ...(existing?.data || []).filter((entry) => String(entry.broadcaster_user_id) === this.settings().account?.id).map((entry) => ({ id: entry.id, name: entry.event })),
      ...created.filter((entry) => entry.subscription_id).map((entry) => ({ id: entry.subscription_id, name: entry.name }))
    ];
    if (!subscriptions.length) throw new Error("Kick n’a confirmé aucun abonnement aux événements.");
    this.store.set("settings.kick", { ...this.settings(), subscriptions, error: "" });
    this.runtime = { id: connection.id, owner, polling: false, timer: setInterval(() => this.pollChannel().catch((error) => this.emit("diagnostic", { level: "warning", source: connection.id, message: error.message })), 30000) };
    this.runtime.timer.unref?.();
    await this.pollChannel().catch((error) => this.emit("diagnostic", { level: "warning", source: connection.id, message: error.message }));
    this.assertOwner(owner);
    return this.status();
  }

  async stop() {
    if (this.runtime?.timer) clearInterval(this.runtime.timer);
    this.runtime = null;
    this.seenIds.clear();
  }

  async pollChannel() {
    const runtime = this.runtime;
    if (!runtime || runtime.polling || (runtime.owner && runtime.owner !== this.ownerKey())) return;
    runtime.polling = true;
    try {
      const result = await this.request("/channels");
      if (this.runtime !== runtime || (runtime.owner && runtime.owner !== this.ownerKey())) return;
      const channel = result?.data?.[0];
      if (!channel) return;
      this.store.mutateRuntime((state) => { state.settings.kick.live = channel.stream?.is_live === true; });
      this.emit("live-status", { connectionId: runtime.id, live: channel.stream?.is_live === true, viewers: Number(channel.stream?.viewer_count) || 0 });
    } finally { runtime.polling = false; }
  }

  async send(payload, { shouldSend } = {}) {
    if ((this.settings().scopesKnown === true || this.settings().scopes?.length) && !this.settings().scopes?.includes("chat:write")) throw new Error("Autorisez à nouveau Kick pour accorder l’envoi de messages (chat:write).");
    const content = (typeof payload === "string" ? payload : typeof payload?.message === "string" ? payload.message : "").trim();
    if (!content) throw new Error("Le message Kick est vide.");
    if (Buffer.byteLength(content, "utf8") > 2048 || [...KICK_GRAPHEMES.segment(content)].length > 500) throw new Error("Le message Kick dépasse 500 caractères ou 2 048 octets UTF-8. Raccourcissez-le avant l’envoi.");
    const result = await this.request("/chat", { method: "POST", shouldSend, body: { content, type: "user", broadcaster_user_id: Number(this.settings().account?.id) } });
    if (result?.data?.is_sent !== true) {
      const error = new Error("Kick n’a pas confirmé l’envoi du message. Aucune réponse envoyée n’est annoncée.");
      error.code = "kick-chat-not-confirmed";
      throw error;
    }
    return { sent: true, acknowledged: true, confirmation: "platform" };
  }

  async request(apiPath, options = {}, retried = false, owner = this.ownerKey()) {
    this.assertOwner(owner);
    if (Number(this.settings().expiresAt) < Date.now() + 60000) await this.refresh();
    this.assertOwner(owner);
    // Garde interne du ChatBot, après les attentes OAuth et avant chaque POST
    // (y compris le retry 401). Les autres requêtes et l'auth restent inchangées.
    if (apiPath === "/chat" && typeof options.shouldSend === "function" && !options.shouldSend()) {
      const error = new Error("Réponse ChatBot annulée avant l’envoi : la session ou le profil a changé.");
      error.code = "CHATBOT_DELIVERY_CANCELLED";
      throw error;
    }
    const token = this.store.getSecret(this.settings().accessTokenSecretId || "");
    if (!token) throw new Error("Reconnectez votre compte Kick.");
    const response = await this.fetch(`${KICK_API}${apiPath}`, {
      method: options.method || "GET",
      headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(15000)
    });
    this.assertOwner(owner);
    if (response.status === 401 && !retried) { await this.refresh(); this.assertOwner(owner); return this.request(apiPath, options, true, owner); }
    try {
      const result = await this.parseResponse(response);
      this.assertOwner(owner);
      return result;
    } catch (error) { this.markAuthorizationError(error, owner); throw error; }
  }

  async parseResponse(response) {
    if (response.status === 204) return null;
    let payload;
    try { payload = await response.json(); } catch { payload = {}; }
    if (!response.ok) {
      const error = new Error(safeString(payload.message || payload.error_description || payload.error || `Kick : erreur ${response.status}`, 400));
      error.statusCode = response.status;
      error.oauthError = typeof payload.error === "string" ? payload.error : "";
      throw error;
    }
    return payload;
  }

  async tokenRequest(values, owner = this.ownerKey()) {
    this.assertOwner(owner);
    const body = new URLSearchParams({ ...values, client_id: this.settings().clientId, client_secret: this.store.getSecret(this.settings().clientSecretId) });
    try {
      const response = await this.fetch(`${KICK_AUTH}/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(15000) });
      this.assertOwner(owner);
      const tokens = await this.parseResponse(response);
      this.assertOwner(owner);
      return tokens;
    } catch (error) { this.markAuthorizationError(error, owner); throw error; }
  }

  async saveTokens(tokens, fallbackRefresh = "", owner = this.ownerKey()) {
    this.assertOwner(owner);
    if (!tokens.access_token || !(tokens.refresh_token || fallbackRefresh)) throw new Error("Kick n’a pas renvoyé les jetons attendus.");
    this.store.set("settings.kick", {
      ...this.settings(),
      accessTokenSecretId: this.store.setSecret(this.settings().accessTokenSecretId || "", safeString(tokens.access_token, 12000)),
      refreshTokenSecretId: this.store.setSecret(this.settings().refreshTokenSecretId || "", safeString(tokens.refresh_token || fallbackRefresh, 12000)),
      expiresAt: Date.now() + Math.max(1, Number(tokens.expires_in) || 3600) * 1000,
      scopes: Object.hasOwn(tokens, "scope") ? String(tokens.scope || "").split(/\s+/).filter(Boolean) : this.settings().scopes || [],
      scopesKnown: Object.hasOwn(tokens, "scope") || this.settings().scopesKnown === true
    });
    this.authorizationError = null;
  }

  async refresh() {
    const owner = this.ownerKey();
    if (this.refreshPromise?.owner === owner) return this.refreshPromise.promise;
    const refreshToken = this.store.getSecret(this.settings().refreshTokenSecretId || "");
    if (!refreshToken) throw new Error("Reconnectez votre compte Kick.");
    const pending = { owner, promise: this.tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }, owner).then((tokens) => this.saveTokens(tokens, refreshToken, owner)) };
    this.refreshPromise = pending;
    try { await pending.promise; } finally { if (this.refreshPromise === pending) this.refreshPromise = null; }
  }

  async currentPublicKey(force = false) {
    if (!force && this.publicKey && Date.now() - this.publicKeyFetchedAt < 3600000) return this.publicKey;
    const response = await this.fetch(`${KICK_API}/public-key`, { signal: AbortSignal.timeout(10000) });
    const payload = await this.parseResponse(response);
    const key = payload.data?.public_key || payload.public_key;
    if (!key) throw new Error("Clé de signature Kick indisponible.");
    this.publicKey = crypto.createPublicKey(key);
    this.publicKeyFetchedAt = Date.now();
    return this.publicKey;
  }

  async handleRequest(request, response) {
    const owner = this.ownerKey();
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/kick/callback" && request.method === "GET") {
      const pending = this.pending;
      const state = url.searchParams.get("state") || "";
      if (!pending || !state || !timingSafeToken(state, pending.state)) return jsonResponse(response, 400, { error: "Retour d’autorisation Kick invalide." });
      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      response.writeHead(error || !code ? 400 : 200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" });
      response.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><title>Kick · ShenPulse</title><style>body{background:#090b14;color:white;font:18px system-ui;display:grid;place-items:center;height:100vh;margin:0}main{text-align:center;padding:32px}h1{color:#53fc18}</style><main><h1>${error || !code ? "Connexion refusée" : "Autorisation reçue"}</h1><p>Vous pouvez revenir dans ShenPulse.</p></main></html>`);
      clearTimeout(pending.timeout);
      if (error || !code) pending.reject(new Error("Kick a refusé l’autorisation."));
      else pending.resolve(code);
      return;
    }
    if (url.pathname !== "/kick/webhook" || request.method !== "POST") return jsonResponse(response, 404, { error: "Endpoint inconnu." });
    const rawBody = await readRequestBody(request, 262144);
    const id = safeString(request.headers["kick-event-message-id"], 160);
    const timestamp = safeString(request.headers["kick-event-message-timestamp"], 100);
    const signature = safeString(request.headers["kick-event-signature"], 2048);
    if (!id || !timestamp || !signature || !Number.isFinite(Date.parse(timestamp)) || Math.abs(Date.now() - Date.parse(timestamp)) > 5 * 60000) {
      return jsonResponse(response, 401, { error: "Signature ou horodatage Kick invalide." });
    }
    let key = await this.currentPublicKey();
    if (owner !== this.ownerKey()) return jsonResponse(response, 200, { ok: true, ignored: true });
    let valid = verifyKickSignature({ publicKey: key, id, timestamp, signature, rawBody });
    if (!valid && Date.now() - this.publicKeyFetchedAt > 60000) {
      key = await this.currentPublicKey(true);
      if (owner !== this.ownerKey()) return jsonResponse(response, 200, { ok: true, ignored: true });
      valid = verifyKickSignature({ publicKey: key, id, timestamp, signature, rawBody });
    }
    if (!valid) return jsonResponse(response, 401, { error: "Signature Kick invalide." });
    if (!this.runtime || (this.runtime.owner && this.runtime.owner !== owner) || this.seenIds.has(id)) return jsonResponse(response, 200, { ok: true, ignored: true });
    const payload = JSON.parse(rawBody.toString("utf8"));
    if (String(payload.broadcaster?.user_id) !== this.settings().account?.id) return jsonResponse(response, 403, { error: "Événement d’un autre compte." });
    this.seenIds.set(id, Date.now());
    if (this.seenIds.size > 4000) this.seenIds.delete(this.seenIds.keys().next().value);
    const type = safeString(request.headers["kick-event-type"], 100);
    const event = normalizeKickEvent(type, payload, id, this.runtime.id);
    this.store.mutateRuntime((state) => {
      state.settings.kick.lastEventAt = new Date().toISOString();
      if (type === "livestream.status.updated") state.settings.kick.live = payload.is_live === true;
    });
    if (event) this.emit("event", event);
    if (type === "livestream.status.updated") this.emit("live-status", { connectionId: this.runtime.id, live: payload.is_live === true });
    return jsonResponse(response, 200, { ok: true });
  }

  async dispose() {
    this.authorizationEpoch += 1;
    if (this.pending) this.pending.reject(new Error("Connexion Kick interrompue."));
    clearTimeout(this.pending?.timeout);
    this.pending = null;
    await this.stop();
    await closeServer(this.server);
    this.server = null;
  }
}

module.exports = { KickService, KICK_EVENTS, normalizeKickEvent, verifyKickSignature };
