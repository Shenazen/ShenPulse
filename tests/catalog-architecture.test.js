"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { loadRendererModule } = require("./helpers/three-renderer-traces");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const minecraft = require("../src/main/minecraft-game-catalog");
const { GAME_INSTALLERS, installerForGame } = require("../src/main/game-installer-manifest");
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

// Références capturées avant extraction ; une évolution volontaire demande une revue de leur mise à jour.
test("le découpage garde exactement les catalogues de jeux et Minecraft", () => {
  const catalog = loadShenazenGameCatalog(path.join(__dirname, "..", "resources"));
  assert.equal(catalog.length, 52);
  // Évolution commerciale demandée le 15/10/2026 : seule cette différence
  // est retirée de la comparaison historique, aucun autre champ n'est ignoré.
  const prices = { "tiklive-climb": 9.99, "clash-of-live": 12.99, "tiklive-cube-wars": 9.99, "tiklive-stack-tower": 9.99 };
  const historical = structuredClone(catalog.filter(pack => !["find-the-needle-demo", "the-mortuary-assistant", "unturned", "crash-bandicoot-n-sane-trilogy"].includes(pack.id)));
  for (const pack of historical) if (Object.hasOwn(prices, pack.id)) {
    assert.equal(pack.price, prices[pack.id]);
    pack.price = 19.99;
  }
  // Ajout des illustrations demandé le 20/10 : seule l’image ajoutée au
  // registre est retirée de la comparaison historique, les autres champs restent couverts.
  const art = require("../resources/catalogs/game-interaction-art.json");
  const generated = new Map(art.entries.map(entry => [`${entry.gameId}/${entry.effectId}`, `../../resources/game-interaction-art/${entry.file}`]));
  for (const pack of historical) for (const effect of pack.effects) {
    const image = generated.get(`${pack.id}/${effect.id}`);
    if (image) { assert.equal(effect.image, image); delete effect.image; }
  }
  assert.equal(digest(historical), "f2fd495a0fba720538f4710955a6cfc611491dce109eed26ed2a426f3bb91a1c");
  assert.equal(digest(minecraft), "2e91e74d5a5c4715d75052353ab3ceb1d395ed7c263981995581b3bc6aa63315");
  const next = loadShenazenGameCatalog(path.join(__dirname, "..", "resources"));
  catalog[0].name = "test isolé";
  assert.notEqual(next[0].name, catalog[0].name);
});

test("le manifeste garde versions, URLs, empreintes, ordre et gel de son API", () => {
  // Seule l'association de la nouvelle démo est ajoutée. Les installateurs
  // historiques restent comparés champ par champ par leur empreinte complète.
  const { "find-the-needle-demo": demo, "the-mortuary-assistant": mortuary, unturned, "crash-bandicoot-n-sane-trilogy": crash, ...historicalInstallers } = GAME_INSTALLERS;
  assert.ok(crash, "le pont Crash est couvert séparément");
  assert.ok(demo, "le nouvel installateur privé est ajouté séparément");
  assert.ok(mortuary, "le nouvel installateur Mortuary est couvert séparément");
  assert.ok(unturned, "le module Unturned est couvert séparément");
  const historicalManifest = { ...require("../src/main/game-installer-manifest"), GAME_INSTALLERS: historicalInstallers };
  assert.equal(digest(historicalManifest), "599221e57439434c9502c6ea512329aea4eebca3e603412957b770b6cc868092");
  assert.ok(Object.isFrozen(GAME_INSTALLERS));
  for (const [id, manifest] of Object.entries(GAME_INSTALLERS)) assert.equal(installerForGame(id), manifest);
  assert.equal(installerForGame("inconnu"), null);
});

test("les dictionnaires FR/EN gardent toutes leurs clés et valeurs après extraction", () => {
  const file = path.join(__dirname, "..", "src/renderer/games/original-src/i18n/messages.ts");
  const { messages } = loadRendererModule(file).api;
  assert.equal(digest(messages), "e1548879664a116085c306c3719fe1682263e1edeaccce4e370203c64abac06d");
  assert.deepEqual(Object.keys(messages), ["fr", "en"]);
  assert.equal(Object.keys(messages.fr).length, 30);
});
