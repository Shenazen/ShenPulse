"use strict";

/** La console est exercée hors ligne : aucune visibilité réelle n'est publiée. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const visibilityTools = require("../src/shared/visibility-catalog");

const renderer = path.join(__dirname, "..", "src", "renderer", "app");
const privateGames = [
  { id: "fortnite", name: "Fortnite", ownerOnly: true, accessMode: "included" },
  { id: "find-the-needle-demo", name: "Find The Needle Demo", ownerOnly: true, accessMode: "included" }
];

function fixture(t, settings = {}) {
  const dom = new JSDOM("<main></main>");
  t.after(() => dom.window.close());
  const context = vm.createContext({
    visibilityTools,
    ShenPulseGamePassCatalog: require("../src/shared/game-pass-catalog"),
    pages: [
      { section: "Application" },
      { id: "games", label: "Jeux", title: "Jeux", kicker: "CATALOGUE" },
      ...["settings", "controllers", "admin"].map((id) => ({
        id, label: id, title: id, kicker: "PRIVÉ", ownerOnly: true, defaultScope: "admin"
      }))
    ],
    snapshot: { packs: [...privateGames, { id: "public-game", name: "Jeu public" }] },
    ACTION_TYPE_LABELS: { "audio.play": "Son" }, overlayDefinitions: () => [],
    adminVisibilitySection: "games", adminVisibilitySearch: "", adminBusy: false,
    adminDashboard: { siteSettings: structuredClone(settings) }, siteVisibility: structuredClone(settings),
    ADMIN_OWNER_EMAIL: "owner@example.invalid",
    accountSession: { authenticated: true, uid: "owner", email: "owner@example.invalid" },
    adminSession: { authorized: true, uid: "owner", email: "owner@example.invalid" },
    escapeHtml: (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
    render: () => {}, saved: [],
    openEditor: options => { context.editor = options; },
    api: { admin: {
      saveSiteSettings: async (value) => {
        const saved = JSON.parse(JSON.stringify(value));
        context.saved.push(saved);
        return saved;
      },
      visibility: async () => context.saved.at(-1)
    } }
  });
  for (const file of ["core/access-navigation.js", "features/games/access.js", "features/admin/page.js", "features/admin/game-platforms.js", "features/admin/game-versions.js", "features/admin/account.js"]) {
    vm.runInContext(fs.readFileSync(path.join(renderer, file), "utf8"), context, { filename: file });
  }
  context.render = () => {};
  context.main = dom.window.document.querySelector("main");
  context.renderVisibility = () => {
    context.main.innerHTML = context.renderAdminVisibility();
    return context.main;
  };
  return context;
}

test("chaque jeu expose sa version minimale sans publier au rendu ou à l’ouverture", async t => {
  const context = fixture(t, { games: { "public-game": { scope: "public", minAppVersion: "2.0.5" } } });
  context.snapshot.appVersion = "2.0.4";
  const page = context.renderVisibility();
  assert.equal(page.querySelectorAll('[data-action="admin-game-version"]').length, context.snapshot.packs.length);
  assert.equal(page.querySelector('[data-action="admin-game-version"][data-id="public-game"]').textContent, "≥ 2.0.5");
  context.registerActionHandler = () => {};
  vm.runInContext(fs.readFileSync(path.join(renderer, "actions/handlers/admin-irl.js"), "utf8"), context);
  await context.handleAdminAndIrlAction({ action: "admin-game-version", id: "public-game" });
  const editor = JSDOM.fragment(context.editor.body);
  assert.equal(editor.querySelector('[name="minAppVersion"]').value, "2.0.5");
  assert.match(editor.textContent, /Version actuelle : 2\.0\.4/);
  assert.equal(context.saved.length, 0);
});

test("la version minimale conserve les logos et survit aux portées, sauvegardes de logos et synchronisations", async t => {
  const context = fixture(t);
  context.snapshot.appVersion = "2.0.4";
  await context.saveAdminGamePlatforms("public-game", ["steam", "game-pass"]);
  context.openAdminGameVersionEditor("public-game");
  await context.editor.onSubmit({ get: () => "  v2.0.5  " });
  assert.equal(context.siteVisibility.games["public-game"].minAppVersion, "2.0.5");
  assert.equal(context.siteVisibility.games["public-game"].scope, "public");
  assert.deepEqual(Array.from(context.siteVisibility.games["public-game"].platforms), ["steam", "game-pass"]);
  assert.equal(context.canAccessGame(context.snapshot.packs.find(pack => pack.id === "public-game")), false);
  await context.saveAdminVisibilityScope("games", "public-game", "admin");
  await context.saveAdminGamePlatforms("public-game", []);
  await context.saveAdminVisibilityBulk("public");
  await context.syncAdminVisibilityCatalog();
  assert.equal(context.siteVisibility.games["public-game"].minAppVersion, "2.0.5");
  assert.equal(context.siteVisibility.games["public-game"].platformsConfigured, true);
  context.snapshot.appVersion = "2.0.5";
  assert.equal(context.canAccessGame(context.snapshot.packs.find(pack => pack.id === "public-game")), true);
  await context.saveAdminGameVersion("public-game", "");
  assert.equal(Object.hasOwn(context.siteVisibility.games["public-game"], "minAppVersion"), false);
  assert.deepEqual(Array.from(context.siteVisibility.games["public-game"].platforms), []);
  assert.equal(context.renderVisibility().querySelector('[data-action="admin-game-version"][data-id="public-game"]').textContent, "Toutes les versions");
});

test("la saisie de version refuse une borne invalide, un autre propriétaire ou un jeu absent sans publication", async t => {
  const context = fixture(t);
  for (const value of ["2.0", "2.0.5<script>", "-1.2.3", "2.0.5.0"]) {
    await assert.rejects(context.saveAdminGameVersion("public-game", value), /Version invalide/);
  }
  await assert.rejects(context.saveAdminGameVersion("absent", "2.0.5"), /introuvable/);
  context.openAdminGameVersionEditor("public-game");
  context.accountSession = { authenticated: true, uid: "other", email: "other@example.test" };
  await assert.rejects(context.editor.onSubmit({ get: () => "2.0.5" }), /session propriétaire/);
  await assert.rejects(context.saveAdminGameVersion("public-game", "2.0.5"), /propriétaire/);
  assert.equal(context.saved.length, 0);
});

test("chaque jeu ouvre un choix de neuf logos multiples sans les plateformes retirées", async t => {
  const context = fixture(t);
  const page = context.renderVisibility();
  assert.equal(page.querySelectorAll('[data-action="admin-game-platforms"]').length, context.snapshot.packs.length);
  context.registerActionHandler = () => {};
  vm.runInContext(fs.readFileSync(path.join(renderer, "actions/handlers/admin-irl.js"), "utf8"), context);
  await context.handleAdminAndIrlAction({ action: "admin-game-platforms", id: "fortnite" });
  const editor = JSDOM.fragment(context.editor.body);
  assert.equal(editor.querySelectorAll('input[type="checkbox"][name="platforms"]').length, 9);
  for (const platform of ["browser", "itch-io", "standalone"]) assert.equal(editor.querySelector('input[value="' + platform + '"]'), null);
  assert.deepEqual([...editor.querySelectorAll("input:checked")].map(input => input.value), ["epic-games"]);
  assert.equal(context.saved.length, 0);
  await context.editor.onSubmit({ getAll: name => { assert.equal(name, "platforms"); return ["steam", "game-pass", "epic-games"]; } });
  assert.deepEqual(Array.from(context.siteVisibility.games.fortnite.platforms), ["steam", "game-pass", "epic-games"]);
  assert.equal(context.siteVisibility.games.fortnite.scope, "admin");
  assert.equal(context.renderVisibility().querySelector('[data-action="admin-game-platforms"][data-id="fortnite"]').closest("article").querySelectorAll(".tile-platform-logo").length, 3);
});

test("les logos, y compris aucun, survivent aux changements individuels, en masse et à la synchronisation", async t => {
  const context = fixture(t);
  await context.saveAdminGamePlatforms("fortnite", ["steam", "game-pass"]);
  await context.saveAdminGamePlatforms("public-game", []);
  await context.saveAdminVisibilityScope("games", "fortnite", "hidden");
  await context.saveAdminVisibilityBulk("public");
  await context.syncAdminVisibilityCatalog();
  assert.deepEqual(Array.from(context.siteVisibility.games.fortnite.platforms), ["steam", "game-pass"]);
  assert.equal(context.siteVisibility.games.fortnite.scope, "public");
  assert.deepEqual(Array.from(context.siteVisibility.games["public-game"].platforms), []);
  assert.equal(context.siteVisibility.games["public-game"].platformsConfigured, true);
  context.openAdminGamePlatformsEditor("public-game");
  assert.equal(JSDOM.fragment(context.editor.body).querySelectorAll("input:checked").length, 0);
});

test("le sélecteur refuse un autre compte et un jeu absent avant toute publication", async t => {
  const context = fixture(t);
  assert.throws(() => context.openAdminGamePlatformsEditor("absent"), /introuvable/);
  context.openAdminGamePlatformsEditor("fortnite");
  context.accountSession = { authenticated: true, uid: "other", email: "other@example.test" };
  await assert.rejects(context.editor.onSubmit({ getAll: () => ["steam"] }), /session propriétaire/);
  await assert.rejects(context.saveAdminGamePlatforms("fortnite", ["steam"]), /propriétaire/);
  assert.equal(context.saved.length, 0);
});

test("les jeux privés ont un sélecteur actif, restent privés par défaut et ne sont pas publiés à l'ouverture", (t) => {
  const context = fixture(t);
  const before = JSON.stringify(context.adminDashboard.siteSettings);
  const page = context.renderVisibility();
  for (const game of privateGames) {
    const item = context.adminVisibilityCatalog().games.find((entry) => entry.id === game.id);
    assert.equal(item.defaultScope, "admin");
    assert.equal(item.ownerOnly, undefined, "le défaut privé n'est pas un verrou définitif");
    const select = page.querySelector(`select[data-id="${game.id}"]`);
    assert.equal(select.disabled, false);
    assert.equal(select.value, "admin");
  }
  assert.equal(page.querySelector('select[data-id="public-game"]').value, "public");
  assert.equal(JSON.stringify(context.adminDashboard.siteSettings), before);
  assert.equal(context.saved.length, 0);
});

test("la publication explicite d'un jeu privé est sauvegardée et suivie par les droits du catalogue", async (t) => {
  const context = fixture(t);
  await context.saveAdminVisibilityScope("games", "fortnite", "public");
  assert.equal(context.saved.length, 1);
  assert.equal(context.siteVisibility.games.fortnite.scope, "public");
  assert.equal(context.siteVisibility.games["find-the-needle-demo"].scope, "admin");
  assert.equal(context.renderVisibility().querySelector('select[data-id="fortnite"]').value, "public");
  context.accountSession = { authenticated: true, uid: "member", email: "member@example.invalid" };
  assert.equal(context.canAccessGame(privateGames[0]), true);
  assert.equal(context.canAccessGame(privateGames[1]), false);
});

test("les trois choix sont respectés individuellement, y compris Masqué pour le propriétaire", async (t) => {
  const context = fixture(t);
  for (const scope of ["public", "hidden", "admin"]) {
    await context.saveAdminVisibilityScope("games", "find-the-needle-demo", scope);
    assert.equal(context.siteVisibility.games["find-the-needle-demo"].scope, scope);
    assert.equal(context.renderVisibility().querySelector('select[data-id="find-the-needle-demo"]').value, scope);
    assert.equal(context.canAccessGame(privateGames[1]), scope !== "hidden");
  }
});

test("l'application en masse des jeux n'ignore plus les anciens défauts privés", async (t) => {
  const context = fixture(t);
  for (const scope of ["public", "admin", "hidden"]) {
    await context.saveAdminVisibilityBulk(scope);
    for (const game of context.snapshot.packs) {
      assert.equal(context.siteVisibility.games[game.id].scope, scope);
    }
  }
});

test("le déverrouillage des jeux ne déverrouille ni les pages sensibles ni le stockage partagé fixe", async (t) => {
  const context = fixture(t, { navigation: { settings: "public", controllers: "public" } });
  context.adminVisibilitySection = "navigation";
  let page = context.renderVisibility();
  for (const id of ["settings", "controllers"]) {
    assert.equal(page.querySelector(`select[data-id="${id}"]`).disabled, true);
    assert.equal(page.querySelector(`select[data-id="${id}"]`).value, "admin");
    await context.saveAdminVisibilityScope("navigation", id, "public");
    assert.equal(context.siteVisibility.navigation[id].scope, "admin");
  }
  await context.saveAdminVisibilityBulk("public");
  assert.equal(context.siteVisibility.navigation.settings.scope, "admin");
  assert.equal(context.siteVisibility.navigation.controllers.scope, "admin");
  context.adminVisibilitySection = "features";
  page = context.renderVisibility();
  for (const id of visibilityTools.SHARED_MEDIA_FEATURES) {
    assert.equal(page.querySelector(`select[data-id="${id}"]`).disabled, true);
    assert.equal(page.querySelector(`select[data-id="${id}"]`).value, "public");
  }
  await context.saveAdminVisibilityBulk("hidden");
  for (const id of visibilityTools.SHARED_MEDIA_FEATURES) {
    assert.equal(context.siteVisibility.features[visibilityTools.storageKey(id)].scope, "public");
  }
});

test("un choix déjà enregistré prime sur le défaut privé sans être remis à admin par la console", (t) => {
  for (const scope of ["public", "admin", "hidden"]) {
    const context = fixture(t, { schemaVersion: visibilityTools.VISIBILITY_SCHEMA_VERSION, games: { fortnite: { scope } } });
    assert.equal(context.canonicalAdminSiteSettings(context.siteVisibility).games.fortnite.scope, scope);
    const select = context.renderVisibility().querySelector('select[data-id="fortnite"]');
    assert.equal(select.disabled, false);
    assert.equal(select.value, scope);
    assert.equal(context.saved.length, 0);
  }
});

test("un ancien Public ignoré par le verrou historique n'ouvre pas automatiquement le jeu", (t) => {
  const context = fixture(t, { schemaVersion: 10, games: {
    fortnite: { scope: "public" }, "find-the-needle-demo": { scope: "hidden" }
  } });
  const page = context.renderVisibility();
  assert.equal(page.querySelector('select[data-id="fortnite"]').value, "admin");
  assert.equal(page.querySelector('select[data-id="find-the-needle-demo"]').value, "hidden");
  assert.equal(context.saved.length, 0);
});

test("la fiche d'installation suit aussi le choix de visibilité plutôt que le défaut historique", (t) => {
  const context = fixture(t);
  context.snapshot.state = { game: {} };
  context.AUTOMATED_GAME_INSTALLERS = new Set();
  context.gameInstallBusyId = "";
  context.renderGamePageMessage = () => "";
  vm.runInContext(fs.readFileSync(path.join(renderer, "features/games/overlay-cards.js"), "utf8"), context);
  assert.match(context.renderInputGameInstallation(privateGames[0], true), /Réservé au propriétaire/);
  context.siteVisibility = { schemaVersion: visibilityTools.VISIBILITY_SCHEMA_VERSION, games: { fortnite: { scope: "public" } } };
  const html = context.renderInputGameInstallation(privateGames[0], true);
  assert.match(html, /Fenêtre ciblée uniquement/);
  assert.doesNotMatch(html, /Réservé au propriétaire/);
});
