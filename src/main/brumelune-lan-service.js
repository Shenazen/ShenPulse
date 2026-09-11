"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_PORT = 21845;
const MAX_BODY_BYTES = 64 * 1024;

class BrumeluneLanService {
  constructor({ companionDirectory, preferredPort = DEFAULT_PORT } = {}) {
    this.companionDirectory = companionDirectory || path.join(
      __dirname,
      "..",
      "renderer",
      "games",
      "brumelune-companion"
    );
    this.preferredPort = preferredPort;
    this.server = null;
    this.port = 0;
    this.session = null;
    this.actions = [];
  }

  async start(payload = {}) {
    await this.#ensureServer();
    const players = sanitizePlayers(payload.players);
    const roomCode = sanitizeCode(payload.roomCode, 8) || randomCode(6);
    const spectatorMode = payload.spectatorMode === "omniscient"
      ? "omniscient"
      : "detective";
    const access = Object.fromEntries(
      players.map((player) => [
        player.id,
        {
          playerId: player.id,
          name: player.name,
          pin: sanitizePin(player.pin) || randomDigits(4),
          token: randomToken(),
          lastSeenAt: 0
        }
      ])
    );
    this.session = {
      roomCode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      spectatorEnabled: payload.spectatorEnabled !== false,
      spectatorMode,
      spectatorPin: randomDigits(4),
      omniscientPin: randomDigits(6),
      access,
      spectatorTokens: new Map(),
      publicState: sanitizeState(payload.publicState),
      privateStates: sanitizeStateMap(payload.privateStates),
      omniscientState: sanitizeState(payload.omniscientState)
    };
    this.actions = [];
    return this.info();
  }

  update(payload = {}) {
    if (!this.session) throw new Error("Aucune salle Brumelune active.");
    this.session.publicState = sanitizeState(payload.publicState);
    this.session.privateStates = sanitizeStateMap(payload.privateStates);
    this.session.omniscientState = sanitizeState(payload.omniscientState);
    this.session.updatedAt = Date.now();
    return this.info();
  }

  info() {
    if (!this.session || !this.server) return { active: false };
    const address = preferredLanAddress();
    const origin = `http://${address}:${this.port}`;
    return {
      active: true,
      roomCode: this.session.roomCode,
      port: this.port,
      address,
      url: `${origin}/?room=${encodeURIComponent(this.session.roomCode)}`,
      localUrl: `http://127.0.0.1:${this.port}/?room=${encodeURIComponent(this.session.roomCode)}`,
      spectatorPin: this.session.spectatorPin,
      omniscientPin: this.session.omniscientPin,
      players: Object.values(this.session.access).map((entry) => ({
        id: entry.playerId,
        name: entry.name,
        pin: entry.pin,
        connected: Date.now() - entry.lastSeenAt < 12_000
      }))
    };
  }

  drainActions() {
    const entries = this.actions.splice(0, this.actions.length);
    return { actions: entries, info: this.info() };
  }

  async stop() {
    this.session = null;
    this.actions = [];
    if (!this.server) return { stopped: false };
    const server = this.server;
    this.server = null;
    this.port = 0;
    await new Promise((resolve) => server.close(() => resolve()));
    return { stopped: true };
  }

  async #ensureServer() {
    if (this.server) return;
    const server = http.createServer((request, response) => {
      this.#handleRequest(request, response).catch((error) => {
        sendJson(response, error.statusCode || 500, {
          error: error.statusCode ? error.message : "Erreur du compagnon Brumelune."
        });
      });
    });
    const port = await listenOnAvailablePort(server, this.preferredPort);
    this.server = server;
    this.port = port;
  }

  async #handleRequest(request, response) {
    const requestUrl = new URL(request.url || "/", "http://localhost");
    applySecurityHeaders(response);
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/health") {
      sendJson(response, 200, {
        ok: true,
        active: Boolean(this.session),
        roomCode: this.session?.roomCode || ""
      });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/join") {
      await this.#join(request, response);
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/state") {
      this.#state(requestUrl, response);
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/action") {
      await this.#action(request, response);
      return;
    }
    if (request.method === "GET") {
      this.#serveAsset(requestUrl.pathname, response);
      return;
    }
    sendJson(response, 404, { error: "Route inconnue." });
  }

  async #join(request, response) {
    const body = await readJsonBody(request);
    const session = this.#requireRoom(body.roomCode);
    const mode = body.mode === "spectator" ? "spectator" : "player";
    if (mode === "spectator") {
      if (!session.spectatorEnabled) throw httpError(403, "Les spectateurs sont désactivés.");
      const requestedOmniscient = body.omniscient === true;
      const expectedPin = requestedOmniscient ? session.omniscientPin : session.spectatorPin;
      if (sanitizePin(body.pin) !== expectedPin) throw httpError(403, "Code spectateur incorrect.");
      const token = randomToken();
      session.spectatorTokens.set(token, {
        name: sanitizeName(body.name) || "Spectateur",
        omniscient: requestedOmniscient,
        lastSeenAt: Date.now()
      });
      sendJson(response, 200, { token, mode, omniscient: requestedOmniscient });
      return;
    }
    const playerId = sanitizeId(body.playerId);
    const playerName = sanitizeName(body.playerId).toLocaleLowerCase("fr");
    const entry = session.access[playerId] || Object.values(session.access).find(
      (candidate) => candidate.name.toLocaleLowerCase("fr") === playerName
    );
    if (!entry || sanitizePin(body.pin) !== entry.pin) throw httpError(403, "Joueur ou code personnel incorrect.");
    entry.token = randomToken();
    entry.lastSeenAt = Date.now();
    sendJson(response, 200, { token: entry.token, mode, playerId: entry.playerId, name: entry.name });
  }

  #state(requestUrl, response) {
    const session = this.#requireRoom(requestUrl.searchParams.get("room"));
    const identity = this.#identity(session, requestUrl.searchParams.get("token"));
    if (identity.mode === "player") {
      identity.entry.lastSeenAt = Date.now();
      sendJson(response, 200, session.privateStates[identity.entry.playerId] || session.publicState);
      return;
    }
    identity.entry.lastSeenAt = Date.now();
    sendJson(
      response,
      200,
      identity.entry.omniscient
        ? session.omniscientState
        : session.publicState
    );
  }

  async #action(request, response) {
    const body = await readJsonBody(request);
    const session = this.#requireRoom(body.roomCode);
    const identity = this.#identity(session, body.token);
    const type = ["night-action", "vote", "confirm-role", "prediction", "ready"].includes(body.type)
      ? body.type
      : "";
    if (!type) throw httpError(400, "Action invalide.");
    if (identity.mode === "spectator" && type !== "prediction") throw httpError(403, "Un spectateur ne peut pas agir dans la partie.");
    if (identity.mode === "player" && type === "prediction") throw httpError(403, "Cette action est réservée aux spectateurs.");
    const actorId = identity.mode === "player" ? identity.entry.playerId : `spectator:${body.token.slice(0, 12)}`;
    this.actions.push({
      id: crypto.randomUUID(),
      actorId,
      actorName: identity.entry.name,
      mode: identity.mode,
      type,
      payload: sanitizeActionPayload(body.payload),
      createdAt: Date.now()
    });
    if (this.actions.length > 500) this.actions.splice(0, this.actions.length - 500);
    sendJson(response, 202, { accepted: true });
  }

  #identity(session, token) {
    const cleanToken = String(token || "");
    const player = Object.values(session.access).find((entry) => timingSafeEqual(entry.token, cleanToken));
    if (player) return { mode: "player", entry: player };
    const spectator = session.spectatorTokens.get(cleanToken);
    if (spectator) return { mode: "spectator", entry: spectator };
    throw httpError(401, "Session expirée. Reconnectez-vous.");
  }

  #requireRoom(roomCode) {
    if (!this.session || sanitizeCode(roomCode, 8) !== this.session.roomCode) throw httpError(404, "Salle Brumelune introuvable.");
    return this.session;
  }

  #serveAsset(pathname, response) {
    const fileName = pathname === "/" ? "index.html" : path.basename(pathname);
    const allowed = new Set(["index.html", "companion.css", "companion.js"]);
    if (!allowed.has(fileName)) {
      sendJson(response, 404, { error: "Fichier introuvable." });
      return;
    }
    const filePath = path.join(this.companionDirectory, fileName);
    const content = fs.readFileSync(filePath);
    response.writeHead(200, {
      "Content-Type": fileName.endsWith(".html")
        ? "text/html; charset=utf-8"
        : fileName.endsWith(".css")
          ? "text/css; charset=utf-8"
          : "text/javascript; charset=utf-8",
      "Cache-Control": "no-store"
    });
    response.end(content);
  }
}

function sanitizePlayers(players) {
  const seen = new Set();
  return (Array.isArray(players) ? players : []).slice(0, 30).map((player, index) => {
    let id = sanitizeId(player?.id) || `player-${index + 1}`;
    if (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    return {
      id,
      name: sanitizeName(player?.name) || `Joueur ${index + 1}`,
      pin: sanitizePin(player?.pin)
    };
  });
}

function sanitizeState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > 2 * 1024 * 1024) throw new Error("État Brumelune trop volumineux.");
  return JSON.parse(serialized);
}

function sanitizeStateMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 30)
      .map(([key, state]) => [sanitizeId(key), sanitizeState(state)])
      .filter(([key]) => key)
  );
}

function sanitizeActionPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const allowed = ["stepId", "targetId", "targetIds", "choice", "camp", "eventId", "borrowedAction", "guessedCamp", "guessedRoleId", "playerId", "confidence", "skip"];
  return Object.fromEntries(
    allowed
      .filter((key) => key in payload)
      .map((key) => [key, Array.isArray(payload[key]) ? payload[key].slice(0, 2).map((item) => String(item).slice(0, 80)) : String(payload[key]).slice(0, 160)])
  );
}

function sanitizeId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function sanitizeName(value) {
  return String(value || "").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 40);
}

function sanitizeCode(value, maxLength) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, maxLength);
}

function sanitizePin(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 8);
}

function randomToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function randomCode(length) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(length), (byte) => alphabet[byte % alphabet.length]).join("");
}

function randomDigits(length) {
  return Array.from(crypto.randomBytes(length), (byte) => String(byte % 10)).join("");
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function preferredLanAddress() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal && !entry.address.startsWith("169.254.")) return entry.address;
    }
  }
  return "127.0.0.1";
}

function applySecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(httpError(413, "Requête trop volumineuse."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(httpError(400, "Corps JSON invalide."));
      }
    });
    request.on("error", reject);
  });
}

function listenOnAvailablePort(server, preferredPort) {
  return new Promise((resolve, reject) => {
    let candidate = Number(preferredPort) || DEFAULT_PORT;
    const tryListen = () => {
      const onError = (error) => {
        server.off("listening", onListening);
        if (error.code === "EADDRINUSE" && candidate < preferredPort + 20) {
          candidate += 1;
          setImmediate(tryListen);
          return;
        }
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve(candidate);
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(candidate, "0.0.0.0");
    };
    tryListen();
  });
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  BrumeluneLanService,
  preferredLanAddress,
  sanitizeActionPayload,
  sanitizePlayers
};
