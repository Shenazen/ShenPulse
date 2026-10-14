"use strict";

/** shelly : module « devices », sans initialisation externe au chargement. */


function ensureIrlSettings(settings = {}) {
  settings.irl = normalizeIrlSettings(settings.irl);
  return settings.irl;
}

function normalizeIrlSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const deviceNames = normalizeDeviceNames(source.deviceNames);
  const devices = Array.isArray(source.devices)
    ? source.devices
        .map(normalizeDevice)
        .filter((device) => device.id)
        .map((device) => {
          const rememberedName = deviceNames[device.id] || device.name;
          deviceNames[device.id] = rememberedName;
          return { ...device, name: rememberedName };
        })
    : [];
  return { enabled: source.enabled === true, devices, deviceNames };
}

function normalizeDeviceNames(value) {
  const source =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    Object.entries(source)
      .slice(0, 200)
      .map(([id, name]) => [cleanIdentifier(id), cleanLabel(name, 80)])
      .filter(([id, name]) => id && name)
  );
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

function isPlugPlusDevice(value = {}) {
  const identity = `${value.id || ""} ${value.model || ""} ${value.type || ""} ${value.app || ""}`;
  return /(?:shellyplusplugs|plusplugs|snpl-00112eu|shelly\s+plus\s+plug\s+s)/i.test(
    identity
  );
}

function isPlugPlusAccessPoint(value) {
  return /^shellyplusplugs(?:-|$)/i.test(cleanWifiName(value));
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

function hostsFromArpOutput(output) {
  const hosts = [];
  for (const match of String(output || "").matchAll(
    /^\s*((?:\d{1,3}\.){3}\d{1,3})\s+([0-9a-f]{2}(?:[:-][0-9a-f]{2}){5})\s+/gim
  )) {
    const host = normalizeHost(match[1]);
    const mac = match[2].replaceAll("-", ":").toLowerCase();
    if (
      host &&
      !host.endsWith(".0") &&
      !host.endsWith(".255") &&
      mac !== "ff:ff:ff:ff:ff:ff" &&
      !hosts.includes(host)
    ) {
      hosts.push(host);
    }
  }
  return hosts;
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

module.exports = { ensureIrlSettings, normalizeIrlSettings, normalizeDeviceNames, normalizeDevice, inferDeviceControllable, isPlugPlusDevice, isPlugPlusAccessPoint, normalizeHost, cleanIdentifier, cleanLabel, cleanWifiName, hostsFromArpOutput, normalizeOperation, isPythonUnavailable, clampNumber, escapeXml };

