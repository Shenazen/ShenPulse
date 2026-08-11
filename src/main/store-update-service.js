"use strict";

const path = require("node:path");

const STORE_UPDATES_URI = "ms-windows-store://downloadsandupdates";
const DEFAULT_CHECK_TTL_MS = 4 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 45 * 1000;

class StoreUpdateService {
  constructor({
    app,
    shell,
    nativeBridge = null,
    now = () => Date.now(),
    checkTtlMs = DEFAULT_CHECK_TTL_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS
  }) {
    this.app = app;
    this.shell = shell;
    this.nativeBridge = nativeBridge;
    this.now = now;
    this.checkTtlMs = checkTtlMs;
    this.timeoutMs = timeoutMs;
    this.cachedStatus = null;
    this.pendingCheck = null;
  }

  async check({ force = false } = {}) {
    const checkedAt = new Date(this.now()).toISOString();
    if (!this.app?.isPackaged) {
      return {
        supported: false,
        available: false,
        state: "development",
        checkedAt
      };
    }
    if (
      !force &&
      this.cachedStatus &&
      this.now() - this.cachedStatus.checkedAtMs < this.checkTtlMs
    ) {
      return publicStatus(this.cachedStatus);
    }
    if (this.pendingCheck) return this.pendingCheck;

    this.pendingCheck = this.#runCheck()
      .then((status) => {
        this.cachedStatus = {
          ...status,
          checkedAtMs: this.now()
        };
        return publicStatus(this.cachedStatus);
      })
      .finally(() => {
        this.pendingCheck = null;
      });
    return this.pendingCheck;
  }

  async install() {
    const bridge = this.#nativeBridge();
    if (!bridge) return this.openStore("native-bridge-unavailable");

    const status = await this.check({ force: true });
    if (!status.available) {
      if (status.supported && status.state === "up-to-date") return status;
      return this.openStore(status.reason || status.state);
    }

    try {
      const result = normalizeNativeStatus(
        await withTimeout(
          bridge.installUpdatesSilently(),
          this.timeoutMs,
          "store-install-timeout"
        ),
        this.now()
      );
      if (result.installed || result.state === "completed") {
        this.cachedStatus = null;
        return result;
      }
      return this.openStore(result.reason || result.state);
    } catch (error) {
      return this.openStore(error?.message || "store-install-failed");
    }
  }

  async openStore(reason = "user-request") {
    await this.shell.openExternal(STORE_UPDATES_URI);
    return {
      supported: true,
      available: true,
      state: "store-opened",
      openedStore: true,
      reason: String(reason || ""),
      checkedAt: new Date(this.now()).toISOString()
    };
  }

  async #runCheck() {
    const bridge = this.#nativeBridge();
    if (!bridge) {
      return {
        supported: false,
        available: false,
        state: "native-bridge-unavailable",
        checkedAt: new Date(this.now()).toISOString()
      };
    }
    try {
      return normalizeNativeStatus(
        await withTimeout(
          bridge.checkForUpdates(),
          this.timeoutMs,
          "store-check-timeout"
        ),
        this.now()
      );
    } catch (error) {
      return {
        supported: false,
        available: false,
        state: "unavailable",
        reason: String(error?.message || error || "store-check-failed"),
        checkedAt: new Date(this.now()).toISOString()
      };
    }
  }

  #nativeBridge() {
    if (this.nativeBridge) return this.nativeBridge;
    const candidates = [
      path.join(
        process.resourcesPath || "",
        "app.asar.unpacked",
        "resources",
        "store-update",
        "shenpulse_store_update.node"
      ),
      path.resolve(
        __dirname,
        "..",
        "..",
        "native",
        "store-update",
        "build",
        "Release",
        "shenpulse_store_update.node"
      )
    ];
    for (const candidate of candidates) {
      try {
        this.nativeBridge = require(candidate);
        return this.nativeBridge;
      } catch {
        // Le prochain emplacement couvre le développement et le package APPX.
      }
    }
    return null;
  }
}

function normalizeNativeStatus(value, now) {
  const incoming = value && typeof value === "object" ? value : {};
  return {
    supported: incoming.supported === true,
    available: incoming.available === true,
    mandatory: incoming.mandatory === true,
    canInstallSilently: incoming.canInstallSilently === true,
    installed: incoming.installed === true,
    packageCount: Math.max(0, Number(incoming.packageCount) || 0),
    packageVersion: String(incoming.packageVersion || ""),
    state: String(incoming.state || "unknown"),
    reason: String(incoming.reason || ""),
    errorCode: String(incoming.errorCode || ""),
    checkedAt: new Date(now).toISOString()
  };
}

function publicStatus(status) {
  const { checkedAtMs, ...publicValue } = status || {};
  return publicValue;
}

function withTimeout(promise, timeoutMs, message) {
  let timer = null;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}

module.exports = {
  DEFAULT_CHECK_TTL_MS,
  STORE_UPDATES_URI,
  StoreUpdateService,
  normalizeNativeStatus
};
