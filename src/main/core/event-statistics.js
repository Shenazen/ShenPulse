"use strict";

/** Les anciens compteurs restent compatibles ; liveSession exclut strictement les tests. */
const {
  MAX_PARTICIPANTS, MAX_AUDIENCE_POINTS, AUDIENCE_INTERVAL_MS,
  createLiveStatistics, nonnegative, optionalCount, detectedLive, isRealLiveEvent
} = require("../../shared/live-statistics");

const participantIndexes = new WeakMap();

function appendHistoryPoint(history, point) {
  const last = history.at(-1);
  const bucket = Math.floor(Date.parse(point.timestamp) / AUDIENCE_INTERVAL_MS);
  if (last && Math.floor(Date.parse(last.timestamp) / AUDIENCE_INTERVAL_MS) === bucket) history[history.length - 1] = point;
  else {
    history.push(point);
    if (history.length > MAX_AUDIENCE_POINTS) history.shift();
  }
}

function ensureLiveStatistics(state) {
  const statistics = state.statistics;
  if (statistics.liveSession?.schemaVersion !== 1) statistics.liveSession = createLiveStatistics();
  return statistics.liveSession;
}

/** Même salle après un redémarrage : conserver les chiffres, sans affirmer un faux direct. */
function beginLiveStatistics(state, now = state.session?.startedAt || new Date().toISOString()) {
  const previous = ensureLiveStatistics(state);
  const roomId = String(state.session?.tiktokRoomId || "");
  if (roomId && previous.hasData && previous.roomId === roomId) {
    previous.endedAt = null;
    return previous;
  }
  const detected = detectedLive(state);
  const platform = detected.platform || (state.session?.startedBy === "tiktok" ? "tiktok" : state.session?.startedBy === "kick" ? "kick" : "");
  state.statistics.liveSession = {
    ...createLiveStatistics(), startedAt: now,
    platform, roomId,
    username: String(platform === "kick" ? state.settings?.kick?.account?.name || state.settings?.kick?.channel || "" : state.settings?.tiktok?.username || "")
  };
  return state.statistics.liveSession;
}

function finishLiveStatistics(state, now = new Date().toISOString()) {
  const live = ensureLiveStatistics(state);
  if (live.hasData && !live.endedAt) live.endedAt = now;
  return live;
}

function recordLiveAudience(state, platform, value, now = new Date().toISOString()) {
  const viewers = optionalCount(value);
  if (viewers === null || !["tiktok", "kick"].includes(platform)) return;
  const live = ensureLiveStatistics(state);
  if (!state.session?.running) return;
  live.hasData = true;
  live.endedAt = null;
  live.platform = live.platform && live.platform !== platform ? "multi" : platform;
  live.viewersByPlatform[platform] = viewers;
  refreshLiveAudience(state, now);
}

/** Une source quittant un LIVE mixte ne doit plus gonfler l'audience restante. */
function refreshLiveAudience(state, now = new Date().toISOString(), excludedPlatform = "") {
  if (!state.session?.running) return;
  const live = ensureLiveStatistics(state);
  const active = detectedLive(state);
  const counts = [
    active.platform !== "kick" && excludedPlatform !== "tiktok" ? live.viewersByPlatform.tiktok : null,
    active.platform !== "tiktok" && excludedPlatform !== "kick" ? live.viewersByPlatform.kick : null
  ].filter((count) => count !== null);
  if (!counts.length) {
    // Sans autre source LIVE, préserver la dernière audience du bilan terminé.
    // Si une source est toujours LIVE mais inconnue, ne pas afficher l'ancienne somme.
    if (active.active && active.platform !== excludedPlatform) live.currentViewers = null;
    return;
  }
  live.currentViewers = counts.reduce((sum, count) => sum + count, 0);
  live.peakViewers = Math.max(live.peakViewers || 0, live.currentViewers);
  const point = { timestamp: now, viewers: live.currentViewers };
  appendHistoryPoint(live.audienceHistory, point);
}

function eventPlatform(event) {
  return /kick/i.test(event.source) ? "kick" : /tiktok/i.test(event.source) ? "tiktok" : "";
}

function liveParticipant(live, event, platform) {
  const id = String(event.user?.id || "");
  if (!id || id === "anonymous") return null;
  let index = participantIndexes.get(live);
  if (!index) {
    index = new Map(live.participants.map((row) => [`${row.platform}:${row.id}`, row]));
    participantIndexes.set(live, index);
  }
  const key = `${platform}:${id}`;
  let row = index.get(key);
  if (!row) {
    if (live.participants.length >= MAX_PARTICIPANTS) {
      const removed = live.participants.shift();
      index.delete(`${removed.platform}:${removed.id}`);
    }
    row = { id, platform, name: "", username: "", avatarUrl: "", events: 0, likes: 0,
      gifts: 0, coins: 0, comments: 0, shares: 0, follows: 0, lastSeen: null };
    live.participants.push(row);
    index.set(key, row);
  }
  row.name = event.user?.displayName || row.name || id;
  row.username = event.user?.name || row.username || id;
  row.avatarUrl = event.user?.avatarUrl || row.avatarUrl;
  row.subscriber = event.user?.subscriber === true;
  row.moderator = event.user?.moderator === true;
  row.teamLevel = nonnegative(event.user?.teamLevel);
  row.lastSeen = event.timestamp || new Date().toISOString();
  row.events += 1;
  return row;
}

function recordLiveEvent(state, event) {
  if (!isRealLiveEvent(state, event)) return;
  const live = ensureLiveStatistics(state);
  live.hasData = true;
  live.endedAt = null;
  const platform = eventPlatform(event);
  if (platform) live.platform = live.platform && live.platform !== platform ? "multi" : platform;
  const row = liveParticipant(live, event, platform);
  const count = Math.max(1, nonnegative(event.data?.count, 1));
  live.events += 1;
  if (event.type === "gift") {
    const coins = nonnegative(event.data?.value) * count;
    live.gifts += count;
    live.giftCoins += coins;
    if (row) { row.gifts += count; row.coins += coins; }
    if (row) {
      let donor = live.topDonors.find((entry) => entry.id === row.id && entry.platform === row.platform);
      if (!donor) {
        donor = { id: row.id, platform: row.platform, coins: 0, gifts: 0 };
        live.topDonors.push(donor);
      }
      Object.assign(donor, { name: row.name, username: row.username, avatarUrl: row.avatarUrl });
      donor.coins += coins; donor.gifts += count;
      live.topDonors.sort((left, right) => right.coins - left.coins || right.gifts - left.gifts);
      if (live.topDonors.length > 100) live.topDonors.length = 100;
    }
  } else if (event.type === "like") {
    live.likes += count;
    const total = optionalCount(event.data?.totalLikes);
    if (total > 0) live.platformLikes = Math.max(live.platformLikes || 0, total);
    if (row) row.likes += count;
  } else if (event.type === "follow") {
    live.followers += 1;
    if (row) row.follows += 1;
  } else if (event.type === "share") {
    live.shares += count;
    if (row) row.shares += count;
  } else if (event.type === "chat") {
    live.comments += 1;
    if (row) row.comments += 1;
  }
  appendHistoryPoint(live.engagementHistory, { timestamp: event.timestamp || new Date().toISOString(),
    likes: live.likes, comments: live.comments, shares: live.shares });
}

function resetSessionStatistics(state) {
  state.statistics.sessionEvents = 0;
  state.statistics.sessionActions = 0;
  state.statistics.sessionLikes = 0;
  state.statistics.sessionUniqueViewers = [];
  beginLiveStatistics(state);
}

function recordEventStatistics(state, event) {
  const statistics = state.statistics;
  const count = Number(event.data?.count || 1);
  statistics.lifetimeEvents += 1;
  if (event.type === "gift") statistics.gifts += count;
  if (event.type === "like") statistics.likes += count;
  if (event.type === "follow") statistics.follows += 1;
  if (event.type === "subscribe") statistics.subscribers += 1;

  const viewerId = event.user?.id;
  if (viewerId && !statistics.uniqueViewers.includes(viewerId)) {
    statistics.uniqueViewers.push(viewerId);
    statistics.uniqueViewers = statistics.uniqueViewers.slice(-5000);
  }

  if (!state.session.running) return;
  recordLiveEvent(state, event);
  statistics.sessionEvents += 1;
  if (event.type === "like") statistics.sessionLikes += count;
  if (
    viewerId &&
    !statistics.sessionUniqueViewers.includes(viewerId)
  ) {
    statistics.sessionUniqueViewers.push(viewerId);
    statistics.sessionUniqueViewers =
      statistics.sessionUniqueViewers.slice(-5000);
  }
}

module.exports = { resetSessionStatistics, recordEventStatistics, ensureLiveStatistics,
  beginLiveStatistics, finishLiveStatistics, recordLiveAudience, refreshLiveAudience, recordLiveEvent };
