"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { URL } = require("node:url");
const { LocalWebSocketServer } = require("./local-websocket");
const { MatchSourceService } = require("./match-source-service");
const { safeString, timingSafeToken } = require("./utils");
const overlayCatalog = require("../../resources/overlays/overlay-catalog");

function overlayViewAcceptsChannel(
  view,
  channel,
  payload = {},
  screen = 0,
  leaderboardKind = ""
) {
  return overlayCatalog.acceptsChannel({
    view,
    channel,
    payload,
    screen,
    leaderboardKind,
    hasMediaScreen: Number(screen) >= 1 && Number(screen) <= 8
  });
}

function commerceExpiryMs(entry) {
  const numeric = Number(entry?.expiresAtMs || 0);
  if (numeric > 0) return numeric;
  const parsed = Date.parse(
    String(entry?.expiresAt || entry?.renewalDate || "")
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasProOverlayAccess(state, nowMs = Date.now()) {
  const subscription = state?.commerce?.subscription || {};
  if (!["pro", "premium"].includes(subscription.tier)) return false;
  if (
    subscription.source === "trial" ||
    subscription.status === "trial"
  ) {
    return (
      ["active", "trial"].includes(subscription.status) &&
      commerceExpiryMs(subscription) > nowMs
    );
  }
  return ["active", "paid"].includes(subscription.status);
}

function normalizeMatchPlaybackRequest(incoming = {}) {
  const allowedMatches = new Set(
    overlayCatalog.matches.map(({ match }) => match)
  );
  const match = safeString(incoming.match, 40).trim().toLowerCase();
  if (!allowedMatches.has(match)) {
    throw new Error("Animation Match invalide.");
  }
  const requestedVariant = safeString(incoming.variant, 40)
    .trim()
    .toLowerCase();
  return {
    requestId: randomUUID(),
    match,
    variant:
      match === "enigma" || !["tikcontrol", "gladiador"].includes(requestedVariant)
        ? "tikcontrol"
        : requestedVariant,
    fit: incoming.fit === "cover" ? "cover" : "contain"
  };
}

function overlayViewRequiresPro(view) {
  return overlayCatalog.viewRequiresPro(view);
}

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp"
};

class OverlayServer {
  constructor({
    store,
    staticDirectory,
    onInboundEvent,
    onEffectRequest,
    publicRelay = null
  }) {
    this.store = store;
    this.staticDirectory = staticDirectory;
    this.onInboundEvent = onInboundEvent;
    this.onEffectRequest = onEffectRequest;
    this.publicRelay = publicRelay;
    this.server = null;
    this.apiServer = null;
    this.sseClients = new Set();
    this.webSockets = null;
    this.apiWebSockets = null;
    this.accessTimer = null;
    this.matchSource = new MatchSourceService({
      store,
      staticDirectory,
      hasAccess: () => hasProOverlayAccess(this.store.getState()),
      normalizePlayback: normalizeMatchPlaybackRequest
    });
  }

  async start() {
    await this.stop();
    const settings = this.store.getState().settings;
    this.webSockets = new LocalWebSocketServer({
      authorize: (request) => this.#authorized(request, settings.overlayToken)
    });
    this.webSockets.on("message", (message, socket) => {
      this.#handleWebSocketMessage(message, socket, this.webSockets);
    });
    this.server = http.createServer((request, response) =>
      this.#handleRequest(request, response)
    );
    this.server.on("upgrade", (request, socket) =>
      this.webSockets.handleUpgrade(request, socket)
    );
    await this.#listen(this.server, settings.overlayPort);

    this.apiWebSockets = new LocalWebSocketServer({
      authorize: (request) => {
        const url = new URL(request.url, "http://127.0.0.1");
        if (url.pathname === "/" && !url.searchParams.has("token")) return true;
        return this.#authorized(request, settings.apiToken);
      }
    });
    this.apiWebSockets.on("message", (message, socket) => {
      this.#handleWebSocketMessage(message, socket, this.apiWebSockets);
    });
    this.apiServer = http.createServer((request, response) =>
      this.#handleApiRequest(request, response)
    );
    this.apiServer.on("upgrade", (request, socket) =>
      this.apiWebSockets.handleUpgrade(request, socket)
    );
    await this.#listen(this.apiServer, settings.apiPort);
    this.accessTimer = setInterval(() => this.#enforceOverlayAccess(), 5000);
    this.accessTimer.unref?.();
    return this.urls();
  }

  #listen(server, port) {
    return new Promise((resolve, reject) => {
      const onError = (error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(Number(port), "127.0.0.1");
    });
  }

  async stop() {
    if (this.accessTimer) clearInterval(this.accessTimer);
    this.accessTimer = null;
    this.webSockets?.close();
    this.apiWebSockets?.close();
    for (const client of this.sseClients) client.response.end();
    this.sseClients.clear();
    this.matchSource.clear();
    await Promise.all([this.#closeServer(this.server), this.#closeServer(this.apiServer)]);
    this.server = null;
    this.apiServer = null;
  }

  #closeServer(server) {
    if (!server?.listening) return Promise.resolve();
    return new Promise((resolve) => {
      server.close(() => resolve());
      // Les navigateurs et les aperçus réutilisent des connexions HTTP
      // keep-alive. Lors d'un arrêt/redémarrage, elles ne doivent pas retenir
      // le serveur (ni la fermeture de l'application) indéfiniment.
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
    });
  }

  urls({ includeRestricted = false } = {}) {
    const state = this.store.getState();
    const settings = state.settings;
    const base = `http://127.0.0.1:${settings.overlayPort}`;
    const overlayUrls = overlayCatalog.buildUrls({
      baseUrl: base,
      credentialName: "token",
      credentialValue: settings.overlayToken,
      proAccess: hasProOverlayAccess(state),
      includeRestricted
    });
    overlayUrls.matchPlayer = this.matchSource.sourceUrl(base, {
      includeRestricted
    });
    return {
      ...overlayUrls,
      api: `ws://127.0.0.1:${settings.apiPort}/?token=${encodeURIComponent(
        settings.apiToken
      )}`,
      compatibilityApi: `ws://127.0.0.1:${settings.apiPort}/`
    };
  }

  publish(channel, payload) {
    this.#enforceOverlayAccess();
    const message = {
      channel,
      payload,
      timestamp: new Date().toISOString()
    };
    const encoded = `event: ${channel}\ndata: ${JSON.stringify(message)}\n\n`;
    for (const client of this.sseClients) {
      if (
        !overlayViewAcceptsChannel(
          client.view,
          channel,
          payload,
          client.screen,
          client.leaderboardKind
        )
      ) {
        continue;
      }
      try {
        client.response.write(encoded);
      } catch {
        this.sseClients.delete(client);
      }
    }
    this.webSockets?.broadcast(message);
    this.publicRelay?.publish(channel, payload);
  }

  playMatch(incoming = {}) {
    if (!hasProOverlayAccess(this.store.getState())) {
      throw new Error("Un abonnement Pro actif est requis pour lire les Matchs.");
    }
    const payload = normalizeMatchPlaybackRequest(incoming);
    this.publish("match", payload);
    return payload;
  }

  refreshAccess() {
    this.#enforceOverlayAccess();
  }

  publishEvent(event) {
    this.publish("event", event);
    this.apiWebSockets?.broadcast({ event: event.type, data: event });
  }

  #authorized(request, expectedToken) {
    const url = new URL(request.url, "http://127.0.0.1");
    const bearer = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
    return (
      timingSafeToken(url.searchParams.get("token"), expectedToken) ||
      timingSafeToken(bearer, expectedToken)
    );
  }

  async #handleRequest(request, response) {
    const settings = this.store.getState().settings;
    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    this.#securityHeaders(response);

    if (url.pathname === "/health") {
      return this.#json(response, 200, { ok: true, service: "ShenPulse Overlay" });
    }
    const matchBridge = this.matchSource.parseBridge(url.pathname);
    if (matchBridge) {
      return this.matchSource.handleBridgeRequest({
        credentials: matchBridge,
        url,
        request,
        response
      });
    }
    const matchSource = this.matchSource.parse(url.pathname);
    if (matchSource) {
      return this.matchSource.handleSourceRequest({
        credentials: matchSource,
        url,
        request,
        response,
        registerEventClient: (client) => {
          this.sseClients.add(client);
          request.on("close", () => this.sseClients.delete(client));
        }
      });
    }
    if (url.pathname.startsWith("/match-media/")) {
      return this.matchSource.serveMedia(url, request, response);
    }
    const isOverlayDocument =
      url.pathname === "/" ||
      url.pathname === "/overlay" ||
      url.pathname === "/overlay/";
    if (isOverlayDocument) {
      const previewMode = url.searchParams.get("preview");
      const isCatalogPreview =
        previewMode === "static" || previewMode === "animated";
      if (!this.#authorized(request, settings.overlayToken)) {
        return this.#json(response, 401, { error: "Jeton local invalide." });
      }
      if (
        overlayViewRequiresPro(url.searchParams.get("view")) &&
        !isCatalogPreview &&
        !hasProOverlayAccess(this.store.getState())
      ) {
        return this.#overlayAccessDenied(response);
      }
      return this.#serveStatic(url.pathname, request, response);
    }
    if (url.pathname.startsWith("/overlay/media/lottie/")) {
      if (!this.#authorized(request, settings.overlayToken)) {
        return this.#json(response, 401, { error: "Jeton local invalide." });
      }
      return this.#serveStatic(url.pathname, request, response);
    }
    if (url.pathname.startsWith("/overlay/media/")) {
      if (!this.#authorized(request, settings.overlayToken)) {
        return this.#json(response, 401, { error: "Jeton local invalide." });
      }
      if (
        url.pathname.startsWith("/overlay/media/video/") &&
        !hasProOverlayAccess(this.store.getState())
      ) {
        return this.#overlayAccessDenied(response);
      }
      return this.#serveStatic(url.pathname, request, response);
    }
    if (
      /^\/overlay\/(?!media\/)(?:[^/]+\/)*[^/]+\.(?:css|js|png|svg)$/i.test(
        url.pathname
      )
    ) {
      return this.#serveStatic(url.pathname, request, response);
    }
    if (!this.#authorized(request, settings.overlayToken)) {
      return this.#json(response, 401, { error: "Jeton local invalide." });
    }
    if (url.pathname === "/api/state") {
      const state = this.store.getState();
      return this.#json(response, 200, {
        goals: state.goals,
        session: state.session,
        overlaySession: state.overlaySession,
        statistics: state.statistics
      });
    }
    if (url.pathname === "/events") {
      const view = String(url.searchParams.get("view") || "alerts");
      if (
        overlayViewRequiresPro(view) &&
        !hasProOverlayAccess(this.store.getState())
      ) {
        return this.#overlayAccessDenied(response);
      }
      response.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      });
      response.write(": ShenPulse connected\n\n");
      const screen = Math.round(Number(url.searchParams.get("screen")) || 0);
      const leaderboardKind = String(url.searchParams.get("kind") || "");
      const client = { response, view, screen, leaderboardKind };
      this.sseClients.add(client);
      request.on("close", () => this.sseClients.delete(client));
      return;
    }
    return this.#serveStatic(url.pathname, response);
  }

  async #handleApiRequest(request, response) {
    const settings = this.store.getState().settings;
    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    this.#securityHeaders(response);
    if (url.pathname === "/health") {
      return this.#json(response, 200, {
        ok: true,
        service: "ShenPulse Local API",
        websocketClients: this.apiWebSockets?.clients.size || 0
      });
    }
    if (!this.#authorized(request, settings.apiToken)) {
      return this.#json(response, 401, { error: "Jeton API invalide." });
    }
    if (request.method === "GET" && url.pathname === "/api/state") {
      return this.#json(response, 200, this.store.getState());
    }
    if (request.method === "POST" && url.pathname === "/api/events") {
      try {
        const body = await this.#readJson(request);
        await this.onInboundEvent(body, "local-api");
        return this.#json(response, 202, { accepted: true });
      } catch (error) {
        return this.#json(response, 400, { error: safeString(error.message, 500) });
      }
    }
    if (request.method === "POST" && url.pathname === "/api/effects") {
      try {
        const body = await this.#readJson(request);
        const result = await this.onEffectRequest(body);
        return this.#json(response, 200, result);
      } catch (error) {
        return this.#json(response, 400, { error: safeString(error.message, 500) });
      }
    }
    return this.#json(response, 404, { error: "Route inconnue." });
  }

  async #handleWebSocketMessage(message, socket, server) {
    try {
      const parsed = JSON.parse(message);
      if (parsed.action === "emit" && parsed.event) {
        await this.onInboundEvent(parsed, "local-websocket");
        server.send(socket, { ok: true, id: parsed.id || null });
      } else if (parsed.action === "effect" && parsed.effectId) {
        const result = await this.onEffectRequest(parsed);
        server.send(socket, { ok: true, result, id: parsed.id || null });
      } else {
        server.send(socket, { ok: true, pong: Date.now() });
      }
    } catch (error) {
      server.send(socket, { ok: false, error: safeString(error.message, 500) });
    }
  }

  #readJson(request) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      request.on("data", (chunk) => {
        size += chunk.length;
        if (size > 1024 * 1024) {
          reject(new Error("Corps de requête trop volumineux."));
          request.destroy();
          return;
        }
        chunks.push(chunk);
      });
      request.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
        } catch {
          reject(new Error("JSON invalide."));
        }
      });
      request.on("error", reject);
    });
  }

  #serveStatic(requestPath, request, response) {
    const relative =
      requestPath === "/" || requestPath === "/overlay/" || requestPath === "/overlay"
        ? "index.html"
        : requestPath.replace(/^\/overlay\/?/, "");
    const normalized = path.normalize(relative).replace(/^(\.\.[/\\])+/, "");
    const fullPath = path.resolve(this.staticDirectory, normalized);
    if (!fullPath.startsWith(path.resolve(this.staticDirectory))) {
      return this.#json(response, 403, { error: "Chemin interdit." });
    }
    let target = fullPath;
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      target = path.join(target, "index.html");
    }
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      return this.#json(response, 404, { error: "Fichier introuvable." });
    }
    const extension = path.extname(target).toLowerCase();
    const isOverlayDocument = extension === ".html";
    const isCacheableOverlayCode = [".css", ".js"].includes(extension);
    const isProtectedMatchVideo = /^\/overlay\/media\/video\//i.test(
      String(requestPath || "")
    );
    const stat = fs.statSync(target);
    const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
    const headers = {
      "Content-Type": CONTENT_TYPES[extension] || "application/octet-stream",
      "Cache-Control":
        isOverlayDocument || isProtectedMatchVideo
          ? "no-store"
          : isCacheableOverlayCode
            ? "private, no-cache"
          : "public, max-age=3600"
    };
    if (isCacheableOverlayCode) headers.ETag = etag;
    if (
      isCacheableOverlayCode &&
      String(request.headers["if-none-match"] || "") === etag
    ) {
      response.writeHead(304, headers);
      response.end();
      return;
    }
    response.writeHead(200, headers);
    fs.createReadStream(target).pipe(response);
  }

  #securityHeaders(response) {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data: https:; media-src 'self' data: blob: https:; " +
        "style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https:"
    );
  }

  #enforceOverlayAccess() {
    const hasProAccess = hasProOverlayAccess(this.store.getState());
    for (const client of [...this.sseClients]) {
      if (!overlayViewRequiresPro(client.view)) continue;
      const matchUrlStillValid =
        !client.matchAccess ||
        this.matchSource.isAuthorized(client.matchAccess);
      if (hasProAccess && matchUrlStillValid) continue;
      try {
        client.response.write(
          `event: access-revoked\ndata: ${JSON.stringify({
            reason: hasProAccess
              ? "match-url-regenerated"
              : "subscription-required"
          })}\n\n`
        );
        client.response.end();
      } catch {
        // The client is removed below even if its socket already disappeared.
      }
      this.sseClients.delete(client);
    }
  }

  #overlayAccessDenied(response) {
    response.writeHead(403, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    });
    response.end(
      "<!doctype html><html hidden><head><meta charset=\"utf-8\"><title>Accès Pro requis</title></head><body></body></html>"
    );
  }

  #json(response, status, body) {
    response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(body));
  }
}

module.exports = {
  OverlayServer,
  hasProOverlayAccess,
  normalizeMatchPlaybackRequest,
  overlayViewAcceptsChannel,
  overlayViewRequiresPro
};
