"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { StateStore } = require("../src/main/store");

function createStore(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-store-performance-"));
  const store = new StateStore(directory, { isEncryptionAvailable: () => false });
  store.load();
  store.flush();
  t.after(() => {
    store.flush();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return store;
}

function saved(store) {
  return JSON.parse(fs.readFileSync(store.filePath, "utf8"));
}

test("state projections clone only requested nested paths and stay isolated", (t) => {
  const store = createStore(t);
  store.state.settings.tiktok.currentViewers = 12;
  store.state.game.interactionRulesByPack = { large: [{ id: "private-catalog-rule" }] };
  const projection = store.getStateProjection(["settings.tiktok", "settings.tiktok.currentViewers", "session.profileId"]);
  assert.deepEqual(Object.keys(projection).sort(), ["session", "settings"]);
  assert.deepEqual(Object.keys(projection.settings), ["tiktok"]);
  assert.equal(projection.settings.tiktok.currentViewers, 12);
  assert.equal(projection.game, undefined);
  projection.settings.tiktok.currentViewers = 99;
  assert.equal(store.state.settings.tiktok.currentViewers, 12);
  store.state.settings.tiktok.currentViewers = 20;
  assert.equal(projection.settings.tiktok.currentViewers, 99);
  assert.deepEqual(store.getStateProjection([]), {});
  assert.deepEqual(store.getStateProjection(["missing.path"]), {});
});

test("state projections preserve array shapes and sanitize connection secrets", (t) => {
  const store = createStore(t);
  store.state.connections = [{ id: "source", secretId: "private-secret", secret: "do-not-expose", config: { username: "creator" } }];
  store.secrets["private-secret"] = { value: "synthetic-test-secret" };
  const projection = store.getStateProjection(["connections.0.config.username", "connections.0.secret"]);
  assert.ok(Array.isArray(projection.connections));
  assert.deepEqual(projection.connections[0], { config: { username: "creator" }, hasSecret: true });
  assert.equal(store.state.connections[0].secret, "do-not-expose");
  assert.deepEqual(store.getStateProjection(["connections"]).connections, store.getState().connections);
});

test("state projections reject private workspace and prototype paths", (t) => {
  const store = createStore(t);
  for (const requested of ["accountWorkspaces", "accountWorkspaces.other.rules", "unclaimedAccountWorkspace",
    "activeAccountUid", "accountWorkspaceSchemaVersion", "__proto__.polluted", "settings.constructor", "settings.prototype", "settings..tiktok", ""]) {
    assert.throws(() => store.getStateProjection([requested]), TypeError);
  }
  assert.throws(() => store.getStateProjection("settings"), TypeError);
  assert.throws(() => store.getStateProjection([null]), TypeError);
  assert.equal({}.polluted, undefined);
  assert.equal(store.getState().accountWorkspaces, undefined);
});

test("rule engine projection excludes profile workspaces and inactive game rules", (t) => {
  const store = createStore(t);
  store.state.rules = [{ id: "global", enabled: true, actions: [] }];
  store.state.profiles = [{ id: "profile", enabledRuleIds: ["global"], workspace: { rules: [{ id: "private-profile" }] } }];
  store.state.session.profileId = "profile";
  store.state.session.game = { running: true, packId: "active", profileId: "profile" };
  store.state.game.interactionRulesByPack = { active: [{ id: "active-rule" }], inactive: [{ id: "inactive-rule" }] };
  const projection = store.getRuleEngineState();
  assert.deepEqual(projection.profiles, [{ id: "profile", enabledRuleIds: ["global"] }]);
  assert.deepEqual(projection.game.interactionRulesByPack, { active: [{ id: "active-rule" }] });
  projection.rules[0].id = "changed";
  projection.profiles[0].enabledRuleIds.push("changed");
  projection.game.interactionRulesByPack.active[0].id = "changed";
  assert.equal(store.state.rules[0].id, "global");
  assert.deepEqual(store.state.profiles[0].enabledRuleIds, ["global"]);
  assert.equal(store.state.game.interactionRulesByPack.active[0].id, "active-rule");
  store.state.session.game.profileId = "different-profile";
  assert.deepEqual(store.getRuleEngineState().game.interactionRulesByPack, {});
  store.state.session.game.profileId = "profile";
  store.state.session.game.running = false;
  assert.deepEqual(store.getRuleEngineState().game.interactionRulesByPack, {});
});

test("continuous runtime changes have a fixed five-second checkpoint", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const store = createStore(t);
  const before = fs.readFileSync(store.filePath, "utf8");
  for (let index = 1; index <= 5; index += 1) {
    store.mutateRuntime((state) => { state.statistics.lifetimeEvents = index; });
    t.mock.timers.tick(999);
    assert.equal(fs.readFileSync(store.filePath, "utf8"), before);
  }
  t.mock.timers.tick(5);
  assert.equal(saved(store).statistics.lifetimeEvents, 5);
  assert.equal(store.runtimeWriteTimer, null);
  store.mutateRuntime((state) => { state.statistics.lifetimeEvents = 6; });
  t.mock.timers.tick(5000);
  assert.equal(saved(store).statistics.lifetimeEvents, 6);
});

test("runtime changes do not postpone a configuration save", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const store = createStore(t);
  store.mutateRuntime((state) => { state.statistics.lifetimeEvents = 1; });
  store.set("settings.theme", "light");
  for (let index = 0; index < 4; index += 1) {
    t.mock.timers.tick(50);
    store.mutateRuntime((state) => { state.statistics.lifetimeEvents += 1; });
  }
  assert.equal(saved(store).settings.theme, "light");
  assert.equal(saved(store).statistics.lifetimeEvents, 4);
  assert.ok(store.runtimeWriteTimer);
  store.flush();
  assert.equal(saved(store).statistics.lifetimeEvents, 5);
  assert.equal(store.writeTimer, null);
  assert.equal(store.runtimeWriteTimer, null);
});

test("immediate runtime writes and shutdown flush persist the latest checkpoint", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const store = createStore(t);
  store.mutateRuntime((state) => { state.statistics.lifetimeEvents = 7; }, true);
  assert.equal(saved(store).statistics.lifetimeEvents, 7);
  store.mutateRuntime((state) => { state.statistics.lifetimeEvents = 8; });
  assert.equal(saved(store).statistics.lifetimeEvents, 7);
  store.flush();
  assert.equal(saved(store).statistics.lifetimeEvents, 8);
  assert.equal(store.runtimeWriteTimer, null);
  t.mock.timers.tick(5000);
  assert.equal(saved(store).statistics.lifetimeEvents, 8);
});

test("runtime checkpoint keeps atomic previous-generation backup recoverable", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const store = createStore(t);
  const previous = fs.readFileSync(store.filePath, "utf8");
  store.mutateRuntime((state) => { state.statistics.lifetimeEvents = 23; });
  t.mock.timers.tick(5000);
  assert.equal(fs.readFileSync(`${store.filePath}.bak`, "utf8"), previous);
  fs.writeFileSync(store.filePath, "corrupted-current-generation", "utf8");
  const recovered = new StateStore(store.directory, { isEncryptionAvailable: () => false });
  recovered.load();
  assert.equal(saved(recovered).statistics.lifetimeEvents, 0);
  assert.equal(store.state.statistics.lifetimeEvents, 23);
});

test("runtime stays in memory until checkpoint and account switches retain isolation", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const store = createStore(t);
  store.activateAccount("checkpoint_account_a");
  store.mutateRuntime((state) => { state.statistics.lifetimeEvents = 42; });
  assert.equal(Object.values(store.state.accountWorkspaces)[0].statistics.lifetimeEvents, 0);
  store.activateAccount("checkpoint_account_b");
  assert.equal(store.getStateProjection(["statistics.lifetimeEvents"]).statistics.lifetimeEvents, 0);
  store.mutateRuntime((state) => { state.statistics.lifetimeEvents = 90; });
  store.activateAccount("checkpoint_account_a");
  assert.equal(store.getStateProjection(["statistics.lifetimeEvents"]).statistics.lifetimeEvents, 42);
  const accounts = Object.values(saved(store).accountWorkspaces);
  assert.equal(accounts.find((account) => account.ownerUid === "checkpoint_account_b").statistics.lifetimeEvents, 90);
  assert.equal(store.runtimeWriteTimer, null);
});
