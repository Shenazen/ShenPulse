"use strict";

const net = require("node:net");
const { EventEmitter } = require("node:events");

class SimpleTcpServerBridge extends EventEmitter {
  constructor({
    host = "127.0.0.1",
    port,
    timeoutMs = 12000,
    label = "Le jeu"
  } = {}) {
    super();
    this.host = host;
    this.port = Number(port);
    this.timeoutMs = Math.max(1000, Number(timeoutMs || 12000));
    this.label = String(label || "Le jeu");
    this.server = null;
    this.client = null;
    this.buffer = "";
    this.pending = new Map();
    this.nextRequestId = 0;
    this.startPromise = null;
  }

  async start() {
    if (this.server?.listening) return this.status();
    if (this.startPromise) return this.startPromise;
    if (
      !["127.0.0.1", "localhost", "::1"].includes(this.host) ||
      !Number.isInteger(this.port) ||
      this.port < 0 ||
      this.port > 65535
    ) {
      throw new Error("La passerelle locale du jeu est mal configurée.");
    }

    this.startPromise = new Promise((resolve, reject) => {
      const server = net.createServer((socket) => this.#attach(socket));
      this.server = server;
      const onError = (error) => {
        server.off("listening", onListening);
        this.server = null;
        if (error?.code === "EADDRINUSE") {
          reject(
            new Error(
              `Le port local ${this.port} est déjà utilisé. Fermez l’ancien launcher ou l’autre application de jeu, puis réessayez.`
            )
          );
          return;
        }
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        server.on("error", (error) => this.emit("error", error));
        const address = server.address();
        if (address && typeof address === "object") {
          this.port = address.port;
        }
        resolve(this.status());
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen({
        host: this.host,
        port: this.port,
        exclusive: true
      });
    }).finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  status() {
    return {
      ok: Boolean(this.server?.listening),
      listening: Boolean(this.server?.listening),
      connected: Boolean(this.client && !this.client.destroyed),
      host: this.host,
      port: this.port
    };
  }

  async send(effectId, options = {}) {
    await this.start();
    const socket = this.client;
    if (!socket || socket.destroyed) {
      throw new Error(
        `${this.label} n’est pas encore connecté à ShenPulse. Lancez le jeu depuis ShenPulse, chargez votre partie, puis attendez quelques secondes avant de réessayer.`
      );
    }

    const requestId = ++this.nextRequestId;
    const payload = {
      id: requestId,
      type: 1,
      code: String(effectId || ""),
      quantity: Math.max(1, Number(options.quantity || 1)),
      duration: Math.max(0, Number(options.duration || 0))
    };
    const reservedFields = new Set([
      "id",
      "type",
      "code",
      "quantity",
      "duration"
    ]);
    for (const [key, value] of Object.entries(
      options.parameters || {}
    )) {
      if (
        reservedFields.has(key) ||
        !/^[a-z][a-z0-9_]*$/i.test(key)
      ) {
        continue;
      }
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) {
        payload[key] = numericValue;
      }
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(
          new Error(
            `${this.label} a reçu l’interaction mais n’a pas répondu. Vérifiez que la partie est complètement chargée.`
          )
        );
      }, this.timeoutMs);
      this.pending.set(requestId, { resolve, reject, timeout });
      socket.write(
        Buffer.from(`${JSON.stringify(payload)}\0`, "utf8"),
        (error) => {
          if (!error) return;
          const pending = this.pending.get(requestId);
          if (!pending) return;
          clearTimeout(pending.timeout);
          this.pending.delete(requestId);
          reject(
            new Error(
              `La connexion avec ${this.label.toLowerCase()} a été interrompue. Relancez le jeu depuis ShenPulse.`
            )
          );
        }
      );
    });
  }

  async close() {
    this.#rejectPending(
      new Error("La session de jeu a été arrêtée avant la fin de l’interaction.")
    );
    const client = this.client;
    this.client = null;
    this.buffer = "";
    client?.destroy();
    const server = this.server;
    this.server = null;
    if (!server) return;
    await new Promise((resolve) => {
      if (!server.listening) {
        resolve();
        return;
      }
      server.close(() => resolve());
    });
  }

  #attach(socket) {
    const previous = this.client;
    if (previous && previous !== socket) {
      previous.destroy();
      this.#rejectPending(
        new Error(`${this.label} a renouvelé sa connexion à ShenPulse.`)
      );
    }
    this.client = socket;
    this.buffer = "";
    socket.setNoDelay(true);
    socket.setKeepAlive(true);
    socket.on("data", (chunk) => this.#consume(chunk));
    socket.on("error", () => {});
    socket.on("close", () => {
      if (this.client !== socket) return;
      this.client = null;
      this.buffer = "";
      this.#rejectPending(
        new Error(
          `${this.label} s’est déconnecté de ShenPulse. Vérifiez que le jeu est toujours ouvert.`
        )
      );
      this.emit("disconnected");
    });
    this.emit("connected", this.status());
  }

  #consume(chunk) {
    this.buffer += chunk.toString("utf8");
    let separator = this.buffer.indexOf("\0");
    while (separator >= 0) {
      const frame = this.buffer.slice(0, separator);
      this.buffer = this.buffer.slice(separator + 1);
      if (frame) this.#handleFrame(frame);
      separator = this.buffer.indexOf("\0");
    }
    if (this.buffer.length > 1024 * 1024) this.buffer = "";
  }

  #handleFrame(frame) {
    let message;
    try {
      message = JSON.parse(frame);
    } catch {
      this.emit("message", { raw: frame });
      return;
    }
    const requestId = Number(message.id);
    const pending = this.pending.get(requestId);
    if (!pending) {
      this.emit("message", message);
      return;
    }
    clearTimeout(pending.timeout);
    this.pending.delete(requestId);
    const status = Number(message.status);
    const result = {
      ok: status === 0 || status === 8,
      status,
      requestId,
      message: String(message.message || "")
    };
    if (result.ok) {
      pending.resolve(result);
      return;
    }
    pending.reject(
      new Error(result.message || `${this.label} a refusé cette interaction.`)
    );
  }

  #rejectPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

module.exports = { SimpleTcpServerBridge };
