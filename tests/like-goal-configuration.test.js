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
  const config = { ...catalog.defaultConfig("likeGoal"), ...overrides };
  const item = catalog.definitions.find((entry) => entry.key === "likeGoal");
  let editor;
  let saved;
  const context = vm.createContext({
    overlayConfig: () => config,
    flattenActions: () => [{ rule: { name: "Bravo" }, action: { id: "celebrate", type: "test" } }],
    actionTypeLabel: () => "Test",
    overlayProfileName: () => "Test",
    overlayDesignSelections: {},
    saveOverlayConfig: async (key, next) => { saved = { key, next }; }
  });
  for (const file of [
    "core/ui-foundations.js", "core/components.js", "editors/core.js",
    "features/overlays/fields.js", "features/overlays/editor.js", "features/overlays/like-goal-editor.js"
  ]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app", file), "utf8"), context);
  }
  context.overlayLivePreview = () => "<aside>Aperçu</aside>";
  context.openEditor = (options) => { editor = options; };
  context.openOverlayConfig(item);
  const dom = new JSDOM(`<form>${editor.body}</form>`);
  return { dom, editor, config, saved: () => saved };
}

test("le formulaire Like Goal regroupe l’essentiel et conserve les options avancées", (t) => {
  const { dom } = editorFixture();
  t.after(() => dom.window.close());
  const form = dom.window.document.querySelector("form");
  const advanced = form.querySelector("details");
  assert.equal(advanced.open, false);
  for (const name of ["title", "theme", "target", "showHeader", "likeGoalTitleColor", "likeGoalContentColor", "progressLabel", "showGoal", "showPercent", "likeGoalPercentColor"]) {
    assert.ok(form.elements.namedItem(name), name);
    assert.equal(form.elements.namedItem(name).closest("details"), null, name);
  }
  for (const name of ["whenReached", "completionActionId", "current", "goalBaseline", "font", "likeGoalTitleScale", "likeGoalContentScale", "enabled", "showWhenIdle", "showShadow", "rtl", "saturation", "hue"]) {
    assert.equal(form.elements.namedItem(name)?.closest("details"), advanced, name);
  }
  assert.equal(form.querySelector("[name*='OffsetX'], [name*='OffsetY'], [name='fontSize']"), null);
  for (const name of ["scale", "xOffset", "yOffset"]) assert.equal(form.elements.namedItem(name), null);
  for (const name of ["likeGoalTitleScale", "likeGoalContentScale"]) {
    const slider = form.elements.namedItem(name);
    assert.equal(slider.type, "range");
    assert.equal(slider.min, "50");
    assert.equal(slider.max, "400");
  }
  const names = [...form.querySelectorAll("[name]")].map((element) => element.name);
  assert.equal(new Set(names).size, names.length);
  assert.equal(form.elements.theme.options.length, 13);
  assert.equal(form.elements.theme.value, "gta");
  assert.equal(form.querySelector('[name="theme"] option[value="classic"]'), null);
});

test("enregistrer le formulaire garde les réglages utiles, les libellés vides et les couleurs", async (t) => {
  const fixture = editorFixture({ current: 500, goalBaseline: 100, likeGoalTitleOffsetX: 200, completionActionId: "celebrate", scale: 125, xOffset: 30, yOffset: -10 });
  t.after(() => fixture.dom.window.close());
  const form = fixture.dom.window.document.querySelector("form");
  for (const [name, value] of Object.entries({ title: "Objectif <LIVE>", progressLabel: "", showHeader: "false", showPercent: "false", likeGoalPercentColor: "#123456", theme: "naruto", likeGoalTitleScale: "350", likeGoalContentScale: "400" })) {
    form.elements.namedItem(name).value = value;
  }
  await fixture.editor.onSubmit(new fixture.dom.window.FormData(form));
  const { key, next } = fixture.saved();
  assert.equal(key, "likeGoal");
  assert.equal(next.title, "Objectif <LIVE>");
  assert.equal(next.progressLabel, "");
  assert.equal(next.current, 500);
  assert.equal(next.goalBaseline, 100);
  assert.equal(next.completionActionId, "celebrate");
  assert.equal(next.likeGoalPercentColor, "#123456");
  assert.equal(next.showHeader, false);
  assert.equal(next.showPercent, false);
  assert.equal(next.theme, "naruto");
  assert.equal(next.likeGoalTitleScale, 350);
  assert.equal(next.likeGoalContentScale, 400);
  assert.equal(next.scale, 125);
  assert.equal(next.xOffset, 30);
  assert.equal(next.yOffset, -10);
  assert.equal("likeGoalTitleOffsetX" in next, false);
});

test("les anciens profils perdent uniquement les décalages internes devenus automatiques", () => {
  const saved = { title: "Mon LIVE", target: 100000, goalBaseline: 1200, completionActionId: "celebrate", likeGoalTitleOffsetX: 90, likeGoalTitleOffsetY: -20, likeGoalContentOffsetX: 80, likeGoalContentOffsetY: 15, likeGoalContentScale: 125, likeGoalTitleColor: "#123456", showPercent: false, xOffset: 30 };
  const normalized = normalizeProfileOverlayConfigs({ likeGoal: saved }).likeGoal;
  for (const [key, value] of Object.entries(saved)) {
    if (/likeGoal.*Offset[XY]/.test(key)) assert.equal(key in normalized, false);
    else assert.equal(normalized[key], value, key);
  }
  assert.equal(saved.likeGoalTitleOffsetX, 90, "la normalisation ne modifie pas l’entrée");
  const mappings = catalog.configParameterMappings;
  for (const key of ["likeGoalTitleOffsetX", "likeGoalTitleOffsetY", "likeGoalContentOffsetX", "likeGoalContentOffsetY"]) assert.equal(key in mappings, false);
});

test("GTA remplace Classique pour les nouveaux et anciens Like Goal sans changer les autres designs", () => {
  const { createDefaultOverlayConfigs } = require("../src/main/defaults");
  assert.equal(createDefaultOverlayConfigs().likeGoal.theme, "gta");
  assert.equal(catalog.defaultConfig("likeGoal").theme, "gta");
  const saved = { theme: "classic", title: "Mon objectif", target: 2500, likeGoalTitleColor: "#123456" };
  const configs = normalizeProfileOverlayConfigs({ likeGoal: saved, coinJar: { theme: "classic" } });
  assert.equal(configs.likeGoal.theme, "gta");
  assert.equal(configs.likeGoal.title, saved.title);
  assert.equal(configs.likeGoal.target, saved.target);
  assert.equal(configs.likeGoal.likeGoalTitleColor, saved.likeGoalTitleColor);
  assert.equal(configs.coinJar.theme, "classic");
  for (const [theme] of catalog.definition("likeGoal").options) {
    assert.equal(normalizeProfileOverlayConfigs({ likeGoal: { theme } }).likeGoal.theme, theme);
  }
});

test("les sélections et URL historiques du Like Goal utilisent GTA", () => {
  const context = vm.createContext({
    URL, overlayCatalog: catalog, window: { addEventListener() {} },
    snapshot: { state: { settings: { overlayConfigs: { likeGoal: { theme: "classic", title: "Mon objectif" } } } } },
    overlayDesignSelections: { likeGoal: "classic" }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/features/overlays/catalog.js"), "utf8"), context);
  const item = { ...catalog.definition("likeGoal"), url: "http://localhost/overlay/?view=like-goal&theme=classic" };
  assert.equal(context.overlayConfig("likeGoal").theme, "gta");
  assert.equal(context.selectedOverlayDesign(item), "gta");
  const url = new URL(context.overlayUrl(item, { theme: "classic" }));
  assert.equal(url.searchParams.get("theme"), "gta");
  assert.equal(url.searchParams.get("title"), "Mon objectif");
});

test("l’URL OBS conserve un libellé volontairement vide et toutes les couleurs", () => {
  const context = vm.createContext({ URL, overlayCatalog: catalog, window: { addEventListener() {} } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/features/overlays/catalog.js"), "utf8"), context);
  context.overlayConfig = () => catalog.defaultConfig("likeGoal");
  const item = { ...catalog.definition("likeGoal"), url: "http://localhost/overlay/?view=like-goal" };
  const url = new URL(context.overlayUrl(item, { progressLabel: "", likeGoalTitleColor: "#123456", likeGoalContentColor: "#abcdef", likeGoalPercentColor: "#654321" }));
  assert.equal(url.searchParams.get("progressLabel"), "");
  assert.equal(url.searchParams.get("titleColor"), "#123456");
  assert.equal(url.searchParams.get("contentColor"), "#abcdef");
  assert.equal(url.searchParams.get("percentColor"), "#654321");
});

test("l’aperçu connecté utilise le moteur du projet tout en conservant l’URL OBS installée", () => {
  const installedUrl = "http://127.0.0.1:17654/overlay/?view=like-goal&token=installed";
  const projectUrl = "http://127.0.0.1:41738/overlay/?view=like-goal&token=preview";
  const snapshot = { localOverlayUrls: { likeGoal: installedUrl }, previewOverlayUrls: { likeGoal: projectUrl } };
  const context = vm.createContext({ URL, snapshot, overlayCatalog: catalog, isAccountAuthenticated: () => true, window: { addEventListener() {} } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/features/overlays/catalog.js"), "utf8"), context);
  context.overlayConfig = () => catalog.defaultConfig("likeGoal");
  const item = { ...catalog.definition("likeGoal"), url: installedUrl };
  const preview = new URL(context.overlayRuntimePreviewUrl(item, { theme: "naruto", likeGoalTitleScale: 135, likeGoalContentScale: 200 }));
  assert.equal(preview.origin, "http://127.0.0.1:41738");
  assert.equal(preview.searchParams.get("theme"), "naruto");
  assert.equal(preview.searchParams.get("titleScale"), "135");
  assert.equal(preview.searchParams.get("contentScale"), "200");
  assert.equal(new URL(context.localOverlayUrl(item)).origin, "http://127.0.0.1:17654");
  delete snapshot.previewOverlayUrls;
  assert.equal(context.overlayCatalogPreviewUrl(item), installedUrl, "l’application normale garde sa source locale");
  context.isAccountAuthenticated = () => false;
  assert.equal(context.overlayCatalogPreviewUrl(item), "", "un invité ne reçoit pas la source privée installée");
});
