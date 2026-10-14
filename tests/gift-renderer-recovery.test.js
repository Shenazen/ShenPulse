"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const identity = require("../src/shared/gift-identity");
const { GiftCatalog } = require("../src/main/catalogs");

function renderer(t) {
  const dom = new JSDOM('<datalist id="gift-catalog-options"></datalist><dialog id="dialog"><form id="form"></form></dialog><main id="content"></main>', { pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const timers = [];
  const context = vm.createContext({
    document: dom.window.document, window: dom.window, FormData: dom.window.FormData,
    ShenPulseGiftIdentity: identity, giftCatalogById: new Map(), giftCatalogByName: new Map(), GIFT_CATALOG: [],
    giftRequestSequence: 0, giftSearchTimer: null,
    rendererFormatters: { integer: new Intl.NumberFormat("fr-FR") },
    fieldLabelWithInfo: (label) => `<span>${label}</span>`,
    setTimeout: (callback) => { timers.push(callback); return timers.length; }, clearTimeout: () => {},
    dialog: dom.window.document.querySelector("dialog"), dialogForm: dom.window.document.querySelector("form"),
    dialogBody: dom.window.document.querySelector("form"), content: dom.window.document.querySelector("main")
  });
  const load = (file) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "app", file), "utf8"), context);
  for (const file of ["core/ui-foundations.js", "editors/core.js", "features/media/gift-picker.js", "features/games/settings-editor.js", "features/games/overlay-cards.js", "features/games/overlay-export-entries.js"]) load(file);
  const form = context.dialogForm;
  return { context, form, load, timers, dom };
}

function savedGift(overrides = {}) {
  return { field: "data.giftName", operator: "equals", value: "Cadeau ancien", giftId: "old-unlisted-id", giftCost: 42, giftImageUrl: "https://cdn.example.test/old.webp", giftFamily: "old-family", giftIds: ["old-unlisted-id", "old-secondary-id"], ...overrides };
}

test("le premier chargement apporte tout le catalogue, y compris les cadeaux après le millième", async (t) => {
  const { context } = renderer(t);
  const requests = [];
  context.api = { searchGifts: async (query, limit) => {
    requests.push({ query, limit });
    const all = new GiftCatalog(path.join(__dirname, "..", "resources")).gifts;
    return { gifts: all.slice(0, limit), total: all.length };
  } };
  await context.hydrateGiftCatalog();
  assert.equal(requests[0].limit, 10000);
  assert.ok(context.GIFT_CATALOG.length > 1000);
  for (const name of ["Corgi", "Forever Rosa", "Sunglasses", "Lion", "Trésor de pirate", "Amour en langue des signes"]) {
    const gift = context.giftForName(name);
    assert.ok(gift?.imageUrl, `${name} doit retrouver son visuel`);
  }
  await context.hydrateGiftCatalog("Rose");
  assert.equal(requests[1].limit, 1000);
});

test("les homonymes ne sont pas départagés par l'ordre d'arrivée ou seulement le prix", (t) => {
  const { context } = renderer(t);
  context.rememberGifts([{ id: "first", name: "Homonyme", cost: 10, imageUrl: "first.webp" }, { id: "second", name: "Homonyme", cost: 20, imageUrl: "second.webp" }]);
  assert.equal(context.giftForName("Homonyme"), null);
  assert.equal(context.giftForIdentity("Homonyme", "second").imageUrl, "second.webp");
  assert.equal(context.giftForIdentity("Homonyme", "", { giftCost: 20 }).id, "second");
  assert.equal(context.giftForIdentity("Pas ce cadeau", "", { giftCost: 20 }), null);
  assert.equal(context.giftForIdentity("Homonyme", "inconnu", { giftCost: 20 }), null);
});

test("des IDs distincts au même nom, prix et dessin affichent ce dessin sans choisir un ID", (t) => {
  const { context, form } = renderer(t);
  context.rememberGifts([{ id: "first", name: "Chat", cost: 15, imageUrl: "https://cdn.example.test/shared.webp" }, { id: "second", name: "Chat", cost: 15, imageUrl: "https://cdn.example.test/shared.webp" }]);
  const existing = { field: "data.giftName", operator: "equals", value: "Chat" };
  assert.equal(context.giftForIdentity("Chat"), null);
  const display = context.giftForSavedReference("Chat");
  assert.equal(display.id, "");
  assert.equal(display.imageUrl, "https://cdn.example.test/shared.webp");
  form.innerHTML = context.giftTriggerConditionFields([existing]);
  assert.equal(form.querySelector("[data-gift-id-input]").value, "");
  assert.equal(form.querySelector("[data-gift-selected] img").getAttribute("src"), display.imageUrl);
  const saved = context.buildTriggerConditions([existing], new context.FormData(form))[0];
  assert.equal(saved.giftId, "");
  assert.equal(saved.giftIds, undefined);
  assert.equal(saved.giftImageUrl, display.imageUrl);
});

test("un dessin commun ne répare ni un ID inconnu ni des prix ou images contradictoires", (t) => {
  const { context } = renderer(t);
  context.rememberGifts([{ id: "first", name: "Chat", cost: 15, imageUrl: "https://cdn.example.test/shared.webp" }, { id: "second", name: "Chat", cost: 15, imageUrl: "https://cdn.example.test/shared.webp" }]);
  assert.equal(context.giftForSavedReference("Chat", "missing").imageUrl, "");
  context.rememberGifts([{ id: "third", name: "Chat", cost: 20, imageUrl: "https://cdn.example.test/shared.webp" }]);
  assert.equal(context.giftForSavedReference("Chat").imageUrl, "");
  context.rememberGifts([{ id: "third", name: "Chat", cost: 15, imageUrl: "https://cdn.example.test/different.webp" }]);
  assert.equal(context.giftForSavedReference("Chat").imageUrl, "");
});

test("une mise à jour du cache conserve les alias et affiche le visuel actualisé", (t) => {
  const { context } = renderer(t);
  context.rememberGifts([{ id: "gift", alternateIds: ["legacy"], name: "Ancien nom", cost: 10, imageUrl: "old.webp" }]);
  context.rememberGifts([{ id: "gift", name: "Nouveau nom", cost: 10, imageUrl: "new.webp" }]);
  assert.equal(context.giftForIdentity("Ancien nom", "legacy").imageUrl, "new.webp");
  assert.equal(context.giftForName("Ancien nom").imageUrl, "new.webp");
  assert.equal(context.GIFT_CATALOG.length, 1);
});

test("le picker et l'enregistrement DOM conservent une ancienne référence non résolue", (t) => {
  const { context, form } = renderer(t);
  const existing = savedGift();
  context.rememberGifts([{ id: "different", name: existing.value, cost: 42, imageUrl: "wrong.webp" }]);
  form.innerHTML = context.giftTriggerConditionFields([existing]);
  const root = form.querySelector("[data-gift-picker-root]");
  context.updateAllGiftPickerSelections();
  assert.equal(root.querySelector("img").getAttribute("src"), existing.giftImageUrl);
  assert.equal(root.querySelector("[data-gift-id-input]").value, existing.giftId);
  const conditions = context.buildTriggerConditions([existing], new context.FormData(form));
  assert.deepEqual(JSON.parse(JSON.stringify(conditions)), [existing]);
});

test("un ancien ID de catalogue garde son ID, ses alias et son coût lors d'une édition", (t) => {
  const { context, form } = renderer(t);
  context.rememberGifts([{ id: "current", alternateIds: ["old"], name: "Cadeau", cost: 100, imageUrl: "current.webp" }]);
  const existing = savedGift({ value: "Cadeau", giftId: "old", giftIds: ["old"], giftCost: 99, giftFamily: "" });
  form.innerHTML = context.giftTriggerConditionFields([existing]);
  const condition = context.buildTriggerConditions([existing], new context.FormData(form))[0];
  assert.equal(condition.giftId, "old");
  assert.equal(condition.giftCost, 99);
  assert.equal(condition.giftImageUrl, "current.webp");
  assert.ok(condition.giftIds.includes("current"));
  assert.ok(condition.giftIds.includes("old"));
});

test("un catalogue reconnu sans image ne supprime pas le visuel sauvegardé à l'affichage ou à l'édition", (t) => {
  const { context, form } = renderer(t);
  context.rememberGifts([{ id: "current", alternateIds: ["old"], name: "Cadeau", cost: 100, imageUrl: "" }]);
  const existing = savedGift({ value: "Cadeau", giftId: "old", giftIds: ["old"], giftCost: 99 });
  form.innerHTML = context.giftTriggerConditionFields([existing]);
  context.updateAllGiftPickerSelections();
  assert.equal(form.querySelector("[data-gift-selected] img").getAttribute("src"), existing.giftImageUrl);
  const condition = context.buildTriggerConditions([existing], new context.FormData(form))[0];
  assert.equal(condition.giftImageUrl, existing.giftImageUrl);
  assert.equal(condition.giftId, "old");
  assert.equal(condition.giftCost, 99);
  assert.ok(condition.giftIds.includes("current"));
  const integrated = context.integratedGiftDefinition("Cadeau", { giftId: "old", name: "Cadeau", image: existing.giftImageUrl, cost: 99 }, "old");
  assert.equal(integrated.image, existing.giftImageUrl);
});

test("une saisie différente retire l'ancien ID et ne conserve pas son image", (t) => {
  const { context, form } = renderer(t);
  const existing = savedGift();
  form.innerHTML = context.giftTriggerConditionFields([existing]);
  const root = form.querySelector("[data-gift-picker-root]");
  const input = root.querySelector("[data-gift-picker]");
  input.value = "Autre cadeau";
  context.scheduleGiftCatalog(input);
  assert.equal(root.querySelector("[data-gift-id-input]").value, "");
  assert.equal(root.querySelector("[data-gift-selected] img"), null);
  const condition = context.buildTriggerConditions([existing], new context.FormData(form))[0];
  assert.equal(condition.value, "Autre cadeau");
  assert.equal(condition.giftId, "");
  assert.equal(condition.giftImageUrl, "");
  assert.equal(condition.giftFamily, undefined);
});

test("l'effacement explicite ou le passage au filtre de valeur enlève seulement la sélection cadeau", (t) => {
  const { context, form } = renderer(t);
  const existing = savedGift();
  const preserved = { field: "platform", operator: "equals", value: "tiktok" };
  form.innerHTML = context.giftTriggerConditionFields([existing]);
  form.querySelector("[data-gift-picker]").value = "";
  form.querySelector("[data-gift-id-input]").value = "";
  assert.deepEqual(JSON.parse(JSON.stringify(context.buildTriggerConditions([existing, preserved], new context.FormData(form)))), [preserved]);
  form.querySelector('[data-gift-trigger-mode][value="value"]').checked = true;
  form.querySelector('[name="giftValueAmount"]').value = "500";
  context.syncGiftTriggerCondition(form.querySelector("[data-gift-trigger-condition]"));
  const conditions = context.buildTriggerConditions([existing, preserved], new context.FormData(form));
  assert.deepEqual(JSON.parse(JSON.stringify(conditions)), [preserved, { field: "data.value", operator: "greaterOrEqual", value: 500 }]);
});

test("les réglages de jeux intégrés conservent un ID absent et les données sauvegardées", (t) => {
  const { context } = renderer(t);
  const fallback = { giftId: "old", name: "Ancien", image: "saved.webp", cost: 75 };
  const gift = context.integratedGiftDefinition("Ancien", fallback, "old");
  assert.deepEqual(JSON.parse(JSON.stringify(gift)), fallback);
  const fresh = context.integratedGiftDefinition("Autre", fallback, "other");
  assert.equal(fresh.giftId, "other");
  assert.equal(fresh.image, "");
  assert.equal(fresh.cost, 0);
});

test("les badges et les exports utilisent les images sauvegardées des règles absentes", (t) => {
  const { context } = renderer(t);
  context.triggerLabel = () => "Cadeau · Ancien";
  const rule = { trigger: { type: "gift" }, conditions: [savedGift()] };
  context.content.innerHTML = context.triggerPill(rule);
  assert.equal(context.content.querySelector("img").getAttribute("src"), rule.conditions[0].giftImageUrl);
  const exported = context.overlayTriggerGift(rule);
  assert.equal(exported.id, rule.conditions[0].giftId);
  assert.equal(exported.imageUrl, rule.conditions[0].giftImageUrl);
  assert.doesNotThrow(() => context.triggerPill({ trigger: { type: "follow" }, conditions: [] }));
});

test("les aperçus Coin Pusher préfèrent une image connue par ID sans changer les triggers", (t) => {
  const { context } = renderer(t);
  context.rememberGifts([{ id: "known", name: "Nouveau nom", cost: 10, imageUrl: "current.webp" }]);
  context.GAME_OVERLAY_GENERATOR_ONLY_IDS = new Set();
  context.gameMappedEffects = () => [];
  context.integratedGameSettings = () => ({ giftRules: [{ giftId: "known", name: "Ancien nom", image: "stale.webp", coinCount: 2 }], guardGift: {}, mysteryCube: {}, tickets: {}, diamondCoinTiers: [] });
  const entries = context.gameInteractionOverlayEntries({ id: "coin-pusher", effects: [] });
  assert.equal(entries[0].giftImageUrl, "current.webp");
  assert.equal(entries[0].triggerKey, "known");
  assert.equal(entries[0].giftLabel, "Ancien nom");
});

test("la roue garde les métadonnées du cadeau absent après un aller-retour formulaire", (t) => {
  const { context, form, load } = renderer(t);
  load("features/overlays/fields.js");
  const existing = savedGift();
  const wheel = { id: "wheel", name: "Roue", enabled: true, trigger: existing.value, triggerGift: { giftId: existing.giftId, giftCost: existing.giftCost, giftImageUrl: existing.giftImageUrl, giftFamily: existing.giftFamily, giftIds: existing.giftIds }, settings: {}, segments: [] };
  context.wheelEditorContext = { config: { selectedWheelId: wheel.id, wheels: [wheel] } };
  context.dialog.open = true;
  form.innerHTML = context.giftTriggerConditionFields([], { giftName: "wheelTrigger", giftValue: wheel.trigger, giftId: wheel.triggerGift.giftId, savedReference: wheel.triggerGift, modeName: "wheelGiftTriggerMode", operatorName: "wheelGiftValueOperator", amountName: "wheelGiftValueAmount" });
  context.collectWheelEditorForm();
  assert.equal(wheel.triggerGift.giftId, existing.giftId);
  assert.equal(wheel.triggerGift.giftCost, existing.giftCost);
  assert.equal(wheel.triggerGift.giftImageUrl, existing.giftImageUrl);
  assert.deepEqual(Array.from(wheel.triggerGift.giftIds), existing.giftIds);
});

test("le code de page charge l'identité partagée avant les utilitaires d'affichage", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "index.html"), "utf8");
  assert.ok(html.indexOf('src="../shared/gift-identity.js"') < html.indexOf('src="app/core/ui-foundations.js"'));
});

test("une notification ciblée actualise les badges et pickers sans remplacer une saisie", (t) => {
  const { context, form } = renderer(t);
  const callbacks = new Map();
  const refreshes = [];
  context.api = { on: (name, callback) => callbacks.set(name, callback) };
  context.rendererVisualsActive = () => true;
  context.scheduleRendererRefresh = (options) => refreshes.push(options);
  context.currentPage = "actions";
  context.triggerLabel = () => "Cadeau · Cadeau";
  const condition = savedGift({ value: "Cadeau", giftId: "gift" });
  context.rememberGifts([{ id: "gift", name: "Cadeau", imageUrl: "old.webp", cost: 42 }]);
  form.innerHTML = '<input name="title" value="Ma saisie non enregistrée">' + context.giftTriggerConditionFields([condition]);
  context.content.innerHTML = '<form><input value="Autre saisie"></form>' + context.triggerPill({ trigger: { type: "gift" }, conditions: [condition] });
  context.dialog.open = true;
  const file = fs.readFileSync(path.join(__dirname, "..", "src/renderer/app/core/events/dialog-content.js"), "utf8");
  const start = file.indexOf('api.on("gift-catalog-updated"');
  const end = file.indexOf('api.on("runtime-state-changed"', start);
  vm.runInContext(file.slice(start, end), context);
  callbacks.get("gift-catalog-updated")([{ id: "gift", name: "Cadeau", imageUrl: "new.webp", cost: 42 }]);
  assert.equal(form.querySelector('[name="title"]').value, "Ma saisie non enregistrée");
  assert.equal(form.querySelector("[data-gift-selected] img").getAttribute("src"), "new.webp");
  assert.equal(context.content.querySelector(".trigger-pill img").getAttribute("src"), "new.webp");
  assert.equal(context.content.querySelector("input").value, "Autre saisie");
  assert.equal(refreshes[0].redraw, false);
});

test("un badge d'ancien ID garde ses alias lors de l'actualisation ciblée de son image", (t) => {
  const { context } = renderer(t);
  context.triggerLabel = () => "Cadeau · Ancien nom";
  const condition = savedGift({ value: "Ancien nom", giftId: "retired", giftIds: ["retired", "known"], giftFamily: "", giftCost: 42 });
  const rule = { trigger: { type: "gift" }, conditions: [condition] };
  context.rememberGifts([{ id: "known", name: "Nouveau nom", cost: 42, imageUrl: "first.webp" }]);
  context.content.innerHTML = context.triggerPill(rule) + context.overlayTriggerPickerVisual(rule);
  assert.equal(context.content.querySelector("img").getAttribute("src"), "first.webp");
  const badge = context.content.querySelector("[data-gift-visual-reference]");
  const reference = JSON.parse(badge.dataset.giftVisualReference);
  assert.equal(reference.giftId, "retired");
  assert.deepEqual(reference.giftIds, condition.giftIds);
  assert.equal(reference.giftCost, 42);
  context.rememberGifts([{ id: "known", name: "Nouveau nom", cost: 42, imageUrl: "updated.webp" }]);
  context.refreshGiftVisuals();
  assert.ok([...context.content.querySelectorAll("img")].every((image) => image.getAttribute("src") === "updated.webp"));
  assert.equal(rule.conditions[0].giftId, "retired");
});
