"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createDefaultState } = require("../src/main/defaults");
const { createLiveStatistics, normalizeLiveStatistics } = require("../src/shared/live-statistics");
const { recordEventStatistics, recordLiveAudience, finishLiveStatistics } = require("../src/main/core/event-statistics");
const { synchronizeSessionWithTikTok, synchronizeSessionWithKick, clearSessionState } = require("../src/main/core/session-state");

function liveState(roomId = "room-a") {
  const state = createDefaultState();
  state.settings.tiktok.status = "live";
  state.settings.tiktok.username = "creator";
  synchronizeSessionWithTikTok(state, "live", { roomId }, "2026-10-13T10:00:00.000Z");
  return state;
}
function event(type, data = {}, index = 1, source = "source_tiktok") {
  return { id: `event-${index}`, type, source, timestamp: "2026-10-13T10:01:00.000Z",
    user: { id: `viewer-${index}`, name: `viewer_${index}`, displayName: `Viewer ${index}`, avatarUrl: "https://example.test/avatar.webp", moderator: true }, data };
}

test("les cinq métriques du LIVE sont distinctes des cumuls historiques et du simulateur", () => {
  const state = liveState();
  Object.assign(state.statistics, { gifts: 10000, likes: 90000, follows: 8000 });
  recordEventStatistics(state, event("gift", { count: 2, value: 10 }));
  recordEventStatistics(state, event("like", { count: 30, totalLikes: 18300 }));
  recordEventStatistics(state, event("follow"));
  recordEventStatistics(state, event("share", { count: 3 }));
  recordEventStatistics(state, event("chat", { message: "Bonjour" }));
  const before = JSON.stringify(state.statistics.liveSession);
  for (const source of ["simulator", "test", "rule-test", "manual-preview", "demo", "source_demo"]) {
    recordEventStatistics(state, event("gift", { count: 100, value: 999 }, 2, source));
  }
  assert.equal(JSON.stringify(state.statistics.liveSession), before);
  const live = state.statistics.liveSession;
  assert.equal(live.gifts, 2); assert.equal(live.giftCoins, 20);
  assert.equal(live.likes, 30); assert.equal(live.platformLikes, 18300);
  assert.equal(live.followers, 1); assert.equal(live.shares, 3); assert.equal(live.comments, 1);
  assert.equal(live.events, 5); assert.equal(live.participants.length, 1);
  assert.equal(live.participants[0].coins, 20); assert.equal(live.participants[0].moderator, true);
});

test("l’audience distingue une valeur zéro réelle d’une absence de données et conserve son pic", () => {
  const state = liveState();
  for (const value of [null, undefined, "", -1, NaN, Infinity]) recordLiveAudience(state, "tiktok", value);
  assert.equal(state.statistics.liveSession.currentViewers, null);
  recordLiveAudience(state, "tiktok", 11, "2026-10-13T10:01:00Z");
  recordLiveAudience(state, "tiktok", 9, "2026-10-13T10:01:10Z");
  recordLiveAudience(state, "tiktok", 0, "2026-10-13T10:01:30Z");
  const live = state.statistics.liveSession;
  assert.equal(live.currentViewers, 0); assert.equal(live.peakViewers, 11);
  assert.deepEqual(live.audienceHistory.map((point) => point.viewers), [9, 0]);
});

test("les traces continues passent dans le bucket suivant sans croître à chaque événement", () => {
  const state = liveState();
  for (let second = 0; second < 4000; second += 1) {
    recordLiveAudience(state, "tiktok", second % 40, new Date(Date.UTC(2026, 9, 13, 10, 0, second)).toISOString());
  }
  assert.equal(state.statistics.liveSession.audienceHistory.length, 120);
  assert.equal(state.statistics.liveSession.peakViewers, 39);
});

test("les participants sont indexés par plateforme et leur historique est borné", () => {
  const state = liveState();
  for (let index = 0; index < 1010; index += 1) recordEventStatistics(state, event("chat", {}, index));
  assert.equal(state.statistics.liveSession.participants.length, 1000);
  assert.equal(state.statistics.liveSession.participants[0].id, "viewer-10");
  recordEventStatistics(state, event("like", { count: 4 }, 1009));
  assert.equal(state.statistics.liveSession.participants.length, 1000);
  assert.equal(state.statistics.liveSession.participants.at(-1).likes, 4);
  recordEventStatistics(state, event("chat", {}, 1009, "source_kick"));
  assert.equal(state.statistics.liveSession.participants.filter((row) => row.id === "viewer-1009").length, 2);
});

test("le top donateur reste cumulatif même si le participant sort du buffer de chat", () => {
  const state = liveState();
  recordEventStatistics(state, event("gift", { count: 2, value: 100 }, 0));
  for (let index = 1; index <= 1001; index += 1) recordEventStatistics(state, event("chat", {}, index));
  assert.equal(state.statistics.liveSession.participants.some((row) => row.id === "viewer-0"), false);
  recordEventStatistics(state, event("gift", { count: 1, value: 50 }, 0));
  assert.equal(state.statistics.liveSession.topDonors[0].coins, 250);
  assert.equal(state.statistics.liveSession.topDonors[0].gifts, 3);
});

test("un LIVE Kick utilise son propre @, pas l'ancien identifiant TikTok configuré", () => {
  const state = createDefaultState();
  state.settings.tiktok.username = "ancien_tiktok";
  state.settings.kick = { ...state.settings.kick, live: true, channel: "chaine_kick" };
  state.connections.push({ id: "source_kick", type: "kick-native", enabled: true });
  synchronizeSessionWithKick(state, { live: true }, "2026-10-13T10:00:00Z");
  assert.equal(state.statistics.liveSession.username, "chaine_kick");
  assert.equal(state.statistics.liveSession.platform, "kick");
});

test("un LIVE mixte ne conserve pas l'audience de la source déconnectée", () => {
  const state = liveState();
  state.connections.push({ id: "source_kick", type: "kick-native", enabled: true });
  recordLiveAudience(state, "tiktok", 7);
  state.settings.kick.live = true;
  synchronizeSessionWithKick(state, { live: true });
  recordLiveAudience(state, "kick", 3);
  assert.equal(state.statistics.liveSession.currentViewers, 10);
  state.settings.kick.live = false;
  synchronizeSessionWithKick(state, { live: false });
  assert.equal(state.statistics.liveSession.currentViewers, 7);
  assert.equal(state.statistics.liveSession.peakViewers, 10);
  state.settings.kick.live = true;
  synchronizeSessionWithKick(state, { live: true });
  recordLiveAudience(state, "kick", 4);
  state.settings.tiktok.status = "offline";
  synchronizeSessionWithTikTok(state, "offline");
  assert.equal(state.statistics.liveSession.currentViewers, 4);
  assert.equal(state.statistics.liveSession.endedAt, null);
});

test("hors LIVE le dernier bilan est conservé et ne reçoit pas de nouveaux événements", () => {
  const state = liveState();
  recordEventStatistics(state, event("gift", { count: 2, value: 10 }));
  recordLiveAudience(state, "tiktok", 7);
  clearSessionState(state);
  const before = JSON.stringify(state.statistics.liveSession);
  recordEventStatistics(state, event("like", { count: 500 }));
  recordLiveAudience(state, "tiktok", 999);
  assert.equal(JSON.stringify(state.statistics.liveSession), before);
  assert.ok(state.statistics.liveSession.endedAt);
});

test("un même LIVE conserve ses chiffres après arrêt runtime/redémarrage, une nouvelle salle repart à zéro", () => {
  const state = liveState();
  recordEventStatistics(state, event("gift", { count: 2, value: 10 }));
  finishLiveStatistics(state, "2026-10-13T10:02:00Z");
  clearSessionState(state);
  synchronizeSessionWithTikTok(state, "live", { roomId: "room-a" }, "2026-10-13T10:03:00Z");
  assert.equal(state.statistics.liveSession.gifts, 2);
  assert.equal(state.statistics.liveSession.startedAt, "2026-10-13T10:00:00.000Z");
  assert.equal(state.statistics.liveSession.endedAt, null);
  synchronizeSessionWithTikTok(state, "live", { roomId: "room-b" }, "2026-10-13T12:00:00Z");
  assert.equal(state.statistics.liveSession.gifts, 0);
  assert.equal(state.statistics.liveSession.roomId, "room-b");
});

test("normalisation disque : compteurs non finis rejetés, tailles bornées, champs inconnus supprimés", () => {
  const normalized = normalizeLiveStatistics({ ...createLiveStatistics(), hasData: true, gifts: Infinity, likes: -1,
    currentViewers: null, peakViewers: 0, privateToken: "secret", participants: Array.from({ length: 1200 }, (_, index) => ({ id: String(index), coins: index })) });
  assert.equal(normalized.gifts, 0); assert.equal(normalized.likes, 0);
  assert.equal(normalized.currentViewers, null); assert.equal(normalized.peakViewers, 0);
  assert.equal(normalized.participants.length, 1000); assert.equal(normalized.privateToken, undefined);
});
