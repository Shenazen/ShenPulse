"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const { JSDOM, VirtualConsole } = require("jsdom");
const { createDefaultState } = require("../src/main/defaults");
const { version: appVersion } = require("../package.json");

async function until(predicate, message) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function rendererFixture(t) {
  const file = path.join(__dirname, "../src/renderer/index.html");
  const state = createDefaultState();
  const account = { authenticated: true, email: "perf@example.test", uid: "perf-user", displayName: "Performance", emailVerified: true };
  Object.assign(state.settings.account, account);
  state.session.running = true;
  state.session.startedAt = new Date().toISOString();
  const snapshot = { state, packs: [], appVersion, soundCatalog: [], mediaCatalog: [], catalogCounts: {},
    timerRuntime: {}, overlayUrls: {}, localOverlayUrls: {}, publicOverlayRelay: {}, liveDirectory: { available: true, connected: true, rows: [] } };
  const handlers = new Map();
  const errors = [];
  const playback = { audio: 0, speech: [], paused: 0 };
  let visibility = "visible";
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error));
  const dom = new JSDOM(fs.readFileSync(file, "utf8"), {
    url: pathToFileURL(file).toString(), runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole,
    beforeParse(window) {
      Object.defineProperty(window.document, "visibilityState", { get: () => visibility });
      Object.defineProperty(window, "localStorage", { value: { getItem: () => null, setItem() {} } });
      window.shenPulse = {
        getSnapshot: async () => snapshot, searchGifts: async () => ({ gifts: [], total: 0 }), getGameRuntimeStatus: async () => null,
        updates: { check: async () => ({ available: false }) },
        account: { status: async () => account, syncEntitlements: async () => null, gameCheatAccess: async () => ({ allowed: false }) },
        admin: { status: async () => ({ authorized: false }), visibility: async () => state.settings.siteVisibility },
        on: (name, callback) => { handlers.set(name, callback); return () => {}; }
      };
      window.HTMLCanvasElement.prototype.getContext = () => ({ fillRect() {} });
      window.HTMLMediaElement.prototype.play = async () => { playback.audio += 1; };
      window.HTMLMediaElement.prototype.pause = () => { playback.paused += 1; };
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      window.speechSynthesis = { getVoices: () => [], addEventListener() {}, speak: (entry) => playback.speech.push(entry) };
      window.addEventListener("error", (event) => errors.push(event.error || new Error(event.message)));
      window.addEventListener("unhandledrejection", (event) => errors.push(event.reason));
    }
  });
  t.after(() => dom.window.close());
  await until(() => dom.window.document.querySelector(".creator-home-page") && handlers.has("renderer-visibility"), "L'accueil de test ne démarre pas.");
  await new Promise((resolve) => setTimeout(resolve, 100));
  const { window } = dom;
  window.eval(`window.perfCalls = { chrome: 0, render: 0, comparisons: 0, preview: 0 };
    const originalPerfChrome = syncChrome, originalPerfRender = render, originalPerfCompare = creatorPageDataChanged,
      originalPerfPreview = overlayPreviewSessionChanged;
    syncChrome = (...args) => { window.perfCalls.chrome += 1; return originalPerfChrome(...args); };
    render = (...args) => { window.perfCalls.render += 1; return originalPerfRender(...args); };
    creatorPageDataChanged = (...args) => { window.perfCalls.comparisons += 1; return originalPerfCompare(...args); };
    overlayPreviewSessionChanged = (...args) => { window.perfCalls.preview += 1; return originalPerfPreview(...args); };`);
  return { window, handlers, errors, playback, state, setDocumentVisibility: (next) => {
    visibility = next;
    window.document.dispatchEvent(new window.Event("visibilitychange"));
  } };
}

test("minimiser suspend seulement le visuel, conserve les événements et reprend le dernier état public", async (t) => {
  const { window, handlers, errors, playback, state } = await rendererFixture(t);
  const hero = window.document.querySelector(".home-hero");
  const strip = window.document.querySelector("[data-home-live]");
  assert.equal(window.document.querySelectorAll("iframe").length, 0, "Pas de préchauffage depuis l'accueil.");
  handlers.get("renderer-visibility")({ visible: false });
  for (let index = 0; index < 100; index += 1) {
    handlers.get("runtime-state-changed")({ state: { statistics: { ...state.statistics, sessionEvents: index + 1 } } });
    handlers.get("live-event")({ id: `hidden-${index}`, type: "like", timestamp: new Date().toISOString(),
      user: { id: `viewer-${index}`, name: `viewer-${index}` }, data: { count: 1 } });
    handlers.get("live-directory-status")({ available: true, connected: true, rows: [{ id: "public-test", platform: "TikTok",
      username: "test_creator", avatarUrl: "", viewers: index, updatedAt: Date.now() }] });
  }
  await handlers.get("playback")({ type: "audio", url: "https://media.example.test/alert.mp3", volume: 0.5 });
  await handlers.get("playback")({ type: "tts", text: "Le LIVE continue", language: "fr-FR" });
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(window.perfCalls.chrome, 0);
  assert.equal(window.perfCalls.render, 0);
  assert.equal(window.perfCalls.comparisons, 0);
  assert.equal(window.perfCalls.preview, 0);
  assert.equal(window.eval("snapshot.state.statistics.sessionEvents"), 100);
  assert.equal(window.eval("liveEvents.length"), 100);
  assert.equal(window.eval("creatorAudience.size"), 100);
  assert.equal(window.eval("snapshot.liveDirectory.rows[0].viewers"), 99);
  assert.equal(strip.querySelector(".home-live-card"), null, "La carte publique attend le retour du visuel.");
  assert.equal(playback.audio, 1);
  assert.equal(playback.speech[0].text, "Le LIVE continue");
  assert.equal(playback.paused, 0, "Masquer l'interface ne coupe pas l'audio.");
  const audio = window.document.querySelector("#audio-stage audio");
  handlers.get("renderer-visibility")({ visible: true });
  await until(() => strip.querySelector(".home-live-card"), "Le dernier annuaire public n'est pas affiché au retour.");
  assert.equal(strip.querySelector(".home-live-viewers strong").textContent, "99");
  assert.equal(window.document.querySelector(".home-hero"), hero, "Les événements ne recréent pas le hero au retour.");
  assert.equal(window.perfCalls.render, 0);
  assert.equal(window.perfCalls.comparisons, 1, "Une seule comparaison du dernier état remplace la rafale masquée.");
  assert.equal(window.document.querySelector("#audio-stage audio"), audio);
  audio.dispatchEvent(new window.Event("ended"));
  assert.equal(window.document.querySelector("#audio-stage audio"), null);
  assert.equal(errors.length, 0, errors.map((error) => error.stack || error.message).join("\n"));
});

test("visibilitychange et visibilité native se combinent et une mise à jour structurelle reprend une fois", async (t) => {
  const { window, handlers, errors, setDocumentVisibility } = await rendererFixture(t);
  setDocumentVisibility("hidden");
  handlers.get("renderer-visibility")({ visible: false });
  const initial = window.eval("snapshot");
  const beforeHero = window.document.querySelector(".home-hero");
  const changed = { ...initial, packs: [{ id: "connect-four", name: "Un jeu disponible", description: "Catalogue de test", artwork: "catalog/connect-four.png",
    guide: { mode: "integrated" }, requiresPro: false, effects: [], tags: [] }],
    state: { ...initial.state, settings: { ...initial.state.settings,
      siteVisibility: { ...initial.state.settings.siteVisibility, navigation: { ...initial.state.settings.siteVisibility?.navigation, users: { scope: "hidden" } } }
    } } };
  handlers.get("state-changed")(changed);
  setDocumentVisibility("visible");
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(window.perfCalls.render, 0, "La fenêtre native masquée reste suspendue même si le document est visible.");
  handlers.get("renderer-visibility")({ visible: true });
  await until(() => window.document.querySelector('.home-hero') !== beforeHero, "La modification d’accès ne rejoint pas l’accueil après reprise.");
  assert.equal(window.eval('snapshot.packs[0].id'), "connect-four");
  assert.equal(window.document.querySelector('.home-feature[data-navigate="users"]'), null, "Les changements de visibilité continuent de mettre l’accueil à jour.");
  assert.equal(window.document.querySelector('[data-home-game]'), null, "Le catalogue n’est plus rendu sur l’accueil.");
  assert.equal(window.perfCalls.render, 1);
  assert.equal(window.perfCalls.preview, 0, "Sans aperçu, aucune comparaison du runtime overlay n'est exécutée.");
  assert.equal(errors.length, 0, errors.map((error) => error.stack || error.message).join("\n"));
});

test("une mise à jour du catalogue actualise son compteur sans reconstruire l’accueil sans galerie", async (t) => {
  const { window, handlers, errors } = await rendererFixture(t);
  const beforeHero = window.document.querySelector(".home-hero");
  const initial = window.eval("snapshot");
  handlers.get("state-changed")({ ...initial, packs: [{ id: "connect-four", name: "Jeu du catalogue", guide: { mode: "integrated" }, effects: [], tags: [] }] });
  await until(() => window.document.querySelector('#navigation [data-navigate="games"] .nav-count')?.textContent === "1", "Le compteur Jeux ne s’actualise pas.");
  assert.equal(window.document.querySelector(".home-hero"), beforeHero);
  assert.equal(window.document.querySelector("[data-home-game]"), null);
  assert.equal(window.perfCalls.render, 0);
  assert.equal(errors.length, 0, errors.map((error) => error.stack || error.message).join("\n"));
});

test("les vrais patches runtime actualisent immédiatement Matchs et ses widgets sans reconstruire leurs contrôles", async (t) => {
  const { window, handlers, errors, playback, state } = await rendererFixture(t);
  state.commerce.subscription = { tier: "pro", status: "active", source: "own" };
  state.matchSession = { ...state.matchSession, status: "running", scope: { uid: "perf-user", profileId: state.session.profileId },
    participants: [{ id: "own", own: true, username: "creator", avatarUrl: "https://example.test/creator.png", score: 500 }],
    liveContributors: [{ id: "fan", username: "fan", avatarUrl: "https://example.test/fan.png", diamonds: 1, likes: 5 }] };
  window.eval('currentPage = "matches"; creatorMatchesTab = "dashboard"; render();');
  const hero = window.document.querySelector(".studio-hero"), tabs = window.document.querySelector(".matches-tabs");
  const score = window.document.querySelector(".matches-score"), avatar = window.document.querySelector(".matches-participant img");
  const correction = window.document.querySelector('[data-action="matches-correct-wins"]');
  correction.focus();
  window.perfCalls.render = 0;
  const runtime = { ...window.eval("snapshot.state.matchSession"),
    participants: [{ ...state.matchSession.participants[0], score: 1250 }], rounds: { own: 3, opponent: 1 } };
  handlers.get("runtime-state-changed")({ state: { matchSession: runtime } });
  await until(() => score.textContent === "1 250", "Le score Matchs ne rejoint pas le patch runtime.");
  assert.equal(window.document.querySelector(".studio-hero"), hero);
  assert.equal(window.document.querySelector(".matches-tabs"), tabs);
  assert.equal(window.document.querySelector(".matches-participant img"), avatar);
  assert.equal(window.document.querySelector('[data-action="matches-correct-wins"]'), correction);
  assert.equal(window.document.activeElement, correction);
  assert.equal(window.perfCalls.render, 0);

  window.eval('creatorMatchesTab = "widgets"; render();');
  const wins = window.document.querySelector('[data-matches-widget-preview="wins"]');
  const donor = window.document.querySelector('[data-matches-widget-preview="donors"] [data-matches-preview-person="fan"]');
  const donorPhoto = donor.querySelector("img"), poster = window.document.querySelector(".matches-animation-poster");
  const configure = window.document.querySelector('[data-action="matches-widget-edit"]');
  configure.focus();
  window.perfCalls.render = 0;
  handlers.get("runtime-state-changed")({ state: { matchSession: { ...runtime, rounds: { own: 4, opponent: 1 },
    liveContributors: [{ ...state.matchSession.liveContributors[0], diamonds: 15, likes: 80 }] } } });
  await until(() => wins.querySelector(".matches-widget-value").textContent === "4", "Le compteur du widget reste figé après le patch runtime.");
  assert.match(donor.textContent, /15.*80 likes/s);
  assert.equal(donor.querySelector("img"), donorPhoto);
  assert.equal(window.document.querySelector(".matches-animation-poster"), poster);
  assert.equal(window.document.querySelector('[data-action="matches-widget-edit"]'), configure);
  assert.equal(window.document.activeElement, configure);
  assert.equal(window.perfCalls.render, 0);
  assert.equal(window.document.querySelector(".creator-matches-page iframe, .creator-matches-page video, .creator-matches-page audio"), null);
  assert.equal(playback.audio, 0);
  assert.deepEqual(playback.speech, []);
  assert.equal(errors.length, 0, errors.map((error) => error.stack || error.message).join("\n"));
});
