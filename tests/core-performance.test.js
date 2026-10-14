"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const { StateStore } = require("../src/main/store");
const { ShenPulseCore } = require("../src/main/core");

function workspace(t) {
  const store = new StateStore(path.join(os.tmpdir(), "shenpulse-core-in-memory"));
  store.touch = () => {}; // Entirely in memory: no load, secrets, connectors or saves.
  store.state.activity = [{ detail: "large-log".repeat(40000) }];
  store.state.profiles[0].workspace = { unused: "other-profile-data".repeat(100000) };
  store.state.game.interactionRulesByPack.inactive = [{ config: { unused: "catalogue".repeat(150000) } }];
  const notifications = [];
  const core = new ShenPulseCore({ store, resourcesDirectory: path.resolve(__dirname, "../resources"),
    notifyRenderer: (channel, payload) => notifications.push({ channel, payload }) });
  store.getState = () => { throw new Error("Complete state cloning is forbidden on a LIVE event"); };
  t.after(() => { clearTimeout(core.deferredChangeTimer); core.overlayCompletionController.stop(); });
  return { store, core, notifications };
}

function event(type, index, data = {}) {
  return { id: `performance-event-${type}-${index}`, timestamp: new Date().toISOString(),
    type, source: "test", user: { id: `viewer-${index}`, displayName: "Viewer" }, data };
}

test("LIVE chat bursts avoid all full state clones and coalesce only visual snapshots", async (t) => {
  const { store, core, notifications } = workspace(t);
  store.state.rules = [];
  for (let index = 0; index < 100; index += 1) await core.ingest(event("chat", index, { message: `hello ${index}` }));
  assert.equal(store.state.statistics.lifetimeEvents, 100);
  assert.equal(notifications.filter((item) => item.channel === "live-event").length, 100);
  await new Promise((resolve) => setTimeout(resolve, 80));
  const runtime = notifications.filter((item) => item.channel === "runtime-state-changed");
  assert.equal(runtime.length, 1);
  assert.equal(runtime[0].payload.state.statistics.lifetimeEvents, 100);
  assert.equal(runtime[0].payload.state.profiles, undefined);
  assert.equal(runtime[0].payload.state.game, undefined);
});

test("gift, like, follow and command paths keep their behavior with only state projections", async (t) => {
  const { store, core, notifications } = workspace(t);
  store.state.rules = [];
  store.state.activeAccountUid = "fixture-owner";
  store.state.settings.account = { uid: "fixture-owner", email: "owner@example.com", refreshTokenSecretId: "fixture-token" };
  store.state.commerce.subscription = { tier: "pro", status: "active" };
  store.secrets["fixture-token"] = { encrypted: false, value: Buffer.from("fixture-only-token").toString("base64") };
  store.state.session.running = true;
  store.state.settings.kick.live = true;
  store.state.settings.kick.refreshTokenSecretId = "fixture-token";
  store.state.connections.push({ id: "test", type: "kick-native", enabled: true, status: "connected" });
  core.sourceHub.runtimes.set("test", { closed: false, send: () => {} });
  store.state.commands = [{ id: "hello", enabled: true, command: "!hello", response: "welcome", cooldownMs: 0,
    execution: { type: "music", operation: "next" } }];
  const messages = [];
  core.sourceHub.send = async (source, payload) => messages.push({ source, payload });
  const effects = [];
  core.spotifyService.control = async (config, options) => {
    assert.equal(options.shouldExecute(), true);
    effects.push(config.operation); return { ok: true };
  };
  await core.ingest(event("chat", 1, { message: "!hello" }));
  await core.ingest(event("like", 2, { count: 25 }));
  await core.ingest(event("follow", 3));
  await core.ingest(event("gift", 4, { giftId: "5655", giftName: "Rose", count: 1, value: 1 }));
  await core.liveEventActions.chatbot.whenIdle();
  assert.equal(store.state.statistics.lifetimeEvents, 4);
  assert.equal(store.state.statistics.likes, 25);
  assert.equal(store.state.statistics.follows, 1);
  assert.deepEqual(effects, ["next"]);
  assert.equal(messages.length, 0);
  assert.equal(store.state.commands[0].response, "welcome", "le texte historique reste conservé sans être envoyé");
  assert.equal(notifications.filter((item) => item.channel === "live-event").length, 4);
});

test("rule execution and TTS playback remain immediate without full state clones", async (t) => {
  const { store, core, notifications } = workspace(t);
  store.state.settings.tts.enabled = true;
  store.state.rules = [{ id: "speak", name: "Speak", enabled: true, chance: 1,
    trigger: { type: "chat" }, actions: [{ id: "voice", type: "tts.speak", config: {} }] }];
  store.state.profiles[0].enabledRuleIds = ["speak"];
  store.state.session.profileId = store.state.profiles[0].id;
  await core.ingest(event("chat", 1, { message: "bonjour" }));
  const playback = notifications.filter((item) => item.channel === "playback");
  assert.equal(playback.length, 1);
  assert.equal(playback[0].payload.type, "tts");
  assert.equal(playback[0].payload.text, "bonjour");
  assert.equal(store.state.statistics.lifetimeActions, 1);
  assert.equal(notifications.filter((item) => item.channel === "runtime-state-changed").length, 0);
});

test("les commandes explicites de test de règle et aperçu d'action gardent leur normalisation", async (t) => {
  const { store, core } = workspace(t);
  // Ces commandes utilisateur produisent volontairement un snapshot complet,
  // contrairement au chemin chaud des événements LIVE.
  store.getState = () => structuredClone(store.state);
  store.state.rules = [{ id: "fixture-rule", enabled: true, trigger: { type: "chat" }, actions: [] }];
  const calls = [];
  core.ruleEngine.test = async (id, event) => { calls.push({ id, event }); };
  core.actionRunner.run = async (action, context) => { calls.push({ action, context }); return { ok: true }; };
  const event = await core.testRule("fixture-rule", { message: "test de règle" });
  assert.equal(event.type, "chat");
  assert.equal(event.source, "rule-test");
  assert.equal(calls[0].id, "fixture-rule");
  assert.equal(calls[0].event.data.message, "test de règle");
  const result = await core.previewAction({ type: "tts.speak", config: {} }, { type: "chat", message: "aperçu" });
  assert.equal(result.ok, true);
  assert.equal(calls[1].context.event.source, "manual-preview");
  assert.equal(calls[1].context.event.data.message, "aperçu");
});

test("full UI snapshots preserve the contract but clone complete state only once", (t) => {
  const { store, core } = workspace(t);
  let calls = 0;
  store.getState = () => { calls += 1; return structuredClone(store.state); };
  const snapshot = core.snapshot();
  assert.equal(calls, 1);
  assert.ok(snapshot.state.profiles.length);
  assert.ok(snapshot.soundCatalog.length);
  assert.ok(snapshot.overlayUrls.api);
  assert.ok(snapshot.localOverlayUrls.base);
});

test("Matchs : un vrai événement du moteur atteint l'interface par le patch runtime, sans attendre un snapshot complet", async (t) => {
  const { store, core, notifications } = workspace(t);
  store.state.activeAccountUid = "fixture-owner";
  store.state.settings.account = { uid: "fixture-owner", email: "owner@example.test", refreshTokenSecretId: "fixture-token" };
  store.secrets["fixture-token"] = { encrypted: false, value: Buffer.from("fixture-only-token").toString("base64") };
  store.state.commerce.subscription = { tier: "pro", status: "active" };
  store.state.settings.tiktok = { username: "fixture-creator", status: "live", roomId: "fixture-room" };
  store.state.session.running = true;
  core.sourceHub.emit("match-event", { source: "source_tiktok", phase: "start", battleId: "fixture-battle", roomId: "fixture-room",
    receivedAtMs: Date.now(), startsAtMs: Date.now(), endsAtMs: Date.now() + 120000,
    participants: [{ id: "fixture-creator-id", username: "fixture-creator", own: true, score: 41 }, { id: "fixture-rival-id", username: "fixture-rival", score: 52 }] });
  await new Promise((resolve) => setTimeout(resolve, 80));
  const updates = notifications.filter((entry) => entry.channel === "runtime-state-changed");
  assert.equal(updates.length, 1);
  assert.equal(updates[0].payload.state.matchSession.status, "running");
  assert.deepEqual(updates[0].payload.state.matchSession.participants.map((row) => row.score), [41, 52]);
  assert.equal(notifications.some((entry) => entry.channel === "state-changed"), false);
  store.state.matchSession.participants[0].score = 999;
  assert.equal(updates[0].payload.state.matchSession.participants[0].score, 41, "le patch envoyé possède sa copie bornée");
  core.matches.reset();
});
