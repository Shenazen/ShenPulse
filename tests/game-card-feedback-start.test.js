"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const { RuleEngine } = require("../src/main/rule-engine");
const { bindGameCardFeedback } = require("../src/main/core/game-card-feedback");
const { createGamePackOverlay, PACK_ID } = require("../src/shared/game-pack-overlay");
const effects = require("../resources/catalogs/supermarket-simulator-effects.json");

function fixture(run, { native = false, global = true, actions = 1 } = {}) {
  const condition = { field: "data.giftName", operator: "equals", value: "Rose", giftId: "5655", giftCost: 1 };
  const base = { enabled: true, chance: 1, trigger: { type: "gift", threshold: 1, repeatGiftCombos: true }, conditions: [condition] };
  const game = { ...base, id: "game", gameInteraction: { title: "Client ajouté", marketColumn: "help" },
    actions: [{ id: "game-action", type: "game.effect", config: { packId: PACK_ID, effectId: effects[0].id } }] };
  const irl = { ...base, id: "irl", name: "Orbeez 15", actions: Array.from({ length: actions }, (_, i) => ({
    id: `http-${i}`, type: "http.request", config: { url: "http://device.test/action?duration=15000" }
  })) };
  const state = {
    session: { profileId: "p", game: { running: true, profileId: "p", packId: PACK_ID } },
    profiles: [{ id: "p", enabledRuleIds: global ? [irl.id] : [] }], rules: global ? [irl] : [],
    game: { interactionRulesByPack: { [PACK_ID]: native ? [game] : [] } },
    commerce: { subscription: { tier: "premium", status: "active", source: "paid" } },
    settings: { account: { uid: "owner", email: "owner@example.test", refreshTokenSecretId: "test-secret" },
      overlayConfigs: { gameInteractionOverlays: { [PACK_ID]: { linkedActionsEnabled: true, linkedRuleIds: [irl.id] } } } }
  };
  const messages = [], trace = [];
  const engine = new RuleEngine({ store: { getState: () => state }, actionRunner: { run: (...args) => { trace.push("action-started"); return run(...args); } } });
  bindGameCardFeedback({ ruleEngine: engine, store: { getState: () => state }, overlayServer: {
    publish: (channel, payload) => { trace.push("card"); messages.push({ channel, payload }); }
  } });
  return { engine, state, game, irl, messages, trace };
}

function gift(count = 1) {
  return { id: "receipt", type: "gift", source: "tiktok", user: { id: "viewer", displayName: "Alice" },
    data: { giftId: "5655", giftName: "Rose", count, raw: { repeatCount: count, giftComboId: "combo" } } };
}

for (const native of [false, true]) {
  test(`${native ? "jeu" : "IRL HTTP"} : la carte démarre sans attendre la fin de l'action`, async () => {
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    const f = fixture(() => pending, { native, global: !native });
    let completed = false;
    const done = f.engine.process(gift()).then(() => { completed = true; });
    assert.equal(completed, false);
    assert.deepEqual(f.trace, ["card", "action-started"]);
    assert.equal(f.messages[0].payload.eventKey, "receipt");
    assert.equal(f.messages[0].payload.viewer, "Alice");
    finish({ ok: true });
    await done;
    assert.equal(completed, true);
    assert.equal(f.messages.length, 1, "Aucune seconde animation à la fin.");
  });
}

test("plusieurs effets de la même action : une seule mise en valeur, dès le premier départ", async () => {
  const finishes = [];
  const f = fixture(() => new Promise(resolve => finishes.push(resolve)), { actions: 2 });
  const done = f.engine.process(gift());
  assert.equal(f.messages.length, 1);
  assert.equal(finishes.length, 1);
  finishes[0]({ ok: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(finishes.length, 2);
  assert.equal(f.messages.length, 1);
  finishes[1]({ ok: true });
  await done;
  assert.equal(f.messages.length, 1);
});

test("un échec reste signalé au moteur et ne rejoue pas l'animation après le retour réseau", async () => {
  let fail;
  const f = fixture(() => new Promise((_, reject) => { fail = reject; }));
  const results = [];
  f.engine.on("action-result", result => results.push(result));
  const done = f.engine.process(gift());
  assert.equal(f.messages.length, 1);
  fail(new Error("Réseau indisponible"));
  await done;
  assert.equal(results.length, 1);
  assert.equal(results[0].ok, false);
  assert.equal(results[0].error.message, "Réseau indisponible");
  assert.equal(f.messages.length, 1);
});

test("vingt roses jeu + IRL : vingt impulsions, sans doublon à la fin ni entre les deux règles", async t => {
  let executions = 0;
  const f = fixture(async () => { executions++; }, { native: true, actions: 2 });
  const dom = new JSDOM('<main id="pack"><div id="cards"></div><div id="reaction"></div></main>', {
    url: `https://example.test/game-pack.html?jeu=${PACK_ID}`, runScripts: "outside-only"
  });
  t.after(() => dom.window.close());
  dom.window.ShenPulseGamePackLayout = require("../resources/overlays/game-pack-layout");
  dom.window.eval(fs.readFileSync(require.resolve("../resources/overlays/runtime/game-pack.js"), "utf8"));
  const runtime = dom.window.ShenPulseGamePack;
  runtime.render(createGamePackOverlay(f.state));
  await f.engine.process(gift(20));
  assert.equal(executions, 60);
  assert.equal(f.messages.length, 40);
  assert.equal(new Set(f.messages.map(m => m.payload.eventKey)).size, 20);
  for (const message of f.messages) runtime.trigger(message.payload);
  const card = dom.window.document.querySelector('.gift-card');
  assert.equal(card.dataset.giftPulses, "1");
  assert.equal(card.dataset.pendingGifts, "19");
  assert.ok(card.querySelector('.card-spark'));
});

test("une action masquée ou sans effet sélectionné n'anime aucune carte", async () => {
  const hidden = fixture(async () => {});
  hidden.state.settings.overlayConfigs.gameInteractionOverlays[PACK_ID].linkedActionsEnabled = false;
  await hidden.engine.process(gift());
  assert.equal(hidden.messages.length, 0);
  const empty = fixture(async () => {});
  empty.irl.actions = [];
  await empty.engine.process(gift());
  assert.equal(empty.messages.length, 0);
});

test("une erreur de publication de l'overlay ne bloque jamais l'action", async () => {
  let executions = 0;
  const rule = { id: "game", enabled: true, chance: 1, trigger: { type: "gift" }, conditions: [],
    actions: [{ id: "game-action", type: "game.effect", config: { packId: PACK_ID, effectId: effects[0].id } }] };
  const state = { session: { profileId: "p" }, profiles: [{ id: "p", enabledRuleIds: [rule.id] }], rules: [rule] };
  const store = { getState: () => state };
  const engine = new RuleEngine({ store, actionRunner: { run: async () => { executions++; return { ok: true }; } } });
  bindGameCardFeedback({ ruleEngine: engine, store, overlayServer: { publish: () => { throw new Error("Source fermée"); } } });
  const results = [];
  engine.on("action-result", result => results.push(result));
  await engine.process(gift());
  assert.equal(executions, 1);
  assert.equal(results[0].ok, true);
});
