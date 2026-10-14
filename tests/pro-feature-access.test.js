"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { proFeatureAllowed, assertProFeatureAccess, createProFeatureGuard } = require("../src/main/pro-feature-access");
const { GameHub } = require("../src/main/game-hub");
const { ShellyService } = require("../src/main/shelly-service");
const { WindowsInputService } = require("../src/main/windows-input-service");
const { GameRuntimeService } = require("../src/main/game-runtime");
const { registerSettingsIpc } = require("../src/main/ipc/settings");
const { ClashOfLiveBridge } = require("../src/main/clash-of-live-bridge");
const { installGame } = require("../src/main/game-runtime/installation");
const fs = require("node:fs");

function fixture(subscription = { tier: "pro", source: "own", status: "active" }) {
  const state = { commerce: { subscription, gameEntitlements: ["paid"] }, session: { profileId: "profile-1", activeGamePackId: "included" },
    settings: { account: { uid: "creator", email: "creator@example.test", refreshTokenSecretId: "account" }, siteVisibility: {},
      irl: { enabled: true, devices: [{ id: "shellyplusplugs-fixture", host: "192.168.1.42", generation: 2, model: "Shelly Plus Plug S" }] } },
    game: { connectorOverrides: {} } };
  const store = { getState: () => structuredClone(state), getAccountSession: () => state.settings.account,
    getActiveAccountUid: () => state.settings.account.uid, getSecret: (id) => id === "account" ? "fixture-only-token" : "",
    mutate: (mutator) => mutator(state), set: (key, value) => { assert.equal(key, "settings"); state.settings = value; } };
  const hub = new GameHub({ store, packsDirectory: "fixture-unused" });
  hub.packs = [
    { id: "included", name: "Inclus", requiresPro: false, accessMode: "included", connector: { type: "demo" }, effects: [{ id: "effect" }] },
    { id: "paid", name: "Acheté", accessMode: "paid", connector: { type: "demo" }, effects: [{ id: "effect" }] },
    { id: "owner-only", name: "Interne", ownerOnly: true, accessMode: "included", connector: { type: "demo" }, effects: [{ id: "effect" }] }
  ];
  return { state, store, hub };
}

function jsonResponse(value) { return { ok: true, status: 200, text: async () => JSON.stringify(value) }; }
function shellyResponse(url) {
  if (url.endsWith("/shelly")) return jsonResponse({ id: "shellyplusplugs-fixture", gen: 2, model: "SNPL-00112EU" });
  if (url.endsWith("/rpc/Shelly.GetStatus")) return jsonResponse({ "switch:0": { output: false } });
  return jsonResponse({ was_on: false });
}

test("Free n’accède à aucune section Pro, même administrateur ou propriétaire d’un pack acheté", async () => {
  const f = fixture({ tier: "free", status: "free" });
  f.state.settings.account.email = "alexandre.leuridan@gmail.com"; f.state.settings.account.emailVerified = true;
  for (const section of ["games", "irl", "commands", "matches"]) {
    assert.equal(proFeatureAllowed(f.state, section), false);
    assert.throws(() => assertProFeatureAccess(f.store, section), { code: "PRO_FEATURE_REQUIRED" });
  }
  for (const packId of ["included", "paid"]) {
    assert.throws(() => f.hub.assertAccess(packId), { code: "PRO_FEATURE_REQUIRED" });
    await assert.rejects(f.hub.trigger("effect", {}, { packId }), { code: "PRO_FEATURE_REQUIRED" });
  }
  let requests = 0;
  const service = new ShellyService({ store: f.store, fetchImpl: async () => { requests += 1; throw new Error("interdit"); } });
  assert.throws(() => service.status(), { code: "PRO_FEATURE_REQUIRED" });
  await assert.rejects(service.control({ deviceId: "shellyplusplugs-fixture", operation: "on" }), { code: "PRO_FEATURE_REQUIRED" });
  await assert.rejects(service.scan(), { code: "PRO_FEATURE_REQUIRED" });
  assert.equal(requests, 0);
});

test("Pro, Premium, essai non expiré et accès Pro offert donnent IRL aux comptes non propriétaires", async () => {
  for (const subscription of [
    { tier: "pro", source: "own", status: "active" }, { tier: "premium", source: "own", status: "paid" },
    { tier: "pro", source: "trial", status: "active", expiresAtMs: Date.now() + 60000 },
    { tier: "pro", source: "premiumSeat", status: "active" }
  ]) {
    const f = fixture(subscription);
    f.state.settings.siteVisibility = { schemaVersion: 8, navigation: { irl: "admin" },
      features: { "irl:shelly": "admin" }, actionTypes: { "irl:shelly": "admin" } };
    let controls = 0;
    const service = new ShellyService({ store: f.store, fetchImpl: async (url) => {
      if (url.includes("/rpc/Switch.")) controls += 1;
      return shellyResponse(url);
    } });
    assert.equal(service.status().enabled, true);
    assert.equal((await service.control({ deviceId: "shellyplusplugs-fixture", operation: "on" })).ok, true);
    assert.equal(controls, 1);
    assert.equal(f.hub.assertAccess("included").id, "included");
    assert.throws(() => f.hub.assertAccess("owner-only"), { code: "ADMIN_ACCOUNT_REQUIRED" });
  }
});

test("Pro ne contourne jamais hidden, les restrictions administrateur récentes ou un type désactivé", () => {
  for (const siteVisibility of [
    { schemaVersion: 8, navigation: { irl: "hidden" } }, { schemaVersion: 9, navigation: { irl: "admin" } },
    { schemaVersion: 9, features: { "irl:shelly": "admin" } }, { actionTypes: { "irl:shelly": false } },
    { actionTypeOverrides: { "irl:shelly": false } }
  ]) {
    const f = fixture(); f.state.settings.siteVisibility = siteVisibility;
    assert.throws(() => assertProFeatureAccess(f.store, "irl"), { code: "FEATURE_ACCESS_FORBIDDEN" });
  }
  const f = fixture(); f.state.settings.siteVisibility.games = { included: "hidden" };
  assert.throws(() => f.hub.assertAccess("included"), { code: "FEATURE_ACCESS_FORBIDDEN" });
});

test("un état Pro ne suffit pas pour un invité et les effets différés restent dans leur compte/profil", () => {
  const guest = fixture(); guest.state.settings.account.refreshTokenSecretId = "";
  assert.throws(() => guest.hub.assertAccess("included"), { code: "ACCOUNT_REQUIRED" });
  for (const mutate of [
    (state) => { state.settings.account.uid = "autre"; }, (state) => { state.session.profileId = "autre"; },
    (state) => { state.commerce.subscription = { tier: "pro", source: "trial", status: "active", expiresAtMs: Date.now() - 1 }; }
  ]) {
    const f = fixture(); const guard = createProFeatureGuard(f.store, "irl"); mutate(f.state);
    assert.throws(guard, (error) => ["FEATURE_CONTEXT_CHANGED", "PRO_FEATURE_REQUIRED"].includes(error.code));
  }
});

test("Shelly revalide l’abonnement après découverte, avant tout pilotage", async () => {
  const f = fixture(); let controls = 0;
  const service = new ShellyService({ store: f.store, fetchImpl: async (url) => {
    if (url.endsWith("/rpc/Shelly.GetStatus")) f.state.commerce.subscription = { tier: "free", status: "free" };
    if (url.includes("/rpc/Switch.")) controls += 1;
    return shellyResponse(url);
  } });
  await assert.rejects(service.control({ deviceId: "shellyplusplugs-fixture", operation: "on" }), { code: "PRO_FEATURE_REQUIRED" });
  assert.equal(controls, 0);
});

test("une impulsion IRL déjà armée s’éteint même après expiration, sans nouvelle action", async () => {
  const f = fixture(); const controls = [];
  const service = new ShellyService({ store: f.store, delayImpl: async () => {
    f.state.commerce.subscription = { tier: "free", status: "free" };
  }, fetchImpl: async (url, options) => {
    if (url.includes("/rpc/Switch.")) controls.push(JSON.parse(options.body).on);
    return shellyResponse(url);
  } });
  assert.equal((await service.control({ deviceId: "shellyplusplugs-fixture", operation: "pulse" })).restored, true);
  assert.deepEqual(controls, [true, false]);
  await assert.rejects(service.control({ deviceId: "shellyplusplugs-fixture", operation: "on" }), { code: "PRO_FEATURE_REQUIRED" });
});

test("les effets jeu relisent Pro après connexion socket, sans écrire dans le transport", async () => {
  const f = fixture(); let writes = 0;
  f.hub.packs[0].connector = { type: "tcp", expectResponse: false };
  f.hub.transports.getSocket = async () => {
    f.state.commerce.subscription = { tier: "free", status: "free" };
    return { write() { writes += 1; } };
  };
  await assert.rejects(f.hub.trigger("effect"), { code: "PRO_FEATURE_REQUIRED" });
  assert.equal(writes, 0);
});

test("un lot d’effets HTTP cesse après le premier effet si Pro expire", async () => {
  const f = fixture(); let requests = 0;
  f.hub.clashOfLiveBridge = new ClashOfLiveBridge({ fetchImpl: async () => {
    requests += 1; f.state.commerce.subscription = { tier: "free", status: "free" };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  } });
  f.hub.packs[0].connector = { type: "clash-of-live-http" };
  f.hub.packs[0].effects[0].code = "rouge/squelette";
  await assert.rejects(f.hub.trigger("effect", {}, { quantity: 3 }), { code: "PRO_FEATURE_REQUIRED" });
  assert.equal(requests, 1);
});

test("la file d’entrée Windows annule la tâche suivante si Pro expire pendant l’attente", async () => {
  const f = fixture(); let release, calls = 0;
  const input = new WindowsInputService({ execute: async () => {
    calls += 1;
    if (calls === 1) await new Promise((resolve) => { release = resolve; });
    return { ok: true };
  } });
  const options = { assertAccess: createProFeatureGuard(f.store, "games") };
  const first = input.play("FixtureGame", "k,0,32,2", "wasd", "virtual-key", options);
  await Promise.resolve(); await Promise.resolve();
  const second = input.play("FixtureGame", "k,0,32,2", "wasd", "virtual-key", options);
  const rejected = assert.rejects(second, { code: "PRO_FEATURE_REQUIRED" });
  f.state.commerce.subscription = { tier: "free", status: "free" }; release();
  await first; await rejected; assert.equal(calls, 1);
});

test("le runtime Minecraft revalide Pro entre un délai et l’écriture de console", async (context) => {
  const f = fixture(); const sent = [];
  const runtime = new GameRuntimeService({ store: f.store, app: {}, getWindow() {}, notifyRenderer() {},
    assertAccess: () => assertProFeatureAccess(f.store, "games") });
  runtime.minecraftServers.set("fixture", { process: { exitCode: null, killed: false, stdin: {
    destroyed: false, write: (command, _encoding, done) => { sent.push(command); done(); }
  } } });
  context.mock.method(globalThis, "setTimeout", (callback) => {
    f.state.commerce.subscription = { tier: "free", status: "free" }; queueMicrotask(callback); return {};
  });
  await assert.rejects(runtime.executeMinecraftCommands("fixture", ["say avant", "delay 100", "say après"]), { code: "PRO_FEATURE_REQUIRED" });
  assert.deepEqual(sent, ["say avant\r\n"]);
});

test("settings:save refuse une modification IRL Free et ne laisse jamais falsifier les droits", async () => {
  const f = fixture({ tier: "free", status: "free" }); const handlers = new Map(); let writes = 0;
  const original = f.store.set; f.store.set = (...args) => { writes += 1; original(...args); };
  registerSettingsIpc({ handle: (channel, handler) => handlers.set(channel, handler), store: f.store,
    core: { liveEventActions: { chatbot: { syncTimers() {} } }, synchronizeOverlayCompletionSettings: async () => {},
      overlayServer: { publish() {} }, snapshot: () => ({ state: f.state }), notifyRenderer() {} },
    localServerSettingsSignature: () => "same" });
  await assert.rejects(handlers.get("settings:save")({}, { irl: { enabled: false } }), { code: "PRO_FEATURE_REQUIRED" });
  assert.equal(writes, 0);
  await handlers.get("settings:save")({}, { account: { uid: "fake" }, siteVisibility: { navigation: { irl: "public" } } });
  assert.equal(f.state.settings.account.uid, "creator"); assert.deepEqual(f.state.settings.siteVisibility, {});
});

test("un lancement différé revalide abonnement, compte et profil après la lecture du dossier", async (context) => {
  let release, started;
  context.mock.method(fs.promises, "stat", () => { started(); return new Promise((resolve) => { release = resolve; }); });
  for (const mutate of [
    (state) => { state.commerce.subscription = { tier: "free", status: "free" }; },
    (state) => { state.settings.account.uid = "autre"; }, (state) => { state.session.profileId = "autre"; }
  ]) {
    const f = fixture(); f.state.game.installations = { terraria: { path: "C:\\fixture-aucun-disque" } };
    const ready = new Promise((resolve) => { started = resolve; });
    const runtime = new GameRuntimeService({ store: f.store, app: {}, getWindow() {}, notifyRenderer() {},
      assertAccess: () => assertProFeatureAccess(f.store, "games") });
    const pending = runtime.launch("terraria"); await ready; mutate(f.state); release({ isDirectory: () => true });
    await assert.rejects(pending, (error) => ["PRO_FEATURE_REQUIRED", "FEATURE_CONTEXT_CHANGED"].includes(error.code));
    assert.equal(runtime.gameWindows.size, 0);
  }
});

function installerFixture(f, extra = {}) {
  const runtime = { store: f.store, app: { getPath: () => "C:\\fixture-aucun-disque" },
    activeInstalls: new Set(), installProgress: new Map(), getWindow() {},
    assertAccess: () => assertProFeatureAccess(f.store, "games"),
    createAccessGuard: () => createProFeatureGuard(f.store, "games"),
    progress: (id, progress) => runtime.installProgress.set(id, progress),
    pickTarget: async () => "C:\\fixture-aucun-disque", validateTarget: async () => true, ...extra };
  return runtime;
}

test("une installation locale annulée par changement de profil n’écrit jamais dans le nouveau profil", async () => {
  const f = fixture(); let release, started, writes = 0;
  const ready = new Promise((resolve) => { started = resolve; });
  const runtime = installerFixture(f, { validateTarget: () => {
    started(); return new Promise((resolve) => { release = resolve; });
  } });
  f.store.mutate = () => { writes += 1; };
  const pending = installGame(runtime, "demonologist"); await ready;
  f.state.session.profileId = "autre"; release();
  await assert.rejects(pending, { code: "FEATURE_CONTEXT_CHANGED" });
  assert.equal(writes, 0); assert.equal(runtime.activeInstalls.size, 0);
});

test("un téléchargement terminé après expiration n’installe rien et ne valide aucun droit local", async (context) => {
  const f = fixture(); let assets = 0, writes = 0;
  context.mock.method(fs.promises, "mkdir", async () => {});
  context.mock.method(fs.promises, "rm", async () => {});
  context.mock.method(fs.promises, "readdir", async () => []);
  f.store.mutate = () => { writes += 1; };
  const runtime = installerFixture(f, { dialog: { showMessageBox: async () => ({ response: 0 }) },
    downloadAsset: async () => { f.state.commerce.subscription = { tier: "free", status: "free" }; },
    installAsset: async () => { assets += 1; } });
  await assert.rejects(installGame(runtime, "terraria"), { code: "PRO_FEATURE_REQUIRED" });
  assert.equal(assets, 0); assert.equal(writes, 0); assert.equal(runtime.activeInstalls.size, 0);
});
