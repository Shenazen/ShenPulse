"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const visibilityTools = require("../src/shared/visibility-catalog");
const OWNER = require("../src/main/account-access").ADMIN_OWNER_EMAIL;

const root = path.join(__dirname, "..", "src", "renderer");
const bootstrap = fs.readFileSync(path.join(root, "app/core/bootstrap.js"), "utf8");
const navigation = fs.readFileSync(path.join(root, "app/core/access-navigation.js"), "utf8");

function fixture(t, { owner = false, authenticated = true, wrongUid = false } = {}) {
  const dom = new JSDOM('<div id="menu"><button data-navigate="settings" hidden>Paramètres</button><button class="account-login-action"></button><button class="account-logout-action"></button></div>');
  t.after(() => dom.window.close());
  const context = vm.createContext({
    NAVIGATION_ICONS: {}, ADMIN_OWNER_EMAIL: OWNER, visibilityTools,
    escapeHtml: (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;"),
    accountSession: { authenticated, uid: authenticated ? "fixture-user" : "", email: owner ? OWNER : "member@example.test" },
    adminSession: { authorized: owner, uid: wrongUid ? "other-user" : "fixture-user", email: OWNER },
    siteVisibility: { schemaVersion: 10, navigation: { settings: "public", controllers: "public", admin: "public" } },
    ShenPulseProAccess: { requiresProSection: () => false },
    accountMenu: dom.window.document.getElementById("menu"),
    syncCreatorAccountChrome: () => {}, currentPage: "settings"
  });
  for (const key of ["accountName", "accountEmail", "accountMenuName", "accountMenuEmail", "accountAuthCta", "profileControl", "tiktokControl", "sessionButton"]) context[key] = {};
  vm.runInContext(bootstrap.slice(bootstrap.indexOf("const pages ="), bootstrap.indexOf("const eventIcons =")), context);
  vm.runInContext(navigation, context);
  vm.runInContext(fs.readFileSync(path.join(root, "app/features/auxiliary-pages.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "app/features/controllers.js"), "utf8"), context);
  context.declaredPages = vm.runInContext("pages", context);
  return context;
}

test("les trois pages sensibles sont déclarées propriétaire et admin par défaut", (t) => {
  const context = fixture(t);
  for (const id of ["admin", "controllers", "settings"]) {
    const page = context.declaredPages.find((item) => item.id === id);
    assert.equal(page.ownerOnly, true, id);
    assert.equal(page.defaultScope, "admin", id);
  }
});

test("ni invité ni abonné ne voit ou n’ouvre les pages propriétaire malgré un cache public", (t) => {
  for (const options of [{ authenticated: false }, {}, { owner: true, wrongUid: true }]) {
    const context = fixture(t, options);
    for (const id of ["admin", "controllers", "settings"]) {
      assert.equal(context.canNavigateTo(id), false, id);
      assert.equal(context.visibleNavigationEntries().some((page) => page.id === id), false, id);
      context.currentPage = id;
      context.ensureCurrentPageAccess();
      assert.equal(context.currentPage, "home");
    }
    context.syncAccountChrome();
    assert.equal(context.accountMenu.querySelector('[data-navigate="settings"]').hidden, true);
    for (const render of [context.renderSettings, context.renderControllers]) {
      const html = render();
      assert.match(html, /réservée au compte propriétaire/);
      assert.doesNotMatch(html, /settings-form|controller-pair|controller-install|apiToken|backblazeKeyId/);
    }
  }
});

test("le propriétaire vérifié conserve pages et raccourci, sans ouvrir les autres fonctions restreintes", (t) => {
  const context = fixture(t, { owner: true });
  for (const id of ["admin", "controllers", "settings"]) assert.equal(context.canNavigateTo(id), true, id);
  context.syncAccountChrome();
  assert.equal(context.accountMenu.querySelector('[data-navigate="settings"]').hidden, false);
  context.siteVisibility.navigation.settings = { scope: "hidden" };
  assert.equal(context.canNavigateTo("settings"), false);
  context.syncAccountChrome();
  assert.equal(context.accountMenu.querySelector('[data-navigate="settings"]').hidden, true);
});

test("le raccourci Paramètres est fermé avant la première lecture de session", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /<button[^>]*data-navigate="settings"[^>]*\bhidden\b/);
});
