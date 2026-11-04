"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const flush = () => new Promise((resolve) => setImmediate(resolve));

function fixture(withMixer = false) {
  const sounds = [], spoken = [], deadlines = new Map();
  const ctx = vm.createContext({ owner: "one", dialog: { open: true }, rendererAudioOwner: () => ctx.owner,
    setTimeout: (fn) => { const key = {}; deadlines.set(key, fn); return key; }, clearTimeout: (key) => deadlines.delete(key),
    window: { speechSynthesis: { getVoices: () => [{ name: "Windows", lang: "fr-FR" }], speak: (utterance) => spoken.push(utterance), cancel() { this.cancelled = true; } } },
    SpeechSynthesisUtterance: function (text) { this.text = text; },
    Audio: class {
      constructor(url) { this.url = url; this.events = {}; sounds.push(this); }
      addEventListener(name, fn) { this.events[name] = fn; }
      play() { this.played = true; return Promise.resolve(); }
      pause() { this.paused = true; }
      removeAttribute() { this.url = ""; }
    }
  });
  if (withMixer) {
    ctx.speechSynthesis = ctx.window.speechSynthesis;
    ctx.snapshot = { state: { settings: {} } };
    vm.runInContext(fs.readFileSync(require.resolve("../resources/overlays/audio-control.js"), "utf8"), ctx);
  }
  vm.runInContext(fs.readFileSync(require.resolve("../src/renderer/app/core/tts-playback.js"), "utf8"), ctx);
  return { ctx, sounds, spoken, deadlines };
}
test("les voix naturelles et Windows sont lues dans l’ordre sans se couper", async () => {
  const f = fixture();
  f.ctx.queueLocalTtsPlayback({ text: "Un", audioUrl: "data:audio/mpeg;base64,bXAz", volume: .4 });
  f.ctx.queueLocalTtsPlayback({ text: "Deux", voice: "Windows" });
  assert.equal(f.sounds.length, 1); assert.equal(f.spoken.length, 0);
  assert.equal(f.sounds[0].volume, .4);
  f.sounds[0].events.ended(); await flush();
  assert.equal(f.spoken[0].text, "Deux");
  f.spoken[0].onend(); await flush();
  assert.equal(f.deadlines.size, 0);
});
test("un changement de compte coupe l’audio et vide la file", async () => {
  const f = fixture();
  f.ctx.queueLocalTtsPlayback({ text: "Un", audioUrl: "data:audio/mpeg;base64,bXAz" });
  f.ctx.queueLocalTtsPlayback({ text: "Deux" });
  f.ctx.owner = "another";
  f.ctx.stopLocalTtsPlayback(); await flush();
  assert.equal(f.sounds[0].paused, true); assert.equal(f.spoken.length, 0); assert.equal(f.deadlines.size, 0);
});
test("fermer un aperçu ne coupe pas un commentaire LIVE, et aucun aperçu ne repart fermé", async () => {
  const f = fixture();
  f.ctx.queueLocalTtsPlayback({ text: "LIVE" });
  f.ctx.queueLocalTtsPlayback({ text: "Essai", previewScope: "editor-dialog" });
  f.ctx.dialog.open = false;
  f.ctx.stopLocalTtsPlayback(true);
  assert.equal(f.ctx.window.speechSynthesis.cancelled, undefined);
  f.spoken[0].onend(); await flush();
  assert.equal(f.spoken.length, 1);
});

test("le vrai lecteur TTS applique le mixeur au MP3 courant puis à la voix Windows suivante", async () => {
  const f = fixture(true);
  f.ctx.queueLocalTtsPlayback({ text: "Naturelle", audioUrl: "data:audio/mpeg;base64,bXAz", volume: .8 });
  f.ctx.queueLocalTtsPlayback({ text: "Windows", voice: "Windows", volume: .6 });
  f.ctx.snapshot.state.settings.audioMixer = { master: .5, tts: .5 };
  f.ctx.ShenPulseAudio.runtime.update(f.ctx.ShenPulseAudio.stateControl(f.ctx.snapshot.state));
  assert.equal(f.sounds[0].volume, .2);
  f.sounds[0].events.ended(); await flush();
  assert.equal(f.spoken[0].volume, .15);
  f.ctx.snapshot.state.settings.audioMixer.master = 0;
  f.ctx.ShenPulseAudio.runtime.update(f.ctx.ShenPulseAudio.stateControl(f.ctx.snapshot.state));
  assert.equal(f.spoken.at(-1).volume, 0);
  f.ctx.stopLocalTtsPlayback(); await flush();
  assert.equal(f.deadlines.size, 0); assert.equal(f.ctx.ShenPulseAudio.runtime.entries.size, 0);
});
