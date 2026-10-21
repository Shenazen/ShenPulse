"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const catalog = require("../resources/overlays/overlay-catalog");
const { normalizeProfileOverlayConfigs } = require("../src/main/state/overlay-configs");

function editorFixture(overrides = {}) {
  const config = { ...catalog.defaultConfig("winCounter"), ...overrides };
  let editor;
  let saved;
  const context = vm.createContext({
    overlayConfig: () => config,
    overlayProfileName: () => "Test",
    overlayDesignSelections: {},
    saveOverlayConfig: async (key, next) => { saved = { key, next }; }
  });
  for (const file of ["core/ui-foundations.js", "core/components.js", "editors/core.js", "features/overlays/fields.js", "features/overlays/editor.js", "features/overlays/win-counter-editor.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app", file), "utf8"), context);
  }
  context.overlayLivePreview = () => "<aside>Aperçu</aside>";
  context.openEditor = (options) => { editor = options; };
  context.openOverlayConfig(catalog.definition("winCounter"));
  const dom = new JSDOM(`<form>${editor.body}</form>`);
  return { dom, editor, config, saved: () => saved };
}

test("une sauvegarde de l’apparence des wins conserve les commandes, valeurs et associations", async (t) => {
  const gameBindings = { packIds: ["gta-mont-chiliad", "minecraft-bedrock-box"], actionIds: ["wins-plus", "wins-minus", "wins-multiplier"] };
  const fixture = editorFixture({ current: -7, target: 123, allowNegative: true, incrementShortcut: "", decrementShortcut: "Ctrl+S", resetShortcut: "Ctrl+R", gameBindings, multiplier: 5, multiplierEndsAt: 987654321, completionActionId: "legacy-action", winCounterLabelOffsetX: 70, winCounterLabelOffsetY: -40, scale: 125, xOffset: 20, yOffset: -10 });
  t.after(() => fixture.dom.window.close());
  const form = fixture.dom.window.document.querySelector("form");
  assert.equal(form.elements.theme.options.length, 13);
  assert.equal(form.elements.theme.value, "gta");
  assert.equal(form.querySelector('option[value="classic"]'), null);
  assert.equal(form.querySelector("details").open, false);
  for (const name of ["scale", "xOffset", "yOffset", "fontSize", "winCounterLabelOffsetX", "winCounterLabelOffsetY"]) assert.equal(form.elements.namedItem(name), null);
  const names = [...form.querySelectorAll("[name]")].map((el) => el.name);
  assert.equal(new Set(names).size, names.length);
  for (const name of ["winCounterTitleScale", "winCounterValueScale", "winCounterGoalScale"]) {
    const slider = form.elements.namedItem(name);
    assert.equal(slider.type, "range");
    assert.equal(slider.min, "50");
    assert.equal(slider.max, "400");
    slider.value = "400";
  }
  for (const [name, value] of Object.entries({ title: "Wins du jeu", theme: "naruto", winCounterTitleColor: "#123456", winCounterGoalColor: "#abcdef", winCounterLabelColorNegative: "#aa1122", winCounterLabelColorNeutral: "#ddeeff", winCounterLabelColorPositive: "#22aa44" })) form.elements.namedItem(name).value = value;
  await fixture.editor.onSubmit(new fixture.dom.window.FormData(form));
  const { key, next } = fixture.saved();
  assert.equal(key, "winCounter");
  for (const name of ["current", "target", "allowNegative", "incrementShortcut", "decrementShortcut", "resetShortcut", "multiplier", "multiplierEndsAt", "completionActionId", "scale", "xOffset", "yOffset"]) assert.equal(next[name], fixture.config[name], name);
  assert.deepEqual(next.gameBindings, gameBindings);
  assert.equal(next.title, "Wins du jeu");
  assert.equal(next.theme, "naruto");
  assert.equal(next.winCounterTitleColor, "#123456");
  assert.equal(next.winCounterGoalColor, "#abcdef");
  assert.equal(next.winCounterTitleScale, 400);
  assert.equal(next.winCounterValueScale, 400);
  assert.equal(next.winCounterGoalScale, 400);
  assert.equal(next.winCounterLabelColorNegative, "#aa1122");
  assert.equal(next.winCounterLabelColorNeutral, "#ddeeff");
  assert.equal(next.winCounterLabelColorPositive, "#22aa44");
  assert.equal("winCounterLabelOffsetX" in next, false);
  assert.equal("winCounterLabelOffsetY" in next, false);
});

test("migrer les anciens wins vers GTA conserve les liaisons et les données", () => {
  const saved = { theme: "classic", current: -12, target: 250, allowNegative: true, textColor: "#123456", winCounterLabelColorPositive: "#abcdef", actionIds: ["bonus", "reset"], gameBindings: { packId: "gta-mont-chiliad" }, winCounterLabelOffsetX: 40, winCounterLabelOffsetY: -20, incrementShortcut: "Ctrl+W" };
  const original = structuredClone(saved);
  const normalized = normalizeProfileOverlayConfigs({ winCounter: saved }).winCounter;
  assert.equal(normalized.theme, "gta");
  assert.equal(normalized.winCounterTitleColor, "#123456");
  assert.equal(normalized.winCounterGoalColor, "#123456");
  for (const key of ["current", "target", "allowNegative", "winCounterLabelColorPositive", "actionIds", "gameBindings", "incrementShortcut"]) assert.deepEqual(normalized[key], saved[key], key);
  assert.equal("winCounterLabelOffsetX" in normalized, false);
  assert.equal("winCounterLabelOffsetY" in normalized, false);
  assert.deepEqual(saved, original);
  for (const [theme] of catalog.definition("winCounter").options) assert.equal(normalizeProfileOverlayConfigs({ winCounter: { theme } }).winCounter.theme, theme);
});

test("les URL wins conservent leur canal et transmettent les réglages centrés", () => {
  const context = vm.createContext({ URL, overlayCatalog: catalog, window: { addEventListener() {} } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/features/overlays/catalog.js"), "utf8"), context);
  context.overlayConfig = () => catalog.defaultConfig("winCounter");
  const item = { ...catalog.definition("winCounter"), url: "http://localhost/overlay/?view=win-counter&token=local-test" };
  const config = { theme: "classic", current: -12, target: 250, allowNegative: true, winCounterTitleColor: "#123456", winCounterGoalColor: "#abcdef", winCounterValueScale: 400, winCounterLabelOffsetX: 70 };
  const url = new URL(context.overlayUrl(item, config));
  for (const [key, value] of Object.entries({ view: "win-counter", token: "local-test", theme: "gta", current: "-12", target: "250", allowNegative: "true", winCounterTitleColor: "#123456", winCounterGoalColor: "#abcdef", winCounterValueScale: "400" })) assert.equal(url.searchParams.get(key), value);
  assert.equal(url.searchParams.has("labelX"), false);
});
