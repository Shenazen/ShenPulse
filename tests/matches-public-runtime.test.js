"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const catalog = require("../resources/overlays/overlay-catalog");

const directory = path.join(__dirname, "../resources/overlays");
const accountNumber = "123456789012";
const channel = "match_public_fixture_channel";
const route = `/m/${accountNumber}/${channel}`;
const widgets = ["wins", "starDonor", "topDonor", "donors", "timer", "victory", "scoreboard"];
const source = (file) => fs.readFileSync(path.join(directory, file), "utf8");

/** Exécute le vrai routage et le vrai widget, sans réseau ni effet LIVE. */
function runtime(t, { pathname = route, search = "?widget=wins", bootstrap } = {}) {
  const dom = new JSDOM('<section id="alerts-view"></section><section id="match-view"></section><section id="match-widget-view"><div id="match-widget-stage" hidden></div></section>', {
    url: `https://shenpulse-overlays.web.app${pathname}${search}`, runScripts: "outside-only"
  });
  t.after(async () => {
    await new Promise((resolve) => setImmediate(resolve));
    dom.window.close();
  });
  const window = dom.window;
  let nowMs = Date.UTC(2026, 9, 14, 10);
  let timerId = 0;
  const timeouts = new Map();
  const intervals = new Map();
  const sources = [];
  window.Date.now = () => nowMs;
  window.setTimeout = (callback, delay = 0) => {
    const id = ++timerId; timeouts.set(id, { callback, at: nowMs + Number(delay) }); return id;
  };
  window.clearTimeout = (id) => timeouts.delete(id);
  window.setInterval = (callback, delay) => {
    const id = ++timerId; intervals.set(id, { callback, delay }); return id;
  };
  window.clearInterval = (id) => intervals.delete(id);
  window.requestAnimationFrame = (callback) => callback(nowMs);
  window.ShenPulseOverlayCatalog = catalog;
  window.LikeGoalPolicy = { normalizeBehavior: () => "stay" };
  window.configureNativeOverlayCanvas = () => {};
  window.configureLikeGoalViewport = () => {};
  window.overlayFontStack = () => "sans-serif";
  window.startOverlayRuntimeVersionMonitor = () => {};
  window.setupOverlayDesign = async () => {};
  window.hydrations = [];
  window.finishedPlayback = 0;
  window.finishMatchPlayback = () => { window.finishedPlayback += 1; };
  window.shenPulseRelayBootstrap = bootstrap;
  window.fetch = () => { throw new Error("Aucun appel HTTP local/public générique n'est autorisé dans cette fixture."); };
  window.EventSource = class FakeEventSource {
    constructor(url) { this.url = url; this.listeners = new Map(); this.closed = false; sources.push(this); }
    addEventListener(name, callback) {
      const listeners = this.listeners.get(name) || []; listeners.push(callback); this.listeners.set(name, listeners);
    }
    close() { this.closed = true; }
    emit(name, value) {
      for (const callback of this.listeners.get(name) || []) callback({ data: JSON.stringify(value) });
    }
  };
  const context = dom.getInternalVMContext();
  for (const file of ["runtime/configuration.js", "runtime/widgets/match-widgets.js"]) {
    vm.runInContext(source(file), context, { filename: file });
  }
  vm.runInContext("const actualHydrateMatchWidget = hydrateMatchWidget; hydrateMatchWidget = (payload) => { globalThis.hydrations.push(JSON.parse(JSON.stringify(payload))); actualHydrateMatchWidget(payload); };", context);
  vm.runInContext(source("runtime/transport.js"), context, { filename: "runtime/transport.js" });
  const run = (code) => vm.runInContext(code, context);
  return { window, sources, intervals, timeouts, run, now: () => nowMs,
    stage: window.document.getElementById("match-widget-stage"),
    put: (value) => sources[0].emit("put", { path: "/", data: value }),
    patch: (patchPath, value) => sources[0].emit("patch", { path: patchPath, data: value }),
    advance: (milliseconds) => {
      nowMs += milliseconds;
      for (const [id, timer] of [...timeouts]) if (timer.at <= nowMs) {
        timeouts.delete(id); timer.callback();
      }
    }
  };
}

function alias(nowMs, widget = "wins") {
  return {
    sourceChannel: "generic_channel_never_subscribed",
    matchSource: { enabled: true, widgetsEnabled: true, accountNumber },
    presence: { connected: true, updatedAt: new Date(nowMs).toISOString() },
    state: { matches: { config: { widgets: { [widget]: { enabled: true, title: "Match de test", theme: "classic", donorPhoto: true, durationSeconds: 5 } } },
      session: { status: "active", timing: { endsAtMs: nowMs + 60000 }, participants: [
        { own: true, username: "fixture_creator", displayName: "Créateur", score: 120 },
        { own: false, username: "fixture_opponent", displayName: "Adversaire", score: 90 }
      ], rounds: { own: 2, opponent: 1 }, session: { wins: 2, winStreak: 2 },
      liveContributors: [{ username: "fixture_donor", displayName: "Donateur", diamonds: 100, likes: 200 }],
      lastGift: { user: { username: "fixture_donor", displayName: "Donateur" }, giftName: "Rose", count: 1, atMs: nowMs } } } }
  };
}

test("les sept aliases HTTPS hydratent uniquement les données Matchs, sans port ni relais générique", (t) => {
  for (const widget of widgets) {
    const fixture = runtime(t, { search: `?widget=${widget}` });
    assert.equal(fixture.run("viewName"), "match-widget");
    assert.equal(fixture.window.document.documentElement.hidden, true);
    assert.equal(fixture.sources.length, 1);
    assert.match(fixture.sources[0].url, new RegExp(`/publicOverlayRelay/${channel}\\.json$`));
    fixture.put(alias(fixture.now(), widget));
    assert.equal(fixture.window.document.documentElement.hidden, false);
    assert.equal(fixture.window.hydrations.length, 1);
    assert.equal(fixture.sources.length, 1, "aucun abonnement à sourceChannel");
    assert.equal(fixture.window.finishedPlayback, 0, "aucun lecteur vidéo local");
    assert.equal(fixture.run("publicMatchEventChannel"), "");
    assert.equal(fixture.run("publicMatchWidgetExpiresAtMs"), fixture.now() + 120000);
  }
});

test("les mutations Firebase mettent à jour les scores sans rejouer une image identique", (t) => {
  const fixture = runtime(t, { search: "?widget=scoreboard" });
  fixture.put(alias(fixture.now(), "scoreboard"));
  assert.match(fixture.stage.textContent, /120/);
  fixture.patch("/state/matches/session/participants/0", { score: 130 });
  assert.match(fixture.stage.textContent, /130/);
  assert.equal(fixture.window.hydrations.length, 2);
  fixture.patch("/state/matches/session/participants/0", { score: 130 });
  assert.equal(fixture.window.hydrations.length, 2);
  fixture.advance(45000);
  fixture.patch("/presence", { updatedAt: new Date(fixture.now()).toISOString() });
  assert.equal(fixture.window.hydrations.length, 2, "le heartbeat ne reconstruit pas le widget");
  assert.equal(fixture.run("publicMatchWidgetExpiresAtMs"), fixture.now() + 120000);
});

test("révocation, fin de connexion, compte différent et état supprimé vident le widget et ses timers", (t) => {
  for (const change of [
    (row) => { row.matchSource.widgetsEnabled = false; },
    (row) => { row.matchSource.enabled = false; },
    (row) => { row.matchSource.accountNumber = "999999999999"; },
    (row) => { row.presence.connected = false; },
    (row) => { row.state.matches = null; },
    (row) => { delete row.presence.updatedAt; },
    (row) => { row.presence.updatedAt = new Date(Date.UTC(2099, 0, 1)).toISOString(); }
  ]) {
    const fixture = runtime(t, { search: "?widget=timer" });
    const row = alias(fixture.now(), "timer");
    fixture.put(row);
    assert.equal(fixture.intervals.size, 1);
    change(row); fixture.put(row);
    assert.equal(fixture.window.document.documentElement.hidden, true);
    assert.equal(fixture.stage.hidden, true);
    assert.equal(fixture.intervals.size, 0);
    assert.equal(fixture.run("publicMatchWidgetLeaseTimer"), null);
    assert.equal(fixture.run("matchWidgetState.session.status"), undefined);
  }
});

test("le bail de présence expire après 120 secondes et ne se renouvelle pas avec les scores", (t) => {
  const fixture = runtime(t);
  fixture.put(alias(fixture.now()));
  fixture.advance(119999);
  fixture.patch("/state/matches/session", { manualWins: 9 });
  assert.equal(fixture.window.document.documentElement.hidden, false);
  fixture.advance(1);
  assert.equal(fixture.window.document.documentElement.hidden, true);
  assert.equal(fixture.stage.hidden, true);
  assert.equal(fixture.intervals.size, 0);
  fixture.patch("/presence", { updatedAt: new Date(fixture.now()).toISOString() });
  assert.equal(fixture.window.document.documentElement.hidden, false);
  assert.equal(fixture.run("matchWidgetState.session.manualWins"), 9);
});

test("une réponse bootstrap tardive ne réactive pas un accès déjà révoqué", async (t) => {
  let resolveBootstrap;
  const request = new Promise((resolve) => { resolveBootstrap = resolve; });
  const fixture = runtime(t, { bootstrap: { channel, request, cachedDocument: alias(Date.UTC(2026, 9, 14, 10)) } });
  assert.equal(fixture.window.hydrations.length, 0, "aucun cache n'est considéré comme une permission courante");
  fixture.sources[0].emit("auth_revoked", {});
  resolveBootstrap(alias(fixture.now()));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fixture.window.document.documentElement.hidden, true);
  assert.equal(fixture.sources[0].closed, true);
  assert.equal(fixture.run("publicMatchRelayReady"), false);
});

test("une coupure réseau masque immédiatement le widget et une nouvelle image le restaure", (t) => {
  const fixture = runtime(t, { search: "?widget=timer" });
  fixture.put(alias(fixture.now(), "timer"));
  fixture.sources[0].emit("error", {});
  assert.equal(fixture.window.document.documentElement.hidden, true);
  assert.equal(fixture.intervals.size, 0);
  assert.equal(fixture.sources[0].closed, false, "EventSource garde sa reconnexion native");
  fixture.put(alias(fixture.now(), "timer"));
  assert.equal(fixture.window.document.documentElement.hidden, false);
  assert.equal(fixture.intervals.size, 1);
  fixture.window.dispatchEvent(new fixture.window.Event("pagehide"));
  assert.equal(fixture.sources[0].closed, true);
  assert.equal(fixture.intervals.size, 0);
  assert.equal(fixture.run("publicMatchWidgetLeaseTimer"), null);
});

test("les URLs publiques génériques et les widgets inconnus ne souscrivent aucun canal", (t) => {
  for (const options of [
    { pathname: "/", search: "?view=match-widget&widget=wins&channel=generic_channel" },
    { search: "?widget=unknown" },
    { search: "?widget=wins&widget=timer" },
    { search: "?widget=wins&widget=wins" },
    { search: "?widget=" }
  ]) {
    const fixture = runtime(t, options);
    assert.equal(fixture.run("viewName"), "match-widget");
    assert.equal(fixture.window.document.documentElement.hidden, true);
    assert.equal(fixture.sources.length, 0);
    assert.equal(fixture.window.hydrations.length, 0);
    assert.equal(fixture.window.finishedPlayback, 0);
  }
});

test("le lecteur d'animations utilise uniquement son alias Matchs dédié et un bail de présence frais", (t) => {
  const fixture = runtime(t, { search: "" });
  assert.equal(fixture.run("viewName"), "match");
  fixture.put({ sourceChannel: "generic_channel_never_subscribed", matchSource: { enabled: true, widgetsEnabled: true, accountNumber, localPort: 17654, contextId: "a".repeat(64) },
    presence: { connected: true, updatedAt: new Date(fixture.now()).toISOString() } });
  assert.equal(fixture.window.document.documentElement.hidden, false);
  assert.equal(fixture.sources.length, 1);
  assert.match(fixture.sources[0].url, new RegExp(`/publicOverlayRelay/${channel}\\.json$`));
  assert.equal(fixture.run("publicMatchEventChannel"), "");
  assert.equal(fixture.window.hydrations.length, 0);
  fixture.advance(120000);
  assert.equal(fixture.window.document.documentElement.hidden, true);
  assert.equal(fixture.run("publicMatchWidgetLeaseTimer"), null);
});

test("le loader charge les widgets et leur CSS pour un alias, jamais le lecteur d'animations", async () => {
  for (const widget of ["wins", "timer", "unknown", ""]) {
    const scripts = [], styles = [], errors = [];
    const context = {
      location: { pathname: route, search: `?widget=${widget}` }, URLSearchParams,
      performance: { now: () => 1 }, console: { error: (...values) => errors.push(values) },
      document: {
        createElement: () => ({ addEventListener(name, callback) { this[name] = callback; } }),
        head: { appendChild(style) { styles.push(style.href); } },
        body: { appendChild(script) { scripts.push(script.src); queueMicrotask(() => script.load()); } },
        documentElement: { classList: { remove() {} }, dataset: {} }
      }
    };
    vm.runInNewContext(source("runtime/loader.js"), context);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(errors, []);
    assert.equal(context.shenPulseOverlayPerformance.view, "match-widget");
    assert.ok(scripts.some((file) => file.startsWith("runtime/widgets/match-widgets.js?")));
    assert.ok(styles.some((file) => file.startsWith("styles/match-widgets.css?")));
    assert.ok(!scripts.some((file) => file.startsWith("runtime/widgets/match.js?")));
    assert.ok(!scripts.some((file) => file.startsWith("match-playback-queue.js?")));
  }
});
