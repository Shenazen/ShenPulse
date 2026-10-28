"use strict";

const { EventEmitter } = require("node:events");
const fs = require("node:fs/promises");
const path = require("node:path");
const net = require("node:net");
const { randomUUID } = require("node:crypto");
const { safeChildPath } = require("./game-runtime/paths");

const SHOP_GAMES = Object.freeze({
  "hogwarts-legacy": { directory: "ue4ss/Mods/ShenPulse", transport: "file" },
  "tcg-card-shop-simulator": { port: 58447 },
  "supermarket-simulator": { port: 58448 },
  "shift-at-midnight": { port: 58446 }
});

const LOCAL_MOD_GAMES = Object.freeze({...SHOP_GAMES, palworld:{directory:"ue4ss/Mods/ShenPulse",transport:"file"}});

/** Protocoles locaux des modules ; un résultat est toujours corrélé à sa demande. */
class ShopGameBridge extends EventEmitter {
  constructor({ gameId, installationPath, timeoutMs = 12000, label = "Le jeu" }) {
    super();
    if (!Object.hasOwn(LOCAL_MOD_GAMES, gameId)) throw new Error("Module de jeu inconnu.");
    this.gameId = gameId;
    this.installationPath = installationPath || "";
    this.timeoutMs = Math.min(30000, Math.max(1000, Number(timeoutMs) || 12000));
    this.label = label;
    this.connected = false;
    this.generation = 0;
    this.tail = Promise.resolve();
  }

  async config() {
    if (!this.installationPath) throw new Error(`Installez d’abord les interactions de ${this.label}.`);
    const definition = LOCAL_MOD_GAMES[this.gameId];
    const relative = definition.transport === "file" ? `${definition.directory}/bridge.json` : `BepInEx/config/ShenPulse.${this.gameId}.json`;
    const config = JSON.parse(await fs.readFile(safeChildPath(this.installationPath, relative), "utf8"));
    if (!/^[a-f0-9]{64}$/.test(config.token || "") || config.gameId !== this.gameId || (definition.port && config.port !== definition.port)) {
      throw new Error(`La configuration du module ${this.label} est invalide. Réinstallez les interactions.`);
    }
    return config;
  }

  async start() {
    try {
      const result = await this.request("__status", {}, { timeoutMs: 1000 });
      this.connected = result.gameId === this.gameId;
      this.ready = result.ready === true;
    } catch { this.connected = false; this.ready = false; }
    return this.status();
  }

  status() { return { ok: this.connected, connected: this.connected, listening: false, ready: this.ready === true, type: "shop-mod" }; }

  send(code, options = {}, { assertAccess = () => {} } = {}) {
    const generation = this.generation;
    const job = this.tail.catch(() => {}).then(async () => {
      assertAccess();
      if (generation !== this.generation) throw new Error("La session de jeu a été arrêtée.");
      const response = await this.request(code, options, { assertAccess, generation });
      if (response.status !== 0) {
        const error = new Error(response.message || "Cette interaction est indisponible dans la situation actuelle.");
        error.status = response.status;
        throw error;
      }
      return { ...response, status: "success", executionConfirmed: response.executionConfirmed === true };
    });
    this.tail = job;
    return job;
  }

  async request(code, options, { assertAccess = () => {}, generation = this.generation, timeoutMs = this.timeoutMs } = {}) {
    const config = await this.config();
    assertAccess();
    if (generation !== this.generation) throw new Error("La session de jeu a été arrêtée.");
    const request = {
      id: randomUUID(), token: config.token, code: String(code), gameId: this.gameId,
      viewer: String(options.viewer || "ShenPulse").slice(0, 120),
      quantity: Math.min(100000, Math.max(1, Math.floor(Number(options.quantity) || 1))),
      duration: Math.min(600, Math.max(0, Number(options.duration) || 0)),
      parameters: options.parameters || {}, expiresAt: Date.now() + timeoutMs - 100
    };
    const response = LOCAL_MOD_GAMES[this.gameId].transport === "file"
      ? await this.fileRequest(request, timeoutMs, assertAccess, generation)
      : await this.tcpRequest(request, config.port, timeoutMs, () => {
        assertAccess();
        if (generation !== this.generation) throw new Error("La session de jeu a été arrêtée.");
      });
    assertAccess();
    if (generation !== this.generation) throw new Error("La session de jeu a été arrêtée.");
    if (response.id !== request.id || response.gameId !== this.gameId || !Number.isInteger(response.status)) throw new Error("Réponse du module de jeu invalide.");
    this.connected = true;
    return response;
  }

  tcpRequest(request, port, timeoutMs, beforeWrite = () => {}) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      let buffer = "", settled = false;
      const finish = (error, response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        if (error) { this.connected = false; reject(error); } else resolve(response);
      };
      const timer = setTimeout(() => finish(new Error(`${this.label} n’a pas répondu. Chargez une partie et fermez les menus.`)), timeoutMs);
      socket.once("connect", () => {
        try { beforeWrite(); socket.write(JSON.stringify(request) + "\n"); }
        catch (error) { finish(error); }
      });
      socket.on("data", bytes => {
        buffer += bytes.toString("utf8");
        if (buffer.length > 65536) return finish(new Error("Réponse du module trop volumineuse."));
        const end = buffer.indexOf("\n");
        if (end < 0) return;
        try { finish(null, JSON.parse(buffer.slice(0, end))); } catch { finish(new Error("Réponse JSON du module invalide.")); }
      });
      socket.once("error", () => finish(new Error(`${this.label} n’est pas connecté à ShenPulse. Installez les interactions puis relancez le jeu depuis ShenPulse.`)));
      socket.once("end", () => { if (!settled) finish(new Error("Le module a fermé la connexion sans résultat.")); });
    });
  }

  async fileRequest(request, timeoutMs, assertAccess, generation) {
    const directory = safeChildPath(this.installationPath, LOCAL_MOD_GAMES[this.gameId].directory);
    if (request.code === "__status") {
      const deadline = Date.now() + timeoutMs;
      do {
        assertAccess();
        if (generation !== this.generation) throw new Error("La session de jeu a été arrêtée.");
        const state = await fs.readFile(path.join(directory, "ready.json"), "utf8").then(JSON.parse).catch(() => null);
        if (state?.token === request.token && Number.isFinite(state.at) && Math.abs(Date.now() - state.at * 1000) <= 5000) return { ...state, id: request.id, gameId: this.gameId, status: 0 };
        await new Promise(resolve => setTimeout(resolve, 40));
      } while (Date.now() < deadline);
      throw new Error(`Le module ${this.label} n’est pas actif.`);
    }
    // Encodage de données Lua uniquement : aucune expression fournie par l’appelant.
    const string = value => '"' + String(value).replace(/[\\"\x00-\x1f\x7f]/g, c => `\\${c.charCodeAt(0).toString().padStart(3, "0")}`) + '"';
    const fields = { ...request, parameters: undefined, amount: Number(request.parameters.amount || 0) };
    delete fields.parameters;
    const content = "return {" + Object.entries(fields).map(([key, value]) => `${key}=${typeof value === "number" ? (Number.isFinite(value) ? value : 0) : string(value)}`).join(",") + "}\n";
    const destination = path.join(directory, "request.lua"), temporary = `${destination}.${request.id}.tmp`;
    await fs.writeFile(temporary, content, { flag: "wx" });
    try {
      assertAccess();
      if (generation !== this.generation) throw new Error("La session de jeu a été arrêtée.");
      await fs.rename(temporary, destination);
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        assertAccess();
        if (generation !== this.generation) throw new Error("La session de jeu a été arrêtée.");
        const result = await fs.readFile(path.join(directory, "result.json"), "utf8").then(JSON.parse).catch(() => null);
        if (result?.id === request.id) return result;
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      throw new Error(`${this.label} n’a pas confirmé l’interaction. Reprenez la partie hors menus.`);
    } finally {
      await fs.rm(temporary, { force: true });
      const remaining = await fs.readFile(destination, "utf8").catch(() => "");
      if (remaining === content) await fs.rm(destination, { force: true });
    }
  }

  async close() { this.generation += 1; this.connected = false; this.ready = false; }
}

module.exports = { ShopGameBridge, SHOP_GAMES };
