"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const source = fs.readFileSync(path.join(__dirname, "../resources/overlays/runtime/widgets/match-audio.js"), "utf8");
const tick = () => new Promise((resolve) => setImmediate(resolve));
const refusal = () => Object.assign(new Error("Permission refusée"), { name: "NotAllowedError" });

/** Vrai helper et DOM, mais aucun média, périphérique sonore, réseau ou LIVE. */
function fixture(t, { preview = false, enabled = true, query = "", play } = {}) {
  const dom = new JSDOM('<div id="stage"><video id="first" muted></video><video id="second" muted></video></div>',
    { url: "http://127.0.0.1:17654/match/", runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const window = dom.window;
  const calls = [], failures = [];
  window.parameters = new window.URLSearchParams(query);
  window.isCatalogPreview = preview;
  window.overlaySoundEnabled = enabled;
  window.setTimeout = window.setInterval = window.requestAnimationFrame = () => {
    throw new Error("Le helper audio ne doit pas créer de boucle ni de timer.");
  };
  window.HTMLMediaElement.prototype.play = function simulatedPlay() {
    const call = { id: this.id, muted: this.muted, defaultMuted: this.defaultMuted,
      attribute: this.hasAttribute("muted"), volume: this.volume, src: this.getAttribute("src") };
    calls.push(call);
    return play ? play(call, calls.length) : Promise.resolve();
  };
  vm.runInContext(source, dom.getInternalVMContext());
  const first = window.document.getElementById("first"), second = window.document.getElementById("second");
  for (const video of [first, second]) video.src = `/match-media/${video.id}`;
  return { window, calls, failures, first, second,
    start: (video = first, options = {}) => window.playMatchVideo(video,
      { onFailure: (reason) => failures.push(reason), ...options }),
    stop: (video = first) => window.stopMatchVideoAudio(video),
    notice: () => window.document.getElementById("match-enable-audio"),
    error: () => window.document.documentElement.dataset.matchAudioError };
}

test("la vraie vidéo de match démarre avec son natif, sans attribut muet résiduel", async (t) => {
  const h = fixture(t);
  assert.equal(await h.start(), true);
  assert.deepEqual(h.calls[0], { id: "first", muted: false, defaultMuted: false, attribute: false,
    volume: 1, src: "/match-media/first" });
  assert.equal(h.notice(), null);
  assert.equal(h.error(), undefined);
  h.stop();
});

test("les aperçus et la désactivation sonore restent muets", async (t) => {
  for (const options of [{ preview: true }, { enabled: false }]) {
    const h = fixture(t, options);
    await h.start();
    assert.equal(h.calls.length, 1);
    assert.equal(h.first.muted, true);
    assert.equal(h.first.defaultMuted, true);
    assert.equal(h.notice(), null);
    h.stop();
  }
});

test("le volume explicite respecte zéro, les bornes et le défaut à 100 %", async (t) => {
  for (const [raw, expected] of [["0", 0], ["40", .4], ["150", 1], ["-10", 0],
    ["NaN", 1], ["Infinity", 1], ["", 1]]) {
    const h = fixture(t, { query: `soundVolume=${encodeURIComponent(raw)}` });
    await h.start();
    assert.equal(h.first.volume, expected, raw);
    assert.equal(h.first.muted, false);
    h.stop();
  }
});

test("une source au repos, détachée ou déjà périmée ne lance aucune lecture", async (t) => {
  const h = fixture(t);
  h.first.removeAttribute("src");
  assert.equal(await h.start(), false);
  h.first.src = "/match-media/new";
  assert.equal(await h.start(h.first, { isCurrent: () => false }), false);
  h.first.remove();
  assert.equal(await h.start(), false);
  assert.equal(h.calls.length, 0);
  assert.equal(h.notice(), null);
});

test("le refus sonore conserve le visuel et affiche une activation audio explicite", async (t) => {
  const h = fixture(t, { play: (call) => call.muted ? Promise.resolve() : Promise.reject(refusal()) });
  assert.equal(await h.start(), true);
  assert.deepEqual(h.calls.map((call) => call.muted), [false, true]);
  assert.equal(h.error(), "audio-autoplay-refused");
  assert.equal(h.first.dataset.matchAudioError, "audio-autoplay-refused");
  assert.equal(h.notice().textContent, "Activer le son");
  assert.equal(h.notice().style.pointerEvents, "auto");
  assert.deepEqual(h.failures, []);
  h.stop();
  assert.equal(h.notice(), null);
  assert.equal(h.error(), undefined);
});

test("le geste active immédiatement les deux vidéos enregistrées et retire le bouton unique", async (t) => {
  let authorized = false;
  const h = fixture(t, { play: (call) => authorized || call.muted ? Promise.resolve() : Promise.reject(refusal()) });
  await h.start(); await h.start(h.second);
  assert.equal(h.window.document.querySelectorAll("#match-enable-audio").length, 1);
  const outsider = h.window.document.createElement("video");
  outsider.id = "not-registered"; outsider.src = "/match-media/outsider";
  h.window.document.body.appendChild(outsider);
  authorized = true;
  const before = h.calls.length;
  h.notice().click();
  assert.equal(h.calls.length, before + 2, "play() est appelé dans le click, sans await préalable");
  assert.deepEqual(h.calls.slice(before).map((call) => [call.id, call.muted]), [["first", false], ["second", false]]);
  await tick();
  assert.equal(h.notice(), null);
  assert.equal(h.error(), undefined);
  assert.equal(h.first.dataset.matchAudioError, undefined);
  assert.equal(h.second.dataset.matchAudioError, undefined);
  h.stop(); h.stop(h.second);
});

test("un nouveau refus du geste reste signalé, sans boucle de lecture", async (t) => {
  const h = fixture(t, { play: (call) => call.muted ? Promise.resolve() : Promise.reject(refusal()) });
  await h.start();
  h.notice().click(); await tick();
  assert.deepEqual(h.calls.map((call) => call.muted), [false, true, false, true]);
  assert.ok(h.notice());
  assert.equal(h.error(), "audio-autoplay-refused");
  h.stop();
});

test("retirer une vidéo bloquée conserve le bouton pour l'autre, puis nettoie tout", async (t) => {
  const h = fixture(t, { play: (call) => call.muted ? Promise.resolve() : Promise.reject(refusal()) });
  await h.start(); await h.start(h.second);
  const button = h.notice();
  h.stop();
  assert.equal(h.first.dataset.matchAudioError, undefined);
  assert.equal(h.second.dataset.matchAudioError, "audio-autoplay-refused");
  assert.equal(h.notice(), button);
  h.stop(h.second);
  assert.equal(h.notice(), null);
  assert.equal(h.error(), undefined);
});

test("un refus synchrone de play suit le même secours sonore borné", async (t) => {
  const h = fixture(t, { play: (call) => {
    if (!call.muted) throw refusal();
    return Promise.resolve();
  } });
  assert.equal(await h.start(), true);
  assert.deepEqual(h.calls.map((call) => call.muted), [false, true]);
  assert.ok(h.notice());
  assert.deepEqual(h.failures, []);
  h.stop();
});

test("une erreur générique ou un refus muet appelle l'échec sans tentative gratuite", async (t) => {
  for (const options of [{ play: () => Promise.reject(new Error("Décodeur indisponible")) },
    { preview: true, play: () => Promise.reject(refusal()) }]) {
    const h = fixture(t, options);
    assert.equal(await h.start(), false);
    assert.equal(h.calls.length, 1);
    assert.deepEqual(h.failures, ["autoplay-refused"]);
    assert.equal(h.notice(), null);
    h.stop();
  }
});

test("un refus tardif après arrêt, changement de source ou détachement ne ressuscite rien", async (t) => {
  for (const invalidate of [(h) => h.stop(), (h) => { h.first.src = "/match-media/replaced"; },
    (h) => h.first.remove()]) {
    let reject;
    const h = fixture(t, { play: () => new Promise((_resolve, failed) => { reject = failed; }) });
    const pending = h.start();
    invalidate(h); reject(refusal());
    assert.equal(await pending, false);
    assert.equal(h.calls.length, 1);
    assert.deepEqual(h.failures, []);
    assert.equal(h.notice(), null);
    assert.equal(h.error(), undefined);
  }
});

test("le résultat d'une ancienne lecture ne supprime pas l'alerte d'une nouvelle", async (t) => {
  let resolveOld;
  const h = fixture(t, { play: (call, count) => count === 1
    ? new Promise((resolve) => { resolveOld = resolve; })
    : call.muted ? Promise.resolve() : Promise.reject(refusal()) });
  const old = h.start();
  await h.start();
  resolveOld(); assert.equal(await old, false);
  assert.ok(h.notice());
  assert.equal(h.error(), "audio-autoplay-refused");
  h.stop();
});

test("l'activation tardive d'une vidéo arrêtée ne supprime pas l'alerte de l'autre", async (t) => {
  let userGesture = false, resolveGesture;
  const h = fixture(t, { play: (call) => {
    if (userGesture && call.id === "first") return new Promise((resolve) => { resolveGesture = resolve; });
    return call.muted ? Promise.resolve() : Promise.reject(refusal());
  } });
  await h.start(); await h.start(h.second);
  userGesture = true; h.notice().click();
  h.stop(); resolveGesture(); await tick();
  assert.equal(h.first.dataset.matchAudioError, undefined);
  assert.equal(h.second.dataset.matchAudioError, "audio-autoplay-refused");
  assert.ok(h.notice());
  assert.equal(h.error(), "audio-autoplay-refused");
  h.stop(h.second);
});

test("un média terminé ou révoqué n'est pas réactivé par le bouton", async (t) => {
  let current = true;
  const h = fixture(t, { play: (call) => call.muted ? Promise.resolve() : Promise.reject(refusal()) });
  await h.start(h.first, { isCurrent: () => current });
  await h.start(h.second);
  current = false;
  Object.defineProperty(h.second, "ended", { configurable: true, value: true });
  const before = h.calls.length;
  h.notice().click(); await tick();
  assert.equal(h.calls.length, before);
  assert.equal(h.notice(), null);
  assert.equal(h.error(), undefined);
});
