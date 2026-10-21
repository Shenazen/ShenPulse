"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const catalog = require("../resources/overlays/overlay-catalog");
const { normalizeProfileOverlayConfigs } = require("../src/main/state/overlay-configs");

for (const key of ["topDonors", "topTappers"]) {
  test(`configurer ${key} conserve ses associations et ses options utiles`, async (t) => {
    const bindings = { actionIds: ["gift-action", "like-action"], gameIds: ["minecraft-bedrock-box"] };
    const config = { ...catalog.defaultConfig(key), gameBindings: bindings, completionActionId: "legacy-action", customReference: "preserved", scale: 110, xOffset: -10, yOffset: 20, showCrown: false, showRankBadges: false, rowOpacity: 0 };
    let editor;
    let saved;
    const context = vm.createContext({ overlayConfig: () => config, overlayProfileName: () => "Test", overlayDesignSelections: {}, saveOverlayConfig: async (id, next) => { saved = { id, next }; } });
    for (const file of ["core/ui-foundations.js", "core/components.js", "editors/core.js", "features/overlays/fields.js", "features/overlays/editor.js", "features/overlays/leaderboard-editor.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app", file), "utf8"), context);
    context.overlayLivePreview = () => "<aside>Aperçu</aside>";
    context.openEditor = (options) => { editor = options; };
    context.openOverlayConfig(catalog.definition(key));
    const dom = new JSDOM(`<form>${editor.body}</form>`);
    t.after(() => dom.window.close());
    const form = dom.window.document.querySelector("form");
    assert.equal(form.elements.theme.options.length, 13);
    assert.equal(form.elements.theme.value, "gta");
    assert.equal(form.querySelector('option[value="classic"]'), null);
    assert.equal(form.querySelector("details").open, false);
    for (const name of ["theme", "maxRows", "title", "showHeader", "leaderboardTitleColor", "nameColor", "scoreColor", "showMetricLabel", "showRank", "showAvatars", "showCrown", "showRankBadges"]) assert.equal(form.elements.namedItem(name).closest("details"), null, name);
    for (const name of ["scale", "xOffset", "yOffset", "fontSize", "kind"]) assert.equal(form.elements.namedItem(name), null);
    const names = [...form.querySelectorAll("[name]")].map((el) => el.name);
    assert.equal(names.length, new Set(names).size);
    for (const name of ["leaderboardTitleScale", "leaderboardNameScale", "leaderboardScoreScale"]) {
      const slider = form.elements.namedItem(name);
      assert.equal(slider.type, "range");
      assert.equal(slider.min, "50");
      assert.equal(slider.max, "400");
      slider.value = "400";
    }
    form.elements.title.value = "Mon classement";
    form.elements.theme.value = "naruto";
    form.elements.leaderboardTitleColor.value = "#123456";
    form.elements.leaderboardMetricLabel.value = "";
    form.elements.leaderboardShowUnit.value = "false";
    form.elements.leaderboardUnitColor.value = "#abcdef";
    form.elements.leaderboardUnitScale.value = "250";
    form.elements.leaderboardAvatarScale.value = "75";
    assert.equal(form.elements.leaderboardAvatarScale.max, "100");
    await editor.onSubmit(new dom.window.FormData(form));
    assert.equal(saved.id, key);
    for (const name of ["gameBindings", "completionActionId", "customReference", "scale", "xOffset", "yOffset", "showCrown", "showRankBadges", "rowOpacity"]) assert.deepEqual(saved.next[name], config[name], name);
    assert.equal(saved.next.title, "Mon classement");
    assert.equal(saved.next.leaderboardTitleColor, "#123456");
    assert.equal(saved.next.leaderboardNameScale, 400);
    assert.equal(saved.next.leaderboardScoreScale, 400);
    assert.equal(saved.next.leaderboardMetricLabel, "");
    assert.equal(saved.next.leaderboardShowUnit, false);
    assert.equal(saved.next.leaderboardUnitColor, "#abcdef");
    assert.equal(saved.next.leaderboardUnitScale, 250);
    assert.equal(saved.next.leaderboardAvatarScale, 75);
  });

  test(`migrer ${key} vers GTA conserve ses couleurs, réglages et liens`, () => {
    const saved = { theme: "classic", textColor: "#123456", nameColor: "#abcdef", scoreColor: "#abcdef", maxRows: 2, showMetricLabel: false, actionIds: ["action1"], gameBindings: { gameId: "gta-mont-chiliad" } };
    const other = key === "topDonors" ? "topTappers" : "topDonors";
    const original = structuredClone(saved);
    const configs = normalizeProfileOverlayConfigs({ [key]: saved, [other]: { theme: "naruto", nameColor: "#789abc" } });
    assert.equal(configs[key].theme, "gta");
    assert.equal(configs[key].leaderboardTitleColor, "#123456");
    for (const name of ["nameColor", "scoreColor", "maxRows", "showMetricLabel", "actionIds", "gameBindings"]) assert.deepEqual(configs[key][name], saved[name]);
    assert.equal(configs[other].theme, "naruto");
    assert.equal(configs[other].nameColor, "#789abc");
    assert.deepEqual(saved, original);
    for (const [theme] of catalog.definition(key).options) assert.equal(normalizeProfileOverlayConfigs({ [key]: { theme } })[key].theme, theme);
  });

  test(`les URL de ${key} conservent leur type, leur canal et leurs nouveaux réglages`, () => {
    const context = vm.createContext({ URL, overlayCatalog: catalog, window: { addEventListener() {} } });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/features/overlays/catalog.js"), "utf8"), context);
    context.overlayConfig = () => catalog.defaultConfig(key);
    const kind = key === "topTappers" ? "tappers" : "donors";
    const item = { ...catalog.definition(key), url: `http://localhost/overlay/?view=leaderboard&kind=${kind}&token=test-local` };
    const url = new URL(context.overlayUrl(item, { theme: "classic", leaderboardTitleColor: "#123456", leaderboardTitleScale: 300, leaderboardNameScale: 400, leaderboardScoreScale: 350 }));
    for (const [name, value] of Object.entries({ view: "leaderboard", kind, token: "test-local", theme: "gta", leaderboardTitleColor: "#123456", leaderboardTitleScale: "300", leaderboardNameScale: "400", leaderboardScoreScale: "350" })) assert.equal(url.searchParams.get(name), value);
    const noUnit = new URL(context.overlayUrl(item, { leaderboardMetricLabel: "", leaderboardShowUnit: false, leaderboardUnitColor: "#abcdef", leaderboardUnitScale: 350, leaderboardAvatarScale: 75 }));
    assert.equal(noUnit.searchParams.has("leaderboardMetricLabel"), true);
    assert.equal(noUnit.searchParams.get("leaderboardMetricLabel"), "");
    assert.equal(noUnit.searchParams.get("leaderboardShowUnit"), "false");
    assert.equal(noUnit.searchParams.get("leaderboardUnitColor"), "#abcdef");
    assert.equal(noUnit.searchParams.get("leaderboardUnitScale"), "350");
    assert.equal(noUnit.searchParams.get("leaderboardAvatarScale"), "75");
  });
}
