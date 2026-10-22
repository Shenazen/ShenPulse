"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const categories = require("../src/shared/game-categories");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { gameCatalogRenderer } = require("./helpers/game-catalog-renderer");
const catalog = loadShenazenGameCatalog(path.resolve(__dirname, "../resources"));
const get = id => structuredClone(catalog.find(pack => pack.id === id));
const displayed = page => [...page.querySelectorAll(".game-gallery-tile")].map(tile => tile.dataset.id);
const counts = page => Object.fromEntries([...page.querySelectorAll('[data-action="set-game-category"]')].map(button => [button.dataset.value, Number(button.querySelector(".game-category-count").textContent)]));

function fixture(t, options) {
  const packs = [get("the-mortuary-assistant"), get("resident-evil-3"), get("gtav-montchiliad"), get("super-mario-kart"), get("stardew-valley"), get("coin-pusher"), get("fortnite"), get("minecraft-bedrock-box"), get("minecraft-sandbox-3"), get("minecraft-survival-plugin")];
  const f = gameCatalogRenderer(packs, options);
  t.after(f.close);
  return f;
}

test("chaque jeu livré possède une catégorie principale explicite et les neuf filtres restent stables", () => {
  assert.deepEqual(categories.categories.map(category => category.label), ["Tout", "Horreur", "Action & tir", "GTA", "Course & conduite", "Simulation & gestion", "Aventure & survie", "Minecraft & bac à sable", "Jeux ShenPulse"]);
  for (const pack of catalog) {
    assert.ok(Object.hasOwn(categories.byId, pack.id), pack.id);
    assert.equal(pack.catalogCategory, categories.byId[pack.id], pack.id);
  }
  assert.equal(categories.categoryFor(get("color-strike")), "shenpulse");
  assert.equal(categories.categoryFor(get("euro-truck-simulator-2")), "racing");
  assert.equal(categories.categoryFor(get("terraria")), "sandbox");
});

test("les compteurs ignorent les jeux et modes masqués et comptent chaque mode Minecraft visible une seule fois", (t) => {
  const f = fixture(t, { hidden: ["resident-evil-3", "minecraft-sandbox-3"] });
  const page = f.render();
  assert.deepEqual(counts(page), { all: 7, horror: 1, action: 0, gta: 1, racing: 1, simulation: 1, adventure: 0, sandbox: 2, shenpulse: 1 });
  assert.equal(displayed(page).length, 6, "deux modes Minecraft partagent leur lanceur");
  assert.match(page.querySelector(".result-count").textContent, /^7 jeux \/ modes$/);
  const minecraft = f.context.visibleGamePacks().find(pack => pack.id === "minecraft");
  assert.equal(minecraft.modes.length, 2);
  assert.ok(minecraft.tags.includes("2 modes"));
  assert.doesNotMatch(minecraft.description, /SandBox 3/);
  assert.equal(categories.countGames(f.context.visibleGamePacks()), 7);
});

test("cliquer une catégorie filtre les cartes et garde les catégories vides accessibles", async (t) => {
  const f = fixture(t);
  f.render();
  await f.context.handleNavigationAndGameEditorAction({ action: "set-game-category", target: { dataset: { value: "horror" } } });
  assert.deepEqual(displayed(f.context.content), ["the-mortuary-assistant", "resident-evil-3"]);
  assert.equal(f.context.content.querySelector('[data-value="horror"]').getAttribute("aria-pressed"), "true");
  await f.context.handleNavigationAndGameEditorAction({ action: "set-game-category", target: { dataset: { value: "adventure" } } });
  assert.equal(displayed(f.context.content).length, 0);
  assert.ok(f.context.content.querySelector(".empty-inline"));
  assert.equal(f.context.content.querySelectorAll('[data-action="set-game-category"]').length, 9);
  assert.equal(f.context.content.querySelector('[data-value="adventure"]').disabled, false);
});

test("la recherche et les conditions d’accès affinent les compteurs sans révéler les jeux privés", (t) => {
  const f = fixture(t);
  f.context.gameSearch = "Mario";
  let page = f.render();
  assert.deepEqual(displayed(page), ["super-mario-kart"]);
  assert.equal(counts(page).all, 1);
  assert.equal(counts(page).racing, 1);
  f.context.gameSearch = "Fortnite";
  assert.equal(counts(f.render()).all, 0);
  f.context.gameSearch = "";
  f.context.gameFilter = "purchase";
  page = f.render();
  assert.deepEqual(displayed(page), ["coin-pusher"]);
  assert.equal(counts(page).all, 1);
  assert.equal(counts(page).shenpulse, 1);
});

test("le propriétaire compte ses jeux privés, mais jamais ceux explicitement masqués", (t) => {
  const f = fixture(t, { owner: true, hidden: ["minecraft-bedrock-box"] });
  const before = JSON.stringify(f.context.snapshot);
  assert.equal(counts(f.render()).all, 9);
  assert.equal(counts(f.context.content).action, 1, "Fortnite reste privé par défaut pour les autres comptes");
  assert.equal(JSON.stringify(f.context.snapshot), before);
});
