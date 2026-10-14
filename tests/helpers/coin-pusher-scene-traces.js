"use strict";

/** Exercices du vrai graphe Three.js sans GPU : seul le backend WebGL est simulé. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { createHash } = require("node:crypto");
const esbuild = require("esbuild");
const THREE = require("three");
const { createEnvironment } = require("./game-overlay-trace");

const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function createSceneHarness() {
  const file = path.resolve(__dirname, "../../src/renderer/games/original-src/components/games/coinPusher3dRenderer.ts");
  const environment = createEnvironment();
  const events = [], loads = [], listeners = new Map();
  const tracked = new Set();
  const disposal = { geometries: 0, materials: 0, textures: 0, instances: 0 };
  let scene, seed = 1729;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const track = (resource) => {
    if (!resource || tracked.has(resource)) return;
    tracked.add(resource);
    const kind = resource.isBufferGeometry ? "geometries" : resource.isMaterial ? "materials" : resource.isTexture ? "textures" : resource.isInstancedMesh ? "instances" : null;
    if (kind) resource.addEventListener("dispose", () => disposal[kind]++);
  };
  class Loader {
    setCrossOrigin() { return this; }
    load(url, success, progress, error) {
      const texture = new THREE.Texture({ src: url, width: 512, height: 512 });
      track(texture);
      loads.push({ url, success, error, texture });
      return texture;
    }
  }
  class WebGLRenderer {
    shadowMap = {};
    capabilities = { maxTextureSize: 4096, getMaxAnisotropy: () => 16 };
    setPixelRatio(value) { events.push(["pixelRatio", value]); }
    setSize(width, height) { events.push(["rendererSize", width, height]); }
    dispose() { events.push(["rendererDispose"]); }
    forceContextLoss() { events.push(["contextLoss"]); }
  }
  class Pass { constructor(...args) { this.args = args; } dispose() { events.push([this.constructor.name, "dispose"]); } }
  class EffectComposer {
    passes = [];
    addPass(pass) { this.passes.push(pass); }
    setPixelRatio(value) { events.push(["composerRatio", value]); }
    setSize(width, height) { events.push(["composerSize", width, height]); }
    render(delta) { events.push(["render", delta]); }
    dispose() { events.push(["composerDispose"]); }
  }
  class RenderPass extends Pass { constructor(value, camera) { super(); scene = value; this.camera = camera; } }
  class UnrealBloomPass extends Pass {}
  class FXAAPass extends Pass {}
  class OutputPass extends Pass {}
  class RoomEnvironment extends THREE.Group {}
  class PMREMGenerator {
    fromScene() { const texture = new THREE.Texture(); track(texture); return { texture }; }
    dispose() {}
  }
  const replacements = { EffectComposer, RenderPass, UnrealBloomPass, FXAAPass, OutputPass, RoomEnvironment };
  const nativeRequire = createRequire(file);
  const requireModule = (name) => {
    if (name === "three") return { ...THREE, WebGLRenderer, PMREMGenerator, TextureLoader: Loader, ImageLoader: Loader };
    const replacement = replacements[path.basename(name, ".js")];
    return replacement ? { [path.basename(name, ".js")]: replacement } : nativeRequire(name);
  };
  const module = { exports: {} };
  const math = Object.create(Math);
  math.random = random;
  Object.assign(environment.context, { module, exports: module.exports, require: requireModule, Math: math });
  environment.context.window.devicePixelRatio = 1.75;
  const output = esbuild.buildSync({ entryPoints: [file], bundle: true, write: false, platform: "node", format: "cjs", packages: "external" }).outputFiles[0].text;
  vm.runInContext(output, environment.context);
  const canvas = {
    getBoundingClientRect: () => ({ width: 540, height: 960 }),
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name) { listeners.delete(name); }
  };
  const renderer = module.exports.createCoinPusher3dRenderer(canvas);
  function snapshot() {
    const resources = { geometries: [], materials: [], textures: [] };
    const indices = new Map();
    function resource(value) {
      if (!value) return null;
      track(value);
      if (indices.has(value)) return indices.get(value);
      const kind = value.isBufferGeometry ? "geometries" : value.isMaterial ? "materials" : "textures";
      const id = `${kind}:${resources[kind].length}`;
      indices.set(value, id);
      resources[kind].push(null);
      if (kind === "geometries") resources[kind][Number(id.split(":")[1])] = {
        type: value.type,
        attributes: hash(Object.fromEntries(Object.entries(value.attributes).map(([key, attribute]) => [key, [attribute.itemSize, Array.from(attribute.array)]]))),
        index: hash(value.index ? Array.from(value.index.array) : null), drawRange: value.drawRange
      };
      else if (kind === "materials") resources[kind][Number(id.split(":")[1])] = Object.fromEntries(Object.entries(value).filter(([key, entry]) => !["id", "uuid", "version", "_listeners", "userData"].includes(key) && (entry === null || typeof entry !== "object" || entry.isColor || entry.isTexture)).map(([key, entry]) => [key, entry?.isColor ? entry.toArray() : entry?.isTexture ? resource(entry) : entry]));
      else resources[kind][Number(id.split(":")[1])] = {
        image: value.image ? { src: value.image.src, width: value.image.width, height: value.image.height } : null,
        colorSpace: value.colorSpace, anisotropy: value.anisotropy, flipY: value.flipY,
        minFilter: value.minFilter, magFilter: value.magFilter, generateMipmaps: value.generateMipmaps
      };
      return id;
    }
    function object(value) {
      track(value);
      return {
        type: value.type, position: value.position.toArray(), quaternion: value.quaternion.toArray(), scale: value.scale.toArray(), visible: value.visible,
        renderOrder: value.renderOrder, castShadow: value.castShadow, receiveShadow: value.receiveShadow,
        geometry: resource(value.geometry), material: Array.isArray(value.material) ? value.material.map(resource) : resource(value.material),
        count: value.count, instanceMatrix: value.instanceMatrix ? hash(Array.from(value.instanceMatrix.array)) : null,
        instanceColor: value.instanceColor ? hash(Array.from(value.instanceColor.array)) : null,
        intensity: value.intensity, color: value.color?.toArray(), children: value.children.map(object)
      };
    }
    const tree = object(scene);
    return { tree: hash(tree), resources: hash(resources), counts: Object.fromEntries(Object.entries(resources).map(([key, value]) => [key, value.length])), canvas: hash(environment.trace), events: [...events] };
  }
  return { renderer, snapshot, loads, disposal, events, listeners, scene, trace: environment.trace };
}

function sampleFrame(time, machineTheme = "arcade") {
  return {
    coins: ["plinko", "pusher", "settling", "shelf", "falling"].flatMap((phase, index) => ["coin", "mystery", "ticket"].map((kind, item) => ({
      avatarUrl: "", dropProgress: .35, faceAngle: .15, id: `${phase}-${kind}`, kind, name: `Viewer ${item}`, phase,
      radius: 18, rotation: .25 + index / 7, specialValue: 250, stackHeight: index / 10, viewerId: `viewer-${item}`, x: 160 + index * 30, y: 480 + index * 25
    }))),
    floatingScores: [{ id: 1, life: .75, text: "+250", color: "#39efff", x: 220, y: 610 }],
    particles: [{ life: .75, maxLife: 1, color: "#f9cb62", x: 200, y: 500 }],
    machineTheme, platformImageUrl: "", plinkoImageUrl: "", pusherPower: .6, pusherY: 620,
    roundPhase: "playing", scoreSlots: [10, 50, 100, 250, 100, 50, 10], scoreMultiplier: 1.5, sideGuardProgress: .5, sideLossEnabled: true, time
  };
}

/** Capture avant/après des scènes arcade et galactique, des caches et de la libération GPU. */
function traceSceneLifecycle() {
  const harness = createSceneHarness();
  const results = { initial: harness.snapshot() };
  harness.renderer.render(sampleFrame(.016));
  results.arcade = harness.snapshot();
  harness.renderer.giftBurst(120);
  harness.renderer.scoreBurst(250, 100);
  harness.renderer.render(sampleFrame(.032, "galactic-palace"));
  results.galactic = harness.snapshot();
  harness.renderer.render({ ...sampleFrame(.048, "galactic-palace"), coins: [], particles: [], floatingScores: [], roundPhase: "finished" });
  results.empty = harness.snapshot();
  harness.renderer.dispose();
  harness.renderer.dispose();
  results.disposal = { ...harness.disposal, events: harness.events, listeners: harness.listeners.size, children: harness.scene.children.length };
  return results;
}

module.exports = { createSceneHarness, sampleFrame, traceSceneLifecycle };
