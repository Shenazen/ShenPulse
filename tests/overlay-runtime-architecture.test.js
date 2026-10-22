"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { buildOverlayRuntime } = require("../scripts/build-overlay-runtime");
const { readOverlayRuntimeSource } = require("./helpers/source-bundles");

const directory = path.join(__dirname, "..", "resources", "overlays");
const loader = fs.readFileSync(path.join(directory, "runtime", "loader.js"), "utf8");

async function selectedScripts(view) {
  const scripts = [];
  const errors = [];
  const context = {
    location: { search: `?view=${view}`, pathname: "/overlay/" }, URLSearchParams,
    performance: { now: () => 1 },
    console: { error: (...values) => errors.push(values) },
    document: {
      createElement: () => ({ addEventListener(name, callback) { this[name] = callback; } }),
      head: { appendChild() {} },
      body: { appendChild(script) { scripts.push(script.src.split("?")[0]); queueMicrotask(() => script.load()); } },
      documentElement: { classList: { remove() {} }, dataset: {} }
    }
  };
  vm.runInNewContext(loader, context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(errors, []);
  for (const script of scripts) assert.ok(fs.existsSync(path.join(directory, script)), script);
  return scripts;
}

test("les anciens chemins runtime sont générés depuis les mêmes moteurs", () => {
  for (const output of buildOverlayRuntime({ write: false }).outputFiles) {
    assert.equal(fs.readFileSync(output.path, "utf8"), output.text);
  }
  assert.equal((readOverlayRuntimeSource().match(/function hydrateOverlaySession\(/g) || []).length, 1);
});

const selectedByView = {
  "coin-jar": ["coin-jar-design", "coin-jar"], "win-counter": ["win-counter"], timer: ["timers"],
  "multiplier-timer": ["timers"], game: ["game"], wheel: ["wheel-design", "wheel-animation"],
  match: ["match-compatible", "match-audio", "match-reactions", "match-progress", "match-preview", "match"], leaderboard: [], "like-goal": []
};

for (const [view, modules] of Object.entries(selectedByView)) {
  test(`la source ${view} charge seulement ses moteurs de widget`, async () => {
    const scripts = await selectedScripts(view);
    assert.deepEqual(scripts.filter((script) => script.startsWith("runtime/widgets/")), modules.map((name) => `runtime/widgets/${name}.js`));
    assert.ok(scripts.includes("runtime/session.js"));
    assert.ok(!scripts.includes("runtime/widgets.js"));
    assert.ok(!scripts.includes("runtime/wheel-match.js"));
    assert.equal(scripts.at(-1), "runtime/transport.js");
    const bytes = modules.reduce((sum, name) => sum + fs.statSync(path.join(directory, "runtime", "widgets", `${name}.js`)).size, 0);
    if (["timer", "win-counter", "game"].includes(view)) assert.ok(bytes < fs.statSync(path.join(directory, "runtime", "widgets.js")).size / 4);
  });
}
