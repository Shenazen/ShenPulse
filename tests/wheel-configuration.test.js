"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const catalog = require("../resources/overlays/overlay-catalog");
const { createDefaultOverlayConfigs } = require("../src/main/defaults");
const { normalizeProfileOverlayConfigs } = require("../src/main/state/overlay-configs");

function editorFixture(config, t) {
  let editor;
  let saved;
  let dom;
  const context = vm.createContext({
    overlayConfig: () => config, overlayProfileName: () => "Test", overlayCatalog: catalog,
    overlayDesignSelections: {}, wheelEditorContext: null,
    cryptoId: () => "fixture", flattenActions: () => [],
    giftCatalogById: new Map(), giftCatalogByName: new Map(), GIFT_CATALOG: [],
    saveOverlayConfig: async (key, next) => { saved = { key, next }; },
    snapshot: { soundCatalog: [], state: { settings: {} } }
  });
  for (const file of ["core/ui-foundations.js", "core/components.js", "editors/core.js", "features/media/gift-picker.js", "features/overlays/fields.js", "features/overlays/wheel-editor.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app", file), "utf8"), context);
  }
  context.overlayLivePreview = () => "<aside>Aperçu</aside>";
  context.openEditor = (options) => {
    editor = options;
    dom?.window.close();
    dom = new JSDOM(`<form>${editor.body}</form>`);
    context.dialogBody = dom.window.document.querySelector("form");
    context.dialogForm = context.dialogBody;
    context.dialog = { open: true };
    context.FormData = dom.window.FormData;
  };
  context.openWheelOverlayConfig(catalog.definition("wheel"), config);
  t.after(() => dom.window.close());
  return {
    context, form: () => context.dialogForm,
    submit: () => editor.onSubmit(), saved: () => saved
  };
}

test("modifier l’apparence d’une roue conserve les IDs, cadeaux, jeux et actions, même indisponibles", async (t) => {
  const config = createDefaultOverlayConfigs().wheel;
  const bindings = { gameIds: ["minecraft", "gta"], actionIds: ["spin-action"] };
  config.gameBindings = bindings;
  const wheel = config.wheels[0];
  wheel.gameBindings = { actionId: "game-wheel-action" };
  wheel.trigger = "Rose";
  wheel.triggerGift = { giftId: "5655", giftName: "Rose", giftImageUrl: "https://example.test/rose.png" };
  wheel.segments[0].actionId = "unavailable-game-action";
  wheel.segments[0].action = "action";
  wheel.segments[0].gameBinding = { gameId: "gta", effectId: "weather" };
  const original = structuredClone(config);
  const fixture = editorFixture(config, t);
  const form = fixture.form();
  assert.equal(form.querySelector("details").open, false);
  for (const name of ["wheelTitle", "wheelShowTitle", "wheelTitleColor"]) assert.equal(form.elements.namedItem(name).closest("details"), null);
  for (const name of ["xOffset", "yOffset", "scale", "fontSize", "textRadius", "textSegmentOffset", "textBoxWidth", "textBoxHeight", "textAngleOffset", "textAlign"]) assert.equal(form.elements.namedItem(name), null, name);
  for (const name of ["wheelTitleScale", "wheelTextScale", "wheelWinnerScale"]) {
    assert.equal(form.elements.namedItem(name).type, "range");
    assert.equal(form.elements.namedItem(name).min, "50");
    assert.equal(form.elements.namedItem(name).max, "400");
    form.elements.namedItem(name).value = "350";
  }
  const action = form.querySelector('[name="wheelSegmentActionId"]');
  assert.equal(action.value, "unavailable-game-action");
  assert.match(action.selectedOptions[0].textContent, /indisponible/);
  form.elements.wheelTitle.value = "MA ROUE";
  form.elements.wheelTitleColor.value = "#123456";
  form.elements.wheelShowTitle.value = "false";
  form.elements.wheelDesign.value = "royal";
  form.elements.glow.value = "0";
  await fixture.submit();
  const saved = fixture.saved();
  assert.equal(saved.key, "wheel");
  assert.deepEqual(saved.next.gameBindings, bindings);
  const selected = saved.next.wheels[0];
  assert.equal(selected.id, wheel.id);
  assert.deepEqual(selected.gameBindings, wheel.gameBindings);
  assert.equal(selected.trigger, wheel.trigger);
  assert.equal(selected.triggerGift.giftId, wheel.triggerGift.giftId);
  assert.equal(selected.segments[0].actionId, "unavailable-game-action");
  assert.deepEqual(selected.segments[0].gameBinding, wheel.segments[0].gameBinding);
  assert.deepEqual([...selected.segments].map((segment) => segment.id), wheel.segments.map((segment) => segment.id));
  assert.equal(selected.segments.at(-1).action, "spin");
  assert.equal(selected.settings.wheelTitle, "MA ROUE");
  assert.equal(selected.settings.wheelShowTitle, false);
  assert.equal(selected.settings.wheelTitleScale, 350);
  assert.equal(selected.settings.wheelTextScale, 350);
  assert.equal(selected.settings.wheelWinnerScale, 350);
  assert.equal(selected.settings.glow, 0);
  assert.equal(selected.design, "royal");
  const reopened = fixture.context.normalizeWheelConfig(saved.next);
  assert.equal(reopened.wheels.length, 2, "changer le design ne crée pas une nouvelle roue");
  assert.equal(new Set(reopened.wheels.map((entry) => entry.id)).size, 2);
  const restored = normalizeProfileOverlayConfigs({ wheel: saved.next }).wheel;
  assert.equal(restored.wheels.length, 2);
  assert.equal(restored.selectedWheelId, saved.next.selectedWheelId);
  assert.deepEqual(JSON.parse(JSON.stringify(saved.next.wheels[1])), { ...original.wheels[1], triggerGift: null });
  assert.deepEqual(config, original, "l’éditeur ne modifie pas les réglages actifs avant enregistrement");
});

test("changer de roue conserve ses réglages indépendants et les filtres de cadeaux", async (t) => {
  const config = createDefaultOverlayConfigs().wheel;
  config.wheels[0].giftValueFilter = { operator: "greaterOrEqual", value: 50 };
  const fixture = editorFixture(config, t);
  fixture.form().elements.wheelTitle.value = "Première roue";
  fixture.form().elements.wheelTextScale.value = "200";
  fixture.context.collectWheelEditorForm();
  fixture.context.wheelEditorContext.config.selectedWheelId = config.wheels[1].id;
  fixture.context.openWheelOverlayConfig(catalog.definition("wheel"));
  assert.equal(fixture.form().elements.wheelTitle.value, config.wheels[1].name);
  assert.equal(fixture.form().elements.wheelTextScale.value, "100");
  fixture.form().elements.wheelTitle.value = "";
  await fixture.submit();
  const saved = fixture.saved().next;
  assert.equal(saved.wheels[0].settings.wheelTitle, "Première roue");
  assert.equal(saved.wheels[0].settings.wheelTextScale, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(saved.wheels[0].giftValueFilter)), config.wheels[0].giftValueFilter);
  assert.equal(saved.wheels[1].settings.wheelTitle, "");
});

test("l’URL de roue transmet la roue sélectionnée et son titre vide sans changer les canaux", () => {
  const config = createDefaultOverlayConfigs().wheel;
  config.selectedWheelId = config.wheels[1].id;
  config.wheels[1].settings = { ...config.wheels[1].settings, wheelTitle: "", wheelShowTitle: false, wheelTitleScale: 250, wheelTextScale: 400, wheelWinnerColor: "#abcdef" };
  const context = vm.createContext({ URL, overlayCatalog: catalog, window: { addEventListener() {} } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/features/overlays/catalog.js"), "utf8"), context);
  context.overlayConfig = () => config;
  const item = { ...catalog.definition("wheel"), url: "http://localhost/overlay/?view=wheel&token=local-test" };
  const url = new URL(context.overlayUrl(item));
  for (const [key, value] of Object.entries({ view: "wheel", token: "local-test", design: "royal", wheelTitle: "", wheelShowTitle: "false", wheelTitleScale: "250", wheelTextScale: "400", wheelWinnerColor: "#abcdef" })) assert.equal(url.searchParams.get(key), value, key);
  assert.equal(url.searchParams.get("choices"), config.wheels[1].segments.map((segment) => segment.label).join("|"));
});

test("les anciennes roues en double se sélectionnent individuellement et gardent leurs secteurs", async (t) => {
  const config = createDefaultOverlayConfigs().wheel;
  const duplicate = structuredClone(config.wheels[0]);
  duplicate.name = "Autre roue avec le même ancien identifiant";
  duplicate.segments[0].label = "Action du deuxième jeu";
  duplicate.segments[0].actionId = "second-game-action";
  config.wheels.push(duplicate);
  const before = structuredClone(config);
  const fixture = editorFixture(config, t);
  const selector = fixture.form().querySelector("[data-wheel-selection]");
  const ids = [...selector.options].map((option) => option.value);
  assert.equal(new Set(ids).size, 3);
  assert.equal(ids[0], config.wheels[0].id, "la cible des anciennes actions reste la première roue");
  assert.equal(selector.selectedOptions.length, 1);
  fixture.form().elements.wheelTitle.value = "Brouillon de la première roue";
  selector.value = ids[2];
  selector.dispatchEvent(new selector.ownerDocument.defaultView.Event("change", { bubbles: true }));
  const nextSelector = fixture.form().querySelector("[data-wheel-selection]");
  assert.equal(nextSelector.value, ids[2]);
  assert.equal(nextSelector.selectedOptions.length, 1);
  assert.equal(fixture.form().elements.wheelName.value, duplicate.name);
  assert.equal(fixture.form().querySelector('[name="wheelSegmentLabel"]').value, duplicate.segments[0].label);
  assert.equal(fixture.form().querySelector('[name="wheelSegmentActionId"]').value, "second-game-action");
  await fixture.submit();
  const saved = fixture.saved().next;
  assert.equal(saved.wheels[0].settings.wheelTitle, "Brouillon de la première roue");
  assert.equal(saved.wheels[2].segments[0].actionId, "second-game-action");
  const restored = normalizeProfileOverlayConfigs({ wheel: saved }).wheel;
  assert.deepEqual(restored.wheels.map((wheel) => wheel.id), ids);
  assert.equal(restored.selectedWheelId, ids[2]);
  assert.deepEqual(config, before);
});

test("la réparation des identifiants ne réutilise aucun ID réservé et reste stable", () => {
  const wheels = [{ id: "a", name: "Première" }, { id: "a", name: "Copie" }, { id: "a_copy_2" }, { id: "wheel_4" }, {}];
  const before = structuredClone(wheels);
  const normalized = catalog.normalizeWheelIdentities(wheels);
  assert.equal(new Set(normalized.map((wheel) => wheel.id)).size, wheels.length);
  assert.equal(normalized[0].id, "a");
  assert.equal(normalized[2].id, "a_copy_2");
  assert.deepEqual(catalog.normalizeWheelIdentities(normalized), normalized);
  assert.deepEqual(wheels, before);
  const configs = normalizeProfileOverlayConfigs({ wheel: { wheels, selectedWheelId: "a" } });
  assert.equal(configs.wheel.selectedWheelId, "a");
  assert.equal(new Set(configs.wheel.wheels.map((wheel) => wheel.id)).size, wheels.length);
});
