"use strict";

const dgram = require("node:dgram");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { assertAdminAccount } = require("./account-access");

const SHELLY_AP_ADDRESS = "192.168.33.1";
const MDNS_ADDRESS = "224.0.0.251";
const MDNS_PORT = 5353;
const OWNER_EMAIL = "alexandre.leuridan@gmail.com";

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
    this.#assertOwner();
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
    this.#assertOwner();
    const [hosts, wifi] = await Promise.all([
      this.#discoverHosts(timeoutMs),
      this.#scanWifiNetworks()
    ]);
    const devices = await this.#probeHosts(hosts);
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
        /^shelly/i.test(network.ssid)
      ),
      devices: this.#settings().devices.map((device) => ({ ...device }))
    };
  }

  async addDevice({ host, name = "" } = {}) {
    this.#assertOwner();
    const device = await this.#probeHost(host);
    if (!device) {
      throw new Error(
        "Aucune prise Shelly n’a répondu à cette adresse sur le réseau local."
      );
    }
    if (name) device.name = cleanLabel(name, 80);
    this.#rememberDevice(device);
    return this.status();
  }

  removeDevice(deviceId) {
    this.#assertOwner();
    const targetId = cleanIdentifier(deviceId);
    this.store.mutate((state) => {
      const irl = ensureIrlSettings(state.settings);
      irl.devices = irl.devices.filter((device) => device.id !== targetId);
    }, true);
    return this.status();
  }

  renameDevice(deviceId, name) {
    this.#assertOwner();
    const targetId = cleanIdentifier(deviceId);
    const nextName = cleanLabel(name, 80);
    if (!nextName) throw new Error("Le nom de la prise est requis.");
    this.store.mutate((state) => {
      const device = ensureIrlSettings(state.settings).devices.find(
        (entry) => entry.id === targetId
      );
      if (!device) throw new Error("Prise Shelly introuvable.");
      device.name = nextName;
    }, true);
    return this.status();
  }

  setEnabled(enabled) {
    this.#assertOwner();
    this.store.mutate((state) => {
      ensureIrlSettings(state.settings).enabled = enabled === true;
    }, true);
    return this.status();
  }

  async pair({ accessPointSsid, wifiSsid, wifiPassword = "" } = {}) {
    this.#assertOwner();
    if (this.platform !== "win32") {
      throw new Error(
        "L’association automatique Shelly est actuellement disponible sur Windows."
      );
    }
    const shellySsid = cleanWifiName(accessPointSsid);
    const targetWifi = cleanWifiName(wifiSsid);
    if (!/^shelly/i.test(shellySsid)) {
      throw new Error("Choisissez le réseau Wi-Fi créé par la prise Shelly.");
    }
    if (!targetWifi) throw new Error("Le réseau Wi-Fi de la maison est requis.");

    const previousNetwork = await this.#currentWifiNetwork();
    let identified = null;
    let provisioned = false;
    try {
      await this.#connectOpenWifi(shellySsid);
      identified = await waitFor(
        () => this.#probeHost(SHELLY_AP_ADDRESS),
        { timeoutMs: 18000, intervalMs: 650 }
      );
      if (!identified) {
        throw new Error(
          "La prise n’a pas répondu. Rapprochez-la du PC et relancez son mode association."
        );
      }
      await this.#provisionWifi(
        identified,
        targetWifi,
        String(wifiPassword || "")
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
      const hosts = await this.#discoverHosts(900);
      const devices = await this.#probeHosts(hosts);
      return devices.find((device) => device.id === identified.id) || null;
    }, { timeoutMs: 24000, intervalMs: 1300 });

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
    this.#assertOwner();
    return this.control(
      { deviceId, operation, durationMs },
      { ignoreGlobalSwitch: true }
    );
  }

  async control(config = {}, { ignoreGlobalSwitch = false } = {}) {
    this.#assertOwner();
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
    const operation = normalizeOperation(config.operation);
    const durationMs = clampNumber(config.durationMs, 500, 60000, 3000);
    return this.#enqueue(device.id, async () => {
      const target = await this.#resolveDevice(device);
      const result = await this.#sendControl(target, operation, durationMs);
      this.#rememberDevice({
        ...target,
        online: true,
        lastSeenAt: new Date().toISOString()
      });
      return { ...result, deviceId: target.id, operation };
    });
  }

  #assertOwner() {
    assertAdminAccount(this.store);
    const email = String(
      this.store.getState().settings.account?.email || ""
    ).trim().toLowerCase();
    if (email !== OWNER_EMAIL) {
      throw new Error("Les interactions IRL sont réservées au propriétaire.");
    }
  }

  #settings() {
    const settings = this.store.getState().settings || {};
    return normalizeIrlSettings(settings.irl);
  }

  async #discoverHosts(timeoutMs) {
    const saved = this.#settings().devices.map((device) => device.host);
    const discovered = await this.mdnsDiscoverer({ timeoutMs }).catch(() => []);
    return [...new Set([...saved, ...discovered].map(normalizeHost).filter(Boolean))];
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

  async #resolveDevice(device) {
    if (device.host) {
      const current = await this.#probeHost(device.host);
      if (current?.id === device.id) return { ...device, ...current };
    }
    const hosts = await this.#discoverHosts(1200);
    const devices = await this.#probeHosts(hosts);
    const current = devices.find((entry) => entry.id === device.id);
    if (!current) {
      this.#rememberDevice({ ...device, online: false });
      throw new Error(
        `La prise « ${device.name || device.id} » est introuvable sur le réseau local.`
      );
    }
    return { ...device, ...current };
  }

  async #sendControl(device, operation, durationMs) {
    const restoreOperation = {
      cycle: "on",
      pulse: "off"
    }[operation];
    if (!restoreOperation) {
      return this.#dispatchControl(device, operation, durationMs);
    }
    const armed = await this.#dispatchControl(device, operation, durationMs);
    await this.delay(durationMs);
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

  async #dispatchControl(device, operation, durationMs) {
    if (this.pythonBridge) {
      try {
        return await this.pythonBridge.control(device, operation, durationMs);
      } catch (error) {
        if (!isPythonUnavailable(error)) throw error;
      }
    }
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

  async #provisionWifi(device, ssid, password) {
    if (this.pythonBridge) {
      try {
        await this.pythonBridge.provision({
          host: SHELLY_AP_ADDRESS,
          generation: device.generation,
          ssid,
          password
        });
        return;
      } catch (error) {
        if (!isPythonUnavailable(error)) throw error;
      }
    }
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
      if (index >= 0) {
        irl.devices[index] = {
          ...irl.devices[index],
          ...normalized,
          name: irl.devices[index].name || normalized.name
        };
      } else {
        irl.devices.push(normalized);
      }
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

function ensureIrlSettings(settings = {}) {
  settings.irl = normalizeIrlSettings(settings.irl);
  return settings.irl;
}

function normalizeIrlSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const devices = Array.isArray(source.devices)
    ? source.devices.map(normalizeDevice).filter((device) => device.id)
    : [];
  return { enabled: source.enabled === true, devices };
}

function normalizeDevice(value = {}) {
  return {
    id: cleanIdentifier(value.id),
    name: cleanLabel(value.name || value.model || value.id || "Shelly", 80),
    host: normalizeHost(value.host),
    generation: clampNumber(value.generation, 1, 9, 1),
    model: cleanLabel(value.model || "Shelly", 80),
    channel: clampNumber(value.channel, 0, 16, 0),
    controllable:
      typeof value.controllable === "boolean"
        ? value.controllable
        : inferDeviceControllable(value),
    online: value.online === true,
    lastSeenAt: cleanLabel(value.lastSeenAt, 64)
  };
}

function inferDeviceControllable(value = {}) {
  const identity = `${value.id || ""} ${value.model || ""} ${value.type || ""}`;
  return !/(?:shellypro3em|spem-003|shellyem3|shem-3)/i.test(identity);
}

function normalizeHost(value) {
  const host = String(value || "").trim().toLowerCase();
  if (!host || host.length > 253) return "";
  if (!/^[a-z0-9.-]+$/i.test(host)) return "";
  if (host === "localhost" || host.endsWith(".local")) return host;
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => part < 0 || part > 255)) {
    return "";
  }
  if (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  ) {
    return host;
  }
  return "";
}

function cleanIdentifier(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .slice(0, 160);
}

function cleanLabel(value, maxLength = 120) {
  return String(value || "").trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maxLength);
}

function cleanWifiName(value) {
  return cleanLabel(value, 32);
}

function normalizeOperation(value) {
  const operation = String(value || "toggle").toLowerCase();
  if (!["on", "off", "toggle", "cycle", "pulse"].includes(operation)) {
    throw new Error("Commande Shelly invalide.");
  }
  return operation;
}

function isPythonUnavailable(error) {
  return error?.code === "IRL_PYTHON_UNAVAILABLE";
}

function clampNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(task, { timeoutMs, intervalMs }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await task().catch(() => null);
    if (value) return value;
    await delay(intervalMs);
  }
  return null;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 },
      (error, stdout) => (error ? reject(error) : resolve(stdout || ""))
    );
  });
}

function encodeDnsName(name) {
  const labels = String(name).split(".").filter(Boolean);
  return Buffer.concat([
    ...labels.map((label) => {
      const content = Buffer.from(label, "utf8");
      return Buffer.concat([Buffer.from([content.length]), content]);
    }),
    Buffer.from([0])
  ]);
}

function mdnsQueryPacket() {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(2, 4);
  const question = (name) => {
    const suffix = Buffer.alloc(4);
    suffix.writeUInt16BE(12, 0);
    suffix.writeUInt16BE(0x8001, 2);
    return Buffer.concat([encodeDnsName(name), suffix]);
  };
  return Buffer.concat([
    header,
    question("_shelly._tcp.local"),
    question("_http._tcp.local")
  ]);
}

function readDnsName(buffer, offset) {
  const labels = [];
  let cursor = offset;
  let nextOffset = offset;
  let jumped = false;
  let steps = 0;
  while (cursor < buffer.length && steps < 80) {
    steps += 1;
    const length = buffer[cursor];
    if (length === 0) {
      if (!jumped) nextOffset = cursor + 1;
      break;
    }
    if ((length & 0xc0) === 0xc0) {
      if (cursor + 1 >= buffer.length) throw new Error("Pointeur DNS incomplet.");
      const pointer = ((length & 0x3f) << 8) | buffer[cursor + 1];
      if (!jumped) nextOffset = cursor + 2;
      cursor = pointer;
      jumped = true;
      continue;
    }
    const start = cursor + 1;
    const end = start + length;
    if (end > buffer.length) throw new Error("Nom DNS incomplet.");
    labels.push(buffer.toString("utf8", start, end));
    cursor = end;
    if (!jumped) nextOffset = cursor;
  }
  return { name: labels.join(".").toLowerCase(), nextOffset };
}

function parseMdnsPacket(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return [];
  let offset = 12;
  const questions = buffer.readUInt16BE(4);
  const recordsCount =
    buffer.readUInt16BE(6) +
    buffer.readUInt16BE(8) +
    buffer.readUInt16BE(10);
  for (let index = 0; index < questions; index += 1) {
    const name = readDnsName(buffer, offset);
    offset = name.nextOffset + 4;
    if (offset > buffer.length) return [];
  }
  const records = [];
  for (let index = 0; index < recordsCount; index += 1) {
    const owner = readDnsName(buffer, offset);
    offset = owner.nextOffset;
    if (offset + 10 > buffer.length) break;
    const type = buffer.readUInt16BE(offset);
    const length = buffer.readUInt16BE(offset + 8);
    const dataOffset = offset + 10;
    const end = dataOffset + length;
    if (end > buffer.length) break;
    const record = { name: owner.name, type };
    if (type === 1 && length === 4) {
      record.address = [...buffer.subarray(dataOffset, end)].join(".");
    } else if (type === 12) {
      record.target = readDnsName(buffer, dataOffset).name;
    } else if (type === 33 && length >= 6) {
      record.port = buffer.readUInt16BE(dataOffset + 4);
      record.target = readDnsName(buffer, dataOffset + 6).name;
    }
    records.push(record);
    offset = end;
  }
  return records;
}

function hostsFromMdnsRecords(records) {
  const serviceInstances = new Set(
    records
      .filter(
        (record) =>
          record.type === 12 &&
          ["_shelly._tcp.local", "_http._tcp.local"].includes(record.name)
      )
      .map((record) => record.target)
      .filter(Boolean)
  );
  const serviceHosts = new Set(
    records
      .filter(
        (record) =>
          record.type === 33 &&
          (serviceInstances.has(record.name) || record.name.includes("shelly"))
      )
      .map((record) => record.target)
      .filter(Boolean)
  );
  const result = [];
  for (const record of records) {
    if (record.type !== 1 || !record.address) continue;
    if (serviceHosts.has(record.name) || record.name.includes("shelly")) {
      result.push(record.address);
    }
  }
  for (const host of serviceHosts) result.push(host);
  return [...new Set(result.map(normalizeHost).filter(Boolean))];
}

function discoverMdnsHosts({ timeoutMs = 1400 } = {}) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    const records = [];
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      try {
        socket.close();
      } catch {
        // The socket may already have closed after a network change.
      }
      resolve(hostsFromMdnsRecords(records));
    };
    const timer = setTimeout(finish, clampNumber(timeoutMs, 300, 5000, 1400));
    socket.on("message", (message) => {
      try {
        records.push(...parseMdnsPacket(message));
      } catch {
        // Ignore malformed packets from unrelated multicast services.
      }
    });
    socket.once("error", () => {
      clearTimeout(timer);
      finish();
    });
    socket.bind(0, () => {
      socket.send(mdnsQueryPacket(), MDNS_PORT, MDNS_ADDRESS, (error) => {
        if (error) {
          clearTimeout(timer);
          finish();
        }
      });
    });
  });
}

module.exports = {
  ShellyService,
  discoverMdnsHosts,
  hostsFromMdnsRecords,
  mdnsQueryPacket,
  normalizeDevice,
  normalizeHost,
  normalizeIrlSettings,
  parseMdnsPacket
};
