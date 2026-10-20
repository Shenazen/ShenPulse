"use strict";

const { EventEmitter } = require("node:events");
const { readState } = require("./state-projection");
const { EVENTS: TIKTOK_MATCH_EVENTS, DECODED: TIKTOK_MATCH_DECODED, normalizeTikTokBattle, tiktokBattleEventKind } = require("./matches/tiktok-battle");
const { TikTokMatchClock } = require("./matches/tiktok-clock");
const { normalizeTikTokGiftBonus } = require("./matches/tiktok-gift-bonus");
const { tiktokMatchOwnerMetadata, reconcileTikTokOwnerMetadata } = require("./matches/tiktok-match-owner");
const { hasAuthenticatedAccount } = require("./account-access");
const tls = require("node:tls");
const {
  ControlEvent,
  TikTokLiveConnection,
  WebcastEvent
} = require("tiktok-live-connector");
const { normalizeEvent } = require("./event-normalizer");
const { safeString, serializeError } = require("./utils");

const {
  TIKTOK_REQUEST_POLLING_INTERVAL_MS,
  connectTikTokWhenLive,
  isTikTokOfflineError,
  parseTikTokRelayStatus,
  tiktokCurrentViewerCount,
  tiktokRelayLiveMetadata,
  tiktokRoomLiveMetadata,
  applyTikTokLikeDelta,
  shouldEmitTikTokEvent,
  tiktokDecodedEventType,
  tiktokDecodedPayload,
  tiktokDirectConnectionOptions,
  tiktokGiftIsFinal,
  tiktokConnectorPayload,
  tiktokSocialEventType,
  normalizeTikTokMetadataUsername,
  tiktokMetadataRoomId,
  friendlyTikTokError
} = require("./sources/tiktok-protocol");
const { parseTwitchLine } = require("./sources/twitch-protocol");
const { RelayChatDelivery } = require("./sources/relay-chat-delivery");
const { EulerOAuthChatDelivery } = require("./sources/euler-oauth-chat-delivery");
const { TikTokGiftDelivery } = require("./sources/tiktok-gift-delivery");

class SourceHub extends EventEmitter {
  constructor({ store, kickService = null, fetchFn = globalThis.fetch }) {
    super();
    this.store = store;
    this.runtimes = new Map();
    this.kickService = kickService;
    this.fetchFn = fetchFn;
    kickService?.on("event", (event) => this.emit("event", event));
    kickService?.on("diagnostic", (entry) => this.emit("diagnostic", entry));
    kickService?.on("live-status", ({ connectionId, live, viewers }) => {
      this.store.mutateRuntime((state) => {
        const connection = state.connections.find((entry) => entry.id === connectionId);
        if (connection) connection.liveStatus = live ? "live" : "offline";
      });
      this.emit("kick-status", { connectionId, live, viewers });
    });
  }

  async start(connectionId) {
    const connection = readState(this.store, ["connections"])
      .connections.find((item) => item.id === connectionId);
    if (!connection) throw new Error("Connexion introuvable.");
    await this.stop(connectionId);
    this.#status(connectionId, "connecting");
    try {
      if (connection.type === "demo") {
        this.#startDemo(connection);
        this.#status(connectionId, "connected");
      } else if (connection.type === "websocket") {
        this.#startWebSocket(connection);
      } else if (connection.type === "tiktok-relay") {
        this.#startWebSocket(connection, true);
      } else if (connection.type === "tiktok-direct") {
        this.#startTikTokDirect(connection);
      } else if (connection.type === "kick-native") {
        if (!this.kickService) throw new Error("Le service Kick est indisponible.");
        await this.kickService.start(connection);
        this.runtimes.set(connection.id, {
          closed: false,
          stop: () => this.kickService.stop(),
          send: (payload, options) => this.kickService.send(payload, options)
        });
        this.#status(connection.id, "connected");
      } else if (connection.type === "twitch-irc") this.#startTwitchIrc(connection);
      else throw new Error(`Type de source non pris en charge : ${connection.type}`);
      return { ok: true };
    } catch (error) {
      this.#status(connectionId, "error", error.message);
      if (["tiktok-direct", "tiktok-relay"].includes(connection.type)) {
        this.#tiktokStatus(connectionId, "error");
      }
      throw error;
    }
  }

  async stop(connectionId) {
    const connection = readState(this.store, ["connections"])
      .connections.find((item) => item.id === connectionId);
    const runtime = this.runtimes.get(connectionId);
    if (!runtime) {
      this.#status(connectionId, "disconnected");
      if (connection?.type === "kick-native") this.#kickDisconnected(connectionId);
      if (["tiktok-direct", "tiktok-relay"].includes(connection?.type)) {
        this.#tiktokStatus(connectionId, "disconnected");
      }
      return;
    }
    runtime.closed = true;
    if (runtime.timer) clearInterval(runtime.timer);
    if (runtime.reconnectTimer) clearTimeout(runtime.reconnectTimer);
    runtime.socket?.close?.();
    runtime.socket?.destroy?.();
    await runtime.stop?.();
    this.runtimes.delete(connectionId);
    this.#status(connectionId, "disconnected");
    if (connection?.type === "kick-native") this.#kickDisconnected(connectionId);
    if (["tiktok-direct", "tiktok-relay"].includes(connection?.type)) {
      this.#tiktokStatus(connectionId, "disconnected");
    }
  }

  async startEnabled() {
    const enabled = readState(this.store, ["connections"])
      .connections.filter((item) => item.enabled);
    const automatic = enabled.filter((item) => item.type !== "demo");
    const results = await Promise.allSettled(
      automatic.map((item) => this.start(item.id))
    );
    return results;
  }

  async stopAll() {
    await Promise.all([...this.runtimes.keys()].map((id) => this.stop(id)));
  }

  send(connectionId, payload, options) {
    const runtime = this.runtimes.get(connectionId);
    if (!runtime?.send) throw new Error("La connexion ne prend pas en charge l'envoi.");
    if (options?.shouldSend && !options.shouldSend()) throw new Error("L'envoi appartient à un compte ou un profil précédent.");
    return runtime.send(payload, options);
  }

  /** Capacités d'envoi sans exposer de clé, de jeton ou de session au renderer. */
  getChatCapabilities(connectionId) {
    const connection = readState(this.store, ["connections"]).connections.find((entry) => entry.id === connectionId);
    const runtime = this.runtimes.get(connectionId);
    if (!connection || connection.enabled !== true || !runtime || runtime.closed) return { canSend: false, transport: "none", reason: "disconnected", confirmation: "none", requiresAuthorization: false };
    if (connection.type === "tiktok-direct") {
      const capability = runtime.chatDelivery.status();
      if (!runtime.connector || runtime.connecting || connection.status !== "connected") return { ...capability, canSend: false, reason: "not-live" };
      return capability;
    }
    if (connection.type === "tiktok-relay") return { ...runtime.chatDelivery.status(), transport: "tiktok-relay",
      confirmation: "relay", reason: runtime.chatDelivery.canSend() ? "authorized-relay" : "relay-authorization-required",
      requiresAuthorization: !runtime.chatDelivery.authorized };
    if (connection.type === "kick-native" && this.kickService?.status) {
      const status = this.kickService.status();
      const missingScope = (status.scopesKnown === true || status.scopes?.length) && !status.scopes?.includes("chat:write");
      const canSend = connection.status === "connected" && status.connected === true && !missingScope;
      return { canSend, transport: "kick-native", confirmation: "platform",
        reason: missingScope ? "kick-scope-missing" : status.connected ? "connected" : "kick-authorization-required",
        requiresAuthorization: !status.connected || Boolean(missingScope) };
    }
    const canSend = connection.status === "connected" && typeof runtime.send === "function";
    return { canSend, transport: connection.type, reason: canSend ? "connected" : "disconnected",
      confirmation: connection.type === "kick-native" ? "platform" : "socket", requiresAuthorization: false };
  }

  refreshChatCapabilities(connectionId = "source_tiktok") {
    const capability = this.getChatCapabilities(connectionId);
    this.emit("chat-capabilities", { connectionId, ...capability });
    return capability;
  }

  /** Annule les envois en attente sans arrêter la réception du LIVE. */
  resetChatDelivery(connectionId = "source_tiktok") {
    this.runtimes.get(connectionId)?.chatDelivery?.reset();
  }

  #tiktokChatSession() {
    const state = readState(this.store, ["settings.tiktok.chat", "settings.account"]);
    const config = state.settings?.tiktok?.chat || { provider: "none" };
    const accountUid = state.settings?.account?.uid || "";
    const authenticated = hasAuthenticatedAccount(this.store);
    const ownCredentials = authenticated && config.provider === "euler-oauth" && config.accountUid === accountUid;
    return { config, accountUid, authenticated,
      apiKey: ownCredentials && config.apiKeySecretId ? this.store.getSecret(config.apiKeySecretId) : "",
      accessToken: ownCredentials && config.accessTokenSecretId ? this.store.getSecret(config.accessTokenSecretId) : "" };
  }

  #startDemo(connection) {
    const runtime = { closed: false };
    runtime.send = (payload) => {
      this.emit("event", normalizeEvent(payload, connection.id));
      return { sent: true };
    };
    this.runtimes.set(connection.id, runtime);
  }

  #startTikTokDirect(connection) {
    const username = safeString(connection.config?.username, 80)
      .trim()
      .replace(/^@+/, "");
    if (!username) throw new Error("Le @ TikTok est requis.");

    const runtime = {
      attempts: 0,
      closed: false,
      connecting: false,
      connector: null,
      lastEventStatusAt: 0,
      lastTotalLikes: 0,
      seenLikeEventIds: new Set(),
      seenTikTokEventIds: new Set(),
      seenTikTokEventObjects: new WeakMap(),
      giftDelivery: new TikTokGiftDelivery(),
      reconnectTimer: null,
      matchClock: new TikTokMatchClock(),
      detachMatchClock: null,
      verifiedMatchOwner: null,
      matchOwnerConflict: false,
      stop: async () => {
        runtime.verifiedMatchOwner = null; runtime.matchOwnerConflict = false;
        runtime.detachMatchClock?.(); runtime.detachMatchClock = null; runtime.matchClock.reset();
        runtime.chatDelivery.reset();
        const connector = runtime.connector;
        runtime.connector = null;
        connector?.removeAllListeners?.();
        await connector?.disconnect?.().catch(() => {});
      }
    };
    runtime.chatDelivery = new EulerOAuthChatDelivery({ getSession: () => this.#tiktokChatSession(), fetchFn: this.fetchFn });
    runtime.send = (payload, { shouldSend = () => true } = {}) => {
      const connector = runtime.connector;
      const roomId = String(runtime.roomId || connector?.roomId || "");
      return runtime.chatDelivery.send(roomId, payload, { shouldSend: () => shouldSend() && !runtime.closed &&
        this.runtimes.get(connection.id) === runtime && runtime.connector === connector && !runtime.connecting &&
        String(runtime.roomId || connector?.roomId || "") === roomId });
    };

    const emitEvent = (type, event) => {
      if (runtime.closed) return;
      if (type !== "gift" && !shouldEmitTikTokEvent(runtime, type, event)) return;
      let payload = tiktokConnectorPayload(type, event, username);
      payload.roomId = String(runtime.roomId || runtime.connector?.roomId || "");
      if (type === "gift") payload = runtime.giftDelivery.accept(event, payload);
      if (type === "like") payload = applyTikTokLikeDelta(runtime, payload);
      if (!payload) return;
      const now = Date.now();
      if (now - runtime.lastEventStatusAt >= 1000) {
        runtime.lastEventStatusAt = now;
        this.#tiktokStatus(connection.id, "live", {
          lastEventAt: new Date(now).toISOString()
        });
      }
      this.emit(
        "event",
        normalizeEvent({ event: type, data: payload }, connection.id)
      );
    };

    const scheduleReconnect = (fast = false) => {
      if (runtime.closed || runtime.reconnectTimer) return;
      runtime.attempts += 1;
      const delay = fast
        ? 3000
        : Math.min(30000, 5000 * 2 ** Math.min(runtime.attempts - 1, 3));
      runtime.reconnectTimer = setTimeout(() => {
        runtime.reconnectTimer = null;
        connect().catch((error) => {
          this.emit("diagnostic", {
            level: "warning",
            source: connection.id,
            message: friendlyTikTokError(error, username)
          });
          scheduleReconnect();
        });
      }, delay);
    };

    const connectionDropped = (connector, reason) => {
      if (runtime.closed || runtime.connector !== connector) return;
      runtime.detachMatchClock?.(); runtime.detachMatchClock = null; runtime.matchClock.reset();
      runtime.connector = null;
      runtime.connecting = false;
      runtime.roomId = "";
      runtime.verifiedMatchOwner = null; runtime.matchOwnerConflict = false;
      runtime.chatDelivery.reset();
      connector.removeAllListeners?.();
      connector.disconnect?.().catch(() => {});
      this.#status(connection.id, "reconnecting", reason);
      this.#tiktokStatus(connection.id, "offline");
      this.refreshChatCapabilities(connection.id);
      scheduleReconnect(true);
    };

    const applyOwnerMetadata = (metadata) => {
      const result = reconcileTikTokOwnerMetadata(metadata, runtime,
        readState(this.store, ["settings.tiktok"]).settings?.tiktok, username);
      runtime.verifiedMatchOwner = result.cache; runtime.matchOwnerConflict = result.conflict;
      if (result.metadata) this.#tiktokLiveMetadata(connection.id, runtime, username, result.metadata);
      return result.metadata;
    };
    const bind = (connector) => {
      const isCurrent = () => !runtime.closed && runtime.connector === connector &&
        this.runtimes.get(connection.id) === runtime;
      const emitCurrentEvent = (type, event) => {
        if (isCurrent()) emitEvent(type, event);
      };
      const emitCurrentMatch = (kind, event) => {
        if (!isCurrent()) return;
        const match = normalizeTikTokBattle(kind, event, { roomId: runtime.roomId || connector.roomId, channelUsername: username,
          clockOffsetMs: runtime.matchClock.offsetMs });
        if (match) {
          const metadata = match.phase === "start" ? tiktokMatchOwnerMetadata(event,
            { roomId: runtime.roomId || connector.roomId, channelUsername: username }) : null;
          if (metadata) applyOwnerMetadata(metadata);
          // A reconnect can replay the same OPEN while its owner cache was
          // cleared. Re-establish exact identity without replaying the match.
          if (shouldEmitTikTokEvent(runtime, kind, event)) this.emit("match-event", { ...match, source: connection.id });
        }
      };
      const emitCurrentGiftBonus = (event) => {
        if (!isCurrent()) return;
        const match = normalizeTikTokGiftBonus(event, { roomId: runtime.roomId || connector.roomId,
          channelUsername: username, clockOffsetMs: runtime.matchClock.offsetMs });
        if (match && shouldEmitTikTokEvent(runtime, "giftBonus", event)) this.emit("match-event", { ...match, source: connection.id });
      };
      connector.on(ControlEvent.WEBSOCKET_CONNECTED, (client) => {
        if (!isCurrent() || typeof client?.prependListener !== "function") return;
        runtime.detachMatchClock?.();
        const observeClock = (batch) => { if (isCurrent()) runtime.matchClock.observe(batch?.now, Date.now()); };
        // The SDK exposes its decoded container before dispatching messages.
        // Read only its server clock; no duplicate decoding or extra request.
        client.prependListener("protoMessageFetchResult", observeClock);
        runtime.detachMatchClock = () => client.removeListener("protoMessageFetchResult", observeClock);
      });
      for (const kind of Object.keys(TIKTOK_MATCH_EVENTS)) connector.on(kind, (event) => emitCurrentMatch(kind, event));
      connector.on(WebcastEvent.GIFT, (event) => {
        emitCurrentGiftBonus(event);
        emitCurrentEvent("gift", event);
      });
      connector.on(WebcastEvent.LIKE, (event) => emitCurrentEvent("like", event));
      connector.on(WebcastEvent.CHAT, (event) => emitCurrentEvent("chat", event));
      connector.on(WebcastEvent.FOLLOW, (event) => emitCurrentEvent("follow", event));
      connector.on(WebcastEvent.SHARE, (event) => emitCurrentEvent("share", event));
      connector.on(WebcastEvent.SOCIAL, (event) => {
        const type = tiktokSocialEventType(event);
        if (type) emitCurrentEvent(type, event);
      });
      connector.on(WebcastEvent.MEMBER, (event) => emitCurrentEvent("join", event));
      connector.on(WebcastEvent.ROOM_USER, (event) => {
        if (!isCurrent()) return;
        const currentViewers = tiktokCurrentViewerCount(event);
        if (currentViewers === null) return;
        if (this.#tiktokLiveMetadata(connection.id, runtime, username, {
          roomId: tiktokMetadataRoomId(event), currentViewers
        })) runtime.roomUserReceived = true;
      });
      connector.on(ControlEvent.DECODED_DATA, (messageType, decoded) => {
        const event = tiktokDecodedPayload(decoded);
        queueMicrotask(() => {
          if (TIKTOK_MATCH_DECODED[messageType]) { emitCurrentMatch(TIKTOK_MATCH_DECODED[messageType], event); return; }
          const type = tiktokDecodedEventType(messageType, event);
          if (type === "gift") emitCurrentGiftBonus(event);
          if (!type) return;
          emitCurrentEvent(type, event);
        });
      });
      connector.on(WebcastEvent.STREAM_END, () =>
        connectionDropped(connector, "Le LIVE est terminé.")
      );
      connector.on(ControlEvent.ERROR, (error) => {
        if (runtime.closed || runtime.connector !== connector) return;
        this.emit("diagnostic", {
          level: "warning",
          source: connection.id,
          message: friendlyTikTokError(error, username)
        });
      });
      connector.on(ControlEvent.DISCONNECTED, () =>
        connectionDropped(connector, "Connexion TikTok interrompue.")
      );
    };

    const connect = async () => {
      if (runtime.closed || runtime.connecting || runtime.connector) return;
      runtime.connecting = true;
      runtime.roomUserReceived = false;
      this.#status(
        connection.id,
        runtime.attempts ? "reconnecting" : "connecting"
      );
      this.#tiktokStatus(connection.id, "checking");

      const connector = new TikTokLiveConnection(
        username,
        tiktokDirectConnectionOptions()
      );
      runtime.verifiedMatchOwner = null; runtime.matchOwnerConflict = false;
      runtime.matchClock.reset();
      runtime.connector = connector;
      bind(connector);

      try {
        const state = await connectTikTokWhenLive(connector);
        if (runtime.closed || runtime.connector !== connector) {
          connector.removeAllListeners?.();
          await connector.disconnect?.().catch(() => {});
          return;
        }
        runtime.connecting = false;
        runtime.attempts = 0;
        runtime.roomId = String(state?.roomId || state?.roomInfo?.roomId || connector.roomId || "");
        this.#status(connection.id, "connected");
        this.#tiktokStatus(connection.id, "live", { roomId: runtime.roomId });
        if (runtime.verifiedMatchOwner?.roomId !== runtime.roomId) runtime.verifiedMatchOwner = null;
        if (runtime.verifiedMatchOwner && !runtime.matchOwnerConflict) {
          this.#tiktokLiveMetadata(connection.id, runtime, username, runtime.verifiedMatchOwner);
        }
        this.refreshChatCapabilities(connection.id);
        const roomId = runtime.roomId;
        const applyRoomInfo = (roomInfo) => {
          if (runtime.closed || runtime.connector !== connector) return;
          const metadata = tiktokRoomLiveMetadata(roomInfo, username, roomId);
          // A push update received meanwhile is newer than the HTTP room snapshot.
          if (metadata && runtime.roomUserReceived) delete metadata.currentViewers;
          return applyOwnerMetadata(metadata);
        };
        const roomInfo = state?.roomInfo || connector.roomInfo;
        const initialMetadata = roomInfo ? applyRoomInfo(roomInfo) : null;
        if (!initialMetadata?.broadcaster?.avatarUrl && typeof connector.fetchRoomInfo === "function") {
          // Missing artwork must never hold up LIVE monitoring. No extra polling:
          // the connector normally includes this information during connect().
          Promise.resolve().then(() => connector.fetchRoomInfo())
            .then(applyRoomInfo).catch(() => {});
        }
      } catch (error) {
        if (runtime.closed || runtime.connector !== connector) return;
        runtime.connecting = false;
        runtime.connector = null;
        runtime.verifiedMatchOwner = null; runtime.matchOwnerConflict = false;
        connector.removeAllListeners?.();
        await connector.disconnect?.().catch(() => {});
        const offline = isTikTokOfflineError(error);
        const message = friendlyTikTokError(error, username);
        this.#status(connection.id, "reconnecting", message);
        this.#tiktokStatus(connection.id, offline ? "offline" : "error");
        this.emit("diagnostic", {
          level: offline ? "info" : "warning",
          source: connection.id,
          message
        });
        scheduleReconnect();
      }
    };

    this.runtimes.set(connection.id, runtime);
    connect().catch((error) => {
      this.emit("diagnostic", {
        level: "warning",
        source: connection.id,
        message: friendlyTikTokError(error, username)
      });
      scheduleReconnect();
    });
  }

  #startWebSocket(connection, isTikTok = false) {
    const url = String(connection.config?.url || "");
    if (!/^wss?:\/\/(?:127\.0\.0\.1|localhost|\[::1\]|[^/]+)/i.test(url)) {
      throw new Error("URL WebSocket invalide.");
    }
    const runtime = {
      closed: false,
      socket: null,
      reconnectTimer: null,
      attempts: 0,
      send: (payload, { shouldSend = () => true } = {}) => {
        if (runtime.closed || !shouldSend() || this.runtimes.get(connection.id) !== runtime) throw new Error("L'envoi n'appartient plus à la connexion active.");
        if (runtime.socket?.readyState !== 1) {
          throw new Error("WebSocket non connecté.");
        }
        runtime.socket.send(JSON.stringify(payload));
        // Compatibilité des actions génériques ; le ChatBot distingue ce simple
        // transfert d'un accusé d'acceptation de la plateforme.
        return { sent: true, forwarded: true, acknowledged: false, confirmation: "socket" };
      }
    };
    if (isTikTok) {
      runtime.chatDelivery = new RelayChatDelivery({ getSocket: () => runtime.socket,
        getRoomId: () => runtime.liveStatus === "live" ? runtime.roomId : "", isCurrent: () => !runtime.closed && this.runtimes.get(connection.id) === runtime,
        onChanged: () => this.refreshChatCapabilities(connection.id) });
      runtime.send = (payload, options) => runtime.chatDelivery.send(payload, options);
      runtime.stop = () => runtime.chatDelivery.reset();
    }
    const username = safeString(connection.config?.username, 80).trim().replace(/^@+/, "");
    const connect = () => {
      if (runtime.closed) return;
      runtime.liveStatus = "checking";
      runtime.chatDelivery?.reset();
      const headers = {};
      const secret = connection.secretId
        ? this.store.getSecret(connection.secretId)
        : "";
      const targetUrl = new URL(url);
      if (secret) targetUrl.searchParams.set(connection.config?.tokenParameter || "token", secret);
      const socket = new WebSocket(targetUrl);
      runtime.socket = socket;
      const isCurrent = () => !runtime.closed && runtime.socket === socket &&
        this.runtimes.get(connection.id) === runtime;
      socket.addEventListener("open", () => {
        if (!isCurrent()) return;
        runtime.attempts = 0;
        this.#status(connection.id, "connected");
        if (isTikTok) {
          socket.send(JSON.stringify({
            action: "subscribe",
            platform: "tiktok",
            username
          }));
          this.#tiktokStatus(connection.id, "checking");
          runtime.chatDelivery.requestCapabilities();
        }
      });
      socket.addEventListener("message", (event) => {
        if (!isCurrent()) return;
        try {
          const raw = JSON.parse(String(event.data));
          if (isTikTok) {
            if (runtime.chatDelivery.handle(raw)) return;
            const liveStatus = parseTikTokRelayStatus(raw);
            const data = raw.data && typeof raw.data === "object" ? raw.data : raw;
            const kind = safeString(raw.event || raw.type || raw.action || data.event || data.type, 80)
              .replace(/[^a-z]/gi, "").toLowerCase();
            const matchKind = tiktokBattleEventKind(kind) || (kind === "decodeddata" ? tiktokBattleEventKind(data.type) : "");
            if (matchKind) {
              // Même canal dédié que le connecteur direct : un match n'est
              // jamais transformé en chat/cadeau, ni reçu d'un WebSocket générique.
              if (!runtime.roomId) return;
              const packet = tiktokDecodedPayload(data);
              const match = normalizeTikTokBattle(matchKind, packet, { roomId: runtime.roomId, channelUsername: username });
              if (!match || !shouldEmitTikTokEvent(runtime, matchKind, packet)) return;
              this.#tiktokStatus(connection.id, "live", { lastEventAt: new Date().toISOString() });
              runtime.liveStatus = "live";
              this.emit("match-event", { ...match, source: connection.id });
              return;
            }
            const roomPayload = data.roomInfo?.data || data.roomInfo || data;
            const reportedRoomId = tiktokMetadataRoomId(roomPayload) ||
              (kind === "roominfo" ? safeString(roomPayload.id_str || roomPayload.id || "", 160) : "");
            // Only an explicit LIVE status may bind the relay to the next room.
            // Late stats/end/room-info packets from the preceding room are ignored.
            if (runtime.roomId && reportedRoomId && runtime.roomId !== reportedRoomId &&
                !(liveStatus?.status === "live" && kind !== "roominfo")) return;
            if (liveStatus) {
              runtime.liveStatus = liveStatus.status;
              if (liveStatus.status === "live" && liveStatus.roomId) {
                if (runtime.roomId && runtime.roomId !== liveStatus.roomId) runtime.chatDelivery.cancelPending();
                runtime.roomId = liveStatus.roomId;
              }
              if (liveStatus.status !== "live") runtime.chatDelivery.cancelPending();
              this.#tiktokStatus(connection.id, liveStatus.status, liveStatus);
              this.refreshChatCapabilities(connection.id);
              if (liveStatus.status === "live") {
                const metadata = tiktokRelayLiveMetadata(raw, username);
                if (metadata) this.#tiktokLiveMetadata(connection.id, runtime, username, metadata);
              }
              return;
            }
            this.#tiktokStatus(connection.id, "live", {
              lastEventAt: new Date().toISOString()
            });
            runtime.liveStatus = "live";
            const metadata = tiktokRelayLiveMetadata(raw, username);
            if (metadata) {
              this.#tiktokLiveMetadata(connection.id, runtime, username, metadata);
              return;
            }
          }
          this.emit("event", normalizeEvent(raw, connection.id));
        } catch (error) {
          this.emit("diagnostic", {
            level: "warning",
            source: connection.id,
            message: `Message WebSocket ignoré : ${error.message}`
          });
        }
      });
      socket.addEventListener("error", () => {
        if (!isCurrent()) return;
        runtime.chatDelivery?.reset();
        runtime.liveStatus = "error";
        this.#status(connection.id, "error", "Erreur WebSocket.");
        if (isTikTok) this.#tiktokStatus(connection.id, "error");
      });
      socket.addEventListener("close", () => {
        if (!isCurrent()) return;
        runtime.attempts += 1;
        runtime.chatDelivery?.reset();
        runtime.liveStatus = "disconnected";
        this.#status(connection.id, "reconnecting");
        if (isTikTok) this.#tiktokStatus(connection.id, "disconnected");
        const delay = Math.min(30000, 1000 * 2 ** Math.min(runtime.attempts, 5));
        runtime.reconnectTimer = setTimeout(connect, delay);
      });
    };
    this.runtimes.set(connection.id, runtime);
    connect();
  }

  #startTwitchIrc(connection) {
    const channel = safeString(connection.config?.channel, 80)
      .replace(/^#/, "")
      .toLowerCase();
    const username = safeString(connection.config?.username, 80).toLowerCase();
    const oauth = connection.secretId ? this.store.getSecret(connection.secretId) : "";
    if (!channel || !username || !oauth) {
      throw new Error("Chaîne, utilisateur et jeton OAuth Twitch requis.");
    }
    const runtime = { closed: false, socket: null };
    const socket = tls.connect(
      { host: "irc.chat.twitch.tv", port: 6697, servername: "irc.chat.twitch.tv" },
      () => {
        socket.write(`PASS ${oauth.startsWith("oauth:") ? oauth : `oauth:${oauth}`}\r\n`);
        socket.write(`NICK ${username}\r\n`);
        socket.write("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership\r\n");
        socket.write(`JOIN #${channel}\r\n`);
      }
    );
    runtime.socket = socket;
    runtime.send = (payload, { shouldSend = () => true } = {}) => {
      if (runtime.closed || !shouldSend() || this.runtimes.get(connection.id) !== runtime || socket.destroyed) throw new Error("Connexion Twitch indisponible pour l'envoi.");
      const message = safeString(payload.message || payload, 450).replace(/[\r\n]/g, " ");
      socket.write(`PRIVMSG #${channel} :${message}\r\n`);
      return { sent: true, forwarded: true, acknowledged: false, confirmation: "socket" };
    };
    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\r\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("PING ")) {
          socket.write(line.replace("PING", "PONG") + "\r\n");
          continue;
        }
        const parsed = parseTwitchLine(line);
        if (parsed) this.emit("event", normalizeEvent(parsed, connection.id));
      }
    });
    socket.on("secureConnect", () => this.#status(connection.id, "connected"));
    socket.on("error", (error) => {
      this.emit("diagnostic", {
        level: "error",
        source: connection.id,
        message: serializeError(error).message
      });
      this.#status(connection.id, "error", error.message);
    });
    socket.on("close", () => {
      if (!runtime.closed) this.#status(connection.id, "disconnected");
    });
    this.runtimes.set(connection.id, runtime);
  }

  #tiktokStatus(connectionId, status, details = {}) {
    const now = new Date().toISOString();
    let payload = {};
    let changed = false;
    this.store.mutateRuntime((state) => {
      const connection = state.connections.find((item) => item.id === connectionId);
      const primary = state.connections.find((item) => item.id === "source_tiktok");
      if (primary && primary.id !== connectionId) {
        if (connection) {
          connection.liveStatus = status;
          if (details.roomId) connection.roomId = safeString(details.roomId, 160);
        }
        return;
      }
      const username =
        connection?.config?.username || state.settings.tiktok?.username || "";
      const previousUsername = state.settings.tiktok?.username || "";
      const previousStatus = state.settings.tiktok?.status;
      const previousRoomId = state.settings.tiktok?.roomId || "";
      const reportedRoomId = Object.prototype.hasOwnProperty.call(
        details,
        "roomId"
      )
        ? safeString(details.roomId || "", 160)
        : "";
      // TikTok et certains relais omettent la salle pendant une coupure.
      // Elle reste pourtant l'identité fiable qui permet de distinguer une
      // reconnexion du même LIVE du démarrage du LIVE suivant.
      const sameUsername = normalizeTikTokMetadataUsername(username) ===
        normalizeTikTokMetadataUsername(previousUsername);
      const roomId = reportedRoomId || (sameUsername ? previousRoomId : "");
      const clearMetadata = status !== "live" || !sameUsername || previousRoomId !== roomId;
      changed =
        previousStatus !== status ||
        previousRoomId !== roomId || !sameUsername;
      state.settings.tiktok = {
        ...(state.settings.tiktok || {}),
        username,
        status,
        roomId,
        broadcaster: clearMetadata ? null : state.settings.tiktok?.broadcaster || null,
        currentViewers: clearMetadata ? null : state.settings.tiktok?.currentViewers ?? null,
        lastCheckedAt: now,
        lastEventAt: details.lastEventAt || state.settings.tiktok?.lastEventAt || ""
      };
      if (connection) {
        connection.liveStatus = status;
        connection.roomId = state.settings.tiktok.roomId;
        if (details.lastEventAt) connection.lastEventAt = details.lastEventAt;
      }
      payload = {
        connectionId,
        status,
        username,
        roomId: state.settings.tiktok.roomId,
        lastEventAt: state.settings.tiktok.lastEventAt
      };
    });
    if (changed) this.emit("tiktok-status", payload);
  }

  #tiktokLiveMetadata(connectionId, runtime, username, details) {
    if (runtime.closed || this.runtimes.get(connectionId) !== runtime) return false;
    const state = readState(this.store, ["connections", "settings.tiktok"]);
    const connection = state.connections.find((item) => item.id === connectionId);
    const primary = state.connections.find((item) => item.id === "source_tiktok");
    const tiktok = state.settings.tiktok || {};
    if (!connection || (primary && primary.id !== connectionId) ||
        connection.status !== "connected" || tiktok.status !== "live" ||
        normalizeTikTokMetadataUsername(connection.config?.username) !== normalizeTikTokMetadataUsername(username) ||
        normalizeTikTokMetadataUsername(tiktok.username) !== normalizeTikTokMetadataUsername(username) ||
        (details.roomId && details.roomId !== tiktok.roomId)) return false;
    const broadcaster = Object.prototype.hasOwnProperty.call(details, "broadcaster")
      ? details.broadcaster : tiktok.broadcaster || null;
    const currentViewers = Object.prototype.hasOwnProperty.call(details, "currentViewers")
      ? details.currentViewers : tiktok.currentViewers ?? null;
    if (JSON.stringify(broadcaster) === JSON.stringify(tiktok.broadcaster || null) &&
        currentViewers === (tiktok.currentViewers ?? null)) return true;
    this.store.mutateRuntime((current) => {
      current.settings.tiktok.broadcaster = broadcaster;
      current.settings.tiktok.currentViewers = currentViewers;
    });
    this.emit("tiktok-live-metadata", { connectionId, broadcaster, currentViewers });
    return true;
  }

  #kickDisconnected(connectionId) {
    this.store.mutateRuntime((state) => {
      state.settings.kick = { ...(state.settings.kick || {}), live: false };
      const connection = state.connections.find((entry) => entry.id === connectionId);
      if (connection) connection.liveStatus = "disconnected";
    });
    this.emit("kick-status", { connectionId, live: false });
  }

  #status(connectionId, status, error = "") {
    this.store.mutateRuntime((state) => {
      const connection = state.connections.find((item) => item.id === connectionId);
      if (connection) {
        connection.status = status;
        connection.error = safeString(error, 500);
        connection.lastChangedAt = new Date().toISOString();
      }
    });
    this.emit("status", { connectionId, status, error });
  }
}


module.exports = {
  TIKTOK_REQUEST_POLLING_INTERVAL_MS,
  SourceHub,
  connectTikTokWhenLive,
  isTikTokOfflineError,
  parseTikTokRelayStatus,
  tiktokCurrentViewerCount,
  tiktokRelayLiveMetadata,
  tiktokRoomLiveMetadata,
  parseTwitchLine,
  applyTikTokLikeDelta,
  shouldEmitTikTokEvent,
  tiktokDecodedEventType,
  tiktokDecodedPayload,
  tiktokDirectConnectionOptions,
  tiktokGiftIsFinal,
  tiktokConnectorPayload,
  tiktokSocialEventType
};
