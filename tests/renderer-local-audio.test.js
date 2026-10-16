"use strict";

/** Audio factice et DOM isolé : aucun périphérique ni son réel n'est utilisé. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { createDefaultState } = require("../src/main/defaults");

const renderer = path.join(__dirname, "../src/renderer");
const read = (file) => fs.readFileSync(path.join(renderer, "app", file), "utf8");
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function fixture(t) {
  const dom = new JSDOM(fs.readFileSync(path.join(renderer, "index.html"), "utf8"), { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const { window } = dom, context = dom.getInternalVMContext(), sounds = [], toasts = [], requests = [];
  const run = (source) => vm.runInContext(source, context);
  window.shenPulse = {};
  window.ShenPulseVisibility = require("../src/shared/visibility-catalog");
  window.ShenPulseOverlayCatalog = require("../resources/overlays/overlay-catalog");
  window.HTMLMediaElement.prototype.play = async function () { sounds.push(this); };
  window.HTMLMediaElement.prototype.pause = function () { this.wasPaused = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  run(read("core/bootstrap.js"));
  run(read("core/ui-foundations.js"));
  run(read("core/account-operation-guard.js"));
  run(read("features/media/library.js"));
  run(read("core/audio-playback.js"));
  window.toast = (...args) => toasts.push(args);
  const state = createDefaultState(); state.settings.account = { uid: "audio-owner" };
  window.audioFixtureSnapshot = { state, localOverlayUrls: { base: "http://127.0.0.1:4567" } };
  run("snapshot=audioFixtureSnapshot; accountSession={authenticated:true,uid:'audio-owner'};");
  window.shenPulse.on = (name, handler) => requests.push({ name, handler });
  const playback = read("core/events/dialog-content.js");
  run(playback.slice(playback.indexOf('api.on("playback",')));
  return { window, run, sounds, toasts, state, requests,
    play: (payload) => window.playRendererAudio(payload),
    audio: () => window.document.querySelector("#audio-stage audio"),
    openLibrary: () => run("mediaLibraryDialog.open=true; mediaLibraryContext={kind:'sound'};") };
}

test("la notification principale joue dans ShenPulse sans source navigateur ni diffusion", async (t) => {
  const f = fixture(t);
  await f.requests.find((entry) => entry.name === "playback").handler({ type: "audio", url: "https://media.example.invalid/son.mp3", volume: .9 });
  assert.equal(f.sounds.length, 1); assert.equal(f.sounds[0], f.audio());
  assert.equal(f.audio().muted, false); assert.equal(f.audio().defaultMuted, false);
  assert.equal(f.audio().volume, .9); assert.equal(f.toasts.length, 0);
  assert.equal(f.window.document.querySelector("iframe"), null);
  assert.equal(f.requests.length, 1, "aucun appel ou publication LIVE depuis le lecteur local");
});

test("un son fourni est résolu sur le serveur local avec son jeton sans dépendre du lien Studio", async (t) => {
  const f = fixture(t); f.state.settings.overlayToken = "jeton-fixture";
  f.openLibrary();
  await f.play({ type: "audio", url: "/overlay/media/kenney/son.ogg", previewScope: "media-library" });
  assert.equal(f.audio().src, "http://127.0.0.1:4567/overlay/media/kenney/son.ogg?token=jeton-fixture");
  const audio = f.audio(); f.window.stopMediaLibraryPreview("/overlay/media/kenney/son.ogg");
  assert.equal(audio.wasPaused, true); assert.equal(f.audio(), null);
});

test("les formats audio en mémoire restent lisibles et les adresses non audio sont refusées", async (t) => {
  const f = fixture(t);
  for (const url of ["data:audio/wav;base64,AAAA", "blob:https://example.invalid/audio-fixture"]) {
    await f.play({ url }); assert.equal(f.audio().src, url);
  }
  const last = f.audio();
  for (const url of ["javascript:alert(1)", "data:text/html,test", "file:///C:/private.wav", "/private.wav", ""]) {
    await f.play({ url }); assert.equal(f.audio(), last);
  }
  assert.equal(f.sounds.length, 2); assert.equal(f.toasts.length, 5);
});

test("le volume est borné sans rendre silencieux un volume invalide", async (t) => {
  const f = fixture(t);
  for (const [input, expected] of [[0, 0], [-1, 0], [2, 1], [.25, .25], ["incorrect", 1], [Infinity, 1]]) {
    await f.play({ url: "https://media.example.invalid/son.mp3", volume: input });
    assert.equal(f.audio().volume, expected);
  }
});

test("une sortie système par défaut ne nécessite pas setSinkId", async (t) => {
  const f = fixture(t);
  await f.play({ url: "https://media.example.invalid/son.mp3", outputDeviceId: "default" });
  assert.equal(f.sounds.length, 1); assert.equal(f.toasts.length, 0);
});

test("une sortie explicite indisponible nettoie son lecteur et explique l'erreur", async (t) => {
  const f = fixture(t);
  f.window.HTMLMediaElement.prototype.setSinkId = async () => { throw new Error("erreur matérielle"); };
  await f.play({ url: "https://media.example.invalid/son.mp3", outputDeviceId: "removed-device" });
  assert.equal(f.sounds.length, 0); assert.equal(f.audio(), null);
  assert.equal(f.toasts[0][0], "Périphérique audio indisponible");
});

test("la résolution tardive d'une ancienne sortie ne joue pas un son supprimé", async (t) => {
  const f = fixture(t), sink = deferred();
  f.window.HTMLMediaElement.prototype.setSinkId = () => sink.promise;
  const old = f.play({ url: "https://media.example.invalid/ancien.mp3", outputDeviceId: "device-a" });
  const oldAudio = f.audio();
  await f.play({ url: "https://media.example.invalid/nouveau.mp3" });
  const current = f.audio(); sink.resolve(); await old;
  assert.equal(f.sounds.length, 1); assert.equal(f.sounds[0], current);
  assert.equal(f.audio(), current); assert.equal(oldAudio.wasPaused, true);
  assert.equal(f.toasts.length, 0);
});

test("l'échec tardif d'une ancienne sortie ne coupe pas le nouveau son", async (t) => {
  const f = fixture(t), sink = deferred();
  f.window.HTMLMediaElement.prototype.setSinkId = () => sink.promise;
  const old = f.play({ url: "https://media.example.invalid/ancien.mp3", outputDeviceId: "device-a" });
  await f.play({ url: "https://media.example.invalid/nouveau.mp3" });
  const current = f.audio(); sink.reject(new Error("ancienne sortie")); await old;
  assert.equal(f.audio(), current); assert.equal(f.toasts.length, 0);
});

test("un changement de compte ou de profil empêche une lecture en attente et coupe le son courant", async (t) => {
  for (const change of ["compte", "profil", "déconnexion"]) {
    const f = fixture(t), sink = deferred();
    f.window.HTMLMediaElement.prototype.setSinkId = () => sink.promise;
    const pending = f.play({ url: "https://media.example.invalid/son.mp3", outputDeviceId: "device-a" });
    if (change === "déconnexion") f.window.invalidateCreatorPrivateOperations();
    else {
      f.window.nextAudioSnapshot = JSON.parse(JSON.stringify(f.window.audioFixtureSnapshot));
      if (change === "compte") f.window.nextAudioSnapshot.state.settings.account.uid = "autre";
      else f.window.nextAudioSnapshot.state.session.profileId = "autre-profil";
      f.run("acceptSnapshot(nextAudioSnapshot);");
    }
    sink.resolve(); await pending;
    assert.equal(f.audio(), null, change); assert.equal(f.sounds.length, 0, change);
    assert.equal(f.toasts.length, 0, change);
  }
});

test("fermer un sélecteur pendant le choix du périphérique annule son aperçu", async (t) => {
  const f = fixture(t), sink = deferred(); f.openLibrary();
  f.window.HTMLMediaElement.prototype.setSinkId = () => sink.promise;
  const pending = f.play({ url: "https://media.example.invalid/son.mp3", outputDeviceId: "device-a", previewScope: "media-library" });
  f.window.closeMediaLibrary(); sink.resolve(); await pending;
  assert.equal(f.sounds.length, 0); assert.equal(f.audio(), null);
  await f.play({ url: "https://media.example.invalid/son.mp3", previewScope: "media-library" });
  await f.play({ url: "https://media.example.invalid/son.mp3", previewScope: "editor-dialog" });
  assert.equal(f.sounds.length, 0, "les notifications arrivées après fermeture sont ignorées");
});

test("les échecs d'autoplay et de décodage ne restent plus silencieux", async (t) => {
  const f = fixture(t);
  f.window.HTMLMediaElement.prototype.play = async () => { throw Object.assign(new Error("refus"), { name: "NotAllowedError" }); };
  await f.play({ url: "https://media.example.invalid/son.mp3" });
  assert.equal(f.audio(), null); assert.match(f.toasts[0][1], /bloquée/);
  f.window.HTMLMediaElement.prototype.play = async function () { f.sounds.push(this); };
  await f.play({ url: "https://media.example.invalid/son.mp3" });
  const audio = f.audio();
  Object.defineProperty(audio, "error", { value: { code: 4 } });
  audio.dispatchEvent(new f.window.Event("error"));
  assert.equal(f.audio(), null); assert.match(f.toasts.at(-1)[1], /pas lisible/);
});

test("la fin du son libère le média et un ancien événement ne retire pas le lecteur suivant", async (t) => {
  const f = fixture(t);
  await f.play({ url: "https://media.example.invalid/ancien.mp3" }); const old = f.audio();
  await f.play({ url: "https://media.example.invalid/nouveau.mp3" }); const current = f.audio();
  old.dispatchEvent(new f.window.Event("ended")); assert.equal(f.audio(), current);
  current.dispatchEvent(new f.window.Event("ended")); assert.equal(f.audio(), null);
  assert.equal(f.run("activePreviewAudio"), null); assert.equal(f.run("activePreviewAudioScope"), "");
});
