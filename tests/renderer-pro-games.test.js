"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const sourceRoot = path.join(__dirname, "..", "src");
const included = { id: "video", name: "Jeu compatible", accessMode: "included", requiresPro: false };
const purchase = { id: "paid", name: "Module acheté", accessMode: "purchase", requiresPro: false, price: 12.5 };

/** Vérifie uniquement le rendu et les droits ; aucun paiement, jeu ou effet réel. */
function gameContext(t, subscription = { tier: "free", source: "free", status: "free" }, gameEntitlements = []) {
  const dom = new JSDOM("<main></main>", { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const window = dom.window;
  window.snapshot = { state: { commerce: { subscription, gameEntitlements } }, packs: [included, purchase] };
  window.escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  window.renderStudioHero = (_id, title, description) => `<header><h2>${title}</h2><p>${description}</p></header>`;
  window.visibleGamePacks = () => window.snapshot.packs;
  window.emptyInline = (text) => `<p>${text}</p>`;
  window.openEditor = (options) => { window.editor = options; };
  const run = (code) => vm.runInContext(code, dom.getInternalVMContext());
  run(fs.readFileSync(path.join(sourceRoot, "shared", "pro-access.js"), "utf8"));
  run(fs.readFileSync(path.join(sourceRoot, "shared", "game-categories.js"), "utf8"));
  run(fs.readFileSync(path.join(sourceRoot, "shared", "game-pass-catalog.js"), "utf8"));
  run("let gameFilter = 'all'; let gameCategory = 'all'; let gameSearch = ''; let gamePageMode = 'catalog';");
  run(fs.readFileSync(path.join(sourceRoot, "renderer", "app", "features", "games", "access.js"), "utf8"));
  run(fs.readFileSync(path.join(sourceRoot, "renderer", "app", "features", "games", "categories.js"), "utf8"));
  return { window, run, render() { window.document.querySelector("main").innerHTML = window.renderGamesV2(); return window.document.querySelector("main"); } };
}

test("Free voit le verrou Pro même pour un ancien pack gratuit ou déjà acheté", (t) => {
  const { window, render } = gameContext(t, undefined, ["paid"]);
  for (const pack of [included, purchase]) {
    assert.equal(window.isGameUnlocked(pack), false);
    assert.equal(window.gameAccessLabel(pack), "ACCÈS PRO REQUIS");
    assert.equal(window.gameTileActionLabel(pack), "Voir l’abonnement");
    assert.match(window.gameAccessReason(pack), /Pro ou Premium/);
  }
  const page = render();
  assert.match(page.querySelector(".game-access-warning").textContent, /accès Pro requis/);
  assert.equal(page.querySelector(".game-access-warning button").dataset.navigate, "membership");
  assert.equal(page.querySelectorAll(".game-gallery-tile.locked").length, 2);
  assert.doesNotMatch(page.textContent, /gratuit|sans abonnement/iu);
});

test("Pro, Premium, essai actif et accès offert ouvrent seulement les jeux inclus ou acquis", (t) => {
  const { window } = gameContext(t);
  const commerce = window.snapshot.state.commerce;
  for (const subscription of [
    { tier: "pro", source: "own", status: "active" },
    { tier: "premium", source: "own", status: "paid" },
    { tier: "pro", source: "trial", status: "trial", expiresAtMs: Date.now() + 60_000 },
    { tier: "pro", source: "premiumSeat", status: "active" }
  ]) {
    commerce.subscription = subscription;
    commerce.gameEntitlements = [];
    assert.equal(window.isGameUnlocked(included), true);
    assert.equal(window.gamePrice(included), "Inclus avec Pro");
    assert.equal(window.isGameUnlocked(purchase), false);
    assert.equal(window.gameAccessLabel(purchase), "ACHAT REQUIS");
    assert.equal(window.gameTileActionLabel(purchase), "Acheter le jeu");
    commerce.gameEntitlements = ["paid"];
    assert.equal(window.isGameUnlocked(purchase), true);
  }
  commerce.subscription = { tier: "pro", source: "trial", status: "active", expiresAtMs: Date.now() - 1 };
  assert.equal(window.isGameUnlocked(included), false);
  assert.equal(window.isGameUnlocked(purchase), false);
});

test("le dialogue d’achat informe de l’accès Pro requis sans changer le prix ou déclencher PayPal", (t) => {
  const { window } = gameContext(t);
  window.openGamePurchaseDialog(purchase);
  const editor = window.editor;
  assert.equal(editor.title, "Acheter Module acheté");
  assert.match(editor.submitLabel, /12,50\s€$/);
  assert.match(editor.body, /Accès Pro requis pour jouer/);
  assert.match(editor.body, /Pro ou Premium actif sera aussi nécessaire/);
  assert.match(editor.body, /Paiement unique, sans renouvellement pour le jeu/);
  assert.doesNotMatch(editor.body, /sans abonnement Pro|<strong>Sans abonnement<\/strong>/i);
  assert.equal(typeof editor.onSubmit, "function");
});

test("le prix est visible sans clic sur les cartes à acheter, avec le même montant que le dialogue", (t) => {
  const { window, render } = gameContext(t, { tier: "pro", status: "active" });
  const page = render();
  const card = page.querySelector('[data-id="paid"]');
  assert.equal(card.querySelector(".tile-purchase-price strong").textContent, window.gamePrice(purchase));
  assert.equal(card.querySelector(".tile-purchase-price small").textContent, "Achat unique");
  assert.match(card.querySelector(".tile-status").textContent, /ACHAT REQUIS/);
  assert.equal(card.querySelector(".tile-action-button").textContent, "Acheter le jeu");
  assert.equal(page.querySelector('[data-id="video"] .tile-purchase-price'), null);
  assert.equal(window.editor, undefined, "Afficher le prix n'ouvre aucun dialogue ni paiement");
  window.openGamePurchaseDialog(purchase);
  assert.equal(window.editor.submitLabel, `Acheter pour ${card.querySelector(".tile-purchase-price strong").textContent}`);
});

test("le tarif reste visible sans Pro, sans contourner l'abonnement ni le libellé d'accès", (t) => {
  const { window, render } = gameContext(t);
  const card = render().querySelector('[data-id="paid"]');
  assert.equal(card.querySelector(".tile-purchase-price strong").textContent, window.gamePrice(purchase));
  assert.match(card.querySelector(".tile-status").textContent, /ACCÈS PRO REQUIS/);
  assert.equal(card.querySelector(".tile-action-button").textContent, "Voir l’abonnement");
  assert.equal(window.isGameUnlocked(purchase), false);
});

test("les quatre nouveaux prix du vrai catalogue sont cohérents entre cartes et dialogues d'achat", (t) => {
  const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
  const { window, render } = gameContext(t, { tier: "pro", status: "active" });
  const prices = { "tiklive-climb": 9.99, "clash-of-live": 12.99, "tiklive-cube-wars": 9.99, "tiklive-stack-tower": 9.99 };
  window.snapshot.packs = loadShenazenGameCatalog(path.resolve(sourceRoot, "../resources")).filter((pack) => Object.hasOwn(prices, pack.id));
  const page = render();
  assert.equal(page.querySelectorAll(".tile-purchase-price").length, 4);
  for (const pack of window.snapshot.packs) {
    assert.equal(pack.price, prices[pack.id]);
    assert.equal(pack.currency, "EUR");
    const displayed = page.querySelector(`[data-id="${pack.id}"] .tile-purchase-price strong`).textContent;
    assert.equal(displayed, new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(prices[pack.id]));
    window.openGamePurchaseDialog(pack);
    assert.equal(window.editor.submitLabel, `Acheter pour ${displayed}`);
    assert.equal(window.isGameUnlocked(pack), false, "le prix ne crée aucun droit d'achat");
  }
});

test("un achat ou essai actif n'affiche pas un nouveau prix à payer, même sans Pro", (t) => {
  const { window, render } = gameContext(t);
  for (const entitlement of ["paid", { productId: "paid", status: "trial", source: "trial", expiresAtMs: Date.now() + 60000 }]) {
    window.snapshot.state.commerce.gameEntitlements = [entitlement];
    assert.equal(render().querySelector('[data-id="paid"] .tile-purchase-price'), null);
    window.snapshot.state.commerce.subscription = { tier: "premium", status: "active" };
    const acquired = render().querySelector('[data-id="paid"]');
    assert.equal(acquired.querySelector(".tile-purchase-price"), null);
    assert.equal(acquired.querySelector(".tile-action-button").textContent, "Entrer dans le jeu");
    window.snapshot.state.commerce.subscription = { tier: "free", status: "free" };
  }
});

test("les prix des cartes suivent le catalogue et sa devise, sans prix mis en cache ni HTML injecté", (t) => {
  const { window, render } = gameContext(t, { tier: "pro", status: "active" });
  const pack = { ...purchase, name: '<img src="x" onerror="alert(1)">', price: 7.99, currency: "USD" };
  window.snapshot.packs = [pack];
  let card = render().querySelector('[data-id="paid"]');
  assert.equal(card.querySelector(".tile-purchase-price strong").textContent, new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD" }).format(7.99));
  assert.equal(card.querySelector("h3 img"), null);
  pack.price = 9.5; pack.currency = "EUR";
  card = render().querySelector('[data-id="paid"]');
  assert.equal(card.querySelector(".tile-purchase-price strong").textContent, window.gamePrice(pack));
  assert.match(card.querySelector(".tile-purchase-price strong").textContent, /9,50/);
});

test("FR/EN traduit la mention d'achat unique sans changer le prix ni sa devise", (t) => {
  const { window, run, render } = gameContext(t, { tier: "pro", status: "active" });
  let locale = "fr-FR";
  window.studioLocale = () => locale;
  window.syncStudioPreferences = () => {};
  run(fs.readFileSync(path.join(sourceRoot, "renderer", "app", "features", "studio-language.js"), "utf8"));
  const page = render(), price = page.querySelector(".tile-purchase-price strong").textContent;
  locale = "en-US"; window.applyStudioLanguage(page);
  assert.equal(page.querySelector(".tile-purchase-price small").textContent, "One-time purchase");
  assert.equal(page.querySelector(".tile-purchase-price strong").textContent, price);
  locale = "fr-FR"; window.applyStudioLanguage(page);
  assert.equal(page.querySelector(".tile-purchase-price small").textContent, "Achat unique");
  assert.equal(page.querySelector(".tile-purchase-price strong").textContent, price);
});

test("la capacité Free garde ses trois actions et son profil sans promettre les jeux gratuits", (t) => {
  const { window, run } = gameContext(t);
  window.snapshot.state.rules = [{ actions: [{ type: "overlay.media" }, { type: "action.group" }, { type: "tts.speak" }] }];
  run(fs.readFileSync(path.join(sourceRoot, "renderer", "app", "features", "studio-design.js"), "utf8"));
  let markup = window.renderCreatorCapacity();
  assert.match(markup, /2 \/ 3 actions · 1 profil/);
  assert.match(markup, /Découvrir Pro/);
  assert.doesNotMatch(markup, /jeux.*gratuit/iu);
  window.snapshot.state.commerce.subscription = { tier: "pro", source: "own", status: "active" };
  markup = window.renderCreatorCapacity();
  assert.match(markup, /2 actions · profils illimités/);
  assert.doesNotMatch(markup, /Découvrir Pro/);
});
