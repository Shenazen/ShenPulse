"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { loadRendererModule } = require("./helpers/three-renderer-traces");
const { moduleSignatures } = require("./helpers/module-signatures");
const baseline = require("./fixtures/coin-pusher-physics-signatures.json");
const file = path.join(__dirname, "..", "src/renderer/games/original-src/components/games/coinPusherPhysics.ts");

test("la physique conserve ses 47 exports et tous ses seuils, formules et branches", () => {
  assert.deepEqual(Object.keys(loadRendererModule(file).api).sort(), baseline.api);
  assert.deepEqual(moduleSignatures(file), baseline.signatures);
});

test("le pousseur et les recherches de support manipulent les vrais corps physiques", () => {
  const { api } = loadRendererModule(file);
  const body = { id: "coin", x: 270, y: 500, vx: 0, vy: 0, radius: 12, stackLevel: 1, stackFalling: false };
  const support = { ...body, id: "support", stackLevel: 0 };
  const coinStart = { x: body.x, y: body.y }, supportStart = { x: support.x, y: support.y };
  support.x += 5; support.y += 10;
  assert.equal(api.coinPusherTransportOnSupport(body, coinStart, support, supportStart), true);
  assert.equal(body.x, 275); assert.equal(body.y, 510);
  assert.equal(api.coinPusherStackCollisionLevel(body), 1);
  body.stackFalling = true;
  assert.equal(api.coinPusherStackCollisionLevel(body), null);
});
