"use strict";

const dgram = require("node:dgram");
const net = require("node:net");
const { SimpleTcpServerBridge } = require("../simple-tcp-server-bridge");
const { SimpleWebSocketGameBridge } = require("../simple-websocket-game-bridge");
const { BalatroGamePassBridge } = require("../balatro-gamepass-bridge");
const { ShopGameBridge } = require("../shop-game-bridge");
const { shopInstallationPath } = require("../game-runtime/shop-games-installation");
const { readState } = require("../state-projection");

/** Transports réseau isolés ; caches et événements restent ceux du hub. */
class GameTransports {
  constructor(hub) { this.hub = hub; }
  get sockets() { return this.hub.sockets; }
  get serverBridges() { return this.hub.serverBridges; }
  emit(...args) { return this.hub.emit(...args); }

  /** Réutilise le pont serveur et nettoie les démarrages échoués. */
  async getServerBridge(pack, connector) {
    const cacheKey = `${pack.id}:${connector.type}`;
    let bridge = this.serverBridges.get(cacheKey);
    if (!bridge) {
      const Bridge = connector.type === "shop-mod" ? ShopGameBridge : connector.type === "balatro-gamepass" ? BalatroGamePassBridge : connector.type === "websocket-server" ? SimpleWebSocketGameBridge : SimpleTcpServerBridge;
      bridge = connector.helperGame ? require("../prepared-helper-games").bridgeFor(this.hub.store,pack.id,()=>this.hub.assertAccess(pack.id)) : connector.remoteBrowserGame ? require("../prepared-web-integrations").bridgeFor(this.hub.store,pack.id,()=>this.hub.assertAccess(pack.id)) : connector.localHttpGame ? require("../prepared-local-http-games").bridgeFor(this.hub.store,pack.id,()=>this.hub.assertAccess(pack.id)) : connector.fileGame ? require("../prepared-file-games").bridgeFor(this.hub.store,pack.id,()=>this.hub.assertAccess(pack.id)) : connector.browserGame ? require("../prepared-browser-games").bridgeFor(this.hub.store,pack.id,()=>this.hub.assertAccess(pack.id)) : connector.type==="shen-native" ? require("../shen-native-games/runtime").bridgeFor(this.hub.store,pack.id,()=>this.hub.assertAccess(pack.id)) : new Bridge({
        gameId: pack.id,
        installationPath: ["shop-mod", "balatro-gamepass"].includes(connector.type) ? readState(this.hub.store, ["game.installations"]).game.installations?.[pack.id]?.path : undefined,
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
      if(connector.type==="shen-native")bridge.pack=pack;
    }
    if (connector.type === "shop-mod") {
      const installed = readState(this.hub.store, ["game.installations"]).game.installations?.[pack.id]?.path;
      const currentPath = installed ? await shopInstallationPath(pack.id, installed) : "";
      if (bridge.installationPath && bridge.installationPath !== currentPath) await bridge.close();
      bridge.installationPath = currentPath;
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

  /** Réutilise le socket TCP/WebSocket actif avec les délais historiques. */
  getSocket(pack, connector) {
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

  /** JSON terminé par NUL avec corrélation requestId. */
  async sendTcp(pack, connector, payload, { assertAccess = () => {} } = {}) {
    assertAccess();
    const socket = await this.getSocket(pack, connector);
    assertAccess();
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

  /** Protocole serveur et reprises temporaires, sans changement de délais. */
  async sendTcpServer(pack, connector, payload, { assertAccess = () => {} } = {}) {
    assertAccess();
    const bridge = await this.getServerBridge(pack, connector);
    const durationMultiplier = Math.max(
      1,
      Number(connector.durationMultiplier || 1)
    );
    const request = {
      ...payload.effect,
      ...(connector.parameterOrderByCode?.[payload.effect.code] ? {parameterOrder:connector.parameterOrderByCode[payload.effect.code]} : connector.parameterFormat==="array"?{parameterOrder:[]}:{}),
      duration: Math.round(
        Number(payload.effect.duration || 0) * durationMultiplier
      )
    };
    const retryWindowMs = Math.max(
      0,
      !Array.isArray(connector.temporaryFailureRetryCodes) || connector.temporaryFailureRetryCodes.includes(payload.effect.code)
        ? Number(connector.temporaryFailureRetryMs || 0) : 0
    );
    const retryIntervalMs = Math.max(
      50,
      Number(connector.temporaryFailureRetryIntervalMs || 500)
    );
    const retryDeadline = Date.now() + retryWindowMs;
    while (true) {
      try {
        assertAccess();
        return await bridge.send(payload.effect.code, request, { assertAccess });
      } catch (error) {
        if (Number(error?.status) !== 3 || Date.now() >= retryDeadline) {
          if (
            Number(error?.status) === 3 &&
            connector.temporaryFailureMessage
          ) {
            throw new Error(connector.temporaryFailureMessage, {
              cause: error
            });
          }
          throw error;
        }
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.min(retryIntervalMs, retryDeadline - Date.now())
          )
        );
      }
    }
  }

  /** Envoi unique d'une charge utile JSON sur le socket partagé. */
  async sendWebSocket(pack, connector, payload, { assertAccess = () => {} } = {}) {
    assertAccess();
    const socket = await this.getSocket(pack, connector);
    assertAccess();
    socket.send(JSON.stringify(payload));
    return { status: "success", sent: true };
  }

  /** Requête annulable : méthode, en-têtes, délai et réponses historiques. */
  async sendHttp(connector, payload, { assertAccess = () => {} } = {}) {
    assertAccess();
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

  /** Envoi UDP ponctuel, socket fermé après le callback. */
  sendUdp(connector, payload, { assertAccess = () => {} } = {}) {
    assertAccess();
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

module.exports = { GameTransports };
