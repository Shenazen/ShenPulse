"use strict";

/** Préparation réelle du catalogue/markup, ordonnanceur et décodage simulés.
 * Les seuls fichiers lus sont les assets publics embarqués du projet. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { fileURLToPath, pathToFileURL } = require("node:url");
const { JSDOM } = require("jsdom");
const catalog = require("../resources/overlays/overlay-catalog");
const { createDefaultState } = require("../src/main/defaults");
const { version } = require("../package.json");
const renderer = path.resolve(__dirname, "../src/renderer");
const read = (file) => fs.readFileSync(path.join(renderer, "app", file), "utf8");
const tick = () => new Promise((resolve) => setImmediate(resolve));

function assetMetadata(source) {
  const bytes = fs.readFileSync(fileURLToPath(source));
  if (bytes.toString("ascii", 1, 4) === "PNG") return { bytes: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  const encoding = bytes.toString("ascii", 12, 16);
  if (encoding === "VP8X") return { bytes: bytes.length, width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  if (encoding === "VP8 ") return { bytes: bytes.length, width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  if (encoding === "VP8L") {
    const dimensions = bytes.readUInt32LE(21);
    return { bytes: bytes.length, width: (dimensions & 0x3fff) + 1, height: ((dimensions >>> 14) & 0x3fff) + 1 };
  }
  throw new Error(`Format d'image publique non reconnu : ${source}`);
}

function nextSnapshot(uid = "demo-alpha", configs = {}) {
  const state = createDefaultState();
  state.settings.account = { uid, email: `${uid}@example.invalid` };
  state.settings.overlayToken = `synthetic-${uid}`;
  state.settings.overlayConfigs = configs;
  return { state, appVersion: version, overlayUrls: {}, localOverlayUrls: catalog.buildUrls({
    baseUrl: "http://127.0.0.1:17654", credentialName: "token", credentialValue: state.settings.overlayToken, includeRestricted: true
  }) };
}

function fixture(t, { light = false, idle = true, decode = true, actualMetadata = false } = {}) {
  const dom = new JSDOM('<body><main id="content"></main></body>', {
    runScripts: "outside-only", url: pathToFileURL(path.join(renderer, "index.html")).toString()
  });
  const { window } = dom;
  const run = (code) => vm.runInContext(code, dom.getInternalVMContext());
  let visible = true, sequence = 0, catalogCalls = 0;
  const idleTasks = new Map(), timers = new Map(), images = [], requests = [], errors = [];
  window.addEventListener("error", (event) => { errors.push(event.message); event.preventDefault(); });
  window.content = window.document.getElementById("content");
  window.snapshot = null; window.currentPage = "home"; window.overlayDesignSelections = {};
  window.rendererVisualsActive = () => visible;
  window.overlayCatalog = { ...catalog, definitionsWithUrls: (...args) => { catalogCalls += 1; return catalog.definitionsWithUrls(...args); } };
  window.isAccountAuthenticated = () => Boolean(window.snapshot?.state.settings.account.uid);
  window.cryptoId = () => "synthetic-segment";
  window.normalizeGiftValueFilterConfig = (value) => value || null;
  window.fetch = (...args) => { requests.push(args); throw new Error("Réseau interdit dans ce test"); };
  window.shenPulse = new Proxy({}, { get() { throw new Error("Aucun appel opérationnel autorisé"); } });
  window.setTimeout = (callback, delay) => { const id = ++sequence; timers.set(id, { callback, delay }); return id; };
  window.clearTimeout = (id) => timers.delete(id);
  if (idle) {
    window.requestIdleCallback = (callback, options) => { const id = ++sequence; idleTasks.set(id, { callback, options }); return id; };
    window.cancelIdleCallback = (id) => idleTasks.delete(id);
  }
  window.Image = class {
    constructor() { this.naturalWidth = 100; this.naturalHeight = 60; this.decodeCalls = 0; this.cancelled = false; if (!decode) this.decode = undefined; }
    set src(source) {
      this.source = source; this.cancelled = false;
      if (actualMetadata) { const info = assetMetadata(source); this.naturalWidth = info.width; this.naturalHeight = info.height; }
      images.push(this);
    }
    get src() { return this.source; }
    removeAttribute(name) { if (name === "src") this.cancelled = true; }
    decode() { this.decodeCalls += 1; return this.decodePromise || Promise.resolve(); }
    load() { this.onload?.(); }
  };
  for (const file of ["core/ui-foundations.js", "features/studio-design.js", "features/overlays/catalog.js", "features/overlays/placeholders.js",
    "features/overlays/warmup.js", "features/overlays/fields.js", "features/overlays/cards.js"]) run(read(file));
  run(`studioLightMode=${JSON.stringify(light)}; window.warmupTest={
    sync:synchronizeOverlayAssetWarmup, pause:pauseOverlayAssetWarmup, dispose:disposeOverlayAssetWarmup,
    safe:overlayAssetWarmupSafeUrl, state:()=>overlayAssetWarmup,
    limits:()=>({images:OVERLAY_ASSET_WARMUP_LIMIT,pins:OVERLAY_ASSET_WARMUP_PIN_LIMIT,pixels:OVERLAY_ASSET_WARMUP_PIN_PIXELS})
  };`);
  const api = window.warmupTest;
  t.after(() => { api.dispose(); try { assert.deepEqual(requests, []); assert.deepEqual(errors, []); } finally { window.close(); } });
  const accept = (value = nextSnapshot()) => window.acceptSnapshot(value);
  function runOne({ remaining = 20, didTimeout = false } = {}) {
    if (idleTasks.size) {
      const [id, task] = idleTasks.entries().next().value; idleTasks.delete(id);
      task.callback({ timeRemaining: () => remaining, didTimeout }); return true;
    }
    const entry = [...timers].find(([, task]) => task.delay === 100);
    if (!entry) return false;
    timers.delete(entry[0]); entry[1].callback(); return true;
  }
  async function drain() {
    for (let count = 0; count < 250; count += 1) {
      runOne();
      if (api.state().active) api.state().active.image.load();
      await tick();
      if (!idleTasks.size && ![...timers.values()].some((entry) => entry.delay === 100) && !api.state().active) return;
    }
    throw new Error("La file de préparation ne termine pas");
  }
  return { window, api, accept, runOne, drain, images, idleTasks, timers, catalogCalls: () => catalogCalls,
    setVisible: (value) => { visible = value; api.sync(); },
    setLight: (value) => { run(`studioLightMode=${JSON.stringify(value)}; syncStudioPreferences();`); }
  };
}

test("le premier snapshot ne fait aucun travail synchrone lourd, puis prépare le catalogue réutilisé", async (t) => {
  const f = fixture(t); f.accept();
  assert.equal(f.images.length, 0); assert.equal(f.catalogCalls(), 0); assert.equal(f.idleTasks.size, 1);
  assert.equal([...f.idleTasks.values()][0].options.timeout, 1500);
  f.runOne({ remaining: 1 });
  assert.equal(f.images.length, 0); assert.equal(f.catalogCalls(), 0, "un créneau trop court est ignoré");
  await f.drain();
  const before = f.catalogCalls(), first = f.window.overlayDefinitions();
  assert.equal(f.window.overlayDefinitions(), first); assert.equal(f.catalogCalls(), before);
  assert.equal(f.window.document.querySelectorAll("iframe,audio,video").length, 0);
  assert.equal(f.window.document.querySelector("[data-overlay-preview-warmup-host]"), null);
});

test("les assets réels préparés sont exactement ceux des cartes et leur mémoire retenue est bornée", async (t) => {
  const f = fixture(t, { actualMetadata: true }); f.accept(); await f.drain();
  const urls = f.images.map((image) => image.source);
  const expected = new Set(["overlays", "overlay-section-frame", "overlay-section-divider"].map((name) =>
    new URL(`assets/studio/${name}.webp`, f.window.location.href).toString()));
  for (const item of f.window.overlayDefinitions()) {
    const template = f.window.document.createElement("template");
    template.innerHTML = f.window.overlayCardPlaceholder(item, f.window.overlayConfig(item.key));
    for (const image of template.content.querySelectorAll("img[src]")) expected.add(image.getAttribute("src"));
  }
  assert.deepEqual(new Set(urls), expected);
  assert.equal(urls.length, expected.size, "les médailles et cadres répétés ne sont chargés qu'une fois");
  assert.ok(urls.length <= f.api.limits().images);
  assert.ok(f.images.every((image) => image.decodeCalls === 1 && image.fetchPriority === "low" && image.decoding === "async"));
  assert.ok(f.api.state().pinned.size <= f.api.limits().pins);
  assert.ok(f.api.state().pinnedPixels <= f.api.limits().pixels);
  const bytes = urls.reduce((total, url) => total + assetMetadata(url).bytes, 0);
  t.diagnostic(`${urls.length} images publiques réelles, ${bytes} octets lus, ${f.api.state().pinned.size} références conservées, ${f.api.state().pinnedPixels} pixels retenus sur ${f.api.limits().pixels} maximum.`);
  const like = f.window.overlayDefinitions().find((entry) => entry.key === "likeGoal");
  f.window.content.innerHTML = f.window.overlayPreview(like);
  assert.match(f.window.content.querySelector(".overlay-placeholder-frame").src, /banniere_mystique/);
  assert.ok(f.api.state().warmed.has(f.window.content.querySelector(".overlay-placeholder-frame").src));
  assert.equal(f.window.content.querySelector("iframe").src, "about:blank", "le premier design est prêt avant le lecteur paresseux");
});

test("seuls les designs sélectionnés sont préparés, pas toutes les variantes ni les vidéos protégées", async (t) => {
  const f = fixture(t); f.accept(nextSnapshot("demo-alpha", { likeGoal: { theme: "naruto" }, matchX2: { variant: "cyber" }, timer: { theme: "one-piece" } }));
  await f.drain(); const paths = f.images.map((image) => new URL(image.source).pathname);
  assert.equal(paths.filter((value) => value.endsWith("like-goal-theme-naruto.webp")).length, 1, "cinq tranches du même cadre dédupliquées");
  assert.ok(paths.some((value) => value.endsWith("timer-theme-one-piece.webp")));
  assert.ok(paths.some((value) => value.endsWith("x2-cyber.webp")));
  assert.ok(!paths.some((value) => /x2-(?:tikcontrol|gladiador)\.webp|like-goal-theme-gta|\.(?:webm|mp4|gif)$/i.test(value)));
});

test("une seule image se charge/décode à la fois, même avec un grand catalogue", async (t) => {
  const f = fixture(t); f.window.overlayCardPlaceholder = () => Array.from({ length: 100 }, (_, index) =>
    `<img src="${new URL(`../../resources/overlays/media/widgets/example-${index}.webp`, f.window.location.href)}">`).join("");
  f.accept(); f.runOne(); assert.equal(f.images.length, 1);
  f.api.sync(); f.runOne(); assert.equal(f.images.length, 1);
  let release; f.images[0].decodePromise = new Promise((resolve) => { release = resolve; });
  f.images[0].load(); await tick(); f.runOne(); assert.equal(f.images.length, 1);
  release(); await tick(); await f.drain();
  assert.equal(f.images.length, f.api.limits().images);
  assert.equal(f.api.state().active, null);
  assert.equal(f.timers.size, 0);
});

test("le repli sans requestIdleCallback et sans decode espace les tâches sans lecteur caché", async (t) => {
  const f = fixture(t, { idle: false, decode: false }); f.accept();
  assert.equal(f.images.length, 0); assert.deepEqual([...f.timers.values()].map((entry) => entry.delay), [100]);
  await f.drain(); assert.ok(f.images.length > 0);
  assert.ok(f.images.every((image) => image.decodeCalls === 0));
  assert.equal(f.window.document.querySelectorAll("iframe,video,audio").length, 0);
});

test("masquer suspend la lecture courante et ignore son ancien callback avant une reprise bornée", async (t) => {
  const f = fixture(t); f.accept(); f.runOne();
  const image = f.images[0], lateLoad = image.onload;
  f.setVisible(false); assert.equal(image.cancelled, true); assert.equal(f.idleTasks.size, 0);
  lateLoad(); await tick(); assert.equal(image.decodeCalls, 0); assert.equal(f.api.state().warmed.size, 0);
  assert.equal(f.images.length, 1);
  f.setVisible(true); await f.drain();
  assert.equal(f.images[1].source, image.source); assert.ok(f.api.state().warmed.size > 0);
});

test("changer de compte invalide les callbacks et toutes les références de l'ancienne session", async (t) => {
  const f = fixture(t); f.accept(); await f.drain(); assert.ok(f.api.state().pinned.size > 0);
  f.accept(nextSnapshot("demo-beta"));
  assert.equal(f.api.state().warmed.size, 0); assert.equal(f.api.state().pinned.size, 0);
  f.runOne(); const old = f.api.state().active.image, callback = old.onload;
  f.accept(nextSnapshot("demo-gamma")); callback(); await tick();
  assert.equal(old.decodeCalls, 0); assert.equal(f.api.state().warmed.size, 0);
  await f.drain(); assert.ok(f.api.state().owner.includes("demo-gamma"));
});

test("le mode léger prépare le catalogue sans image, puis changer de mode annule immédiatement le décodage", async (t) => {
  const f = fixture(t, { light: true }); f.accept(); await f.drain();
  assert.equal(f.catalogCalls(), 1); assert.equal(f.images.length, 0);
  f.setLight(false); f.runOne(); assert.equal(f.images.length, 1);
  const image = f.images[0]; image.load();
  f.setLight(true); await tick(); await f.drain();
  assert.equal(image.decodeCalls, 0, "le décodage mis en microtâche ne démarre pas après l'activation du mode léger");
  assert.equal(f.images.length, 1); assert.equal(f.api.state().pinned.size, 0);
});

test("détruire la page vide les files, références, timers et ne relance pas un ancien idle", async (t) => {
  const f = fixture(t); f.accept(); const late = [...f.idleTasks.values()][0].callback;
  f.window.dispatchEvent(new f.window.Event("pagehide"));
  late({ timeRemaining: () => 50 }); f.api.sync(); await tick();
  assert.equal(f.api.state().disposed, true); assert.equal(f.idleTasks.size, 0);
  assert.equal(f.images.length, 0); assert.equal(f.api.state().pinned.size, 0); assert.equal(f.api.state().queue.length, 0);
});

test("aucune URL privée/distante ou route locale étrangère ne peut être préparée", (t) => {
  const f = fixture(t); f.accept();
  const allowedFile = new URL("../../resources/overlays/media/widgets/coin-jar/jar-test-front-smooth8.png", f.window.location.href).toString();
  assert.equal(f.api.safe(allowedFile), allowedFile, "le vrai dossier contenant des espaces reste utilisable");
  const local = "http://127.0.0.1:17654/overlay/media/video/posters/x2-cyber.webp?token=synthetic";
  assert.equal(f.api.safe(local), local);
  for (const value of ["https://media.example.invalid/widgets/private.webp", "https://shenpulse-overlays.web.app/media/widgets/frame.webp",
    "http://127.0.0.1:9999/overlay/media/widgets/frame.webp", "http://localhost:17654/overlay/media/widgets/frame.webp",
    "http://127.0.0.1:17654/match-media/private.webp", "http://127.0.0.1:17654/overlay/media/video/x2-cyber.webm",
    "http://127.0.0.1:17654/overlay/media/widgets/../../../../private.webp", "file://foreign/share/widgets/frame.webp",
    new URL("../../private.webp", f.window.location.href).toString(), new URL("assets/studio/users.webp", f.window.location.href).toString()]) {
    assert.equal(f.api.safe(value), "", value);
  }
});

test("un échec ou timeout d'image reste silencieux et ne bloque pas les visuels suivants", async (t) => {
  const f = fixture(t); f.accept(); f.runOne();
  const failed = f.images[0]; failed.onerror();
  f.runOne(); const timeout = [...f.timers.entries()].find(([, task]) => task.delay === 3000);
  f.timers.delete(timeout[0]); timeout[1].callback();
  await f.drain(); assert.ok(f.api.state().warmed.size > 0);
  assert.equal(f.api.state().warmed.has(failed.source), false);
  assert.equal(f.api.state().active, null); assert.equal(f.timers.size, 0);
});

test("les rafales de statistiques ne reconstruisent ni le catalogue ni la file déjà préparée", async (t) => {
  const f = fixture(t), initial = nextSnapshot(); f.accept(initial); await f.drain();
  const count = f.images.length, catalogCount = f.catalogCalls();
  for (let index = 0; index < 200; index += 1) {
    f.accept({ ...initial, state: { ...initial.state, statistics: { sessionLikes: index } } });
  }
  assert.equal(f.idleTasks.size, 0); assert.equal(f.images.length, count); assert.equal(f.catalogCalls(), catalogCount);
  assert.equal(f.timers.size, 0);
});

test("le catalogue réutilisé invalide ses URL même lorsqu'une map est modifiée en place", async (t) => {
  const f = fixture(t), initial = nextSnapshot(); f.accept(initial); await f.drain();
  const before = f.window.overlayDefinitions();
  initial.overlayUrls.myActions = "https://overlays.example.invalid/?view=my-actions&channel=synthetic-renewed";
  const next = f.window.overlayDefinitions();
  assert.notEqual(next, before);
  assert.equal(next.find((item) => item.key === "myActions").url, initial.overlayUrls.myActions);
  assert.equal(f.window.overlayDefinitions(), next, "les manifestes ne sont pas reclonés sans changement de valeurs");
});
