"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../resources/overlays/runtime/widgets/match-preview.js"), "utf8");

/** Exécute l'aperçu réel, avec un réseau et une horloge contrôlés. */
function fixture({ staticPreview = false, origin = "http://127.0.0.1:17654", token = "fixture-token" } = {}) {
  const calls = [], timers = new Map();
  let nextTimer = 0;
  const video = { dataset: { previewSource: "x2:cyber" }, isConnected: true,
    pause() {}, removeAttribute(name) { if (name === "src") delete this.src; }, load() {},
    parentElement: { classList: { add() {} } } };
  const context = vm.createContext({ URL, URLSearchParams, AbortController, Date,
    isStaticPreview: staticPreview, token, location: new URL(`${origin}/overlay/`),
    mediaUrl: (name) => `${origin}/overlay/media/${name}`,
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
    fetch: (url, options) => new Promise((resolve) => calls.push({ url, options, resolve }))
  });
  vm.runInContext(source, context);
  return { context, video, calls, timers,
    start: (match = "x2", variant = "cyber") => {
      video.dataset.previewSource = `${match}:${variant}`;
      return context.startProtectedMatchPreview(video, { match, variant, fit: "contain" }, video.dataset.previewSource);
    },
    answer: (call, ticket = { url: `/match-media/${"a".repeat(48)}`, expiresAt: Date.now() + 90000 }, status = 200) =>
      call.resolve({ ok: status === 200, status, json: async () => ticket }) };
}

test("statique, fichier et HTTPS : poster seul, aucune vidéo ni requête locale", async () => {
  for (const options of [{ staticPreview: true }, { origin: "https://shenpulse-overlays.web.app" }, { origin: "file:///" }, { token: "" }]) {
    const h = fixture(options);
    await h.start();
    assert.equal(h.calls.length, 0);
    assert.equal(h.video.src, undefined);
    assert.match(h.video.poster, /video\/posters\/x2-cyber\.webp$/);
    assert.equal(h.video.muted, true);
    assert.equal(h.timers.size, 0);
  }
});

test("l'aperçu Pro ne lit qu'un ticket même origine borné, jamais le WebM brut", async () => {
  const h = fixture(), pending = h.start();
  assert.equal(h.calls.length, 1);
  const call = h.calls[0], url = new URL(call.url, "http://127.0.0.1:17654");
  assert.equal(url.pathname, "/match-preview/ticket");
  assert.equal(url.searchParams.get("match"), "x2");
  assert.equal(url.searchParams.get("variant"), "cyber");
  assert.equal(call.options.cache, "no-store");
  assert.equal([...h.timers.values()][0].delay, 6000);
  h.answer(call, { url: `/match-media/${"a".repeat(48)}`, expiresAt: new Date(Date.now() + 90000).toISOString() }); await pending;
  assert.match(h.video.src, /^http:\/\/127\.0\.0\.1:17654\/match-media\/a{48}$/);
  assert.equal(h.video.dataset.matchPreviewStatus, "ready");
  assert.equal(h.video.muted, true);
  assert.equal(h.timers.size, 0);
});

test("sans Pro ou ticket invalide, le poster reste visible sans chargement vidéo", async () => {
  const invalid = [
    { url: "https://external.invalid/match-media/" + "a".repeat(48), expiresAt: Date.now() + 90000 },
    { url: "/overlay/media/video/x2-cyber.webm", expiresAt: Date.now() + 90000 },
    { url: "/match-media/" + "a".repeat(48) + "?secret=1", expiresAt: Date.now() + 90000 },
    { url: "/match-media/" + "a".repeat(48), expiresAt: Date.now() - 1 },
    { url: "/match-media/" + "a".repeat(48), expiresAt: Date.now() + 300000 }
  ];
  const free = fixture(), freePending = free.start();
  free.answer(free.calls[0], {}, 403); await freePending;
  assert.equal(free.video.dataset.matchPreviewStatus, "pro-required");
  assert.equal(free.video.src, undefined);
  for (const ticket of invalid) {
    const h = fixture(), pending = h.start();
    h.answer(h.calls[0], ticket); await pending;
    assert.equal(h.video.src, undefined);
    assert.equal(h.video.dataset.matchPreviewStatus, "unavailable");
    assert.match(h.video.poster, /x2-cyber\.webp$/);
  }
});

test("un changement de modèle annule le ticket tardif sans ressusciter l'ancienne vidéo", async () => {
  const h = fixture(), first = h.start();
  const previous = h.calls[0], second = h.start("x3", "cyber");
  assert.equal(previous.options.signal.aborted, true);
  h.answer(previous); await first;
  assert.equal(h.video.src, undefined);
  assert.match(h.video.poster, /x3-cyber\.webp$/);
  h.answer(h.calls[1], { url: `/match-media/${"b".repeat(48)}`, expiresAt: Date.now() + 90000 });
  await second;
  assert.match(h.video.src, /b{48}$/);
  assert.equal(h.timers.size, 0);
});

test("annulation, détachement et expiration bornée empêchent une réponse tardive", async () => {
  for (const invalidate of [
    (h) => h.context.stopProtectedMatchPreview(h.video),
    (h) => { h.video.isConnected = false; },
    (h) => [...h.timers.values()][0].callback()
  ]) {
    const h = fixture(), pending = h.start();
    invalidate(h); h.answer(h.calls[0]); await pending;
    assert.equal(h.video.src, undefined);
    assert.equal(h.timers.size, 0);
  }
});
