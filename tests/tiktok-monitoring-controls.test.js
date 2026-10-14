"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { StateStore } = require("../src/main/store");
const { ShenPulseCore } = require("../src/main/core");

function registerHandlers(core, store) {
  const handlers = new Map();
  const ipcPath = path.resolve(__dirname, "../src/main/ipc.js");
  const realRequire = createRequire(ipcPath);
  const module = { exports: {} };
  new vm.Script(fs.readFileSync(ipcPath, "utf8"), { filename: ipcPath }).runInNewContext({
    require: (request) => request === "electron" ? {
      ipcMain: { removeHandler: (channel) => handlers.delete(channel), handle: (channel, handler) => handlers.set(channel, handler) }
    } : realRequire(request),
    module, exports: module.exports, __dirname: path.dirname(ipcPath), __filename: ipcPath
  });
  module.exports.registerIpc({ core, store, getWindow: () => null });
  return handlers;
}

function workspace(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-tiktok-controls-"));
  const store = new StateStore(directory);
  store.load();
  store.activateAccount("creator");
  const secretId = store.setSecret("", "refresh-token");
  store.mutate((state) => {
    state.settings.account = { uid: "creator", email: "creator@example.test", refreshTokenSecretId: secretId };
    state.settings.tiktok = { ...state.settings.tiktok, username: "saved.creator", autoConnect: true, status: "offline" };
    state.connections.push({ id: "source_tiktok", name: "TikTok @saved.creator", type: "tiktok-direct", enabled: true, status: "reconnecting", config: { username: "saved.creator" } });
    state.connections.push({ id: "source_kick", name: "Kick LIVE", type: "kick-native", enabled: true, status: "connected", liveStatus: "live" });
    state.settings.kick.live = true;
    state.session.running = true;
    state.session.startedAt = "2026-10-13T09:00:00.000Z";
    state.session.startedBy = "tiktok";
    state.session.tiktokRoomId = "room-a";
    state.session.activeConnectionIds = ["source_tiktok", "source_kick"];
    state.statistics.sessionEvents = 37;
    state.statistics.sessionLikes = 456;
    state.overlaySession.active = true;
    state.overlaySession.timerSeconds = 777;
    state.overlaySession.likeGoalCurrent = 456;
    state.overlaySession.leaderboards.donors = [{ id: "viewer", name: "Lou", score: 123 }];
  }, true);
  const core = new ShenPulseCore({ store, resourcesDirectory: path.resolve(__dirname, "../resources"), notifyRenderer: () => {} });
  core.publicOverlayRelay.publishState = () => {};
  core.overlayServer.publish = () => {};
  core.stopSession = () => { throw new Error("Platform monitoring must never stop the shared session"); };
  const handlers = registerHandlers(core, store);
  context.after(() => {
    clearTimeout(core.deferredChangeTimer);
    store.flush();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { directory, store, core, handlers };
}

function sharedSession(store) {
  const state = store.getState();
  return {
    running: state.session.running,
    startedAt: state.session.startedAt,
    startedBy: state.session.startedBy,
    statistics: state.statistics,
    overlaySession: state.overlaySession,
    kick: state.settings.kick,
    kickConnection: state.connections.find((entry) => entry.id === "source_kick")
  };
}

test("explicit TikTok start reactivates disabled monitoring and persists both flags before source startup", async (context) => {
  const { store, core, handlers } = workspace(context);
  store.mutate((state) => {
    state.settings.tiktok.autoConnect = false;
    state.connections.find((entry) => entry.id === "source_tiktok").enabled = false;
  }, true);
  const before = sharedSession(store);
  const started = [];
  core.sourceHub.start = async (id) => {
    started.push(id);
    assert.equal(store.getState().settings.tiktok.autoConnect, true);
    assert.equal(store.getState().connections.find((entry) => entry.id === id).enabled, true);
    const saved = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
    assert.equal(saved.settings.tiktok.autoConnect, true);
  };
  await handlers.get("tiktok:start")({});
  assert.deepEqual(started, ["source_tiktok"]);
  assert.deepEqual(sharedSession(store), before);
});

test("TikTok stop cancels its pending retry without stopping counters, overlays or the Kick runtime", async (context) => {
  const { store, core, handlers } = workspace(context);
  const before = sharedSession(store);
  let retried = 0;
  let stopped = 0;
  let kickStopped = 0;
  const runtime = {
    reconnectTimer: setTimeout(() => { retried += 1; }, 30),
    stop: async () => {
      stopped += 1;
      assert.equal(store.getState().settings.tiktok.autoConnect, false);
      assert.equal(store.getState().connections.find((entry) => entry.id === "source_tiktok").enabled, false);
    }
  };
  core.sourceHub.runtimes.set("source_tiktok", runtime);
  core.sourceHub.runtimes.set("source_kick", { stop: async () => { kickStopped += 1; } });
  await handlers.get("tiktok:stop")({});
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(stopped, 1);
  assert.equal(retried, 0);
  assert.equal(runtime.closed, true);
  assert.equal(core.sourceHub.runtimes.has("source_tiktok"), false);
  assert.equal(core.sourceHub.runtimes.has("source_kick"), true);
  assert.equal(kickStopped, 0);
  assert.equal(store.getState().settings.tiktok.status, "disconnected");
  assert.deepEqual(sharedSession(store), before);
  assert.deepEqual(store.getState().session.activeConnectionIds, ["source_kick"]);
});

test("stopped TikTok monitoring remains off after a real StateStore reload and explicit start reactivates it", async (context) => {
  const { directory, store, core, handlers } = workspace(context);
  await handlers.get("tiktok:stop")({});
  assert.equal(JSON.parse(fs.readFileSync(store.filePath, "utf8")).statistics.sessionEvents, 37);
  const restarted = new StateStore(directory);
  restarted.load();
  assert.equal(restarted.getState().settings.tiktok.autoConnect, false);
  assert.equal(restarted.getState().connections.find((entry) => entry.id === "source_tiktok").enabled, false);
  assert.equal(restarted.getState().settings.tiktok.username, "saved.creator");
  assert.equal(restarted.getState().statistics.sessionEvents, 0,
    "A full workspace reload intentionally starts a fresh statistics session, independently of monitoring controls");
  const started = [];
  const restartedCore = {
    snapshot: () => ({ state: restarted.getState() }),
    sourceHub: { start: async (id) => started.push(id) }
  };
  await registerHandlers(restartedCore, restarted).get("tiktok:start")({});
  assert.deepEqual(started, ["source_tiktok"]);
  const reloadedAgain = new StateStore(directory);
  reloadedAgain.load();
  assert.equal(reloadedAgain.getState().settings.tiktok.autoConnect, true);
  assert.equal(reloadedAgain.getState().connections.find((entry) => entry.id === "source_tiktok").enabled, true);
  clearTimeout(core.deferredChangeTimer);
  // The fixture store must not overwrite the newly persisted restart state during cleanup.
  store.load();
});

test("stopping TikTok monitoring preserves manual and Kick-owned sessions", async (context) => {
  const { store, handlers } = workspace(context);
  for (const startedBy of ["manual", "kick"]) {
    store.mutate((state) => {
      state.session.startedBy = startedBy;
      state.settings.tiktok.status = "live";
      state.session.activeConnectionIds = ["source_tiktok", "source_kick"];
      state.session.tiktokInterruptedAt = null;
    });
    const before = sharedSession(store);
    await handlers.get("tiktok:stop")({});
    assert.deepEqual(sharedSession(store), before, startedBy);
  }
});

test("saving an explicitly entered TikTok username normalizes and persists it before the separate start command", async (context) => {
  const { store, core, handlers } = workspace(context);
  let refreshes = 0;
  let starts = 0;
  core.refreshGiftCatalog = async ({ force }) => { assert.equal(force, true); refreshes += 1; };
  core.sourceHub.start = async () => { starts += 1; };
  await handlers.get("tiktok:save")({}, { username: "  @@New.Creator_42 !  " });
  const state = store.getState();
  assert.equal(state.settings.tiktok.username, "New.Creator_42");
  assert.equal(state.connections.find((entry) => entry.id === "source_tiktok").config.username, "New.Creator_42");
  assert.equal(refreshes, 1);
  assert.equal(starts, 0);
  await handlers.get("tiktok:start")({});
  assert.equal(starts, 1);
});

test("TikTok start creates a missing native source and rejects a missing username without reactivating monitoring", async (context) => {
  const { store, core, handlers } = workspace(context);
  store.mutate((state) => {
    state.connections = state.connections.filter((entry) => entry.id !== "source_tiktok");
    state.settings.tiktok.autoConnect = false;
    state.settings.tiktok.username = "";
  });
  let started = 0;
  core.sourceHub.start = async (id) => {
    started += 1;
    const source = store.getState().connections.find((entry) => entry.id === id);
    assert.equal(source.type, "tiktok-direct");
    assert.equal(source.enabled, true);
    assert.equal(source.config.username, "saved.creator");
  };
  await assert.rejects(() => handlers.get("tiktok:start")({}), /Renseignez/);
  assert.equal(store.getState().settings.tiktok.autoConnect, false);
  assert.equal(started, 0);
  store.mutate((state) => { state.settings.tiktok.username = "saved.creator"; });
  await handlers.get("tiktok:start")({});
  assert.equal(started, 1);
  assert.equal(store.getState().settings.tiktok.autoConnect, true);
});

test("saving a new TikTok username without an existing source discards persisted host and audience metadata", async (context) => {
  const { store, core, handlers } = workspace(context);
  store.mutate((state) => {
    state.connections = state.connections.filter((entry) => entry.id !== "source_tiktok");
    state.settings.tiktok.broadcaster = { username: "old.creator", avatarUrl: "https://cdn.example/old.webp" };
    state.settings.tiktok.currentViewers = 42;
  });
  core.refreshGiftCatalog = async () => {};
  await handlers.get("tiktok:save")({}, { username: "next.creator" });
  assert.equal(store.getState().settings.tiktok.username, "next.creator");
  assert.equal(store.getState().settings.tiktok.broadcaster, null);
  assert.equal(store.getState().settings.tiktok.currentViewers, null);
});

test("TikTok monitoring controls reject unauthenticated callers before changing persisted flags", async (context) => {
  const { store, handlers } = workspace(context);
  store.mutate((state) => { state.settings.account = {}; });
  const before = store.getState();
  for (const channel of ["tiktok:start", "tiktok:stop"]) {
    assert.throws(() => handlers.get(channel)({}), { code: "ACCOUNT_REQUIRED" });
  }
  assert.deepEqual(store.getState(), before);
});
