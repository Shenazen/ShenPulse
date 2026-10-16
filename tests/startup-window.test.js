"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const { pathToFileURL } = require("node:url");
const { createStartupWindow } = require("../src/main/bootstrap/startup-window");

function fixture() {
  let time = 0, sequence = 0, window;
  const timers = new Map(), calls = [];
  class FakeWindow extends EventEmitter {
    constructor(options) {
      super(); window = this; this.options = options; this.destroyed = false;
      this.webContents = new EventEmitter();
      this.webContents.session = {
        setPermissionCheckHandler: (callback) => { this.permissions = callback; },
        setPermissionRequestHandler: (callback) => { this.permissionRequest = callback; },
        webRequest: { onBeforeRequest: (callback) => { this.request = callback; } }
      };
      this.webContents.setWindowOpenHandler = (callback) => { this.openWindow = callback; };
    }
    loadFile(filename) { this.filename = filename; return Promise.resolve(); }
    isDestroyed() { return this.destroyed; }
    show() { calls.push("splash:show"); }
    focus() { calls.push("splash:focus"); }
    destroy() { if (this.destroyed) return; this.destroyed = true; calls.push("splash:destroy"); this.emit("closed"); }
  }
  const controller = createStartupWindow({ BrowserWindow: FakeWindow,
    splashPath: path.resolve(__dirname, "../src/renderer/splash.html"),
    onReady: () => calls.push("main:show"), onCancel: () => calls.push("app:quit"),
    onFailure: (error) => calls.push(["startup:failed", error.message]), now: () => time,
    schedule: (callback, delay) => { const id = ++sequence; timers.set(id, { callback, at: time + delay }); return id; },
    cancel: (id) => timers.delete(id)
  });
  function advance(milliseconds) {
    const end = time + milliseconds;
    for (;;) {
      const next = [...timers].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      time = next[1].at; timers.delete(next[0]); next[1].callback();
    }
    time = end;
  }
  return { controller, window, calls, timers, advance };
}

test("la principale attend cinq secondes réellement visibles même si son premier rendu est déjà prêt", () => {
  const f = fixture();
  assert.equal(f.controller.ready(), true);
  f.advance(1500);
  assert.equal(f.controller.released, false);
  f.window.emit("ready-to-show");
  f.advance(4999); assert.deepEqual(f.calls, ["splash:show"]);
  f.advance(1); assert.equal(f.controller.released, true);
  assert.deepEqual(f.calls, ["splash:show", "main:show", "splash:destroy"]);
  assert.equal(f.controller.ready(), false);
  assert.equal(f.timers.size, 0);
});

test("un renderer lent n'est jamais montré sur le seul ready-to-show natif", () => {
  const f = fixture(); f.window.emit("ready-to-show"); f.advance(8000);
  assert.deepEqual(f.calls, ["splash:show"]);
  f.controller.ready();
  assert.deepEqual(f.calls, ["splash:show", "main:show", "splash:destroy"]);
});

test("la seconde instance ne peut pas contourner l'introduction ni montrer une fenêtre non prête", () => {
  const f = fixture(); assert.equal(f.controller.focus(), true);
  assert.deepEqual(f.calls, []);
  f.window.emit("ready-to-show"); f.controller.focus();
  assert.deepEqual(f.calls, ["splash:show", "splash:focus"]);
  f.controller.ready(); f.advance(5000);
  assert.equal(f.controller.focus(), false);
});

test("fermer l'introduction annule proprement tous les délais sans relancer le main", () => {
  const f = fixture(); f.window.emit("ready-to-show"); f.window.emit("close"); f.window.destroy();
  f.advance(30000); f.controller.ready(); f.controller.dispose();
  assert.deepEqual(f.calls, ["splash:show", "app:quit", "splash:destroy"]);
  assert.equal(f.timers.size, 0);
});

test("une panne du splash abandonne seulement l'attente décorative, jamais la préparation du main", () => {
  const f = fixture();
  f.window.webContents.emit("did-fail-load", {}, -6, "missing", "file:///fixture", true);
  assert.deepEqual(f.calls, ["splash:destroy"]);
  assert.equal(f.controller.released, false);
  f.controller.ready();
  assert.deepEqual(f.calls, ["splash:destroy", "main:show"]);
  assert.equal(f.timers.size, 0);
});

test("le délai maximal et les erreurs fatales ne laissent jamais une introduction infinie", () => {
  for (const mode of ["timeout", "fatal"]) {
    const f = fixture(); f.window.emit("ready-to-show");
    if (mode === "timeout") f.advance(20000);
    else f.controller.fail(new Error("Erreur synthétique"));
    assert.equal(f.window.isDestroyed(), true);
    assert.equal(f.controller.released, false);
    assert.equal(f.calls.filter((call) => Array.isArray(call) && call[0] === "startup:failed").length, 1);
    assert.equal(f.calls.includes("main:show"), false);
    assert.equal(f.controller.ready(), false);
    assert.equal(f.timers.size, 0);
  }
});

test("le nettoyage anticipé libère les délais sans simuler une annulation utilisateur", () => {
  const f = fixture(); f.controller.dispose(); f.controller.dispose(); f.advance(30000);
  assert.deepEqual(f.calls, ["splash:destroy"]);
  assert.equal(f.timers.size, 0);
});

test("la fenêtre du splash n'expose aucun JavaScript, preload, permission ou réseau externe", () => {
  const f = fixture(), preferences = f.window.options.webPreferences;
  assert.equal(f.window.options.width, 760); assert.equal(f.window.options.height, 480);
  assert.equal(preferences.preload, undefined); assert.equal(preferences.nodeIntegration, false);
  assert.equal(preferences.javascript, false); assert.equal(preferences.sandbox, true);
  assert.equal(preferences.contextIsolation, true); assert.equal(preferences.webSecurity, true);
  assert.equal(preferences.partition.startsWith("persist:"), false);
  assert.equal(f.window.permissions(), false);
  f.window.permissionRequest(null, "media", (allowed) => assert.equal(allowed, false));
  assert.equal(f.window.openWindow({ url: "https://example.test" }).action, "deny");
  const renderer = path.dirname(f.window.filename);
  for (const [url, allowed] of [
    [pathToFileURL(f.window.filename).href, true],
    ...(process.platform === "win32" ? [[pathToFileURL(f.window.filename).href.toLowerCase().replace("splash.html", "SPLASH.HTML"), true]] : []),
    [pathToFileURL(path.join(renderer, "styles/startup-splash.css")).href, true],
    [pathToFileURL(path.join(renderer, "assets/brand/shenpulse-banner-transparent.png")).href, true],
    [pathToFileURL(path.join(renderer, "app.js")).href, false],
    [pathToFileURL(path.join(renderer, "../main/preload.js")).href, false],
    ["https://example.test/logo.png", false], ["http://127.0.0.1:17654/overlay/", false],
    ["data:text/html,private", false]
  ]) f.window.request({ url }, (result) => assert.equal(result.cancel, !allowed, url));
  let prevented = false;
  f.window.webContents.emit("will-navigate", { preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  f.controller.dispose();
});

test("le preload n'envoie aucune identité ni charge utile avec startupReady", () => {
  let api; const calls = [];
  const filename = path.resolve(__dirname, "../src/main/preload.js");
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), { require: () => ({
    contextBridge: { exposeInMainWorld: (_name, value) => { api = value; } },
    ipcRenderer: { invoke: (...args) => { calls.push(args); } }
  }) });
  api.startupReady({ authenticated: true, fixture: "ne-pas-transmettre" });
  assert.equal(calls.length, 1); assert.equal(calls[0].length, 1);
  assert.equal(calls[0][0], "startup:ready");
});

test("le diffuseur réel main n'envoie aucun snapshot ou événement privé au splash", () => {
  const file = path.resolve(__dirname, "../src/main/main.js"), source = fs.readFileSync(file, "utf8");
  const sent = [], window = (name) => ({ isDestroyed: () => false,
    webContents: { isDestroyed: () => false, send: (...args) => sent.push({ name, args }) } });
  const splash = window("splash"), main = window("main"), game = window("game");
  const context = vm.createContext({ BrowserWindow: { getAllWindows: () => [splash, main, game] },
    accountService: null, startupWindow: { ownsWindow: (item) => item === splash } });
  vm.runInContext(source.slice(source.indexOf("function notifyRenderer("), source.indexOf("async function bootstrap(")), context);
  for (const channel of ["state-changed", "live-event", "playback"]) context.notifyRenderer(channel, { synthetic: true });
  assert.equal(sent.length, 6);
  assert.ok(sent.every((entry) => entry.name !== "splash"));
});
