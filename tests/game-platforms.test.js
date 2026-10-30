"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const gamePass = require("../src/shared/game-pass-catalog");
const { gameCatalogRenderer } = require("./helpers/game-catalog-renderer");

function fixture(t, packs = []) {
  const fixture = gameCatalogRenderer(packs);
  t.after(fixture.close);
  return fixture;
}

test("les choix administrateur remplacent les logos par défaut et peuvent tous les retirer", t => {
  const { context } = fixture(t);
  context.siteVisibility.games = {
    hades: { scope: "public", platforms: ["epic-games", "game-pass", "steam", "steam", "invalide"], platformsConfigured: true },
    balatro: { scope: "public", platformsConfigured: true }
  };
  assert.deepEqual(Array.from(context.gamePlatformIds({ id: "hades" })), ["epic-games", "game-pass", "steam"]);
  assert.deepEqual(Array.from(context.gamePlatformIds({ id: "balatro" })), []);
  assert.equal(context.gamePlatformLogos({ id: "balatro" }), "");
  assert.doesNotMatch(context.gamePlatformLogos({ id: "hades" }), /platform-invalide/);
});

test("la jaquette Minecraft reprend les logos des seuls modes regroupés, y compris aucun", t => {
  const { context } = fixture(t);
  const modes = ["minecraft-bedrock-box", "minecraft-sandbox-3"].map(id => ({ id }));
  context.siteVisibility.games = {
    "minecraft-bedrock-box": { scope: "public", platforms: ["steam", "game-pass"] },
    "minecraft-sandbox-3": { scope: "public", platformsConfigured: true }
  };
  assert.deepEqual(Array.from(context.gamePlatformIds({ id: "minecraft", modeSelector: true, modes })), ["steam", "game-pass"]);
  assert.deepEqual(Array.from(context.gamePlatformIds({ id: "minecraft", modeSelector: true, modes: [modes[1]] })), []);
});

test("le logo Game Pass est réservé à ARK, Balatro et Blue Prince sans doublon", (t) => {
  const { context } = fixture(t);
  for (const id of ["ark-survival-ascended", "balatro", "blue-prince"]) {
    assert.deepEqual(Array.from(context.gamePlatformIds({ id })), ["steam", "game-pass"]);
  }
  for (const id of ["minecraft", "minecraft-bedrock-box", "minecraft-sandbox-3", "minecraft-survival-plugin"]) {
    assert.deepEqual(Array.from(context.gamePlatformIds({ id })), ["microsoft-store"]);
  }
  for (const id of [...Object.keys(gamePass.products), ...Object.keys(gamePass.benefits)].filter(id => !["ark-survival-ascended", "balatro", "blue-prince"].includes(id))) {
    assert.equal(context.gamePlatformIds({ id }).includes("game-pass"), false, id);
  }
  assert.deepEqual(Array.from(context.gamePlatformIds({ id: "balatro", storefronts: ["epic-games", "steam", "steam", "game-pass"] })), ["epic-games", "steam", "game-pass"]);
  assert.deepEqual(Array.from(context.gamePlatformIds({ id: "hades", storefronts: ["epic-games", "steam", "game-pass"] })), ["epic-games", "steam"]);
});

test("une ancienne mention Game Pass ou une plateforme configurée ne crée pas une fausse disponibilité", (t) => {
  const { context } = fixture(t);
  for (const id of ["celeste", "cult-of-the-lamb", "terraria", "deep-rock-galactic-survivor", "gtav-montchiliad", "coin-pusher", "pokemon-red-blue", "unknown-game"]) {
    assert.equal(context.gamePlatformIds({ id, storefronts: ["steam", "game-pass"], description: "Fiche Game Pass", tags: ["Game Pass"] }).includes("game-pass"), false, id);
  }
  assert.equal(gamePass.offerFor({ id: "unknown-game" }), null);
  assert.match(gamePass.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
  for (const id of [...Object.values(gamePass.products), ...Object.values(gamePass.benefits)]) assert.match(id, /^[A-Z0-9]{12}$/);
});

test("les trois logos conservés gardent un libellé accessible", (t) => {
  const { context } = fixture(t);
  for (const [id, label, store] of [["ark-survival-ascended", "PC Game Pass", "Steam"], ["balatro", "PC Game Pass", "Steam"], ["blue-prince", "PC Game Pass", "Steam"]]) {
    const dom = new JSDOM(context.gamePlatformLogos({ id }));
    t.after(() => dom.window.close());
    const logos = dom.window.document.querySelector(".tile-platforms");
    assert.equal(logos.querySelectorAll(".platform-game-pass").length, 1);
    assert.equal(logos.querySelector(".platform-game-pass").title, label);
    assert.match(logos.getAttribute("aria-label"), new RegExp(label));
    assert.match(logos.getAttribute("aria-label"), new RegExp(store));
    assert.ok(logos.querySelector(".platform-game-pass svg"));
    assert.equal(logos.querySelector("svg image, svg script, svg use"), null);
  }
});

test("la légende Game Pass suit uniquement les jeux visibles et ne modifie ni accès ni compteurs", (t) => {
  const balatro = { id: "balatro", name: "Balatro", accessMode: "included", effects: [] };
  const jar = { id: "coin-pusher", name: "Coin Pusher", accessMode: "purchase", effects: [] };
  const visible = fixture(t, [balatro, jar]);
  const before = JSON.stringify(visible.context.snapshot);
  let page = visible.render();
  const legend = page.querySelector(".game-platform-legend");
  assert.equal(legend.querySelectorAll(".platform-game-pass").length, 1);
  assert.match(legend.textContent, /abonnement distinct de ShenPulse Pro/);
  assert.equal(page.querySelector('[data-value="all"] .game-category-count').textContent, "2");
  assert.equal(JSON.stringify(visible.context.snapshot), before);
  visible.context.siteVisibility.games.balatro = { scope: "hidden" };
  page = visible.render();
  assert.equal(page.querySelector(".game-platform-legend .platform-game-pass"), null);
  assert.equal(page.querySelector('[data-value="all"] .game-category-count').textContent, "1");
});


test("la légende ne conserve que les plateformes des résultats de recherche et de catégorie",t=>{
 const packs=[
  {id:"the-sims-4",name:"Les Sims 4",storefronts:["ea"],effects:[],accessMode:"included"},
  {id:"doom-2016",name:"DOOM",storefronts:["gog"],effects:[],accessMode:"included"},
  {id:"coin-pusher",name:"Coin Pusher",effects:[],accessMode:"purchase"}
 ];
 const f=fixture(t,packs),before=JSON.stringify(f.context.snapshot);
 let page=f.render();assert.equal(page.querySelectorAll('.game-platform-legend-item').length,3);
 f.context.gameSearch="Sims";page=f.render();assert.ok(page.querySelector('.game-platform-legend .platform-ea'));assert.equal(page.querySelectorAll('.game-platform-legend-item').length,1);
 f.context.gameSearch="";f.context.gameCategory="shenpulse";page=f.render();assert.ok(page.querySelector('.game-platform-legend .platform-shenpulse'));assert.equal(page.querySelector('.game-platform-legend .platform-ea'),null);assert.equal(page.querySelector('.game-platform-legend .platform-gog'),null);
 f.context.gameSearch="absent-game";page=f.render();assert.equal(page.querySelector('.game-platform-legend'),null);assert.ok(page.querySelector('.empty-inline'));
 assert.equal(JSON.stringify(f.context.snapshot),before);
});

test("une plateforme d’un mode masqué ne reste pas dans l’entête du lanceur",t=>{
 const f=fixture(t,[{id:"minecraft-bedrock-box",name:"Bedrock",effects:[]},{id:"minecraft-sandbox-3",name:"Sandbox",effects:[]}]);
 f.context.siteVisibility.games={"minecraft-bedrock-box":{scope:"public",platforms:["microsoft-store"]},"minecraft-sandbox-3":{scope:"hidden",platforms:["gog"]}};
 const page=f.render();assert.ok(page.querySelector('.game-platform-legend .platform-microsoft-store'));assert.equal(page.querySelector('.game-platform-legend .platform-gog'),null);
});


test("une fiche privée Game Pass seul ne récupère pas le logo Steam de secours", t => {
  const { context } = fixture(t);
  const pack = { id: "ball-x-pit", storefronts: ["game-pass"], ownerPreparation: { platformAvailabilityVerified: true } };
  assert.deepEqual(Array.from(context.gamePlatformIds(pack)), ["game-pass"]);
  const logo = context.gamePlatformLogos(pack);
  assert.match(logo, /platform-game-pass/);
  assert.doesNotMatch(logo, /platform-steam|platform-microsoft-store/);
  assert.deepEqual(Array.from(context.gamePlatformIds(pack, { games: { "ball-x-pit": { platforms: ["steam"], platformsConfigured: true } } })), ["steam"]);
});

test("les nouveaux jeux affichent les plateformes gratuites ou incluses retenues, sans changer leurs installateurs", t => {
  const requested = require("../scripts/integration-preparation/requested-games.json").games;
  const prepared = require("../resources/catalogs/owner-prepared-modules.json");
  const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
  const { installerForGame } = require("../src/main/game-installer-manifest");
  const packs = loadShenazenGameCatalog(require("node:path").resolve(__dirname, "../resources"));
  const { context } = fixture(t, packs);
  const recent = packs.filter(pack => pack.ownerPreparation);
  const gamePassPacks = recent.filter(pack => gamePass.products[pack.id]);
  assert.equal(gamePassPacks.length, 20);
  for (const pack of recent) {
    const specification = requested.find(game => game.id === pack.id);
    assert.deepEqual(pack.storefronts, specification.platforms, pack.id);
    assert.deepEqual(Array.from(context.gamePlatformIds(pack)), specification.platforms, pack.id);
  }
  for (const pack of gamePassPacks) assert.deepEqual(Array.from(context.gamePlatformIds(pack)), ["game-pass"], pack.id);
  for (const id of ["peggle-deluxe", "peggle-nights", "plants-vs-zombies-goty"]) {
    assert.deepEqual(Array.from(context.gamePlatformIds(recent.find(pack => pack.id === id))), ["ea"], id);
  }
  assert.deepEqual(Array.from(context.gamePlatformIds(recent.find(pack => pack.id === "doom-2016"))), ["gog"]);
  for (const id of ["team-fortress-2", "supermarket-together"]) {
    assert.deepEqual(Array.from(context.gamePlatformIds(recent.find(pack => pack.id === id))), ["steam"], id);
  }
  assert.deepEqual(Array.from(context.gamePlatformIds(recent.find(pack => pack.id === "the-sims-4"))), ["steam", "ea"]);
  assert.ok(packs.some(pack => pack.id === "find-the-needle-demo"));
  assert.deepEqual(installerForGame("ball-x-pit").steamAppIds, ["2062430"]);
  assert.equal(prepared["ball-x-pit"].asset.sha256.length, 64);
});
