"use strict";

const { username, text, userKey, scopeKey } = require("./normalization");
const TEST_SOURCES = new Set(["simulator", "test", "rule-test", "manual-preview", "demo"]);

function currentScopes(state) {
  const scopes = [];
  const tiktok = username(state.settings?.tiktok?.username);
  const kick = username(state.settings?.kick?.channel || state.settings?.kick?.account?.name);
  if (tiktok) scopes.push({ platform: "tiktok", streamer: tiktok });
  if (kick) scopes.push({ platform: "kick", streamer: kick });
  return scopes;
}

/** Aucun rapprochement sur le nom : TikTok et Kick ont des identités distinctes. */
function eventIdentity(state, event) {
  const source = text(event?.source, 160);
  if (TEST_SOURCES.has(source) || /^demo/i.test(source) || state.connections?.some((connection) => connection.id === source && connection.type === "demo")) return null;
  const connection = state.connections?.find((row) => row.id === source);
  const stated = event?.data?.platform || event?.data?.raw?.platform;
  const platform = stated === "kick" || /kick/i.test(source) || connection?.type === "kick-native" ? "kick" : stated === "tiktok" || /tiktok/i.test(source) || /tiktok/i.test(connection?.type || "") ? "tiktok" : "";
  const configured = currentScopes(state).find((scope) => scope.platform === platform);
  const streamer = username(event?.data?.streamer || event?.data?.raw?.streamer || connection?.config?.username || configured?.streamer);
  const userId = text(event?.user?.id, 120);
  if (!platform || !streamer || !userId || userId === "anonymous") return null;
  return { platform, streamer, userId, key: userKey(platform, streamer, userId) };
}

function scopeFilter(state, options = {}) {
  const requested = options.streamer === "*" ? "*" : username(options.streamer);
  const current = new Set(currentScopes(state).map((scope) => scopeKey(scope.platform, scope.streamer)));
  return (row) => (!options.platform || row.platform === options.platform) &&
    (requested === "*" || (requested ? row.streamer === requested : current.has(scopeKey(row.platform, row.streamer))));
}

module.exports = { TEST_SOURCES, currentScopes, eventIdentity, scopeFilter };
