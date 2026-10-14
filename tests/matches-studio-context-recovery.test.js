"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/** Le vrai callback de transport est exécuté ; reload est une simple sonde. */
function fixture({ bridge = true } = {}) {
  const source = fs.readFileSync(path.join(__dirname, "../resources/overlays/runtime/transport.js"), "utf8");
  const start = source.indexOf("function connectAuthenticatedMatchEventSource()");
  const end = source.indexOf("function connectLocalEventSource()", start);
  assert.ok(start >= 0 && end > start);
  const sources = [], effects = [], timers = new Map();
  const calls = { reload: 0, stopPlayback: 0, stopWidget: 0, pause: 0, load: 0, removed: [] };
  let now = 0, nextId = 0;
  const video = { pause: () => { calls.pause += 1; }, load: () => { calls.load += 1; }, removeAttribute: (name) => calls.removed.push(name) };
  const document = { documentElement: { hidden: false }, getElementById: () => video };
  const context = vm.createContext({ URLSearchParams, token: "", viewName: "match", leaderboardKind: "",
    hasMediaScreen: false, mediaScreen: 1, localMatchBridgeRoute: bridge ? ["bridge", "123456789012", "m".repeat(24)] : null,
    matchSourceBasePath: bridge ? `/match-bridge/123456789012/${"m".repeat(24)}` : `/match/123456789012/${"a".repeat(32)}`,
    localMatchContextReloadScheduled: false, document,
    location: { reload: () => { calls.reload += 1; } },
    stopMatchSourcePlayback: () => { calls.stopPlayback += 1; }, stopMatchWidget: () => { calls.stopWidget += 1; },
    setTimeout: (callback, delay) => { const id = ++nextId; timers.set(id, { callback, at: now + Number(delay), delay }); return id; },
    overlayChannels: Object.fromEntries(["match", "match-media", "match-audio"].map((channel) => [channel, (payload) => effects.push({ channel, payload })])),
    currentViewAcceptsChannel: (channel) => ["match", "match-media", "match-audio"].includes(channel),
    EventSource: class FakeEventSource {
      constructor(url) { this.url = url; this.closed = false; this.listeners = new Map(); sources.push(this); }
      addEventListener(name, callback) { this.listeners.set(name, callback); }
      close() { this.closed = true; }
      emit(name, value, raw = false) { this.listeners.get(name)?.({ data: raw ? value : JSON.stringify(value) }); }
    }
  });
  vm.runInContext(source.slice(start, end), context, { filename: "transport-local-context-fixture.js" });
  context.connectAuthenticatedMatchEventSource();
  return { sources, effects, timers, calls, document,
    advance(ms) { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); } } };
}

test("un changement de contexte arrête tout puis recharge une seule fois à 250ms sans replay", () => {
  const h = fixture(), stream = h.sources[0];
  stream.emit("match", { payload: { requestId: "first", match: "x2" } });
  assert.equal(h.effects.length, 1);
  stream.emit("access-revoked", { reason: "match-context-changed" });
  assert.equal(stream.closed, true);
  assert.equal(h.document.documentElement.hidden, true);
  assert.equal(h.calls.stopPlayback, 1);
  assert.equal(h.calls.stopWidget, 1);
  assert.deepEqual(h.calls.removed, ["src"]);
  assert.equal(h.timers.size, 1);
  assert.equal([...h.timers.values()][0].delay, 250);
  for (const channel of ["match", "match-media", "match-audio"]) stream.emit(channel, { payload: { requestId: "stale" } });
  stream.emit("access-revoked", { reason: "match-context-changed" });
  assert.equal(h.effects.length, 1, "aucun callback en attente ne relance l'ancien effet");
  assert.equal(h.calls.stopPlayback, 1);
  h.advance(249); assert.equal(h.calls.reload, 0);
  h.advance(1); assert.equal(h.calls.reload, 1);
  h.advance(10000); assert.equal(h.calls.reload, 1);
  assert.equal(h.sources.length, 1, "aucun deuxième flux créé avant la nouvelle navigation");
});

test("capacité tournée, abonnement, compte ou visibilité révoqués ne rechargent jamais", () => {
  for (const reason of ["match-url-regenerated", "subscription-required", "matches-access-revoked", "account-required", "unknown"]) {
    const h = fixture();
    h.sources[0].emit("access-revoked", { reason });
    h.advance(10000);
    assert.equal(h.sources[0].closed, true);
    assert.equal(h.document.documentElement.hidden, true);
    assert.equal(h.timers.size, 0);
    assert.equal(h.calls.reload, 0, reason);
  }
});

test("une révocation malformée et une source privée ne reprennent jamais automatiquement", () => {
  const malformed = fixture();
  malformed.sources[0].emit("access-revoked", "not-json", true);
  malformed.advance(10000);
  assert.equal(malformed.calls.reload, 0);
  assert.equal(malformed.sources[0].closed, true);
  const legacy = fixture({ bridge: false });
  legacy.sources[0].emit("access-revoked", { reason: "match-context-changed" });
  legacy.advance(10000);
  assert.equal(legacy.calls.reload, 0);
  assert.equal(legacy.document.documentElement.hidden, true);
});
