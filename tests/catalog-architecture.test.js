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
  assert.equal(catalog.length, 56);
  // Évolution commerciale demandée le 15/10/2026 : seule cette différence
  // est retirée de la comparaison historique, aucun autre champ n'est ignoré.
  const prices = { "tiklive-climb": 9.99, "clash-of-live": 12.99, "tiklive-cube-wars": 9.99, "tiklive-stack-tower": 9.99 };
  const historical = structuredClone(catalog.filter(pack => !["hogwarts-legacy", "tcg-card-shop-simulator", "supermarket-simulator", "shift-at-midnight", "escape-from-duckov", "dead-by-daylight", "dredge", "egging-on", "fallout-4", "ark-survival-ascended", "balatro", "blue-prince", "find-the-needle-demo", "the-mortuary-assistant", "unturned", "crash-bandicoot-n-sane-trilogy"].includes(pack.id)));
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
  // Le classement du catalogue est ajouté sans changer les anciens jeux ou effets.
  for (const pack of historical) {
    assert.equal(pack.catalogCategory, require("../src/shared/game-categories").byId[pack.id]);
    assert.deepEqual(pack.catalogCategories, require("../src/shared/game-categories").categoriesFor({ id: pack.id }));
    delete pack.catalogCategory;
    delete pack.catalogCategories;
    // ZQSD devient le défaut d’installation demandé ; les autres champs restent figés.
    if (pack.connector.type === "windows-input") {
      assert.equal(pack.connector.keyLayout, "azerty");
      pack.connector.keyLayout = "wasd";
    }
  }
  // ARK, Balatro et Blue Prince sont désormais des intégrations exécutables ; leur
  // catalogue complet est vérifié séparément, les autres jeux restent figés.
  // Les conditions de jeu présentent désormais ShenPulse ; seuls leurs textes
  // et les libellés de documentation ont changé, les liens restent identiques.
  // Correctif ETS2 du 22/10 : installateur 1.0.5, port dédié et connexion
  // confirmée avant de démarrer la session ; les autres jeux restent figés.
  // Audit d’autonomie : hôte local des deux émulateurs, port RE3 séparé,
  // références sans module explicitement non exécutables (identifiants conservés).
  assert.equal(digest(historical), "b2b7d2519c1647e1f0e3a612e4bd15e64abfecfe9d214ccf4df02bc2bfcf0289");
  assert.equal(digest(minecraft), "2e91e74d5a5c4715d75052353ab3ceb1d395ed7c263981995581b3bc6aa63315");
  const next = loadShenazenGameCatalog(path.join(__dirname, "..", "resources"));
  catalog[0].name = "test isolé";
  assert.notEqual(next[0].name, catalog[0].name);
});

test("le manifeste garde versions, URLs, empreintes, ordre et gel de son API", () => {
  // Seule l'association de la nouvelle démo est ajoutée. Les installateurs
  // historiques restent comparés champ par champ par leur empreinte complète.
  const { "escape-from-duckov": duckov, "dead-by-daylight": dbd, dredge, "egging-on": egging, "fallout-4": fallout, "ark-survival-ascended": ark, balatro, "blue-prince": bluePrince, "find-the-needle-demo": demo, "the-mortuary-assistant": mortuary, unturned, "crash-bandicoot-n-sane-trilogy": crash, "hogwarts-legacy": hogwarts, "tcg-card-shop-simulator": tcg, "supermarket-simulator": market, "shift-at-midnight": shift, ...historicalInstallers } = GAME_INSTALLERS;
  assert.ok(hogwarts && tcg && market && shift);
  assert.ok(duckov, "Duckov est couvert par escape-from-duckov.test.js");
  assert.ok(dbd && dredge && egging && fallout, "les quatre nouvelles intégrations sont couvertes séparément");
  assert.ok(ark, "les interactions ARK sont couvertes séparément");
  assert.ok(balatro && bluePrince, "les deux nouveaux installateurs sont couverts par balatro-blue-prince.test.js");
  assert.ok(crash, "le pont Crash est couvert séparément");
  assert.ok(demo, "le nouvel installateur privé est ajouté séparément");
  assert.ok(mortuary, "le nouvel installateur Mortuary est couvert séparément");
  assert.ok(unturned, "le module Unturned est couvert séparément");
  // Migration Backblaze : seules les deux URL de packs historiques changent.
  const migrated = structuredClone(historicalInstallers);
  migrated["euro-truck-simulator-2"].assets[0].url = "https://one-click.crowdcontrol.live/TruckSimulator/TruckSimulator-CC.zip?ver=1.0.4";
  migrated["resident-evil-3"].assets.find(asset => asset.id === "mod").url = "https://one-click.crowdcontrol.live/RE3remake/RE3net-CC.zip?ver=2.1.2";
  const historicalManifest = { ...require("../src/main/game-installer-manifest"), GAME_INSTALLERS: migrated };
  // ETS2 1.0.5 ajoute le lancement unique et l’attente du processus ;
  // l’archive distante, sa taille et son empreinte restent identiques.
  // Le client Slim est remplacé par l’hôte local ; les archives des jeux
  // conservent leurs empreintes, RE3 configure uniquement son port dédié.
  assert.equal(digest(historicalManifest), "bbd15a8562900d35ea376622ddab8039349b3e73394d55334364d64bd9349284");
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
