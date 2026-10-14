"use strict";

/** Exécute les fonctions 3D sans contexte WebGL, avec une trace Canvas déterministe. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { createHash } = require("node:crypto");
const esbuild = require("esbuild");
const THREE = require("three");
const { createEnvironment } = require("./game-overlay-trace");

function loadRendererModule(file, source = fs.readFileSync(file, "utf8")) {
  const absolute = path.resolve(file);
  const environment = createEnvironment();
  const module = { exports: {} };
  Object.assign(environment.context, { module, exports: module.exports, require: createRequire(absolute) });
  const output = esbuild.buildSync({
    stdin: { contents: source, sourcefile: absolute, resolveDir: path.dirname(absolute), loader: "ts" },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external"
  }).outputFiles[0].text;
  vm.runInContext(output, environment.context);
  return { ...environment, api: module.exports };
}

function traceThreeHelpers(api, environment) {
  const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const pegs = api.createDefaultCoinPusherPegs();
  const quaternions = [new THREE.Quaternion(), new THREE.Quaternion().setFromEuler(new THREE.Euler(.5, 1.1, -.3))];
  const phases = ["plinko", "pusher", "settling", "shelf", "falling"];
  const positions = phases.flatMap((phase) => [0, .5, 1].map((progress) => {
    const target = new THREE.Vector3();
    api.setLogicalPoint(target, 192, 490, phase, progress, 3, 18);
    return target.toArray();
  }));
  const geometries = ["createBrilliantDiamondGeometry", "createGalacticPlinkoPanelGeometry"].map((name) => {
    const geometry = api[name]();
    const attributes = Object.fromEntries(Object.entries(geometry.attributes).map(([key, attribute]) => [key, { itemSize: attribute.itemSize, array: Array.from(attribute.array) }]));
    const result = { name, hash: hash({ attributes, index: geometry.index ? Array.from(geometry.index.array) : null }), vertices: geometry.attributes.position.count };
    geometry.dispose();
    return result;
  });
  const textures = [
    ["createMachineTitleTexture", ["ShenPulse"]], ["createMysteryDieTexture", []], ["createPointTicketTexture", []],
    ["createGalacticCasinoBackdropTexture", []], ["createGalacticPanelTexture", []],
    ["createFloatingScoreTexture", ["+1234", "#39efff"]], ["createScoreSlotTexture", ["500", "#ffd865"]],
    ["createGalacticScoreSlotTexture", ["BONUS", "#a575ff"]]
  ].map(([name, args]) => {
    environment.trace.length = 0;
    const texture = api[name](...args);
    const result = { name, width: texture.image.width, height: texture.image.height, hash: hash(environment.trace), operations: environment.trace.length };
    texture.dispose();
    return result;
  });
  return {
    capacity: [[0], [1, 1024], [1025, 1024], [12345, 1, 100]].map((args) => api.nextCoinPusherInstanceCapacity(...args)),
    quality: [0, 350, 600, 900, 1400, 5000].map((count) => api.coinPusherAdaptiveQualityCeiling(count, 150, 8)),
    halfExtents: [12, 18, 24].flatMap((radius) => quaternions.map((quaternion) => api.coinPusherCoinVerticalHalfExtent(radius, quaternion))),
    pegSignature: api.coinPusherPegSignature(pegs), pegs, positions, geometries, textures
  };
}

module.exports = { loadRendererModule, traceThreeHelpers };
