"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const renderer = path.join(__dirname, "..", "src", "renderer");
const read = (name) => fs.readFileSync(path.join(renderer, "app", name), "utf8");

test("la promotion vectorielle reprend les textes demandés, sans marque étrangère ni requête réseau", () => {
  const context = vm.createContext({ canNavigateTo: () => true, creatorHasActiveSubscription: () => false });
  vm.runInContext(read("features/creator-sidebar.js"), context);
  const dom = new JSDOM(context.renderCreatorSidebarPromotion());
  try {
    const document = dom.window.document;
    assert.equal(document.querySelector("h3").textContent, "Passez Pro");
    assert.equal(document.querySelector(".sidebar-pro-card p").textContent, "Plus de modulesPlus de possibilitésUne communauté plus grande");
    assert.equal(document.querySelector("button").textContent, "Découvrir les offres");
    assert.equal(document.querySelector("button").dataset.action, "membership-offers");
    assert.match(document.querySelector("blockquote").textContent, /Vos viewers ne regardent plus un live…Ils en font partie/);
    assert.equal(document.querySelector("img").getAttribute("src"), "assets/brand/shenpulse-signature.svg");
    assert.equal(document.querySelector("img").alt, "ShenPulse");
    assert.ok(fs.existsSync(path.join(renderer, document.querySelector("img").getAttribute("src"))));
    assert.doesNotMatch(document.body.innerHTML, /synclive|https?:\/\//i);
    assert.ok(document.querySelector("svg[aria-hidden='true']"));
  } finally { dom.window.close(); }
});

test("la carte Pro respecte les abonnements actifs et la visibilité, mais reste proposée en essai", () => {
  const context = vm.createContext({
    accountSession: { authenticated: true }, currentSubscription: () => ({ source: "trial", status: "trial" }),
    isAccountAuthenticated: () => context.accountSession.authenticated,
    hasProAccess: () => true, canNavigateTo: () => true
  });
  // Le helper partagé ne demande ni DOM ni initialisation du chrome.
  const helper = read("features/creator-topbar.js");
  vm.runInContext(helper.slice(helper.indexOf("function creatorHasActiveSubscription()"), helper.indexOf("function syncCreatorTopbar()")), context);
  vm.runInContext(read("features/creator-sidebar.js"), context);
  assert.match(context.renderCreatorSidebarPromotion(), /sidebar-pro-card/);
  context.currentSubscription = () => ({ source: "own", status: "active" });
  assert.doesNotMatch(context.renderCreatorSidebarPromotion(), /sidebar-pro-card/);
  context.currentSubscription = () => ({ source: "premiumSeat", status: "active" });
  assert.doesNotMatch(context.renderCreatorSidebarPromotion(), /sidebar-pro-card/);
  context.accountSession.authenticated = false;
  assert.match(context.renderCreatorSidebarPromotion(), /sidebar-pro-card/);
  context.canNavigateTo = () => false;
  assert.doesNotMatch(context.renderCreatorSidebarPromotion(), /sidebar-pro-card/);
});

test("le CTA de promotion ouvre uniquement les offres, même pour un invité", async () => {
  const calls = [];
  const context = vm.createContext({ STUDIO_PREFERENCE_ACTIONS: new Set(), canNavigateTo: () => true, openMembershipPopup: () => calls.push("offres") });
  vm.runInContext(read("actions/dispatcher.js"), context);
  await context.handleAction({ dataset: { action: "membership-offers" } });
  assert.deepEqual(calls, ["offres"]);
  context.canNavigateTo = () => false;
  await context.handleAction({ dataset: { action: "membership-offers" } });
  assert.deepEqual(calls, ["offres"]);
});

test("l’ancienne route Studio se replie vers Jeux sans changer les droits ni lancer un jeu", () => {
  const context = vm.createContext({
    pages: [{ id: "home" }, { id: "games" }], currentPage: "studio",
    accountSession: { authenticated: true, email: "viewer@example.test" }, ADMIN_OWNER_EMAIL: "owner@example.test",
    ShenPulseProAccess: require("../src/shared/pro-access"), hasProAccess: () => true,
    siteVisibility: {}, visibilityTools: { scopeFor: () => "public", canAccessScope: () => true }
  });
  vm.runInContext(read("core/access-navigation.js"), context);
  assert.equal(context.canNavigateTo("studio"), true);
  context.ensureCurrentPageAccess();
  assert.equal(context.currentPage, "games");
  const bootstrap = read("core/bootstrap.js");
  assert.doesNotMatch(bootstrap, /id:\s*"studio"/);
  const html = fs.readFileSync(path.join(renderer, "index.html"), "utf8");
  assert.doesNotMatch(html, /features\/creator-studio\.js/);
  assert.match(html, /features\/games\/community\.js/);
});

test("Overlays n’appelle plus le compositeur et Actions ne contient plus de second simulateur", () => {
  assert.doesNotMatch(read("features/overlays/editor.js"), /renderSceneComposer\(/);
  assert.doesNotMatch(read("features/actions.js"), /id="simulator-form"|\["simulator", "Simulateur"/);
  assert.match(read("features/actions.js"), /Les automatisations avancées combinent plusieurs conditions et actions/);
  assert.match(read("features/dashboard.js"), /id="simulator-form"/);
  assert.match(read("features/dashboard.js"), /"gift", "like", "follow", "chat", "share", "subscribe", "join"/);
});
