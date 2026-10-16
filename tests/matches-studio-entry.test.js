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
  protocol = "https:", embedded = false, bootstrapChannel = channel, bootstrap = true,
  streaming = false, bootstrapRequest, waitForReady = true } = {}) {
  const navigation = [], nodes = [], timers = new Map(), streams = [], windowListeners = new Map();
  let timerId = 0;
  const window = {}; window.top = embedded ? {} : window; window.self = window;
  window.addEventListener = (name, listener) => windowListeners.set(name, listener);
  const context = { window, URL, URLSearchParams, Promise, Date: class extends Date { static now() { return now; } },
    location: { pathname, search, protocol, replace: (url) => navigation.push(url) },
    document: { body: { appendChild: (node) => nodes.push(node) },
      documentElement: { dataset: {}, classList: { remove: () => {} } },
      createElement: () => ({ style: {}, setAttribute: () => {} }) },
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout: (id) => timers.delete(id),
    ...(streaming ? { EventSource: class {
      constructor(url) { this.url = url; this.closed = false; this.listeners = new Map(); streams.push(this); }
      addEventListener(name, listener) { this.listeners.set(name, listener); }
      close() { this.closed = true; }
      emit(name, value, raw = false) { this.listeners.get(name)?.({ data: raw ? value : JSON.stringify(value) }); }
    } } : {}),
    ...(bootstrap ? { shenPulseRelayBootstrap: { channel: bootstrapChannel,
      request: bootstrapRequest || Promise.resolve(value), cachedDocument: fresh() } } : {}) };
  vm.createContext(context);
  vm.runInContext(read("runtime/match-local-entry.js"), context);
  if (waitForReady) await context.shenPulseMatchLocalEntry?.ready;
  return { navigation, nodes, timers, streams, windowListeners, context, state: context.shenPulseMatchLocalEntry };
}

test("l'entrée HTTPS ouverte avant ShenPulse reprend sur une présence fraîche sans actualiser", async () => {
  const offline = fresh(); offline.presence.connected = false;
  const result = await entry({ value: offline, streaming: true });
  assert.deepEqual(result.navigation, []);
  assert.equal(result.streams.length, 1, "un seul flux Firebase doit attendre le démarrage de ShenPulse");
  result.streams[0].emit("put", { path: "/", data: offline });
  assert.deepEqual(result.navigation, [], "le cache ou une présence hors ligne n'autorise rien");
  result.streams[0].emit("patch", { path: "/presence", data: fresh().presence });
  assert.deepEqual(result.navigation, [`http://127.0.0.1:17654/match-bridge/${account}/${channel}`]);
  assert.equal(result.streams[0].closed, true, "aucun flux Firebase supplémentaire après navigation locale");
});

test("une panne de la lecture initiale ne transforme jamais le cache en autorisation", async () => {
  for (const bootstrapRequest of [Promise.resolve(null), Promise.reject(new Error("réseau indisponible"))]) {
    const result = await entry({ bootstrapRequest, streaming: true });
    assert.deepEqual(result.navigation, [], "le cachedDocument pourtant valide n'est pas utilisé");
    assert.equal(result.streams.length, 1);
    assert.match(result.streams[0].url, /\.firebaseio\.com\/publicOverlayRelay\/studio_fixture_public_capability\.json$/);
    result.streams[0].emit("put", { path: "/", data: fresh() });
    assert.equal(result.navigation.length, 1);
    result.streams[0].emit("put", { path: "/", data: fresh() });
    assert.equal(result.navigation.length, 1, "une seule navigation malgré les trames déjà en attente");
    assert.equal(result.timers.size, 0, "aucune boucle de scrutation HTTP");
  }
});

test("une présence périmée attend sa vraie mise à jour sans accumuler les messages d'état", async () => {
  const stale = fresh(); stale.presence.updatedAt = new Date(now - 120001).toISOString();
  const result = await entry({ value: stale, streaming: true }), stream = result.streams[0];
  stream.emit("put", { path: "/", data: stale });
  stream.emit("patch", { path: "/presence", data: { updatedAt: "invalid" } });
  assert.equal(result.navigation.length, 0); assert.equal(result.nodes.length, 1);
  stream.emit("patch", { path: "/", data: { "presence/updatedAt": fresh().presence.updatedAt } });
  assert.equal(result.navigation.length, 1); assert.equal(stream.closed, true);
});

test("le délai initial borné reprend par SSE et une réponse GET tardive ne rétablit pas un accès supprimé", async () => {
  let resolveRequest;
  const bootstrapRequest = new Promise((resolve) => { resolveRequest = resolve; });
  const result = await entry({ bootstrapRequest, streaming: true, waitForReady: false });
  const [timerId, timeout] = [...result.timers][0];
  assert.equal(timeout.delay, 6000); result.timers.delete(timerId); timeout.callback();
  await result.state.ready;
  assert.equal(result.streams.length, 1); assert.equal(result.navigation.length, 0);
  result.streams[0].emit("put", { path: "/", data: null });
  assert.equal(result.streams[0].closed, true);
  resolveRequest(fresh()); await Promise.resolve(); await Promise.resolve();
  assert.equal(result.navigation.length, 0, "une ancienne preuve ne remplace jamais la suppression fraîche de l'alias");
});

test("la suppression, révocation Pro, mauvaise identité ou mauvaise version arrêtent toute reprise", async () => {
  for (const mutate of [
    () => null,
    (value) => { value.matchSource.enabled = false; return value; },
    (value) => { value.matchSource.accountNumber = "999999999999"; return value; },
    (value) => { value.matchSource.localEntryVersion = 0; return value; },
    (value) => { value.matchSource.localPort = "17654/hostile"; return value; }
  ]) {
    const result = await entry({ value: null, streaming: true }), stream = result.streams[0];
    stream.emit("put", { path: "/", data: mutate(fresh()) });
    assert.equal(stream.closed, true); assert.equal(result.navigation.length, 0);
    stream.emit("put", { path: "/", data: fresh() });
    assert.equal(result.navigation.length, 0, "une révocation ne peut pas être annulée par un callback tardif");
    assert.equal(result.streams.length, 1); assert.equal(result.timers.size, 0);
  }
});

test("une suppression par PATCH n'est jamais fusionnée avec les anciennes autorisations", async () => {
  for (const patch of [{ matchSource: null, presence: fresh().presence },
    { "matchSource/enabled": false, presence: fresh().presence }]) {
    const offline = fresh(); offline.presence.connected = false;
    const result = await entry({ value: offline, streaming: true }), stream = result.streams[0];
    stream.emit("put", { path: "/", data: offline });
    stream.emit("patch", { path: "/", data: patch });
    assert.equal(result.navigation.length, 0); assert.equal(stream.closed, true);
  }
});

test("une coupure SSE efface sa preuve et exige un nouveau document complet après reconnexion", async () => {
  const offline = fresh(); offline.presence.connected = false;
  const result = await entry({ value: offline, streaming: true }), stream = result.streams[0];
  stream.emit("put", { path: "/", data: offline }); stream.emit("error", {});
  assert.equal(stream.closed, false, "EventSource assure lui-même la reconnexion, sans deuxième abonnement");
  stream.emit("patch", { path: "/presence", data: fresh().presence });
  assert.equal(result.navigation.length, 0, "la présence seule ne ressuscite pas une ancienne autorisation");
  stream.emit("put", { path: "/", data: fresh() });
  assert.equal(result.navigation.length, 1); assert.equal(result.streams.length, 1);
});

test("cancel, auth_revoked et pagehide ferment le flux et ignorent tous les callbacks suivants", async () => {
  for (const event of ["cancel", "auth_revoked", "pagehide"]) {
    const result = await entry({ value: null, streaming: true }), stream = result.streams[0];
    if (event === "pagehide") result.windowListeners.get(event)();
    else stream.emit(event, {});
    assert.equal(stream.closed, true);
    stream.emit("put", { path: "/", data: fresh() }); assert.equal(result.navigation.length, 0);
    assert.equal(result.timers.size, 0); assert.equal(result.streams.length, 1);
  }
});

test("quitter l'entrée pendant le premier GET annule aussi son délai sans démarrer un flux tardif", async () => {
  const result = await entry({ bootstrapRequest: new Promise(() => {}), streaming: true, waitForReady: false });
  assert.equal(result.timers.size, 1); result.windowListeners.get("pagehide")();
  await result.state.ready;
  assert.equal(result.timers.size, 0); assert.equal(result.streams.length, 0); assert.equal(result.navigation.length, 0);
});

test("un document immédiatement autorisé n'ajoute aucun abonnement distant", async () => {
  const result = await entry({ streaming: true });
  assert.equal(result.navigation.length, 1); assert.equal(result.streams.length, 0);
  assert.equal(result.timers.size, 0);
});

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
