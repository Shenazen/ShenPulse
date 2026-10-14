"use strict";

// Rejeu en lecture seule : état de test par défaut, ou fichier fourni lu une seule fois.
// Aucune sauvegarde, connexion de plateforme ou action réelle ; HTTP entièrement simulé.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { performance } = require("node:perf_hooks");

const root = path.resolve(__dirname, "..");
const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const archive = option("baseline-asar");
const stateFile = option("state-file");
const asar = archive ? require("@electron/asar") : null;
const modules = new Map();
function load(relativePath) {
  if (!archive) return require(path.join(root, relativePath));
  let name = path.normalize(relativePath);
  if (!path.extname(name)) name += ".js";
  if (modules.has(name)) return modules.get(name).exports;
  const localPath = path.join(root, name);
  const nativeRequire = createRequire(localPath);
  const module = { exports: {} };
  modules.set(name, module);
  const code = asar.extractFile(path.resolve(archive), name).toString("utf8");
  if (name.endsWith(".json")) {
    module.exports = JSON.parse(code);
    return module.exports;
  }
  const requireBundle = (request) => request.startsWith(".")
    ? load(path.join(path.dirname(name), request)) : nativeRequire(request);
  const execute = vm.runInThisContext(`(function(require,module,exports,__dirname,__filename){${code}\n})`, { filename: localPath });
  execute(requireBundle, module, module.exports, path.dirname(localPath), localPath);
  return module.exports;
}

async function main() {
  const { StateStore } = load("src/main/store.js");
  const { ShenPulseCore } = load("src/main/core.js");
  const store = new StateStore(path.join(os.tmpdir(), "shenpulse-readonly-benchmark"));
  if (stateFile) store.state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  store.touch = () => {}; // Désactive toute persistance, sauvegardes comprises.
  store.state.rules = [];
  store.state.commands = [];
  store.state.session.game.running = false;
  const notifications = [];
  const core = new ShenPulseCore({ store, resourcesDirectory: path.join(root, "resources"),
    notifyRenderer: (channel) => notifications.push(channel) });
  const relay = core.publicOverlayRelay;
  const requests = [];
  relay.fetch = async (url, options = {}) => {
    requests.push({ method: options.method, bytes: Buffer.byteLength(options.body || "") });
    return { ok: true, status: 200, json: async () => ({}), text: async () => "{}" };
  };
  relay.running = true;
  relay.connected = true;
  relay.idToken = "synthetic-no-network-token";
  relay.tokenExpiresAt = Date.now() + 3600000;
  let clones = 0;
  let cloneMs = 0;
  let projections = 0;
  const getState = store.getState.bind(store);
  store.getState = () => {
    clones += 1;
    const start = performance.now();
    const result = getState();
    cloneMs += performance.now() - start;
    return result;
  };
  if (store.getStateProjection) {
    const project = store.getStateProjection.bind(store);
    store.getStateProjection = (...args) => { projections += 1; return project(...args); };
  }
  const start = performance.now();
  for (let index = 0; index < 100; index += 1) {
    await core.ingest({ id: `readonly-bench-${index}`, timestamp: new Date().toISOString(),
      type: "chat", source: "test", user: { id: "benchmark-viewer", displayName: "Benchmark" },
      data: { message: `benchmark ${index}` } });
  }
  const ingestionMs = performance.now() - start;
  await new Promise((resolve) => setTimeout(resolve, 300));
  const result = { version: archive ? "packaged-before" : "source-after", events: 100,
    ingestionMs: Number(ingestionMs.toFixed(2)), fullStateClones: clones,
    fullStateCloneMs: Number(cloneMs.toFixed(2)), targetedProjections: projections,
    patchRequests: requests.filter((request) => request.method === "PATCH").length,
    patchPayloadBytes: requests.filter((request) => request.method === "PATCH")
      .reduce((total, request) => total + request.bytes, 0),
    runtimeNotifications: notifications.filter((channel) => channel === "runtime-state-changed").length };
  clearTimeout(core.deferredChangeTimer);
  await relay.stop();
  console.log(JSON.stringify(result));
}

main().catch((error) => { console.error(error.stack); process.exitCode = 1; });
