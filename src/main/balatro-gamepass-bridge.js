"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");
const { safeChildPath } = require("./game-runtime/paths");

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

/** Canal local pour le moteur GDK de Balatro, qui ne fournit pas LuaSocket.
 * Un seul message à la fois ; les identifiants et le jeton excluent les réponses anciennes.
 */
class BalatroGamePassBridge extends EventEmitter {
  constructor({ installationPath, timeoutMs = 12000 } = {}) {
    super();
    if (!installationPath) throw new Error("Installez d’abord le module Balatro Game Pass.");
    this.directory = safeChildPath(installationPath, "Assets/shenpulse/channel");
    this.timeoutMs = timeoutMs;
    this.queue = Promise.resolve();
    this.generation = 0;
    this.listening = false;
  }

  async start() {
    const config = await fs.promises.readFile(path.join(this.directory, "config.json"), "utf8").then(JSON.parse);
    if (!/^[a-f0-9]{64}$/.test(config.token || "")) throw new Error("Réparez l’installation du module Balatro Game Pass.");
    this.token = config.token;
    this.listening = true;
    return this.status();
  }

  status() {
    let heartbeat;
    try {
      const file = path.join(this.directory, "ready.json");
      if (fs.statSync(file).size <= 16384) heartbeat = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch { /* Le jeu n’a pas encore publié son état. */ }
    if (heartbeat?.token === this.token) this.heartbeat = heartbeat;
    const connected = Boolean(this.listening && this.heartbeat?.token === this.token && Math.abs(Date.now() - Number(this.heartbeat.at) * 1000) < 6000);
    return { ok: this.listening, listening: this.listening, connected, ready: connected && this.heartbeat.ready === true, type: "balatro-gamepass" };
  }

  send(code, options = {}, { assertAccess = () => {} } = {}) {
    const generation = this.generation;
    const operation = this.queue.then(async () => {
      assertAccess();
      if (generation !== this.generation || !this.status().connected) throw new Error("Balatro Game Pass n’est pas connecté. Lancez-le depuis ShenPulse.");
      const id = crypto.randomBytes(16).toString("hex");
      const request = { id, token: this.token, code, expiresAt: Date.now() + this.timeoutMs, viewer: String(options.viewer || "ShenPulse").slice(0, 120) };
      const requestPath = path.join(this.directory, "request.json");
      const temporary = path.join(this.directory, `request-${id}.tmp`);
      await fs.promises.writeFile(temporary, JSON.stringify(request), { flag: "wx" });
      try {
        assertAccess();
        if (generation !== this.generation) throw new Error("La session Balatro a été arrêtée.");
        await fs.promises.rename(temporary, requestPath);
        const deadline = Date.now() + this.timeoutMs;
        while (Date.now() < deadline) {
          assertAccess();
          if (generation !== this.generation) throw new Error("La session Balatro a été arrêtée.");
          let response;
          try {
            const file = path.join(this.directory, "response.json");
            if ((await fs.promises.stat(file)).size <= 16384) response = JSON.parse(await fs.promises.readFile(file, "utf8"));
          } catch { /* Une écriture du jeu peut être en cours. */ }
          if (response?.id === id && response.token === this.token) {
            if (response.status !== 0) {
              const error = new Error(response.message || "Cet effet n’est pas disponible dans l’état actuel de la manche.");
              error.status = Number(response.status);
              throw error;
            }
            return { status: "success", code, message: response.message || "", metadata: response.metadata || {} };
          }
          await sleep(30);
        }
        throw new Error("Balatro n’a pas confirmé l’interaction. Vérifiez que le jeu est ouvert et qu’une manche est chargée.");
      } finally {
        await fs.promises.rm(temporary, { force: true });
        const pending = await fs.promises.readFile(requestPath, "utf8").then(JSON.parse).catch(() => null);
        if (pending?.id === id) await fs.promises.rm(requestPath, { force: true });
      }
    });
    this.queue = operation.catch(() => {});
    return operation;
  }

  async close() { this.generation++; this.listening = false; this.heartbeat = null; }
}

module.exports = { BalatroGamePassBridge };
