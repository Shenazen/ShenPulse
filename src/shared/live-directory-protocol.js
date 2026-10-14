"use strict";

const LIVE_DIRECTORY_PATH = "publicLiveDirectory";
const LIVE_DIRECTORY_TTL_MS = 90000;
const LIVE_DIRECTORY_LIMIT = 100;
const LIVE_DIRECTORY_DATABASE_URL = "https://shenazenoverlay-default-rtdb.firebaseio.com";

function directoryUsername(value, platform) {
  const username = String(value || "").trim().replace(/^@+/, "");
  const pattern = platform === "kick" ? /^[A-Za-z0-9_.-]{1,160}$/ : /^[A-Za-z0-9_.]{1,80}$/;
  return pattern.test(username) ? username : "";
}

function directoryAvatarUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value));
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (url.protocol !== "https:" || url.username || url.password || url.href.length > 1000 ||
        (url.port && url.port !== "443") || host === "localhost" || host.endsWith(".localhost") ||
        host.endsWith(".local") || host === "::1" || /^(?:0|10|127|169\.254|192\.168)\./.test(host) ||
        /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)) return "";
    return url.href;
  } catch { return ""; }
}

function directoryViewers(value) {
  return Number.isInteger(value) && value >= 0 && value <= 1000000000 ? value : null;
}

function localLiveStreams(state = {}) {
  const settings = state.settings || {};
  const connections = Array.isArray(state.connections) ? state.connections : [];
  const active = (id, types) => connections.find((entry) => entry.id === id && types.includes(entry.type) &&
    entry.enabled === true && entry.status === "connected" && (!entry.liveStatus || entry.liveStatus === "live"));
  const streams = {};
  const tiktok = settings.tiktok || {};
  const tiktokSource = active("source_tiktok", ["tiktok-direct", "tiktok-relay"]);
  const username = directoryUsername(tiktokSource?.config?.username || tiktok.username, "tiktok");
  const broadcaster = tiktok.broadcaster;
  const matchingBroadcaster = !broadcaster || String(broadcaster.username || "").replace(/^@+/, "").toLowerCase() === username.toLowerCase();
  if (tiktokSource && tiktok.status === "live" && username && matchingBroadcaster) {
    streams.tiktok = { username, avatarUrl: directoryAvatarUrl(broadcaster?.avatarUrl) };
    const viewers = directoryViewers(tiktok.currentViewers);
    if (viewers !== null) streams.tiktok.viewers = viewers;
  }
  const kick = settings.kick || {};
  const kickSource = active("source_kick", ["kick-native"]);
  const kickUsername = directoryUsername(kick.account?.name, "kick");
  if (kickSource && kick.live === true && kickUsername) {
    streams.kick = { username: kickUsername, avatarUrl: directoryAvatarUrl(kick.account?.avatarUrl) };
    // The current Kick adapter uses zero as a fallback when the API omits its audience.
    const viewers = directoryViewers(kick.viewers);
    if (viewers !== null && viewers > 0) streams.kick.viewers = viewers;
  }
  return streams;
}

function sanitizeDirectoryRows(entries, { now = Date.now(), ownUid = "" } = {}) {
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) return [];
  const rows = [];
  const records = Object.entries(entries).filter(([uid]) => /^[A-Za-z0-9_-]{1,128}$/.test(uid))
    .sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0)).slice(0, LIVE_DIRECTORY_LIMIT);
  for (const [uid, entry] of records) {
    if (!entry || entry.protocolVersion !== 1 || !/^[A-Za-z0-9-]{1,80}$/.test(String(entry.instanceId || "")) ||
        !Number.isInteger(entry.updatedAt) || entry.updatedAt < now - LIVE_DIRECTORY_TTL_MS || entry.updatedAt > now + 30000) continue;
    for (const platform of ["tiktok", "kick"]) {
      const stream = entry.streams?.[platform];
      const username = directoryUsername(stream?.username, platform);
      if (!username) continue;
      rows.push({ id: `${uid}:${platform}`, platform: platform === "tiktok" ? "TikTok" : "Kick", username,
        avatarUrl: directoryAvatarUrl(stream.avatarUrl), viewers: directoryViewers(stream.viewers),
        updatedAt: entry.updatedAt, own: uid === ownUid });
    }
  }
  // One public handle may be monitored from multiple devices/accounts; it remains one broadcast.
  const unique = new Map();
  for (const row of rows) {
    const key = `${row.platform}:${row.username.toLowerCase()}`;
    const previous = unique.get(key);
    if (!previous || row.own) unique.set(key, row);
  }
  return [...unique.values()].sort((a, b) => (b.viewers ?? -1) - (a.viewers ?? -1) || b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}

module.exports = { LIVE_DIRECTORY_PATH, LIVE_DIRECTORY_TTL_MS, LIVE_DIRECTORY_LIMIT, LIVE_DIRECTORY_DATABASE_URL,
  directoryUsername, directoryAvatarUrl, directoryViewers, localLiveStreams, sanitizeDirectoryRows };
