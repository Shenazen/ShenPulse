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
  run("let gameFilter = 'all'; let gameSearch = ''; let gamePageMode = 'catalog';");
  run(fs.readFileSync(path.join(sourceRoot, "renderer", "app", "features", "games", "access.js"), "utf8"));
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
