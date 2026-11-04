"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { actionAlertDisplay } = require("../src/main/actions/alert-display");
const { ActionRunner } = require("../src/main/action-runner");
const { normalizeEvent } = require("../src/main/event-normalizer");
const { createRelayMessage } = require("../src/shared/public-overlay-protocol");
const event = normalizeEvent({ type: "gift", data: { uniqueId: "alice", nickname: "Alice ♥", giftName: "Rose", repeatCount: 5, diamondCount: 2 } });
const alert = { enabled: true, showUser: true, message: "Merci {username} : {repeatcount} {giftname}, {coins} pièces !", color: "#22d3ee", strokeColor: "#000000", font: "Inter", position: "bottom", screen: 2, durationMs: 3000 };

test("le vrai événement normalisé renseigne le viewer, le cadeau, le combo et les pièces", () => {
  assert.deepEqual(actionAlertDisplay({ alert }, { event }), { username: "Alice ♥", message: "Merci alice : 5 Rose, 10 pièces !", color: "#22d3ee", strokeColor: "#000000", font: "Inter", position: "bottom", screen: 2, durationMs: 3000 });
  assert.equal(actionAlertDisplay({}, { event }), null);
  assert.equal(actionAlertDisplay({ alert: { ...alert, enabled: false } }, { event }), null);
});

test("messages, likes et abonnements ne produisent ni undefined ni données du compte ShenPulse", () => {
  const like = normalizeEvent({ type: "like", data: { uniqueId: "bob", likeCount: 30, totalLikeCount: 800 } });
  assert.equal(actionAlertDisplay({ alert: { ...alert, showUser: false, message: "{nickname} {likecount}/{totallikecount}" } }, { event: like }).message, "bob 30/800");
  const chat = normalizeEvent({ type: "chat", data: { uniqueId: "bob", comment: "Bonjour <3" } });
  assert.equal(actionAlertDisplay({ alert: { ...alert, message: "{comment} {{event.user.name}}" } }, { event: chat }).message, "Bonjour <3 bob");
  assert.equal(actionAlertDisplay({ alert: { ...alert, message: "{submonth} {totallikecount}" } }, { event: { type: "subscribe", data: { raw: { subMonth: 4 } } } }, { likes: 99 }).message, "4 99");
  assert.equal(actionAlertDisplay({ alert: { enabled: true, message: "", showUser: false } }, {}), null);
});

test("police, contour et position sont validés et conservés dans le texte diffusé", () => {
  const styled = actionAlertDisplay({ alert: { ...alert, font: "Impact", position: "top", strokeColor: "#112233" } }, { event });
  assert.equal(styled.font, "Impact");
  assert.equal(styled.position, "top");
  assert.equal(styled.strokeColor, "#112233");
  const invalid = actionAlertDisplay({ alert: { ...alert, font: 'Arial; background:url(x)', position: 'top; color:red', strokeColor: 'red; background:url(x)' } }, { event });
  assert.equal(invalid.font, "Inter");
  assert.equal(invalid.position, "bottom");
  assert.equal(invalid.strokeColor, "#000000");
});

function runner() {
  const published = [], notified = [];
  return { published, notified, instance: new ActionRunner({
    store: { getState: () => ({ statistics: { likes: 45 } }) },
    overlayServer: { publish: (channel, payload) => published.push({ channel, payload }) },
    notifyRenderer: (...args) => notified.push(args),
    obsClient: { request: async () => ({ ok: true }) }
  }) };
}

test("média et légende passent ensemble une seule fois dans la source et le relais public", async () => {
  const h = runner();
  await h.instance.run({ id: "media", type: "overlay.media", config: { mediaUrl: "https://example.test/test.gif", screen: 2, volume: .3, alert } }, { event });
  assert.equal(h.published.length, 1);
  assert.equal(h.notified.length, 1);
  const { payload, channel } = h.published[0];
  assert.equal(channel, "alert");
  assert.equal(payload.alert.username, "Alice ♥");
  assert.equal(payload.volume, .3);
  assert.equal(payload.displayMode, "media-only");
  const relay = createRelayMessage(channel, payload);
  assert.deepEqual(relay.payload.alert, payload.alert);
  assert.equal(relay.payload.mediaUrl, payload.mediaUrl);
});

test("une alerte peut afficher seulement le nom, seulement le texte, ou accompagner un autre type d’action", async () => {
  for (const options of [{ ...alert, message: "" }, { ...alert, showUser: false }]) {
    const h = runner();
    await h.instance.run({ type: "overlay.media", config: { alert: options } }, { event });
    assert.equal(h.published.length, 1);
    assert.ok(h.published[0].payload.alert.username || h.published[0].payload.alert.message);
  }
  const h = runner();
  await h.instance.run({ type: "obs.request", config: { requestType: "Test", alert } }, { event });
  assert.equal(h.published[0].payload.screen, 2);
  assert.equal(h.published[0].payload.durationMs, 3000);
});

test("aucune alerte ajoutée aux anciennes actions, aux erreurs ni après une annulation", async () => {
  const h = runner();
  await h.instance.run({ type: "overlay.media", config: { mediaUrl: "https://example.test/test.gif", title: "ancien", message: "ancien" } }, { event });
  assert.equal(h.published[0].payload.alert, undefined);
  h.published.length = 0;
  await h.instance.run({ type: "obs.request", config: {} }, { event });
  assert.equal(h.published.length, 0);
  await assert.rejects(h.instance.run({ type: "unknown", config: { alert } }, { event }));
  assert.equal(h.published.length, 0);
  let current = true;
  h.instance.obsClient.request = async () => { current = false; return { ok: true }; };
  await h.instance.run({ type: "obs.request", config: { alert } }, { event, shouldExecute: () => current });
  assert.equal(h.published.length, 0);
});

test("une action terminée après un changement de compte ne publie pas l’ancien viewer", async () => {
  const h = runner();
  const state = { settings: { account: { uid: "first" } }, session: { profileId: "a" } };
  h.instance.store.getState = () => state;
  h.instance.obsClient.request = async () => { state.settings.account.uid = "second"; return { ok: true }; };
  await h.instance.run({ type: "obs.request", config: { alert } }, { event });
  assert.equal(h.published.length, 0);
});

function editor(t) {
  const dom = new JSDOM('<dialog><form></form></dialog>', { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const window = dom.window;
  Object.assign(window, {
    dialog: window.document.querySelector("dialog"), dialogBody: window.document.querySelector("form"),
    ACTION_TYPE_LABELS: { "overlay.media": "Media", "audio.play": "Son" },
    escapeHtml: value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    conditionalFields: (_types, html) => html,
    field: (name, label, value, type = "text") => `<label>${label}<input name="${name}" type="${type}" value="${value}"></label>`
  });
  vm.runInContext(fs.readFileSync(path.resolve("src/renderer/app/editors/alert-display.js"), "utf8"), dom.getInternalVMContext());
  return window;
}

test("l’option est inactive par défaut, les variables s’insèrent à la position du curseur", t => {
  const w = editor(t), form = w.dialogBody;
  form.innerHTML = w.actionAlertDisplayFields();
  w.syncActionAlertDisplay();
  assert.equal(form.querySelector('[name="alertEnabled"]').checked, false);
  assert.equal(form.querySelector("fieldset").hidden, true);
  form.querySelector('[name="alertEnabled"]').checked = true;
  w.syncActionAlertDisplay();
  assert.equal(form.querySelector("fieldset").disabled, false);
  const input = form.querySelector('[name="alertMessage"]');
  input.value = "Merci !"; input.setSelectionRange(6, 6);
  form.querySelector('[data-action-alert-variable="nickname"]').click();
  assert.equal(input.value, "Merci {nickname}!");
});

test("sauvegarde, réouverture, désactivation et validation des champs de l’alerte", t => {
  const w = editor(t), form = w.dialogBody;
  form.innerHTML = w.actionAlertDisplayFields({ alert });
  w.syncActionAlertDisplay();
  let data = new w.FormData(form);
  const saved = w.readActionAlertDisplay(data, {}, "audio.play");
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), { ...alert, showUser: false, fontSize: 42, strokeWidth: 1.5 });
  form.querySelector('[name="alertEnabled"]').checked = false;
  w.syncActionAlertDisplay();
  assert.deepEqual(JSON.parse(JSON.stringify(w.readActionAlertDisplay(new w.FormData(form), saved))), { ...saved, enabled: false });
  form.innerHTML = w.actionAlertDisplayFields({ alert: saved });
  w.syncActionAlertDisplay();
  assert.equal(form.querySelector('[name="alertShowUser"]'), null);
  form.querySelector('[name="alertMessage"]').value = "";
  assert.equal(w.readActionAlertDisplay(new w.FormData(form)).showUser, true);
  data = new w.FormData(form); data.set("alertMessage", "Salut"); data.set("mediaScreen", "5"); data.set("durationMs", "8500");
  data.set("alertFont", "Georgia"); data.set("alertStrokeColor", "#112233"); data.set("alertPosition", "top");
  const styled = w.readActionAlertDisplay(data, {}, "overlay.text");
  assert.equal(styled.font, "Georgia");
  assert.equal(styled.strokeColor, "#112233");
  assert.equal(styled.position, "top");
  assert.equal(w.readActionAlertDisplay(data, {}, "overlay.media").screen, 5);
  assert.equal(w.readActionAlertDisplay(data, {}, "overlay.media").durationMs, 8500);
});


test("taille du texte et contour : sauvegarde, limites, zéro et relais public", async t => {
  const w = editor(t), form = w.dialogBody;
  form.innerHTML = w.actionAlertDisplayFields({ alert: { ...alert, fontSize: 86, strokeWidth: 0 } });
  w.syncActionAlertDisplay();
  const data = new w.FormData(form);
  const saved = w.readActionAlertDisplay(data, {}, "overlay.text");
  assert.equal(saved.fontSize, 86);
  assert.equal(saved.strokeWidth, 0);
  form.innerHTML = w.actionAlertDisplayFields({ alert: saved });
  assert.equal(form.querySelector('[name="alertFontSize"]').value, "86");
  assert.equal(form.querySelector('[name="alertStrokeWidth"]').value, "0");
  const h = runner();
  await h.instance.run({ type: "overlay.text", config: { alert: saved } }, { event });
  const relay = createRelayMessage("alert", h.published[0].payload);
  assert.equal(relay.payload.alert.fontSize, 86);
  assert.equal(relay.payload.alert.strokeWidth, 0);
  for (const [fontSize, strokeWidth, expectedSize, expectedWidth] of [[999,99,240,20],[-10,-1,8,0],["oops","oops",42,1.5]]) {
    const resolved = actionAlertDisplay({ alert: { ...alert, fontSize, strokeWidth } }, { event });
    assert.equal(resolved.fontSize, expectedSize);
    assert.equal(resolved.strokeWidth, expectedWidth);
    data.set("alertFontSize", String(fontSize)); data.set("alertStrokeWidth", String(strokeWidth));
    const validated = w.readActionAlertDisplay(data, {}, "overlay.text");
    assert.equal(validated.fontSize, expectedSize); assert.equal(validated.strokeWidth, expectedWidth);
  }
});

test("le test du brouillon diffuse le viewer vers son écran avec les tailles choisies", async () => {
  const h = runner();
  const draft = { enabled: true, showUser: false, message: "Merci {username}", fontSize: 92, strokeWidth: 4, screen: 8 };
  const result = await h.instance.run({ type: "overlay.text", config: { alert: draft } }, { event });
  assert.equal(result.displayed, true);
  assert.equal(h.published.length, 1);
  assert.equal(h.notified.length, 1);
  const payload = h.published[0].payload;
  assert.equal(payload.screen, 8);
  assert.equal(payload.alert.message, "Merci alice");
  assert.equal(payload.alert.fontSize, 92);
  assert.equal(payload.alert.strokeWidth, 4);
});
