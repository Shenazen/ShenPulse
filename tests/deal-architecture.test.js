"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");
const { loadRendererModule } = require("./helpers/three-renderer-traces");
const { traceDealControllers } = require("./helpers/deal-controller-traces");
const { traceDealRound } = require("./helpers/deal-round-traces");
const baseline = require("./fixtures/deal-controller-traces.json");
const roundBaseline = require("./fixtures/deal-round-traces.json");
const directory = path.join(__dirname, "..", "src/renderer/games/original-src/components/games/deal-or-no-deal");

test("banque, requêtes forcées, pondération, gains et ambiances gardent leurs scénarios originaux", () => {
  const source = ["banker", "rigging", "music-scene", "price-fitter", "box-utils", "audio-volume"].map((name) => `export * from './${name}.mjs'`).join("\n");
  const environment = loadRendererModule(path.join(directory, "test-entry.ts"), source);
  vm.runInContext("Math.random = () => .61", environment.context);
  environment.context.window.localStorage = { setItem() {} };
  assert.deepEqual(JSON.parse(JSON.stringify(traceDealControllers(environment.api))), baseline);
});

test("la page ne conserve aucune référence aux anciens propriétaires des minuteurs", () => {
  const source = fs.readFileSync(path.join(directory, "../DealOrNoDealGame.vue"), "utf8");
  assert.doesNotMatch(source, /\bmusicOverrideTimer\b|\bentryAmountFitFrame\b/);
  assert.match(source, /musicController\.dispose\(\)/);
  assert.match(source, /pricesController\.dispose\(\)/);
});

test("le volume conserve ses bornes, sa clé persistée et son défaut", () => {
  const environment = loadRendererModule(path.join(directory, "audio-volume.mjs"));
  let stored = null;
  environment.context.window.localStorage = { getItem: () => stored };
  assert.equal(environment.api.loadGameAudioVolume(), 1);
  stored = "1.25";
  assert.equal(environment.api.loadGameAudioVolume(), 1.25);
  assert.equal(environment.api.clampGameAudioVolume(Infinity), 1);
  assert.equal(environment.api.clampGameAudioVolume(-1), 0);
  assert.equal(environment.api.clampGameAudioVolume(99), 1.5);
});

test("les manches, délais, échanges, achats, refus et gains finaux restent identiques", () => {
  const environment = loadRendererModule(path.join(directory, "round.mjs"));
  const pending = new Map();
  let nextTimer = 0;
  environment.context.window.setTimeout = (callback, delay) => {
    assert.equal(delay, 520);
    pending.set(++nextTimer, callback);
    return nextTimer;
  };
  const flush = () => {
    for (const [id, callback] of pending) { pending.delete(id); callback(); }
  };
  assert.deepEqual(JSON.parse(JSON.stringify(traceDealRound(environment.api, flush))), roundBaseline);
});

test("quitter la partie annule les révélations différées et empêche leur réinscription", () => {
  const environment = loadRendererModule(path.join(directory, "round.mjs"));
  const pending = new Map();
  let timer = 0;
  environment.context.window.setTimeout = (callback) => { pending.set(++timer, callback); return timer; };
  environment.context.window.clearTimeout = (id) => pending.delete(id);
  const box = { id: 1, opened: false, own: false };
  const resolving = { value: false };
  const round = environment.api.createDealRound({
    phase: { value: "opening" }, isResolving: resolving, releaseMusicOverrideForEvent() {}, soundscape: { caseOpening() {} }
  });
  round.openBox(box);
  assert.equal(pending.size, 1);
  round.dispose(); round.dispose();
  assert.equal(pending.size, 0);
  resolving.value = false;
  round.openBox({ id: 2, opened: false, own: false });
  assert.equal(pending.size, 0);
});
