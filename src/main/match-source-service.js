"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const {
  matchAccountNumber,
  matchSourcePath,
  parseMatchBridgePath,
  parseMatchSourcePath
} = require("./match-access");
const { safeString, timingSafeToken } = require("./utils");

const MATCH_MEDIA_TICKET_TTL_MS = 90_000;
const MAX_MATCH_MEDIA_TICKETS = 100;

/**
 * Domaine autonome de la source Match.
 *
 * Il ne connaît ni les autres overlays ni leurs jetons. Son unique contrat
 * porte sur l'identité du compte, l'accès Pro et la lecture d'un fichier Match
 * à travers un ticket opaque de courte durée.
 */
class MatchSourceService {
  constructor({ store, staticDirectory, hasAccess, normalizePlayback }) {
    this.store = store;
    this.staticDirectory = staticDirectory;
    this.hasAccess = hasAccess;
    this.normalizePlayback = normalizePlayback;
    this.mediaTickets = new Map();
  }

  parse(pathname) {
    return parseMatchSourcePath(pathname);
  }

  parseBridge(pathname) {
    return parseMatchBridgePath(pathname);
  }

  sourceUrl(baseUrl, { includeRestricted = false } = {}) {
    const state = this.store.getState();
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
    const settings = this.store.getState().settings || {};
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
    const settings = this.store.getState().settings || {};
    return (
      credentials.accountNumber === matchAccountNumber(settings.account?.uid) &&
      timingSafeToken(
        credentials.channelId,
        settings.publicOverlayRelay?.matchChannelId
      )
    );
  }

  handleBridgeRequest({ credentials, url, request, response }) {
    const origin = String(request.headers.origin || "");
    const headers = this.#bridgeHeaders(origin);
    if (!headers || !this.isBridgeAuthorized(credentials)) {
      return this.#json(response, 403, {
        error: "Source Match publique invalide ou régénérée."
      });
    }
    if (request.method === "OPTIONS") {
      response.writeHead(204, headers);
      return response.end();
    }
    if (!this.hasAccess()) {
      return this.#json(
        response,
        403,
        { error: "Un abonnement Pro actif est requis." },
        headers
      );
    }
    if (credentials.resource !== "ticket" || request.method !== "GET") {
      return this.#json(
        response,
        405,
        { error: "Méthode refusée." },
        headers
      );
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
          origin
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
      const state = this.store.getState();
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

  serveMedia(url, request, response) {
    this.#pruneMediaTickets();
    const ticketId = String(url.pathname.split("/").filter(Boolean)[1] || "");
    const ticket = this.mediaTickets.get(ticketId);
    if (
      !ticket ||
      !this.#ticketAuthorized(ticket) ||
      !this.hasAccess()
    ) {
      this.mediaTickets.delete(ticketId);
      return this.#json(response, 403, {
        error: "Ticket vidéo Match expiré ou accès Pro requis."
      });
    }
    const videoDirectory = path.resolve(
      this.staticDirectory,
      "media",
      "video"
    );
    const target = path.resolve(videoDirectory, ticket.fileName);
    if (
      !target.startsWith(`${videoDirectory}${path.sep}`) ||
      !fs.existsSync(target) ||
      !fs.statSync(target).isFile()
    ) {
      this.mediaTickets.delete(ticketId);
      return this.#json(response, 404, { error: "Vidéo Match introuvable." });
    }
    const requestOrigin = String(request.headers.origin || "");
    if (requestOrigin && ticket.origin && requestOrigin !== ticket.origin) {
      return this.#json(response, 403, { error: "Origine vidéo refusée." });
    }
    return this.#streamVideo(target, request, response, ticket.origin);
  }

  clear() {
    this.mediaTickets.clear();
  }

  #serveDocument(response) {
    const target = path.resolve(this.staticDirectory, "index.html");
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      return this.#json(response, 404, { error: "Lecteur Match introuvable." });
    }
    const document = fs
      .readFileSync(target, "utf8")
      .replace("<head>", '<head>\n    <base href="/overlay/" />');
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    });
    response.end(document);
  }

  #createMediaTicket(playback, credentials) {
    this.#pruneMediaTickets();
    while (this.mediaTickets.size >= MAX_MATCH_MEDIA_TICKETS) {
      this.mediaTickets.delete(this.mediaTickets.keys().next().value);
    }
    const id = randomBytes(24).toString("base64url");
    const expiresAt = Date.now() + MATCH_MEDIA_TICKET_TTL_MS;
    this.mediaTickets.set(id, {
      accountNumber: credentials.accountNumber,
      ...(credentials.channelId
        ? {
            channelId: credentials.channelId,
            origin: credentials.origin
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
    return ticket?.channelId
      ? this.isBridgeAuthorized(ticket)
      : this.isAuthorized(ticket);
  }

  #streamVideo(target, request, response, origin = "") {
    const size = fs.statSync(target).size;
    const headers = {
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "Content-Type": "video/webm",
      "Cross-Origin-Resource-Policy": "cross-origin",
      ...(origin ? { "Access-Control-Allow-Origin": origin } : {})
    };
    const range = /^bytes=(\d*)-(\d*)$/i.exec(
      String(request.headers.range || "")
    );
    if (!range) {
      response.writeHead(200, { ...headers, "Content-Length": size });
      if (request.method === "HEAD") return response.end();
      return fs.createReadStream(target).pipe(response);
    }
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2]
      ? Math.min(size - 1, Number(range[2]))
      : size - 1;
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
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
    response.writeHead(206, {
      ...headers,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${size}`
    });
    if (request.method === "HEAD") return response.end();
    return fs.createReadStream(target, { start, end }).pipe(response);
  }

  #accessDenied(response) {
    response.writeHead(403, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    });
    response.end(
      '<!doctype html><html hidden><head><meta charset="utf-8"><title>Accès Pro requis</title></head><body></body></html>'
    );
  }

  #bridgeHeaders(origin) {
    let allowedOrigin = "";
    try {
      allowedOrigin = new URL(
        this.store.getState().settings?.publicOverlayRelay?.publicBaseUrl ||
          "https://shenpulse-overlays.web.app"
      ).origin;
    } catch {
      return null;
    }
    if (!origin || origin !== allowedOrigin) return null;
    return {
      "Access-Control-Allow-Headers": "Content-Type, Range",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Private-Network": "true",
      "Cache-Control": "no-store",
      Vary: "Origin, Access-Control-Request-Private-Network"
    };
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
