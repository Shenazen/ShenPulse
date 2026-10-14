/* Résumé du LIVE courant ou précédent, partagé entre le noyau et les pages créateur. */
(function exposeLiveStatistics(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ShenPulseLiveStatistics = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createLiveStatisticsApi() {
  "use strict";

  const MAX_PARTICIPANTS = 1000;
  const MAX_AUDIENCE_POINTS = 120;
  const AUDIENCE_INTERVAL_MS = 30_000;
  const METRIC_KEYS = ["events", "gifts", "giftCoins", "likes", "followers", "shares", "comments"];
  const TEST_SOURCES = new Set(["simulator", "test", "rule-test", "manual-preview", "demo"]);

  function nonnegative(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  function optionalCount(value) {
    return value == null || value === "" ? null : nonnegative(value, null);
  }

  /** Total du LIVE affiché au dashboard et au Like Goal, jamais le cumul historique. */
  function liveLikeCount(live = {}) {
    return optionalCount(live?.platformLikes) ?? nonnegative(live?.likes);
  }

  /** Même exclusion des simulations pour les statistiques et les compteurs LIVE. */
  function isRealLiveEvent(state, event) {
    const source = String(event?.source || "");
    return state?.session?.running === true && !TEST_SOURCES.has(source) &&
      !source.startsWith("demo") &&
      !state.connections?.some((connection) => connection.id === source && connection.type === "demo");
  }

  /** Le compteur runtime prévaut, même à zéro ; anciens snapshots acceptés. */
  function uniqueViewerCount(statistics = {}, session = true, fallback = 0) {
    const count = optionalCount(statistics?.[session ? "sessionUniqueViewerCount" : "uniqueViewerCount"]);
    if (count !== null) return Math.floor(count);
    const legacy = statistics?.[session ? "sessionUniqueViewers" : "uniqueViewers"];
    if (Array.isArray(legacy)) return legacy.length;
    return Math.floor(optionalCount(legacy) ?? nonnegative(fallback));
  }

  function createLiveStatistics() {
    return {
      schemaVersion: 1, hasData: false, roomId: "", platform: "", username: "",
      startedAt: null, endedAt: null, events: 0, gifts: 0, giftCoins: 0,
      likes: 0, platformLikes: null, followers: 0, shares: 0, comments: 0,
      currentViewers: null, peakViewers: null,
      viewersByPlatform: { tiktok: null, kick: null },
      participants: [], topDonors: [], audienceHistory: [], engagementHistory: []
    };
  }

  /** Normalisation aux frontières disque/compte uniquement, jamais pour chaque événement. */
  function normalizeLiveStatistics(value) {
    const source = value && typeof value === "object" ? value : {};
    const result = createLiveStatistics();
    for (const key of METRIC_KEYS) result[key] = nonnegative(source[key]);
    result.hasData = source.hasData === true;
    result.roomId = String(source.roomId || "").slice(0, 160);
    result.platform = ["tiktok", "kick", "multi"].includes(source.platform) ? source.platform : "";
    result.username = String(source.username || "").slice(0, 120);
    for (const key of ["startedAt", "endedAt"]) {
      result[key] = Number.isFinite(Date.parse(source[key])) ? source[key] : null;
    }
    for (const key of ["platformLikes", "currentViewers", "peakViewers"]) result[key] = optionalCount(source[key]);
    for (const platform of ["tiktok", "kick"]) result.viewersByPlatform[platform] = optionalCount(source.viewersByPlatform?.[platform]);
    result.participants = Array.isArray(source.participants)
      ? source.participants.slice(-MAX_PARTICIPANTS).filter((row) => row && typeof row === "object").map((row) => ({
        id: String(row.id || "").slice(0, 120), name: String(row.name || "").slice(0, 160),
        username: String(row.username || "").slice(0, 120), avatarUrl: String(row.avatarUrl || "").slice(0, 2000),
        platform: ["tiktok", "kick"].includes(row.platform) ? row.platform : "",
        subscriber: row.subscriber === true, moderator: row.moderator === true,
        teamLevel: nonnegative(row.teamLevel),
        events: nonnegative(row.events), likes: nonnegative(row.likes), gifts: nonnegative(row.gifts),
        coins: nonnegative(row.coins), comments: nonnegative(row.comments), shares: nonnegative(row.shares),
        follows: nonnegative(row.follows), lastSeen: Number.isFinite(Date.parse(row.lastSeen)) ? row.lastSeen : null
      })).filter((row) => row.id)
      : [];
    result.engagementHistory = Array.isArray(source.engagementHistory)
      ? source.engagementHistory.slice(-MAX_AUDIENCE_POINTS).filter((point) => Number.isFinite(Date.parse(point?.timestamp)))
        .map((point) => ({ timestamp: point.timestamp, likes: nonnegative(point.likes), comments: nonnegative(point.comments), shares: nonnegative(point.shares) }))
      : [];
    result.audienceHistory = Array.isArray(source.audienceHistory)
      ? source.audienceHistory.slice(-MAX_AUDIENCE_POINTS).filter((point) => Number.isFinite(Date.parse(point?.timestamp)) && optionalCount(point.viewers) !== null)
        .map((point) => ({ timestamp: point.timestamp, viewers: nonnegative(point.viewers) }))
      : [];
    result.topDonors = Array.isArray(source.topDonors) ? source.topDonors.slice(0, 100)
      .filter((row) => row?.id).map((row) => ({ id: String(row.id).slice(0, 120),
        platform: ["tiktok", "kick"].includes(row.platform) ? row.platform : "",
        name: String(row.name || "").slice(0, 160), username: String(row.username || "").slice(0, 120),
        avatarUrl: String(row.avatarUrl || "").slice(0, 2000), coins: nonnegative(row.coins), gifts: nonnegative(row.gifts) }))
      .sort((left, right) => right.coins - left.coins || right.gifts - left.gifts) : [];
    return result;
  }

  function detectedLive(state) {
    const tiktok = state?.settings?.tiktok?.status === "live";
    const kick = state?.settings?.kick?.live === true;
    return { active: tiktok || kick, platform: tiktok && kick ? "multi" : tiktok ? "tiktok" : kick ? "kick" : "" };
  }

  return { MAX_PARTICIPANTS, MAX_AUDIENCE_POINTS, AUDIENCE_INTERVAL_MS, METRIC_KEYS,
    nonnegative, optionalCount, liveLikeCount, isRealLiveEvent, uniqueViewerCount,
    createLiveStatistics, normalizeLiveStatistics, detectedLive };
});
