"use strict";

const crypto = require("node:crypto");
const { id } = require("./utils");

function sha256Base64(value) {
  return crypto.createHash("sha256").update(value).digest("base64");
}

class ObsClient {
  constructor({ store }) {
    this.store = store;
    this.socket = null;
    this.ready = null;
    this.pending = new Map();
  }

  async connect() {
    await this.disconnect();
    const settings = this.store.getState().settings.obs;
    const password = settings.passwordSecretId
      ? this.store.getSecret(settings.passwordSecretId)
      : "";
    this.ready = new Promise((resolve, reject) => {
      const socket = new WebSocket(settings.url);
      this.socket = socket;
      const timeout = setTimeout(() => reject(new Error("Délai OBS dépassé.")), 8000);
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data));
        if (message.op === 0) {
          const identify = { rpcVersion: 1 };
          if (message.d.authentication) {
            const secret = sha256Base64(password + message.d.authentication.salt);
            identify.authentication = sha256Base64(
              secret + message.d.authentication.challenge
            );
          }
          socket.send(JSON.stringify({ op: 1, d: identify }));
        } else if (message.op === 2) {
          clearTimeout(timeout);
          resolve(message.d);
        } else if (message.op === 7) {
          const pending = this.pending.get(message.d.requestId);
          if (!pending) return;
          this.pending.delete(message.d.requestId);
          if (message.d.requestStatus?.result) pending.resolve(message.d.responseData || {});
          else {
            pending.reject(
              new Error(message.d.requestStatus?.comment || "Requête OBS refusée.")
            );
          }
        }
      });
      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("Impossible de se connecter à OBS WebSocket."));
      });
      socket.addEventListener("close", () => {
        for (const pending of this.pending.values()) {
          pending.reject(new Error("Connexion OBS fermée."));
        }
        this.pending.clear();
      });
    });
    return this.ready;
  }

  async request(requestType, requestData = {}) {
    if (!this.socket || this.socket.readyState !== 1) await this.connect();
    await this.ready;
    const requestId = id("obs");
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("Réponse OBS expirée."));
      }, 8000);
      this.pending.set(requestId, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        }
      });
      this.socket.send(
        JSON.stringify({
          op: 6,
          d: { requestType, requestId, requestData }
        })
      );
    });
  }

  async disconnect() {
    this.socket?.close?.();
    this.socket = null;
    this.ready = null;
  }
}

module.exports = { ObsClient, sha256Base64 };

