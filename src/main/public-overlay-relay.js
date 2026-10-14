"use strict";

const { isCancelledRequest, isMissingFirebaseUser } = require("./relay/errors");

const crypto = require("node:crypto");
const { abortRequests, requestRelay, requestJson } = require("./relay/request-client");
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
  matchPublicSourcePath
} = require("./match-access");
const { readState, selectStatePaths } = require("./state-projection");
const { PRO_ACCESS_PATHS } = require("./pro-feature-access");
const { addPublicMatchWidgetUrls } = require("./relay/match-widgets");
const { MATCH_MESSAGE_CHANNELS } = require("./relay/match-messages");
const { MatchPublication } = require("./relay/match-publication");

const AUTH_BASE_URL = "https://identitytoolkit.googleapis.com/v1";
const TOKEN_BASE_URL = "https://securetoken.googleapis.com/v1";
const EVENT_BATCH_DELAY_MS = 4;
const STATE_DELAY_MS = 32;
const HEARTBEAT_MS = 45_000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_QUEUED_MESSAGES = 1_000;
const MAX_BATCH_MESSAGES = 250;
const CONFIGURATION_PATHS = ["settings.publicOverlayRelay"];
const MATCH_SOURCE_PATHS = [
  ...PRO_ACCESS_PATHS, "settings.overlayPort"
];
// Keep this projection aligned with createRelayState, not the complete local
// workspace (catalogues, chat history, secrets and other accounts stay local).
const RELAY_STATE_PATHS = [
  "goals", "session.running", "session.startedAt", "overlaySession",
  "settings.overlayScene", "commerce.subscription",
  ...["sessionEvents", "sessionActions", "sessionLikes", "sessionUniqueViewers",
    "lifetimeEvents", "likes", "gifts", "follows", "subscribers"]
    .map((key) => `statistics.${key}`)
];
const RELAY_CONTEXT_PATHS = [...new Set([
  ...CONFIGURATION_PATHS, ...MATCH_SOURCE_PATHS, ...RELAY_STATE_PATHS
])];

class PublicOverlayRelay extends EventEmitter {
  constructor({ store, fetchImpl = globalThis.fetch, appVersion = "", requestTimeoutMs = REQUEST_TIMEOUT_MS }) {
    super();
    if (typeof fetchImpl !== "function") {
      throw new TypeError("Une implémentation de fetch est requise.");
    }
    this.store = store;
    this.fetch = fetchImpl;
    this.requestTimeoutMs = Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0
      ? requestTimeoutMs : REQUEST_TIMEOUT_MS;
    this.requestControllers = new Map();
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
    this.stopPromise = null;
    this.rotating = false;
    this.eventQueue = [];
    this.pendingState = null;
    this.pendingStateRevision = 0;
    this.publishedState = null;
    this.publishedStateSignature = "";
    this.publicationPromise = Promise.resolve();
    // Une requête lente d'un autre overlay ne doit pas retenir un score ou une
    // réaction Match. Le canal dédié reste lui-même strictement sérialisé.
    this.matchPublisher = new MatchPublication({
      store, write: (...args) => this.#write(...args),
      configuration: () => this.configuration(), running: () => this.running,
      connected: () => this.connected, rotating: () => this.rotating,
      proAccess: hasProOverlayAccess, presence: (connected) => this.#presence(connected),
      onFailure: (error) => this.#connectionFailed(error), scheduleReconnect: () => this.#scheduleReconnect()
    });
    this.eventFlushPromise = null;
    this.stateFlushPromise = null;
    this.eventTimer = null;
    this.stateTimer = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.batchSequence = 0;
    this.#ensureConfiguration();
  }

  configuration() {
    return readState(this.store, CONFIGURATION_PATHS).settings?.publicOverlayRelay || {};
  }

  prepareConfiguration() {
    this.#ensureConfiguration();
    return this.configuration();
  }

  urls({ includeRestricted = false } = {}) {
    const state = readState(this.store, [...CONFIGURATION_PATHS, ...MATCH_SOURCE_PATHS]);
    const config = state.settings?.publicOverlayRelay || {};
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
    return addPublicMatchWidgetUrls(urls, { store: this.store, state, includeRestricted });
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

  stop() {
    if (this.stopPromise) return this.stopPromise;
    this.stopPromise = this.#stop().finally(() => { this.stopPromise = null; });
    return this.stopPromise;
  }

  async #stop() {
    const wasConnected = this.connected;
    this.running = false;
    this.#clearTimers();
    this.#abortRequests();
    await Promise.allSettled([this.publicationPromise, this.matchPublisher.promise, this.connectPromise, this.authPromise]);
    this.matchPublisher.clearQueue();
    if (wasConnected) {
      try {
        await Promise.all([
          this.#write({ presence: this.#presence(false) }),
          this.#writeMatchLink(false, { force: true, allowDuringRotation: true })
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
    if (!this.running) return;
    const config = this.configuration();
    if (config.enabled === false) return;
    if (MATCH_MESSAGE_CHANNELS.has(channel)) {
      this.matchPublisher.publish(channel, payload);
      return;
    }
    this.eventQueue.push(
      createRelayMessage(channel, payload, {
        baseUrl: config.publicBaseUrl
      })
    );
    if (this.eventQueue.length > MAX_QUEUED_MESSAGES) {
      this.eventQueue.splice(
        0,
        this.eventQueue.length - MAX_QUEUED_MESSAGES
      );
    }
    if (this.eventTimer || this.eventFlushPromise) return;
    this.eventTimer = setTimeout(() => {
      this.eventTimer = null;
      this.#flushEvents().catch((error) => this.#connectionFailed(error));
    }, EVENT_BATCH_DELAY_MS);
    this.eventTimer.unref?.();
  }

  publishState(state) {
    if (!this.running || this.configuration().enabled === false) return;
    // Read the latest owned projection only after coalescing. Explicit snapshots
    // retain historical API semantics without keeping a mutable caller reference.
    this.pendingState = state === undefined
      ? true
      : selectStatePaths(state, RELAY_STATE_PATHS);
    this.pendingStateRevision += 1;
    this.#scheduleStateFlush();
    this.matchPublisher.publishState();
  }

  #scheduleStateFlush() {
    if (this.stateTimer || this.stateFlushPromise) return;
    this.stateTimer = setTimeout(() => {
      this.stateTimer = null;
      this.#flushState().catch((error) => this.#connectionFailed(error));
    }, STATE_DELAY_MS);
    this.stateTimer.unref?.();
  }

  async rotateChannel() {
    const wasConnected = this.connected;
    this.connected = false;
    this.rotating = true;
    this.#clearTimers();
    this.#abortRequests();
    try {
      await Promise.allSettled([this.publicationPromise, this.matchPublisher.promise, this.connectPromise, this.authPromise]);
      if (wasConnected) {
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
      this.matchPublisher.clearQueue();
      this.publishedState = null;
      this.publishedStateSignature = "";
      this.matchPublisher.publishedSignature = "";
      this.pendingState = true;
      this.matchPublisher.pendingState = true;
      if (this.running && this.configuration().enabled !== false) {
        await this.#connect();
      }
      return {
        urls: this.urls(),
        status: this.status()
      };
    } finally {
      this.rotating = false;
    }
  }

  async rotateMatchChannel() {
    const currentChannel = this.configuration().matchChannelId;
    this.rotating = true;
    try {
      this.#abortRequests(currentChannel);
      await Promise.all([this.publicationPromise, this.matchPublisher.promise]);
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
      this.matchPublisher.clearQueue();
      if (this.running && this.configuration().enabled !== false) {
        await this.#writeMatchLink(true, { force: true, allowDuringRotation: true });
      }
    } finally {
      this.rotating = false;
    }
    await this.#flushState();
    await this.matchPublisher.flush();
    return {
      urls: this.urls(),
      status: this.status()
    };
  }

  #ensureConfiguration() {
    const current = this.configuration();
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
    if (!this.running) return;
    const context = readState(this.store, [...RELAY_CONTEXT_PATHS, "settings.overlayConfigs"]);
    const config = context.settings?.publicOverlayRelay || {};
    const state = createRelayState(context, { baseUrl: config.publicBaseUrl });
    const configurations = createPublicOverlayConfigurations(
      context,
      { baseUrl: config.publicBaseUrl }
    );
    await Promise.all([
      this.#write({
        ownerUid: config.uid,
        protocolVersion: PUBLIC_OVERLAY_PROTOCOL_VERSION,
        state,
        configurations,
        presence: this.#presence(true)
      }),
      this.#writeMatchLink(true, { force: true, allowDuringRotation: true, state: context })
    ]);
    this.publishedState = state;
    this.publishedStateSignature = this.#stateSignature(state, config);
    if (!this.running) return;
    this.connected = true;
    this.reconnectAttempt = 0;
    this.lastError = "";
    this.#setStatus("connected");
    this.#startHeartbeat();
    await Promise.all([this.#flushState(), this.#flushEvents(), this.matchPublisher.flush()]);
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
      } catch (error) {
        if (isCancelledRequest(error)) throw error;
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
    // Le canal Match utilise une fabrique : une authentification lente ou une
    // reprise 401 ne doit pas republier le profil ou les droits précédents.
    const publicationValues = typeof values === "function" ? values() : values;
    if (!publicationValues) return;
    const config = this.configuration();
    const response = await this.#request(
      `${relayDatabaseUrl(
        config.databaseUrl,
        channelId
      )}?auth=${encodeURIComponent(token)}&print=silent`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerUid: config.uid,
          protocolVersion: PUBLIC_OVERLAY_PROTOCOL_VERSION,
          ...publicationValues
        })
      },
      async (result) => ({
        ok: result.ok, status: result.status,
        detail: result.ok ? "" : (await result.text()).slice(0, 500)
      })
    );
    if ((response.status === 401 || response.status === 403) && retry) {
      this.idToken = "";
      await this.#ensureToken(true);
      return this.#write(values, false, channelId);
    }
    if (!response.ok) {
      const detail = response.detail;
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
    const response = await this.#request(
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

  #flushEvents() {
    if (this.eventFlushPromise) return this.eventFlushPromise;
    this.eventFlushPromise = this.#queuePublication(() => this.#flushEventsNow())
      .finally(() => { this.eventFlushPromise = null; });
    return this.eventFlushPromise;
  }

  async #flushEventsNow() {
    if (!this.running || !this.eventQueue.length) return;
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
    const stateRevision = this.pendingStateRevision;
    const context = readState(this.store, includesConfiguration
      ? [...RELAY_CONTEXT_PATHS, "settings.overlayConfigs"]
      : RELAY_CONTEXT_PATHS);
    const config = context.settings?.publicOverlayRelay || {};
    const state = createRelayState(context, { baseUrl: config.publicBaseUrl });
    const configurations = includesConfiguration
      ? createPublicOverlayConfigurations(context, {
          baseUrl: config.publicBaseUrl
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
      this.publishedStateSignature = this.#stateSignature(state, config);
      // The atomic batch includes the latest store state. An older pending
      // snapshot must not be replayed after it; a newer publication still wins.
      if (this.pendingState && stateRevision === this.pendingStateRevision) {
        this.pendingState = true;
      }
    } catch (error) {
      this.eventQueue.unshift(...messages);
      if (this.eventQueue.length > MAX_QUEUED_MESSAGES) {
        this.eventQueue.splice(0, this.eventQueue.length - MAX_QUEUED_MESSAGES);
      }
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

  #flushState() {
    if (this.stateFlushPromise) return this.stateFlushPromise;
    this.stateFlushPromise = this.#queuePublication(() => this.#flushStateNow())
      .finally(() => {
        this.stateFlushPromise = null;
        if (this.running && this.connected && this.pendingState) this.#scheduleStateFlush();
      });
    return this.stateFlushPromise;
  }

  async #flushStateNow() {
    if (!this.running || !this.pendingState || !this.connected) return;
    const pending = this.pendingState;
    const context = readState(this.store, RELAY_CONTEXT_PATHS);
    const config = context.settings?.publicOverlayRelay || {};
    const state = createRelayState(pending === true ? context : pending, {
      baseUrl: config.publicBaseUrl
    });
    const signature = this.#stateSignature(state, config);
    this.pendingState = null;
    try {
      if (signature !== this.publishedStateSignature) await this.#write({ state, presence: this.#presence(true) });
      this.publishedState = state;
      this.publishedStateSignature = signature;
    } catch (error) {
      // A newer state queued during a failed request must not be overwritten by
      // the older request's retry. Reconnect will also send the current snapshot.
      this.pendingState ||= pending;
      throw error;
    }
  }

  #queuePublication(callback) {
    const publication = this.publicationPromise.then(callback);
    this.publicationPromise = publication.catch(() => {});
    return publication;
  }

  #stateSignature(state, config) {
    return JSON.stringify([config.databaseUrl, config.channelId, config.uid, state]);
  }

  #startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (!this.running || !this.connected || this.rotating || this.configuration().enabled === false) return;
      // Chaque canal possède sa propre file. Les permissions Match sont relues
      // après sérialisation ; le heartbeat ne peut réappliquer un ancien score.
      this.#queuePublication(async () => {
        if (!this.running || !this.connected || this.rotating || this.configuration().enabled === false) return;
        await this.#write({ presence: this.#presence(true) });
      }).catch((error) => this.#connectionFailed(error));
      this.#writeMatchLink(true, { force: true }).catch((error) => this.#connectionFailed(error));
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

  #writeMatchLink(connected, options = {}) {
    return this.matchPublisher.writeLink(connected, options);
  }

  #connectionFailed(error) {
    if (!this.running || this.rotating) return;
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
      this.rotating ||
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
    this.matchPublisher.clearTimer();
  }

  #requestContext() {
    return {
      fetch: (...args) => this.fetch(...args),
      requestControllers: this.requestControllers,
      requestTimeoutMs: this.requestTimeoutMs
    };
  }

  #abortRequests(channelId = "") {
    return abortRequests(this.#requestContext(), channelId);
  }

  #request(url, options, readResponse) {
    return requestRelay(this.#requestContext(), url, options, readResponse);
  }

  #requestJson(url, options) {
    return requestJson(this.#requestContext(), url, options);
  }
}

module.exports = {
  PublicOverlayRelay,
  isMissingFirebaseUser
};
