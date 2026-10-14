"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const catalog = require("../resources/overlays/overlay-catalog");
const root = path.resolve(__dirname, "../resources/overlays");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const account = "123456789012", channel = "studio_fixture_public_capability";
const route = `/m/${account}/${channel}`, now = Date.UTC(2026, 9, 14, 14);
const fresh = () => ({ matchSource: { accountNumber: account, enabled: true, localPort: 17654, localEntryVersion: 1 },
  presence: { connected: true, updatedAt: new Date(now).toISOString() } });

/** Exécute la vraie entrée sans navigation, réseau, application ou compte réel. */
async function entry({ value = fresh(), search = "?transport=local", pathname = route,
  protocol = "https:", embedded = false, bootstrapChannel = channel, bootstrap = true } = {}) {
  const navigation = [], nodes = [], timers = new Map();
  let timerId = 0;
  const window = {}; window.top = embedded ? {} : window; window.self = window;
  const context = { window, URL, URLSearchParams, Promise, Date: class extends Date { static now() { return now; } },
    location: { pathname, search, protocol, replace: (url) => navigation.push(url) },
    document: { body: { appendChild: (node) => nodes.push(node) },
      documentElement: { dataset: {}, classList: { remove: () => {} } },
      createElement: () => ({ style: {}, setAttribute: () => {} }) },
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout: (id) => timers.delete(id),
    ...(bootstrap ? { shenPulseRelayBootstrap: { channel: bootstrapChannel, request: Promise.resolve(value), cachedDocument: fresh() } } : {}) };
  vm.createContext(context);
  vm.runInContext(read("runtime/match-local-entry.js"), context);
  await context.shenPulseMatchLocalEntry?.ready;
  return { navigation, nodes, timers, context, state: context.shenPulseMatchLocalEntry };
}

test("Studio conserve une entrée HTTPS puis navigue explicitement vers le lecteur local protégé", async () => {
  const result = await entry();
  assert.deepEqual(result.navigation, [`http://127.0.0.1:17654/match-bridge/${account}/${channel}`]);
  assert.equal(result.state.status, "navigating");
  assert.equal(result.state.navigating, true);
  assert.equal(result.timers.size, 0);
  assert.equal(result.nodes.length, 0);
});

test("les navigateurs, widgets, aperçus et iframes existants ne sont pas redirigés silencieusement", async () => {
  for (const options of [{ search: "" }, { search: "?transport=remote" },
    { search: "?transport=local&transport=local" }, { search: "?transport=local&widget=wins" },
    { search: "?transport=local&preview=animated" }, { search: "?transport=local&embedded=scene" },
    { embedded: true }, { protocol: "http:" }, { pathname: "/m/123/invalid" }]) {
    const result = await entry(options);
    assert.deepEqual(result.navigation, []);
    assert.equal(result.state, undefined);
    assert.equal(result.timers.size, 0);
  }
});

test("présence périmée, accès refusé ou port injecté n'autorisent aucune navigation", async () => {
  for (const changes of [
    (value) => { value.matchSource.enabled = false; },
    (value) => { value.matchSource.accountNumber = "999999999999"; },
    (value) => { value.presence.connected = false; },
    (value) => { value.presence.updatedAt = new Date(now - 120001).toISOString(); },
    (value) => { value.presence.updatedAt = new Date(now + 60001).toISOString(); },
    (value) => { value.presence.updatedAt = "invalid"; },
    (value) => { value.matchSource.localPort = "17654/other"; },
    (value) => { value.matchSource.localPort = 0; },
    (value) => { value.matchSource.localPort = 65536; }
  ]) {
    const value = fresh(); changes(value);
    const result = await entry({ value });
    assert.deepEqual(result.navigation, []);
    assert.equal(result.state.status, "unavailable");
    assert.equal(result.nodes.length, 1);
    assert.equal(result.timers.size, 0);
  }
});

test("ni le cache ni une ancienne version de ShenPulse n'autorisent le lecteur local", async () => {
  for (const options of [{ value: null }, { bootstrap: false }, { bootstrapChannel: "wrong-channel" }]) {
    const result = await entry(options);
    assert.deepEqual(result.navigation, []);
    assert.equal(result.state.status, "unavailable");
  }
  const value = fresh(); delete value.matchSource.localEntryVersion;
  const result = await entry({ value });
  assert.equal(result.state.status, "update-required");
  assert.match(result.nodes[0].textContent, /Mettez ShenPulse à jour/);
  assert.deepEqual(result.navigation, []);
});

test("le chargeur attend l'entrée Studio et ne démarre pas un second transport public", async () => {
  const appended = [];
  const context = { URLSearchParams, location: { search: "?transport=local", pathname: route },
    document: { body: { appendChild: (node) => appended.push(node) } },
    shenPulseMatchLocalEntry: { ready: Promise.resolve(false) } };
  vm.createContext(context);
  await vm.runInContext(read("runtime/loader.js"), context);
  assert.deepEqual(appended, []);
  assert.equal(context.shenPulseOverlayPerformance, undefined);
});

test("le document local devient un player même origine sans alias Firebase ni jeton partagé", (t) => {
  const dom = new JSDOM('<section id="match-view"></section>', {
    url: `http://127.0.0.1:17654/match-bridge/${account}/${channel}`, runScripts: "outside-only" });
  t.after(() => dom.window.close());
  dom.window.ShenPulseOverlayCatalog = catalog;
  dom.window.LikeGoalPolicy = { normalizeBehavior: () => "stay" };
  dom.window.configureNativeOverlayCanvas = () => {};
  dom.window.configureLikeGoalViewport = () => {};
  dom.window.overlayFontStack = () => "sans-serif";
  const context = dom.getInternalVMContext();
  vm.runInContext(read("runtime/configuration.js"), context);
  assert.equal(vm.runInContext("viewName", context), "match");
  assert.equal(vm.runInContext("matchName", context), "player");
  assert.equal(vm.runInContext("matchSourceBasePath", context), `/match-bridge/${account}/${channel}`);
  assert.equal(vm.runInContext("relayChannel", context), "");
  assert.equal(vm.runInContext("token", context), "");
  assert.equal(vm.runInContext("isPublicMatchSource", context), false);
});
