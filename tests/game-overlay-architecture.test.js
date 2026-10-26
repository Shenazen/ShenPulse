"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { buildGameOverlays } = require("../scripts/build-game-overlays");
const { createEnvironment, traceGenerator, styledEntries, mappings } = require("./helpers/game-overlay-trace");
const expectedTraces = require("./fixtures/game-overlay-traces.json");

const bundlePath = path.join(__dirname, "..", "src", "renderer", "game-overlay-generator.js");
const source = fs.readFileSync(bundlePath, "utf8");

test("le bundle livré correspond exactement aux sources modulaires d’export", async () => {
  const build = await buildGameOverlays({ write: false });
  assert.equal(build.outputFiles.length, 1);
  assert.equal(build.outputFiles[0].text, source);
  assert.equal(build.publicOutputFiles[0].text,fs.readFileSync(path.join(__dirname,"../resources/overlays/vendor/game-pack-generator.js"),"utf8"));
});

for (const expected of expectedTraces) {
  test(`l’export ${expected.type} modèle ${expected.model} garde la trace Canvas historique`, async () => {
    const result = await traceGenerator(source, expected);
    const { type: _type, model: _model, ...trace } = expected;
    assert.deepEqual(result, trace);
  });
}

test("les deux téléchargements gardent les noms demandés et le format PNG", async () => {
  const environment = createEnvironment();
  vm.runInContext(source, environment.context);
  const api = environment.context.ShenPulseGameOverlay;
  await api.downloadMinecraftStyledOverlay({ entries: styledEntries, model: 1, filename: "styled-test.png" });
  await api.downloadMinecraftBedrockOverlay({ mappings, giftOptions: [], model: 2, filename: "bedrock-test.png" });
  assert.deepEqual(environment.anchors.map((anchor) => anchor.download), ["styled-test.png", "bedrock-test.png"]);
  assert.equal(environment.images.filter((image) => image === "assets/brand/shenpulse-banner-transparent.png").length, 1, "les rendus réutilisent le cache d’images");
  await assert.rejects(api.renderMinecraftStyledOverlay({ entries: [], model: 1 }), /interaction complete/);
});
