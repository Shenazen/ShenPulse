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
  const config = { ...catalog.defaultConfig("coinJar"), ...overrides };
  let editor;
  let saved;
  const context = vm.createContext({
    URL, window: { addEventListener() {} }, overlayCatalog: catalog, snapshot: { state: { settings: {} } },
    overlayProfileName: () => "Test", overlayDesignSelections: {},
    saveOverlayConfig: async (key, next) => { saved = { key, next }; }
  });
  for (const file of ["core/ui-foundations.js", "core/components.js", "editors/core.js", "features/overlays/fields.js", "features/overlays/catalog.js", "features/overlays/editor.js", "features/overlays/coin-jar-editor.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app", file), "utf8"), context);
  }
  context.overlayConfig = () => config;
  context.overlayLivePreview = () => "<aside>Aperçu</aside>";
  context.openEditor = (options) => { editor = options; };
  context.openOverlayConfig(catalog.definition("coinJar"));
  const dom = new JSDOM(`<form>${editor.body}</form>`);
  return { dom, editor, config, context, saved: () => saved };
}

test("la Coin Jar conserve ses 14 modèles et regroupe les champs utiles sans placement manuel", (t) => {
  const fixture = editorFixture();
  t.after(() => fixture.dom.window.close());
  const form = fixture.dom.window.document.querySelector("form");
  assert.equal(form.querySelector("details").open, false);
  assert.equal(form.elements.model.options.length, 14);
  assert.equal(form.elements.model.value, "fantasy");
  for (const name of ["title", "showHeader", "coinJarTitleColor"]) {
    assert.ok(form.elements.namedItem(name), name);
    assert.equal(form.elements.namedItem(name).closest("details"), null, name);
  }
  for (const name of ["coinJarTitleScale"]) {
    assert.equal(form.elements.namedItem(name).type, "range");
    assert.equal(form.elements.namedItem(name).min, "50");
    assert.equal(form.elements.namedItem(name).max, "400");
  }
  for (const name of ["scale", "xOffset", "yOffset", "fontSize", "current", "target", "minCoins", "showGoal", "showPercent", "showBase", "coinJarLabel", "coinJarShowLabel", "coinJarValueColor", "coinJarLabelColor", "coinJarPercentColor", "coinJarValueScale", "coinJarLabelScale"]) assert.equal(form.elements.namedItem(name), null, name);
  assert.doesNotMatch(form.textContent, /compteur|objectif|pièces|pourcentage|libellé|jauge/i);
  const names = [...form.querySelectorAll("[name]")].map((el) => el.name);
  assert.equal(new Set(names).size, names.length);
});

test("la sauvegarde visuelle garde les associations d’actions et de jeux et les données héritées", async (t) => {
  const bindings = { gameIds: ["minecraft", "gta"], actionIds: ["gift-add", "jar-reset"] };
  const fixture = editorFixture({ current: 123, target: 1000, minCoins: 20, gameBindings: bindings, completionActionId: "unavailable-action", incrementShortcut: "Ctrl+J", scale: 120, xOffset: 12, yOffset: -15, customMetadata: { source: "game" } });
  t.after(() => fixture.dom.window.close());
  const form = fixture.dom.window.document.querySelector("form");
  for (const [name, value] of Object.entries({ model: "space", title: "MON BOCAL", coinJarTitleColor: "#123456", coinJarTitleScale: "350" })) form.elements.namedItem(name).value = value;
  await fixture.editor.onSubmit(new fixture.dom.window.FormData(form));
  const { key, next } = fixture.saved();
  assert.equal(key, "coinJar");
  for (const name of ["current", "target", "minCoins", "completionActionId", "incrementShortcut", "scale", "xOffset", "yOffset"]) assert.equal(next[name], fixture.config[name], name);
  assert.deepEqual(next.gameBindings, bindings);
  assert.deepEqual(next.customMetadata, fixture.config.customMetadata);
  assert.equal(next.model, "space");
  assert.equal(next.coinJarTitleScale, 350);
  assert.equal(next.coinJarTitleColor, "#123456");
  const restored = normalizeProfileOverlayConfigs({ coinJar: next }).coinJar;
  assert.deepEqual(restored.gameBindings, bindings);
  assert.equal(restored.completionActionId, "unavailable-action");
});

test("le titre vide est transmis à OBS sans revenir au titre par défaut", async (t) => {
  const fixture = editorFixture();
  t.after(() => fixture.dom.window.close());
  const form = fixture.dom.window.document.querySelector("form");
  form.elements.title.value = "";
  await fixture.editor.onSubmit(new fixture.dom.window.FormData(form));
  const url = new URL(fixture.context.overlayUrl({ ...catalog.definition("coinJar"), url: "http://localhost/overlay/?view=coin-jar" }, fixture.saved().next));
  assert.equal(url.searchParams.get("title"), "");
  assert.equal(url.searchParams.get("target"), null);
  assert.equal(url.searchParams.get("coinJarLabel"), null);
});

test("la couleur de titre héritée reste reprise sans ajouter de réglages de compteur", () => {
  const context = vm.createContext({ window: { addEventListener() {} }, overlayCatalog: catalog, snapshot: { state: { settings: { overlayConfigs: { coinJar: { textColor: "#123456", fontSize: 175 } } } } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/features/overlays/catalog.js"), "utf8"), context);
  const config = context.overlayConfig("coinJar");
  assert.equal(config.coinJarTitleColor, "#123456");
  const restored = normalizeProfileOverlayConfigs({ coinJar: { textColor: "#123456", fontSize: 175, model: "football" } }).coinJar;
  assert.equal(restored.coinJarTitleColor, "#123456");
  assert.equal(restored.model, "football");
  for (const name of ["current", "target", "minCoins", "showGoal", "showPercent", "showBase", "coinJarValueScale"]) assert.equal(Object.hasOwn(catalog.defaultConfig("coinJar"), name), false, name);
});

test("la carte Coin Jar regroupe les commandes dans son pied de carte", (t) => {
  const fixture = editorFixture();
  t.after(() => fixture.dom.window.close());
  const { context } = fixture;
  Object.assign(context, { isAccountAuthenticated: () => true, overlayUnlocked: () => true });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/features/overlays/cards.js"), "utf8"), context);
  context.overlayPreview = () => "<div>Aperçu</div>";
  context.overlayProfileName = () => "Test";
  const dom = new JSDOM(context.renderOverlayCard({ ...catalog.definition("coinJar"), url: "http://localhost/overlay/?view=coin-jar" }));
  t.after(() => dom.window.close());
  const { document } = dom.window;
  assert.equal(document.querySelector(".overlay-quick-actions"), null);
  assert.equal(document.querySelector('[data-action="open-url"]'), null);
  assert.equal(document.querySelectorAll('.overlay-card-footer [data-operation="reset"]').length, 1);
  for (const operation of ["add", "remove"]) assert.equal(document.querySelector(`[data-operation="${operation}"]`), null);
  assert.equal(document.querySelector('[data-operation="reset"]').textContent, "Réinitialiser");
});

test("le bouton réinitialiser vide les cadeaux de l’aperçu avec une commande absolue", async () => {
  const posted = [];
  const requested = [];
  let saved;
  const config = { ...catalog.defaultConfig("coinJar"), current: 150, gameBindings: { actionIds: ["linked-gift"] } };
  const context = vm.createContext({
    overlayDefinitions: () => [catalog.definition("coinJar")], canAccessOverlay: () => true, overlayUnlocked: () => true,
    overlayConfig: () => config, cryptoId: () => "test", dialog: { open: false },
    api: { testAction: async (action) => { requested.push(action); return { current: action.config.operation === "reset" ? 0 : 160 }; } },
    saveOverlayConfig: async (key, next) => { saved = next; },
    postOverlayCardEvent: (key, channel, payload) => posted.push({ key, channel, payload })
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/actions/overlays.js"), "utf8"), context);
  await context.performOverlayQuickAction("coinJar", "reset");
  assert.equal(requested[0].type, "overlay.coin-jar");
  assert.equal(requested[0].config.operation, "reset");
  assert.equal(posted[0].channel, "coin-jar");
  assert.equal(posted[0].payload.operation, "reset");
  assert.equal(posted[0].payload.current, 0);
  assert.deepEqual(saved.gameBindings, config.gameBindings);
  await context.performOverlayQuickAction("coinJar", "add", 10);
  assert.equal(posted[1].payload.operation, "set");
  assert.equal(posted[1].payload.current, 160, "la valeur IPC est absolue pour éviter les doubles incréments");
});
