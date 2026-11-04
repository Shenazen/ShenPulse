"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { AudioMixer, stateControl } = require("../resources/overlays/audio-control");
const { ActionRunner } = require("../src/main/action-runner");
const { normalizeMatchPlaybackRequest, overlayViewAcceptsChannel } = require("../src/main/overlay-server");
const { createMatchRelayMessage } = require("../src/main/relay/match-messages");
const { synchronizeAudioControl } = require("../src/main/audio-control");
const { selectStatePaths } = require("../src/main/state/projections");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const tick = () => new Promise(resolve => setImmediate(resolve));
function browser(t, html = '<video id="v" src="movie.webm"></video><div id="audio-stage"></div>') {
  const dom = new JSDOM(html, { url: "https://shenpulse-overlays.web.app/?view=match", runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window, context = dom.getInternalVMContext();
  vm.runInContext(read("resources/overlays/audio-control.js"), context);
  w.HTMLMediaElement.prototype.play = () => Promise.resolve(); w.HTMLMediaElement.prototype.pause = () => {};
  return { w, context, mixer: w.ShenPulseAudio.runtime, run: code => vm.runInContext(code, context) };
}

test("volume commun : réglage en cours sur tous les médias, 0 %, valeurs invalides et nettoyage", t => {
  const { w, mixer } = browser(t);
  const media = ["sounds", "tts", "matches", "overlays"].map(kind => {
    const el = w.document.createElement("audio"); mixer.media(el, kind, { volume: .8 }); return el;
  });
  mixer.update({ settings: { master: .5, sounds: .25, tts: .5, matches: .75, overlays: 1 } });
  media.forEach((el, index) => assert.ok(Math.abs(el.volume - [.1, .2, .3, .4][index]) < 1e-12));
  mixer.update({ settings: { master: 0 } }); assert.deepEqual(media.map(el => el.volume), [0, 0, 0, 0]);
  mixer.update({ settings: { master: "invalide", sounds: Infinity } }); assert.equal(media[0].volume, .8);
  for (const el of media) el.dispatchEvent(new w.Event("ended")); assert.equal(mixer.entries.size, 0);
});

test("un volume d’action modifié ajuste le son courant et survit aux états publics sans liste d’actions", t => {
  const { w, mixer } = browser(t), media = w.document.createElement("audio");
  mixer.media(media, "sounds", { volume: .9, originActionId: "sound" });
  mixer.update({ settings: { master: .5 }, actions: { sound: .2 } }); assert.equal(media.volume, .1);
  mixer.update({ settings: { master: .5 }, actions: {} }); assert.equal(media.volume, .1);
  mixer.update({ settings: {}, actions: { sound: 0 } }); assert.equal(media.volume, 0);
  const preview = w.document.createElement("audio"); mixer.media(preview, "sounds", { volume: .6, originActionId: "sound", previewScope: "editor-dialog" });
  assert.equal(preview.volume, .6, "le brouillon de l’éditeur n’est pas remplacé par sa valeur sauvegardée");
});

test("les sons du pack actif et les réactions Matchs suivent leur volume propre sans publier les autres packs", () => {
  const state = { settings: { matches: { automations: [{ id: "bonus", reaction: { type: "bundle", reactions: [{ type: "animation", volume: .15 }, { type: "sound", volume: 0 }] } }] } },
    session: { game: { packId: "game" } }, game: { interactionRulesByPack: {
      game: [{ actions: [{ id: "game-sound", type: "audio.play", config: { volume: .4 } }] }],
      other: [{ actions: [{ id: "private-other", type: "audio.play", config: { volume: .5 } }] }]
    } } };
  const control = stateControl(state);
  assert.deepEqual(control.actions, { "game-sound": .4, match_bonus_animation: .15, match_bonus_sound: 0 });
});

test("le volume de la source navigateur modifie aussi le média déjà lancé", t => {
  const { w, mixer } = browser(t), media = w.document.createElement("audio"); let sourceVolume = .8;
  mixer.media(media, "overlays", { volume: .5 }, () => sourceVolume);
  assert.equal(media.volume, .4);
  sourceVolume = 0; mixer.update(mixer.control); assert.equal(media.volume, 0);
  sourceVolume = .2; mixer.update(mixer.control); assert.equal(media.volume, .1);
});

test("un widget de composition chargé après le réglage hérite du volume, même sans nouvel événement", t => {
  const f = browser(t), received = [];
  f.w.ShenPulseSceneLayout = { createDefaultScene: () => ({}) };
  f.w.fixtureFrame = { postMessage: message => received.push(message) };
  f.run(read("resources/overlays/runtime/scene.js"));
  f.run('sceneFrames.set("late", { ready:false, key:"wheel", element:{ contentWindow:fixtureFrame } }); dispatchSceneMessage("audio-control", { settings:{ master:0 } });');
  assert.equal(received.length, 0);
  f.w.dispatchEvent(new f.w.MessageEvent("message", { origin: f.w.location.origin, source: f.w.fixtureFrame, data: { source: "shenpulse-overlay-runtime", type: "ready" } }));
  assert.equal(received.find(message => message.channel === "bootstrap").payload.audioControl.settings.master, 0);
});

test("vidéo de match : le volume du déclenchement, du mixeur et de la source s’appliquent sans relancer la vidéo", async t => {
  const f = browser(t), v = f.w.document.getElementById("v"); let plays = 0;
  f.w.parameters = new f.w.URLSearchParams("soundVolume=50"); f.w.overlaySoundEnabled = true; f.w.isCatalogPreview = false;
  f.w.HTMLMediaElement.prototype.play = () => { plays++; return Promise.resolve(); };
  f.run(read("resources/overlays/runtime/widgets/match-audio.js"));
  f.mixer.update({ settings: { master: .5, matches: .4 } });
  await f.w.playMatchVideo(v, { volume: .5, originActionId: "x2" }); assert.equal(v.volume, .05);
  f.mixer.update({ settings: {}, actions: { x2: 0 } }); assert.equal(v.volume, 0); assert.equal(plays, 1);
  f.mixer.update({ settings: { matches: .2 }, actions: { x2: 1 } }); assert.equal(v.volume, .1);
  f.w.stopMatchVideoAudio(v); assert.equal(f.mixer.entries.size, 0);
});

test("voix Windows en cours : le nouveau volume reprend au dernier mot, sans finir la file prématurément", t => {
  const f = browser(t), spoken = []; let finished = 0;
  f.w.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  f.w.speechSynthesis = { getVoices: () => [], speak: voice => spoken.push(voice), cancel() { spoken.at(-1)?.onerror?.(); } };
  const stop = f.mixer.speak({ text: "Bonjour à toute la communauté", volume: .8 }, { onEnd: () => finished++ });
  spoken[0].onboundary({ charIndex: 10 });
  f.mixer.update({ settings: { master: .5, tts: .5 } });
  assert.equal(spoken.length, 2); assert.equal(spoken[1].volume, .2); assert.equal(spoken[1].text, "toute la communauté"); assert.equal(finished, 0);
  f.mixer.update({ settings: { master: 0 } }); assert.equal(spoken[2].volume, 0);
  stop(); stop(); assert.equal(finished, 1); assert.equal(f.mixer.entries.size, 0);
});

test("sons de roue : le mixeur modifie le gain final et conserve l’enveloppe des clics", () => {
  const mixer = new AudioMixer(), values = [], destination = {};
  const context = { destination, currentTime: 12, createGain: () => ({ gain: { setValueAtTime: (...args) => values.push(args) }, connect: node => assert.equal(node, destination) }) };
  const gain = mixer.gain(context, "overlays", { volume: .5 });
  mixer.update({ settings: { master: .4, overlays: .5 } }); assert.deepEqual(values.at(-1), [.1, 12]);
  gain.release(); mixer.update({ settings: { master: 0 } }); assert.deepEqual(values.at(-1), [.1, 12]);
});

test("moteur réel : mêmes volumes et origine des sons en retour local et en LIVE", async () => {
  const state = { settings: { tts: { enabled: true, volume: .9 } }, overlaySession: {} }, local = [], live = [];
  const store = { getState: () => state, getStateProjection: paths => selectStatePaths(state, paths) };
  const runner = new ActionRunner({ store, overlayServer: { publish: (...args) => live.push(args), playMatch: payload => live.push(["match", normalizeMatchPlaybackRequest(payload)]) }, notifyRenderer: (...args) => local.push(args), voiceService: { synthesize: async () => ({}) } });
  await runner.run({ id: "sound", type: "audio.play", config: { url: "https://example.test/s.mp3", volume: .15, outputMode: "live" } });
  assert.equal(local[0][1].volume, .15); assert.equal(live[0][1].volume, .15); assert.equal(live[0][1].originActionId, "sound");
  await runner.run({ id: "voice", type: "tts.speak", config: { volume: 0, outputMode: "live", allowedRoles: ["all"] } }, { event: { type: "chat", id: "comment", user: { id: "u" }, data: { message: "Bonjour" } } });
  assert.equal(live.at(-1)[1].volume, 0); assert.equal(local.at(-1)[1].volume, 0);
  await runner.run({ id: "x2", type: "overlay.match", config: { match: "x2", variant: "dragon", volume: .25 } });
  const match = live.at(-1)[1]; assert.equal(match.volume, .25); assert.equal(match.originActionId, "x2");
  const relay = createMatchRelayMessage("match", match); assert.equal(relay.payload.volume, .25); assert.equal(relay.payload.originActionId, "x2");
});

test("le réglage ne publie aucune identité et se propage sur chaque source locale et le relais Match", () => {
  const published = [], core = { overlayServer: { publish: (...args) => published.push(args) } };
  const state = { settings: { account: { email: "private@example.test" }, audioMixer: { master: .3 } }, rules: [{ name: "Confidentiel", actions: [{ id: "a", type: "audio.play", config: { volume: .2, url: "http://secret" } }] }] };
  synchronizeAudioControl(core, state); synchronizeAudioControl(core, state); assert.equal(published.length, 1);
  state.rules[0].actions[0].config.volume = 0; synchronizeAudioControl(core, state); assert.equal(published.length, 2);
  const control = published.at(-1)[1]; assert.equal(control.actions.a, 0); assert.equal(control.settings.master, .3);
  assert.ok(!JSON.stringify(control).includes("Confidentiel")); assert.ok(!JSON.stringify(control).includes("private")); assert.ok(!JSON.stringify(control).includes("secret"));
  for (const view of ["match", "alerts", "scene", "wheel"]) assert.equal(overlayViewAcceptsChannel(view, "audio-control"), true);
  const relay = createMatchRelayMessage("audio-control", { ...control, requestId: "change" }); assert.equal(relay.payload.actions.a, 0);
  assert.deepEqual(stateControl({ settings: {}, rules: [{ actions: [{ id: "v", type: "tts.speak", config: {} }] }] }).actions, {});
});

test("le curseur commun agit aussitôt sur l’écoute et sauvegarde la dernière valeur pour tout utilisateur", async t => {
  const f = browser(t), saved = [];
  Object.assign(f.w, { snapshot: { state: { settings: { account: { uid: "u" }, audioMixer: {} }, session: { profileId: "p" } } },
    escapeHtml: text => String(text), isAccountAuthenticated: () => true, toast() {}, acceptSnapshot: result => { f.w.snapshot = result; },
    api: { saveSettings: async settings => { saved.push(settings); return f.w.snapshot; } } });
  f.run(read("src/renderer/app/features/audio-mixer.js"));
  f.w.document.body.innerHTML += f.w.renderAudioMixer();
  const media = f.w.document.createElement("audio"); f.mixer.media(media, "sounds", { volume: 1 });
  const input = f.w.document.querySelector('[data-audio-mixer="master"]'); input.value = "20";
  input.dispatchEvent(new f.w.Event("input", { bubbles: true })); assert.equal(media.volume, .2);
  input.value = "0"; input.dispatchEvent(new f.w.Event("input", { bubbles: true }));
  input.dispatchEvent(new f.w.Event("change", { bubbles: true })); await tick();
  assert.equal(saved.length, 1); assert.equal(saved[0].audioMixer.master, 0); assert.equal(media.volume, 0);
});
