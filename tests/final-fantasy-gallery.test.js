"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), path = require("node:path");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { gameCatalogRenderer } = require("./helpers/game-catalog-renderer");
const episodes = loadShenazenGameCatalog(path.resolve(__dirname, "../resources")).filter(p => /^final-fantasy-[1-5]-pixel-remaster$/.test(p.id));
const familyId = "final-fantasy-pixel-remaster";

function fixture(t, options) {
  const f = gameCatalogRenderer(structuredClone(episodes), options); t.after(f.close);
  f.context.snapshot.appVersion = "2.1.3";
  return f;
}

test("les cinq Final Fantasy ont une seule carte, cinq épisodes comptabilisés et leurs propres images", t => {
  const f = fixture(t), before = JSON.stringify(f.context.snapshot);
  const page = f.render(), cards = page.querySelectorAll(".game-gallery-tile");
  assert.equal(cards.length, 1); assert.equal(cards[0].dataset.id, familyId);
  assert.equal(cards[0].querySelectorAll(".game-tile-collection img").length, 5);
  assert.match(cards[0].textContent, /Final Fantasy — Pixel Remaster/);
  assert.match(page.querySelector(".result-count").textContent, /^5 jeux \/ modes$/);
  assert.equal(page.querySelector('[data-value="adventure"] .game-category-count').textContent, "5");
  const family = f.context.visibleGamePacks()[0];
  assert.deepEqual(Array.from(family.modes, p => p.id), episodes.map(p => p.id));
  assert.deepEqual(Array.from(f.context.gamePlatformIds(family)), ["game-pass"]);
  assert.equal(JSON.stringify(f.context.snapshot), before);
});

test("la carte et son sélecteur respectent les jeux masqués et la version minimale", t => {
  const hidden = episodes[1].id, f = fixture(t, { hidden: [hidden] });
  const page = f.render(), family = f.context.visibleGamePacks()[0];
  assert.equal(family.modes.length, 4); assert.ok(!family.modes.some(p => p.id === hidden));
  assert.equal(page.querySelectorAll(".game-tile-collection img").length, 4);
  assert.match(page.querySelector(".result-count").textContent, /^4 jeux \/ modes$/);
  f.context.gameSearch = "Final Fantasy"; assert.equal(f.render().querySelectorAll(".game-gallery-tile").length, 1);
  f.context.gameCategory = "horror"; assert.equal(f.render().querySelectorAll(".game-gallery-tile").length, 0);
  f.context.gameCategory = "all"; f.context.snapshot.appVersion = "2.1.2";
  assert.equal(f.render().querySelectorAll(".game-gallery-tile").length, 0);
});

test("cliquer la carte ouvre le choix I à V puis chaque bouton ouvre le bon épisode sans modifier les configurations", async t => {
  const f = fixture(t), c = f.context, entered = [], errors = [];
  c.currentPage = "games";
  c.showProNavigationOffers = () => false; c.canNavigateTo = () => true; c.requireGameAccess = () => true;
  c.enterGameWorkspace = async pack => { entered.push(pack.id); };
  c.gameArtwork = pack => "assets/games/" + pack.artwork;
  c.toast = (...args) => errors.push(args); c.dialog = { close() {} };
  c.openEditor = options => { c.picker = options; c.pickerBody = f.dom.window.document.createElement("div"); c.pickerBody.innerHTML = options.body; };
  const before = JSON.stringify(c.snapshot);
  await c.handleNavigationAndGameEditorAction({ action: "open-game", id: familyId, target: { dataset: {} } });
  assert.match(c.picker.title, /Final Fantasy Pixel Remaster/);
  assert.match(c.pickerBody.textContent, /À quel épisode/);
  assert.doesNotMatch(c.pickerBody.textContent, /Minecraft|GTA|PLATEFORME DE SABLE/);
  const buttons = [...c.pickerBody.querySelectorAll('[data-action="open-game-mode"]')];
  assert.equal(buttons.length, 5);
  for (let i = 0; i < buttons.length; i++) {
    const button = buttons[i]; assert.equal(button.dataset.id, episodes[i].id);
    assert.match(button.textContent, /Ouvrir cet épisode/);
    assert.ok(button.querySelector("img").src.endsWith(episodes[i].artwork));
    await c.handleNavigationAndGameEditorAction({ action: "open-game-mode", id: button.dataset.id, target: button });
  }
  assert.deepEqual(entered, episodes.map(p => p.id)); assert.deepEqual(errors, []);
  assert.equal(JSON.stringify(c.snapshot), before);
  c.siteVisibility.games[episodes[1].id] = { scope: "hidden" };
  await c.handleNavigationAndGameEditorAction({ action: "open-game-mode", id: episodes[1].id, target: buttons[1] });
  assert.equal(entered.length, 5); assert.equal(errors.at(-1)[0], "Mode indisponible");
});
