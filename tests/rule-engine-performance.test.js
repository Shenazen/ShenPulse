"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const { StateStore } = require("../src/main/store");
const { RuleEngine } = require("../src/main/rule-engine");
const { getRuleActionState } = require("../src/main/state/projections");
const { measure } = require("../scripts/benchmark-rule-engine");

function rule(id, type = "chat", extra = {}) {
  return { id, enabled: true, trigger: { type }, chance: 1,
    actions: [{ id: `${id}-action`, type: "fixture", config: { text: id } }], ...extra };
}

function fixture(rules) {
  const store = new StateStore(path.join(os.tmpdir(), "shenpulse-rule-performance-in-memory"));
  store.touch = () => {}; // Pas de chargement, sauvegarde ou accès à l'état utilisateur.
  store.state.rules = rules;
  store.state.session.profileId = store.state.profiles[0].id;
  store.state.profiles[0].enabledRuleIds = rules.map(({ id }) => id);
  const calls = [];
  const engine = new RuleEngine({ store, actionRunner: { run: async (action, context) => {
    calls.push({ action, context });
  } } });
  return { store, engine, calls };
}

function event(type = "chat", data = {}, userId = "fixture-viewer") {
  return { id: "fixture-event", type, source: "test", user: { id: userId }, data };
}

test("projection par événement : types, wildcard, désactivation et sélection du profil avant copie", () => {
  const { store } = fixture([
    rule("chat"), rule("gift", "gift"), rule("wildcard", "*"),
    rule("disabled", "chat", { enabled: false }), rule("trigger-off", "chat", { trigger: { type: "chat", enabled: false } }),
    rule("outside-profile"), rule("no-trigger", "chat", { trigger: {} })
  ]);
  store.state.profiles[0].enabledRuleIds = store.state.profiles[0].enabledRuleIds.filter((id) => id !== "outside-profile");
  store.state.session.game = { running: true, packId: "fixture", profileId: store.state.session.profileId };
  store.state.game.interactionRulesByPack.fixture = [rule("game-chat"), rule("game-gift", "gift"), rule("game-wildcard", "*")];
  store.state.game.interactionRulesByPack.inactive = [rule("inactive")];
  const projected = store.getRuleEngineState("chat");
  assert.deepEqual(projected.rules.map(({ id }) => id), ["chat", "wildcard"]);
  assert.deepEqual(projected.profiles[0].enabledRuleIds, ["chat", "wildcard"]);
  assert.deepEqual(projected.game.interactionRulesByPack.fixture.map(({ id }) => id), ["game-chat", "game-wildcard"]);
  projected.rules[0].actions[0].config.text = "changed";
  assert.equal(store.state.rules[0].actions[0].config.text, "chat");
  assert.equal(store.getRuleEngineState().rules.length, 7); // Contrat historique conservé.
  store.state.session.game.profileId = "other-profile";
  assert.deepEqual(store.getRuleEngineState("chat").game.interactionRulesByPack, {});
  store.state.profiles[0].enabledRuleIds = [];
  assert.deepEqual(store.getRuleEngineState("chat").rules, []);
  store.state.profiles = [];
  assert.deepEqual(store.getRuleEngineState("chat").rules.map(({ id }) => id), ["chat", "wildcard", "outside-profile"]);
});

test("les règles incompatibles ne sont pas clonées ; une action propre n'exige aucune relecture globale", async () => {
  const irrelevant = rule("gift", "gift");
  Object.defineProperty(irrelevant.actions[0].config, "large", { enumerable: true,
    get() { throw new Error("Une configuration incompatible ne doit pas être copiée"); } });
  const { store, engine, calls } = fixture([rule("chat"), irrelevant]);
  store.getState = () => { throw new Error("Snapshot complet interdit"); };
  store.getStateProjection = () => { throw new Error("Lecture globale des règles interdite"); };
  await engine.process(event());
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action.config.text, "chat");
});

test("sélection inter-règles : ordre demandé, dernier ID dupliqué et isolation des configurations", async () => {
  const { store, engine, calls } = fixture([
    rule("trigger", "chat", { actions: [], actionSelection: { mode: "all", actionIds: ["shared", "other", "shared", "missing"] } }),
    rule("first", "gift", { actions: [{ id: "shared", type: "fixture", config: { text: "first" } }] }),
    rule("second", "gift", { enabled: false, actions: [
      { id: "other", type: "fixture", config: { text: "other" } },
      { id: "shared", type: "fixture", config: { text: "last" } }
    ] })
  ]);
  const projection = getRuleActionState(store.state, ["shared", "other"]);
  projection[0].actions[0].config.text = "changed";
  assert.equal(store.state.rules[1].actions[0].config.text, "first");
  store.getStateProjection = () => { throw new Error("Toutes les règles ne doivent pas être clonées"); };
  await engine.process(event());
  assert.deepEqual(calls.map(({ action }) => action.config.text), ["last", "other"]);
  assert.deepEqual(getRuleActionState(store.state, []), []);
});

test("conditions et priorités restent évaluées par le moteur, pas par un cache de règles périmé", async () => {
  const { store, engine, calls } = fixture([
    rule("low", "chat", { priority: 1 }),
    rule("high", "chat", { priority: 20, conditions: [{ field: "data.message", operator: "equals", value: "bonjour" }] }),
    rule("wildcard", "*", { priority: 5 })
  ]);
  await engine.process(event("chat", { message: "bonjour" }));
  assert.deepEqual(calls.map(({ context }) => context.rule.id), ["high", "wildcard", "low"]);
  calls.length = 0;
  store.state.rules[0].enabled = false;
  await engine.process(event("chat", { message: "autre" }));
  assert.deepEqual(calls.map(({ context }) => context.rule.id), ["wildcard"]);
});

test("travaux en attente : actions propres capturées et sélections inter-règles lues au moment historique", async () => {
  const { store, engine, calls } = fixture([
    rule("blocker", "chat", { priority: 30 }),
    rule("own", "chat", { priority: 20 }),
    rule("selection", "chat", { priority: 10, actions: [], actionSelection: { mode: "all", actionIds: ["source-action"] } }),
    rule("source", "gift")
  ]);
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  engine.maxConcurrentJobs = 1;
  engine.actionRunner.run = async (action, context) => {
    calls.push({ action, context });
    if (context.rule.id === "blocker") await blocked;
  };
  const processing = engine.process(event());
  store.state.rules[1].actions[0].config.text = "new-own";
  store.state.rules[3].actions[0].config.text = "new-source";
  release();
  await processing;
  assert.deepEqual(calls.map(({ action }) => action.config.text), ["blocker", "own", "new-source"]);
});

test("cooldowns : un nettoyage opportuniste ne supprime jamais les délais encore actifs", async (t) => {
  let now = 100000;
  t.mock.method(Date, "now", () => now);
  const { engine, calls } = fixture([rule("chat", "chat", { cooldown: { perUserMs: 60000 } })]);
  for (let index = 0; index < 20; index += 1) await engine.process(event("chat", {}, `viewer-${index}`));
  assert.equal(engine.cooldowns.size, 20);
  now += 30001;
  await engine.process(event("chat", {}, "viewer-0"));
  assert.equal(engine.cooldowns.size, 20);
  assert.equal(calls.length, 20);
  now += 30001;
  await engine.process(event("gift"));
  assert.equal(engine.cooldowns.size, 0);
  await engine.process(event("chat", {}, "viewer-0"));
  assert.equal(calls.length, 21);
  engine.resetProfileState();
  assert.equal(engine.cooldowns.size, 0);
});

test("seuils : seuls les reliquats nuls sont supprimés, les lots et accumulations restent exacts", async () => {
  const { engine, calls } = fixture([rule("gift", "gift", { trigger: { type: "gift", threshold: 5 } })]);
  await engine.process(event("gift", { count: 2 }));
  assert.equal(engine.thresholds.get("gift:fixture-viewer"), 2);
  await engine.process(event("gift", { count: 3 }));
  assert.equal(engine.thresholds.size, 0);
  assert.equal(calls.length, 1);
  await engine.process(event("gift", { count: 17 }));
  assert.equal(engine.thresholds.get("gift:fixture-viewer"), 2);
  assert.equal(calls.length, 4);
  assert.deepEqual(calls.map(({ context }) => context.event.data.count), [5, 5, 5, 5]);
});

test("les petits stores historiques sans projection spécialisée conservent la sélection inter-règles", async () => {
  const { store, engine, calls } = fixture([
    rule("trigger", "chat", { actionSelection: { mode: "all", actionIds: ["source-action"] } }), rule("source", "gift")
  ]);
  store.getRuleEngineState = undefined;
  store.getRuleActionState = undefined;
  await engine.process(event());
  assert.deepEqual(calls.map(({ action }) => action.config.text), ["source"]);
});

test("rejeu synthétique : les 375 actions restent présentes avec seulement 375 règles copiées", async () => {
  const result = await measure();
  assert.equal(result.events, 25);
  assert.equal(result.copiedRules, 375);
  assert.equal(result.actionRuleReads, 0);
  assert.equal(result.actionExecutions, 375);
});
