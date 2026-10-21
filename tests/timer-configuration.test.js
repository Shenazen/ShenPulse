"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const catalog = require("../resources/overlays/overlay-catalog");
const { normalizeProfileOverlayConfigs } = require("../src/main/state/overlay-configs");

function editorFixture(overrides = {}, key = "timer") {
  const config = { ...catalog.defaultConfig(key), ...overrides };
  let editor;
  let saved;
  const context = vm.createContext({
    overlayConfig: () => config,
    flattenActions: () => [{ rule: { name: "Jeu" }, action: { id: "linked-action", type: "timer.add" } }],
    actionTypeLabel: () => "Timer",
    overlayProfileName: () => "Test",
    overlayDesignSelections: {},
    saveOverlayConfig: async (key, next) => { saved = { key, next }; }
  });
  for (const file of ["core/ui-foundations.js", "core/components.js", "editors/core.js", "features/overlays/fields.js", "features/overlays/editor.js", "features/overlays/timer-editor.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app", file), "utf8"), context);
  }
  context.overlayLivePreview = () => "<aside>Aperçu</aside>";
  context.openEditor = (options) => { editor = options; };
  context.openOverlayConfig(catalog.definition(key));
  const dom = new JSDOM(`<form>${editor.body}</form>`);
  return { dom, editor, config, saved: () => saved };
}

test("le timer utilise le formulaire compact, 13 designs et des tailles jusqu’à 400 %", (t) => {
  const fixture = editorFixture({ seconds: 90061 });
  t.after(() => fixture.dom.window.close());
  const form = fixture.dom.window.document.querySelector("form");
  const advanced = form.querySelector("details");
  assert.equal(advanced.open, false);
  for (const name of ["theme", "title", "showHeader", "timerTitleColor", "timerValueColor", "showHours", "timerDays", "timerHours", "timerMinutes", "timerSeconds"]) {
    assert.ok(form.elements.namedItem(name), name);
    assert.equal(form.elements.namedItem(name).closest("details"), null, name);
  }
  for (const name of ["completionActionId", "timerAutoStart", "enabled", "showWhenIdle", "font", "showShadow", "rtl", "saturation", "hue", "incrementShortcut", "decrementShortcut", "resetShortcut"]) {
    assert.equal(form.elements.namedItem(name)?.closest("details"), advanced, name);
  }
  for (const name of ["timerTitleScale", "timerValueScale"]) {
    const slider = form.elements.namedItem(name);
    assert.equal(slider.type, "range");
    assert.equal(slider.min, "50");
    assert.equal(slider.max, "400");
  }
  assert.equal(form.elements.theme.options.length, 13);
  assert.equal(form.elements.theme.value, "gta");
  assert.equal(form.querySelector('option[value="classic"]'), null);
  for (const name of ["scale", "xOffset", "yOffset", "fontSize"]) assert.equal(form.elements.namedItem(name), null);
  assert.equal(form.elements.timerDays.value, "1");
  assert.equal(form.elements.timerHours.value, "1");
  assert.equal(form.elements.timerMinutes.value, "1");
  assert.equal(form.elements.timerSeconds.value, "1");
  const names = [...form.querySelectorAll("[name]")].map((el) => el.name);
  assert.equal(new Set(names).size, names.length);
});

for (const completionActionId of ["linked-action", "temporarily-unavailable-action"]) {
  test(`une sauvegarde visuelle conserve l’action ${completionActionId}, les commandes et les associations de jeu`, async (t) => {
    const bindings = { packIds: ["minecraft-bedrock-box", "minecraft-sandbox-3"], actionIds: ["add-time", "remove-time"] };
    const fixture = editorFixture({ seconds: 90061, completionActionId, timerAutoStart: true, timerPaused: true, incrementShortcut: "", decrementShortcut: "Ctrl+S", resetShortcut: "Ctrl+R", gameBindings: bindings, scale: 125, xOffset: 20, yOffset: -10 });
    t.after(() => fixture.dom.window.close());
    const form = fixture.dom.window.document.querySelector("form");
    assert.equal(form.elements.completionActionId.value, completionActionId);
    for (const [name, value] of Object.entries({ title: "Mon chrono", timerTitleColor: "#123456", timerValueColor: "#abcdef", timerTitleScale: "350", timerValueScale: "400", theme: "naruto" })) form.elements.namedItem(name).value = value;
    await fixture.editor.onSubmit(new fixture.dom.window.FormData(form));
    const { key, next } = fixture.saved();
    assert.equal(key, "timer");
    for (const name of ["seconds", "completionActionId", "timerAutoStart", "timerPaused", "incrementShortcut", "decrementShortcut", "resetShortcut", "scale", "xOffset", "yOffset"]) assert.equal(next[name], fixture.config[name], name);
    assert.deepEqual(next.gameBindings, bindings);
    assert.equal(next.title, "Mon chrono");
    assert.equal(next.timerTitleColor, "#123456");
    assert.equal(next.timerValueColor, "#abcdef");
    assert.equal(next.timerTitleScale, 350);
    assert.equal(next.timerValueScale, 400);
    assert.equal(next.theme, "naruto");
  });
}

test("les anciens profils timer passent à GTA en conservant les couleurs et les liens", () => {
  const saved = { theme: "classic", title: "Partie", seconds: 600, accentColor: "#123456", textColor: "#abcdef", completionActionId: "finish-game", timerAutoStart: true, gameBindings: { packId: "minecraft-bedrock-box" } };
  const snapshot = structuredClone(saved);
  const migrated = normalizeProfileOverlayConfigs({ timer: saved }).timer;
  assert.equal(migrated.theme, "gta");
  assert.equal(migrated.timerTitleColor, "#123456");
  assert.equal(migrated.timerValueColor, "#abcdef");
  for (const key of ["title", "seconds", "completionActionId", "timerAutoStart", "gameBindings"]) assert.deepEqual(migrated[key], saved[key], key);
  assert.deepEqual(saved, snapshot);
  for (const [theme] of catalog.definition("timer").options) assert.equal(normalizeProfileOverlayConfigs({ timer: { theme } }).timer.theme, theme);
});

test("les URL du timer conservent le canal, la durée et les couleurs indépendantes", () => {
  const context = vm.createContext({ URL, overlayCatalog: catalog, window: { addEventListener() {} } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/features/overlays/catalog.js"), "utf8"), context);
  context.overlayConfig = () => catalog.defaultConfig("timer");
  const item = { ...catalog.definition("timer"), url: "http://localhost/overlay/?view=timer&token=local-test" };
  const url = new URL(context.overlayUrl(item, { theme: "classic", seconds: 90061, timerTitleColor: "#123456", timerValueColor: "#abcdef", timerTitleScale: 350, timerValueScale: 400 }));
  for (const [key, value] of Object.entries({ view: "timer", token: "local-test", theme: "gta", seconds: "90061", timerTitleColor: "#123456", timerValueColor: "#abcdef", timerTitleScale: "350", timerValueScale: "400" })) assert.equal(url.searchParams.get(key), value);
});

test("le timer multiplicateur conserve ses liaisons et son facteur lors d’une sauvegarde visuelle", async (t) => {
  const bindings = { packIds: ["minecraft-bedrock-box", "gta-mont-chiliad"], actionIds: ["wins-bonus", "gift-bonus"] };
  const fixture = editorFixture({ seconds: 90061, multiplier: 20, timerAutoStart: true, completionActionId: "legacy-reference", gameBindings: bindings }, "multiplierTimer");
  t.after(() => fixture.dom.window.close());
  const form = fixture.dom.window.document.querySelector("form");
  assert.equal(form.querySelector('[data-overlay-config-editor="multiplierTimer"]') !== null, true);
  assert.equal(form.elements.multiplier.value, "20");
  assert.equal(form.elements.theme.options.length, 13);
  assert.equal(form.elements.timerTitleScale.max, "400");
  assert.equal(form.elements.timerValueScale.max, "400");
  assert.equal(form.elements.namedItem("completionActionId"), null);
  for (const name of ["scale", "xOffset", "yOffset"]) assert.equal(form.elements.namedItem(name), null);
  form.elements.title.value = "Bonus du jeu";
  form.elements.theme.value = "naruto";
  form.elements.timerMultiplierColor.value = "#123456";
  form.elements.timerTitleScale.value = "400";
  await fixture.editor.onSubmit(new fixture.dom.window.FormData(form));
  const { key, next } = fixture.saved();
  assert.equal(key, "multiplierTimer");
  assert.equal(next.seconds, 90061);
  assert.equal(next.multiplier, 20);
  assert.equal(next.timerAutoStart, true);
  assert.equal(next.completionActionId, "legacy-reference");
  assert.deepEqual(next.gameBindings, bindings);
  assert.equal(next.title, "Bonus du jeu");
  assert.equal(next.theme, "naruto");
  assert.equal(next.timerMultiplierColor, "#123456");
  assert.equal(next.timerTitleScale, 400);
});

test("migrer le design du multiplicateur conserve ses associations, ses couleurs et son facteur", () => {
  const original = { theme: "classic", multiplier: 20, seconds: 600, accentColor: "#123456", textColor: "#abcdef", timerAutoStart: true, actionIds: ["bonus1", "bonus2"] };
  const normalized = normalizeProfileOverlayConfigs({ multiplierTimer: original }).multiplierTimer;
  assert.equal(normalized.theme, "gta");
  assert.equal(normalized.timerTitleColor, "#123456");
  assert.equal(normalized.timerValueColor, "#abcdef");
  assert.equal(normalized.timerMultiplierColor, "#ffe575");
  for (const field of ["multiplier", "seconds", "timerAutoStart", "actionIds"]) assert.deepEqual(normalized[field], original[field]);
  assert.equal(original.theme, "classic");
});
