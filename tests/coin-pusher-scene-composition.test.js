"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createSceneHarness, sampleFrame, traceSceneLifecycle } = require("./helpers/coin-pusher-scene-traces");
const baseline = require("./fixtures/coin-pusher-scene-traces.json");

test("la composition conserve les arbres, matériaux, matrices, caches Canvas et libérations exacts", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(traceSceneLifecycle())), baseline);
});

test("un contexte perdu déclenche le repli, une restauration permet de rendre et dispose reste idempotent", () => {
  const harness = createSceneHarness();
  let prevented = false;
  harness.listeners.get("webglcontextlost")({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.throws(() => harness.renderer.render(sampleFrame(.016)), /context lost/);
  harness.listeners.get("webglcontextrestored")();
  harness.renderer.render(sampleFrame(.032));
  harness.snapshot();
  harness.renderer.dispose();
  const disposal = { ...harness.disposal };
  harness.renderer.dispose();
  harness.renderer.render(sampleFrame(.048));
  assert.deepEqual(harness.disposal, disposal);
  assert.equal(harness.listeners.size, 0);
});

test("les huit collections de frame, sprites et textures de scores sont réutilisés", () => {
  const harness = createSceneHarness();
  const frame = sampleFrame(.016);
  harness.renderer.render(frame);
  const coins = harness.renderer.coins;
  const names = ["regularCoins", "mysteryItems", "tickets", "avatarKeys", "avatarRepresentatives", "avatarEntriesByKey", "avatarEntries", "pageRequirements"];
  const collections = names.map((name) => coins[name]);
  const scores = harness.renderer.floatingScores;
  const first = scores.floatingScoreSprites.get(1);
  const sprite = first.sprite;
  const texture = first.material.map;
  harness.renderer.render({ ...frame, time: .032, floatingScores: [{ ...frame.floatingScores[0], id: 2 }] });
  names.forEach((name, index) => assert.equal(coins[name], collections[index], name));
  assert.equal(scores.floatingScoreSprites.get(2).sprite, sprite);
  assert.equal(scores.floatingScoreSprites.get(2).material.map, texture);
  assert.equal(scores.floatingScoreTextures.size, 1);
  assert.equal(coins.atlas.avatarAtlasPages.size, 1);
  harness.renderer.dispose();
  for (const collection of collections) assert.equal(collection.length ?? collection.size, 0);
});

test("les instances grandissent sans plafond et les nombreuses pièces d'un même spectateur partagent un portrait", () => {
  const harness = createSceneHarness();
  const sample = sampleFrame(.016);
  const coin = sample.coins[0];
  const regular = Array.from({ length: 1025 }, (_, index) => ({ ...coin, id: `coin-${index}` }));
  const mystery = Array.from({ length: 300 }, (_, index) => ({ ...coin, kind: "mystery", id: `mystery-${index}` }));
  const tickets = Array.from({ length: 300 }, (_, index) => ({ ...coin, kind: "ticket", id: `ticket-${index}` }));
  harness.renderer.render({ ...sample, coins: [...regular, ...mystery, ...tickets] });
  const coins = harness.renderer.coins;
  assert.equal(coins.bodyCapacity, 2048);
  assert.equal(coins.bodyMesh.count, 1025);
  assert.equal(coins.mysteryMesh.count, 300);
  assert.equal(coins.ticketMesh.count, 300);
  assert.ok(coins.mysteryCapacity >= 300);
  assert.ok(coins.ticketCapacity >= 300);
  assert.equal(coins.atlas.avatarAtlasPages.size, 1);
  const page = [...coins.atlas.avatarAtlasPages.values()][0];
  assert.equal(page.entries, 1);
  assert.equal(page.capacity, 2048);
  assert.equal(page.front.count, 1025);
  assert.equal(page.back.count, 1025);
  harness.renderer.render({ ...sample, time: .032, coins: regular.slice(0, 1) });
  assert.equal(coins.bodyCapacity, 2048);
  assert.equal(page.capacity, 2048);
  assert.equal(page.front.count, 1);
  harness.renderer.dispose();
});

test("la file de portraits est limitée à huit chargements et ignore les callbacks après éviction", () => {
  const harness = createSceneHarness();
  const sample = sampleFrame(.016);
  const coins = Array.from({ length: 20 }, (_, index) => ({ ...sample.coins[0], id: `coin-${index}`, viewerId: `viewer-${index}`, avatarUrl: `avatar-${index}.png` }));
  harness.renderer.render({ ...sample, coins });
  const atlas = harness.renderer.coins.atlas;
  assert.equal(atlas.activeAvatarAtlasLoads, 8);
  assert.equal(atlas.avatarAtlasLoadQueue.length, 12);
  const initial = harness.loads.filter((job) => job.url.startsWith("avatar-"));
  assert.equal(initial.length, 8);
  initial[0].success({ src: "avatar-0.png", width: 512, height: 512, naturalWidth: 512, naturalHeight: 512 });
  assert.equal(atlas.activeAvatarAtlasLoads, 8);
  assert.equal(atlas.avatarAtlasLoadQueue.length, 11);
  assert.equal(harness.loads.filter((job) => job.url.startsWith("avatar-")).length, 9);
  atlas.setFrame(182);
  atlas.sweepAvatarAtlasEntries();
  assert.equal(atlas.avatarAtlasPages.size, 0);
  const drawingCount = harness.trace.length;
  for (const job of harness.loads.filter((job) => job.url.startsWith("avatar-")).slice(1)) job.success({ width: 512, height: 512 });
  assert.equal(harness.trace.length, drawingCount);
  assert.equal(atlas.activeAvatarAtlasLoads, 0);
  assert.equal(atlas.avatarAtlasLoadQueue.length, 0);
  harness.renderer.dispose();
});

test("les surfaces rejettent les chargements périmés et libèrent la texture remplacée", () => {
  const harness = createSceneHarness();
  const frame = sampleFrame(.016);
  harness.renderer.render({ ...frame, platformImageUrl: "surface-a.png" });
  const old = harness.loads.find((job) => job.url === "surface-a.png");
  harness.renderer.render({ ...frame, time: .032, platformImageUrl: "surface-b.png" });
  const current = harness.loads.find((job) => job.url === "surface-b.png");
  let disposedOld = 0, disposedCurrent = 0;
  old.texture.addEventListener("dispose", () => disposedOld++);
  current.texture.addEventListener("dispose", () => disposedCurrent++);
  old.success(old.texture);
  assert.equal(disposedOld, 1);
  assert.equal(harness.renderer.materials.platformMaterial.map, null);
  current.success(current.texture);
  assert.equal(harness.renderer.materials.platformMaterial.map, current.texture);
  assert.equal(harness.renderer.materials.movingDeckSurfaceMaterial.map, current.texture);
  harness.renderer.render({ ...frame, time: .048 });
  assert.equal(disposedCurrent, 1);
  assert.equal(harness.renderer.materials.platformMaterial.map, null);
  harness.renderer.dispose();
  assert.equal(disposedCurrent, 1);
});

test("la qualité adaptative ignore les pauses et diminue graduellement dans ses budgets existants", () => {
  const harness = createSceneHarness();
  const renderer = harness.renderer;
  renderer.updateAdaptiveQuality(.5, 5000, 500, 64, 10);
  assert.equal(renderer.adaptiveQuality, 1);
  for (let index = 1; index <= 180; index++) renderer.updateAdaptiveQuality(.06, 5000, 500, 64, 10 + index * .06);
  assert.ok(renderer.adaptiveQuality < 1);
  assert.ok(renderer.adaptiveQuality >= .68);
  assert.ok(renderer.appliedPixelRatio >= .75);
  assert.ok(renderer.shadowFrameInterval <= 3);
  harness.renderer.dispose();
});

test("un recadrage UV inchangé ne réécrit ni ne réenvoie le tampon GPU", () => {
  const harness = createSceneHarness();
  const frame = { ...sampleFrame(.016), coins: [], floatingScores: [], particles: [] };
  const surfaces = harness.renderer.surfaces;
  const platformTargets = surfaces.platformTargets.arcade;
  const plinkoTargets = surfaces.plinkoTargets.arcade;
  const uv = harness.renderer.decor.galacticPlinkoPanelGeometry.attributes.uv;
  harness.renderer.render(frame);
  const initial = uv.version;
  harness.renderer.render({ ...frame, time: .032 });
  assert.equal(uv.version, initial);
  assert.equal(surfaces.platformTargets.arcade, platformTargets);
  assert.equal(surfaces.plinkoTargets.arcade, plinkoTargets);
  harness.renderer.render({ ...frame, time: .048, plinkoImageUrl: "wide-panel.png" });
  const job = harness.loads.find((entry) => entry.url === "wide-panel.png");
  job.texture.image.width = 1024;
  job.texture.image.height = 512;
  job.success(job.texture);
  assert.ok(uv.version > initial);
  const loaded = uv.version;
  harness.renderer.render({ ...frame, time: .064, plinkoImageUrl: "wide-panel.png" });
  assert.equal(uv.version, loaded);
  harness.renderer.render({ ...frame, time: .080 });
  assert.ok(uv.version > loaded);
  const cleared = uv.version;
  harness.renderer.render({ ...frame, time: .096 });
  assert.equal(uv.version, cleared);
  harness.renderer.dispose();
});
