"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { JSDOM } = require("jsdom");
const catalog = require("../resources/overlays/overlay-catalog");

const source = fs.readFileSync(path.join(__dirname, "../src/renderer/app/features/overlays/catalog.js"), "utf8");

function previewFixture(t, { page = "overlays" } = {}) {
  const dom = new JSDOM('<body><main id="content"></main><dialog id="editor"><div id="editor-body"></div></dialog><div id="audio-stage"><audio></audio></div></body>', {
    runScripts: "outside-only", pretendToBeVisual: true, url: "http://127.0.0.1:41738/"
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const hydrated = [];
  const observers = [];
  let active = true;
  window.currentPage = page;
  window.rendererVisualsActive = () => active;
  window.content = window.document.getElementById("content");
  window.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.frames = new Set(); observers.push(this); }
    observe(frame) { this.frames.add(frame); }
    unobserve(frame) { this.frames.delete(frame); }
    trigger(frame, isIntersecting) { this.callback([{ target: frame, isIntersecting }]); }
  };
  window.snapshot = { state: { settings: { overlayConfigs: {}, overlayToken: "test" }, overlaySession: { winCounterCurrent: 7 } },
    overlayUrls: {}, localOverlayUrls: { likeGoal: "http://127.0.0.1:17654/overlay/?view=like-goal&token=test", timer: "http://127.0.0.1:17654/overlay/?view=timer&token=test" } };
  const items = Object.entries(window.snapshot.localOverlayUrls).map(([key, url]) => ({ key, url, parameter: "theme", previewView: key, defaultOption: "classic" }));
  window.overlayDesignSelections = {};
  window.overlayCatalog = { configParameterMappings: { theme: "theme" }, defaultConfig: () => ({}), definitionsWithUrls: () => items, normalizeDesign: catalog.normalizeDesign };
  window.isAccountAuthenticated = () => true;
  window.normalizeWheelConfig = (value) => value;
  window.escapeHtml = (value) => String(value || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  window.overlaySourceSize = () => ({ width: 900, height: 360 });
  window.hydrateOverlayPreviewFrame = (frame) => hydrated.push({ frame, state: window.snapshot.state.overlaySession });
  window.eval(source + `\nwindow.previewTest = { render: overlayRuntimeFrame, bind: bindOverlayRuntimeFrames, suspend: suspendOverlayRuntimePreviews,
    resume: resumeOverlayRuntimePreviews, dispose: disposeOverlayRuntimePreviews, prioritize: prioritizeOverlayRuntimePreview,
    activeLoads: () => activeOverlayPreviewLoads, queued: () => overlayPreviewLoadQueue.length, observed: () => observedOverlayRuntimeFrames.size };`);
  function add(key = "timer", root = window.content, options = {}) {
    root.insertAdjacentHTML("beforeend", window.previewTest.render({ key, name: key, previewView: key }, null, options));
    return root.lastElementChild;
  }
  return { window, add, hydrated, observer: observers[0], api: window.previewTest, setActive: (value) => { active = value; } };
}

test("l'accueil ne crée aucun cache ni iframe d'overlay, y compris en mode léger", (t) => {
  const { window, api } = previewFixture(t, { page: "home" });
  window.studioLightMode = true;
  api.bind(window.document);
  api.prioritize("timer");
  assert.equal(window.document.querySelectorAll("iframe").length, 0);
  assert.equal(window.document.querySelector("[data-overlay-preview-warmup-host]"), null);
  assert.equal(api.queued(), 0);
  assert.equal(api.activeLoads(), 0);
});

test("la galerie charge les cartes intersectantes et libère réellement celles hors écran", (t) => {
  const { window, api, add, observer, hydrated } = previewFixture(t);
  const frame = add();
  api.bind(window.content);
  const original = frame.querySelector("iframe");
  assert.equal(original.src, "about:blank");
  observer.trigger(frame, true);
  assert.match(original.src, /view=timer/);
  assert.equal(api.activeLoads(), 1);
  original.dispatchEvent(new window.Event("load"));
  assert.equal(api.activeLoads(), 0);
  assert.equal(hydrated.length, 1);
  observer.trigger(frame, false);
  assert.equal(frame.querySelector("iframe"), null);
  assert.equal(original.isConnected, false);
  assert.ok(frame.shenPulseSuspendedPreview.every((entry) => Array.isArray(entry)));
  assert.equal(api.activeLoads(), 0);
  window.snapshot.state.overlaySession = { winCounterCurrent: 9 };
  observer.trigger(frame, true);
  const resumed = frame.querySelector("iframe");
  assert.notEqual(resumed, original);
  assert.match(resumed.src, /view=timer/);
  resumed.dispatchEvent(new window.Event("load"));
  assert.equal(hydrated.at(-1).state.winCounterCurrent, 9);
});

test("le chargement reste borné à deux et la sortie supprime files, observers et documents", (t) => {
  const { window, api, add, observer } = previewFixture(t);
  const frames = [add(), add("likeGoal"), add()];
  api.bind(window.content);
  for (const frame of frames) observer.trigger(frame, true);
  assert.equal(api.activeLoads(), 2);
  assert.equal(api.queued(), 1);
  api.dispose(window.content);
  assert.equal(api.activeLoads(), 0);
  assert.equal(api.queued(), 0);
  assert.equal(api.observed(), 0);
  assert.equal(observer.frames.size, 0);
  assert.equal(window.content.querySelectorAll("iframe").length, 0);
  assert.ok(frames.every((frame) => !frame.shenPulseSuspendedPreview));
});

test("masquer la fenêtre suspend galerie, éditeur et scène sans toucher à l'audio ni au brouillon", (t) => {
  const { window, api, add, observer, setActive } = previewFixture(t);
  const gallery = add();
  const editor = window.document.getElementById("editor");
  editor.setAttribute("open", "");
  const body = window.document.getElementById("editor-body");
  body.innerHTML = '<input name="draft" value="Mon design non enregistré">';
  const edited = add("timer", body, { context: "live", editable: true, loading: "eager" });
  const draft = body.querySelector("input");
  window.content.insertAdjacentHTML("beforeend", '<iframe data-scene-preview src="http://127.0.0.1:17654/overlay/?view=scene&token=test&preview=static"></iframe>');
  const audio = window.document.querySelector("#audio-stage audio");
  let reapplied = 0;
  let sceneHydrated = 0;
  window.scheduleOverlayLivePreview = () => { reapplied += 1; };
  window.hydrateSceneComposerPreview = () => { sceneHydrated += 1; };
  api.bind(window.document);
  observer.trigger(gallery, true);
  setActive(false);
  api.suspend();
  assert.equal(window.document.querySelectorAll("iframe").length, 0);
  assert.equal(window.document.querySelector("#audio-stage audio"), audio);
  assert.equal(body.querySelector("input"), draft);
  assert.equal(draft.value, "Mon design non enregistré");
  assert.equal(api.activeLoads(), 0);
  setActive(true);
  api.resume();
  const resumedEditor = edited.querySelector("iframe");
  resumedEditor.dispatchEvent(new window.Event("load"));
  assert.equal(reapplied, 1);
  const scene = window.document.querySelector("[data-scene-preview]");
  scene.dispatchEvent(new window.Event("load"));
  assert.equal(sceneHydrated, 1);
  assert.equal(gallery.querySelector("iframe").src, "about:blank", "La galerie reprend paresseusement après intersection.");
  assert.equal(window.document.querySelector("#audio-stage audio"), audio);
});

test("un dialogue fermé ne peut pas conserver ou recréer son aperçu", (t) => {
  const { window, api, add } = previewFixture(t, { page: "home" });
  const editor = window.document.getElementById("editor");
  editor.setAttribute("open", "");
  const body = window.document.getElementById("editor-body");
  add("timer", body, { context: "live", editable: true, loading: "eager" });
  api.bind(body);
  assert.equal(body.querySelectorAll("iframe").length, 1);
  editor.removeAttribute("open");
  api.dispose(body);
  api.resume();
  assert.equal(body.querySelectorAll("iframe").length, 0);
  assert.equal(api.activeLoads(), 0);
});

test("recréer une carte reprend le design et la configuration courants plutôt que l'ancienne URL", (t) => {
  const { window, api, add, observer } = previewFixture(t);
  const frame = add();
  api.bind(window.content);
  observer.trigger(frame, true);
  observer.trigger(frame, false);
  window.snapshot.state.settings.overlayConfigs.timer = { theme: "naruto", title: "Nouveau titre" };
  window.overlayCatalog.configParameterMappings.title = "title";
  observer.trigger(frame, true);
  let url = new URL(frame.querySelector("iframe").src);
  assert.equal(url.searchParams.get("theme"), "naruto");
  assert.equal(url.searchParams.get("title"), "Nouveau titre");
  observer.trigger(frame, false);
  window.overlayDesignSelections.timer = "one-piece";
  observer.trigger(frame, true);
  url = new URL(frame.querySelector("iframe").src);
  assert.equal(url.searchParams.get("theme"), "one-piece", "Le design d'aperçu non enregistré est également conservé.");
});
