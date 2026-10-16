"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { ProtectedMatchMediaStore } = require("./match-media/store");
const {
  matchAccountNumber,
  matchSourcePath,
  parseMatchBridgePath,
  parseMatchSourcePath
} = require("./match-access");
const { safeString, timingSafeToken } = require("./utils");
const { readState } = require("./state-projection");
const { versionLocalMatchDocument } = require("./overlay-code-version");
const { MATCH_WIDGET_KEYS, MATCH_OVERLAY_STATE_PATHS, projectMatchesOverlayState } = require("./matches-overlay-state");

const MATCH_MEDIA_TICKET_TTL_MS = 90_000;
const MAX_MATCH_MEDIA_TICKETS = 100;
const MATCH_ACCESS_STATE_PATHS = ["settings.account.uid", "settings.matchAccess.accessKey"];
const MATCH_BRIDGE_STATE_PATHS = ["settings.account.uid", "settings.publicOverlayRelay.matchChannelId"];
const MATCH_BRIDGE_CONTEXT_PATHS = ["settings.account.uid", "session.profileId", "settings.tiktok.roomId"];

/**
 * Domaine autonome de la source Match.
 *
 * Il ne connaît ni les autres overlays ni leurs jetons. Son unique contrat
 * porte sur l'identité du compte, l'accès Pro et la lecture d'un fichier Match
 * à travers un ticket opaque de courte durée.
 */
class MatchSourceService {
  constructor({ store, staticDirectory, hasAccess, hasBridgeAccess = hasAccess, normalizePlayback, protectedMedia }) {
    this.store = store;
    this.staticDirectory = staticDirectory;
    this.hasAccess = hasAccess;
    this.hasBridgeAccess = hasBridgeAccess;
    this.normalizePlayback = normalizePlayback;
    this.mediaTickets = new Map();
    this.protectedMedia = protectedMedia || new ProtectedMatchMediaStore({ directory: path.resolve(staticDirectory, "..", "protected-match-media") });
    this.mediaResponses = new Set();
    this.mediaIdentity = "";
  }

  parse(pathname) {
    return parseMatchSourcePath(pathname);
  }

  parseBridge(pathname) {
    return parseMatchBridgePath(pathname);
  }

  sourceUrl(baseUrl, { includeRestricted = false } = {}) {
    const state = readState(this.store, MATCH_ACCESS_STATE_PATHS);
    const settings = state.settings || {};
    const sourcePath = matchSourcePath({
      accountUid: settings.account?.uid,
      accessKey: settings.matchAccess?.accessKey
    });
    if (!sourcePath || (!includeRestricted && !this.hasAccess())) return "";
    return `${String(baseUrl || "").replace(/\/$/, "")}${sourcePath}`;
  }

  isAuthorized(credentials) {
    if (!credentials) return false;
    const settings = readState(this.store, MATCH_ACCESS_STATE_PATHS).settings || {};
    return (
      credentials.accountNumber === matchAccountNumber(settings.account?.uid) &&
      timingSafeToken(
        credentials.accessKey,
        settings.matchAccess?.accessKey
      )
    );
  }

  isBridgeAuthorized(credentials) {
    if (!credentials) return false;
    const settings = readState(this.store, MATCH_BRIDGE_STATE_PATHS).settings || {};
    return (
      credentials.accountNumber === matchAccountNumber(settings.account?.uid) &&
      timingSafeToken(
        credentials.channelId,
        settings.publicOverlayRelay?.matchChannelId
      )
    );
  }

  /** Identité privée des flux locaux : elle ne figure jamais dans une réponse. */
  bridgeIdentity() {
    const state = readState(this.store, MATCH_BRIDGE_CONTEXT_PATHS);
    return JSON.stringify([state.settings?.account?.uid || "", state.session?.profileId || "", state.settings?.tiktok?.roomId || ""]);
  }

  handleBridgeRequest({ credentials, url, request, response, registerEventClient }) {
    const origin = String(request.headers.origin || "");
    // Une navigation de premier niveau et ses lectures même origine n'ont
    // pas d'Origin. Elles utilisent la capacité révocable de l'URL, jamais
    // la clé privée Match. Les appels depuis HTTPS gardent une origine exacte.
    const localRead = !origin && request.method !== "OPTIONS";
    const headers = localRead ? { "Cache-Control": "no-store" } : this.#bridgeHeaders(origin);
    if (!headers || !this.isBridgeAuthorized(credentials)) {
      if (credentials?.resource === "document" && ["GET", "HEAD"].includes(request.method)) {
        return this.#accessDenied(response, request);
      }
      return this.#json(response, 403, {
        error: "Source Match publique invalide ou régénérée."
      });
    }
    if (!this.hasBridgeAccess()) {
      if (credentials.resource === "document" && ["GET", "HEAD"].includes(request.method)) {
        return this.#accessDenied(response, request, headers);
      }
      return this.#json(
        response,
        403,
        { error: "Un abonnement Pro actif est requis." },
        headers
      );
    }
    if (request.method === "OPTIONS") {
      const method = String(request.headers["access-control-request-method"] || "GET").toUpperCase();
      if (!["GET", "HEAD"].includes(method)) return this.#json(response, 405, { error: "Méthode refusée." }, headers);
      response.writeHead(204, headers);
      return response.end();
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      return this.#json(
        response,
        405,
        { error: "Méthode refusée." },
        headers
      );
    }
    if (credentials.resource === "document") return this.#serveDocument(response, request, headers);
    if (credentials.resource === "state") return this.#json(response, 200, {
      matches: projectMatchesOverlayState(readState(this.store, MATCH_OVERLAY_STATE_PATHS))
    }, headers);
    if (credentials.resource === "events") {
      if (request.method !== "GET") return this.#json(response, 405, { error: "Méthode refusée." }, headers);
      const widgetRequested = url.searchParams.has("widget");
      const widget = url.searchParams.get("widget");
      if (widgetRequested && (url.searchParams.getAll("widget").length !== 1 || !MATCH_WIDGET_KEYS.includes(widget))) {
        return this.#json(response, 400, { error: "Widget Match invalide." }, headers);
      }
      response.writeHead(200, { ...headers, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
      response.write(": ShenPulse Match local connected\n\n");
      if (widgetRequested) response.write(`event: bootstrap\ndata: ${JSON.stringify({ channel: "bootstrap", payload: {
        matches: projectMatchesOverlayState(readState(this.store, MATCH_OVERLAY_STATE_PATHS))
      } })}\n\n`);
      registerEventClient({ response, view: widgetRequested ? "match-widget" : "match", screen: 0,
        matchName: "player",
        matchBridgeAccess: { accountNumber: credentials.accountNumber, channelId: credentials.channelId },
        matchBridgeIdentity: this.bridgeIdentity() });
      return;
    }
    if (credentials.resource !== "ticket" || request.method !== "GET") {
      return this.#json(response, 405, { error: "Méthode refusée." }, headers);
    }
    try {
      const playback = this.normalizePlayback({
        match: url.searchParams.get("match"),
        variant: url.searchParams.get("variant"),
        fit: url.searchParams.get("fit")
      });
      return this.#json(
        response,
        200,
        this.#createMediaTicket(playback, {
          accountNumber: credentials.accountNumber,
          channelId: credentials.channelId,
          origin: origin || this.#localOrigin()
        }),
        headers
      );
    } catch (error) {
      return this.#json(
        response,
        400,
        { error: safeString(error.message, 500) },
        headers
      );
    }
  }

  handleSourceRequest({
    credentials,
    url,
    request,
    response,
    registerEventClient
  }) {
    if (!this.isAuthorized(credentials)) {
      return this.#json(response, 401, {
        error: "URL Match invalide ou régénérée."
      });
    }
    if (!this.hasAccess()) return this.#accessDenied(response);
    if (credentials.resource === "document") {
      return this.#serveDocument(response);
    }
    if (credentials.resource === "state") {
      const state = readState(this.store, ["session", "overlaySession"]);
      return this.#json(response, 200, {
        session: state.session,
        overlaySession: state.overlaySession
      });
    }
    if (credentials.resource === "events") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      });
      response.write(": ShenPulse Match connected\n\n");
      registerEventClient({
        response,
        view: "match",
        screen: 0,
        matchName: "player",
        matchAccess: {
          accountNumber: credentials.accountNumber,
          accessKey: credentials.accessKey
        }
      });
      return;
    }
    if (credentials.resource === "ticket") {
      if (request.method !== "GET") {
        return this.#json(response, 405, { error: "Méthode refusée." });
      }
      try {
        const playback = this.normalizePlayback({
          match: url.searchParams.get("match"),
          variant: url.searchParams.get("variant"),
          fit: url.searchParams.get("fit")
        });
        return this.#json(
          response,
          200,
          this.#createMediaTicket(playback, credentials)
        );
      } catch (error) {
        return this.#json(response, 400, {
          error: safeString(error.message, 500)
        });
      }
    }
    return this.#json(response, 404, { error: "Source Match introuvable." });
  }

  handlePreviewTicket(url, request, response) {
    const expected = readState(this.store, ["settings.overlayToken"]).settings?.overlayToken;
    if (!timingSafeToken(url.searchParams.get("token"), expected) || !this.hasAccess() || !this.hasBridgeAccess()) {
      return this.#json(response, 403, { error: "Aperçu Match protégé : accès Pro requis." });
    }
    if (request.method !== "GET") return this.#json(response, 405, { error: "Méthode refusée." });
    const origin = String(request.headers.origin || "");
    if (origin && origin !== this.#localOrigin()) return this.#json(response, 403, { error: "Origine d’aperçu refusée." });
    try {
      const playback = this.normalizePlayback({ match: url.searchParams.get("match"), variant: url.searchParams.get("variant") });
      return this.#json(response, 200, this.#createMediaTicket(playback, { previewToken: expected, origin: this.#localOrigin() }), { "Cache-Control": "no-store" });
    } catch { return this.#json(response, 400, { error: "Cette animation Match est indisponible." }); }
  }

  async serveMedia(url, request, response) {
    this.reconcile();
    this.#pruneMediaTickets();
    const ticketId = /^\/match-media\/([A-Za-z0-9_-]{32})\/?$/.exec(url.pathname)?.[1] || "";
    const ticket = this.mediaTickets.get(ticketId);
    if (
      !ticket ||
      !this.#ticketAuthorized(ticket) ||
      !this.hasAccess() ||
      (ticket?.channelId && !this.hasBridgeAccess())
    ) {
      this.mediaTickets.delete(ticketId);
      return this.#json(response, 403, {
        error: "Ticket vidéo Match expiré ou accès Pro requis."
      });
    }
    let metadata;
    try { metadata = this.protectedMedia.metadata(ticket.fileName); }
    catch {
      this.mediaTickets.delete(ticketId);
      return this.#json(response, 404, { error: "Vidéo Match introuvable." });
    }
    const requestOrigin = String(request.headers.origin || "");
    const expectedOrigin = ticket.origin || "";
    if (requestOrigin && requestOrigin !== (expectedOrigin || this.#localOrigin())) {
      return this.#json(response, 403, { error: "Origine vidéo refusée." });
    }
    const cors = expectedOrigin ? this.#bridgeHeaders(expectedOrigin) : {};
    if (!cors) return this.#json(response, 403, { error: "Origine vidéo refusée." });
    if (request.method === "OPTIONS") {
      const method = String(request.headers["access-control-request-method"] || "GET").toUpperCase();
      if (!expectedOrigin || requestOrigin !== expectedOrigin || !["GET", "HEAD"].includes(method)) {
        return this.#json(response, 403, { error: "Prévol vidéo refusé." });
      }
      response.writeHead(204, cors);
      return response.end();
    }
    if (!["GET", "HEAD"].includes(request.method)) return this.#json(response, 405, { error: "Méthode vidéo refusée." });
    return this.#streamVideo(metadata, ticket, request, response);
  }

  clear() {
    this.mediaTickets.clear();
    for (const response of this.mediaResponses) response.destroy?.();
    this.mediaResponses.clear();
    this.protectedMedia.clear();
    this.mediaIdentity = "";
  }

  /** Révocation immédiate du cache, même sans source SSE actuellement ouverte. */
  reconcile() {
    if (!this.mediaIdentity && !this.mediaTickets.size && !this.protectedMedia.hasResources) return;
    if (!this.hasAccess() || this.mediaIdentity !== this.#mediaIdentity() ||
      ([...this.mediaTickets.values()].some((ticket) => ticket.channelId || ticket.previewToken) && !this.hasBridgeAccess())) this.clear();
    else this.protectedMedia.prune();
  }

  #mediaIdentity() {
    const state = readState(this.store, [...MATCH_BRIDGE_CONTEXT_PATHS, "settings.matchAccess.accessKey", "settings.overlayToken", "settings.publicOverlayRelay.matchChannelId"]);
    return JSON.stringify([state.settings?.account?.uid || "", state.session?.profileId || "", state.settings?.tiktok?.roomId || "",
      state.settings?.matchAccess?.accessKey || "", state.settings?.overlayToken || "", state.settings?.publicOverlayRelay?.matchChannelId || ""]);
  }

  #serveDocument(response, request, headers = {}) {
    const target = path.resolve(this.staticDirectory, "index.html");
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      return this.#json(response, 404, { error: "Lecteur Match introuvable." });
    }
    const document = versionLocalMatchDocument(fs
      .readFileSync(target, "utf8")
      // La base locale est injectée ci-dessous. Son ancien calcul inline
      // public est inutile ici et doit respecter la CSP script-src 'self'.
      // Seul ce script explicitement marqué est supprimé.
      .replace(/<script\s+data-overlay-base-path>[\s\S]*?<\/script>/i, "")
      .replace("<head>", '<head>\n    <base href="/overlay/" />'), this.staticDirectory);
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    });
    if (request?.method === "HEAD") return response.end();
    response.end(document);
  }

  #createMediaTicket(playback, credentials) {
    this.reconcile();
    this.protectedMedia.metadata(`${playback.match}-${playback.variant}.webm`);
    this.mediaIdentity = this.#mediaIdentity();
    this.#pruneMediaTickets();
    while (this.mediaTickets.size >= MAX_MATCH_MEDIA_TICKETS) {
      this.mediaTickets.delete(this.mediaTickets.keys().next().value);
    }
    const id = randomBytes(24).toString("base64url");
    const expiresAt = Date.now() + MATCH_MEDIA_TICKET_TTL_MS;
    this.mediaTickets.set(id, {
      accountNumber: credentials.accountNumber,
      bridgeIdentity: this.bridgeIdentity(),
      ...(credentials.previewToken ? { previewToken: credentials.previewToken, origin: credentials.origin } : credentials.channelId
        ? {
            channelId: credentials.channelId,
            origin: credentials.origin,
          }
        : { accessKey: credentials.accessKey }),
      expiresAt,
      fileName: `${playback.match}-${playback.variant}.webm`
    });
    return {
      url: `/match-media/${id}`,
      expiresAt: new Date(expiresAt).toISOString()
    };
  }

  #pruneMediaTickets() {
    const now = Date.now();
    for (const [id, ticket] of this.mediaTickets) {
      if (ticket.expiresAt <= now) this.mediaTickets.delete(id);
    }
  }

  #ticketAuthorized(ticket) {
    if (ticket.bridgeIdentity !== this.bridgeIdentity()) return false;
    if (ticket.previewToken) return this.hasBridgeAccess() && timingSafeToken(ticket.previewToken, readState(this.store, ["settings.overlayToken"]).settings?.overlayToken);
    return ticket?.channelId
      ? this.isBridgeAuthorized(ticket) && ticket.bridgeIdentity === this.bridgeIdentity()
      : this.isAuthorized(ticket);
  }

  async #streamVideo(metadata, ticket, request, response) {
    const size = metadata.size;
    const origin = ticket.origin || "";
    const headers = {
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "Content-Type": "video/webm",
      "Cross-Origin-Resource-Policy": "cross-origin",
      ...(origin ? this.#bridgeHeaders(origin) || {} : {})
    };
    const range = /^bytes=(\d*)-(\d*)$/i.exec(
      String(request.headers.range || "")
    );
    const suffixLength = range && !range[1] && range[2] ? Number(range[2]) : null;
    const start = suffixLength !== null ? Math.max(0, size - suffixLength) : range?.[1] ? Number(range[1]) : 0;
    const end = suffixLength !== null ? size - 1 : range?.[2]
        ? Math.min(size - 1, Number(range[2]))
      : size - 1;
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      (suffixLength !== null && (!Number.isInteger(suffixLength) || suffixLength <= 0)) ||
      (range && !range[1] && !range[2]) ||
      (request.headers.range && !range) ||
      start < 0 ||
      end < start ||
      start >= size
    ) {
      response.writeHead(416, {
        ...headers,
        "Content-Range": `bytes */${size}`
      });
      return response.end();
    }
    const status = range ? 206 : 200;
    const outputHeaders = {
      ...headers,
      "Content-Length": end - start + 1,
      ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {})
    };
    if (request.method === "HEAD") { response.writeHead(status, outputHeaders); return response.end(); }
    let lease;
    try {
      lease = await this.protectedMedia.acquire(metadata.name);
      if (request.aborted || response.destroyed || !this.#ticketAuthorized(ticket) || !this.hasAccess() ||
        (ticket.channelId && !this.hasBridgeAccess()) || ticket.expiresAt <= Date.now()) {
        lease.release();
        if (!response.destroyed) return this.#json(response, 403, { error: "Lecture Match révoquée." });
        return;
      }
      this.mediaResponses.add(response);
      const finished = () => { this.mediaResponses.delete(response); lease.release(); };
      response.once("close", finished);
      response.once("finish", finished);
      response.writeHead(status, outputHeaders);
      response.end(lease.bytes.subarray(start, end + 1));
    } catch {
      lease?.release();
      if (!response.destroyed && !response.headersSent) return this.#json(response, 503, { error: "Lecture de la vidéo Match protégée indisponible." });
      response.destroy?.();
    }
  }

  #accessDenied(response, request, headers = {}) {
    response.writeHead(403, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    });
    if (request?.method === "HEAD") return response.end();
    response.end(
      '<!doctype html><html hidden><head><meta charset="utf-8"><title>Accès Pro requis</title></head><body></body></html>'
    );
  }

  #bridgeHeaders(origin) {
    let allowedOrigin = "";
    try {
      allowedOrigin = new URL(
        readState(this.store, ["settings.publicOverlayRelay.publicBaseUrl"])
          .settings?.publicOverlayRelay?.publicBaseUrl ||
          "https://shenpulse-overlays.web.app"
      ).origin;
    } catch {
      return null;
    }
    if (!origin || ![allowedOrigin, this.#localOrigin()].includes(origin)) return null;
    return {
      "Access-Control-Allow-Headers": "Content-Type, Range",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Private-Network": "true",
      "Cache-Control": "no-store",
      Vary: "Origin, Access-Control-Request-Private-Network"
    };
  }

  #localOrigin() {
    const port = Number(readState(this.store, ["settings.overlayPort"]).settings?.overlayPort);
    return Number.isInteger(port) && port > 0 && port <= 65535 ? `http://127.0.0.1:${port}` : "";
  }

  #json(response, status, body, headers = {}) {
    response.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    });
    response.end(JSON.stringify(body));
  }
}

module.exports = { MatchSourceService };
