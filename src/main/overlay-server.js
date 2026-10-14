"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { URL } = require("node:url");
const { LocalWebSocketServer } = require("./local-websocket");
const { MatchSourceService } = require("./match-source-service");
const { readState } = require("./state-projection");
const { assertProFeatureAccess } = require("./pro-feature-access");
const { MATCH_OVERLAY_STATE_PATHS, projectMatchesOverlayState, projectMatchesOverlayPayload } = require("./matches-overlay-state");
const { safeString, timingSafeToken } = require("./utils");
const overlayCatalog = require("../../resources/overlays/overlay-catalog");
const sceneLayout = require("../../resources/overlays/scene-layout");

const PRO_ACCESS_STATE_PATHS = ["commerce.subscription"];
const OVERLAY_BOOTSTRAP_STATE_PATHS = [
  "goals", "session", "overlaySession", "statistics",
  "settings.overlayScene", "settings.overlayConfigs", "commerce.subscription"
];
const MATCH_WIDGET_URL_KEYS = ["matchesWins", "matchesStarDonor", "matchesTopDonor", "matchesDonors", "matchesTimer", "matchesVictory", "matchesScoreboard"];
const isMatchWidgetView = (view) => String(view || "").trim().toLowerCase() === "match-widget";
const matchWidgetIdentity = (state) => JSON.stringify([state?.settings?.account?.uid || "", state?.session?.profileId || ""]);

function overlayViewAcceptsChannel(
  view,
  channel,
  payload = {},
  screen = 0,
  leaderboardKind = "",
  matchName = ""
) {
  return overlayCatalog.acceptsChannel({
    view,
    channel,
    payload,
    screen,
    leaderboardKind,
    matchName,
    hasMediaScreen: Number(screen) >= 1 && Number(screen) <= 8
  });
}

function hasProOverlayAccess(state, nowMs = Date.now()) {
  return sceneLayout.activeProAccess(state, nowMs);
}

function normalizeMatchPlaybackRequest(incoming = {}) {
  const allowedMatches = new Set(
    overlayCatalog.matches.map(({ match }) => match)
  );
  const match = safeString(incoming.match, 40).trim().toLowerCase();
  if (!allowedMatches.has(match)) {
    throw new Error("Animation Match invalide.");
  }
  const variant = overlayCatalog.normalizeAnimationVariant(match, safeString(incoming.variant, 40));
  if (!variant) throw new Error("Cette variante d’animation Match est indisponible.");
  return {
    requestId: randomUUID(),
    match,
    variant,
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
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

class OverlayServer {
  constructor({
    store,
    staticDirectory,
    onInboundEvent,
    onEffectRequest,
    publicRelay = null,
    matchMedia
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
      hasAccess: () => hasProOverlayAccess(readState(this.store, PRO_ACCESS_STATE_PATHS)),
      hasBridgeAccess: () => Boolean(this.#matchesAccessState()),
      normalizePlayback: normalizeMatchPlaybackRequest,
      protectedMedia: matchMedia
    });
  }

  async start() {
    await this.stop();
    const { settings } = readState(this.store, [
      "settings.overlayToken", "settings.overlayPort", "settings.apiToken", "settings.apiPort"
    ]);
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
    const state = readState(this.store, [
      "settings.overlayPort", "settings.overlayToken", "settings.apiPort",
      "settings.apiToken", "commerce.subscription"
    ]);
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
    if (!this.#matchesAccessState()) for (const key of MATCH_WIDGET_URL_KEYS) overlayUrls[key] = "";
    return {
      ...overlayUrls,
      api: `ws://127.0.0.1:${settings.apiPort}/?token=${encodeURIComponent(
        settings.apiToken
      )}`,
      compatibilityApi: `ws://127.0.0.1:${settings.apiPort}/`
    };
  }

  publish(channel, payload) {
    const hasProAccess = this.#enforceOverlayAccess();
    // SSE local seulement ici : le relais publie une projection bornée dans
    // l'alias Match dédié via publishState(), jamais dans le canal générique.
    if (String(channel || "").trim().toLowerCase() === "match-state") {
      channel = "match-state";
      const clients = [...this.sseClients].filter((client) => isMatchWidgetView(client.view));
      if (!clients.length) return;
      const encoded = `event: match-state\ndata: ${JSON.stringify({ channel, payload: projectMatchesOverlayPayload(payload), timestamp: new Date().toISOString() })}\n\n`;
      for (const client of clients) {
        try { client.response.write(encoded); } catch { this.sseClients.delete(client); }
      }
      return;
    }
    const message = {
      channel,
      payload,
      timestamp: new Date().toISOString()
    };
    const encoded = `event: ${channel}\ndata: ${JSON.stringify(message)}\n\n`;
    for (const client of this.sseClients) {
      // Le lecteur Studio à capacité publique ne reçoit jamais les sons,
      // configurations et événements génériques des autres sources.
      if (client.matchBridgeAccess && !["match", "match-media", "match-audio"].includes(channel)) continue;
      if (client.view === "scene" && !sceneLayout.acceptsSceneChannel(
        channel, hasProAccess
      )) continue;
      if (
        !overlayViewAcceptsChannel(
          client.view,
          channel,
          payload,
          client.screen,
          client.leaderboardKind,
          client.matchName
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
    if (!hasProOverlayAccess(readState(this.store, PRO_ACCESS_STATE_PATHS))) {
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
    const { settings } = readState(this.store, ["settings.overlayToken"]);
    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    this.#securityHeaders(response);

    if (url.pathname === "/health") {
      return this.#json(response, 200, { ok: true, service: "ShenPulse Overlay" });
    }
    if (url.pathname === "/match-preview/ticket") {
      return this.matchSource.handlePreviewTicket(url, request, response);
    }
    const matchBridge = this.matchSource.parseBridge(url.pathname);
    if (matchBridge) {
      return this.matchSource.handleBridgeRequest({
        credentials: matchBridge,
        url,
        request,
        response,
        registerEventClient: (client) => {
          if (isMatchWidgetView(client.view)) {
            const matchesAccess = this.#matchesAccessState();
            if (!matchesAccess) return response.end();
            client.matchesIdentity = matchWidgetIdentity(matchesAccess);
          }
          this.sseClients.add(client);
          request.on("close", () => this.sseClients.delete(client));
        }
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
      url.pathname === "/overlay/" || /\.html$/i.test(url.pathname);
    if (isOverlayDocument) {
      const previewMode = url.searchParams.get("preview");
      const isCatalogPreview =
        previewMode === "static" || previewMode === "animated";
      if (!this.#authorized(request, settings.overlayToken)) {
        return this.#json(response, 401, { error: "Jeton local invalide." });
      }
      if (isMatchWidgetView(url.searchParams.get("view")) && !this.#matchesAccessState()) return this.#overlayAccessDenied(response);
      if (
        overlayViewRequiresPro(url.searchParams.get("view")) &&
        !isCatalogPreview &&
        !hasProOverlayAccess(readState(this.store, PRO_ACCESS_STATE_PATHS))
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
      if (/^\/overlay\/media\/video\/.*\.(?:webm|mp4)$/i.test(url.pathname)) {
        return this.#json(response, 403, { error: "Les vidéos Match sont disponibles uniquement par ticket de lecture." });
      }
      if (!this.#authorized(request, settings.overlayToken)) {
        return this.#json(response, 401, { error: "Jeton local invalide." });
      }
      if (
        url.pathname.startsWith("/overlay/media/video/") &&
        !hasProOverlayAccess(readState(this.store, PRO_ACCESS_STATE_PATHS))
      ) {
        return this.#overlayAccessDenied(response);
      }
      return this.#serveStatic(url.pathname, request, response);
    }
    if (
      /^\/overlay\/(?!media\/)(?:[^/]+\/)*[^/]+\.(?:css|js|png|svg|woff|woff2)$/i.test(
        url.pathname
      )
    ) {
      return this.#serveStatic(url.pathname, request, response);
    }
    if (!this.#authorized(request, settings.overlayToken)) {
      return this.#json(response, 401, { error: "Jeton local invalide." });
    }
    if (url.pathname === "/api/state") {
      if (isMatchWidgetView(url.searchParams.get("view"))) {
        if (!this.#matchesAccessState()) return this.#overlayAccessDenied(response);
        return this.#json(response, 200, { matches: projectMatchesOverlayState(readState(this.store, MATCH_OVERLAY_STATE_PATHS)) });
      }
      const state = readState(this.store, OVERLAY_BOOTSTRAP_STATE_PATHS);
      return this.#json(response, 200, {
        goals: state.goals,
        session: state.session,
        overlaySession: state.overlaySession,
        overlayScene: sceneLayout.stateForScene(state),
        configurations: state.settings?.overlayConfigs || {},
        statistics: state.statistics
      });
    }
    if (url.pathname === "/events") {
      const view = String(url.searchParams.get("view") || "alerts");
      const matchesAccess = isMatchWidgetView(view) ? this.#matchesAccessState() : null;
      if (isMatchWidgetView(view) && !matchesAccess) return this.#overlayAccessDenied(response);
      if (
        overlayViewRequiresPro(view) &&
        !hasProOverlayAccess(readState(this.store, PRO_ACCESS_STATE_PATHS))
      ) {
        return this.#overlayAccessDenied(response);
      }
      response.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      });
      response.write(": ShenPulse connected\n\n");
      const state = isMatchWidgetView(view) ? null : readState(this.store, OVERLAY_BOOTSTRAP_STATE_PATHS);
      const bootstrapPayload = isMatchWidgetView(view)
        ? { matches: projectMatchesOverlayState(readState(this.store, MATCH_OVERLAY_STATE_PATHS)) }
        : { goals: state.goals, session: state.session, overlaySession: state.overlaySession,
          overlayScene: sceneLayout.stateForScene(state), configurations: state.settings?.overlayConfigs || {}, statistics: state.statistics };
      response.write(
        `event: bootstrap\ndata: ${JSON.stringify({
          channel: "bootstrap",
          payload: bootstrapPayload,
          timestamp: new Date().toISOString()
        })}\n\n`
      );
      const screen = Math.round(Number(url.searchParams.get("screen")) || 0);
      const leaderboardKind = String(url.searchParams.get("kind") || "");
      const client = { response, view, screen, leaderboardKind,
        sceneProAccess: hasProOverlayAccess(state),
        ...(matchesAccess ? { matchesIdentity: matchWidgetIdentity(matchesAccess) } : {}) };
      this.sseClients.add(client);
      request.on("close", () => this.sseClients.delete(client));
      return;
    }
    return this.#serveStatic(url.pathname, request, response);
  }

  async #handleApiRequest(request, response) {
    const { settings } = readState(this.store, ["settings.apiToken"]);
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
    const staticRoot = path.resolve(this.staticDirectory);
    if (fullPath !== staticRoot && !fullPath.startsWith(`${staticRoot}${path.sep}`)) {
      return this.#json(response, 403, { error: "Chemin interdit." });
    }
    let target = fullPath;
    const rawVideoRoot = path.resolve(this.staticDirectory, "media", "video");
    if (target.startsWith(`${rawVideoRoot}${path.sep}`) && /\.(?:webm|mp4)$/i.test(target)) {
      return this.#json(response, 403, { error: "Export de vidéo Match indisponible." });
    }
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      target = path.join(target, "index.html");
    }
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      return this.#json(response, 404, { error: "Fichier introuvable." });
    }
    const extension = path.extname(target).toLowerCase();
    const isOverlayDocument = extension === ".html";
    const isCacheableOverlayCode = [".css", ".js", ".woff", ".woff2"].includes(extension);
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
            ? "private, max-age=31536000, immutable"
            : "public, max-age=31536000, immutable"
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
    this.matchSource.reconcile();
    // Access enforcement has no side effects outside registered SSE clients.
    // A LIVE event must not copy state solely for an absent OBS/browser source.
    if (!this.sseClients.size) return;
    const hasProAccess = hasProOverlayAccess(readState(this.store, PRO_ACCESS_STATE_PATHS));
    const matchesAccess = [...this.sseClients].some((client) => isMatchWidgetView(client.view) || client.matchBridgeAccess) ? this.#matchesAccessState() : null;
    let sceneState;
    for (const client of [...this.sseClients]) {
      if (client.view === "scene" && client.sceneProAccess !== hasProAccess) {
        client.sceneProAccess = hasProAccess;
        sceneState ||= sceneLayout.stateForScene(readState(this.store, [
          "settings.overlayScene", "commerce.subscription"
        ]));
        client.response.write(`event: scene\ndata: ${JSON.stringify({
          channel: "scene", payload: sceneState
        })}\n\n`);
      }
      if (!overlayViewRequiresPro(client.view)) continue;
      const matchUrlStillValid =
        (!client.matchAccess || this.matchSource.isAuthorized(client.matchAccess)) &&
        (!client.matchBridgeAccess || this.matchSource.isBridgeAuthorized(client.matchBridgeAccess));
      const matchBridgeContextValid = !client.matchBridgeIdentity || client.matchBridgeIdentity === this.matchSource.bridgeIdentity();
      const matchesStillAllowed = (!isMatchWidgetView(client.view) || Boolean(matchesAccess && client.matchesIdentity === matchWidgetIdentity(matchesAccess))) &&
        (!client.matchBridgeAccess || Boolean(matchesAccess));
      if (hasProAccess && matchUrlStillValid && matchesStillAllowed && matchBridgeContextValid) continue;
      try {
        client.response.write(
          `event: access-revoked\ndata: ${JSON.stringify({
            reason: hasProAccess
              ? !matchUrlStillValid ? "match-url-regenerated" : !matchesStillAllowed ? "matches-access-revoked" : "match-context-changed"
              : "subscription-required"
          })}\n\n`
        );
        client.response.end();
      } catch {
        // The client is removed below even if its socket already disappeared.
      }
      this.sseClients.delete(client);
    }
    return hasProAccess;
  }

  /** Authentification forte, abonnement et visibilité relus avant toute diffusion. */
  #matchesAccessState() {
    try { return assertProFeatureAccess(this.store, "matches"); }
    catch { return null; }
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
