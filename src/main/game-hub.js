"use strict";

const dgram = require("node:dgram");
const net = require("node:net");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { id, safeString } = require("./utils");
const { loadShenazenGameCatalog } = require("./game-catalog");
const { assertGameAccess } = require("./game-access");
const { SimpleTcpServerBridge } = require("./simple-tcp-server-bridge");

class GameHub extends EventEmitter {
  constructor({ store, packsDirectory, resourcesDirectory }) {
    super();
    this.store = store;
    this.packsDirectory = packsDirectory;
    this.resourcesDirectory = resourcesDirectory || path.dirname(packsDirectory);
    this.packs = [];
    this.sockets = new Map();
    this.serverBridges = new Map();
    this.minecraftRuntime = null;
  }

  setMinecraftRuntime(runtime) {
    this.minecraftRuntime = runtime || null;
  }

  loadPacks() {
    const catalogPacks = loadShenazenGameCatalog(this.resourcesDirectory);
    for (const pack of catalogPacks) validatePack(pack);
    this.packs = catalogPacks.sort((first, second) =>
      first.name.localeCompare(second.name)
    );
    const activePackId = this.store.getState().session.activeGamePackId;
    if (!this.packs.some((pack) => pack.id === activePackId)) {
      this.store.mutate((state) => {
        state.session.activeGamePackId = "coin-pusher";
        state.game.recentPacks = ["coin-pusher", "connect-four"];
      });
    }
    return this.listPacks();
  }

  listPacks() {
    return structuredClone(this.packs);
  }

  assertAccess(packId) {
    return assertGameAccess(this.store.getState(), this.#pack(packId));
  }

  initializeDefaultInteractions(packId) {
    const pack = this.assertAccess(packId);
    const mappings = Array.isArray(pack.defaultMappings)
      ? pack.defaultMappings
      : [];
    const version = Math.max(
      0,
      Number(pack.interactionCatalogVersion || 0)
    );
    if (!mappings.length || !version) {
      return { added: 0, version: 0 };
    }

    let added = 0;
    this.store.mutate((state) => {
      state.game.interactionCatalogVersions ||= {};
      const currentVersion = Number(
        state.game.interactionCatalogVersions[pack.id] || 0
      );
      if (currentVersion >= version) return;

      state.game.interactionRulesByPack ||= {};
      const interactionRules =
        state.game.interactionRulesByPack[pack.id] ||= [];
      const existingRuleIds = new Set(
        interactionRules.map((rule) => rule.id)
      );
      for (const mapping of mappings) {
        const effect = pack.effects.find(
          (entry) => entry.id === mapping.effectId
        );
        if (!effect) continue;
        const rule = defaultGameInteractionRule(
          pack,
          effect,
          mapping,
          version
        );
        if (existingRuleIds.has(rule.id)) continue;
        interactionRules.push(rule);
        existingRuleIds.add(rule.id);
        added += 1;
      }
      state.game.interactionCatalogVersions[pack.id] = version;
    }, true);
    return { added, version };
  }

  async testConnection(packId) {
    const pack = this.assertAccess(packId);
    const connector = this.#connector(pack);
    if (connector.type === "demo") {
      return {
        ok: true,
        simulated: true,
        message: pack.effects.some((effect) => effect.available)
          ? "Moteur local prêt."
          : "Fiche de référence chargée ; pack natif non disponible."
      };
    }
    if (connector.type === "http") {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(connector.url, {
          method: "HEAD",
          signal: controller.signal
        });
        return { ok: response.ok || response.status === 405, status: response.status };
      } finally {
        clearTimeout(timer);
      }
    }
    if (connector.type === "udp") return { ok: true, connectionless: true };
    if (connector.type === "rcon") {
      const password = this.#connectorSecret(pack, connector);
      await rconRequest(connector, password, "list");
      return { ok: true };
    }
    if (connector.type === "minecraft-runtime") {
      if (!this.minecraftRuntime) {
        throw new Error("Le serveur Minecraft ShenPulse n’est pas initialisé.");
      }
      return this.minecraftRuntime.minecraftConnectionStatus(pack.id);
    }
    if (connector.type === "tcp-server") {
      const bridge = await this.#getServerBridge(pack, connector);
      const status = bridge.status();
      if (!status.connected) {
        throw new Error(
          `${pack.name} n’est pas encore connecté à ShenPulse. Lancez le jeu, chargez votre partie, puis réessayez.`
        );
      }
      return { ...status, type: connector.type };
    }
    const socket = await this.#getSocket(pack, connector);
    return { ok: Boolean(socket), type: connector.type };
  }

  async prepareConnection(packId) {
    const pack = this.assertAccess(packId);
    const connector = this.#connector(pack);
    if (connector.type !== "tcp-server") {
      return { ok: true, listening: false, type: connector.type };
    }
    const bridge = await this.#getServerBridge(pack, connector);
    return { ...bridge.status(), type: connector.type };
  }

  async executeMinecraftCommands(packId, commands) {
    const pack = this.assertAccess(packId);
    const connector = this.#connector(pack);
    if (connector.type !== "minecraft-runtime") {
      throw new Error(`${pack.name} n’utilise pas le serveur Minecraft géré par ShenPulse.`);
    }
    if (!this.minecraftRuntime) {
      throw new Error("Le serveur Minecraft ShenPulse n’est pas initialisé.");
    }
    return this.minecraftRuntime.executeMinecraftCommands(pack.id, commands);
  }

  async stopRuntime(packId) {
    const pack = this.#pack(packId);
    if (!this.minecraftRuntime?.stop) {
      return { stopped: false, gameId: pack.id };
    }
    return this.minecraftRuntime.stop(pack.id);
  }

  async trigger(effectId, context = {}, options = {}) {
    const state = this.store.getState();
    const packId = options.packId || state.session.activeGamePackId;
    const pack = this.assertAccess(packId);
    const effect = pack.effects.find((item) => item.id === effectId);
    if (!effect) throw new Error(`Effet introuvable : ${effectId}`);
    if (effect.available === false) {
      throw new Error("Cet effet est une référence visuelle : aucun pack natif exécutable n’est encore disponible.");
    }
    const connector = this.#connector(pack);
    const requestId = id("effect");
    const defaultParameters = Object.fromEntries(
      (effect.parameters || []).map((parameter) => [
        parameter.id,
        Number(parameter.defaultValue || 0)
      ])
    );
    const parameters = {
      ...defaultParameters,
      ...(options.parameters || {})
    };
    const configuredDuration =
      effect.durationParameter &&
      Object.prototype.hasOwnProperty.call(
        parameters,
        effect.durationParameter
      )
        ? parameters[effect.durationParameter]
        : options.duration ?? effect.duration ?? 0;
    const configuredQuantity =
      effect.quantityParameter &&
      Object.prototype.hasOwnProperty.call(
        parameters,
        effect.quantityParameter
      )
        ? parameters[effect.quantityParameter]
        : options.quantity ?? effect.quantity ?? 1;
    const payload = {
      requestId,
      type: 1,
      effect: {
        code: "",
        viewer: safeString(context.user?.displayName || context.user?.name || "Viewer", 120),
        viewerId: safeString(context.user?.id || "anonymous", 120),
        quantity: Math.max(1, Number(configuredQuantity || 1)),
        duration: Number(configuredDuration || 0),
        parameters
      }
    };
    const commandTemplates = Array.isArray(effect.commands)
      ? effect.commands
      : [effect.command || effect.code || effect.id];
    payload.effect.commands = commandTemplates.map((command) =>
      interpolateCommand(command, payload.effect)
    );
    payload.effect.command = payload.effect.commands[0];
    payload.effect.code = interpolateCommand(
      resolveEffectCode(effect, payload.effect),
      payload.effect
    );
    this.emit("effect-start", { pack, effect, payload, context });
    let result;
    if (connector.type === "demo") {
      result = { status: "success", message: "Effet simulé." };
    } else if (connector.type === "tcp-server") {
      result = await this.#sendTcpServer(pack, connector, payload);
    } else if (connector.type === "tcp") {
      result = await this.#sendTcp(pack, connector, payload);
    } else if (connector.type === "websocket") {
      result = await this.#sendWebSocket(pack, connector, payload);
    } else if (connector.type === "http") {
      result = await this.#sendHttp(connector, payload);
    } else if (connector.type === "udp") {
      result = await this.#sendUdp(connector, payload);
    } else if (connector.type === "rcon") {
      const command = interpolateCommand(effect.command, payload.effect);
      result = await rconRequest(
        connector,
        this.#connectorSecret(pack, connector),
        command
      );
    } else if (connector.type === "minecraft-runtime") {
      if (!this.minecraftRuntime) {
        throw new Error("Le serveur Minecraft ShenPulse n’est pas initialisé.");
      }
      result = await this.minecraftRuntime.executeMinecraftCommands(
        pack.id,
        payload.effect.commands
      );
    } else {
      throw new Error(`Connecteur de jeu inconnu : ${connector.type}`);
    }
    this.emit("effect-result", { pack, effect, payload, result, context });
    return result;
  }

  async disconnectAll() {
    for (const socket of this.sockets.values()) {
      socket.close?.();
      socket.destroy?.();
    }
    this.sockets.clear();
    await Promise.all(
      [...this.serverBridges.values()].map((bridge) => bridge.close())
    );
    this.serverBridges.clear();
  }

  #pack(packId) {
    const pack = this.packs.find((item) => item.id === packId);
    if (!pack) throw new Error(`Pack de jeu introuvable : ${packId}`);
    return pack;
  }

  #connector(pack) {
    const override = this.store.getState().game.connectorOverrides?.[pack.id] || {};
    return { ...(pack.connector || {}), ...override };
  }

  #connectorSecret(pack, connector) {
    const secretId =
      connector.secretId ||
      this.store.getState().game.connectorOverrides?.[pack.id]?.secretId;
    return secretId ? this.store.getSecret(secretId) : connector.password || "";
  }

  async #getServerBridge(pack, connector) {
    const cacheKey = `${pack.id}:${connector.type}`;
    let bridge = this.serverBridges.get(cacheKey);
    if (!bridge) {
      bridge = new SimpleTcpServerBridge({
        host: connector.host || "127.0.0.1",
        port: Number(connector.port),
        timeoutMs: Number(connector.timeoutMs || 12000),
        label: pack.name
      });
      bridge.on("message", (message) =>
        this.emit("bridge-message", { pack, message })
      );
      bridge.on("error", (error) =>
        this.emit("bridge-error", { pack, error })
      );
      this.serverBridges.set(cacheKey, bridge);
    }
    try {
      await bridge.start();
    } catch (error) {
      this.serverBridges.delete(cacheKey);
      await bridge.close().catch(() => {});
      throw error;
    }
    return bridge;
  }

  #getSocket(pack, connector) {
    const cacheKey = `${pack.id}:${connector.type}`;
    const current = this.sockets.get(cacheKey);
    if (current && !current.destroyed && current.readyState !== 3) {
      return Promise.resolve(current);
    }
    if (connector.type === "tcp") {
      return new Promise((resolve, reject) => {
        const socket = net.createConnection(
          {
            host: connector.host || "127.0.0.1",
            port: Number(connector.port),
            timeout: 5000
          },
          () => {
            socket.setTimeout(0);
            this.sockets.set(cacheKey, socket);
            resolve(socket);
          }
        );
        socket.once("error", reject);
        socket.once("timeout", () => reject(new Error("Connexion au jeu expirée.")));
        socket.once("close", () => this.sockets.delete(cacheKey));
      });
    }
    if (connector.type === "websocket") {
      return new Promise((resolve, reject) => {
        const socket = new WebSocket(connector.url);
        const timeout = setTimeout(
          () => reject(new Error("Connexion WebSocket au jeu expirée.")),
          5000
        );
        socket.addEventListener("open", () => {
          clearTimeout(timeout);
          this.sockets.set(cacheKey, socket);
          resolve(socket);
        });
        socket.addEventListener("error", () => {
          clearTimeout(timeout);
          reject(new Error("Connexion WebSocket au jeu impossible."));
        });
        socket.addEventListener("close", () => this.sockets.delete(cacheKey));
      });
    }
    throw new Error("Ce connecteur ne maintient pas de socket.");
  }

  async #sendTcp(pack, connector, payload) {
    const socket = await this.#getSocket(pack, connector);
    const message = Buffer.from(`${JSON.stringify(payload)}\0`, "utf8");
    if (connector.expectResponse === false) {
      socket.write(message);
      return { status: "success", sent: true };
    }
    return new Promise((resolve, reject) => {
      let buffer = "";
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Le jeu n'a pas répondu dans le délai imparti."));
      }, Number(connector.timeoutMs || 5000));
      const onData = (chunk) => {
        buffer += chunk.toString("utf8");
        const separator = buffer.indexOf("\0");
        if (separator < 0) return;
        const raw = buffer.slice(0, separator);
        try {
          const response = JSON.parse(raw);
          if (response.requestId && response.requestId !== payload.requestId) return;
          cleanup();
          resolve(response);
        } catch {
          cleanup();
          resolve({ status: "success", message: raw });
        }
      };
      const onError = (error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        clearTimeout(timeout);
        socket.off("data", onData);
        socket.off("error", onError);
      };
      socket.on("data", onData);
      socket.on("error", onError);
      socket.write(message);
    });
  }

  async #sendTcpServer(pack, connector, payload) {
    const bridge = await this.#getServerBridge(pack, connector);
    const durationMultiplier = Math.max(
      1,
      Number(connector.durationMultiplier || 1)
    );
    return bridge.send(payload.effect.code, {
      ...payload.effect,
      duration: Math.round(
        Number(payload.effect.duration || 0) * durationMultiplier
      )
    });
  }

  async #sendWebSocket(pack, connector, payload) {
    const socket = await this.#getSocket(pack, connector);
    socket.send(JSON.stringify(payload));
    return { status: "success", sent: true };
  }

  async #sendHttp(connector, payload) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      Number(connector.timeoutMs || 5000)
    );
    try {
      const response = await fetch(connector.url, {
        method: connector.method || "POST",
        headers: { "Content-Type": "application/json", ...(connector.headers || {}) },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`Jeu HTTP : ${response.status} ${text}`);
      try {
        return JSON.parse(text);
      } catch {
        return { status: "success", message: text };
      }
    } finally {
      clearTimeout(timer);
    }
  }

  #sendUdp(connector, payload) {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket("udp4");
      const message = Buffer.from(JSON.stringify(payload), "utf8");
      socket.send(
        message,
        Number(connector.port),
        connector.host || "127.0.0.1",
        (error) => {
          socket.close();
          if (error) reject(error);
          else resolve({ status: "success", sent: true });
        }
      );
    });
  }
}

function defaultGameInteractionRule(pack, effect, mapping, version) {
  const triggerEnabled = mapping.triggerEnabled !== false;
  const giftName = String(mapping.giftName || "").trim();
  const title = String(mapping.title || effect.name).trim();
  const safePresetId = String(mapping.id || effect.id)
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return {
    id: `rule_${pack.id}_${safePresetId}`,
    name: `${pack.name} · ${title}`,
    enabled: mapping.enabled !== false,
    priority: 50,
    trigger: {
      enabled: triggerEnabled,
      type: mapping.triggerType || "gift",
      source: "*",
      threshold: Math.max(1, Number(mapping.threshold || 1))
    },
    conditions:
      triggerEnabled && giftName
        ? [
            {
              field: "data.giftName",
              operator: "equals",
              value: giftName
            }
          ]
        : [],
    cooldown: {
      globalMs: Math.max(
        0,
        Number(mapping.cooldownSeconds || 0) * 1000
      ),
      perUserMs: 0
    },
    chance: 1,
    gameInteraction: {
      catalogVersion: version,
      default: true,
      presetId: mapping.id,
      title
    },
    actions: [
      {
        id: `action_${pack.id}_${safePresetId}`,
        type: effect.actionType || "game.effect",
        config: {
          packId: pack.id,
          effectId: effect.id,
          quantity: Number(mapping.quantity || effect.quantity || 1),
          duration: Number(
            mapping.duration ?? effect.duration ?? 0
          ),
          parameters: {
            ...Object.fromEntries(
              (effect.parameters || []).map((parameter) => [
                parameter.id,
                Number(parameter.defaultValue || 0)
              ])
            ),
            ...(mapping.parameters || {})
          },
          ...(effect.winCounter
            ? {
                amount: Number(
                  mapping.amount ?? effect.winCounter.amount ?? 0
                ),
                operation:
                  mapping.operation ||
                  effect.winCounter.operation ||
                  "adjust"
              }
            : {})
        }
      }
    ]
  };
}

function validatePack(pack) {
  if (!pack?.id || !pack?.name || !Array.isArray(pack.effects) || !pack.connector) {
    throw new Error("Pack de jeu invalide.");
  }
  const ids = new Set();
  for (const effect of pack.effects) {
    if (!effect.id || ids.has(effect.id)) throw new Error(`Effet invalide dans ${pack.id}`);
    ids.add(effect.id);
  }
}

function interpolateCommand(template, effect) {
  return String(template || "").replace(
    /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g,
    (placeholder, key) => {
      if (Object.prototype.hasOwnProperty.call(effect.parameters || {}, key)) {
        const value = Number(effect.parameters[key]);
        return Number.isFinite(value) ? String(value) : "0";
      }
      if (key === "quantity") return String(effect.quantity);
      if (key === "duration") return String(effect.duration);
      if (key === "viewer") {
        return safeString(effect.viewer, 40).replace(/[^\w-]/g, "_");
      }
      return placeholder;
    }
  );
}

function resolveEffectCode(effect, runtimeEffect) {
  const variant = effect?.codeByParameter;
  const parameterId = String(variant?.parameter || "");
  if (parameterId) {
    const rawValue = runtimeEffect?.parameters?.[parameterId];
    const numericValue = Number(rawValue);
    const key = Number.isFinite(numericValue)
      ? String(Math.round(numericValue))
      : String(rawValue || "");
    const mapped = variant.values?.[key];
    if (mapped) return String(mapped);
    if (variant.mode === "nearest" && Number.isFinite(numericValue)) {
      const nearest = Object.entries(variant.values || {})
        .map(([value, code]) => ({
          value: Number(value),
          code: String(code || "")
        }))
        .filter(
          (entry) =>
            Number.isFinite(entry.value) &&
            entry.code
        )
        .sort(
          (left, right) =>
            Math.abs(left.value - numericValue) -
              Math.abs(right.value - numericValue) ||
            left.value - right.value
        )[0];
      if (nearest) return nearest.code;
    }
  }
  return String(effect?.code || effect?.id || "");
}

function rconPacket(requestId, type, body) {
  const payload = Buffer.from(`${body}\0\0`, "utf8");
  const packet = Buffer.alloc(12 + Buffer.byteLength(body, "utf8") + 2);
  packet.writeInt32LE(payload.length + 8, 0);
  packet.writeInt32LE(requestId, 4);
  packet.writeInt32LE(type, 8);
  payload.copy(packet, 12);
  return packet;
}

function readRconPacket(buffer) {
  if (buffer.length < 4) return null;
  const length = buffer.readInt32LE(0);
  if (buffer.length < length + 4) return null;
  return {
    length,
    requestId: buffer.readInt32LE(4),
    type: buffer.readInt32LE(8),
    body: buffer.subarray(12, length + 2).toString("utf8"),
    remainder: buffer.subarray(length + 4)
  };
}

function rconRequest(connector, password, command) {
  if (!password) return Promise.reject(new Error("Mot de passe RCON requis."));
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: connector.host || "127.0.0.1",
      port: Number(connector.port || 25575),
      timeout: Number(connector.timeoutMs || 5000)
    });
    let phase = "auth";
    let buffer = Buffer.alloc(0);
    const cleanup = () => socket.destroy();
    socket.on("connect", () => socket.write(rconPacket(1, 3, password)));
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      let packet;
      while ((packet = readRconPacket(buffer))) {
        buffer = packet.remainder;
        if (phase === "auth") {
          if (packet.requestId === -1) {
            cleanup();
            reject(new Error("Authentification RCON refusée."));
            return;
          }
          if (packet.requestId === 1) {
            phase = "command";
            socket.write(rconPacket(2, 2, command));
          }
        } else if (packet.requestId === 2) {
          cleanup();
          resolve({ status: "success", message: packet.body });
          return;
        }
      }
    });
    socket.on("timeout", () => {
      cleanup();
      reject(new Error("Délai RCON dépassé."));
    });
    socket.on("error", reject);
  });
}

module.exports = {
  GameHub,
  interpolateCommand,
  resolveEffectCode,
  rconPacket,
  readRconPacket,
  validatePack
};
