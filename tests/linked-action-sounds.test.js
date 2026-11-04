"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const audio = require("../src/shared/action-audio");
const { ActionRunner } = require("../src/main/action-runner");
const { RuleEngine } = require("../src/main/rule-engine");
const { actionEditorFixture } = require("./helpers/action-editor-fixture");
const source = () => ({ id: "sound", type: "audio.play", config: { url: "https://example.test/a.mp3", soundName: "Mon son", volume: .4, outputMode: "live" } });
const media = () => ({ id: "media", type: "overlay.media", config: { mediaUrl: "https://example.test/a.gif", soundActionId: "sound", screen: 2, volume: .3 } });

function runner(actions) {
  const published = [], notified = [], state = { settings: { account: { uid: "owner" } }, session: { profileId: "p" }, profiles: [], rules: [{ id: "r", actions }] };
  const store = { getState: () => state };
  return { published, notified, state, store, instance: new ActionRunner({ store,
    overlayServer: { publish: (channel, payload) => published.push({ channel, payload }) },
    notifyRenderer: (channel, payload) => notified.push({ channel, payload }) }) };
}

test("les références suivent le son actuel, sans copie de règle ni boucle", () => {
  const sound = source(), linked = media(), before = structuredClone(linked);
  assert.equal(audio.resolve(linked, [sound]).sourceId, "sound");
  sound.config.url = "https://example.test/new.mp3";
  assert.equal(audio.resolve(linked, [sound]).url, sound.config.url);
  assert.deepEqual(linked, before);
  sound.config.soundActionId = "media";
  assert.equal(audio.resolve(linked, [sound, linked]), null);
  assert.equal(audio.resolve(linked, []), null);
});

for (const first of ["sound", "media"]) for (const live of [true, false]) {
  test(`une seule lecture par destination, ${first} en premier et son ${live ? "LIVE" : "local"}`, async () => {
    const sound = source(); sound.config.outputMode = live ? "live" : "local";
    const linked = media(), h = runner([sound, linked]);
    const context = { event: { id: "gift-1", type: "gift", data: { count: 1 } } };
    const actions = first === "sound" ? [sound, linked] : [linked, sound];
    await Promise.all(actions.map(action => h.instance.run(action, context)));
    const liveSounds = h.published.filter(item => item.channel === "audio" || item.payload.soundUrl);
    assert.equal(liveSounds.length, 1);
    assert.equal(h.notified.filter(item => item.payload.type === "audio").length, 1, "le retour local reste disponible");
    assert.equal(h.published.filter(item => item.channel === "alert").length, 1, "le média reste affiché");
    const next = { event: { ...context.event, id: "gift-2" } };
    await h.instance.run(linked, next);
    assert.equal(h.published.filter(item => item.channel === "audio" || item.payload.soundUrl).length, 2);
  });
}

test("les combos autorisés, les nouveaux événements et les essais peuvent rejouer le son", async () => {
  const sound = source(), h = runner([sound]);
  for (const id of ["gift_unit_1", "gift_unit_2"]) await h.instance.run(sound, { event: { id } });
  await h.instance.run(sound, { event: { id: "gift_unit_2" } });
  assert.equal(h.published.length, 2);
  await h.instance.run(sound, { source: "manual-preview", event: { id: "gift_unit_2" } });
  assert.equal(h.notified.length, 3);
  h.state.session.profileId = "new-profile";
  await h.instance.run(sound, { event: { id: "gift_unit_2" } });
  assert.equal(h.published.length, 3);
});

test("deux sons indépendants utilisant le même fichier restent indépendants", async () => {
  const sound = source(), second = { ...source(), id: "other" }, h = runner([sound, second]);
  await h.instance.run(sound, { event: { id: "event" } });
  await h.instance.run(second, { event: { id: "event" } });
  assert.equal(h.published.length, 2);
});

test("le moteur réel ne double pas le son quand deux règles partagent la même référence", async () => {
  const h = runner([]);
  h.state.rules = [source(), media()].map((action, index) => ({ id: `rule-${index}`, name: "Test", enabled: true, chance: 1, priority: 50,
    trigger: { type: "follow", source: "*", threshold: 1 }, conditions: [], cooldown: {}, actions: [action] }));
  const engine = new RuleEngine({ store: h.store, actionRunner: h.instance });
  await engine.process({ id: "follow-1", type: "follow", user: { id: "viewer" }, data: {} });
  assert.equal(h.published.filter(item => item.channel === "audio" || item.payload.soundUrl).length, 1);
});

function editor(t) {
  const h = actionEditorFixture(t, { actions: [media(), { id: "inside", type: "audio.play", config: { url: "https://example.test/inside.mp3" } }] });
  const load = file => vm.runInContext(fs.readFileSync(path.resolve("src/renderer/app", file), "utf8"), h.dom.getInternalVMContext());
  h.snapshot.state.rules.push({ id: "sound-rule", name: "Son indépendant", enabled: true, trigger: { enabled: false }, actions: [source()] });
  h.snapshot.state.timers = [];
  Object.assign(h.window, { SOUND_LIBRARY: [], MEDIA_LIBRARY: [], mediaSessionEntries: new Map(), isAccountAuthenticated: () => true,
    canAccessFeature: () => true,
    copiedMediaScreenUrls: new Set(), actionsSection: "triggers", actionsSearch: "", onlyEnabledActions: false,
    renderStudioHero: () => "", renderCreatorCapacity: () => "", triggerPill: () => "Cadeau", emptyInline: text => text,
    EVENT_LABELS: {}, MATCH_OVERLAYS: [], giftSelectionLabel: () => "", ruleGiftValueLabel: () => "" });
  for (const file of ["core/automation-table.js", "features/actions.js", "features/audio.js", "features/media/library.js", "actions/overlays.js"]) load(file);
  return h;
}

test("Sons affiche les sons des médias et des actions, Actions masque le son seul et retire les deux onglets", t => {
  const h = editor(t), before = JSON.stringify(h.snapshot.state.rules);
  const rows = h.window.soundActionRows();
  assert.equal(rows.length, 3);
  assert.equal(rows[0].sourceAction.type, "overlay.media");
  assert.equal(rows[0].action.config.url, source().config.url);
  const audioHtml = h.window.renderAudioAlerts(rows);
  assert.match(audioHtml, /Lié à l’action « Mon scénario »/);
  assert.match(audioHtml, /Son indépendant/);
  const html = h.window.renderActions();
  const holder = h.window.document.createElement("div"); holder.innerHTML = html;
  assert.equal(holder.querySelectorAll('.module-tabs button').length, 2);
  assert.equal(holder.querySelector('[data-automation-row="sound-rule"]'), null);
  assert.match(html, /Mon scénario/);
  assert.match(html, /Lier des actions existantes/);
  assert.equal(JSON.stringify(h.snapshot.state.rules), before);
});

test("le choix d’un son existant conserve la référence et la bibliothèque la remplace proprement", async t => {
  const h = editor(t);
  h.window.openActionEditor({ rule: h.rule, action: h.rule.actions[0] });
  const root = h.parts()[0].querySelector('[data-picker-kind="sound"]');
  const select = root.querySelector('[data-programmed-sound-picker]');
  select.value = "sound"; h.window.selectProgrammedSound(select);
  assert.equal(root.querySelector('[data-media-linked-action]').value, "sound");
  await h.save();
  assert.equal(h.calls[0][1].actions[0].config.soundActionId, "sound");
  h.window.updateCompactMediaPicker(root, { url: "https://example.test/other.mp3", name: "Autre" });
  await h.save();
  assert.equal(h.calls[1][1].actions[0].config.soundActionId, "");
  assert.equal(h.calls[1][1].actions[0].config.soundUrl, "https://example.test/other.mp3");
});

test("modifier le son d’un média depuis Sons conserve média, déclencheur et identifiant", async t => {
  const h = editor(t), row = h.window.soundActionRows()[0], before = structuredClone(h.rule);
  h.window.openLinkedSoundEditor(row);
  h.form.querySelector('[name="volume"]').value = ".2";
  await h.window.editorOptions.onSubmit(new h.window.FormData(h.form));
  const saved = h.calls[0][1];
  assert.equal(saved.actions[0].type, "overlay.media");
  assert.equal(saved.actions[0].id, before.actions[0].id);
  assert.equal(saved.actions[0].config.mediaUrl, before.actions[0].config.mediaUrl);
  assert.equal(saved.actions[0].config.volume, .2);
  assert.deepEqual(JSON.parse(JSON.stringify(saved.trigger)), before.trigger);
  assert.equal(saved.actions.length, before.actions.length);
});

test("retirer dans le même brouillon le son source empêche d’enregistrer un lien cassé", async t => {
  const h = editor(t);
  h.rule.actions.push(source());
  h.snapshot.state.rules = [h.rule];
  h.window.openActionEditor({ rule: h.rule, action: h.rule.actions[0] });
  h.remove(2);
  await assert.rejects(h.save(), /son lié a été retiré/);
  assert.equal(h.calls.length, 0);
});
