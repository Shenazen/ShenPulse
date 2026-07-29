"use strict";

const { EventEmitter } = require("node:events");
const tls = require("node:tls");
const {
  ControlEvent,
  TikTokLiveConnection,
  WebcastEvent
} = require("tiktok-live-connector");
const { normalizeEvent } = require("./event-normalizer");
const { preferredImageUrl, safeString, serializeError } = require("./utils");

const DEMO_EVENTS = [
  {
    event: "join",
    data: { uniqueId: "luna_live", nickname: "Luna" }
  },
  {
    event: "like",
    data: { uniqueId: "luna_live", nickname: "Luna", likeCount: 25 }
  },
  {
    event: "gift",
    data: {
      uniqueId: "nox_player",
      nickname: "Nox",
      giftId: "rose",
      giftName: "Rose",
      repeatCount: 1,
      value: 1
    }
  },
  {
    event: "chat",
    data: {
      uniqueId: "pixel_ade",
      nickname: "Pixel",
      comment: "Cette interaction est incroyable !"
    }
  },
  {
    event: "follow",
    data: { uniqueId: "nova_fr", nickname: "Nova" }
  },
  {
    event: "gift",
    data: {
      uniqueId: "orbit_tv",
      nickname: "Orbit",
      giftId: "galaxy",
      giftName: "Galaxy",
      repeatCount: 5,
      value: 500
    }
  }
];

class SourceHub extends EventEmitter {
  constructor({ store }) {
    super();
    this.store = store;
    this.runtimes = new Map();
  }

  async start(connectionId) {
    const connection = this.store
      .getState()
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
    const connection = this.store
      .getState()
      .connections.find((item) => item.id === connectionId);
    const runtime = this.runtimes.get(connectionId);
    if (!runtime) {
      this.#status(connectionId, "disconnected");
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
    if (["tiktok-direct", "tiktok-relay"].includes(connection?.type)) {
      this.#tiktokStatus(connectionId, "disconnected");
    }
  }

  async startEnabled() {
    const enabled = this.store
      .getState()
      .connections.filter((item) => item.enabled);
    const results = await Promise.allSettled(enabled.map((item) => this.start(item.id)));
    return results;
  }

  async stopAll() {
    await Promise.all([...this.runtimes.keys()].map((id) => this.stop(id)));
  }

  send(connectionId, payload) {
    const runtime = this.runtimes.get(connectionId);
    if (!runtime?.send) throw new Error("La connexion ne prend pas en charge l'envoi.");
    return runtime.send(payload);
  }

  #startDemo(connection) {
    let index = 0;
    const runtime = { closed: false, timer: null };
    const emitNext = () => {
      const raw = DEMO_EVENTS[index % DEMO_EVENTS.length];
      index += 1;
      this.emit("event", normalizeEvent(raw, connection.id));
    };
    runtime.timer = setInterval(
      emitNext,
      Math.max(1500, Number(connection.config?.intervalMs || 5000))
    );
    runtime.send = (payload) => {
      this.emit("event", normalizeEvent(payload, connection.id));
      return { sent: true };
    };
    this.runtimes.set(connection.id, runtime);
    setTimeout(emitNext, 500);
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
      reconnectTimer: null,
      stop: async () => {
        const connector = runtime.connector;
        runtime.connector = null;
        connector?.removeAllListeners?.();
        await connector?.disconnect?.().catch(() => {});
      }
    };

    const emitEvent = (type, event) => {
      if (runtime.closed) return;
      const now = Date.now();
      if (now - runtime.lastEventStatusAt >= 1000) {
        runtime.lastEventStatusAt = now;
        this.#tiktokStatus(connection.id, "live", {
          lastEventAt: new Date(now).toISOString()
        });
      }
      let payload = tiktokConnectorPayload(type, event, username);
      if (type === "like") {
        payload = applyTikTokLikeDelta(runtime, payload);
        if (!payload) return;
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
      runtime.connector = null;
      runtime.connecting = false;
      connector.removeAllListeners?.();
      connector.disconnect?.().catch(() => {});
      this.#status(connection.id, "reconnecting", reason);
      this.#tiktokStatus(connection.id, "offline");
      scheduleReconnect(true);
    };

    const bind = (connector) => {
      connector.on(WebcastEvent.GIFT, (event) => {
        if (tiktokGiftIsFinal(event)) emitEvent("gift", event);
      });
      connector.on(WebcastEvent.LIKE, (event) => emitEvent("like", event));
      connector.on(WebcastEvent.CHAT, (event) => emitEvent("chat", event));
      connector.on(WebcastEvent.FOLLOW, (event) => emitEvent("follow", event));
      connector.on(WebcastEvent.SHARE, (event) => emitEvent("share", event));
      connector.on(WebcastEvent.MEMBER, (event) => emitEvent("join", event));
      connector.on(ControlEvent.DECODED_DATA, (messageType, event) => {
        if (messageType === "WebcastSubNotifyMessage") {
          emitEvent("subscribe", event);
        }
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
      this.#status(
        connection.id,
        runtime.attempts ? "reconnecting" : "connecting"
      );
      this.#tiktokStatus(connection.id, "checking");

      const connector = new TikTokLiveConnection(username, {
        enableExtendedGiftInfo: false,
        processInitialData: false
      });
      runtime.connector = connector;
      bind(connector);

      try {
        const state = await connector.connect();
        if (runtime.closed || runtime.connector !== connector) {
          connector.removeAllListeners?.();
          await connector.disconnect?.().catch(() => {});
          return;
        }
        runtime.connecting = false;
        runtime.attempts = 0;
        this.#status(connection.id, "connected");
        this.#tiktokStatus(connection.id, "live", {
          roomId: String(
            state?.roomId ||
              state?.roomInfo?.roomId ||
              connector.roomId ||
              ""
          )
        });
      } catch (error) {
        if (runtime.closed) return;
        runtime.connecting = false;
        runtime.connector = null;
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
      send: (payload) => {
        if (runtime.socket?.readyState !== 1) {
          throw new Error("WebSocket non connecté.");
        }
        runtime.socket.send(JSON.stringify(payload));
        return { sent: true };
      }
    };
    const connect = () => {
      if (runtime.closed) return;
      const headers = {};
      const secret = connection.secretId
        ? this.store.getSecret(connection.secretId)
        : "";
      const targetUrl = new URL(url);
      if (secret) targetUrl.searchParams.set(connection.config?.tokenParameter || "token", secret);
      const socket = new WebSocket(targetUrl);
      runtime.socket = socket;
      socket.addEventListener("open", () => {
        runtime.attempts = 0;
        this.#status(connection.id, "connected");
        if (isTikTok) {
          const username = safeString(connection.config?.username, 80).replace(/^@+/, "");
          socket.send(JSON.stringify({
            action: "subscribe",
            platform: "tiktok",
            username
          }));
          this.#tiktokStatus(connection.id, "checking");
        }
      });
      socket.addEventListener("message", (event) => {
        try {
          const raw = JSON.parse(String(event.data));
          if (isTikTok) {
            const liveStatus = parseTikTokRelayStatus(raw);
            if (liveStatus) {
              this.#tiktokStatus(connection.id, liveStatus.status, liveStatus);
              return;
            }
            this.#tiktokStatus(connection.id, "live", {
              lastEventAt: new Date().toISOString()
            });
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
        this.#status(connection.id, "error", "Erreur WebSocket.");
        if (isTikTok) this.#tiktokStatus(connection.id, "error");
      });
      socket.addEventListener("close", () => {
        if (runtime.closed) return;
        runtime.attempts += 1;
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
    runtime.send = (payload) => {
      const message = safeString(payload.message || payload, 450).replace(/[\r\n]/g, " ");
      socket.write(`PRIVMSG #${channel} :${message}\r\n`);
      return { sent: true };
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
      const username =
        connection?.config?.username || state.settings.tiktok?.username || "";
      const previousStatus = state.settings.tiktok?.status;
      const previousRoomId = state.settings.tiktok?.roomId || "";
      const roomId =
        status === "live"
          ? Object.prototype.hasOwnProperty.call(details, "roomId")
            ? safeString(details.roomId || "", 160)
            : previousRoomId
          : "";
      changed =
        previousStatus !== status ||
        previousRoomId !== roomId;
      state.settings.tiktok = {
        ...(state.settings.tiktok || {}),
        username,
        status,
        roomId,
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

function parseTags(value) {
  return Object.fromEntries(
    String(value)
      .split(";")
      .map((part) => {
        const [key, ...rest] = part.split("=");
        return [key, rest.join("=")];
      })
  );
}

function parseTwitchLine(line) {
  const match = line.match(/^@([^ ]+) :([^!]+)![^ ]+ ([A-Z]+) #[^ ]+ :?(.*)$/);
  if (!match) return null;
  const tags = parseTags(match[1]);
  const username = match[2];
  const command = match[3];
  const text = match[4];
  const data = {
    user: {
      id: tags["user-id"] || username,
      username,
      displayName: tags["display-name"] || username,
      subscriber: tags.subscriber === "1",
      moderator: tags.mod === "1"
    }
  };
  if (command === "PRIVMSG") {
    return { event: "chat", data: { ...data, message: text } };
  }
  if (command === "USERNOTICE") {
    const noticeType = tags["msg-id"];
    if (noticeType === "raid") {
      return { event: "raid", data: { ...data, message: text, tags } };
    }
    const subscriptionNotices = new Set([
      "sub",
      "resub",
      "subgift",
      "anonsubgift",
      "submysterygift",
      "giftpaidupgrade",
      "anongiftpaidupgrade",
      "primepaidupgrade"
    ]);
    if (subscriptionNotices.has(noticeType)) {
      return { event: "subscribe", data: { ...data, message: text, tags } };
    }
    return null;
  }
  return null;
}

function parseTikTokRelayStatus(raw) {
  if (!raw || typeof raw !== "object") return null;
  const data = raw.data && typeof raw.data === "object" ? raw.data : raw;
  const kind = safeString(
    raw.event || raw.type || raw.action || data.event || data.type,
    80
  )
    .replace(/[^a-z]/gi, "")
    .toLowerCase();
  if (["streamend", "liveend", "offline", "disconnected"].includes(kind)) {
    return { status: "offline", roomId: safeString(data.roomId || "", 160) };
  }
  const statusKinds = new Set([
    "status",
    "livestatus",
    "roomstatus",
    "roominfo",
    "live"
  ]);
  if (!statusKinds.has(kind)) return null;
  const rawLive =
    data.live ??
    data.isLive ??
    data.online ??
    data.connected ??
    data.status ??
    raw.live ??
    raw.isLive;
  if (["checking", "connecting", "pending"].includes(String(rawLive).toLowerCase())) {
    return {
      status: "checking",
      roomId: safeString(data.roomId || data.room_id || raw.roomId || "", 160)
    };
  }
  const live =
    rawLive === true ||
    rawLive === 1 ||
    ["true", "1", "live", "online"].includes(String(rawLive).toLowerCase()) ||
    kind === "live";
  return {
    status: live ? "live" : "offline",
    roomId: safeString(data.roomId || data.room_id || raw.roomId || "", 160)
  };
}

function tiktokConnectorPayload(type, event = {}, channelUsername = "") {
  const user = event.user || event.userInfo || event.sender || {};
  const uniqueId = safeString(
    user.uniqueId ||
      user.username ||
      event.uniqueId ||
      event.username ||
      "anonymous",
    120
  );
  const nickname = safeString(
    user.nickname ||
      user.displayName ||
      event.nickname ||
      event.displayName ||
      uniqueId,
    160
  );
  const gift = event.gift || event.giftDetails || event.extendedGiftInfo || {};
  return {
    channelUsername: safeString(channelUsername, 80),
    uniqueId,
    nickname,
    profilePictureUrl: preferredImageUrl(
      user.profilePictureUrl,
      user.avatarUrl,
      user.profilePicture,
      user.avatarThumb,
      event.profilePictureUrl,
      event.profilePicture,
      event.avatarThumb,
      event.userDetails?.profilePictureUrls
    ),
    isSubscriber: Boolean(
      user.isSubscriber || user.subscriber || event.isSubscriber
    ),
    isModerator: Boolean(
      user.isModerator || user.moderator || event.isModerator
    ),
    giftId: safeString(
      event.giftId || gift.giftId || gift.id || "",
      120
    ),
    giftName: safeString(
      event.giftName || gift.giftName || gift.name || "Cadeau",
      160
    ),
    giftImageUrl: preferredImageUrl(
      event.giftImageUrl,
      event.giftPictureUrl,
      event.giftImage,
      gift.giftImage,
      gift.imageUrl,
      gift.image,
      gift.icon,
      event.giftDetails?.giftImage,
      event.giftDetails?.image,
      event.extendedGiftInfo?.giftImage,
      event.extendedGiftInfo?.image
    ),
    repeatCount: Math.max(
      1,
      Number(event.repeatCount || event.repeat_count || 1)
    ),
    diamondCount: Math.max(
      0,
      Number(
        event.diamondCount ||
          gift.diamondCount ||
          gift.diamond_count ||
          0
      )
    ),
    likeCount: Math.max(1, Number(event.likeCount || event.count || 1)),
    totalLikes: Math.max(
      0,
      Number(event.totalLikeCount || event.totalLikes || 0)
    ),
    comment: safeString(
      event.comment || event.text || event.message || "",
      1000
    ),
    viewerCount: Math.max(
      0,
      Number(event.viewerCount || event.totalUser || 0)
    ),
    eventType: type
  };
}

function applyTikTokLikeDelta(runtime, payload) {
  const current = Math.max(1, Number(payload?.likeCount) || 1);
  const total = Math.max(0, Number(payload?.totalLikes) || 0);
  if (!total) return { ...payload, likeCount: current };

  const previous = Math.max(0, Number(runtime?.lastTotalLikes) || 0);
  runtime.lastTotalLikes = total;
  if (!previous || total < previous) {
    return { ...payload, likeCount: current };
  }
  if (total === previous) return null;
  return { ...payload, likeCount: total - previous };
}

function isTikTokOfflineError(error) {
  const text = tiktokErrorText(error);
  return /offline|not live|isn't live|is not live|isn't online|is not online|room.*(?:missing|not found)|UserOffline|failed to (?:retrieve|extract) room[\s_-]*id/i.test(
    text
  );
}

function tiktokGiftIsFinal(event = {}) {
  const gift = event.gift || event.giftDetails || {};
  const giftType = Number(
    event.giftType || gift.giftType || gift.type || 0
  );
  return giftType !== 1 || Boolean(event.repeatEnd);
}

function friendlyTikTokError(error, username) {
  if (isTikTokOfflineError(error)) {
    return `@${username} est hors ligne. Surveillance automatique active.`;
  }
  const detail = safeString(tiktokErrorText(error) || "Connexion impossible", 300);
  return `Détection TikTok @${username} : ${detail}`;
}

function tiktokErrorText(error) {
  if (typeof error === "string") return error;
  const candidates = [
    error?.name,
    error?.message,
    error?.reason,
    error?.description,
    error?.code,
    error?.info?.message,
    error?.info?.description,
    typeof error?.info === "string" ? error.info : ""
  ].filter(Boolean);
  if (candidates.length) return candidates.join(" ");
  try {
    const serialized = JSON.stringify(error);
    return serialized === "{}" ? "" : serialized;
  } catch {
    return "";
  }
}

module.exports = {
  SourceHub,
  isTikTokOfflineError,
  parseTikTokRelayStatus,
  parseTwitchLine,
  applyTikTokLikeDelta,
  tiktokGiftIsFinal,
  tiktokConnectorPayload
};
