"use strict";

const { readState } = require("./state-projection");

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { assertAdminAccount } = require("./account-access");
const { safeString, timingSafeToken } = require("./utils");
const { jsonResponse, readRequestBody, listenLoopback, closeServer } = require("./integration-http");
const { normalizeMidiMessage, controllerActionTargets } = require("../shared/controller-contract");
const { installStreamDeckPlugin, streamDeckPluginDestination } = require("./controller-plugin");
const { writeLocalControllerConnection } = require("./controller-local-connection");

const DEFAULT_CONTROLLER_PORT = 21217;

function normalizeMapping(incoming = {}) {
  const channel = Number(incoming.channel || 1);
  const number = Number(incoming.number);
  if (!Number.isInteger(channel) || channel < 1 || channel > 16 || !Number.isInteger(number) || number < 0 || number > 127) {
    throw new Error("Le canal MIDI doit être entre 1 et 16 et la note ou le contrôle entre 0 et 127.");
  }
  if (!["note", "cc"].includes(incoming.kind)) throw new Error("Type MIDI invalide.");
  if (!["action", "profile"].includes(incoming.targetType)) throw new Error("Cible du contrôleur invalide.");
  const targetId = safeString(incoming.targetId, 160);
  if (!targetId) throw new Error("Sélectionnez une action ou un profil.");
  return {
    id: safeString(incoming.id, 160) || `midi_${crypto.randomUUID()}`,
    name: safeString(incoming.name, 120) || "Commande MIDI",
    deviceId: safeString(incoming.deviceId, 240),
    channel,
    kind: incoming.kind,
    number,
    targetType: incoming.targetType,
    targetId,
    enabled: incoming.enabled !== false,
    threshold: Math.min(127, Math.max(1, Math.round(Number(incoming.threshold) || 1))),
    cooldownMs: Math.min(60000, Math.max(150, Number(incoming.cooldownMs) || 300))
  };
}

class ControllerService {
  constructor({ store, executeAction, selectProfile, pluginDirectory, pluginIconPath = "", localPluginDirectory = streamDeckPluginDestination(), authorize = () => assertAdminAccount(store) }) {
    this.store = store;
    this.executeAction = executeAction;
    this.selectProfile = selectProfile;
    this.pluginDirectory = pluginDirectory;
    this.pluginIconPath = pluginIconPath;
    this.localPluginDirectory = localPluginDirectory;
    this.authorize = authorize;
    this.server = null;
    this.pendingPairing = null;
    this.lastExecuted = new Map();
    this.inflight = new Set();
    this.rateWindows = new Map();
  }

  settings() {
    return readState(this.store, ["settings.controllers"]).settings.controllers || {};
  }

  port() {
    const value = Number(this.settings().port || DEFAULT_CONTROLLER_PORT);
    return Number.isInteger(value) && value >= 1024 && value <= 65535 ? value : DEFAULT_CONTROLLER_PORT;
  }

  async start() {
    this.authorize();
    if (this.server?.listening) return this.status();
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.startServer().finally(() => { this.startPromise = null; });
    return this.startPromise;
  }

  async startServer() {
    this.authorize();
    if (this.server?.listening) return this.status();
    const server = http.createServer((request, response) => {
      this.handleRequest(request, response).catch((error) => {
        if (!response.headersSent) jsonResponse(response, error.statusCode || 400, { error: error.message });
      });
    });
    server.requestTimeout = 10000;
    server.headersTimeout = 10000;
    await listenLoopback(server, this.port());
    try { this.authorize(); }
    catch (error) { await closeServer(server); throw error; }
    this.server = server;
    try { this.syncLocalConnection(); }
    catch (error) { await closeServer(server); this.server = null; throw error; }
    return this.status();
  }

  async stop() {
    if (this.startPromise) await this.startPromise.catch(() => {});
    if (this.pluginDirectory) writeLocalControllerConnection(this.localPluginDirectory, null);
    this.pendingPairing = null;
    this.lastExecuted.clear();
    this.rateWindows.clear();
    await closeServer(this.server);
    this.server = null;
  }

  status() {
    const settings = this.settings();
    return {
      running: this.server?.listening === true,
      port: this.port(),
      endpoint: `http://127.0.0.1:${this.port()}`,
      devices: (settings.devices || []).map(({ secretId, ...device }) => device),
      mappings: settings.mappings || [],
      pluginAvailable: Boolean(this.pluginDirectory && fs.existsSync(this.pluginDirectory)),
      pluginInstalled: Boolean(this.localPluginDirectory && fs.existsSync(path.join(this.localPluginDirectory, "manifest.json"))),
      automaticConnection: this.settings().autoConnectDisabled !== true && (settings.devices || []).some((device) => device.mode === "local-plugin")
    };
  }

  async pairingCode() {
    this.authorize();
    await this.start();
    const code = crypto.randomInt(10000000, 100000000).toString();
    this.pendingPairing = { code, expiresAt: Date.now() + 120000, failures: 0 };
    return { code, expiresAt: this.pendingPairing.expiresAt, endpoint: this.status().endpoint };
  }

  pair({ code, name = "Stream Deck" } = {}) {
    this.authorize();
    const pending = this.pendingPairing;
    if (!pending || pending.expiresAt < Date.now() || pending.failures >= 6) {
      this.pendingPairing = null;
      throw new Error("Le code d’appairage a expiré. Générez un nouveau code dans ShenPulse.");
    }
    if (!timingSafeToken(safeString(code, 20), pending.code)) {
      pending.failures += 1;
      throw new Error("Code d’appairage incorrect.");
    }
    this.pendingPairing = null;
    const token = crypto.randomBytes(32).toString("base64url");
    const device = {
      id: `controller_${crypto.randomUUID()}`,
      name: safeString(name, 120),
      secretId: this.store.setSecret("", token),
      pairedAt: new Date().toISOString()
    };
    this.store.set("settings.controllers", {
      ...this.settings(),
      devices: [...(this.settings().devices || []), device]
    });
    return { token, deviceId: device.id };
  }

  revoke(deviceId) {
    this.authorize();
    const device = (this.settings().devices || []).find((item) => item.id === deviceId);
    if (device?.secretId) this.store.setSecret(device.secretId, "");
    this.store.set("settings.controllers", {
      ...this.settings(),
      ...(device?.mode === "local-plugin" ? { autoConnectDisabled: true } : {}),
      devices: (this.settings().devices || []).filter((item) => item.id !== deviceId)
    });
    if (device?.mode === "local-plugin") writeLocalControllerConnection(this.localPluginDirectory, null);
    return this.status();
  }

  saveMapping(incoming) {
    this.authorize();
    const mapping = normalizeMapping(incoming);
    this.assertTarget(mapping);
    this.store.set("settings.controllers", {
      ...this.settings(),
      mappings: [...(this.settings().mappings || []).filter((item) => item.id !== mapping.id), mapping]
    });
    return this.status();
  }

  removeMapping(mappingId) {
    this.authorize();
    this.store.set("settings.controllers", {
      ...this.settings(),
      mappings: (this.settings().mappings || []).filter((item) => item.id !== mappingId)
    });
    this.lastExecuted.delete(mappingId);
    return this.status();
  }

  assertTarget({ targetType, targetId }) {
    const state = readState(this.store, ["rules", "profiles"]);
    const targets = targetType === "profile" ? state.profiles || [] : controllerActionTargets(state);
    const target = targets.find((item) => item.id === targetId);
    if (!target) throw new Error("Cette action ou ce profil n’existe plus.");
    if (target.enabled === false) throw new Error("Cette action est désactivée.");
  }

  async executeTarget({ targetType, targetId }) {
    this.authorize();
    if (!["action", "profile"].includes(targetType)) throw new Error("Cible du contrôleur invalide.");
    this.assertTarget({ targetType, targetId });
    if (this.inflight.size >= 8) throw new Error("Trop de commandes simultanées.");
    const key = `${targetType}:${targetId}`;
    if (this.inflight.has(key)) return { ok: true, ignored: true };
    this.inflight.add(key);
    try {
      if (targetType === "profile") await this.selectProfile(targetId);
      else await this.executeAction(targetId);
      return { ok: true };
    } finally {
      this.inflight.delete(key);
    }
  }

  async executeMapping({ id, value = 127, deviceId = "" } = {}) {
    this.authorize();
    const mapping = (this.settings().mappings || []).find((item) => item.id === id);
    if (!mapping || !mapping.enabled) return { ok: true, ignored: true };
    if (mapping.deviceId && mapping.deviceId !== deviceId) return { ok: true, ignored: true };
    if (!Number.isFinite(Number(value)) || Number(value) < mapping.threshold || Number(value) > 127) return { ok: true, ignored: true };
    if (Date.now() - (this.lastExecuted.get(id) || 0) < mapping.cooldownMs) return { ok: true, ignored: true };
    this.lastExecuted.set(id, Date.now());
    return this.executeTarget(mapping);
  }

  async installPlugin() {
    this.authorize();
    const result = installStreamDeckPlugin(this.pluginDirectory, this.pluginIconPath);
    await this.connectLocalPlugin();
    return result;
  }

  async connectLocalPlugin() {
    this.authorize();
    if (!this.status().pluginInstalled) throw new Error("Installez d’abord le plugin Stream Deck depuis ShenPulse.");
    this.store.set("settings.controllers", { ...this.settings(), autoConnectDisabled: false });
    await this.start();
    this.syncLocalConnection();
    return this.status();
  }

  syncLocalConnection() {
    if (!this.pluginDirectory || !this.status().pluginInstalled) return;
    this.authorize();
    if (this.settings().autoConnectDisabled === true) {
      writeLocalControllerConnection(this.localPluginDirectory, null);
      return;
    }
    let device = (this.settings().devices || []).find((entry) => entry.mode === "local-plugin");
    let token = device && this.store.getSecret(device.secretId);
    if (!token) {
      token = crypto.randomBytes(32).toString("base64url");
      device = { id: device?.id || `controller_${crypto.randomUUID()}`, name: "Stream Deck de ce PC", mode: "local-plugin", secretId: this.store.setSecret(device?.secretId || "", token), pairedAt: new Date().toISOString() };
      this.store.set("settings.controllers", { ...this.settings(), devices: [...(this.settings().devices || []).filter((entry) => entry.id !== device.id), device] });
    }
    writeLocalControllerConnection(this.localPluginDirectory, { endpoint: this.status().endpoint, token, deviceId: device.id });
  }

  async handleRequest(request, response) {
    const origin = String(request.headers.origin || "");
    if (origin && origin !== "null" && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
      return jsonResponse(response, 403, { error: "Origine non autorisée." });
    }
    if (origin) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader("Vary", "Origin");
    }
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      return response.end();
    }
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/health" && request.method === "GET") return jsonResponse(response, 200, { ok: true, app: "ShenPulse" });
    try { this.authorize(); }
    catch (error) {
      if (!["ACCOUNT_REQUIRED", "ADMIN_ACCOUNT_REQUIRED"].includes(error.code)) throw error;
      return jsonResponse(response, error.code === "ACCOUNT_REQUIRED" ? 401 : 403, { error: error.message });
    }
    if (url.pathname === "/pair" && request.method === "POST") {
      return jsonResponse(response, 200, this.pair(JSON.parse((await readRequestBody(request)).toString("utf8"))));
    }
    const token = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const device = token && (this.settings().devices || []).find((entry) => {
      const expected = this.store.getSecret(entry.secretId);
      return expected && timingSafeToken(token, expected);
    });
    if (!device) return jsonResponse(response, 401, { error: "Appairez ce contrôleur dans ShenPulse." });
    const now = Date.now();
    const window = this.rateWindows.get(device.id) || { since: now, count: 0 };
    if (now - window.since > 1000) { window.since = now; window.count = 0; }
    window.count += 1;
    this.rateWindows.set(device.id, window);
    if (window.count > 12) return jsonResponse(response, 429, { error: "Trop de commandes par seconde." });
    if (url.pathname === "/targets" && request.method === "GET") {
      const state = readState(this.store, ["rules", "profiles", "session.profileId"]);
      return jsonResponse(response, 200, {
        activeProfile: (state.profiles || []).filter((profile) => profile.id === state.session?.profileId).map(({ id, name }) => ({ id, name }))[0] || null,
        actions: controllerActionTargets(state).filter((item) => item.enabled).map(({ id, name }) => ({ id, name })),
        profiles: (state.profiles || []).map(({ id, name }) => ({ id, name }))
      });
    }
    if (url.pathname === "/execute" && request.method === "POST") {
      const payload = JSON.parse((await readRequestBody(request)).toString("utf8"));
      return jsonResponse(response, 200, await this.executeTarget({ targetType: payload.targetType, targetId: safeString(payload.targetId, 160) }));
    }
    return jsonResponse(response, 404, { error: "Commande inconnue." });
  }
}

module.exports = { ControllerService, DEFAULT_CONTROLLER_PORT, normalizeMidiMessage, normalizeMapping };
