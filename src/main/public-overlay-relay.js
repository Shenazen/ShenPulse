"use strict";

const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");
const {
  DEFAULT_FIREBASE_API_KEY,
  DEFAULT_FIREBASE_DATABASE_URL,
  DEFAULT_PUBLIC_OVERLAY_BASE_URL,
  PUBLIC_OVERLAY_PROTOCOL_VERSION,
  createPublicOverlayConfigurations,
  createRelayMessage,
  createRelayState,
  publicOverlayUrls,
  relayDatabaseUrl
} = require("../shared/public-overlay-protocol");
const { hasProOverlayAccess } = require("./overlay-server");
const {
  createMatchChannelId,
  matchAccountNumber,
  matchPublicSourcePath
} = require("./match-access");

const AUTH_BASE_URL = "https://identitytoolkit.googleapis.com/v1";
const TOKEN_BASE_URL = "https://securetoken.googleapis.com/v1";
const EVENT_BATCH_DELAY_MS = 16;
const STATE_DELAY_MS = 80;
const HEARTBEAT_MS = 45_000;
const MAX_QUEUED_MESSAGES = 1_000;
const MAX_BATCH_MESSAGES = 250;

class PublicOverlayRelay extends EventEmitter {
  constructor({ store, fetchImpl = globalThis.fetch, appVersion = "" }) {
    super();
    if (typeof fetchImpl !== "function") {
      throw new TypeError("Une implémentation de fetch est requise.");
    }
    this.store = store;
    this.fetch = fetchImpl;
    this.appVersion = String(appVersion || "");
    this.running = false;
    this.connected = false;
    this.statusValue = "stopped";
    this.lastError = "";
    this.idToken = "";
    this.refreshToken = "";
    this.tokenExpiresAt = 0;
    this.authPromise = null;
    this.connectPromise = null;
    this.eventQueue = [];
    this.pendingState = null;
    this.publishedState = null;
    this.eventTimer = null;
    this.stateTimer = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.batchSequence = 0;
    this.#ensureConfiguration();
  }

  configuration() {
    return this.store.getState().settings.publicOverlayRelay || {};
  }

  prepareConfiguration() {
    this.#ensureConfiguration();
    return this.configuration();
  }

  urls({ includeRestricted = false } = {}) {
    const config = this.configuration();
    const state = this.store.getState();
    const proAccess =
      includeRestricted || hasProOverlayAccess(state);
    const urls = publicOverlayUrls({
      baseUrl:
        config.publicBaseUrl || DEFAULT_PUBLIC_OVERLAY_BASE_URL,
      channelId: config.channelId,
      proAccess
    });
    const matchPath = matchPublicSourcePath({
      accountUid: state.settings?.account?.uid,
      channelId: config.matchChannelId
    });
    urls.matchPlayer = proAccess && matchPath
      ? `${String(
          config.publicBaseUrl || DEFAULT_PUBLIC_OVERLAY_BASE_URL
        ).replace(/\/$/, "")}${matchPath}`
      : "";
    return urls;
  }

  status() {
    const config = this.configuration();
    return {
      enabled: config.enabled !== false,
      status: this.statusValue,
      connected: this.connected,
      lastError: this.lastError,
      channelId: config.channelId || "",
      matchChannelId: config.matchChannelId || "",
      publicBaseUrl:
        config.publicBaseUrl || DEFAULT_PUBLIC_OVERLAY_BASE_URL,
      updatedAt: this.statusUpdatedAt || ""
    };
  }

  start() {
    if (this.running) return this.connectPromise || Promise.resolve();
    this.running = true;
    if (this.configuration().enabled === false) {
      this.#setStatus("disabled");
      return Promise.resolve();
    }
    this.#setStatus("connecting");
    this.connectPromise = this.#connect()
      .catch((error) => this.#connectionFailed(error))
      .finally(() => {
        this.connectPromise = null;
      });
    return this.connectPromise;
  }

  async stop() {
    this.running = false;
    this.#clearTimers();
    if (this.connected) {
      try {
        await Promise.all([
          this.#write({ presence: this.#presence(false) }),
          this.#writeMatchLink(false)
        ]);
      } catch {
        // La fermeture de l'application ne doit jamais être bloquée par le cloud.
      }
    }
    this.connected = false;
    this.idToken = "";
    this.#setStatus("stopped");
  }

  publish(channel, payload) {
    if (!this.running || this.configuration().enabled === false) return;
    this.eventQueue.push(
      createRelayMessage(channel, payload, {
        baseUrl: this.configuration().publicBaseUrl
      })
    );
    if (this.eventQueue.length > MAX_QUEUED_MESSAGES) {
      this.eventQueue.splice(
        0,
        this.eventQueue.length - MAX_QUEUED_MESSAGES
      );
    }
    if (this.eventTimer) return;
    this.eventTimer = setTimeout(() => {
      this.eventTimer = null;
      this.#flushEvents().catch((error) => this.#connectionFailed(error));
    }, EVENT_BATCH_DELAY_MS);
    this.eventTimer.unref?.();
  }

  publishState(state = this.store.getState()) {
    if (!this.running || this.configuration().enabled === false) return;
    this.pendingState = createRelayState(state, {
      baseUrl: this.configuration().publicBaseUrl
    });
    if (this.stateTimer) return;
    this.stateTimer = setTimeout(() => {
      this.stateTimer = null;
      this.#flushState().catch((error) => this.#connectionFailed(error));
    }, STATE_DELAY_MS);
    this.stateTimer.unref?.();
  }

  async rotateChannel() {
    if (this.connected) {
      try {
        await this.#deleteCurrentChannel();
      } catch {
        // La rotation reste possible même si l'ancien canal est hors ligne.
      }
    }
    const channelId = crypto.randomBytes(24).toString("base64url");
    this.store.mutate((state) => {
      state.settings.publicOverlayRelay.channelId = channelId;
    }, true);
    this.eventQueue = [];
    this.publishedState = null;
    this.pendingState = createRelayState(this.store.getState(), {
      baseUrl: this.configuration().publicBaseUrl
    });
    if (this.running && this.configuration().enabled !== false) {
      this.connected = false;
      await this.#connect();
    }
    return {
      urls: this.urls(),
      status: this.status()
    };
  }

  async rotateMatchChannel() {
    const currentChannel = this.configuration().matchChannelId;
    if (this.connected && currentChannel) {
      try {
        await this.#deleteChannel(currentChannel);
      } catch {
        // La nouvelle URL reste générée si l'ancien alias est déjà hors ligne.
      }
    }
    this.store.mutate((state) => {
      state.settings.publicOverlayRelay.matchChannelId = createMatchChannelId();
    }, true);
    if (this.running && this.configuration().enabled !== false) {
      await this.#writeMatchLink(true);
    }
    return {
      urls: this.urls(),
      status: this.status()
    };
  }

  #ensureConfiguration() {
    const current =
      this.store.getState().settings.publicOverlayRelay || {};
    const next = {
      enabled: current.enabled !== false,
      publicBaseUrl:
        current.publicBaseUrl || DEFAULT_PUBLIC_OVERLAY_BASE_URL,
      databaseUrl:
        current.databaseUrl || DEFAULT_FIREBASE_DATABASE_URL,
      apiKey: current.apiKey || DEFAULT_FIREBASE_API_KEY,
      channelId:
        current.channelId || crypto.randomBytes(24).toString("base64url"),
      matchChannelId:
        current.matchChannelId || createMatchChannelId(),
      email: current.email || "",
      uid: current.uid || "",
      passwordSecretId: current.passwordSecretId || "",
      refreshTokenSecretId: current.refreshTokenSecretId || ""
    };
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    this.store.mutate((state) => {
      state.settings.publicOverlayRelay = next;
    }, true);
  }

  async #connect() {
    if (!this.running) return;
    this.#setStatus("connecting");
    await this.#ensureToken();
    const state = createRelayState(this.store.getState(), {
      baseUrl: this.configuration().publicBaseUrl
    });
    const configurations = createPublicOverlayConfigurations(
      this.store.getState(),
      { baseUrl: this.configuration().publicBaseUrl }
    );
    await Promise.all([
      this.#write({
        ownerUid: this.configuration().uid,
        protocolVersion: PUBLIC_OVERLAY_PROTOCOL_VERSION,
        state,
        configurations,
        presence: this.#presence(true)
      }),
      this.#writeMatchLink(true)
    ]);
    this.publishedState = state;
    if (!this.running) return;
    this.connected = true;
    this.reconnectAttempt = 0;
    this.lastError = "";
    this.#setStatus("connected");
    this.#startHeartbeat();
    await Promise.all([this.#flushState(), this.#flushEvents()]);
  }

  async #ensureToken(force = false) {
    if (
      !force &&
      this.idToken &&
      Date.now() < this.tokenExpiresAt - 60_000
    ) {
      return this.idToken;
    }
    if (this.authPromise) return this.authPromise;
    this.authPromise = this.#authenticate().finally(() => {
      this.authPromise = null;
    });
    return this.authPromise;
  }

  async #authenticate() {
    const config = this.configuration();
    const storedRefreshToken =
      this.refreshToken ||
      this.store.getSecret(config.refreshTokenSecretId);
    if (storedRefreshToken) {
      try {
        const refreshed = await this.#requestJson(
          `${TOKEN_BASE_URL}/token?key=${encodeURIComponent(config.apiKey)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: storedRefreshToken
            }).toString()
          }
        );
        this.#acceptTokens({
          idToken: refreshed.id_token,
          refreshToken: refreshed.refresh_token,
          expiresIn: refreshed.expires_in,
          localId: refreshed.user_id
        });
        return this.idToken;
      } catch {
        // Le mot de passe local permet de restaurer la session si le refresh
        // token a été révoqué.
      }
    }

    const password = this.store.getSecret(config.passwordSecretId);
    if (config.email && password) {
      try {
        const signedIn = await this.#identityRequest(
          "accounts:signInWithPassword",
          {
            email: config.email,
            password,
            returnSecureToken: true
          }
        );
        this.#acceptTokens(signedIn);
        return this.idToken;
      } catch (error) {
        if (!isMissingFirebaseUser(error)) throw error;
      }
    }
    return this.#createIdentity();
  }

  async #createIdentity() {
    const password = `${crypto.randomBytes(32).toString("base64url")}Aa1!`;
    const email = `relay-${crypto
      .randomBytes(18)
      .toString("hex")}@relay.shenpulse.invalid`;
    const created = await this.#identityRequest("accounts:signUp", {
      email,
      password,
      returnSecureToken: true
    });
    const current = this.configuration();
    const passwordSecretId = this.store.setSecret(
      current.passwordSecretId,
      password
    );
    const refreshTokenSecretId = this.store.setSecret(
      current.refreshTokenSecretId,
      created.refreshToken
    );
    this.store.mutate((state) => {
      Object.assign(state.settings.publicOverlayRelay, {
        email,
        uid: created.localId,
        passwordSecretId,
        refreshTokenSecretId
      });
    }, true);
    this.#acceptTokens(created);
    return this.idToken;
  }

  async #identityRequest(operation, body) {
    const apiKey = this.configuration().apiKey;
    return this.#requestJson(
      `${AUTH_BASE_URL}/${operation}?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }
    );
  }

  #acceptTokens(payload) {
    this.idToken = String(payload.idToken || "");
    this.refreshToken = String(payload.refreshToken || "");
    this.tokenExpiresAt =
      Date.now() + Math.max(300, Number(payload.expiresIn || 3600)) * 1000;
    const config = this.configuration();
    const refreshTokenSecretId = this.refreshToken
      ? this.store.setSecret(
          config.refreshTokenSecretId,
          this.refreshToken
        )
      : config.refreshTokenSecretId;
    this.store.mutate((state) => {
      state.settings.publicOverlayRelay.uid =
        String(payload.localId || state.settings.publicOverlayRelay.uid || "");
      state.settings.publicOverlayRelay.refreshTokenSecretId =
        refreshTokenSecretId;
    });
  }

  async #write(
    values,
    retry = true,
    channelId = this.configuration().channelId
  ) {
    const token = await this.#ensureToken();
    const config = this.configuration();
    const response = await this.fetch(
      `${relayDatabaseUrl(
        config.databaseUrl,
        channelId
      )}?auth=${encodeURIComponent(token)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerUid: config.uid,
          protocolVersion: PUBLIC_OVERLAY_PROTOCOL_VERSION,
          ...values
        })
      }
    );
    if ((response.status === 401 || response.status === 403) && retry) {
      this.idToken = "";
      await this.#ensureToken(true);
      return this.#write(values, false, channelId);
    }
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(
        `Relais Firebase indisponible (${response.status})${
          detail ? ` : ${detail}` : ""
        }`
      );
    }
  }

  async #deleteCurrentChannel(retry = true) {
    return this.#deleteChannel(this.configuration().channelId, retry);
  }

  async #deleteChannel(channelId, retry = true) {
    const token = await this.#ensureToken();
    const config = this.configuration();
    const response = await this.fetch(
      `${relayDatabaseUrl(
        config.databaseUrl,
        channelId
      )}?auth=${encodeURIComponent(token)}`,
      { method: "DELETE" }
    );
    if ((response.status === 401 || response.status === 403) && retry) {
      this.idToken = "";
      await this.#ensureToken(true);
      return this.#deleteChannel(channelId, false);
    }
    if (!response.ok) {
      throw new Error(
        `Suppression de l'ancien relais impossible (${response.status}).`
      );
    }
  }

  async #flushEvents() {
    if (!this.eventQueue.length) return;
    if (!this.connected) {
      this.#scheduleReconnect();
      return;
    }
    const messages = this.eventQueue.splice(0, MAX_BATCH_MESSAGES);
    const id = `${Date.now().toString(36)}-${(++this.batchSequence).toString(
      36
    )}-${crypto.randomBytes(5).toString("base64url")}`;
    const includesConfiguration = messages.some(
      (message) => message?.channel === "configuration"
    );
    const state = createRelayState(this.store.getState(), {
      baseUrl: this.configuration().publicBaseUrl
    });
    const configurations = includesConfiguration
      ? createPublicOverlayConfigurations(this.store.getState(), {
          baseUrl: this.configuration().publicBaseUrl
        })
      : null;
    try {
      await this.#write({
        lastBatch: {
          id,
          sequence: this.batchSequence,
          createdAt: new Date().toISOString(),
          state,
          ...(configurations ? { configurations } : {}),
          messages
        },
        // Le lot et l'état racine doivent former une seule image atomique.
        // Sinon Firebase peut livrer le lot puis réappliquer l'ancien état.
        state,
        ...(includesConfiguration
          ? { configurations }
          : {}),
        presence: this.#presence(true)
      });
      this.publishedState = state;
    } catch (error) {
      this.eventQueue.unshift(...messages);
      throw error;
    }
    if (this.eventQueue.length && !this.eventTimer) {
      this.eventTimer = setTimeout(() => {
        this.eventTimer = null;
        this.#flushEvents().catch((error) => this.#connectionFailed(error));
      }, EVENT_BATCH_DELAY_MS);
      this.eventTimer.unref?.();
    }
  }

  async #flushState() {
    if (!this.pendingState || !this.connected) return;
    const state = this.pendingState;
    this.pendingState = null;
    try {
      await Promise.all([
        this.#write({
          state,
          presence: this.#presence(true)
        }),
        this.#writeMatchLink(true)
      ]);
      this.publishedState = state;
    } catch (error) {
      this.pendingState = state;
      throw error;
    }
  }

  #startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      Promise.all([
        this.#write({ presence: this.#presence(true) }),
        this.#writeMatchLink(true)
      ]).catch((error) => this.#connectionFailed(error));
    }, HEARTBEAT_MS);
    this.heartbeatTimer.unref?.();
  }

  #presence(connected) {
    return {
      connected: Boolean(connected),
      updatedAt: new Date().toISOString(),
      appVersion: this.appVersion
    };
  }

  #matchSource() {
    const state = this.store.getState();
    const port = Number(state.settings?.overlayPort || 0);
    return {
      enabled: hasProOverlayAccess(state),
      accountNumber: matchAccountNumber(state.settings?.account?.uid),
      localPort:
        Number.isInteger(port) && port >= 1 && port <= 65_535 ? port : 0
    };
  }

  #writeMatchLink(connected) {
    const config = this.configuration();
    return this.#write(
      {
        sourceChannel: config.channelId,
        matchSource: this.#matchSource(),
        presence: this.#presence(connected)
      },
      true,
      config.matchChannelId
    );
  }

  #connectionFailed(error) {
    if (!this.running) return;
    this.connected = false;
    this.lastError = String(error?.message || error || "Erreur inconnue").slice(
      0,
      500
    );
    this.#setStatus("offline");
    this.#scheduleReconnect();
  }

  #scheduleReconnect() {
    if (
      !this.running ||
      this.configuration().enabled === false ||
      this.reconnectTimer
    ) {
      return;
    }
    const delay = Math.min(
      30_000,
      1_000 * 2 ** Math.min(5, this.reconnectAttempt++)
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectPromise = this.#connect()
        .catch((error) => this.#connectionFailed(error))
        .finally(() => {
          this.connectPromise = null;
        });
    }, delay);
    this.reconnectTimer.unref?.();
  }

  #setStatus(value) {
    const changed = value !== this.statusValue;
    this.statusValue = value;
    this.statusUpdatedAt = new Date().toISOString();
    if (changed) this.emit("status", this.status());
  }

  #clearTimers() {
    for (const timer of [
      this.eventTimer,
      this.stateTimer,
      this.heartbeatTimer,
      this.reconnectTimer
    ]) {
      if (timer) clearTimeout(timer);
    }
    this.eventTimer = null;
    this.stateTimer = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
  }

  async #requestJson(url, options) {
    const response = await this.fetch(url, options);
    const text = await response.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    if (!response.ok) {
      const message =
        body?.error?.message ||
        body?.error ||
        `Requête Firebase refusée (${response.status}).`;
      const error = new Error(String(message));
      error.status = response.status;
      throw error;
    }
    return body;
  }
}

function isMissingFirebaseUser(error) {
  return /EMAIL_NOT_FOUND|USER_DISABLED|INVALID_LOGIN_CREDENTIALS/i.test(
    String(error?.message || "")
  );
}

module.exports = {
  PublicOverlayRelay,
  isMissingFirebaseUser
};
