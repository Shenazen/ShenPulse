"use strict";

/** Rejeu synthétique du moteur : aucun fichier utilisateur, réseau ou action réelle. */
const os = require("node:os");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { StateStore } = require("../src/main/store");
const { RuleEngine } = require("../src/main/rule-engine");

function createFixture() {
  const store = new StateStore(path.join(os.tmpdir(), "shenpulse-rules-readonly-benchmark"));
  store.touch = () => {};
  const rule = (id, type) => ({ id, enabled: true, trigger: { type }, chance: 1,
    actions: [{ id: `${id}-action`, type: "fixture", config: { payload: "metadata-".repeat(32) } }] });
  store.state.rules = [
    ...Array.from({ length: 1000 }, (_, index) => rule(`gift-${index}`, "gift")),
    ...Array.from({ length: 10 }, (_, index) => rule(`chat-${index}`, "chat"))
  ];
  store.state.profiles[0].enabledRuleIds = store.state.rules.map(({ id }) => id);
  store.state.session.profileId = store.state.profiles[0].id;
  store.state.session.game = { running: true, packId: "fixture", profileId: store.state.session.profileId };
  store.state.game.interactionRulesByPack.fixture = [
    ...Array.from({ length: 500 }, (_, index) => rule(`game-gift-${index}`, "gift")),
    ...Array.from({ length: 5 }, (_, index) => rule(`game-chat-${index}`, "chat"))
  ];
  return store;
}

async function measure(events = 25) {
  const store = createFixture();
  let copiedRules = 0;
  let actionRuleReads = 0;
  let actionExecutions = 0;
  const project = store.getRuleEngineState.bind(store);
  store.getRuleEngineState = (...args) => {
    const state = project(...args);
    copiedRules += state.rules.length + Object.values(state.game.interactionRulesByPack).reduce((sum, rules) => sum + rules.length, 0);
    return state;
  };
  const read = store.getStateProjection.bind(store);
  store.getStateProjection = (paths) => {
    if (paths.includes("rules")) actionRuleReads += 1;
    return read(paths);
  };
  const engine = new RuleEngine({ store, actionRunner: { run: async () => { actionExecutions += 1; } } });
  const start = performance.now();
  for (let index = 0; index < events; index += 1) await engine.process({ id: `fixture-${index}`,
    type: "chat", source: "test", timestamp: "2026-10-13T00:00:00.000Z",
    user: { id: "fixture-viewer" }, data: { message: "synthetic" } });
  return { events, processingMs: Number((performance.now() - start).toFixed(2)), copiedRules,
    actionRuleReads, actionExecutions };
}

async function main() {
  await measure(2); // Chauffe sans inclure le démarrage Node dans les mesures.
  const samples = [];
  for (let index = 0; index < 5; index += 1) samples.push(await measure());
  const times = samples.map(({ processingMs }) => processingMs).sort((a, b) => a - b);
  console.log(JSON.stringify({ fixture: "1 010 règles globales + 505 règles du jeu actif, 25 chats",
    samples, medianMs: times[Math.floor(times.length / 2)] }));
}

if (require.main === module) main().catch((error) => { console.error(error.stack); process.exitCode = 1; });

module.exports = { createFixture, measure };
