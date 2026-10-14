"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const catalog = require("../resources/overlays/overlay-catalog");
const playbackQueue = require("../resources/overlays/match-playback-queue");

const directory = path.join(__dirname, "../resources/overlays");
const accountNumber = "123456789012";
const channel = "match_playback_fixture_channel";
const contextId = "a".repeat(64);
const tick = () => new Promise((resolve) => setImmediate(resolve));

/** Vrai lecteur et vrai transport, avec médias et réseau entièrement simulés. */
function runtime(t, { fetchImpl, readyState = 2, rejectedPlay = false, compatible = false, legacy = false,
  url = `https://shenpulse-overlays.web.app/m/${accountNumber}/${channel}` } = {}) {
  const dom = new JSDOM('<head><base href="/"></head><body><section id="alerts-view"></section><section id="match-view"><div class="match-stage"><video id="match-video"></video><strong id="match-title"></strong></div></section></body>', {
    url,
    runScripts: "outside-only"
  });
  t.after(() => dom.window.close());
  const window = dom.window, context = dom.getInternalVMContext();
  let executingScript = null;
  Object.defineProperty(window.document, "currentScript", { configurable: true, get: () => executingScript });
  const evaluateModule = (file) => {
    executingScript = window.document.createElement("script");
    executingScript.src = `https://shenpulse-overlays.web.app/${file}?v=legacy-fixture-version`;
    try { vm.runInContext(fs.readFileSync(path.join(directory, file), "utf8"), context, { filename: file }); }
    finally { executingScript = null; }
  };
  let nowMs = Date.UTC(2026, 9, 14, 12), timerId = 0;
  const timers = new Map(), sources = [], requests = [], played = [], audios = [], dependencyScripts = [];
  const appendHead = window.document.head.appendChild.bind(window.document.head);
  window.document.head.appendChild = (node) => {
    if (node.tagName === "SCRIPT") dependencyScripts.push(node);
    return appendHead(node);
  };
  window.Date.now = () => nowMs;
  window.setTimeout = (callback, delay = 0) => {
    const id = ++timerId; timers.set(id, { callback, at: nowMs + Number(delay) }); return id;
  };
  window.clearTimeout = (id) => timers.delete(id);
  window.requestAnimationFrame = () => 0;
  window.ShenPulseOverlayCatalog = catalog;
  window.MatchPlaybackQueue = playbackQueue;
  window.LikeGoalPolicy = { normalizeBehavior: () => "stay" };
  window.configureNativeOverlayCanvas = () => {};
  window.configureLikeGoalViewport = () => {};
  window.overlayFontStack = () => "sans-serif";
  window.startOverlayRuntimeVersionMonitor = () => {};
  window.mediaUrl = (relative) => `https://shenpulse-overlays.web.app/media/${relative}`;
  window.console.warn = () => {};
  const mediaPrototype = window.HTMLMediaElement.prototype;
  Object.defineProperty(mediaPrototype, "readyState", { configurable: true, get: () => readyState });
  mediaPrototype.pause = () => {};
  mediaPrototype.load = () => {};
  mediaPrototype.play = function play() {
    played.push({ id: this.id, src: this.src, muted: this.muted });
    return rejectedPlay ? Promise.reject(new Error("simulated permission denial")) : Promise.resolve();
  };
  window.Audio = class FakeAudio extends window.EventTarget {
    constructor(url) { super(); this.src = url; this.stopped = false; audios.push(this); }
    play() { this.played = true; return Promise.resolve(); }
    pause() { this.stopped = true; }
    removeAttribute(name) { if (name === "src") this.src = ""; }
    load() {}
  };
  window.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return fetchImpl ? fetchImpl(url, options) : {
      ok: true, json: async () => ({ url: "/match-media/opaque_fixture_ticket", expiresAt: new Date(nowMs + 90000).toISOString() })
    };
  };
  window.EventSource = class FakeEventSource {
    constructor(url) { this.url = url; this.closed = false; this.listeners = new Map(); sources.push(this); }
    addEventListener(name, callback) { const list = this.listeners.get(name) || []; list.push(callback); this.listeners.set(name, list); }
    close() { this.closed = true; }
    emit(name, value) { for (const callback of this.listeners.get(name) || []) callback({ data: JSON.stringify(value) }); }
  };
  const modules = legacy ? ["runtime/configuration.js", "runtime/wheel-match.js"]
    : ["runtime/configuration.js", "runtime/widgets/match-progress.js", ...(compatible ? ["runtime/widgets/match-compatible.js"] : []), "runtime/widgets/match-audio.js", "runtime/widgets/match-reactions.js", "runtime/widgets/match-preview.js", "runtime/widgets/match.js"];
  for (const file of modules) evaluateModule(file);
  const run = (code) => vm.runInContext(code, context);
  window.setupOverlayDesign = async () => run("setupMatch()");
  vm.runInContext(fs.readFileSync(path.join(directory, "runtime/transport.js"), "utf8"), context);
  const alias = (sourceContextId = contextId) => ({
    sourceChannel: "generic_channel_must_never_be_subscribed",
    matchSource: { enabled: true, widgetsEnabled: true, accountNumber, localPort: 17654, contextId: sourceContextId },
    presence: { connected: true, updatedAt: new Date(nowMs).toISOString() }
  });
  const batch = (id, messages, sourceContextId = contextId) => sources[0].emit("patch", { path: "/", data: {
    lastBatch: { id, contextId: sourceContextId, messages: messages.map((message) => ({ timestamp: new Date(nowMs).toISOString(), ...message })) }
  } });
  const loadLegacyModule = (name, fail = false) => {
    const script = dependencyScripts.find((node) => new URL(node.src).pathname.endsWith(`/${name}.js`));
    assert.ok(script, `${name} demandé par le vrai ancien chargeur`);
    if (!fail) evaluateModule(`runtime/widgets/${name}.js`);
    script.dispatchEvent(new window.Event(fail ? "error" : "load"));
  };
  return { window, run, alias, batch, requests, sources, timers, played, audios, dependencyScripts, loadLegacyModule, now: () => nowMs,
    loadLegacyReactions: ({ failModule = "" } = {}) => {
      for (const script of dependencyScripts) {
        const name = path.basename(new URL(script.src).pathname, ".js");
        loadLegacyModule(name, name === failModule);
      }
    },
    video: window.document.getElementById("match-video"),
    put: (value) => sources[0].emit("put", { path: "/", data: value }),
    advance: (milliseconds) => {
      nowMs += milliseconds;
      for (const [id, timer] of [...timers]) if (timers.has(id) && timer.at <= nowMs) { timers.delete(id); timer.callback(); }
    }
  };
}

function animation(id = "fixture-animation") {
  return { channel: "match", payload: { requestId: id, match: "x2", variant: "tikcontrol", fit: "contain" } };
}

test("pagehide annule le play sonore d'une source individuelle avant un refus tardif", async (t) => {
  const h = runtime(t, { url: "https://shenpulse-overlays.web.app/overlay/?view=match&match=x2&autoplay=false" });
  await tick();
  Object.defineProperty(h.window.document, "visibilityState", { configurable: true, value: "visible" });
  let rejectPlayback, calls = 0;
  h.video.src = "https://example.invalid/match-media/isolated";
  h.video.play = () => { calls += 1; return new Promise((_, reject) => { rejectPlayback = reject; }); };
  h.run("matchAutoplay = true; restartMatchVideo()");
  assert.equal(calls, 1);
  h.window.dispatchEvent(new h.window.Event("pagehide"));
  const denied = new Error("synthetic autoplay refusal"); denied.name = "NotAllowedError";
  rejectPlayback(denied); await tick();
  assert.equal(calls, 1, "la vidéo inactive ne repart pas en mode muet");
  assert.equal(h.run("matchSourceInactive"), true);
  assert.equal(h.window.document.querySelector("#match-enable-audio"), null);
  assert.equal(h.window.document.documentElement.dataset.matchAudioError, undefined);
});

test("le vrai lecteur public demande Cyber et son poster sans réécrire la variante", async (t) => {
  const h = runtime(t, { compatible: true });
  h.put(h.alias());
  h.batch("cyber", [{ channel: "match", payload: { requestId: "fixture-cyber", match: "x2", variant: "cyber" } }]);
  assert.match(h.window.document.getElementById("match-compatible-animation")?.querySelector("img").src || "", /video\/posters\/x2-cyber\.webp$/);
  await tick();
  assert.equal(new URL(h.requests[0].url).searchParams.get("variant"), "cyber");
  assert.equal(h.played.length, 1);
});

test("le lecteur Matchs consomme directement son alias, sans abonnement au relais général", async (t) => {
  const h = runtime(t);
  h.put(h.alias());
  assert.equal(h.sources.length, 1);
  assert.equal(h.window.document.documentElement.hidden, false);
  h.batch("batch-animation", [animation()]);
  await tick();
  assert.equal(h.requests.length, 1);
  assert.match(h.requests[0].url, /^http:\/\/127\.0\.0\.1:17654\/match-bridge\//);
  assert.equal(h.played.length, 1);
  assert.equal(h.played[0].muted, false, "la piste sonore intégrée accompagne la vraie animation");
  assert.equal(h.run("publicMatchEventChannel"), "");
  h.batch("batch-animation", [animation()]);
  h.batch("batch-duplicate", [animation()]);
  await tick();
  assert.equal(h.requests.length, 1, "ni batch ni identifiant reçu deux fois ne relance le média");
});

test("première image, événements anciens, futurs, sans date et canaux étrangers ne jouent rien", async (t) => {
  const h = runtime(t), row = h.alias();
  row.lastBatch = { id: "initial", contextId, messages: [{ ...animation("initial"), timestamp: new Date(h.now()).toISOString() }] };
  h.put(row);
  h.batch("invalid", [
    { ...animation("old"), timestamp: new Date(h.now() - 16000).toISOString() },
    { ...animation("future"), timestamp: new Date(h.now() + 16000).toISOString() },
    { ...animation("undated"), timestamp: "" },
    { channel: "audio", payload: { url: "https://example.invalid/ordinary.mp3" } },
    { channel: "alert", payload: { mediaUrl: "https://example.invalid/ordinary.mp4" } }
  ]);
  await tick();
  assert.equal(h.requests.length, 0);
  assert.equal(h.played.length, 0);
  assert.equal(h.audios.length, 0);
});

test("révocation pendant le ticket annule la demande et empêche toute reprise tardive", async (t) => {
  let resolveTicket;
  const h = runtime(t, { fetchImpl: () => new Promise((resolve) => { resolveTicket = resolve; }) });
  h.put(h.alias()); h.batch("pending", [animation()]);
  assert.equal(h.requests[0].options.signal.aborted, false);
  const revoked = h.alias(); revoked.matchSource.widgetsEnabled = false; h.put(revoked);
  assert.equal(h.requests[0].options.signal.aborted, true);
  resolveTicket({ ok: true, json: async () => ({ url: "/match-media/late_ticket" }) });
  await tick();
  assert.equal(h.played.length, 0);
  assert.equal(h.video.hasAttribute("src"), false);
  assert.equal(h.run("matchPlaybackQueue.snapshot().active"), false);
  assert.equal(h.window.document.documentElement.hidden, true);
});

test("un ticket absent ou un refus réseau produit un diagnostic visible sans URL ni secret", async (t) => {
  for (const fetchImpl of [
    async () => { throw new Error("private URL and token must not appear"); },
    async () => ({ ok: true, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => ({ url: "javascript:alert(1)" }) })
  ]) {
    const h = runtime(t, { fetchImpl }); h.put(h.alias()); h.batch("failure", [animation()]);
    await tick();
    assert.equal(h.played.length, 0);
    assert.equal(h.window.document.documentElement.dataset.matchPlaybackError, "ticket-unavailable");
    assert.match(h.window.document.getElementById("match-playback-error").textContent, /réseau local/);
    assert.doesNotMatch(h.window.document.getElementById("match-playback-error").textContent, /private|token|127\.0\.0\.1/);
  }
});

test("les attentes de ticket et canplay sont bornées et libèrent le lecteur", async (t) => {
  const never = runtime(t, { fetchImpl: () => new Promise(() => {}) });
  never.put(never.alias()); never.batch("wait", [animation()]); never.advance(8000);
  assert.equal(never.requests[0].options.signal.aborted, true);
  assert.equal(never.run("matchPlaybackQueue.snapshot().active"), false);
  assert.equal(never.window.document.documentElement.dataset.matchPlaybackError, "ticket-timeout");
  const unready = runtime(t, { readyState: 0 });
  unready.put(unready.alias()); unready.batch("unready", [animation()]); await tick(); unready.advance(10000);
  assert.equal(unready.run("matchPlaybackQueue.snapshot().active"), false);
  assert.equal(unready.window.document.documentElement.dataset.matchPlaybackError, "media-timeout");
});

test("remplacer une animation invalide aussi ses tickets et canplay retardés", async (t) => {
  const pending = [];
  const h = runtime(t, { fetchImpl: () => new Promise((resolve) => pending.push(resolve)) });
  h.put(h.alias()); h.batch("first", [animation("first")]);
  h.batch("second", [{ channel: "match", payload: { requestId: "second", match: "x3", variant: "gladiador" } }]);
  assert.equal(h.requests[0].options.signal.aborted, true);
  pending[1]({ ok: true, json: async () => ({ url: "/match-media/second_ticket" }) });
  await tick();
  pending[0]({ ok: true, json: async () => ({ url: "/match-media/first_ticket" }) });
  await tick();
  assert.equal(h.played.length, 1);
  assert.match(h.played[0].src, /second_ticket$/);
  assert.equal(h.video.dataset.matchPlaybackId, "second");
});

test("un refus autoplay n'est pas silencieux et ne bloque pas le prochain événement", async (t) => {
  const h = runtime(t, { rejectedPlay: true });
  h.put(h.alias()); h.batch("blocked", [animation("blocked")]); await tick();
  assert.equal(h.window.document.documentElement.dataset.matchPlaybackError, "autoplay-refused");
  assert.equal(h.run("matchPlaybackQueue.snapshot().active"), false);
  h.batch("again", [animation("again")]); await tick();
  assert.equal(h.requests.length, 2);
});

test("une seule source joue animation, vidéo personnalisée et son en parallèle", async (t) => {
  const h = runtime(t); h.put(h.alias());
  h.batch("parallel", [animation(),
    { channel: "match-media", payload: { playbackId: "fixture-video", mediaUrl: "https://example.invalid/custom.mp4", durationMs: 1000 } },
    { channel: "match-audio", payload: { playbackId: "fixture-audio", url: "https://example.invalid/custom.mp3", volume: .4 } }
  ]);
  await tick();
  const media = h.window.document.getElementById("match-custom-media");
  media.dispatchEvent(new h.window.Event("canplay"));
  await tick();
  assert.deepEqual(h.played.map((item) => item.id), ["match-video", "match-custom-media"]);
  assert.ok(h.played.every((item) => item.muted === false), "les deux vidéos conservent leur son natif");
  assert.equal(h.audios.length, 1);
  assert.equal(h.audios[0].volume, .4);
  h.advance(1000);
  assert.equal(h.window.document.getElementById("match-custom-media"), null);
  h.sources[0].emit("error", {});
  assert.equal(h.audios[0].stopped, true);
  assert.equal(h.audios[0].src, "");
  assert.equal(h.video.hasAttribute("src"), false);
  assert.equal(h.window.document.documentElement.hidden, true);
});

test("la file audio est bornée, ignore les doublons et abandonne les sons devenus anciens", (t) => {
  const h = runtime(t); h.put(h.alias());
  const audio = (id) => ({ channel: "match-audio", payload: { playbackId: id, url: "https://example.invalid/fixture.mp3" } });
  h.batch("first", [audio("first"), audio("first")]);
  h.batch("queue", Array.from({ length: 30 }, (_, index) => audio(`queued-${index}`)));
  assert.equal(h.audios.length, 1);
  assert.equal(h.run("playMatchAudio.queue.length"), 16);
  h.advance(16000);
  h.audios[0].dispatchEvent(new h.window.Event("ended"));
  assert.equal(h.audios.length, 1);
  assert.equal(h.run("playMatchAudio.queue.length"), 0);
  assert.equal(h.run("playMatchAudio.state"), null);
});

test("une présence périmée ou un compte différent révoque toutes les pistes", (t) => {
  for (const change of [
    (row) => { row.matchSource.accountNumber = "999999999999"; },
    (row) => { row.presence.connected = false; },
    (row) => { row.presence.updatedAt = new Date(Date.UTC(2099, 0, 1)).toISOString(); },
    (row) => { delete row.presence.updatedAt; }
  ]) {
    const h = runtime(t), row = h.alias(); change(row); h.put(row);
    assert.equal(h.window.document.documentElement.hidden, true);
    h.batch("hidden", [animation()]); assert.equal(h.requests.length, 0);
  }
  const h = runtime(t); h.put(h.alias()); h.advance(120000);
  assert.equal(h.window.document.documentElement.hidden, true);
  assert.equal(h.run("publicMatchWidgetLeaseTimer"), null);
});

test("le mode compatible apparaît dès un vrai événement et expire huit secondes après même sans pont local", async (t) => {
  const h = runtime(t, { compatible: true, fetchImpl: async () => { throw new Error("browser blocks localhost"); } });
  h.put(h.alias());
  assert.equal(h.window.document.getElementById("match-compatible-animation"), null, "aucune démonstration au repos");
  h.batch("compatible", [{ channel: "match", payload: { requestId: "compat", match: "snipe", variant: "gladiador" } }]);
  const poster = h.window.document.getElementById("match-compatible-animation");
  assert.ok(poster, "rendu présent avant la réponse du ticket");
  assert.equal(poster.dataset.effect, "snipe");
  assert.match(poster.querySelector("img").src, /video\/posters\/snipe-gladiador\.webp$/);
  assert.match(poster.textContent, /Mode compatible/);
  await tick();
  assert.equal(h.window.document.getElementById("match-playback-error"), null, "pas de grande erreur superposée au secours fonctionnel");
  assert.equal(h.window.document.documentElement.dataset.matchPlaybackError, "ticket-unavailable");
  h.advance(7999);
  assert.equal(h.run("matchPlaybackQueue.snapshot().active"), true);
  h.advance(1);
  assert.equal(h.window.document.getElementById("match-compatible-animation"), null);
  assert.equal(h.run("matchPlaybackQueue.snapshot().active"), false);
  assert.equal(h.video.hasAttribute("src"), false);
  assert.equal(h.run("startMatchCompatiblePlayback.state"), null);
});

test("la vidéo originale remplace le mode compatible seulement après une progression réelle", async (t) => {
  const h = runtime(t, { compatible: true, readyState: 0 });
  h.put(h.alias()); h.batch("video", [animation()]); await tick();
  assert.ok(h.window.document.getElementById("match-compatible-animation"));
  assert.equal(h.played.length, 0);
  h.video.dispatchEvent(new h.window.Event("canplay")); await tick();
  assert.equal(h.played.length, 1);
  assert.ok(h.window.document.getElementById("match-compatible-animation"), "play() résolu n'est pas une preuve de lecture");
  h.video.currentTime = .1;
  h.advance(200);
  assert.equal(h.window.document.getElementById("match-compatible-animation"), null);
  assert.equal(h.video.dataset.matchPlaybackId, "fixture-animation");
  h.video.currentTime = 8.1;
  h.advance(8000);
  assert.equal(h.video.hasAttribute("src"), true, "la limite du secours ne coupe pas la vidéo originale");
  h.video.dispatchEvent(new h.window.Event("ended"));
  assert.equal(h.video.hasAttribute("src"), false);
  assert.equal(h.run("matchPlaybackQueue.snapshot().active"), false);
  assert.equal(h.video.matchPlaybackProgress, null);
});

test("play() résolu avec une vidéo figée conserve le secours puis nettoie tous les délais", async (t) => {
  const h = runtime(t, { compatible: true });
  h.put(h.alias()); h.batch("frozen", [animation()]); await tick();
  assert.equal(h.played.length, 1);
  assert.ok(h.window.document.getElementById("match-compatible-animation"));
  h.advance(1800);
  assert.equal(h.window.document.documentElement.dataset.matchPlaybackError, "video-stalled");
  assert.equal(h.video.hasAttribute("src"), false);
  assert.equal(h.video.matchPlaybackProgress, null);
  assert.ok(h.window.document.getElementById("match-compatible-animation"), "le secours initial continue sans être relancé");
  h.advance(6200);
  assert.equal(h.window.document.getElementById("match-compatible-animation"), null);
  assert.equal(h.run("matchPlaybackQueue.snapshot().active"), false);
  h.video.currentTime = 1;
  h.video.dispatchEvent(new h.window.Event("canplay"));
  h.advance(5000); await tick();
  assert.equal(h.played.length, 1, "un ancien média ne se ressuscite jamais");
});

test("un gel après progression arrête le lecteur sans rejouer le poster ni l'animation", async (t) => {
  const h = runtime(t, { compatible: true });
  h.put(h.alias()); h.batch("progress-then-frozen", [animation()]); await tick();
  h.video.currentTime = .2;
  h.advance(200);
  assert.equal(h.window.document.getElementById("match-compatible-animation"), null);
  h.advance(2000);
  assert.equal(h.video.hasAttribute("src"), false);
  assert.equal(h.video.matchPlaybackProgress, null);
  assert.equal(h.run("matchPlaybackQueue.snapshot().active"), false);
  assert.equal(h.window.document.getElementById("match-compatible-animation"), null);
  assert.match(h.window.document.getElementById("match-playback-error").textContent, /figée/);
  h.advance(10000);
  assert.equal(h.played.length, 1);
});

test("révocation, remplacement et canplay retardé nettoient immédiatement le mode compatible", async (t) => {
  const h = runtime(t, { compatible: true, fetchImpl: () => new Promise(() => {}) });
  h.put(h.alias()); h.batch("first", [animation("first")]);
  h.batch("second", [{ channel: "match", payload: { requestId: "second", match: "x3" } }]);
  assert.equal(h.window.document.querySelectorAll("#match-compatible-animation").length, 1);
  assert.equal(h.window.document.getElementById("match-compatible-animation").dataset.effect, "x3");
  assert.equal(h.requests[0].options.signal.aborted, true);
  h.sources[0].emit("auth_revoked", {});
  assert.equal(h.window.document.getElementById("match-compatible-animation"), null);
  assert.equal(h.requests[1].options.signal.aborted, true);
  h.video.dispatchEvent(new h.window.Event("canplay")); await tick();
  assert.equal(h.played.length, 0);
  assert.equal(h.run("matchPlaybackQueue.snapshot().active"), false);
});

test("un poster manquant ne reste pas cassé et les animations CSS ne tournent jamais indéfiniment", async (t) => {
  const h = runtime(t, { compatible: true, fetchImpl: async () => { throw new Error("unavailable"); } });
  h.put(h.alias()); h.batch("poster", [animation()]); await tick();
  const poster = h.window.document.querySelector("#match-compatible-animation img");
  poster.dispatchEvent(new h.window.Event("error"));
  assert.equal(poster.hidden, true);
  assert.match(h.window.document.getElementById("match-compatible-animation").textContent, /X2/);
  const css = fs.readFileSync(path.join(directory, "styles/match-player.css"), "utf8");
  assert.doesNotMatch(css, /infinite/);
  assert.match(css, /animation:match-compatible-frame 8s/);
  assert.match(css, /prefers-reduced-motion/);
  h.advance(8000);
  assert.equal(h.window.document.getElementById("match-compatible-animation"), null);
});

test("l'ancien bundle attend tous les modules canoniques avant ses abonnements et conserve médias/sons", async (t) => {
  const h = runtime(t, { legacy: true });
  assert.equal(h.sources.length, 0, "aucun événement avant les déclarations des réactions");
  assert.deepEqual(h.dependencyScripts.map((script) => new URL(script.src).pathname), [
    "/runtime/widgets/match-compatible.js", "/runtime/widgets/match-progress.js", "/runtime/widgets/match-audio.js",
    "/runtime/widgets/match-reactions.js", "/runtime/widgets/match-preview.js", "/runtime/widgets/match.js"
  ]);
  for (const script of h.dependencyScripts) {
    assert.equal(script.async, false);
    assert.equal(new URL(script.src).search, "?v=legacy-fixture-version");
  }
  assert.equal(h.run("typeof globalThis.MatchVideoProgress"), "undefined", "aucun watchdog préchargé dans cette fixture");
  assert.equal(h.run("typeof setupMatch"), "undefined", "aucun moteur Match recopié dans le bundle");
  h.loadLegacyReactions(); await tick();
  assert.equal(h.sources.length, 1);
  h.put(h.alias());
  h.batch("legacy-reactions", [
    { channel: "match-media", payload: { playbackId: "legacy-video", mediaUrl: "https://example.invalid/legacy.mp4" } },
    { channel: "match-audio", payload: { playbackId: "legacy-audio", url: "https://example.invalid/legacy.mp3" } }
  ]);
  const media = h.window.document.getElementById("match-custom-media");
  media.dispatchEvent(new h.window.Event("canplay")); await tick();
  assert.equal(h.played.length, 1);
  assert.equal(h.audios.length, 1);
  h.sources[0].emit("auth_revoked", {});
  assert.equal(h.window.document.getElementById("match-custom-media"), null);
  assert.equal(h.audios[0].stopped, true);
});

test("l'ancien chargeur garde l'ordre réel et n'abonne rien avant sa dernière dépendance", async (t) => {
  const h = runtime(t, { legacy: true });
  h.loadLegacyModule("match-compatible"); await tick();
  assert.equal(h.run("typeof startMatchCompatiblePlayback"), "function");
  assert.equal(h.run("typeof globalThis.MatchVideoProgress"), "undefined");
  assert.equal(h.sources.length, 0);
  h.loadLegacyModule("match-progress"); await tick();
  assert.equal(h.run("typeof globalThis.MatchVideoProgress.watch"), "function");
  assert.equal(h.run("typeof playMatchMedia"), "undefined");
  assert.equal(h.sources.length, 0);
  h.loadLegacyModule("match-audio"); await tick();
  assert.equal(h.run("typeof playMatchVideo"), "function");
  assert.equal(h.sources.length, 0);
  h.loadLegacyModule("match-reactions"); await tick();
  assert.equal(h.run("typeof playMatchMedia"), "function");
  assert.equal(h.run("typeof setupMatch"), "undefined");
  assert.equal(h.sources.length, 0);
  h.loadLegacyModule("match-preview"); await tick();
  assert.equal(h.run("typeof startProtectedMatchPreview"), "function");
  assert.equal(h.sources.length, 0);
  h.loadLegacyModule("match"); await tick();
  assert.equal(h.sources.length, 1);
  h.put(h.alias()); h.batch("legacy-canonical-animation", [animation()]); await tick();
  assert.equal(h.played.length, 1, "le canal Match résout le moteur arrivé après l'évaluation du transport");
  assert.ok(h.window.document.getElementById("match-compatible-animation"));
  h.video.currentTime = .1; h.advance(200);
  assert.equal(h.window.document.getElementById("match-compatible-animation"), null);
  h.sources[0].emit("auth_revoked", {});
  assert.equal(h.video.matchPlaybackProgress, null);
});

test("l'ancien chargeur expire sans abonnement ni lecture quand un moteur manque", async (t) => {
  const h = runtime(t, { legacy: true });
  h.advance(4000); await tick();
  assert.equal(h.sources.length, 0);
  assert.ok(h.window.document.documentElement.dataset.overlayLoadError);
  assert.equal(h.played.length, 0);
  h.loadLegacyReactions(); await tick();
  assert.equal(h.sources.length, 0, "un chargement tardif ne ressuscite aucune souscription");
  assert.equal(h.played.length, 0);
});

test("l'échec explicite d'un moteur historique reste honnête et ne joue aucun secours", async (t) => {
  const h = runtime(t, { legacy: true });
  h.loadLegacyReactions({ failModule: "match-progress" }); await tick();
  assert.equal(h.sources.length, 0);
  assert.ok(h.window.document.documentElement.dataset.overlayLoadError);
  assert.equal(h.window.document.getElementById("match-compatible-animation"), null);
  assert.equal(h.played.length, 0);
  assert.equal(h.requests.length, 0);
});

test("le chemin historique d'aperçu individuel charge aussi le lecteur canonique sans lire au repos", async (t) => {
  const h = runtime(t, { legacy: true, url: "https://shenpulse-overlays.web.app/overlay/?view=match&match=x2&preview=static" });
  assert.equal(h.dependencyScripts.length, 6, "le chargeur n'est pas limité au player public");
  h.loadLegacyReactions(); await tick();
  assert.equal(h.video.getAttribute("src"), null, "aucune vidéo en clair dans un aperçu statique");
  assert.match(h.video.poster, /video\/posters\/x2-tikcontrol\.webp$/);
  assert.equal(h.played.length, 0);
  assert.equal(h.sources.length, 0);
  assert.equal(h.video.matchPlaybackProgress, undefined, "aucun watchdog d'animation actif sur une carte statique");
});

test("changer de profil ou LIVE arrête toutes les pistes sans retirer les droits du compte", async (t) => {
  const h = runtime(t, { compatible: true, readyState: 0 });
  h.put(h.alias()); h.batch("old-context", [animation("old-animation"),
    { channel: "match-media", payload: { playbackId: "old-media", mediaUrl: "https://example.invalid/old.mp4" } },
    { channel: "match-audio", payload: { playbackId: "old-audio", url: "https://example.invalid/old.mp3" } },
    { channel: "match-audio", payload: { playbackId: "old-queued-audio", url: "https://example.invalid/queued.mp3" } }
  ]); await tick();
  assert.ok(h.window.document.getElementById("match-compatible-animation"));
  assert.ok(h.window.document.getElementById("match-custom-media"));
  assert.equal(h.run("playMatchAudio.queue.length"), 1);
  const nextContextId = "b".repeat(64);
  h.sources[0].emit("patch", { path: "/matchSource", data: h.alias(nextContextId).matchSource });
  assert.equal(h.window.document.documentElement.hidden, false, "les permissions sont toujours actives");
  assert.equal(h.window.document.getElementById("match-compatible-animation"), null);
  assert.equal(h.window.document.getElementById("match-custom-media"), null);
  assert.equal(h.video.hasAttribute("src"), false);
  assert.equal(h.audios[0].stopped, true);
  assert.equal(h.run("playMatchAudio.queue.length"), 0);
  assert.equal(h.run("matchPlaybackQueue.snapshot().active"), false);
  h.video.dispatchEvent(new h.window.Event("canplay")); await tick();
  assert.equal(h.played.length, 0, "un ancien canplay ne reprend aucune piste");
  h.batch("delayed-old", [animation("late-old-animation")], contextId); await tick();
  assert.equal(h.requests.length, 1);
  h.batch("new-context", [{ channel: "match", payload: { requestId: "new-animation", match: "x3" } }], nextContextId);
  await tick();
  assert.equal(h.requests.length, 2);
  assert.equal(h.window.document.getElementById("match-compatible-animation").dataset.effect, "x3");
  h.video.dispatchEvent(new h.window.Event("canplay")); await tick();
  assert.equal(h.played.length, 1);
});

test("une mutation atomique de contexte et de batch joue le nouveau moment sans le prendre pour une ouverture", async (t) => {
  const h = runtime(t, { compatible: true, readyState: 0 });
  h.put(h.alias()); h.batch("same-batch-id", [animation("same-request-id")]); await tick();
  const nextContextId = "c".repeat(64);
  h.sources[0].emit("patch", { path: "/", data: {
    matchSource: h.alias(nextContextId).matchSource,
    lastBatch: { id: "same-batch-id", contextId: nextContextId, messages: [{
      channel: "match", timestamp: new Date(h.now()).toISOString(),
      payload: { requestId: "same-request-id", match: "snipe", variant: "gladiador" }
    }] }
  } }); await tick();
  assert.equal(h.requests.length, 2);
  assert.equal(h.window.document.getElementById("match-compatible-animation").dataset.effect, "snipe");
  assert.equal(h.run("publicMatchPlaybackInitialized"), true);
  assert.equal(h.run("publicMatchPlaybackContextId"), nextContextId);
});

test("ouverture/reconnexion ne rejoue aucun batch et un ancien contexte ne bloque pas le prochain vrai moment", async (t) => {
  const h = runtime(t), nextContextId = "d".repeat(64), row = h.alias(nextContextId);
  row.lastBatch = { id: "reused-id", contextId, messages: [{
    ...animation("old-initial"), timestamp: new Date(h.now()).toISOString()
  }] };
  h.put(row); await tick(); assert.equal(h.requests.length, 0);
  h.batch("reused-id", [animation("fresh")], nextContextId); await tick();
  assert.equal(h.requests.length, 1, "l'ancien batch n'est pas marqué comme consommé dans le nouveau contexte");
  h.sources[0].emit("error", {});
  row.lastBatch = { id: "reconnect-initial", contextId: nextContextId, messages: [{
    ...animation("initial-again"), timestamp: new Date(h.now()).toISOString()
  }] };
  h.put(row); await tick(); assert.equal(h.requests.length, 1);
  h.batch("after-reconnect", [animation("next")], nextContextId); await tick();
  assert.equal(h.requests.length, 2);
});

