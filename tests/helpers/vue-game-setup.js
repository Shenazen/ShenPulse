"use strict";

/** Exécute le véritable script setup Vue, ses imports et ses hooks, sans navigateur. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const esbuild = require("esbuild");
const { parse } = require("@vue/compiler-sfc");
const { createEnvironment } = require("./game-overlay-trace");

async function loadVueGameSetup(name, exposed) {
  const file = path.resolve(__dirname, `../../src/renderer/games/original-src/components/games/${name}.vue`);
  const descriptor = parse(fs.readFileSync(file, "utf8"), { filename: file }).descriptor;
  const output = await esbuild.build({
    stdin: {
      contents: `${descriptor.scriptSetup.content}\nexport const game = { ${exposed.join(",")} }`,
      sourcefile: file, resolveDir: path.dirname(file), loader: "ts"
    },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{
      name: "assets-sans-decoder",
      setup(build) {
        build.onResolve({ filter: /\.(png|mp3)\?url$/ }, ({ path: asset }) => ({ path: asset, namespace: "test-assets" }));
        build.onLoad({ filter: /.*/, namespace: "test-assets" }, ({ path: asset }) => ({ contents: `export default ${JSON.stringify(`https://assets.test/${asset.split("/").pop().replace("?url", "")}`)}` }));
      }
    }]
  });
  const environment = createEnvironment();
  const localRequire = createRequire(file);
  const vue = localRequire("vue");
  const scope = vue.effectScope();
  const mounted = [], unmounted = [], timers = new Map(), frames = new Map(), listeners = new Map(), storage = new Map();
  let id = 0, now = 100_000;
  const module = { exports: {} };
  const schedule = (callback, delay) => {
    const next = ++id;
    timers.set(next, { callback, at: now + Number(delay || 0) });
    return next;
  };
  const window = environment.context.window;
  Object.assign(window, {
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    location: { search: "", hostname: "localhost" },
    setTimeout: schedule, clearTimeout: (key) => timers.delete(key),
    requestAnimationFrame: (callback) => { const next = ++id; frames.set(next, callback); return next; },
    cancelAnimationFrame: (key) => frames.delete(key),
    addEventListener: (name, callback) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
    },
    removeEventListener: (name, callback) => {
      listeners.get(name)?.delete(callback);
      if (!listeners.get(name)?.size) listeners.delete(name);
    },
    dispatchEvent: (event) => { for (const callback of listeners.get(event.type) || []) callback(event); }
  });
  Object.assign(environment.context, {
    module, exports: module.exports, URLSearchParams,
    performance: { now: () => now },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    require: (name) => {
      if (name === "vue") return { ...vue, onMounted: (callback) => mounted.push(callback), onBeforeUnmount: (callback) => unmounted.push(callback) };
      if (name === "vue-i18n") return { useI18n: () => ({ t: (key) => key, locale: vue.ref("fr") }) };
      return localRequire(name);
    }
  });
  scope.run(() => vm.runInContext(output.outputFiles[0].text, environment.context, { filename: file }));
  return {
    ...environment, game: module.exports.game, timers, frames, listeners, storage,
    mount() { for (const callback of mounted) callback(); },
    dispose() { for (const callback of unmounted) callback(); scope.stop(); },
    async flushFrames() {
      const pending = [...frames.values()]; frames.clear();
      for (const callback of pending) callback(now);
      await vue.nextTick();
    },
    async tick() { await vue.nextTick(); },
    advance(milliseconds) {
      const target = now + milliseconds;
      let executions = 0;
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) break;
        if (++executions > 10_000) throw new Error("Boucle de minuteurs inattendue");
        const [key, timer] = next; timers.delete(key); now = timer.at; timer.callback();
      }
      now = target;
    }
  };
}

module.exports = { loadVueGameSetup };
