"use strict";
const { readMainSource } = require("./helpers/main-source-bundles");
const { readRendererSource, readRendererStyles } = require("./helpers/source-bundles");
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/** Essais, tarifs, offres et fenêtres de paiement. */

test("le formulaire d'essai garde l'adresse e-mail saisissable après un envoi", () => {
  const app = readRendererSource();
  const styles = readRendererStyles();
  const formStart = app.indexOf("function renderAdminTrials()");
  const formEnd = app.indexOf("function renderAdminCommerce", formStart);
  const form = app.slice(formStart, formEnd);
  const submitStart = app.indexOf(
    'if (event.target.id === "admin-trial-form")'
  );
  const submitEnd = app.indexOf(
    'if (event.target.id === "simulator-form")',
    submitStart
  );
  const submit = app.slice(submitStart, submitEnd);
  const revokeStart = app.indexOf('if (action === "admin-trial-revoke")');
  const revokeEnd = app.indexOf(
    'if (action === "admin-plan-edit")',
    revokeStart
  );
  const revoke = app.slice(revokeStart, revokeEnd);
  const restoreStart = app.indexOf(
    "function restoreAdminTrialFormInteractivity"
  );
  const restoreEnd = app.indexOf(
    "function renderAdminCommerce",
    restoreStart
  );
  const restore = app.slice(restoreStart, restoreEnd);

  assert.match(form, /name="email" type="email"/);
  assert.match(form, /type="submit" \$\{adminBusy \? "disabled" : ""\}/);
  assert.doesNotMatch(submit, /if \(adminModuleError\("trials"\)\)/);
  assert.match(submit, /finally \{\s*adminBusy = false;\s*render\(\);/);
  assert.match(
    submit,
    /restoreAdminTrialFormInteractivity\(\{ focusEmail: true \}\)/
  );
  assert.match(
    revoke,
    /restoreAdminTrialFormInteractivity\(\{ focusEmail: true \}\)/
  );
  assert.match(restore, /adminContent\?\.classList\.remove\("is-busy"\)/);
  assert.match(restore, /control\.disabled = false/);
  assert.match(restore, /emailInput\.readOnly = false/);
  assert.match(restore, /emailInput\.focus\(\{ preventScroll: true \}\)/);
  assert.match(restore, /requestAnimationFrame\(restore\)/);
  assert.match(styles, /\.admin-trial-form input\[name="email"\]/);
  assert.match(
    styles,
    /\.admin-content\.is-busy \.admin-trial-form[\s\S]*pointer-events: auto/
  );
});

test("le formulaire d'essai propose tous les jeux payants du catalogue local", () => {
  const app = readRendererSource();
  const styles = readRendererStyles();
  const helperStart = app.indexOf("function adminTrialGameProducts()");
  const helperEnd = app.indexOf("function isCurrentGameProduct", helperStart);
  const helper = app.slice(helperStart, helperEnd);
  const formStart = app.indexOf("function renderAdminTrials()");
  const formEnd = app.indexOf(
    "function restoreAdminTrialFormInteractivity",
    formStart
  );
  const form = app.slice(formStart, formEnd);
  const editorStart = app.indexOf("function openAdminTrialEditor(trial)");
  const editorEnd = app.indexOf("function toLocalAdminDate", editorStart);
  const editor = app.slice(editorStart, editorEnd);
  const submitStart = app.indexOf(
    'if (event.target.id === "admin-trial-form")'
  );
  const submitEnd = app.indexOf(
    'if (event.target.id === "admin-game-cheat-form")',
    submitStart
  );
  const submit = app.slice(submitStart, submitEnd);

  assert.match(form, /adminTrialGameProducts\(\)/);
  assert.match(form, /adminTrialGameChoices\(\)/);
  assert.doesNotMatch(form, /item\.trialEligible/);
  assert.match(helper, /snapshot\?\.packs/);
  assert.match(helper, /pack\.accessMode === "purchase"/);
  assert.match(helper, /commerceProducts\[pack\.id\] \|\| \{\}/);
  assert.match(helper, /title: product\.title \|\| pack\.name \|\| pack\.id/);
  assert.match(helper, /function adminTrialGameChoices\(selectedIds = \[\]\)/);
  assert.match(helper, /data-admin-trial-game-option/);
  assert.match(helper, /function adminTrialGameIdsFromForm\(data\)/);
  assert.match(helper, /\.map\(\(game\) => game\.id\)/);
  assert.match(
    submit,
    /gameIds: games \? adminTrialGameIdsFromForm\(data\) : \[\]/
  );
  assert.match(editor, /adminTrialGameChoices\(selectedGameIds\)/);
  assert.match(
    editor,
    /gameIds: data\.has\("games"\) \? adminTrialGameIdsFromForm\(data\) : \[\]/
  );
  assert.doesNotMatch(editor, /IDs des jeux/);
  assert.match(styles, /\.admin-trial-game-grid/);
  assert.match(styles, /\.admin-trial-game-choice/);
});

test("une session propriétaire resynchronise les accès offerts au démarrage", () => {
  const app = readRendererSource();
  const startup = app.slice(app.indexOf("api.getSnapshot()"));

  assert.match(startup, /if \(isVerifiedAdminSession\(\)\)/);
  assert.match(startup, /adminDashboard = await api\.admin\.dashboard\(\)/);
  assert.match(
    startup,
    /adminSession = adminDashboard\.status \|\| adminSession/
  );
});

test("un tarif de jeu accepte la virgule et est publié en production", () => {
  const app = readRendererSource();
  const editorStart = app.indexOf("function openAdminProductEditor");
  const editorEnd = app.indexOf(
    "function openAdminPromotionEditor",
    editorStart
  );
  const editor = app.slice(editorStart, editorEnd);

  assert.match(
    app,
    /function normalizeAdminMoney[\s\S]*replace\(",", "\."\)/
  );
  assert.match(editor, /submitLabel: "Enregistrer et publier"/);
  assert.match(
    editor,
    /saveAdminCommerce\(\s*catalog,\s*"publish-prod"/
  );
});

test("un essai Pro sélectionne la carte et affiche Offre active", () => {
  const app = readRendererSource();
  const membership = app.slice(
    app.indexOf("function renderMembership"),
    app.indexOf("function renderSettings")
  );

  assert.match(membership, /subscription\.source === "own"/);
  assert.match(
    membership,
    /const activeSubscriptionTier = hasProAccess\(\)[\s\S]*?subscription\.tier[\s\S]*?: "free"/
  );
  assert.match(
    membership,
    /activeSubscriptionTier === plan\.tier \? "current"/
  );
  assert.match(membership, /subscription\.source === "trial"/);
  assert.match(membership, /ESSAI ACTIF/);
  assert.match(membership, /data-action="subscription-checkout"/);
  assert.match(
    membership,
    /activeSubscriptionTier === plan\.tier && plan\.tier !== "free"[\s\S]*?<button class="button" type="button" disabled>Offre active/
  );
});

test("un accès Pro offert par Premium sélectionne aussi Pro avec Offre active", () => {
  const app = readRendererSource();
  const membership = app.slice(
    app.indexOf("function renderMembership"),
    app.indexOf("function renderSettings")
  );

  assert.match(membership, /subscription\.source === "premiumSeat"/);
  assert.match(membership, /\$\{subscription\.tier\} · offert/);
  assert.match(membership, /ACCÈS PRO OFFERT/);
  assert.match(membership, /aria-current="true"/);
  assert.match(
    membership,
    /activeSubscriptionTier === plan\.tier && plan\.tier !== "free"[\s\S]*?disabled>Offre active/
  );
});

test("les jeux payants ouvrent une fenêtre d’achat illustrée avant PayPal", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = readRendererSource();
  const styles = readRendererStyles();
  const purchaseStart = app.indexOf(
    "function openGamePurchaseDialog(pack)"
  );
  const purchaseEnd = app.indexOf(
    "function renderGamesCatalogLegacy",
    purchaseStart
  );
  const purchaseDialog = app.slice(purchaseStart, purchaseEnd);

  assert.match(purchaseDialog, /variant: "game-purchase"/);
  assert.match(purchaseDialog, /game-purchase-visual/);
  assert.match(purchaseDialog, /gameArtwork\(pack\)/);
  assert.match(purchaseDialog, /Acheter pour \$\{price\}/);
  assert.match(purchaseDialog, /api\.account\.startGameCheckout/);
  assert.match(purchaseDialog, /checkoutCompleted/);
  assert.match(styles, /dialog\[data-variant="game-purchase"\]/);
  assert.match(
    styles,
    /\.game-purchase-dialog\s*\{[\s\S]*?grid-template-columns:/
  );
  assert.match(styles, /\.game-purchase-visual > img/);
});

test("les boutons d’abonnement gèrent le paiement et l’arrêt à échéance", () => {
  const app = readRendererSource();
  const ipc = readMainSource("ipc.js");
  const preload = fs.readFileSync(
    path.join(__dirname, "..", "src", "main", "preload.js"),
    "utf8"
  );
  const membership = app.slice(
    app.indexOf("function renderMembership"),
    app.indexOf("function renderSettings")
  );
  const handler = app.slice(
    app.indexOf('if (action === "subscription-checkout-cancel")'),
    app.indexOf('if (action === "test-event")')
  );

  assert.match(
    membership,
    /type="button" data-action="subscription-checkout"/
  );
  assert.match(membership, /subscriptionCheckoutBusyTier/);
  assert.match(membership, /Annuler PayPal/);
  assert.match(membership, /Arrêter l’abonnement/);
  assert.match(membership, /Votre abonnement .* s’arrêtera le/);
  assert.match(membership, /data-action="subscription-stop"/);
  assert.match(membership, /pendingSubscriptionStop/);
  assert.match(handler, /api\.account\.cancelCheckout/);
  assert.match(handler, /api\.account\.stopSubscription/);
  assert.match(handler, /Arrêter le renouvellement/);
  assert.match(handler, /confirmAction/);
  assert.match(handler, /api\.account\.startSubscriptionCheckout/);
  assert.match(handler, /subscriptionCheckoutBusyTier = tier/);
  assert.match(handler, /finally \{/);
  assert.match(ipc, /handle\("account:checkout-cancel"/);
  assert.match(ipc, /handle\("account:subscription-stop"/);
  assert.match(preload, /cancelCheckout: \(payload\)/);
  assert.match(preload, /stopSubscription: \(\)/);
});

