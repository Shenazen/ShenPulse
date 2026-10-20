"use strict";

const http = require("node:http");
const { EventEmitter } = require("node:events");
const { WebSocketServer, WebSocket } = require("ws");

/** Serveur exclusivement local du protocole JSON du mod IL2CPP. */
class SimpleWebSocketGameBridge extends EventEmitter {
  constructor({ host = "127.0.0.1", port, timeoutMs = 12000, label = "Le jeu" } = {}) {
    super();
    Object.assign(this, { host, port: Number(port), timeoutMs, label });
    this.server = null;
    this.websockets = null;
    this.client = null;
    this.pending = new Map();
    this.nextRequestId = 0;
    this.startPromise = null;
  }

  async start() {
    if (this.server?.listening) return this.status();
    if (this.startPromise) return this.startPromise;
    if (!["127.0.0.1", "::1"].includes(this.host) ||
        !Number.isInteger(this.port) || this.port < 0 || this.port > 65535) {
      throw new Error("La passerelle locale du jeu est mal configurée.");
    }
    this.startPromise = new Promise((resolve, reject) => {
      const server = http.createServer((_request, response) => {
        response.writeHead(404).end();
      });
      const sockets = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024, perMessageDeflate: false });
      this.server = server;
      this.websockets = sockets;
      server.on("upgrade", (request, socket, head) => {
        // Le mod natif n'envoie pas d'Origin : interdire les pages Web tierces.
        if (request.headers.origin || request.url !== "/") {
          socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
          return;
        }
        sockets.handleUpgrade(request, socket, head, (client) => this.#attach(client));
      });
      const onError = (error) => {
        if (this.server === server) this.server = null;
        sockets.close();
        reject(error.code === "EADDRINUSE"
          ? new Error(`Le port local ${this.port} est déjà utilisé. Fermez l’ancienne session du jeu, puis réessayez.`)
          : error);
      };
      server.once("error", onError);
      server.listen({ host: this.host, port: this.port, exclusive: true }, () => {
        server.off("error", onError);
        server.on("error", (error) => this.emit("error", error));
        this.port = server.address().port;
        resolve(this.status());
      });
    }).finally(() => { this.startPromise = null; });
    return this.startPromise;
  }

  status() {
    return {
      ok: Boolean(this.server?.listening), listening: Boolean(this.server?.listening),
      connected: this.client?.readyState === WebSocket.OPEN,
      host: this.host, port: this.port
    };
  }

  async send(effectId, options = {}, { assertAccess = () => {} } = {}) {
    assertAccess();
    await this.start();
    assertAccess();
    const client = this.client;
    if (client?.readyState !== WebSocket.OPEN) {
      throw new Error(`${this.label} n’est pas encore connecté à ShenPulse. Lancez le jeu depuis ShenPulse et chargez une partie.`);
    }
    const id = ++this.nextRequestId;
    const payload = {
      id, type: 1, code: String(effectId || ""), viewer: String(options.viewer || "ShenPulse"),
      quantity: Math.max(1, Number(options.quantity || 1)),
      duration: Math.max(0, Number(options.duration || 0)), parameters: { ...(options.parameters || {}) }
    };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${this.label} n’a pas confirmé l’interaction. Vérifiez que votre partie est chargée.`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      client.send(JSON.stringify(payload), (error) => {
        if (!error) return;
        const pending = this.pending.get(id);
        if (!pending) return;
        clearTimeout(pending.timeout);
        this.pending.delete(id);
        reject(error);
      });
    });
  }

  async close() {
    if (this.startPromise) await this.startPromise.catch(() => {});
    this.#rejectPending(new Error("La session de jeu a été arrêtée avant la fin de l’interaction."));
    this.client = null;
    for (const client of this.websockets?.clients || []) client.terminate();
    this.websockets?.close();
    this.websockets = null;
    const server = this.server;
    this.server = null;
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
  }

  #attach(client) {
    if (this.client) {
      this.#rejectPending(new Error(`${this.label} a renouvelé sa connexion à ShenPulse.`));
      this.client.terminate();
    }
    this.client = client;
    client.on("message", (data, binary) => {
      if (this.client !== client || binary) return;
      let message;
      try { message = JSON.parse(data.toString()); } catch { return; }
      if (!message || typeof message !== "object" || Array.isArray(message)) return;
      // Les états du jeu (253), le keepalive (255) et les mises à jour
      // d'effets temporisés (1) ne sont jamais des accusés de déclenchement.
      if (message.type !== 0) {
        this.emit("message", message);
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending || !Number.isInteger(message.status)) return;
      clearTimeout(pending.timeout);
      this.pending.delete(message.id);
      const result = { ok: message.status === 0, status: message.status, requestId: message.id, message: String(message.message || "") };
      if (result.ok) pending.resolve(result);
      else {
        const error = new Error(result.message || `${this.label} a refusé cette interaction.`);
        error.status = result.status;
        error.requestId = result.requestId;
        pending.reject(error);
      }
    });
    client.on("error", () => {});
    client.on("close", () => {
      if (this.client !== client) return;
      this.client = null;
      this.#rejectPending(new Error(`${this.label} s’est déconnecté de ShenPulse.`));
      this.emit("disconnected");
    });
    this.emit("connected", this.status());
  }

  #rejectPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

module.exports = { SimpleWebSocketGameBridge };
