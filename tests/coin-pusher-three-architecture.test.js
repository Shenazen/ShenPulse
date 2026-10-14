"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const THREE = require("three");
const { loadRendererModule, traceThreeHelpers } = require("./helpers/three-renderer-traces");
const traces = require("./fixtures/coin-pusher-three-traces.json");

const file = path.join(__dirname, "..", "src/renderer/games/original-src/components/games/coinPusher3dRenderer.ts");
const modules = ["constants", "math", "positions", "geometry", "machine-textures", "avatar-canvas", "score-textures", "resources"];
const environment = loadRendererModule(file, modules.map((name) => `export * from './coin-pusher/three/${name}'`).join("\n"));
const api = environment.api;

test("la façade conserve exactement son API publique avant extraction", () => {
  assert.deepEqual(Object.keys(loadRendererModule(file).api).sort(), [
    "coinPusherAdaptiveQualityCeiling", "coinPusherAvatarSnapshotKey", "coinPusherCoinVerticalHalfExtent",
    "createCoinPusher3dRenderer", "nextCoinPusherInstanceCapacity"
  ]);
});

test("les géométries, coordonnées, budgets de qualité et huit textures gardent leurs traces exactes", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(traceThreeHelpers(api, environment))), traces);
});

test("les ressources partagées sont libérées une fois et retirées de la scène", () => {
  const geometry = new THREE.BoxGeometry();
  const texture = new THREE.Texture();
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const root = new THREE.Group();
  const parent = new THREE.Group();
  let geometries = 0, materials = 0, textures = 0;
  geometry.addEventListener("dispose", () => geometries++);
  material.addEventListener("dispose", () => materials++);
  texture.addEventListener("dispose", () => textures++);
  root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, [material, material]));
  parent.add(root);
  api.disposeObject(root);
  assert.deepEqual({ geometries, materials, textures }, { geometries: 1, materials: 1, textures: 1 });
  assert.equal(parent.children.length, 0);
});

test("l’atlas conserve la déduplication d’un spectateur et distingue les portraits", () => {
  const viewer = { id: "coin-1", viewerId: " User ", name: "Alice", avatarUrl: " portrait.png " };
  assert.equal(api.coinPusherAvatarSnapshotKey(viewer), api.coinPusherAvatarSnapshotKey({ ...viewer, id: "coin-2" }));
  assert.notEqual(api.coinPusherAvatarSnapshotKey(viewer), api.coinPusherAvatarSnapshotKey({ ...viewer, avatarUrl: "other.png" }));
  assert.notEqual(api.coinPusherAvatarSnapshotKey({ ...viewer, viewerId: "anonymous" }), api.coinPusherAvatarSnapshotKey({ ...viewer, id: "coin-2", viewerId: "anonymous" }));
});

test("les capacités GPU refusent NaN/infini et gardent une croissance par puissances de deux", () => {
  assert.throws(() => api.nextCoinPusherInstanceCapacity(Infinity), { name: "RangeError" });
  assert.throws(() => api.nextCoinPusherInstanceCapacity(1, NaN), { name: "RangeError" });
  for (const required of [1, 2, 1025, 4097, 16383]) {
    const capacity = api.nextCoinPusherInstanceCapacity(required);
    assert.ok(capacity >= required);
    assert.equal(capacity & (capacity - 1), 0);
  }
});
