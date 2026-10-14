"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const rendererDirectory = path.join(__dirname, "..", "src", "renderer");

function createChrome() {
  const dom = new JSDOM(fs.readFileSync(path.join(rendererDirectory, "index.html"), "utf8"), {
    runScripts: "outside-only", pretendToBeVisual: true
  });
  const { window } = dom;
  const { document } = window;
  const style = document.createElement("style");
  style.textContent = fs.readFileSync(path.join(rendererDirectory, "styles", "creator-topbar.css"), "utf8");
  document.head.append(style);
  const tiktok = { username: "creator_test", status: "disconnected", connected: false, live: false };
  const state = { session: { running: false } };
  const calls = [];
  const elementNames = {
    gameSessionControl: "game-session-control", sessionButton: "session-button", accountAuthCta: "account-auth-cta",
    profileControl: "profile-control", accountMenuButton: "account-menu-button", accountEmail: "account-email",
    accountName: "account-name", accountMenu: "account-menu", tiktokUsernameInput: "tiktok-username",
    tiktokConnectionButton: "tiktok-connection-button", tiktokConnectionLabel: "tiktok-connection-label",
    tiktokStatusLabel: "tiktok-status-label", tiktokStatusDot: "tiktok-status-dot"
  };
  for (const [name, id] of Object.entries(elementNames)) window[name] = document.getElementById(id);
  Object.assign(window, {
    currentPage: "home", snapshot: { state }, accountSession: { authenticated: true, uid: "layout-account" },
    tiktokControl: document.querySelector(".tiktok-control"), SUBSCRIPTION_PLANS: [{ tier: "pro", name: "Pro", price: 15 }],
    isAccountAuthenticated: () => window.accountSession.authenticated,
    tiktokMeta: () => tiktok,
    currentSubscription: () => ({ tier: "pro", status: "active", source: "own" }),
    hasProAccess: () => true,
    studioLocale: () => "fr-FR",
    canNavigateTo: () => true,
    applyStudioLanguage() {},
    openMembershipPopup: () => calls.push("membership"),
    api: { startSession: () => calls.push("startSession"), stopSession: () => calls.push("stopSession") }
  });
  const originalNodes = { tiktok: window.tiktokControl, profile: window.profileControl, account: window.accountMenuButton, session: window.sessionButton };
  vm.runInContext(fs.readFileSync(path.join(rendererDirectory, "app", "features", "creator-topbar.js"), "utf8"), dom.getInternalVMContext());
  window.syncCreatorTopbar();
  return { dom, window, document, state, tiktok, calls, originalNodes };
}

test("la sidebar monte jusqu’en haut et le badge LIVE reste immédiatement après TikTok dans la barre de la colonne 2", () => {
  const fixture = createChrome();
  const { dom, document, window, originalNodes } = fixture;
  try {
    const bar = document.querySelector(".creator-topbar");
    const sidebar = document.querySelector(".sidebar");
    const center = document.querySelector(".creator-topbar-center");
    const live = document.getElementById("topbar-live-status");
    assert.equal(bar.parentElement, document.querySelector(".app-shell"));
    assert.equal(window.getComputedStyle(bar).gridColumn, "2");
    assert.equal(window.getComputedStyle(bar).gridRow, "1");
    assert.equal(window.getComputedStyle(sidebar).gridColumn, "1");
    assert.equal(window.getComputedStyle(sidebar).gridRow, "1 / -1");
    assert.equal(document.querySelector(".brand-tagline").textContent, "STREAM - INTERACTIONS - ENSEMBLE");
    assert.equal(document.querySelector(".brand-tagline").previousElementSibling, document.querySelector(".brand-logo"));
    assert.equal(window.getComputedStyle(document.querySelector(".brand")).alignItems, "center");
    assert.equal(window.getComputedStyle(document.querySelector(".brand-tagline")).textAlign, "center");
    assert.equal(window.getComputedStyle(document.querySelector(".brand-tagline")).width, "100%");
    assert.equal(window.getComputedStyle(document.querySelector(".brand-logo")).objectPosition, "center");
    assert.ok(document.querySelector(".creator-topbar-left").contains(document.getElementById("membership-popup-button")));
    assert.equal(document.querySelector(".creator-topbar-left").contains(live), false);
    assert.equal(originalNodes.tiktok.parentElement, center);
    assert.equal(originalNodes.tiktok.nextElementSibling, live);
    assert.equal(live.closest("button"), null, "LIVE n’est pas incorporé au bouton Connecter");
    for (const node of Object.values(originalNodes)) {
      assert.ok(node.isConnected, "Les menus et leurs événements ne sont pas reconstruits");
      if (node.id) assert.equal(document.getElementById(node.id), node);
    }
    assert.equal(document.querySelector(".tiktok-control"), originalNodes.tiktok);
    assert.ok(bar.contains(originalNodes.account));
    assert.ok(bar.contains(originalNodes.profile));
    assert.equal(document.querySelectorAll("#session-button").length, 1);
    document.getElementById("account-membership-button").click();
    assert.deepEqual(fixture.calls, ["membership"]);
  } finally { dom.window.close(); }
});

test("aucune page ne réserve un en-tête, et les commandes du jeu restent dans la barre supérieure", () => {
  const fixture = createChrome();
  const { dom, document, window, originalNodes, state, tiktok } = fixture;
  try {
    const workspace = document.querySelector(".workspace");
    assert.equal(document.querySelector(".workspace-heading"), null);
    assert.equal(document.querySelector(".page-heading"), null);
    assert.equal(document.getElementById("page-title"), null);
    assert.equal(document.getElementById("page-kicker"), null);
    assert.equal(window.getComputedStyle(workspace).gridTemplateRows, "auto minmax(0,1fr)", "Aucune rangée de titre ne doit rester réservée");
    assert.equal(window.getComputedStyle(document.getElementById("content")).gridRow, "2");
    assert.equal(window.getComputedStyle(document.getElementById("store-update-banner")).gridRow, "1");
    assert.equal(originalNodes.session.hidden, true);
    assert.equal(originalNodes.session.tabIndex, -1);
    assert.equal(window.getComputedStyle(originalNodes.session).display, "none");
    window.gameSessionControl.hidden = false;
    originalNodes.session.hidden = false; // The legacy account chrome can still update its own state.
    for (const page of ["home", "dashboard", "live", "studio", "users", "actions", "rules", "voice", "sounds", "music", "overlays", "games", "irl", "goals", "commands", "membership", "connections", "controllers", "activity", "settings", "admin"]) {
      window.currentPage = page;
      window.syncCreatorTopbar();
      assert.equal(document.querySelector(".workspace-heading, .page-heading"), null, page);
      assert.equal(window.gameSessionControl.parentElement, document.querySelector(".creator-topbar .titlebar-actions"), page);
      assert.equal(window.gameSessionControl.hidden, false, "Le jeu actif garde ses commandes sur " + page);
      assert.equal(originalNodes.session.hidden, true, "Le bouton historique reste caché sur " + page);
    }
    state.session.running = true;
    Object.assign(tiktok, { live: true, connected: true, status: "live" });
    window.syncCreatorTopbar();
    const live = document.getElementById("topbar-live-status");
    assert.equal(live.hidden, false);
    assert.equal(live.previousElementSibling, originalNodes.tiktok);
    assert.equal(document.getElementById("topbar-live-account").textContent, "@creator_test");
    assert.equal(document.getElementById("tiktok-connection-label").textContent, "Déconnecter");
    window.currentPage = "home";
    window.syncCreatorTopbar();
    assert.equal(document.querySelector(".workspace-heading"), null);
    assert.deepEqual(fixture.calls, [], "Changer la disposition ou la page ne démarre ni n’arrête de session");
  } finally { dom.window.close(); }
});

test("le module de contrôle live Accueil est chargé avant son rendu et le chrome garde une disposition compacte à petite largeur", () => {
  const fixture = createChrome();
  try {
    const { document } = fixture;
    const scripts = [...document.querySelectorAll("script[src]")].map((script) => script.getAttribute("src"));
    const index = scripts.indexOf("app/features/creator-home-live.js");
    assert.ok(index >= 0);
    assert.equal(scripts[index + 1], "app/features/creator-home.js");
    const stylesheet = [...document.styleSheets].find((sheet) => sheet.ownerNode?.tagName === "STYLE") || document.styleSheets[0];
    const rules = [...stylesheet.cssRules];
    const actionsRule = rules.find((rule) => rule.selectorText === ".creator-topbar .titlebar-actions");
    assert.equal(actionsRule.style.flex, "0 0 auto", "Les boutons de fenêtre ne doivent pas déborder d’un groupe d’actions rétréci");
    const shellRule = rules.find((rule) => rule.selectorText === ".app-shell");
    assert.match(shellRule.style.gridTemplateColumns, /minmax\(0,1fr\)/);
    assert.ok(rules.some((rule) => rule.conditionText === "(max-width:1500px)"), "La barre doit se resserrer avant les largeurs intermédiaires");
    assert.equal(shellRule.style.gridTemplateRows, "64px minmax(0,1fr)");
    assert.equal(rules.find((rule) => rule.selectorText === ".creator-tiktok-control").style.height, "44px");
    assert.equal(rules.find((rule) => rule.selectorText === ".creator-topbar .user-chip").style.height, "42px");
    const compactRules = rules.filter((rule) => rule.conditionText === "(max-width:1250px)");
    assert.ok(compactRules.length);
    assert.equal(compactRules.some((rule) => [...rule.cssRules].some((item) => item.selectorText === ".app-shell")), false,
      "Une largeur intermédiaire ne doit plus réserver deux rangées de barre");
    const narrowRules = rules.filter((rule) => rule.conditionText === "(max-width:1050px)");
    assert.ok(narrowRules.some((rule) => [...rule.cssRules].some((item) => item.selectorText === ".app-shell" && item.style.gridTemplateRows === "104px minmax(0,1fr)")));
    assert.ok(narrowRules.some((rule) => [...rule.cssRules].some((item) => item.selectorText === ".creator-topbar-center" && item.style.order === "3")));
  } finally { fixture.dom.window.close(); }
});

test("l’éclair est vectoriel et les préférences uniques se trouvent seulement dans le menu compte", () => {
  const fixture = createChrome();
  try {
    const { document, window } = fixture;
    const menu = document.getElementById("account-menu");
    for (const id of ["studio-light-mode", "studio-language"]) {
      assert.equal(document.querySelectorAll(`#${id}`).length, 1);
      const control = document.getElementById(id);
      assert.ok(menu.contains(control));
      assert.equal(control.getAttribute("role"), "menuitem");
      assert.equal(document.querySelector(".titlebar-actions > #" + id), null);
      assert.ok(control.dataset.action.startsWith("studio-toggle-"));
    }
    assert.equal(document.querySelector(".studio-topbar-tools"), null);
    assert.ok(document.querySelector("#membership-popup-button svg path"));
    assert.equal(document.querySelector(".creator-pro-icon").getAttribute("viewBox"), "0 0 24 24");
    assert.doesNotMatch(document.getElementById("membership-popup-button").textContent, /ϟ/);
    const upgrade = document.getElementById("membership-popup-button");
    assert.equal(upgrade.hidden, true, "Un compte déjà Pro n’affiche pas la promotion");
    assert.equal(upgrade.closest(".creator-topbar-left").hidden, true);
    assert.equal(window.getComputedStyle(upgrade.closest(".creator-topbar-left")).display, "none",
      "La promotion masquée ne réserve pas une colonne vide");
    window.hasProAccess = () => false;
    window.syncCreatorTopbar();
    assert.equal(upgrade.hidden, false);
    assert.match(document.getElementById("membership-popup-label").textContent, /^Pro - 15,00\s*€/,
      "Le tarif provient du catalogue Pro et non d’un prix codé en dur");
    window.canNavigateTo = () => false;
    window.syncCreatorTopbar();
    assert.equal(upgrade.hidden, true, "Une page abonnement désactivée n’est pas exposée");
  } finally { fixture.dom.window.close(); }
});
