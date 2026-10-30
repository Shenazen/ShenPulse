"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), path = require("node:path");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { installerForGame } = require("../src/main/game-installer-manifest");
const visibility = require("../src/shared/visibility-catalog");
const { gameCatalogRenderer } = require("./helpers/game-catalog-renderer");
const catalog = loadShenazenGameCatalog(path.resolve(__dirname, "../resources"));
const removed = ["cookie-clicker", "crown-clash", "mari0", "sonic-robo-blast-2", "nova-the-squirrel", "voices-of-the-void", "unreal-tournament-99", "unreal-tournament-2004", "pvz-fusion"];
const shortcuts = require("node:fs").readFileSync(path.resolve(__dirname, "../src/renderer/app/core/bootstrap.js"), "utf8").split("// Prepared private integrations.")[1].split("// End prepared private integrations.")[0];

test("les neuf jeux retirés n’ont plus de fiche, d’installation ni de raccourci même pour le propriétaire", t => {
  const owner = gameCatalogRenderer(catalog, { owner: true }); t.after(owner.close);
  for (const id of removed) {
    assert.equal(catalog.some(pack => pack.id === id), false, id);
    assert.equal(installerForGame(id), null, id);
    assert.equal(shortcuts.includes(JSON.stringify(id)), false, id);
    owner.context.gamePageMode = "detail"; owner.context.selectedGameId = id;
    const page = owner.render();
    assert.equal(owner.context.gamePageMode, "catalog", id);
    assert.equal(page.querySelector('[data-id="' + id + '"]'), null, id);
  }
  for (const id of ["find-the-needle-demo", "shenfarm", "shenpaint", "shenkite", "splash-bombes", "gtav-hiking-enhanced", "farming-simulator-25"]) {
    assert.ok(catalog.some(pack => pack.id === id), id);
    assert.ok(installerForGame(id), id);
  }
});

test("les trois plateformes exclues disparaissent de la légende et des anciens choix administrateur", t => {
  const owner = gameCatalogRenderer(catalog, { owner: true }); t.after(owner.close);
  const legend = owner.render().querySelector(".game-platform-legend");
  assert.ok(legend);
  for (const platform of ["browser", "itch-io", "standalone"]) {
    assert.equal(visibility.GAME_PLATFORM_IDS.includes(platform), false, platform);
    assert.equal(legend.querySelector(".platform-" + platform), null, platform);
  }
  const stale = { games: { "ball-x-pit": { platforms: ["game-pass", "browser", "itch-io", "standalone"], platformsConfigured: true } } };
  assert.deepEqual(visibility.gamePlatformsFor(stale, "ball-x-pit"), ["game-pass"]);
  assert.deepEqual(Array.from(owner.context.gamePlatformIds({ id: "ball-x-pit" }, stale)), ["game-pass"]);
});
