"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { createDefaultState } = require("../src/main/defaults");

const appRoot = path.join(__dirname, "..", "src", "renderer", "app");
const source = (file) => fs.readFileSync(path.join(appRoot, file), "utf8");

/** Le vrai rendu utilise les tarifs et droits locaux ; aucune API commerciale n’est appelée. */
function membershipContext(t, { subscription, checkoutTier = "", stopBusy = false, beneficiary = "", packs = [] } = {}) {
  const dom = new JSDOM('<main id="content"></main>', { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const window = dom.window;
  const state = createDefaultState();
  if (subscription) state.commerce.subscription = subscription;
  state.commerce.premiumSeat = { beneficiaryEmail: beneficiary };
  window.snapshot = { state, packs };
  window.escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  window.visibleGamePacks = () => window.snapshot.packs;
  const bootstrap = source("core/bootstrap.js");
  const plans = bootstrap.slice(bootstrap.indexOf("const SUBSCRIPTION_PLANS ="), bootstrap.indexOf("const ACTION_TYPE_LABELS ="));
  const run = (code) => vm.runInContext(code, dom.getInternalVMContext());
  run(fs.readFileSync(path.join(appRoot, "..", "..", "shared", "pro-access.js"), "utf8"));
  run(`${plans}\nlet subscriptionCheckoutBusyTier = ${JSON.stringify(checkoutTier)}; let subscriptionStopBusy = ${JSON.stringify(stopBusy)};`);
  for (const file of ["features/games/access.js", "features/studio-design.js", "features/membership.js"]) run(source(file));
  const render = () => {
    window.document.getElementById("content").innerHTML = window.renderMembership();
    return window.document.querySelector(".membership-workspace");
  };
  return { window, state, run, render };
}

test("Abonnement retrouve sa bannière illustrée et présente les trois tarifs réels après le compte", (t) => {
  const { window, render } = membershipContext(t);
  const page = render();
  assert.equal(page.querySelector("[data-studio-hero]").dataset.studioHero, "membership");
  assert.match(page.querySelector(".studio-hero-art").getAttribute("src"), /^assets\/studio\/[a-z-]+\.webp$/);
  assert.equal(page.querySelectorAll(".subscription-card").length, 3);
  const plans = window.eval("SUBSCRIPTION_PLANS");
  for (const plan of plans) {
    const card = page.querySelector(`.tier-${plan.tier}`);
    assert.equal(card.querySelector("h3").textContent, plan.name);
    assert.equal(card.querySelector(".membership-plan-price strong").textContent, plan.price ? `${plan.price.toFixed(2).replace(".", ",")} €` : "Gratuit");
    assert.equal(card.querySelectorAll("li").length, plan.features.length);
    for (const feature of plan.features) assert.ok(card.textContent.includes(feature));
    assert.ok(card.querySelector(".membership-plan-icon svg"));
  }
  assert.equal(page.querySelector(".tier-free").getAttribute("aria-current"), "true");
  const children = [...page.children];
  assert.ok(children.indexOf(page.querySelector(".membership-account")) < children.indexOf(page.querySelector(".membership-offers")));
  assert.doesNotMatch(page.textContent, /SyncLive|annuel|agence/iu);
  assert.equal(page.querySelectorAll("[data-action='subscription-stop']").length, 0);
  assert.match(page.querySelector(".membership-account-copy p").textContent, /Jeux vidéo, Interactions IRL, Commandes et Matchs nécessitent un accès Pro ou Premium actif/);
  assert.doesNotMatch(page.querySelector(".tier-free").textContent, /jeux.*gratuit|interactions.*sans abonnement/iu);
  assert.match(page.querySelector(".tier-pro").textContent, /commandes/iu);
  assert.doesNotMatch(page.textContent, /interactions.*gratuit|achats uniques fonctionnent sans abonnement|achat unique.*suffit/iu);
});

test("un abonnement Pro payé se gère depuis la carte du compte, sans faux bouton de paiement actif", (t) => {
  const { render } = membershipContext(t, { subscription: { tier: "pro", source: "own", status: "paid", renewalDate: "2026-12-20T12:00:00Z" } });
  const page = render();
  const stop = page.querySelector("[data-action='subscription-stop']");
  assert.equal(stop.closest("section").className, "membership-account");
  assert.equal(page.querySelectorAll("[data-action='subscription-stop']").length, 1);
  assert.equal(page.querySelector(".tier-free [data-action]"), null);
  assert.match(page.querySelector(".membership-renewal").textContent, /20 décembre 2026/);
  assert.equal(page.querySelector(".tier-pro button").disabled, true);
  assert.match(page.querySelector(".tier-pro header").textContent, /ABONNEMENT ACTUEL/);
  assert.equal(page.querySelector(".tier-premium button").dataset.action, "subscription-checkout");
  assert.equal(page.querySelector(".tier-premium button").dataset.tier, "premium");
  assert.equal(page.querySelector("#premium-seat-form"), null);
});

test("un essai actif et un essai expiré gardent des états distincts sans inventer d’abonnement payé", (t) => {
  const { state, render } = membershipContext(t, { subscription: { tier: "pro", source: "trial", status: "trial", expiresAtMs: Date.now() + 60_000 } });
  let page = render();
  assert.match(page.querySelector(".membership-current").textContent, /pro · essai/);
  assert.match(page.querySelector(".tier-pro header").textContent, /ESSAI ACTIF/);
  assert.equal(page.querySelector(".tier-pro button").disabled, true);
  assert.equal(page.querySelectorAll("[data-action='subscription-stop']").length, 0);
  assert.equal(page.querySelector(".membership-renewal"), null);
  assert.equal(page.querySelector("#premium-seat-form"), null);
  state.commerce.subscription.expiresAtMs = Date.now() - 60_000;
  page = render();
  assert.equal(page.querySelector(".membership-current").textContent, "Free");
  assert.equal(page.querySelector(".tier-free").getAttribute("aria-current"), "true");
  assert.equal(page.querySelector(".tier-pro button").dataset.action, "subscription-checkout");
});

test("un accès Pro offert par Premium reste actif sans commande de résiliation personnelle", (t) => {
  const { render } = membershipContext(t, { subscription: { tier: "pro", source: "premiumSeat", status: "active" } });
  const page = render();
  assert.match(page.querySelector(".membership-current").textContent, /pro · offert/);
  assert.match(page.querySelector(".tier-pro header").textContent, /ACCÈS PRO OFFERT/);
  assert.equal(page.querySelector(".tier-pro").getAttribute("aria-current"), "true");
  assert.equal(page.querySelector(".tier-pro button").disabled, true);
  assert.equal(page.querySelectorAll("[data-action='subscription-stop']").length, 0);
  assert.equal(page.querySelector("#premium-seat-form"), null);
});

test("Premium payé conserve l’invitation bénéficiaire dans un espace séparé du comparatif", (t) => {
  const beneficiary = 'créateur+test@example.fr';
  const { render } = membershipContext(t, { subscription: { tier: "premium", source: "own", status: "active" }, beneficiary });
  const page = render();
  const form = page.querySelector("#premium-seat-form");
  assert.ok(form);
  assert.equal(form.closest(".membership-offers"), null);
  const email = form.querySelector("input");
  assert.equal(email.name, "beneficiaryEmail");
  assert.equal(email.type, "email");
  assert.equal(email.value, beneficiary);
  assert.equal(email.required, true);
  assert.equal(email.maxLength, 254);
  assert.equal(form.querySelector("button").type, "submit");
  assert.equal(page.querySelector(".tier-premium button").disabled, true);
  assert.match(page.querySelector(".premium-seat-current").textContent, /créateur\+test@example\.fr/);
});

test("un arrêt programmé affiche la date et maintient le plan actif jusqu’à l’échéance", (t) => {
  const { render } = membershipContext(t, { subscription: { tier: "pro", source: "own", status: "active", pendingChange: { targetTier: "free", effectiveAt: "2026-12-31T12:00:00Z" } } });
  const page = render();
  assert.match(page.querySelector(".membership-stop-notice").textContent, /31 décembre 2026/);
  assert.equal(page.querySelector(".membership-stop-notice").getAttribute("role"), "status");
  assert.equal(page.querySelector(".membership-account-tools button").disabled, true);
  assert.equal(page.querySelector(".membership-account-tools button").textContent, "Arrêt programmé");
  assert.equal(page.querySelector(".tier-pro").getAttribute("aria-current"), "true");
  assert.equal(page.querySelector(".membership-renewal"), null);
  assert.equal(page.querySelectorAll("[data-action='subscription-stop']").length, 0);
});

test("un paiement en attente peut être annulé et empêche une seconde opération commerciale", (t) => {
  const { render } = membershipContext(t, { subscription: { tier: "pro", source: "own", status: "active" }, checkoutTier: "premium" });
  const page = render();
  const cancel = page.querySelector(".tier-premium button");
  assert.equal(cancel.dataset.action, "subscription-checkout-cancel");
  assert.equal(cancel.dataset.tier, "premium");
  assert.equal(cancel.disabled, false);
  assert.equal(page.querySelector("[data-action='subscription-stop']").disabled, true);
  assert.equal(page.querySelector(".tier-pro button").disabled, true);
  assert.equal(page.querySelector(".membership-checkout-notice").getAttribute("role"), "status");
});

test("l’annulation d’un paiement reste accessible même si les droits viennent de devenir actifs", (t) => {
  const { render } = membershipContext(t, { subscription: { tier: "pro", source: "own", status: "active" }, checkoutTier: "pro" });
  const page = render();
  assert.equal(page.querySelector(".tier-pro button").dataset.action, "subscription-checkout-cancel");
  assert.equal(page.querySelector(".tier-premium button").disabled, true);
});

test("une résiliation occupée bloque le bouton et les nouveaux achats sans supprimer les offres", (t) => {
  const { render } = membershipContext(t, { subscription: { tier: "pro", source: "own", status: "active" }, stopBusy: true });
  const page = render();
  assert.equal(page.querySelector(".membership-account-tools button").disabled, true);
  assert.equal(page.querySelector(".membership-account-tools button").textContent, "Arrêt en cours…");
  assert.equal(page.querySelector(".tier-premium button").disabled, true);
  assert.equal(page.querySelectorAll(".subscription-card").length, 3);
});

test("les achats uniques restent consultables à part, avec miniatures différées et données échappées", (t) => {
  const { render } = membershipContext(t, { packs: [
    { id: "free", name: "Jeu gratuit", accessMode: "included" },
    { id: "paid", name: '<script>alert("non")</script>', artwork: "exemple.webp", price: 12.5, accessMode: "purchase" }
  ] });
  const page = render();
  const modules = page.querySelector("details.commerce-games");
  assert.equal(modules.open, false);
  assert.equal(modules.querySelectorAll("article").length, 1);
  assert.equal(modules.querySelector("article strong").textContent, '<script>alert("non")</script>');
  assert.equal(modules.querySelector("script"), null);
  assert.match(modules.querySelector("article b").textContent, /^12,50\s€$/);
  assert.equal(modules.querySelector("img").getAttribute("loading"), "lazy");
  assert.equal(modules.querySelector("img").getAttribute("decoding"), "async");
  assert.equal(modules.querySelector("img").getAttribute("width"), "54");
  assert.equal(modules.querySelector(".membership-module-count").textContent, "1 jeu");
  assert.equal(modules.closest(".membership-offers"), null);
  assert.match(modules.querySelector(".membership-module-copy").textContent, /accès Pro ou Premium actif.*en plus de l’achat unique/);
  assert.equal(modules.querySelector("article small").textContent, "ACHAT UNIQUE · ACCÈS PRO REQUIS");
});

test("les dates d’abonnement respectent la préférence de langue de l’interface", (t) => {
  const { window, state, run, render } = membershipContext(t, { subscription: {
    tier: "pro", source: "own", status: "active", renewalDate: "2026-12-31T12:00:00Z"
  } });
  state.settings.locale = "fr-FR";
  run('studioLocaleOverride = "fr-FR";');
  assert.equal(window.membershipDateLabel(state.commerce.subscription.renewalDate), "31 décembre 2026");
  run('studioLocaleOverride = "en-US";');
  assert.equal(state.settings.locale, "fr-FR");
  assert.equal(window.membershipDateLabel(state.commerce.subscription.renewalDate), "December 31, 2026");
  assert.match(render().querySelector(".membership-renewal").textContent, /December 31, 2026/);
  assert.equal(window.membershipDateLabel("date invalide"), "");
  assert.equal(window.membershipDateLabel(""), "");
});

test("le nombre de modules conserve un pluriel correct pour zéro, un et plusieurs jeux", (t) => {
  const { window, render } = membershipContext(t);
  assert.equal(render().querySelector(".membership-module-count").textContent, "0 jeux");
  window.snapshot.packs.push({ id: "first", name: "Premier", accessMode: "purchase" });
  assert.equal(render().querySelector(".membership-module-count").textContent, "1 jeu");
  window.snapshot.packs.push({ id: "second", name: "Second", accessMode: "purchase" });
  assert.equal(render().querySelector(".membership-module-count").textContent, "2 jeux");
});
