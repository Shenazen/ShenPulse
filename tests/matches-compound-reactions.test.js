"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { MatchesService } = require("../src/main/matches/service");
const { ActionRunner } = require("../src/main/action-runner");
const { selectStatePaths } = require("../src/main/state-projection");
const { normalizeReaction, normalizeMatchesConfig, normalizeMatchAutomation, createMatchSession } = require("../src/shared/matches-contract");

/** Doubles mémoire : aucun LIVE, média, appareil ou compte réel n'est utilisé. */
function fixture() {
  let now = 1790000000000;
  const state = { settings: { account: { uid: "fixture", email: "fixture@example.test", refreshTokenSecretId: "fixture" }, siteVisibility: {},
    tiktok: { username: "creator", status: "live", roomId: "fixture-room" }, matches: normalizeMatchesConfig(), overlayConfigs: {} },
    session: { running: true, profileId: "fixture-profile", startedAt: "fixture" }, commerce: { subscription: { tier: "pro", status: "active" } },
    matchSession: createMatchSession(), rules: [], profiles: [{ id: "fixture-profile", enabledRuleIds: [] }] };
  const calls = [], activities = [], timers = new Map();
  const store = { getStateProjection: (paths) => selectStatePaths(state, paths), getAccountSession: () => state.settings.account,
    getSecret: () => "fixture-secret", mutate: (callback) => callback(state), mutateRuntime: (callback) => callback(state) };
  const actionRunner = new ActionRunner({ store, overlayServer: {
    publish: (channel, payload) => calls.push({ channel, payload }),
    playMatch: (payload) => { calls.push({ channel: "match", payload }); return { queued: true }; }
  }, notifyRenderer: (channel, payload) => calls.push({ channel, payload }) });
  const service = new MatchesService({ store, actionRunner, now: () => now, onActivity: (...args) => activities.push(args),
    overlayServer: { publish: (...args) => calls.push({ channel: args[0], payload: args[1] }) },
    setTimeoutImpl: (callback, delay) => { const id = { callback, at: now + delay, unref() {} }; timers.set(id, id); return id; },
    clearTimeoutImpl: (id) => timers.delete(id) });
  const advance = (ms) => { now += ms; for (const id of [...timers.keys()]) if (id.at <= now) { timers.delete(id); id.callback(); } };
  return { state, store, service, actionRunner, calls, activities, advance, now: () => now };
}

const outputs = () => [
  { type: "animation", match: "x2", variant: "tikcontrol" },
  { type: "media", mediaUrl: "https://media.example.test/video.webm", durationMs: 4000 },
  { type: "sound", url: "https://media.example.test/son.mp3", outputMode: "live", volume: .5 }
];
const automation = (reactions = outputs()) => ({ id: "fixture-start", name: "Début du match", moment: "battleStart", enabled: true,
  reaction: { type: "bundle", reactions } });

test("Matchs : un groupe conserve animation, vidéo et son ; pas de groupe imbriqué ni sorties dupliquées", () => {
  const normalized = normalizeReaction({ type: "bundle", reactions: outputs() });
  assert.deepEqual(normalized.reactions.map((row) => row.type), ["animation", "media", "sound"]);
  assert.deepEqual(normalizeReaction({ type: "bundle", reactions: [] }), { type: "bundle", reactions: [] });
  assert.throws(() => normalizeReaction({ type: "bundle", reactions: [outputs()[0], outputs()[0]] }), /distinct/);
  assert.throws(() => normalizeReaction({ type: "bundle", reactions: [{ type: "bundle", reactions: outputs() }] }), /imbriqué/);
  assert.throws(() => normalizeReaction({ type: "bundle", reactions: Array(5).fill(outputs()[0]) }), /maximum/);
});

test("Matchs : les anciennes réactions et IDs ne sont pas remplacés, le filtre Toutes les cartes reste un réglage explicite", () => {
  const old = normalizeMatchAutomation({ ...automation(), reaction: outputs()[0] });
  assert.deepEqual(normalizeMatchesConfig({ automations: [old] }).automations, [old]);
  const draft = normalizeMatchAutomation({ ...automation([]), enabled: false, moment: "card", card: "any" });
  assert.equal(draft.card, "any"); assert.equal(draft.enabled, false);
});

test("Matchs : le vrai service exécute les trois sorties sur la même source Matchs, jamais sur Media générique", async () => {
  const f = fixture();
  f.service.saveAutomation(automation());
  f.calls.length = 0;
  await f.service.testAutomation("fixture-start");
  assert.deepEqual(f.calls.map((row) => row.channel).sort(), ["match", "match-audio", "match-media"]);
  assert.equal(f.calls.find((row) => row.channel === "match-audio").payload.volume, .5);
  assert.ok(f.calls.find((row) => row.channel === "match-media").payload.playbackId);
  assert.equal(f.calls.some((row) => row.channel === "playback" || row.channel === "alert" || row.channel === "audio"), false);
});

test("Matchs : une sortie son locale historique reste locale, les autres actions Media restent inchangées", async () => {
  const f = fixture();
  f.service.saveAutomation(automation([{ ...outputs()[2], outputMode: "local" }]));
  f.calls.length = 0; await f.service.testAutomation("fixture-start");
  assert.equal(f.calls[0].channel, "playback");
  f.calls.length = 0;
  await f.actionRunner.run({ id: "ordinary", type: "overlay.media", config: outputs()[1] });
  assert.deepEqual(f.calls.map((row) => row.channel), ["alert", "playback"]);
});

test("Matchs : brouillon vide sauvegardable mais activation et test sans sortie refusés", async () => {
  const f = fixture();
  f.service.saveAutomation({ ...automation([]), enabled: false });
  assert.throws(() => f.service.saveAutomation(automation([])), /Choisissez/);
  await assert.rejects(f.service.testAutomation("fixture-start"), /Choisissez/);
  assert.equal(f.state.settings.matches.automations[0].enabled, false);
  assert.equal(f.state.settings.matches.automations[0].reaction.reactions.length, 0);
});

test("Matchs : les sorties sont parallèles et un échec partiel ne supprime pas celles qui fonctionnent", async () => {
  const f = fixture(); let release;
  const originalRun = f.actionRunner.run.bind(f.actionRunner);
  f.actionRunner.run = async (action, context) => {
    if (action.type === "overlay.match") { await new Promise((resolve) => { release = resolve; }); throw new Error("fixture-failure"); }
    return originalRun(action, context);
  };
  f.service.saveAutomation(automation()); f.calls.length = 0;
  const pending = f.service.testAutomation("fixture-start");
  await Promise.resolve();
  assert.deepEqual(f.calls.map((row) => row.channel).sort(), ["match-audio", "match-media"]);
  release(); const result = await pending;
  assert.equal(result.partial, true); assert.equal(result.outputCount, 2);
  assert.equal(f.state.settings.matches.automations[0].reaction.reactions.length, 3);
});

test("Matchs : un changement de profil invalide les sorties différées d'un groupe", async () => {
  const f = fixture(); let release, checked = false;
  f.actionRunner.run = async (_action, context) => {
    await new Promise((resolve) => { release = resolve; });
    checked = context.shouldExecute(); return { queued: checked };
  };
  f.service.saveAutomation(automation([outputs()[0]]));
  const pending = f.service.testAutomation("fixture-start");
  f.state.session.profileId = "new-profile"; release();
  assert.deepEqual(await pending, { stale: true }); assert.equal(checked, false);
});

test("Matchs : les contributions sont regroupées sur une frame, sans attendre une fenêtre de 250 ms", () => {
  const f = fixture(); f.calls.length = 0;
  f.service.handleLiveEvent({ type: "like", source: "source_tiktok", user: { id: "viewer", name: "viewer" }, data: { count: 3 } });
  f.advance(15); assert.equal(f.calls.length, 0);
  f.advance(1); assert.equal(f.calls.filter((row) => row.channel === "match-state").length, 1);
  assert.equal(f.state.matchSession.liveContributors[0].likes, 3);
});
