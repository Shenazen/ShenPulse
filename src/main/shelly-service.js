"use strict";

/** Façade stable : API historique, implémentations organisées par responsabilités. */
const { readState } = require("./state-projection");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { assertProFeatureAccess, createProFeatureGuard } = require("./pro-feature-access");
const { assertCommandContext } = require("./commands/context-guard");
const { SHELLY_AP_ADDRESS } = require("./shelly/constants");
const { ensureIrlSettings, normalizeIrlSettings, normalizeDevice, inferDeviceControllable, isPlugPlusDevice, isPlugPlusAccessPoint, normalizeHost, cleanIdentifier, cleanLabel, cleanWifiName, hostsFromArpOutput, normalizeOperation, isPythonUnavailable, clampNumber, escapeXml } = require("./shelly/devices");
const { delay, waitFor, runCommand } = require("./shelly/processes");
const { mdnsQueryPacket, parseMdnsPacket, hostsFromMdnsRecords, discoverMdnsHosts } = require("./shelly/discovery");

class ShellyService {
  constructor({
    store,
    fetchImpl = globalThis.fetch,
    commandRunner = runCommand,
    mdnsDiscoverer = discoverMdnsHosts,
    pythonBridge = null,
    delayImpl = delay,
    platform = process.platform,
    temporaryDirectory = os.tmpdir()
  }) {
    this.store = store;
    this.fetch = fetchImpl;
    this.commandRunner = commandRunner;
    this.mdnsDiscoverer = mdnsDiscoverer;
    this.pythonBridge = pythonBridge;
    this.delay = delayImpl;
    this.platform = platform;
    this.temporaryDirectory = temporaryDirectory;
    this.deviceQueues = new Map();
  }

  status() {
    this.#assertAccess();
    const irl = this.#settings();
    return {
      enabled: irl.enabled === true,
      devices: irl.devices.map((device) => ({ ...device })),
      supported: this.platform === "win32",
      engine: this.pythonBridge?.status() || {
        kind: "node",
        state: "ready",
        giftRules: 0
      }
    };
  }

  async scan({ timeoutMs = 1400 } = {}) {
    const assertAccess = createProFeatureGuard(this.store, "irl");
    const [hosts, wifi] = await Promise.all([
      this.#discoverHosts(timeoutMs),
      this.#scanWifiNetworks()
    ]);
    const devices = (await this.#probeHosts(hosts)).filter(isPlugPlusDevice);
    assertAccess();
    const onlineIds = new Set(devices.map((device) => device.id));
    this.store.mutate((state) => {
      for (const device of ensureIrlSettings(state.settings).devices) {
        device.online = onlineIds.has(device.id);
      }
    });
    for (const device of devices) this.#rememberDevice(device);
    return {
      currentNetwork: wifi.currentNetwork,
      accessPoints: wifi.networks.filter((network) =>
        isPlugPlusAccessPoint(network.ssid)
      ),
      devices: this.#settings().devices.map((device) => ({ ...device }))
    };
  }

  async addDevice({ host, name = "" } = {}) {
    const assertAccess = createProFeatureGuard(this.store, "irl");
    const device = await this.#probeHost(host);
    assertAccess();
    if (!device) {
      throw new Error(
        "Aucune prise Shelly n’a répondu à cette adresse sur le réseau local."
      );
    }
    if (!isPlugPlusDevice(device)) {
      throw new Error(
        "Cette adresse ne correspond pas à une prise PlugPlus compatible."
      );
    }
    if (name) device.name = cleanLabel(name, 80);
    this.#rememberDevice(device);
    return this.status();
  }

  removeDevice(deviceId) {
    this.#assertAccess();
    const targetId = cleanIdentifier(deviceId);
    this.store.mutate((state) => {
      const irl = ensureIrlSettings(state.settings);
      irl.devices = irl.devices.filter((device) => device.id !== targetId);
    }, true);
    return this.status();
  }

  renameDevice(deviceId, name) {
    this.#assertAccess();
    const targetId = cleanIdentifier(deviceId);
    const nextName = cleanLabel(name, 80);
    if (!nextName) throw new Error("Le nom de la prise est requis.");
    this.store.mutate((state) => {
      const irl = ensureIrlSettings(state.settings);
      const device = irl.devices.find(
        (entry) => entry.id === targetId
      );
      if (!device) throw new Error("Prise Shelly introuvable.");
      device.name = nextName;
      irl.deviceNames[targetId] = nextName;
    }, true);
    return this.status();
  }

  setEnabled(enabled) {
    this.#assertAccess();
    this.store.mutate((state) => {
      ensureIrlSettings(state.settings).enabled = enabled === true;
    }, true);
    return this.status();
  }

  async pair({ accessPointSsid, wifiSsid, wifiPassword = "" } = {}) {
    const assertAccess = createProFeatureGuard(this.store, "irl");
    if (this.platform !== "win32") {
      throw new Error(
        "L’association automatique Shelly est actuellement disponible sur Windows."
      );
    }
    const shellySsid = cleanWifiName(accessPointSsid);
    const targetWifi = cleanWifiName(wifiSsid);
    if (!isPlugPlusAccessPoint(shellySsid)) {
      throw new Error("Choisissez le réseau Wi-Fi créé par la prise PlugPlus.");
    }
    if (!targetWifi) throw new Error("Le réseau Wi-Fi de la maison est requis.");

    const previousNetwork = await this.#currentWifiNetwork();
    assertAccess();
    let identified = null;
    let provisioned = false;
    try {
      await this.#connectOpenWifi(shellySsid);
      assertAccess();
      identified = await waitFor(
        () => this.#probeHost(SHELLY_AP_ADDRESS),
        { timeoutMs: 18000, intervalMs: 650 }
      );
      if (!identified) {
        throw new Error(
          "La prise n’a pas répondu. Rapprochez-la du PC et relancez son mode association."
        );
      }
      if (!isPlugPlusDevice(identified)) {
        throw new Error("Seules les prises PlugPlus peuvent être associées.");
      }
      assertAccess();
      await this.#provisionWifi(
        identified,
        targetWifi,
        String(wifiPassword || ""),
        assertAccess
      );
      provisioned = true;
    } finally {
      await this.#restoreWifi(previousNetwork, shellySsid, targetWifi).catch(
        () => {}
      );
    }

    if (!provisioned || !identified) {
      throw new Error("L’association de la prise Shelly a échoué.");
    }

    const discovered = await waitFor(async () => {
      assertAccess();
      const hosts = await this.#discoverHosts(900);
      const devices = await this.#probeHosts(hosts);
      return devices.find((device) => device.id === identified.id) || null;
    }, { timeoutMs: 24000, intervalMs: 1300 });
    assertAccess();

    const device = discovered || {
      ...identified,
      host: "",
      online: false,
      lastSeenAt: ""
    };
    this.#rememberDevice(device);
    return {
      ...this.status(),
      pairedDeviceId: device.id,
      pendingDiscovery: !discovered
    };
  }

  async test(deviceId, operation = "toggle", durationMs = 3000) {
    this.#assertAccess();
    return this.control(
      { deviceId, operation, durationMs },
      { ignoreGlobalSwitch: true }
    );
  }

  async control(config = {}, { ignoreGlobalSwitch = false, shouldExecute } = {}) {
    const assertAccess = createProFeatureGuard(this.store, "irl", { shouldExecute });
    const irl = this.#settings();
    if (!ignoreGlobalSwitch && irl.enabled !== true) {
      return { skipped: true, reason: "irl-disabled" };
    }
    const deviceId = cleanIdentifier(config.deviceId);
    const device = irl.devices.find((entry) => entry.id === deviceId);
    if (!device) throw new Error("La prise Shelly sélectionnée n’existe plus.");
    if (device.controllable === false) {
      throw new Error(
        `« ${device.name || device.id} » ne possède aucun relais pilotable. Choisissez une prise Shelly dans l’action.`
      );
    }
    const stillAllowed = () => {
      assertAccess();
      const fresh = this.#settings();
      if (!ignoreGlobalSwitch && fresh.enabled !== true) {
        const error = new Error("Les interactions IRL ont été désactivées avant l’exécution.");
        error.code = "FEATURE_ACCESS_FORBIDDEN";
        throw error;
      }
      if (!fresh.devices.some((entry) => entry.id === device.id && entry.controllable !== false)) {
        const error = new Error("La prise IRL n’est plus disponible dans ce profil.");
        error.code = "FEATURE_CONTEXT_CHANGED";
        throw error;
      }
      return true;
    };
    const operation = normalizeOperation(config.operation);
    const durationMs = clampNumber(config.durationMs, 500, 60000, 3000);
    return this.#enqueue(device.id, async () => {
      stillAllowed();
      const target = await this.#resolveDevice(device, stillAllowed);
      stillAllowed();
      const result = await this.#sendControl(target, operation, durationMs, stillAllowed);
      // Une restauration de sécurité peut finir après expiration : son résultat
      // ne doit alors pas être enregistré dans le nouveau compte ou profil.
      let remember = false;
      try { remember = stillAllowed(); } catch {}
      if (remember) this.#rememberDevice({
        ...target,
        online: true,
        lastSeenAt: new Date().toISOString()
      });
      return { ...result, deviceId: target.id, operation };
    });
  }

  #assertAccess() { return assertProFeatureAccess(this.store, "irl"); }

  #settings() {
    const settings = readState(this.store, ["settings.irl"]).settings || {};
    return normalizeIrlSettings(settings.irl);
  }

  async #discoverHosts(timeoutMs) {
    const saved = this.#settings().devices.map((device) => device.host);
    const [discovered, arpOutput] = await Promise.all([
      this.mdnsDiscoverer({ timeoutMs }).catch(() => []),
      this.platform === "win32"
        ? this.commandRunner("arp.exe", ["-a"]).catch(() => "")
        : Promise.resolve("")
    ]);
    const neighbors = hostsFromArpOutput(arpOutput);
    return [
      ...new Set(
        [...saved, ...discovered, ...neighbors]
          .map(normalizeHost)
          .filter(Boolean)
      )
    ];
  }

  async #probeHosts(hosts) {
    const result = [];
    const queue = [...hosts].slice(0, 80);
    const workers = Array.from(
      { length: Math.min(12, Math.max(1, queue.length)) },
      async () => {
        while (queue.length) {
          const host = queue.shift();
          const device = await this.#probeHost(host);
          if (device && !result.some((entry) => entry.id === device.id)) {
            result.push(device);
          }
        }
      }
    );
    await Promise.all(workers);
    return result;
  }

  async #probeHost(host) {
    const normalizedHost = normalizeHost(host);
    if (!normalizedHost) return null;
    try {
      const info = await this.#fetchJson(`http://${normalizedHost}/shelly`, {
        timeoutMs: 1300
      });
      const id = cleanIdentifier(
        info.id || info.mac || `${info.type || info.model}-${normalizedHost}`
      );
      if (!id) return null;
      const generation = Number(info.gen || 1) >= 2 ? Number(info.gen) : 1;
      const capability = await this.#probeControlCapability(
        normalizedHost,
        generation
      ).catch(() => null);
      return {
        id,
        name: cleanLabel(info.name || info.app || info.type || info.model || id, 80),
        host: normalizedHost,
        generation,
        model: cleanLabel(info.model || info.type || info.app || "Shelly", 80),
        channel: capability?.channel ?? 0,
        controllable:
          capability?.controllable ?? inferDeviceControllable(info),
        online: true,
        lastSeenAt: new Date().toISOString()
      };
    } catch {
      return null;
    }
  }

  async #probeControlCapability(host, generation) {
    if (Number(generation) >= 2) {
      const status = await this.#fetchJson(
        `http://${host}/rpc/Shelly.GetStatus`,
        { timeoutMs: 1600 }
      );
      const channels = Object.keys(status || {})
        .map((key) => key.match(/^switch:(\d+)$/i))
        .filter(Boolean)
        .map((match) => Number(match[1]))
        .filter(Number.isFinite)
        .sort((left, right) => left - right);
      return {
        controllable: channels.length > 0,
        channel: channels[0] ?? 0
      };
    }
    const status = await this.#fetchJson(`http://${host}/status`, {
      timeoutMs: 1600
    });
    const relays = Array.isArray(status?.relays) ? status.relays : [];
    return { controllable: relays.length > 0, channel: 0 };
  }

  async #resolveDevice(device, shouldExecute) {
    if (device.host) {
      const current = await this.#probeHost(device.host);
      assertCommandContext(shouldExecute);
      if (current?.id === device.id) return { ...device, ...current };
    }
    const hosts = await this.#discoverHosts(1200);
    assertCommandContext(shouldExecute);
    const devices = await this.#probeHosts(hosts);
    assertCommandContext(shouldExecute);
    const current = devices.find((entry) => entry.id === device.id);
    if (!current) {
      this.#rememberDevice({ ...device, online: false });
      throw new Error(
        `La prise « ${device.name || device.id} » est introuvable sur le réseau local.`
      );
    }
    return { ...device, ...current };
  }

  async #sendControl(device, operation, durationMs, shouldExecute) {
    const restoreOperation = {
      cycle: "on",
      pulse: "off"
    }[operation];
    if (!restoreOperation) {
      return this.#dispatchControl(device, operation, durationMs, shouldExecute);
    }
    const armed = await this.#dispatchControl(device, operation, durationMs, shouldExecute);
    await this.delay(durationMs);
    // Une impulsion déjà armée est restaurée sur sa prise capturée, même si
    // la commande est ensuite annulée : ne jamais laisser un relais actif.
    const restored = await this.#dispatchControl(
      device,
      restoreOperation,
      durationMs
    );
    return {
      ...armed,
      restored: true,
      durationMs,
      restoreResult: restored.result
    };
  }

  async #dispatchControl(device, operation, durationMs, shouldExecute) {
    assertCommandContext(shouldExecute);
    if (this.pythonBridge) {
      try {
        return await this.pythonBridge.control(device, operation, durationMs, {
          assertAccess: () => assertCommandContext(shouldExecute)
        });
      } catch (error) {
        if (!isPythonUnavailable(error)) throw error;
      }
    }
    assertCommandContext(shouldExecute);
    const channel = clampNumber(device.channel, 0, 16, 0);
    if (Number(device.generation) >= 2) {
      const method = operation === "toggle" ? "Switch.Toggle" : "Switch.Set";
      const params = { id: channel };
      if (operation !== "toggle") {
        params.on = operation === "on" || operation === "pulse";
      }
      if (["cycle", "pulse"].includes(operation)) {
        params.toggle_after = durationMs / 1000;
      }
      const result = await this.#fetchJson(
        `http://${device.host}/rpc/${method}`,
        {
          method: "POST",
          body: JSON.stringify(params),
          headers: { "Content-Type": "application/json" },
          timeoutMs: 4500
        }
      );
      return { ok: true, result };
    }
    const query = new URLSearchParams({
      turn:
        operation === "cycle"
          ? "off"
          : operation === "pulse"
            ? "on"
            : operation
    });
    if (["cycle", "pulse"].includes(operation)) {
      query.set("timer", String(durationMs / 1000));
    }
    const result = await this.#fetchJson(
      `http://${device.host}/relay/${channel}?${query}`,
      { timeoutMs: 4500 }
    );
    return { ok: true, result };
  }

  async #provisionWifi(device, ssid, password, assertAccess = () => {}) {
    assertAccess();
    if (this.pythonBridge) {
      try {
        await this.pythonBridge.provision({
          host: SHELLY_AP_ADDRESS,
          generation: device.generation,
          ssid,
          password
        }, { assertAccess });
        return;
      } catch (error) {
        if (!isPythonUnavailable(error)) throw error;
      }
    }
    assertAccess();
    if (Number(device.generation) >= 2) {
      await this.#fetchJson(`http://${SHELLY_AP_ADDRESS}/rpc/WiFi.SetConfig`, {
        method: "POST",
        body: JSON.stringify({
          config: {
            sta: { ssid, pass: password, enable: true }
          }
        }),
        headers: { "Content-Type": "application/json" },
        timeoutMs: 6500,
        allowConnectionReset: true
      });
      return;
    }
    const query = new URLSearchParams({
      enabled: "1",
      ssid,
      key: password
    });
    await this.#fetchJson(
      `http://${SHELLY_AP_ADDRESS}/settings/sta?${query}`,
      { timeoutMs: 6500, allowConnectionReset: true }
    );
  }

  async #fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      clampNumber(options.timeoutMs, 300, 30000, 4000)
    );
    try {
      const response = await this.fetch(url, {
        method: options.method || "GET",
        body: options.body,
        headers: options.headers,
        signal: controller.signal
      });
      const text = await response.text();
      if (!response.ok) {
        const error = new Error(
          `Shelly HTTP ${response.status}: ${text.slice(0, 200)}`
        );
        error.httpStatus = response.status;
        throw error;
      }
      return text ? JSON.parse(text) : {};
    } catch (error) {
      if (
        options.allowConnectionReset &&
        !controller.signal.aborted &&
        !error.httpStatus &&
        !(error instanceof SyntaxError)
      ) {
        return {};
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  #rememberDevice(incoming) {
    const normalized = normalizeDevice(incoming);
    if (!normalized.id) return;
    this.store.mutate((state) => {
      const irl = ensureIrlSettings(state.settings);
      const index = irl.devices.findIndex((device) => device.id === normalized.id);
      const current = index >= 0 ? irl.devices[index] : null;
      const rememberedName =
        irl.deviceNames[normalized.id] || current?.name || normalized.name;
      if (index >= 0) {
        irl.devices[index] = {
          ...current,
          ...normalized,
          name: rememberedName
        };
      } else {
        irl.devices.push({ ...normalized, name: rememberedName });
      }
      irl.deviceNames[normalized.id] = rememberedName;
    });
  }

  #enqueue(deviceId, task) {
    const previous = this.deviceQueues.get(deviceId) || Promise.resolve();
    const current = previous.catch(() => {}).then(task);
    this.deviceQueues.set(deviceId, current);
    return current.finally(() => {
      if (this.deviceQueues.get(deviceId) === current) {
        this.deviceQueues.delete(deviceId);
      }
    });
  }

  async #scanWifiNetworks() {
    if (this.platform !== "win32") {
      return { currentNetwork: "", networks: [] };
    }
    const [currentNetwork, output] = await Promise.all([
      this.#currentWifiNetwork(),
      this.commandRunner("netsh.exe", ["wlan", "show", "networks", "mode=bssid"])
        .catch(() => "")
    ]);
    const networks = [];
    for (const match of String(output).matchAll(/^\s*SSID\s+\d+\s*:\s*(.+?)\s*$/gim)) {
      const ssid = cleanWifiName(match[1]);
      if (ssid && !networks.some((entry) => entry.ssid === ssid)) {
        networks.push({ ssid });
      }
    }
    return { currentNetwork, networks };
  }

  async #currentWifiNetwork() {
    if (this.platform !== "win32") return "";
    const output = await this.commandRunner("netsh.exe", [
      "wlan",
      "show",
      "interfaces"
    ]).catch(() => "");
    const match = String(output).match(/^\s*SSID\s*:\s*(.+?)\s*$/im);
    return cleanWifiName(match?.[1]);
  }

  async #connectOpenWifi(ssid) {
    const filename = path.join(
      this.temporaryDirectory,
      `shenpulse-shelly-${randomUUID()}.xml`
    );
    const escaped = escapeXml(ssid);
    const profile = `<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>${escaped}</name>
  <SSIDConfig><SSID><name>${escaped}</name></SSID></SSIDConfig>
  <connectionType>ESS</connectionType><connectionMode>manual</connectionMode>
  <MSM><security><authEncryption><authentication>open</authentication><encryption>none</encryption><useOneX>false</useOneX></authEncryption></security></MSM>
</WLANProfile>`;
    fs.writeFileSync(filename, profile, { encoding: "utf8", mode: 0o600 });
    try {
      await this.commandRunner("netsh.exe", [
        "wlan",
        "add",
        "profile",
        `filename=${filename}`,
        "user=current"
      ]);
      await this.commandRunner("netsh.exe", [
        "wlan",
        "connect",
        `name=${ssid}`,
        `ssid=${ssid}`
      ]);
    } finally {
      fs.rmSync(filename, { force: true });
    }
  }

  async #restoreWifi(previousNetwork, temporaryProfile, fallbackNetwork = "") {
    const reconnectNetwork =
      previousNetwork && previousNetwork !== temporaryProfile
        ? previousNetwork
        : fallbackNetwork && fallbackNetwork !== temporaryProfile
          ? fallbackNetwork
          : "";
    if (reconnectNetwork) {
      await this.commandRunner("netsh.exe", [
        "wlan",
        "connect",
        `name=${reconnectNetwork}`,
        `ssid=${reconnectNetwork}`
      ]).catch(() => {});
    } else {
      await this.commandRunner("netsh.exe", ["wlan", "disconnect"]).catch(() => {});
    }
    await delay(900);
    await this.commandRunner("netsh.exe", [
      "wlan",
      "delete",
      "profile",
      `name=${temporaryProfile}`
    ]).catch(() => {});
  }
}

module.exports = {
  ShellyService,
  discoverMdnsHosts,
  hostsFromArpOutput,
  hostsFromMdnsRecords,
  isPlugPlusDevice,
  mdnsQueryPacket,
  normalizeDevice,
  normalizeHost,
  normalizeIrlSettings,
  parseMdnsPacket
};
