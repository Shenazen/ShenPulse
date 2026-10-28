"use strict";

/** Plan comparison only: prices, entitlements and checkout remain owned by commerce. */
let membershipPopupDialog = null;
let membershipPopupReturnFocus = null;
let membershipPopupSignature = "";
let membershipPopupCancelBusy = false;

function membershipPopupModel() {
  if (typeof ensureAgencyData === "function") ensureAgencyData();
  const authenticated = isAccountAuthenticated();
  const subscription = authenticated ? currentSubscription() : { tier: "free", source: "free", status: "free" };
  const activeTier = authenticated && hasProAccess() ? subscription.tier : "free";
  const paidTier = authenticated && subscription.source === "own" &&
    ["active", "paid"].includes(String(subscription.status || "")) &&
    ["pro", "premium"].includes(subscription.tier) ? subscription.tier : "";
  return {
    authenticated, subscription, activeTier, paidTier,
    pendingStop: paidTier ? pendingSubscriptionStop(subscription) : null,
    checkoutTier: authenticated ? subscriptionCheckoutBusyTier : "",
    stopBusy: authenticated && subscriptionStopBusy,
    cancelBusy: membershipPopupCancelBusy
  };
}

function membershipPopupPlanStatus(plan, model) {
  if (model.activeTier !== plan.tier) return plan.tier === "free" ? "POUR DÉMARRER" : "OFFRE MENSUELLE";
  if (plan.tier === "free") return "OFFRE ACTUELLE";
  if (model.paidTier === plan.tier) return "ABONNEMENT ACTUEL";
  if (model.subscription.source === "trial") return "ESSAI ACTIF";
  if (["premiumSeat", "agencyReward"].includes(model.subscription.source)) return "ACCÈS PRO OFFERT";
  return "ACCÈS ACTUEL";
}

function membershipPopupPlanButton(plan, model) {
  const focus = `data-membership-focus="plan-${escapeHtml(plan.tier)}"`;
  if (!model.authenticated) {
    return `<button type="button" class="button ${plan.tier === "free" ? "" : "primary"}" data-membership-login ${focus}>${plan.tier === "free" ? "Commencer gratuitement" : `Choisir ${escapeHtml(plan.name)}`}</button>`;
  }
  if (model.checkoutTier === plan.tier) {
    return `<button type="button" class="button membership-popup-cancel" data-action="subscription-checkout-cancel" data-tier="${escapeHtml(plan.tier)}" ${focus} ${model.cancelBusy ? "disabled" : ""}>${model.cancelBusy ? "Annulation…" : "Annuler PayPal"}</button>`;
  }
  if (typeof agencyCanApplyTariff === "function" && !model.pendingStop && agencyCanApplyTariff(plan.tier, model.subscription)) {
    return `<button type="button" class="button primary" data-action="subscription-checkout" data-tier="${escapeHtml(plan.tier)}" ${focus}>Appliquer le tarif agence</button>`;
  }
  if (model.activeTier === plan.tier && plan.tier !== "free") {
    return `<button type="button" class="button" ${focus} disabled>Offre active</button>`;
  }
  if (plan.tier === "free") {
    if (model.paidTier) {
      return `<button type="button" class="button membership-popup-stop" data-action="subscription-stop" ${focus} ${model.pendingStop || model.stopBusy || model.checkoutTier ? "disabled" : ""}>${model.pendingStop ? "Arrêt programmé" : model.stopBusy ? "Arrêt en cours…" : "Arrêter l’abonnement"}</button>`;
    }
    return `<button type="button" class="button" ${focus} disabled>${model.activeTier === "free" ? "Offre active" : "Offre gratuite"}</button>`;
  }
  return `<button type="button" class="button primary" data-action="subscription-checkout" data-tier="${escapeHtml(plan.tier)}" ${focus} ${model.checkoutTier || model.stopBusy ? "disabled" : ""}>Choisir ${escapeHtml(plan.name)}</button>`;
}

function membershipPopupStatusMarkup(model) {
  if (model.checkoutTier) {
    return `<p class="membership-popup-notice" role="status">${model.cancelBusy ? "Annulation du paiement en cours…" : "Paiement PayPal en cours. Vous pouvez annuler sans modifier votre abonnement."}</p>`;
  }
  if (model.pendingStop) {
    const date = membershipDateLabel(model.pendingStop.effectiveAt || model.subscription.renewalDate);
    return `<p class="membership-popup-notice" role="status"><span>Renouvellement arrêté. Votre accès reste actif jusqu’à la fin de la période payée.</span>${date ? ` <strong>${escapeHtml(date)}</strong>` : ""}</p>`;
  }
  if (model.activeTier !== "free" && model.subscription.source === "agencyReward") {
    return '<p class="membership-popup-notice" role="status">Votre accès Pro est offert grâce au palier Diamant de votre agence, tant qu’elle compte au moins 25 créateurs abonnés.</p>';
  }
  if (model.activeTier !== "free" && model.subscription.source === "premiumSeat") {
    return '<p class="membership-popup-notice" role="status">Votre accès Pro vous est offert. Aucun abonnement personnel n’est nécessaire.</p>';
  }
  if (model.activeTier !== "free" && model.subscription.source === "trial") {
    return '<p class="membership-popup-notice" role="status">Vous profitez actuellement d’un essai actif. Vos droits restent synchronisés avec votre compte.</p>';
  }
  if (!model.authenticated) {
    return '<p class="membership-popup-notice" role="status">Découvrez les offres librement. La connexion est nécessaire pour choisir une offre.</p>';
  }
  return "";
}

function membershipPopupMarkup(model) {
  return `<div class="membership-popup-shell membership-page">
    <button type="button" class="membership-popup-close" data-membership-close data-membership-focus="close" aria-label="Fermer les offres ShenPulse">×</button>
    <header class="membership-popup-header">
      <span class="membership-popup-eyebrow">VOTRE STUDIO, À VOTRE RYTHME</span>
      <h2 id="membership-popup-title">Choisissez votre offre ShenPulse.</h2>
      <p id="membership-popup-description">Commencez gratuitement, puis donnez plus de liberté à votre créativité. Premium inclut toujours tous les avantages Pro.</p>
      <span class="membership-popup-billing">Abonnements mensuels</span>
    </header>
    ${membershipPopupStatusMarkup(model)}
    <div class="membership-popup-plans">
      ${(typeof agencySubscriptionPlans === "function" ? agencySubscriptionPlans() : SUBSCRIPTION_PLANS).filter((plan) => ["free", "pro", "premium"].includes(plan.tier)).map((plan) => `<article class="membership-popup-card tier-${escapeHtml(plan.tier)} ${model.activeTier === plan.tier ? "is-current" : ""}" ${model.activeTier === plan.tier ? 'aria-current="true"' : ""}>
        <div class="membership-popup-plan-top"><span class="membership-popup-plan-icon" aria-hidden="true">${plan.tier === "premium" ? "♛" : plan.tier === "pro" ? "◆" : "○"}</span><span class="membership-popup-plan-status">${membershipPopupPlanStatus(plan, model)}</span></div>
        <h3>${escapeHtml(plan.name)}</h3>
        <div class="membership-popup-price"><strong>${plan.price === 0 ? "Gratuit" : `${Number(plan.price).toFixed(2).replace(".", ",")} €`}</strong>${plan.price ? "<span>/ mois</span>" : "<span>Sans abonnement</span>"}</div>
        <p class="membership-popup-plan-description">${escapeHtml(plan.description)}</p>
        <ul>${plan.features.map((feature) => `<li><span aria-hidden="true">✓</span><span>${escapeHtml(feature)}</span></li>`).join("")}</ul>
        ${membershipPopupPlanButton(plan, model)}
      </article>`).join("")}
    </div>
    <footer class="membership-popup-footer"><span aria-hidden="true">◇</span><p>Jeux vidéo, Commandes et Matchs nécessitent un accès Pro ou Premium actif. Machines IRL est réservé à Premium. Les modules vendus séparément exigent aussi leur achat ou un essai produit actif.</p></footer>
  </div>`;
}

function syncMembershipPopup() {
  if (!membershipPopupDialog?.open) return false;
  const model = membershipPopupModel();
  const locale = typeof studioLocale === "function" ? studioLocale() : snapshot?.state?.settings?.locale;
  const signature = JSON.stringify([model, SUBSCRIPTION_PLANS, locale]);
  if (signature === membershipPopupSignature) return false;
  const focused = membershipPopupDialog.contains(document.activeElement)
    ? document.activeElement.dataset.membershipFocus : "";
  const scrollTop = membershipPopupDialog.scrollTop;
  membershipPopupDialog.innerHTML = membershipPopupMarkup(model);
  membershipPopupSignature = signature;
  if (typeof applyStudioLanguage === "function") applyStudioLanguage(membershipPopupDialog);
  membershipPopupDialog.scrollTop = scrollTop;
  if (focused) {
    const control = [...membershipPopupDialog.querySelectorAll("[data-membership-focus]")]
      .find((element) => element.dataset.membershipFocus === focused && !element.disabled);
    (control || membershipPopupDialog.querySelector("[data-membership-close]")).focus();
  }
  return true;
}

function finishMembershipPopupClose() {
  document.getElementById("membership-popup-button")?.setAttribute("aria-expanded", "false");
  const returnFocus = membershipPopupReturnFocus;
  membershipPopupReturnFocus = null;
  if (returnFocus?.isConnected && typeof returnFocus.focus === "function") returnFocus.focus();
}

function closeMembershipPopup() {
  if (!membershipPopupDialog?.open) return;
  membershipPopupDialog.close();
  finishMembershipPopupClose();
}

async function handleMembershipPopupClick(event) {
  const target = event.target.closest("button");
  if (event.target === membershipPopupDialog || target?.hasAttribute("data-membership-close")) {
    closeMembershipPopup();
    return;
  }
  if (!target || target.disabled) return;
  if (target.hasAttribute("data-membership-login")) {
    closeMembershipPopup();
    openAccountLogin();
    return;
  }
  if (!["subscription-checkout", "subscription-checkout-cancel", "subscription-stop"].includes(target.dataset.action)) return;
  // Recheck authentication on click: an account may have signed out while this modal was open.
  if (!isAccountAuthenticated()) {
    closeMembershipPopup();
    openAccountLogin();
    return;
  }
  if (target.dataset.action === "subscription-checkout-cancel") membershipPopupCancelBusy = true;
  try {
    const operation = handleAction(target);
    syncMembershipPopup();
    await operation;
  } catch (error) {
    if (typeof toast === "function") toast("Abonnement", error.message || String(error), true);
  } finally {
    membershipPopupCancelBusy = false;
    syncMembershipPopup();
  }
}

function ensureMembershipPopup() {
  if (membershipPopupDialog?.isConnected) return membershipPopupDialog;
  membershipPopupDialog = document.createElement("dialog");
  membershipPopupDialog.id = "membership-popup-dialog";
  membershipPopupDialog.className = "membership-popup-dialog";
  membershipPopupDialog.setAttribute("aria-labelledby", "membership-popup-title");
  membershipPopupDialog.setAttribute("aria-describedby", "membership-popup-description");
  membershipPopupDialog.setAttribute("aria-modal", "true");
  membershipPopupDialog.addEventListener("click", handleMembershipPopupClick);
  membershipPopupDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeMembershipPopup();
  });
  membershipPopupDialog.addEventListener("close", finishMembershipPopupClose);
  membershipPopupDialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMembershipPopup();
    } else if (event.key === "Tab") {
      const controls = [...membershipPopupDialog.querySelectorAll("button:not(:disabled), [href], [tabindex='0']")];
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
  document.body.appendChild(membershipPopupDialog);
  return membershipPopupDialog;
}

function openMembershipPopup() {
  const popup = ensureMembershipPopup();
  if (popup.open) {
    syncMembershipPopup();
    return popup;
  }
  membershipPopupReturnFocus = document.activeElement;
  membershipPopupSignature = "";
  popup.showModal();
  syncMembershipPopup();
  document.getElementById("membership-popup-button")?.setAttribute("aria-expanded", "true");
  popup.querySelector("[data-membership-close]")?.focus();
  return popup;
}
