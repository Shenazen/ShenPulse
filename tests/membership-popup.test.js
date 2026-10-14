"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { createDefaultState } = require("../src/main/defaults");

const rendererRoot = path.join(__dirname, "..", "src", "renderer", "app");
const source = (file) => fs.readFileSync(path.join(rendererRoot, file), "utf8");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((success, failure) => { resolve = success; reject = failure; });
  return { promise, resolve, reject };
}

async function settle() { await new Promise((resolve) => setTimeout(resolve, 10)); }

function popupContext(t, { authenticated = true, subscription } = {}) {
  const dom = new JSDOM('<button id="membership-popup-button">Pro</button><main id="content"></main>', {
    pretendToBeVisual: true, runScripts: "outside-only", url: "https://shenpulse.example.test"
  });
  t.after(() => dom.window.close());
  const window = dom.window;
  const state = createDefaultState();
  if (subscription) state.commerce.subscription = subscription;
  const calls = { login: 0, checkout: [], cancel: [], stop: 0, translated: 0, errors: [] };
  const checkout = deferred();
  const cancel = deferred();
  const stop = deferred();
  window.snapshot = { state, packs: [] };
  window.accountSession = { authenticated };
  window.isAccountAuthenticated = () => window.accountSession.authenticated;
  window.escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  window.openAccountLogin = () => { calls.login += 1; assert.equal(window.document.querySelector("dialog").open, false); };
  window.toast = (...args) => calls.errors.push(args);
  window.perform = async (work) => work();
  window.confirmAction = async () => true;
  window.acceptSnapshot = (value) => { window.snapshot = value; };
  window.requireAccountForAction = () => false;
  window.STUDIO_PREFERENCE_ACTIONS = new window.Set();
  window.studioLocale = () => state.settings.locale;
  window.applyStudioLanguage = () => { calls.translated += 1; };
  window.api = { account: {
    startSubscriptionCheckout: (payload) => { calls.checkout.push(payload); return checkout.promise; },
    cancelCheckout: (payload) => { calls.cancel.push(payload); return cancel.promise; },
    stopSubscription: () => { calls.stop += 1; return stop.promise; }
  } };
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new window.Event("close")); };
  // Evaluate the real public plan data, access helpers and existing payment dispatcher.
  const bootstrap = source("core/bootstrap.js");
  const plans = bootstrap.slice(bootstrap.indexOf("const SUBSCRIPTION_PLANS ="), bootstrap.indexOf("const ACTION_TYPE_LABELS ="));
  const run = (value) => vm.runInContext(value, dom.getInternalVMContext());
  run(fs.readFileSync(path.join(rendererRoot, "..", "..", "shared", "pro-access.js"), "utf8"));
  run(`${plans}\nlet subscriptionCheckoutBusyTier = ''; let subscriptionStopBusy = false; let currentPage = 'home';`);
  for (const file of ["features/games/access.js", "features/membership.js", "actions/handlers/contracts.js", "actions/handlers/content-commerce.js", "actions/dispatcher.js", "features/membership-popup.js"]) {
    run(source(file));
  }
  window.render = () => window.syncMembershipPopup();
  return { window, state, calls, checkout, cancel, stop, run, trigger: window.document.getElementById("membership-popup-button") };
}

test("la popup est créée à la demande avec les trois offres réelles, sans démarrer un paiement", (t) => {
  const context = popupContext(t);
  const { window, calls, trigger } = context;
  assert.equal(window.document.querySelector("dialog"), null);
  trigger.focus();
  const dialog = window.openMembershipPopup();
  const plans = window.eval("SUBSCRIPTION_PLANS");
  assert.equal(dialog.open, true);
  assert.equal(dialog.getAttribute("aria-modal"), "true");
  assert.ok(window.document.getElementById(dialog.getAttribute("aria-labelledby")));
  assert.ok(window.document.getElementById(dialog.getAttribute("aria-describedby")));
  assert.equal(dialog.querySelectorAll(".membership-popup-card").length, plans.length);
  for (const plan of plans) {
    const card = dialog.querySelector(`.tier-${plan.tier}`);
    assert.equal(card.querySelector("h3").textContent, plan.name);
    assert.equal(card.querySelectorAll("li").length, plan.features.length);
    assert.equal(card.querySelector(".membership-popup-price strong").textContent,
      plan.price ? `${plan.price.toFixed(2).replace(".", ",")} €` : "Gratuit");
    for (const feature of plan.features) assert.ok(card.textContent.includes(feature));
  }
  assert.match(dialog.textContent, /Abonnements mensuels/);
  assert.doesNotMatch(dialog.textContent, /annuel|agence|SyncLive/i);
  assert.match(dialog.querySelector(".membership-popup-footer").textContent, /Jeux vidéo, Interactions IRL, Commandes et Matchs nécessitent un accès Pro ou Premium actif/);
  assert.doesNotMatch(dialog.textContent, /interactions.*sans abonnement|jeux vidéo compatibles gratuits|sans abonnement supplémentaire/iu);
  assert.deepEqual(calls.checkout, []);
  assert.deepEqual(calls.cancel, []);
  assert.equal(calls.stop, 0);
  assert.equal(window.openMembershipPopup(), dialog);
  assert.equal(window.document.querySelectorAll("#membership-popup-dialog").length, 1);
  assert.equal(window.syncMembershipPopup(), false);
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
});

test("fermeture, Échap, arrière-plan et cycle du focus restent accessibles", (t) => {
  const { window, trigger } = popupContext(t);
  trigger.focus();
  const dialog = window.openMembershipPopup();
  const close = dialog.querySelector("[data-membership-close]");
  const last = [...dialog.querySelectorAll("button:not(:disabled)")].at(-1);
  assert.equal(window.document.activeElement, close);
  close.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
  assert.equal(window.document.activeElement, last);
  last.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
  assert.equal(window.document.activeElement, close);
  dialog.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  assert.equal(dialog.open, false);
  assert.equal(window.document.activeElement, trigger);
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  window.openMembershipPopup().querySelector("[data-membership-close]").click();
  assert.equal(dialog.open, false);
  window.openMembershipPopup().dispatchEvent(new window.Event("cancel", { cancelable: true }));
  assert.equal(dialog.open, false);
  window.openMembershipPopup().click();
  assert.equal(dialog.open, false);
});

test("un invité consulte les offres mais leur sélection ferme la popup et ouvre la connexion", async (t) => {
  const { window, calls, state } = popupContext(t, { authenticated: false, subscription: { tier: "premium", status: "active", source: "own" } });
  const popup = window.openMembershipPopup();
  assert.equal(popup.querySelector('[aria-current="true"] h3').textContent, "Free", "Les droits personnels ne sont pas exposés à un invité.");
  assert.match(popup.textContent, /connexion est nécessaire/);
  popup.querySelector(".tier-premium button").click();
  await settle();
  assert.equal(calls.login, 1);
  assert.equal(popup.open, false);
  window.openMembershipPopup().querySelector(".tier-free button").click();
  await settle();
  assert.equal(calls.login, 2);
  assert.deepEqual(calls.checkout, []);
  assert.equal(state.commerce.subscription.tier, "premium");
  // Recheck sign-out at click time, without relying on a preceding rerender.
  window.accountSession.authenticated = true;
  state.commerce.subscription = { tier: "free", status: "free", source: "free" };
  window.openMembershipPopup();
  window.accountSession.authenticated = false;
  popup.querySelector('.tier-pro [data-action="subscription-checkout"]').click();
  await settle();
  assert.equal(calls.login, 3);
  assert.deepEqual(calls.checkout, []);
});

test("le choix et l’annulation passent par le vrai dispatcher, avec états occupés et API simulée", async (t) => {
  const { window, calls, checkout, cancel, state } = popupContext(t);
  const popup = window.openMembershipPopup();
  popup.querySelector('.tier-pro [data-action="subscription-checkout"]').click();
  await settle();
  assert.equal(calls.checkout.length, 1);
  assert.equal(calls.checkout[0].tier, "pro");
  assert.equal(window.eval("subscriptionCheckoutBusyTier"), "pro");
  assert.equal(popup.querySelector('.tier-premium [data-action="subscription-checkout"]').disabled, true);
  assert.match(popup.querySelector('[role="status"]').textContent, /Paiement PayPal en cours/);
  const cancelButton = popup.querySelector('[data-action="subscription-checkout-cancel"]');
  assert.equal(cancelButton.disabled, false);
  cancelButton.click();
  await settle();
  assert.equal(calls.cancel.length, 1);
  assert.equal(calls.cancel[0].type, "subscription");
  assert.equal(popup.querySelector('[data-action="subscription-checkout-cancel"]').disabled, true);
  assert.match(popup.textContent, /Annulation du paiement en cours/);
  cancel.resolve({ cancelled: true });
  checkout.resolve({ result: { cancelled: true }, snapshot: { state, packs: [] } });
  await settle();
  assert.equal(window.eval("subscriptionCheckoutBusyTier"), "");
  assert.equal(popup.querySelector('[data-action="subscription-checkout-cancel"]'), null);
  assert.equal(popup.querySelector('.tier-pro [data-action="subscription-checkout"]').disabled, false);
  assert.equal(popup.querySelector('[role="status"]'), null);
  assert.equal(popup.open, true);
});

test("Pro offert, essai actif, Premium et arrêt programmé utilisent les droits réels", (t) => {
  const { window, state } = popupContext(t, { subscription: { tier: "pro", status: "active", source: "premiumSeat" } });
  const popup = window.openMembershipPopup();
  assert.equal(popup.querySelector('[aria-current="true"] h3').textContent, "Pro");
  assert.match(popup.querySelector(".tier-pro").textContent, /ACCÈS PRO OFFERT/);
  assert.equal(popup.querySelector('[data-action="subscription-stop"]'), null);
  state.commerce.subscription = { tier: "pro", status: "trial", source: "trial", expiresAtMs: Date.now() + 60000 };
  window.syncMembershipPopup();
  assert.match(popup.querySelector(".tier-pro").textContent, /ESSAI ACTIF/);
  state.commerce.subscription.expiresAtMs = Date.now() - 60000;
  window.syncMembershipPopup();
  assert.equal(popup.querySelector('[aria-current="true"] h3').textContent, "Free");
  state.commerce.subscription = { tier: "premium", status: "active", source: "own", pendingChange: { targetTier: "free", effectiveAt: "2027-02-15T12:00:00Z" } };
  window.syncMembershipPopup();
  assert.equal(window.hasProAccess(), true);
  assert.equal(popup.querySelector('[aria-current="true"] h3').textContent, "Premium");
  assert.equal(popup.querySelector('.tier-premium button').disabled, true);
  assert.match(popup.querySelector('[role="status"]').textContent, /Renouvellement arrêté/);
  assert.match(popup.querySelector('[role="status"]').textContent, /2027/);
  assert.equal(popup.querySelector('[data-action="subscription-stop"]').disabled, true);
  assert.match(popup.querySelector('[data-action="subscription-stop"]').textContent, /Arrêt programmé/);
});

test("la gestion Free délègue l’arrêt au parcours existant et l’actualisation garde le focus", async (t) => {
  const { window, state, calls, stop } = popupContext(t, { subscription: { tier: "pro", status: "active", source: "own", renewalDate: "2027-02-15T12:00:00Z" } });
  const popup = window.openMembershipPopup();
  const premium = popup.querySelector('.tier-premium button');
  premium.focus();
  state.commerce.subscription.renewalDate = "2027-03-15T12:00:00Z";
  assert.equal(window.syncMembershipPopup(), true);
  assert.equal(window.document.activeElement.dataset.membershipFocus, "plan-premium");
  const sameButton = window.document.activeElement;
  assert.equal(window.syncMembershipPopup(), false);
  assert.equal(window.document.activeElement, sameButton);
  const translations = calls.translated;
  state.settings.locale = "en-US";
  assert.equal(window.syncMembershipPopup(), true);
  assert.equal(calls.translated, translations + 1);
  popup.querySelector('[data-action="subscription-stop"]').click();
  await settle();
  assert.equal(calls.stop, 1);
  assert.equal(popup.querySelector('[data-action="subscription-stop"]').disabled, true);
  assert.match(popup.querySelector('[data-action="subscription-stop"]').textContent, /Arrêt en cours/);
  state.commerce.subscription.pendingChange = { targetTier: "free", effectiveAt: "2027-03-15T12:00:00Z" };
  stop.resolve({ result: { scheduled: true, effectiveAt: "2027-03-15T12:00:00Z" }, snapshot: { state, packs: [] } });
  await settle();
  assert.match(popup.querySelector('[data-action="subscription-stop"]').textContent, /Arrêt programmé/);
  assert.equal(calls.checkout.length, 0);
});

test("les offres du dialogue passent en anglais puis reviennent en français avec le traducteur réel", (t) => {
  const { window, state, run, calls } = popupContext(t);
  window.syncStudioPreferences = () => { window.document.documentElement.lang = state.settings.locale.startsWith("en") ? "en" : "fr"; };
  run(source("features/studio-language.js"));
  const popup = window.openMembershipPopup();
  assert.equal(popup.querySelector("h2").textContent, "Choisissez votre offre ShenPulse.");
  state.settings.locale = "en-US";
  window.syncMembershipPopup();
  assert.equal(popup.querySelector("h2").textContent, "Choose your ShenPulse plan.");
  assert.equal(popup.querySelector(".membership-popup-billing").textContent, "Monthly subscriptions");
  assert.equal(popup.querySelector(".tier-pro button").textContent, "Choose Pro");
  assert.equal(popup.querySelector("[data-membership-close]").getAttribute("aria-label"), "Close ShenPulse plans");
  assert.match(popup.querySelector(".tier-premium li").textContent, /Pro.*included/i);
  state.settings.locale = "fr-FR";
  window.syncMembershipPopup();
  assert.equal(popup.querySelector("h2").textContent, "Choisissez votre offre ShenPulse.");
  assert.equal(popup.querySelector(".tier-pro button").textContent, "Choisir Pro");
  assert.equal(popup.querySelector("[data-membership-close]").getAttribute("aria-label"), "Fermer les offres ShenPulse");
  assert.deepEqual(calls.checkout, []);
});
