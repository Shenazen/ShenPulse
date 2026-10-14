"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createDefaultState } = require("../src/main/defaults");
const { getRuntimeState, getRendererStatistics, getStateProjection } = require("../src/main/state/projections");
const { uniqueViewerCount } = require("../src/shared/live-statistics");
const { createGuestSnapshot, shouldSuppressRendererChannel, snapshotForRenderer } = require("../src/main/account-access");

function largeState() {
  const state = createDefaultState();
  state.statistics.sessionUniqueViewers = Array.from({ length: 1000 }, (_, index) => String(index));
  state.statistics.uniqueViewers = [...state.statistics.sessionUniqueViewers];
  state.statistics.liveSession.participants = Array.from({ length: 1000 }, (_, index) => ({
    id: String(index), name: `Viewer ${index}`, username: `viewer${index}`, platform: "tiktok", avatarUrl: `https://example.com/${index}.webp`,
    coins: index, gifts: 1, likes: index, events: index + 1, extraPrivate: { secret: "not-for-ui", large: "unused".repeat(1000) }
  }));
  state.statistics.liveSession.events = 99999;
  state.statistics.liveSession.audienceHistory = Array.from({ length: 150 }, (_, index) => ({ timestamp: new Date(1700000000000 + index * 30000).toISOString(), viewers: index }));
  state.statistics.liveSession.engagementHistory = Array.from({ length: 150 }, (_, index) => ({ timestamp: new Date(1700000000000 + index * 30000).toISOString(), likes: index }));
  state.viewerDatabase = { rows: [{ username: "private_viewer" }], blockedUsers: [{ username: "blocked_private" }] };
  return state;
}

test("runtime : statistiques scalaires, cinq vrais donateurs et courbes 120 points sans clone complet", () => {
  const state = largeState();
  const before = JSON.stringify(state);
  const runtime = getRuntimeState(state);
  assert.equal(runtime.statistics.liveSession.events, 99999);
  assert.equal(runtime.statistics.sessionUniqueViewerCount, 1000);
  assert.equal(runtime.statistics.uniqueViewerCount, 1000);
  assert.equal(runtime.statistics.liveSession.participantCount, 1000);
  assert.deepEqual(runtime.statistics.liveSession.participants.map((row) => row.coins), [999, 998, 997, 996, 995]);
  assert.deepEqual(runtime.statistics.liveSession.topDonors.map((row) => row.coins), [999, 998, 997, 996, 995]);
  assert.equal(runtime.statistics.liveSession.audienceHistory.length, 120);
  assert.equal(runtime.statistics.liveSession.audienceHistory[0].viewers, 30);
  assert.equal(runtime.statistics.liveSession.engagementHistory.length, 120);
  assert.equal(runtime.viewerDatabase, undefined);
  assert.equal(runtime.statistics.liveSession.participants[0].extraPrivate, undefined);
  assert.equal(JSON.stringify(runtime).includes("not-for-ui"), false);
  runtime.statistics.liveSession.participants[0].coins = 1;
  runtime.statistics.liveSession.audienceHistory[0].viewers = -1;
  assert.equal(JSON.stringify(state), before);
});

test("le classement indépendant garde les donateurs sortis du tampon des participants", () => {
  const state = largeState();
  state.statistics.liveSession.topDonors = Array.from({ length: 100 }, (_, index) => ({
    id: `older-${index}`, platform: "tiktok", name: `Older ${index}`, coins: 10000 - index, gifts: 1
  }));
  const before = JSON.stringify(state);
  const runtime = getRuntimeState(state);
  assert.equal(runtime.statistics.liveSession.topDonors.length, 5);
  assert.equal(runtime.statistics.liveSession.topDonors[0].id, "older-0");
  assert.deepEqual(runtime.statistics.liveSession.participants, runtime.statistics.liveSession.topDonors);
  runtime.statistics.liveSession.topDonors[0].coins = 0;
  assert.equal(runtime.statistics.liveSession.participants[0].coins, 10000);
  assert.equal(JSON.stringify(state), before);
  assert.equal(getStateProjection(state, {}, ["statistics.liveSession.topDonors"]).statistics.liveSession.topDonors.length, 100);
});

test("le résumé renderer ne tronque ni la projection métier interne ni la persistance", () => {
  const state = largeState();
  getRuntimeState(state);
  const internal = getStateProjection(state, {}, ["statistics.liveSession.participants", "viewerDatabase"]);
  assert.equal(internal.statistics.liveSession.participants.length, 1000);
  assert.equal(internal.viewerDatabase.rows[0].username, "private_viewer");
  assert.equal(state.statistics.liveSession.participants.length, 1000);
  assert.equal(state.statistics.liveSession.audienceHistory.length, 150);
});

test("les compteurs d'audience projetés gardent zéro et les anciens formats sans reconstruire des ID", () => {
  assert.equal(uniqueViewerCount({ sessionUniqueViewerCount: 0, sessionUniqueViewers: ["older"] }, true, 99), 0);
  assert.equal(uniqueViewerCount({ sessionUniqueViewerCount: 123, sessionUniqueViewers: [] }), 123);
  assert.equal(uniqueViewerCount({ sessionUniqueViewers: ["one", "two"] }), 2);
  assert.equal(uniqueViewerCount({ sessionUniqueViewers: 42 }), 42);
  assert.equal(uniqueViewerCount({ sessionUniqueViewerCount: -1, sessionUniqueViewers: ["one"] }), 1);
  assert.equal(uniqueViewerCount({}, true, 7), 7);
  assert.equal(uniqueViewerCount({ uniqueViewerCount: 456, uniqueViewers: [] }, false), 456);
  assert.equal(uniqueViewerCount({ uniqueViewers: ["one", "two", "three"] }, false), 3);
  const once = getRendererStatistics(largeState().statistics);
  const twice = getRendererStatistics(once);
  assert.equal(twice.sessionUniqueViewerCount, 1000);
  assert.equal(twice.uniqueViewerCount, 1000);
  assert.deepEqual(twice.sessionUniqueViewers, []);
});

test("invités et renderer ne récupèrent jamais les bases des autres comptes ni les viewers privés", () => {
  const state = largeState();
  state.accountWorkspaces = { other: { viewerDatabase: { rows: [{ username: "other_owner" }] } } };
  state.activeAccountUid = "internal-owner";
  const original = JSON.stringify(state);
  const snapshot = { state, packs: [] };
  const guest = createGuestSnapshot(snapshot);
  assert.equal(guest.state.viewerDatabase, undefined);
  assert.equal(guest.state.accountWorkspaces, undefined);
  assert.equal(guest.state.activeAccountUid, undefined);
  assert.equal(JSON.stringify(guest).includes("private_viewer"), false);
  const store = { getAccountSession: () => ({ uid: "owner", email: "owner@example.com", refreshTokenSecretId: "token" }), getSecret: () => "token-value" };
  const owner = snapshotForRenderer(snapshot, store);
  assert.equal(owner.state.viewerDatabase, undefined);
  assert.equal(owner.state.accountWorkspaces, undefined);
  assert.equal(JSON.stringify(state), original);
  assert.equal(shouldSuppressRendererChannel("users-changed", { getAccountSession: () => ({}) }), true);
});
