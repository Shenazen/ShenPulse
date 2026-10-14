"use strict";

const { createHash } = require("node:crypto");

const MAX_VIEWERS = 10000;
const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
const COUNTERS = ["diamonds", "events", "likes", "gifts", "comments", "shares"];
const PLATFORMS = new Set(["tiktok", "kick"]);
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Contrat local : seulement les informations publiques nécessaires au classement. */
function createViewerDatabase() { return { schemaVersion: 1, revision: 0, rows: [], blockedUsers: [] }; }
function text(value, max = 160) { return typeof value === "string" || typeof value === "number" ? String(value).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) : ""; }
function username(value) { return text(value, 120).replace(/^@+/, "").toLowerCase(); }
function count(value) { const n = typeof value === "number" || typeof value === "string" ? Number(value) : NaN; return Number.isFinite(n) && n > 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(n)) : 0; }
function timestamp(value) { const time = typeof value === "string" ? Date.parse(value) : NaN; return Number.isFinite(time) ? new Date(time).toISOString() : ""; }
function imageUrl(value) {
  try { const url = new URL(text(value, 2000)); return url.protocol === "https:" && !url.username && !url.password ? url.href : ""; } catch { return ""; }
}
function scopeKey(platform, streamer) { return `${platform}\u0000${streamer}`; }
function userKey(platform, streamer, userId) { return `${scopeKey(platform, streamer)}\u0000${userId}`; }
function viewerId(platform, streamer, userId) { return `viewer_${createHash("sha256").update(userKey(platform, streamer, userId)).digest("hex")}`; }
function blockKey(platform, streamer, handle) { return `${scopeKey(platform, streamer)}\u0000${username(handle)}`; }

/** Refuse prototypes et accesseurs : un import n'exécute jamais une propriété. */
function plainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) &&
    Reflect.ownKeys(value).every((key) => typeof key === "string" && !UNSAFE_KEYS.has(key) && "value" in Object.getOwnPropertyDescriptor(value, key));
}

function normalizeViewer(value) {
  if (!plainRecord(value)) return null;
  const platform = PLATFORMS.has(value.platform) ? value.platform : "";
  const streamer = username(value.streamer);
  const userId = text(value.userId, 120);
  if (!platform || !streamer || !userId || userId === "anonymous") return null;
  const alternateUserIds = Array.isArray(value.alternateUserIds)
    ? [...new Set(value.alternateUserIds.map((id) => text(id, 120)).filter((id) => id && id !== userId))].slice(0, 32) : [];
  const firstSeen = timestamp(value.firstSeen) || timestamp(value.lastSeen);
  const lastSeen = timestamp(value.lastSeen) || firstSeen;
  return {
    id: viewerId(platform, streamer, userId), platform, streamer, userId, alternateUserIds,
    username: username(value.username), name: text(value.name), avatarUrl: imageUrl(value.avatarUrl),
    ...Object.fromEntries(COUNTERS.map((key) => [key, count(value[key])])),
    firstSeen: firstSeen && lastSeen && firstSeen > lastSeen ? lastSeen : firstSeen,
    lastSeen, blocked: value.blocked === true
  };
}

/** Imports répétés idempotents : max des compteurs, pas une double addition. */
function mergeImportedViewer(previous, incoming) {
  const latest = incoming.lastSeen >= previous.lastSeen ? incoming : previous;
  return {
    ...previous, name: latest.name || previous.name, username: latest.username || previous.username,
    avatarUrl: latest.avatarUrl || previous.avatarUrl,
    alternateUserIds: [...new Set([...previous.alternateUserIds, ...incoming.alternateUserIds])].slice(0, 32),
    ...Object.fromEntries(COUNTERS.map((key) => [key, Math.max(previous[key], incoming[key])])),
    firstSeen: [previous.firstSeen, incoming.firstSeen].filter(Boolean).sort()[0] || "",
    lastSeen: [previous.lastSeen, incoming.lastSeen].filter(Boolean).sort().at(-1) || "",
    blocked: previous.blocked || incoming.blocked
  };
}

function normalizeBlockedUsers(values) {
  const result = new Map();
  for (const value of Array.isArray(values) ? values.slice(0, MAX_VIEWERS) : []) {
    if (!plainRecord(value) || !PLATFORMS.has(value.platform)) continue;
    const row = { platform: value.platform, streamer: username(value.streamer), username: username(value.username) };
    if (row.streamer && row.username) result.set(blockKey(row.platform, row.streamer, row.username), row);
  }
  return [...result.values()];
}

function normalizeViewerDatabase(value) {
  const source = plainRecord(value) ? value : {};
  const rows = new Map();
  for (const raw of Array.isArray(source.rows) ? source.rows.slice(0, MAX_VIEWERS) : []) {
    const row = normalizeViewer(raw);
    if (!row) continue;
    rows.set(row.id, rows.has(row.id) ? mergeImportedViewer(rows.get(row.id), row) : row);
  }
  const aliases = new Map();
  for (const row of rows.values()) {
    row.alternateUserIds = row.alternateUserIds.filter((id) => {
      const key = userKey(row.platform, row.streamer, id);
      if (rows.has(viewerId(row.platform, row.streamer, id)) || aliases.has(key)) return false;
      aliases.set(key, row.id);
      return true;
    });
  }
  return { schemaVersion: 1, revision: count(source.revision), rows: [...rows.values()], blockedUsers: normalizeBlockedUsers(source.blockedUsers) };
}

/** Validation récursive bornée, y compris les propriétés que le format ignore. */
function validateImportTree(value) {
  const stack = [value];
  const visited = new Set();
  let bytes = 0;
  let items = 0;
  while (stack.length) {
    const current = stack.pop();
    if (++items > 500000) throw new Error("Le fichier utilisateurs est trop complexe.");
    if (typeof current === "string") {
      bytes += Buffer.byteLength(current, "utf8");
      if (bytes > MAX_IMPORT_BYTES) throw new Error("Le fichier utilisateurs dépasse 20 Mo.");
    } else if (current && typeof current === "object") {
      if (visited.has(current)) throw new Error("Le fichier utilisateurs contient une référence circulaire.");
      visited.add(current);
      if (!(Array.isArray(current) || plainRecord(current))) throw new Error("Le fichier utilisateurs contient un objet non autorisé.");
      for (const key of Reflect.ownKeys(current)) {
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (typeof key !== "string" || UNSAFE_KEYS.has(key) || !("value" in descriptor)) throw new Error("Le fichier utilisateurs contient une propriété non autorisée.");
        bytes += Buffer.byteLength(key, "utf8");
        if (bytes > MAX_IMPORT_BYTES) throw new Error("Le fichier utilisateurs dépasse 20 Mo.");
        if (key !== "length") stack.push(descriptor.value);
      }
    } else if (!["number", "boolean", "undefined"].includes(typeof current) && current !== null) {
      throw new Error("Le fichier utilisateurs contient une valeur non autorisée.");
    }
  }
}

function parseViewerImport(value) {
  if (typeof value === "string") {
    if (Buffer.byteLength(value, "utf8") > MAX_IMPORT_BYTES) throw new Error("Le fichier utilisateurs dépasse 20 Mo.");
    try { value = JSON.parse(value); } catch { throw new Error("Le fichier utilisateurs n'est pas un JSON valide."); }
  }
  if (!plainRecord(value) || value.format !== "shenpulse-viewers" || value.schemaVersion !== 1 || !Array.isArray(value.rows)) {
    throw new Error("Importez un export utilisateurs ShenPulse au format pris en charge.");
  }
  if (value.rows.length > MAX_VIEWERS) throw new Error("Un import est limité à 10 000 utilisateurs.");
  validateImportTree(value);
  const rows = value.rows.map(normalizeViewer);
  if (rows.some((row) => !row)) throw new Error("Une ligne utilisateur possède une identité invalide.");
  return normalizeViewerDatabase({ rows, blockedUsers: value.blockedUsers });
}

module.exports = { MAX_VIEWERS, MAX_IMPORT_BYTES, COUNTERS, PLATFORMS, createViewerDatabase, text, username, count, timestamp, imageUrl, scopeKey, userKey, viewerId, blockKey, plainRecord, normalizeViewer, mergeImportedViewer, normalizeBlockedUsers, normalizeViewerDatabase, validateImportTree, parseViewerImport };
