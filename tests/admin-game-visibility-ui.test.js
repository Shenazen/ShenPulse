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
    api: { admin: {
      saveSiteSettings: async (value) => {
        const saved = JSON.parse(JSON.stringify(value));
        context.saved.push(saved);
        return saved;
      },
      visibility: async () => context.saved.at(-1)
    } }
  });
  for (const file of ["core/access-navigation.js", "features/admin/page.js", "features/admin/account.js"]) {
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
