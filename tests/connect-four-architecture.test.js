"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { loadRendererModule } = require("./helpers/three-renderer-traces");
const { traceConnectFourEngine } = require("./helpers/connect-four-traces");
const baseline = require("./fixtures/connect-four-engine-traces.json");
const directory = path.join(__dirname, "..", "src/renderer/games/original-src/components/games/connect-four");

test("les règles, récompenses directionnelles, évaluations et choix des deux IA restent identiques", () => {
  const environment = loadRendererModule(path.join(directory, "board-engine.ts"));
  vm.runInContext("Math.random = () => .125", environment.context);
  assert.deepEqual(JSON.parse(JSON.stringify(traceConnectFourEngine(environment.api))), baseline);
});

test("le cache des fenêtres suit les nouvelles pièces et invalide ses dimensions", () => {
  const { api } = loadRendererModule(path.join(directory, "board-engine.ts"));
  const board = { value: Array.from({ length: 6 }, () => Array(7).fill(0)) };
  const rows = { value: 6 }, columns = { value: 7 };
  const engine = api.createConnectFourBoardEngine({ board, rowCount: rows, columnCount: columns, winLength: { value: 4 }, mode: { value: "duel" }, availableColumns: { value: [0, 1, 2, 3, 4, 5, 6] } });
  const oldWindows = engine.collectWindows(board.value, 4);
  board.value[5][0] = 1;
  assert.ok(engine.collectWindows(board.value, 4).some((window) => window.includes(1)));
  assert.ok(oldWindows.every((window) => window.every((value) => value === 0)));
  rows.value = 7; columns.value = 9;
  board.value = Array.from({ length: 7 }, () => Array(9).fill(0));
  assert.ok(engine.collectWindows(board.value, 5).every((window) => window.length === 5));
});

test("la sortie de page ferme le contexte audio et le mode muet ne le crée pas", () => {
  const environment = loadRendererModule(path.join(directory, "sound.ts"));
  let created = 0, closed = 0;
  const calls = [];
  class Context {
    state = "running"; currentTime = 10; destination = {};
    constructor() { created++; }
    createOscillator() { return { frequency: { set value(value) { calls.push(["frequency", value]); } }, connect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    resume() { return Promise.resolve(); }
    close() { closed++; this.state = "closed"; return Promise.resolve(); }
  }
  environment.context.window.AudioContext = Context;
  const enabled = { value: false };
  const sound = environment.api.createConnectFourSound(enabled);
  sound.playMoveSound(1);
  assert.equal(created, 0);
  enabled.value = true;
  sound.playMoveSound(1);
  assert.equal(created, 1);
  assert.deepEqual(calls, [["frequency", 164.81], ["frequency", 164.81 * 1.5]]);
  sound.dispose(); sound.dispose();
  assert.equal(closed, 1);
});
