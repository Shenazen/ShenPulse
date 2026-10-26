"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { FIND_THE_NEEDLE_EFFECTS: effects, FIND_THE_NEEDLE_COMMAND_SPECS: specs, FIND_THE_NEEDLE_DEFAULT_MAPPINGS: mappings } = require("../src/main/find-the-needle-catalog");
const { createEffectPayload } = require("../src/main/game-hub/effect-payload");
const { snapshotForRenderer } = require("../src/main/account-access");

test("la démo incluse et privée conserve ses 37 codes réels, jaquette et guide", () => {
  const catalog = loadShenazenGameCatalog(path.join(__dirname, "../resources"));
  const pack = catalog.find(pack => pack.id === "find-the-needle-demo");
  assert.equal(pack.ownerOnly, true);
  assert.equal(pack.included, true);
  assert.equal(pack.price, 0);
  assert.equal(pack.connector.type, "find-the-needle-http");
  assert.equal(pack.effects.length, 37);
  assert.equal(new Set(effects.map(e => e.code)).size, 37);
  assert.deepEqual(effects.map(e => e.code), Object.keys(specs));
  assert.ok(effects.every(e => e.available === true));
  assert.equal(fs.existsSync(path.join(__dirname, "../src/renderer/assets/games", pack.artwork)), true);
  assert.match(pack.guide.summary, /25867630/);
  assert.ok(pack.guide.notes.some(note => /premier plan/.test(note)));
  assert.ok(pack.guide.notes.some(note => /ne restaure pas/.test(note)));
  assert.equal(mappings.length, 37);
  assert.equal(mappings.filter(m => m.triggerEnabled).length, 4);
  assert.ok(mappings.every(m => effects.some(e => e.id === m.effectId)));
  assert.equal(catalog.some(p => /haystack/.test(p.id)), false, "jeu payant reporté, pas d’intégration simulée");
});

test("la démo n’est jamais transmise à un autre compte, même administrateur générique", () => {
  const packs = loadShenazenGameCatalog(path.join(__dirname, "../resources"));
  for (const owner of [false, true]) {
    const account = { uid: "fixture", email: owner ? "alexandre.leuridan@gmail.com" : "other@example.test", emailVerified: true, role: "admin", refreshTokenSecretId: "fixture-secret" };
    const store = { getState: () => ({ settings: { account } }), getSecret: id => id === "fixture-secret" ? "fixture" : "" };
    const visible = snapshotForRenderer({ packs, state: { activity: [] } }, store);
    assert.equal(visible.packs.some(p => p.id === "find-the-needle-demo"), owner);
  }
});

test("les identifiants texte survivent aux valeurs par défaut sans conversion en NaN", () => {
  const effect = effects.find(e => e.code === "unlocktech");
  assert.equal(createEffectPayload(effect).effect.parameters.effect, "random");
  assert.equal(createEffectPayload(effect, {}, { parameters: { effect: "spade", rank: 2 } }).effect.parameters.effect, "spade");
  assert.equal(createEffectPayload(effects.find(e => e.code === "givemoney")).effect.parameters.effect, 100);
  const prices = createEffectPayload(effects.find(e => e.code === "priceup")).effect.parameters;
  assert.deepEqual(prices, { effect: 25, duration: 30 });
});

test("l’éditeur propose les identifiants texte, les conserve et refuse les entrées invalides", () => {
  const context = vm.createContext({
    isMinecraftWinCounterPack: () => false,
    field: (name, label, value, type, extra) => `<input name="${name}" type="${type}" value="${value}" ${extra}>`
  });
  context.ShenPulseGameInteractionTitles = require("../src/shared/game-interaction-titles");
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/editors/game-interactions.js"), "utf8"), context);
  const effect = effects.find(e => e.code === "unlocktech");
  const html = context.gameEffectParameterFields(effect, {});
  const input = JSDOM.fragment(html).querySelector('[name="effectParameter_effect"]');
  assert.equal(input.type, "text");
  assert.equal(input.value, "random");
  const data = new Map([["effectParameter_effect", "spade"], ["effectParameter_rank", "2"]]);
  assert.deepEqual(JSON.parse(JSON.stringify(context.gameEffectParametersFromForm(effect, data))), { effect: "spade", rank: 2 });
  data.set("effectParameter_effect", "../invalid");
  assert.throws(() => context.gameEffectParametersFromForm(effect, data), /Identifiant invalide/);
});
