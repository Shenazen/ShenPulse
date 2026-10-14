"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const { createDefaultState } = require("../src/main/defaults");
const { ShenPulseCore, synchronizeSessionWithKick, synchronizeSessionWithTikTok } = require("../src/main/core");

function workspace() {
  const state = createDefaultState();
  state.settings.account = { uid: "creator", email: "creator@example.com", refreshTokenSecretId: "account-token" };
  state.commerce.subscription = { tier: "pro", status: "active" };
  state.settings.kick.live = false;
  state.connections.push({ id: "source_kick", name: "Kick LIVE", type: "kick-native", enabled: true, status: "connected" });
  return state;
}

function coreWorkspace(context) {
  const state = workspace();
  const notifications = [];
  const published = [];
  const timers = [];
  const store = {
    getState: () => state,
    getSecret: (key) => key === "account-token" ? "refresh-token" : "",
    mutate: (mutator) => mutator(state),
    mutateRuntime: (mutator) => mutator(state),
    addActivity: (entry) => state.activity.unshift({ ...entry, timestamp: new Date().toISOString() })
  };
  const core = new ShenPulseCore({ store, resourcesDirectory: path.join(__dirname, "..", "resources"), notifyRenderer: (channel, payload) => notifications.push({ channel, payload }) });
  core.publicOverlayRelay.publishState = () => {};
  core.overlayServer.publish = (channel, payload) => published.push({ channel, payload });
  core.overlayCompletionController.stop = () => {};
  core.overlayCompletionController.startConfiguredTimer = async (reason) => timers.push(reason);
  context.after(() => clearTimeout(core.deferredChangeTimer));
  return { state, core, notifications, published, timers };
}

test("Kick starts a real session, resets canonical counters once, and publishes the timer and snapshot", (context) => {
  const { state, core, notifications, published, timers } = coreWorkspace(context);
  state.statistics.sessionEvents = 14;
  state.overlaySession.likeGoalCurrent = 999;
  core.sourceHub.emit("kick-status", { connectionId: "source_kick", live: true, viewers: 35 });
  assert.equal(state.session.running, true);
  assert.equal(state.session.startedBy, "kick");
  assert.deepEqual(state.session.activeConnectionIds, ["source_kick"]);
  assert.equal(state.statistics.sessionEvents, 0);
  assert.equal(state.overlaySession.likeGoalCurrent, 0);
  assert.equal(state.overlaySession.active, true);
  assert.equal(state.settings.kick.viewers, 35);
  assert.deepEqual(timers, ["kick-session-start"]);
  assert.equal(published.at(-1).channel, "session-state");
  assert.equal(notifications.at(-1).channel, "state-changed");
  state.statistics.sessionEvents = 3;
  state.overlaySession.timerSeconds = 900;
  core.sourceHub.emit("kick-status", { connectionId: "source_kick", live: true });
  assert.equal(state.statistics.sessionEvents, 3);
  assert.equal(state.overlaySession.timerSeconds, 900);
  assert.equal(timers.length, 1);
});

test("Kick auto-start requires an authenticated account and an enabled native source", (context) => {
  const { state, core, timers } = coreWorkspace(context);
  state.settings.account = {};
  core.sourceHub.emit("kick-status", { connectionId: "source_kick", live: true });
  assert.equal(state.session.running, false);
  state.settings.account = { uid: "creator", email: "creator@example.com", refreshTokenSecretId: "account-token" };
  state.connections.find((entry) => entry.id === "source_kick").enabled = false;
  core.sourceHub.emit("kick-status", { connectionId: "source_kick", live: true });
  assert.equal(state.session.running, false);
  assert.equal(state.settings.kick.live, false);
  assert.equal(timers.length, 0);
});

test("ending a Kick-only stream closes canonical overlays while keeping the final statistics", (context) => {
  const { state, core, published } = coreWorkspace(context);
  core.sourceHub.emit("kick-status", { connectionId: "source_kick", live: true });
  state.statistics.sessionEvents = 17;
  state.overlaySession.likeGoalCurrent = 456;
  core.sourceHub.emit("kick-status", { connectionId: "source_kick", live: false });
  assert.equal(state.session.running, false);
  assert.deepEqual(state.session.activeConnectionIds, []);
  assert.equal(state.overlaySession.active, false);
  assert.ok(state.overlaySession.endedAt);
  assert.equal(state.statistics.sessionEvents, 17);
  assert.equal(state.overlaySession.likeGoalCurrent, 456);
  assert.equal(published.at(-1).channel, "session-state");
});

test("stopping the native source clears Kick LIVE and ends only its own session", async (context) => {
  const { state, core, published } = coreWorkspace(context);
  let stopped = 0;
  core.sourceHub.emit("kick-status", { connectionId: "source_kick", live: true });
  core.sourceHub.runtimes.set("source_kick", { stop: async () => { stopped += 1; } });
  state.statistics.sessionEvents = 9;
  await core.sourceHub.stop("source_kick");
  assert.equal(stopped, 1);
  assert.equal(state.settings.kick.live, false);
  assert.equal(state.connections.find((entry) => entry.id === "source_kick").liveStatus, "disconnected");
  assert.equal(state.session.running, false);
  assert.equal(state.statistics.sessionEvents, 9);
  const endedPublications = published.filter((entry) => entry.channel === "session-state").length;
  await core.sourceHub.stop("source_kick");
  assert.equal(published.filter((entry) => entry.channel === "session-state").length, endedPublications);

  state.session.running = true;
  state.session.startedBy = "manual";
  state.session.activeConnectionIds = ["source_kick"];
  state.settings.kick.live = true;
  await core.sourceHub.stop("source_kick");
  assert.equal(state.session.running, true);
  assert.equal(state.settings.kick.live, false);
});

test("TikTok offline cannot interrupt or reset a Kick-only session", () => {
  const state = workspace();
  state.settings.kick.live = true;
  synchronizeSessionWithKick(state, { live: true });
  state.statistics.sessionEvents = 20;
  assert.equal(synchronizeSessionWithTikTok(state, "offline"), "");
  assert.equal(state.session.running, true);
  assert.equal(state.session.tiktokInterruptedAt, null);
  assert.deepEqual(state.session.activeConnectionIds, ["source_kick"]);
  assert.equal(state.statistics.sessionEvents, 20);
});

test("mixed streams keep counters when TikTok changes rooms and either source goes offline", () => {
  const state = workspace();
  state.settings.kick.live = true;
  synchronizeSessionWithKick(state, { live: true });
  state.statistics.sessionEvents = 20;
  state.overlaySession.timerSeconds = 900;
  synchronizeSessionWithTikTok(state, "live", { roomId: "tiktok-a" });
  assert.deepEqual(state.session.activeConnectionIds, ["source_kick", "source_tiktok"]);
  assert.equal(state.statistics.sessionEvents, 20);
  synchronizeSessionWithTikTok(state, "offline", { roomId: "tiktok-a" });
  assert.equal(state.session.running, true);
  assert.deepEqual(state.session.activeConnectionIds, ["source_kick"]);
  synchronizeSessionWithTikTok(state, "live", { roomId: "tiktok-b" });
  assert.equal(state.session.tiktokRoomId, "tiktok-b");
  assert.equal(state.statistics.sessionEvents, 20);
  assert.equal(state.overlaySession.timerSeconds, 900);
  synchronizeSessionWithKick(state, { live: false });
  assert.equal(state.session.running, true);
  assert.deepEqual(state.session.activeConnectionIds, ["source_tiktok"]);
  synchronizeSessionWithTikTok(state, "offline", { roomId: "tiktok-b" });
  synchronizeSessionWithKick(state, { live: false });
  assert.equal(state.session.running, true, "TikTok reconnect preserves its historical session");
  assert.equal(state.overlaySession.timerSeconds, 900);
});

test("Kick offline never stops a manual session or a TikTok session", () => {
  for (const startedBy of ["manual", "tiktok"]) {
    const state = workspace();
    state.session.running = true;
    state.session.startedBy = startedBy;
    state.session.activeConnectionIds = ["source_kick"];
    state.statistics.sessionEvents = 20;
    assert.equal(synchronizeSessionWithKick(state, { live: false }), "");
    assert.equal(state.session.running, true);
    assert.equal(state.statistics.sessionEvents, 20);
  }
});

test("manual start accepts Kick LIVE with an old offline TikTok account", async (context) => {
  const { state, core, timers } = coreWorkspace(context);
  state.settings.kick.live = true;
  state.settings.tiktok = { ...state.settings.tiktok, username: "old-account", status: "offline" };
  core.sourceHub.startEnabled = async () => [];
  const result = await core.startSession();
  assert.equal(result.waitingForTikTokLive, undefined);
  assert.equal(state.session.running, true);
  assert.equal(state.session.startedBy, "manual");
  assert.deepEqual(state.session.activeConnectionIds, ["source_kick"]);
  assert.deepEqual(timers, ["session-start"]);
});

test("Kick detected while awaiting source startup is not overwritten by the TikTok waiting branch", async (context) => {
  const { state, core, timers } = coreWorkspace(context);
  state.settings.tiktok = { ...state.settings.tiktok, username: "old-account", status: "offline" };
  core.sourceHub.startEnabled = async () => { core.sourceHub.emit("kick-status", { connectionId: "source_kick", live: true }); return []; };
  const result = await core.startSession();
  assert.equal(result.waitingForTikTokLive, false);
  assert.equal(state.session.running, true);
  assert.deepEqual(timers, ["kick-session-start"]);
});

test("Kick functional command rejection is handled off the LIVE path and logged locally without any response", async (context) => {
  const { state, core, published } = coreWorkspace(context);
  state.session.running = true;
  state.settings.kick.live = true;
  state.commands = [{ id: "hello", command: "!hello", response: "Bonjour", enabled: true,
    execution: { type: "music", operation: "next" } }];
  core.sourceHub.runtimes.set("source_kick", { send: () => {} });
  let sent = 0;
  core.sourceHub.send = async () => { sent += 1; throw new Error("Aucun envoi ne doit avoir lieu"); };
  core.spotifyService.control = async () => { throw new Error("Private Spotify provider details"); };
  core.overlayServer.publishEvent = () => {};
  core.overlayCompletionController.handleLikeGoalChange = async () => {};
  core.ruleEngine.process = async () => {};
  await core.ingest({ event: "chat", data: { user: { id: "viewer", username: "Lou" }, message: "!hello" } }, "source_kick");
  await core.liveEventActions.chatbot.whenIdle();
  assert.equal(published.some((entry) => entry.channel === "chatbot"), false);
  assert.equal(sent, 0);
  const activity = state.activity.find((entry) => entry.category === "chatbot");
  assert.equal(activity.sent, false);
  assert.equal(activity.executed, false);
  assert.equal(activity.title, "Commande non exécutée");
  assert.equal(activity.executionReason, "COMMAND_EXECUTION_FAILED");
  assert.equal(activity.detail.includes("Private Spotify"), false);
  assert.equal(state.commands[0].response, "Bonjour");
});

test("creator integrations reopen saved controller tokens and the enabled Kick account after restart", async (context) => {
  const { state, core } = coreWorkspace(context);
  const calls = [];
  state.settings.controllers.devices = [{ id: "saved-controller" }];
  core.controllerService.start = async () => calls.push("controllers");
  core.sourceHub.start = async (id) => calls.push(id);
  await core.startCreatorIntegrations();
  assert.deepEqual(calls, ["controllers", "source_kick"]);
});
