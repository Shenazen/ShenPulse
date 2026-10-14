"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { loadRendererModule } = require("./helpers/three-renderer-traces");
const { moduleSignatures } = require("./helpers/module-signatures");
const baseline = require("./fixtures/thiercelieux-engine-signatures.json");
const file = path.join(__dirname, "..", "src/renderer/games/original-src/domain/thiercelieuxEngine.mjs");

test("Thiercelieux garde ses 53 exports et chaque règle/collection d’avant découpage", () => {
  assert.deepEqual(Object.keys(loadRendererModule(file).api).sort(), baseline.api);
  assert.deepEqual(moduleSignatures(file), baseline.signatures);
});
