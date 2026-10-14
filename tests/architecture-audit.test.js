"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { inventorySources, parseScripts, analyzeScript, resolveLocalImport, importCycles } = require("../scripts/lib/source-analysis");

test("l’inventaire distingue les sources maintenues des sorties générées", () => {
  const { files, excluded } = inventorySources();
  assert.ok(files.some((file) => file.path === "native/store-update/src/store_update.cc"));
  assert.ok(files.some((file) => file.path.endsWith("shenpulse_irl_server.py")));
  assert.ok(files.some((file) => file.path.endsWith("ShenPulseMontChiliadEnhanced.cpp")));
  assert.ok(files.some((file) => file.path === "sdk/dotnet/ShenPulse.GameSdk/Models.cs"));
  assert.equal(files.find((file) => file.path === "src/renderer/game-overlay-generator.js").generated, true);
  assert.ok(excluded.some((entry) => entry.path === "src/renderer/games/original"));
  assert.ok(files.every((file) => !file.path.includes("node_modules/")));
});

test("les imports locaux reconnaissent les assets Vite et les chemins absolus du site", () => {
  assert.equal(resolveLocalImport("website/app.js", "/app/legal-pages.js"), "website/app/legal-pages.js");
  assert.equal(resolveLocalImport("src/renderer/games/original-src/main.ts", "./host/startup-events?url"), "src/renderer/games/original-src/host/startup-events.ts");
  assert.equal(resolveLocalImport("website/app.js", "node:fs"), null);
});

test("la syntaxe est contrôlée aussi dans les modules TypeScript et les scripts Vue", () => {
  assert.equal(parseScripts({ path: "example.ts", source: "const value: number = 2;" }).errors.length, 0);
  assert.ok(parseScripts({ path: "broken.ts", source: "function broken() : {" }).errors.length);
  assert.equal(parseScripts({ path: "example.vue", source: '<script setup lang="ts">const value: number = 2</script><template>{{ value }}</template>' }).errors.length, 0);
  assert.ok(parseScripts({ path: "broken.vue", source: '<script setup lang="ts">const value = ;</script>' }).errors.length);
});

test("les cycles d’import sont détectés sans confondre les dépendances partagées", () => {
  assert.deepEqual(importCycles({ a: ["common"], b: ["common"], common: [] }), []);
  const cycles = importCycles({ a: ["b"], b: ["c"], c: ["a"] });
  assert.deepEqual(cycles, [["a", "b", "c", "a"]]);
});

test("les doublons sont comparés sur les tokens du corps et jamais fusionnés automatiquement", () => {
  const body = 'let total = 0; for (const value of values) { if (value > 0) { total += value * 2; } else { total -= value; } } if (total > 100) { total = 100; } const average = total / Math.max(1, values.length); return { total, average, valid: total > 0, count: values.length };';
  const first = analyzeScript({ path: "a.js", source: `function a(values) { ${body} }` }).functions[0];
  const second = analyzeScript({ path: "b.js", source: `function b(values) { /* commentaire */ ${body} }` }).functions[0];
  const changed = analyzeScript({ path: "c.js", source: `function c(values) { ${body.replace("* 2", "* 3")} }` }).functions[0];
  assert.ok(first && second && changed);
  assert.equal(first.hash, second.hash);
  assert.notEqual(first.hash, changed.hash);
});
