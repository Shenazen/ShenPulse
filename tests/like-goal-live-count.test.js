"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const { createDefaultState } = require("../src/main/defaults");
const { StateStore } = require("../src/main/store");
const { ShenPulseCore } = require("../src/main/core");
const { liveLikeCount } = require("../src/shared/live-statistics");
const { recordEventStatistics } = require("../src/main/core/event-statistics");
const { synchronizeSessionWithTikTok, clearSessionState } = require("../src/main/core/session-state");
const { recordOverlayEvent, applyOverlayOperation, synchronizeLikeGoalWithLive } = require("../src/main/overlay-session-state");
const { migrateState } = require("../src/main/state/migrations");
const { createAccountWorkspaceFromState, applyAccountWorkspace } = require("../src/main/state/account-workspace");
const { createRelayState } = require("../src/shared/public-overlay-protocol");

function liveState() {
  const state = createDefaultState();
  state.settings.tiktok.status = "live";
  synchronizeSessionWithTikTok(state, "live", { roomId: "room-like-goal" }, "2026-10-13T10:00:00Z");
  return state;
}

function like(index, count, totalLikes, source = "source_tiktok") {
  return { id: `like-goal-fixture-${index}`, type: "like", source,
    timestamp: "2026-10-13T10:01:00Z", user: { id: "viewer-fixture", name: "viewer-fixture" },
    data: { count, ...(totalLikes === undefined ? {} : { totalLikes }) } };
}

function record(state, event) {
  recordEventStatistics(state, event);
  recordOverlayEvent(state, event);
}

function pipeline(t) {
  const store = new StateStore(path.join(os.tmpdir(), "shenpulse-like-goal-pipeline-in-memory"));
  store.touch = () => {}; // Aucun load/save, connecteur ou réseau réel.
  store.state = liveState();
  store.state.rules = [];
  const notifications = [], published = [], channels = [], ruleEvents = [], completions = [];
  const core = new ShenPulseCore({ store, resourcesDirectory: path.resolve(__dirname, "../resources"),
    notifyRenderer: (channel, event) => notifications.push({ channel, event }) });
  core.overlayServer.publishEvent = (event) => published.push(event);
  core.overlayServer.publish = (channel, payload) => channels.push({ channel, payload });
  core.ruleEngine.process = async (event) => ruleEvents.push(event);
  core.overlayCompletionController.handleLikeGoalChange = async (...args) => completions.push(args);
  store.getState = () => { throw new Error("Le chemin chaud ne doit pas cloner l'état complet"); };
  t.after(() => { clearTimeout(core.deferredChangeTimer); core.overlayCompletionController.stop(); });
  return { store, core, notifications, published, channels, ruleEvents, completions };
}

test("dashboard et Like Goal utilisent le même total, y compris zéro et les anciens bilans", () => {
  assert.equal(liveLikeCount({ likes: 30, platformLikes: 18300 }), 18300);
  assert.equal(liveLikeCount({ likes: 30, platformLikes: 0 }), 0);
  for (const platformLikes of [null, undefined, "", Infinity, NaN, -1]) {
    assert.equal(liveLikeCount({ likes: 30, platformLikes }), 30);
  }
  assert.equal(liveLikeCount(), 0);
  assert.equal(liveLikeCount({ likes: Infinity }), 0);
});

test("rejoindre un LIVE déjà démarré initialise le Like Goal au total TikTok, pas au seul lot reçu", () => {
  const state = liveState();
  record(state, like(1, 30, 18300));
  assert.equal(state.statistics.liveSession.likes, 30, "les likes attribuables aux événements restent distincts");
  assert.equal(state.overlaySession.likeGoalCurrent, 18300);
  assert.equal(state.overlaySession.likeGoalCurrent, liveLikeCount(state.statistics.liveSession));
  assert.equal(state.overlaySession.leaderboards.tappers[0].score, 30, "ne pas attribuer le total de la salle à un spectateur");
});

test("totaux absolus répétés ou retardés ne sont jamais réadditionnés au Like Goal", () => {
  const state = liveState();
  for (const event of [like(1, 30, 18300), like(2, 45, 18345), like(3, 10, 18345), like(4, 5, 18000)]) {
    record(state, event);
    assert.equal(state.overlaySession.likeGoalCurrent, liveLikeCount(state.statistics.liveSession));
  }
  assert.equal(state.overlaySession.likeGoalCurrent, 18345);
  assert.equal(createRelayState(state).overlaySession.likeGoalCurrent, 18345, "le relais public transporte le même état");
});

test("sans total plateforme le fallback reste le cumul réel du LIVE, pas les statistiques historiques", () => {
  const state = liveState();
  state.statistics.likes = 999999;
  record(state, like(1, 12));
  record(state, like(2, 13));
  assert.equal(state.overlaySession.likeGoalCurrent, 25);
  assert.equal(state.statistics.liveSession.likes, 25);
});

test("les simulations et opérations manuelles restent possibles sans falsifier le dashboard", () => {
  const state = liveState();
  record(state, like(1, 30, 18300));
  applyOverlayOperation(state, "like-goal", { operation: "reset" });
  assert.equal(state.overlaySession.likeGoalCurrent, 0);
  assert.equal(state.overlaySession.likeGoalManual, true);
  synchronizeLikeGoalWithLive(state);
  assert.equal(state.overlaySession.likeGoalCurrent, 0, "une lecture ne doit pas effacer l'opération explicite");
  record(state, like(2, 100, undefined, "simulator"));
  assert.equal(state.overlaySession.likeGoalCurrent, 100);
  assert.equal(liveLikeCount(state.statistics.liveSession), 18300);
  record(state, like(3, 5, 18305));
  assert.equal(state.overlaySession.likeGoalCurrent, 18305, "le tapotage réel suivant recale la source LIVE");
  assert.equal(state.overlaySession.likeGoalManual, false);
});

test("arrêt, reprise de la même salle et nouvelle salle conservent ou réinitialisent le même compteur", () => {
  const state = liveState();
  record(state, like(1, 30, 18300));
  clearSessionState(state);
  record(state, like(2, 500, 19000));
  assert.equal(state.overlaySession.likeGoalCurrent, 18300, "le bilan terminé ne reçoit plus les événements hors LIVE");
  synchronizeSessionWithTikTok(state, "live", { roomId: "room-like-goal" });
  assert.equal(state.overlaySession.likeGoalCurrent, 18300, "reprise après redémarrage runtime avant le prochain lot");
  synchronizeSessionWithTikTok(state, "live", { roomId: "new-room-like-goal" });
  assert.equal(state.overlaySession.likeGoalCurrent, 0);
  assert.equal(liveLikeCount(state.statistics.liveSession), 0);
});

test("la migration et le chargement du compte corrigent les anciens compteurs sans toucher les objectifs", () => {
  const state = liveState();
  record(state, like(1, 30, 18300));
  state.overlaySession.likeGoalCurrent = 30;
  state.settings.overlayConfigs.likeGoal.target = 50000;
  const workspace = createAccountWorkspaceFromState(state);
  const destination = createDefaultState();
  applyAccountWorkspace(destination, workspace);
  assert.equal(destination.overlaySession.likeGoalCurrent, 18300);
  assert.equal(destination.settings.overlayConfigs.likeGoal.target, 50000);
  const store = new StateStore(path.join(os.tmpdir(), "shenpulse-like-goal-migration-in-memory"));
  store.touch = () => {};
  state.accountWorkspaceSchemaVersion = 0;
  state.settings.account.uid = "like-goal-fixture-owner";
  state.settings.account.refreshTokenSecretId = "like-goal-fixture-token";
  store.secrets["like-goal-fixture-token"] = { encrypted: false, value: Buffer.from("fixture-only-token").toString("base64") };
  store.state = state;
  migrateState(store);
  assert.equal(store.state.overlaySession.likeGoalCurrent, 18300);
  assert.equal(store.state.settings.overlayConfigs.likeGoal.target, 50000);
});

test("le chargement de compte conserve une valeur manuelle explicite et l'isole des autres comptes", () => {
  const state = liveState();
  record(state, like(1, 30, 18300));
  applyOverlayOperation(state, "like-goal", { operation: "set", amount: 123 });
  const destination = createDefaultState();
  applyAccountWorkspace(destination, createAccountWorkspaceFromState(state));
  assert.equal(destination.overlaySession.likeGoalCurrent, 123);
  assert.equal(destination.overlaySession.likeGoalManual, true);
  const empty = createDefaultState();
  applyAccountWorkspace(destination, createAccountWorkspaceFromState(empty));
  assert.equal(destination.overlaySession.likeGoalCurrent, 0);
  assert.equal(destination.overlaySession.likeGoalManual, false);
});

test("le pipeline publie le total absolu aux overlays/aperçus sans changer les lots transmis aux règles", async (t) => {
  const { core, notifications, published, ruleEvents, completions } = pipeline(t);
  const first = like(1, 30, 18300), second = like(2, 45, 18345);
  await core.ingest(first);
  await core.ingest(second);
  assert.deepEqual(published.map((event) => event.data.likeGoalCurrent), [18300, 18345]);
  assert.deepEqual(notifications.filter((entry) => entry.channel === "live-event").map(({ event }) => event.data.likeGoalCurrent), [18300, 18345]);
  assert.deepEqual(ruleEvents.map((event) => event.data.count), [30, 45]);
  assert.equal(first.data.likeGoalCurrent, undefined, "l'événement d'origine reste intact");
  assert.deepEqual(completions.map((args) => args.slice(0, 2)), [[0, 18300], [18300, 18345]]);
});

test("un spectateur bloqué synchronise uniquement le total anonyme OBS, sans événement ou action", async (t) => {
  const { store, core, notifications, published, channels, ruleEvents, completions } = pipeline(t);
  core.viewerService.isBlocked = () => true;
  core.liveEventActions.handleCommand = async () => { throw new Error("Aucune commande bloquée ne doit s'exécuter"); };
  const result = await core.ingest(like(1, 30, 18300));
  assert.equal(result.moderationBlocked, true);
  assert.equal(store.state.overlaySession.likeGoalCurrent, liveLikeCount(store.state.statistics.liveSession));
  assert.deepEqual(channels, [{ channel: "like-goal", payload: { operation: "set", current: 18300 } }]);
  assert.deepEqual(published, []);
  assert.equal(notifications.some((entry) => entry.channel === "live-event"), false);
  assert.deepEqual(ruleEvents, []);
  assert.deepEqual(completions, []);
  assert.equal(JSON.stringify(channels).includes("viewer-fixture"), false);
  await new Promise((resolve) => setTimeout(resolve, 80));
  const snapshot = notifications.find((entry) => entry.channel === "runtime-state-changed");
  assert.equal(snapshot.event.state.overlaySession.likeGoalCurrent, 18300);
  assert.equal(liveLikeCount(snapshot.event.state.statistics.liveSession), 18300);
  await core.ingest(like(2, 50, undefined, "simulator"));
  assert.equal(channels.length, 1, "aucun total anonyme LIVE pour une simulation bloquée");
});
