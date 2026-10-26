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

test("tous les jeux possèdent des catégories explicites valides et les neuf filtres restent stables", () => {
  assert.deepEqual(categories.categories.map(category => category.label), ["Tout", "Horreur", "Action & tir", "GTA", "Course & conduite", "Simulation & gestion", "Aventure & survie", "Minecraft & bac à sable", "Jeux ShenPulse"]);
  for (const pack of catalog) {
    assert.ok(Object.hasOwn(categories.byId, pack.id), pack.id);
    assert.equal(pack.catalogCategory, categories.byId[pack.id], pack.id);
    assert.deepEqual(pack.catalogCategories, categories.categoriesFor({ id: pack.id }), pack.id);
    assert.equal(new Set(pack.catalogCategories).size, pack.catalogCategories.length, pack.id);
    assert.equal(pack.catalogCategories[0], pack.catalogCategory, pack.id);
    assert.ok(pack.catalogCategories.every(id => id !== "all" && categories.categories.some(category => category.id === id)), pack.id);
  }
  assert.equal(categories.categoryFor(get("color-strike")), "shenpulse");
  assert.equal(categories.categoryFor(get("euro-truck-simulator-2")), "racing");
  assert.equal(categories.categoryFor(get("terraria")), "sandbox");
});

test("les compteurs ignorent les jeux et modes masqués et comptent chaque mode Minecraft visible une seule fois", (t) => {
  const f = fixture(t, { hidden: ["resident-evil-3", "minecraft-sandbox-3"] });
  const page = f.render();
  assert.deepEqual(counts(page), { all: 7, horror: 1, action: 2, gta: 1, racing: 2, simulation: 3, adventure: 4, sandbox: 3, shenpulse: 1 });
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
  f.context.gameSearch = "Mortuary";
  await f.context.handleNavigationAndGameEditorAction({ action: "set-game-category", target: { dataset: { value: "gta" } } });
  assert.equal(displayed(f.context.content).length, 0);
  assert.ok(f.context.content.querySelector(".empty-inline"));
  assert.equal(f.context.content.querySelectorAll('[data-action="set-game-category"]').length, 9);
  assert.equal(f.context.content.querySelector('[data-value="gta"]').disabled, false);
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
  assert.equal(counts(f.context.content).action, 4, "RE3, GTA, Fortnite privé et le mode Minecraft Survival sont visibles pour le propriétaire");
  assert.equal(JSON.stringify(f.context.snapshot), before);
});

test("DREDGE apparaît dans ses trois catégories avec une seule carte et un seul jeu dans Tout", async (t) => {
  const f = gameCatalogRenderer([get("dredge"), get("super-mario-kart"), get("blue-prince")]);
  t.after(f.close);
  const before = JSON.stringify(f.context.snapshot);
  let page = f.render();
  assert.equal(counts(page).all, 3);
  assert.equal(counts(page).horror, 1);
  assert.equal(counts(page).simulation, 1);
  assert.equal(counts(page).adventure, 2);
  for (const value of ["horror", "simulation", "adventure"]) {
    await f.context.handleNavigationAndGameEditorAction({ action: "set-game-category", target: { dataset: { value } } });
    page = f.context.content;
    assert.deepEqual(displayed(page), value === "adventure" ? ["dredge", "blue-prince"] : ["dredge"]);
    assert.equal(displayed(page).filter(id => id === "dredge").length, 1);
    assert.equal(counts(page).all, 3, "changer de catégorie ne recalcule pas Tout sur la sélection seule");
  }
  assert.equal(JSON.stringify(f.context.snapshot), before, "aucune configuration de jeu n’est modifiée");
});

test("les principaux croisements de genres sont présents sans assimiler toute aventure à un bac à sable", () => {
  const expected = {
    "dredge": ["horror", "simulation", "adventure"],
    "euro-truck-simulator-2": ["racing", "simulation"],
    "cult-of-the-lamb": ["simulation", "action", "adventure"],
    "resident-evil-3": ["horror", "action", "adventure"],
    "resident-evil-7-biohazard": ["horror", "action", "adventure"],
    "dead-by-daylight": ["horror", "action", "adventure"],
    "demonologist": ["horror", "action", "adventure"],
    "the-mortuary-assistant": ["horror", "simulation", "adventure"],
    "stardew-valley": ["simulation", "adventure", "sandbox"],
    "unturned": ["adventure", "action", "sandbox"],
    "fallout-4": ["action", "adventure", "sandbox"],
    "palworld": ["adventure", "action", "simulation", "sandbox"],
    "ark-survival-ascended": ["adventure", "action", "sandbox"],
    "no-mans-sky": ["adventure", "action", "simulation", "sandbox"],
    "wobbly-life": ["sandbox", "action", "simulation", "adventure"],
    "gtav-montchiliad": ["gta", "action", "racing", "adventure"],
    "hollow-knight": ["adventure", "action"],
    "hollow-knight-silksong": ["adventure", "action"],
    "escape-from-duckov": ["action", "adventure"],
    "color-strike": ["shenpulse", "action"],
    "tiklive-stack-tower": ["shenpulse", "simulation"],
    "blue-prince": ["adventure"],
    "pokemon-red-blue": ["adventure"],
    "balatro": ["simulation"]
  };
  for (const [id, wanted] of Object.entries(expected)) assert.deepEqual(get(id).catalogCategories, wanted, id);
});

test("les catégories secondaires respectent les masquages, la recherche et la version minimale", (t) => {
  const future = get("dredge"); future.minAppVersion = "99.0.0";
  const f = gameCatalogRenderer([get("dredge"), get("euro-truck-simulator-2"), get("fortnite")], { hidden: ["dredge"] });
  t.after(f.close);
  f.context.gameCategory = "simulation";
  let page = f.render();
  assert.deepEqual(displayed(page), ["euro-truck-simulator-2"]);
  assert.equal(counts(page).all, 1);
  assert.equal(counts(page).horror, 0);
  assert.equal(counts(page).sandbox, 0, "Fortnite privé ne fuit pas dans sa catégorie secondaire");
  f.context.gameSearch = "DREDGE";
  assert.equal(counts(f.render()).all, 0);
  f.context.siteVisibility.games = {};
  f.context.snapshot.packs = [future, get("euro-truck-simulator-2")];
  f.context.snapshot.appVersion = "2.0.5";
  f.context.gameSearch = "";
  page = f.render();
  assert.deepEqual(displayed(page), ["euro-truck-simulator-2"]);
  assert.equal(counts(page).horror, 0);
});

test("Minecraft compte et présente uniquement ses modes visibles appartenant à la catégorie choisie", (t) => {
  const f = gameCatalogRenderer([get("minecraft-bedrock-box"), get("minecraft-sandbox-3"), get("minecraft-survival-plugin")]);
  t.after(f.close);
  let page = f.render();
  assert.equal(counts(page).all, 3);
  assert.equal(counts(page).sandbox, 3);
  assert.equal(counts(page).adventure, 1);
  assert.equal(counts(page).action, 1);
  assert.deepEqual(categories.categoriesFor(f.context.visibleGamePacks()[0]), ["sandbox", "action", "adventure"]);
  f.context.gameCategory = "adventure";
  page = f.render();
  assert.deepEqual(displayed(page), ["minecraft"]);
  assert.match(page.querySelector(".result-count").textContent, /^1 jeu \/ mode$/);
  assert.equal(counts(page).all, 3, "les compteurs de filtres restent basés sur les modes visibles avant sélection");
  f.context.siteVisibility.games["minecraft-survival-plugin"] = { scope: "hidden" };
  page = f.render();
  assert.equal(displayed(page).length, 0);
  assert.equal(counts(page).all, 2);
  assert.equal(counts(page).adventure, 0);
  assert.deepEqual(categories.categoriesFor(f.context.visibleGamePacks()[0]), ["sandbox"], "un mode masqué n’attribue pas ses catégories au lanceur");
});

test("les listes de catégories sont dédupliquées, filtrent les valeurs inconnues et restent compatibles avec les anciennes fiches", () => {
  assert.deepEqual(categories.categoriesFor({ id: "custom", catalogCategory: "horror" }), ["horror"]);
  assert.deepEqual(categories.categoriesFor({ id: "custom", catalogCategories: ["horror", "horror", "all", "unknown", "adventure"] }), ["horror", "adventure"]);
  assert.deepEqual(categories.categoriesFor({ id: "dredge", catalogCategories: ["unknown"] }), ["horror", "simulation", "adventure"]);
  assert.equal(categories.matchesCategory(get("dredge"), "all"), true);
  assert.equal(categories.matchesCategory(get("dredge"), "racing"), false);
  assert.equal(categories.countGames([get("dredge")]), 1);
  assert.deepEqual(categories.categoriesFor({ id: "constructor" }), ["adventure"]);
});
