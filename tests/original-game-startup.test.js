"use strict";

const packaging = require("../package.json");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const test = require("node:test");

const directory = path.join(__dirname, "..", "src", "renderer", "games", "original-src");

test("le package garde les jeux compilés et l'asset partagé sans embarquer leurs sources de développement", () => {
  const exclusion = packaging.build.files.find((entry) => typeof entry === "string" && entry.startsWith("!src/renderer/games/original-src/"));
  const { Minimatch } = require("minimatch");
  const matcher = new Minimatch(exclusion.slice(1));
  for (const extension of ["ts", "mjs", "vue", "css", "png", "mp3"]) {
    assert.ok(matcher.match(`src/renderer/games/original-src/example.${extension}`));
  }
  assert.equal(matcher.match("src/renderer/games/original/assets/index.js"), false);
  const shared = "src/renderer/games/original-src/assets/games/coin-pusher/platform-default.webp";
  assert.equal(matcher.match(shared), false);
  assert.ok(fs.existsSync(path.join(__dirname, "..", shared)));
});

function createQueue() {
  const source = fs.readFileSync(path.join(directory, "host", "startup-events.ts"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {} };
  vm.runInNewContext(compiled, context);
  return context.exports.createStartupEventQueue();
}

test("les imports ne chargent que le jeu demandé et jamais les quatre scènes ensemble", () => {
  const main = fs.readFileSync(path.join(directory, "main.ts"), "utf8");
  const loaders = fs.readFileSync(path.join(directory, "host", "game-loaders.ts"), "utf8");
  assert.doesNotMatch(main, /import\s+\w+Game\s+from/);
  assert.equal((loaders.match(/=> import\(/g) || []).length, 4);
  assert.match(main, /gameLoaders\[gameId\]\(\)/);
  assert.ok(main.indexOf("api.on('live-event'") < main.indexOf("await Promise.all"));
  assert.ok(main.indexOf("app.mount('#app')") < main.indexOf("events.activate"));
});

test("les événements LIVE reçus au chargement sont rejoués exactement une fois et dans l’ordre", () => {
  const queue = createQueue();
  const events = [];
  queue.enqueue("gift");
  queue.enqueue("settings");
  queue.enqueue("effect");
  assert.deepEqual(events, []);
  queue.activate((event) => {
    events.push(event);
    if (event === "gift") queue.enqueue("reentrant");
  });
  queue.enqueue("live");
  assert.deepEqual(events, ["gift", "settings", "effect", "reentrant", "live"]);
  queue.dispose();
  queue.enqueue("ignored");
  queue.activate((event) => events.push(event));
  assert.equal(events.length, 5);
});

test("une rafale initiale conserve tous ses événements sans file quadratique", () => {
  const queue = createQueue();
  for (let index = 0; index < 50000; index += 1) queue.enqueue(index);
  let expected = 0;
  queue.activate((index) => { assert.equal(index, expected++); });
  assert.equal(expected, 50000);
});
