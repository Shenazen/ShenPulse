"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { registerSettingsIpc } = require("../src/main/ipc/settings");
const { createStore } = require("./helpers/account-service-fixtures");

function fixture({ owner = false, pro = false, guest = false } = {}) {
  const store = createStore();
  store.state.settings.account = guest ? {} : {
    uid: "fixture-user", email: owner ? "alexandre.leuridan@gmail.com" : "ordinary@example.com",
    emailVerified: true, refreshTokenSecretId: "account-session"
  };
  store.setSecret("account-session", "fixture-refresh");
  store.state.commerce.subscription = { tier: pro ? "pro" : "free", status: pro ? "active" : "free", source: "own" };
  const handlers = new Map(), effects = [];
  let writes = 0, secrets = 0;
  const set = store.set.bind(store), setSecret = store.setSecret.bind(store);
  store.set = (...args) => { writes += 1; return set(...args); };
  store.setSecret = (...args) => { secrets += 1; return setSecret(...args); };
  registerSettingsIpc({
    handle: (key, handler) => handlers.set(key, handler), store,
    localServerSettingsSignature: (settings) => JSON.stringify([settings.apiPort, settings.overlayPort, settings.startOverlayServer]),
    core: {
      snapshot: () => ({ state: structuredClone(store.state) }),
      synchronizeOverlayCompletionSettings: async () => effects.push("completion"),
      restartServers: async () => effects.push("restart"),
      overlayServer: { publish: () => effects.push("publish") },
      notifyRenderer: () => effects.push("notify")
    }
  });
  return { store, save: (incoming) => handlers.get("settings:save")({}, incoming), effects,
    counts: () => ({ writes, secrets }) };
}

test("Free et Pro conservent les préférences et réglages des pages fonctionnelles", async () => {
  for (const pro of [false, true]) {
    const f = fixture({ pro });
    await f.save({ locale: "en-US", theme: "light", tts: { rate: 1.2 },
      overlayConfigs: { likeGoal: { target: 1000 } }, overlayScene: f.store.state.settings.overlayScene });
    assert.equal(f.store.state.settings.locale, "en-US");
    assert.equal(f.store.state.settings.theme, "light");
    assert.equal(f.store.state.settings.tts.rate, 1.2);
    assert.equal(f.store.state.settings.overlayConfigs.likeGoal.target, 1000);
    assert.deepEqual(f.counts(), { writes: 1, secrets: 0 });
    assert.equal(f.effects.includes("restart"), false);
  }
});

test("les paramètres d'infrastructure sont refusés avant tout write, secret ou effet", async () => {
  for (const pro of [false, true]) for (const change of [
    { apiPort: 25000 }, { overlayPort: 25001 }, { startOverlayServer: false },
    { allowKeystrokes: true }, { telemetry: true }, { historyLimit: 42 },
    { minimizeToTray: false }, { launchAtStartup: true }, { apiToken: "replacement" },
    { obs: { url: "ws://127.0.0.1:50000" } }, { obsPassword: "replacement" },
    { spotifyToken: "replacement" }, { backblazeKeyId: "replacement" },
    { backblazeApplicationKey: "replacement" }, { backblaze: { bucket: "other-bucket" } },
    { unsupportedInfrastructure: "replacement" }
  ]) {
    const f = fixture({ pro }), before = structuredClone(f.store.state);
    await assert.rejects(f.save({ tts: { rate: 1.5 }, ...change }), { code: "ADMIN_ACCOUNT_REQUIRED" });
    assert.deepEqual(f.counts(), { writes: 0, secrets: 0 });
    assert.deepEqual(f.effects, []);
    assert.deepEqual(f.store.state, before);
  }
});

test("un snapshot complet historique peut sauver un overlay sans réécrire les services ou les identités", async () => {
  const f = fixture();
  f.store.state.settings.tiktok.chat = { provider: "configured", apiKeySecretId: "never-rendered" };
  const incoming = structuredClone(f.store.state.settings);
  incoming.tiktok.chat = { provider: "configured" };
  incoming.spotify.expiresAt = 1;
  incoming.publicOverlayRelay.channelId = "stale-channel";
  incoming.account.uid = "forged";
  incoming.controllers.devices = [{ id: "forged-device" }];
  incoming.overlayConfigs.likeGoal = { target: 777 };
  await f.save(incoming);
  assert.equal(f.store.state.settings.overlayConfigs.likeGoal.target, 777);
  assert.equal(f.store.state.settings.tiktok.chat.apiKeySecretId, "never-rendered");
  assert.notEqual(f.store.state.settings.spotify.expiresAt, 1);
  assert.notEqual(f.store.state.settings.publicOverlayRelay.channelId, "stale-channel");
  assert.equal(f.store.state.settings.account.uid, "fixture-user");
  assert.deepEqual(f.store.state.settings.controllers.devices, []);
  assert.deepEqual(f.counts(), { writes: 1, secrets: 0 });
});

test("le propriétaire vérifié peut toujours enregistrer ses paramètres privés", async () => {
  const f = fixture({ owner: true });
  await f.save({ apiPort: 25000, obsPassword: "fixture-obs-password", tts: { rate: 1.3 } });
  assert.equal(f.store.state.settings.apiPort, 25000);
  assert.equal(f.store.state.settings.tts.rate, 1.3);
  assert.equal(f.store.getSecret(f.store.state.settings.obs.passwordSecretId), "fixture-obs-password");
  assert.deepEqual(f.counts(), { writes: 1, secrets: 1 });
  assert.equal(f.effects.includes("restart"), true);
});

test("un invité ne sauvegarde rien et IRL conserve son contrôle Pro indépendant", async () => {
  const guest = fixture({ guest: true });
  await assert.rejects(guest.save({ locale: "en-US" }), { code: "ACCOUNT_REQUIRED" });
  assert.deepEqual(guest.counts(), { writes: 0, secrets: 0 });
  for (const pro of [false, true]) {
    const f = fixture({ pro });
    if (pro) {
      await f.save({ irl: { ...f.store.state.settings.irl, enabled: true } });
      assert.equal(f.store.state.settings.irl.enabled, true);
    } else {
      await assert.rejects(f.save({ irl: { enabled: true } }), { code: "PRO_FEATURE_REQUIRED" });
      assert.deepEqual(f.counts(), { writes: 0, secrets: 0 });
      assert.deepEqual(f.effects, []);
    }
  }
});
