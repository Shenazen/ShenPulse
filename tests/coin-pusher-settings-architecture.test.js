"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { loadRendererModule } = require("./helpers/three-renderer-traces");
const { traceCoinPusherSettings } = require("./helpers/coin-pusher-settings-traces");
const baseline = require("./fixtures/coin-pusher-settings-traces.json");

const file = path.join(__dirname, "..", "src/renderer/games/original-src/components/games/coinPusherSettings.ts");

test("les 78 exports, profils historiques, limites et calculs de cadeaux restent identiques", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(traceCoinPusherSettings(loadRendererModule(file).api))), baseline);
});

test("les profils, cadeaux et commandes conservent stockage et événements publics", () => {
  const environment = loadRendererModule(file);
  const api = environment.api;
  const stored = new Map();
  const events = [];
  environment.context.window.localStorage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value)
  };
  environment.context.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail; } };
  environment.context.window.dispatchEvent = (event) => events.push(event);

  api.saveCoinPusherSettings({ topN: 5, theme: "galactic-palace" });
  assert.equal(api.loadCoinPusherSettings().topN, 5);
  assert.equal(api.loadCoinPusherSettings().theme, "galactic-palace");
  const drop = api.pushCoinPusherDrop({ id: "stable-drop", createdAt: 1700000000000, source: "test", coinCount: 4 });
  assert.equal(api.loadCoinPusherDrop().id, drop.id);
  const command = api.pushCoinPusherCommand({ command: "pause", id: "stable-command", createdAt: 1700000000000 });
  assert.equal(api.loadCoinPusherCommand().id, command.id);
  assert.deepEqual(events.map((event) => event.type), [api.COIN_PUSHER_SETTINGS_EVENT, api.COIN_PUSHER_DROP_EVENT, api.COIN_PUSHER_COMMAND_EVENT]);
});

test("une erreur de stockage de profil reste visible et ne publie pas une fausse sauvegarde", () => {
  const environment = loadRendererModule(file);
  let events = 0;
  environment.context.window.localStorage = { getItem: () => null, setItem() { throw new Error("full"); } };
  environment.context.window.dispatchEvent = () => events++;
  assert.throws(() => environment.api.saveCoinPusherSettings({ topN: 7 }), /Impossible d’enregistrer/);
  assert.equal(events, 0);
});
