"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { actionEditorFixture } = require("./helpers/action-editor-fixture");
const { composeActionVisuals } = require("../src/main/actions/compound-visuals");
const { ActionRunner } = require("../src/main/action-runner");
const { RuleEngine } = require("../src/main/rule-engine");
const media = id => ({ id, type: "overlay.media", config: { mediaUrl: `https://example.test/${id}.gif`, screen: 1, durationMs: 5000 } });
const text = { id: "text", type: "overlay.text", config: { alert: { enabled: true, showUser: true, message: "Merci {giftname}", screen: 1, durationMs: 5000 } } };

test("+ et − créent plusieurs lignes et un accordéon par type sans groupe obligatoire", async t => {
  const h = actionEditorFixture(t);
  assert.equal(h.form.querySelector("[data-action-part-remove]").disabled, true);
  assert.ok(h.form.querySelector('option[value="overlay.text"]'));
  assert.ok(h.form.querySelector('option[value="action.group"]'));
  h.add();
  assert.equal(h.parts().length, 2);
  assert.equal(h.form.querySelectorAll("[data-action-type-group]").length, 1);
  const parts = h.parts();
  parts[1].querySelector('[name="url"]').value = "https://example.test/second.gif";
  await h.save();
  assert.equal(h.calls.length, 1);
  const rule = h.calls[0][1];
  assert.equal(rule.actions.length, 2);
  assert.equal(rule.actions[0].id, "media-a");
  assert.notEqual(rule.actions[0].id, rule.actions[1].id);
  assert.equal(rule.actions[1].config.mediaUrl, "https://example.test/second.gif");
  assert.equal(rule.actionEditor, "components");
});

test("changer de type puis revenir conserve le brouillon de chaque type", async t => {
  const h = actionEditorFixture(t);
  h.parts()[0].querySelector('[name="url"]').value = "https://example.test/modified.gif";
  h.selectType(0, "audio.play");
  h.parts()[0].querySelector('[name="soundLibrary"]').value = "https://example.test/son.mp3";
  h.selectType(0, "overlay.media");
  assert.equal(h.parts()[0].querySelector('[name="url"]').value, "https://example.test/modified.gif");
  h.selectType(0, "audio.play");
  assert.equal(h.parts()[0].querySelector('[name="soundLibrary"]').value, "https://example.test/son.mp3");
  await h.save();
  assert.equal(h.calls[0][1].actions[0].type, "audio.play");
  assert.equal(h.calls[0][1].actions[0].config.url, "https://example.test/son.mp3");
});

test("chaque ligne du même type sauvegarde ses propres paramètres, même repliée", async t => {
  const h = actionEditorFixture(t, { actions: [media("a"), media("b"), text] });
  const panels = h.parts();
  panels[0].querySelector('[name="mediaVolume"]').value = "20";
  panels[1].querySelector('[name="mediaVolume"]').value = "75";
  panels[1].querySelector('[name="mediaScreen"]').value = "3";
  h.form.querySelectorAll("details[data-action-type-group]").forEach(group => { group.open = false; });
  await h.save();
  const actions = h.calls[0][1].actions;
  assert.deepEqual(Array.from(actions, a => a.id), ["a", "b", "text"]);
  assert.equal(actions[0].config.volume, .2);
  assert.equal(actions[1].config.volume, .75);
  assert.equal(actions[1].config.screen, 3);
  assert.equal(actions[2].type, "overlay.text");
  assert.equal(actions[2].config.alert.message, "Merci {giftname}");
});

test("retirer une ligne ne réinitialise ni les autres paramètres ni leurs identifiants", async t => {
  const h = actionEditorFixture(t, { actions: [media("a"), media("b"), media("c")] });
  h.parts()[2].querySelector('[name="durationMs"]').value = "8900";
  h.remove(1);
  assert.equal(h.calls.length, 0, "aucune écriture avant Enregistrer");
  await h.save();
  assert.deepEqual(Array.from(h.calls[0][1].actions, a => a.id), ["a", "c"]);
  assert.equal(h.calls[0][1].actions[1].config.durationMs, 8900);
});

test("un champ invalide bloque l’enregistrement entier et ouvre le type concerné", async t => {
  const h = actionEditorFixture(t);
  h.add(); h.selectType(1, "audio.play");
  await assert.rejects(h.save(), /Action 2.*Choisissez un son/);
  assert.equal(h.calls.length, 0);
  assert.equal(h.form.querySelector('[data-action-type-group="audio.play"]').open, true);
});

test("les anciennes alertes deviennent une ligne dédiée sans modifier le scénario avant validation", async t => {
  const action = media("old"); action.config.alert = structuredClone(text.config.alert);
  const before = structuredClone(action);
  const h = actionEditorFixture(t, { actions: [action] });
  assert.deepEqual(action, before);
  assert.equal(h.parts().length, 2);
  await h.save();
  const saved = h.calls[0][1].actions;
  assert.equal(saved[0].id, "old");
  assert.equal(saved[0].config.alert, undefined);
  assert.equal(saved[1].type, "overlay.text");
  assert.equal(saved[1].config.alert.message, "Merci {giftname}");
});

test("l’ancienne alerte sans image devient seulement Viewer et/ou texte, avec la même identité", async t => {
  const h = actionEditorFixture(t, { actions: [{ id: "old-text", type: "overlay.media", config: { alert: text.config.alert } }] });
  assert.equal(h.parts().length, 1);
  await h.save();
  assert.equal(h.calls[0][1].actions[0].id, "old-text");
  assert.equal(h.calls[0][1].actions[0].type, "overlay.text");
});

test("deux animations Match gardent chacune leur sélection de variante", async t => {
  const h = actionEditorFixture(t, { actions: [
    { id: "x2", type: "overlay.match", config: { match: "x2", variant: "cyber" } },
    { id: "x3", type: "overlay.match", config: { match: "x3", variant: "dragon" } }
  ] });
  const [first, second] = h.parts();
  const select = second.querySelector('[name="matchName"]');
  select.value = "cofre"; select.dispatchEvent(new h.window.Event("change", { bubbles: true }));
  assert.equal(first.querySelector('[name="matchVariant"]').value, "cyber");
  assert.equal(second.querySelector('[name="matchVariant"]').value, "tikcontrol");
  await h.save();
  assert.equal(h.calls[0][1].actions[0].config.match, "x2");
  assert.equal(h.calls[0][1].actions[1].config.match, "cofre");
});

test("deux voix conservent leurs champs et leurs libellés après sauvegarde et réouverture", async t => {
  const h = actionEditorFixture(t, { actions: [
    { id: "voice-a", type: "tts.speak", config: { text: "Bonjour", voice: "Voix A", rate: 1, pitch: 1, volume: .8 } },
    { id: "voice-b", type: "tts.speak", config: { text: "Merci", voice: "Voix B", rate: 1.5, pitch: .8, volume: .3 } }
  ] });
  h.window.ttsVoiceField = (name, voice) => `<label for="tts-select-${name}">Voix</label><select id="tts-select-${name}" name="${name}"><option>${voice}</option></select>`;
  h.window.openActionEditor({ rule: h.rule, action: h.rule.actions[0] });
  const selects = h.form.querySelectorAll('[name="ttsVoice"]');
  assert.notEqual(selects[0].id, selects[1].id);
  for (const select of selects) assert.equal(select.labels.length, 1);
  h.parts()[1].querySelector('[name="ttsRate"]').value = "1.7";
  await h.save();
  const saved = h.calls[0][1];
  h.window.openActionEditor({ rule: saved, action: saved.actions[1] });
  const panels = h.parts();
  assert.equal(panels[0].querySelector('[name="ttsVoice"]').value, "Voix A");
  assert.equal(panels[0].querySelector('[name="ttsRate"]').value, "1");
  assert.equal(panels[1].querySelector('[name="ttsVoice"]').value, "Voix B");
  assert.equal(panels[1].querySelector('[name="ttsRate"]').value, "1.7");
  assert.equal(panels[1].querySelector('[name="ttsVolume"]').value, "0.3");
});

test("le moteur exécute toutes les lignes et fusionne média + texte du même écran", async () => {
  const actions = [media("a"), structuredClone(text), { id: "sound", type: "audio.play", config: { url: "https://example.test/son.mp3", volume: .25 } }];
  const before = structuredClone(actions), published = [], notified = [];
  const rule = { id: "scenario", name: "Scénario", actions, trigger: { type: "gift" } };
  const state = { rules: [rule], profiles: [], session: { profileId: "p" } };
  const store = { getState: () => state };
  const runner = new ActionRunner({ store, overlayServer: { publish: (channel, payload) => published.push({ channel, payload }) }, notifyRenderer: (channel, payload) => notified.push({ channel, payload }) });
  const engine = new RuleEngine({ store, actionRunner: runner });
  await engine.test("scenario", { type: "gift", user: { displayName: "Alice" }, data: { giftName: "Rose", count: 1 } });
  assert.deepEqual(actions, before, "les réglages enregistrés ne sont pas mutés");
  assert.equal(published.length, 1, "un seul affichage simultané, pas deux médias en file");
  assert.equal(published[0].payload.alert.username, "Alice");
  assert.equal(published[0].payload.alert.message, "Merci Rose");
  assert.equal(notified.filter(n => n.payload.type === "audio").length, 1);
});

test("un texte d’un autre écran reste indépendant et les actions de groupe existent toujours", () => {
  const other = structuredClone(text); other.config.alert.screen = 4;
  const result = composeActionVisuals([media("a"), other, { id: "group", type: "action.group", config: { actionIds: ["a"] } }]);
  assert.equal(result[0].config.alert, undefined);
  assert.equal(result[1].config.embeddedInMedia, undefined);
  assert.equal(result[2].type, "action.group");
});
