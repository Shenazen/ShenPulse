"use strict";

/**
 * Abonnements et état commercial du compte.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */


function pendingSubscriptionStop(subscription = currentSubscription()) {
  const pending = subscription?.pendingChange;
  return pending && pending.targetTier === "free" ? pending : null;
}

function membershipDateLabel(value) {
  const date = new Date(String(value || ""));
  if (!Number.isFinite(date.getTime())) return "";
  const locale = typeof studioLocale === "function" && String(studioLocale()).startsWith("en")
    ? "en-US"
    : "fr-FR";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function renderMembership() {
  if (typeof ensureAgencyData === "function") ensureAgencyData();
  const subscription = currentSubscription();
  const activeSubscriptionTier = hasProAccess()
    ? subscription.tier
    : "free";
  const paidSubscriptionTier =
    subscription.source === "own" &&
    ["active", "paid"].includes(String(subscription.status || "")) &&
    ["pro", "premium"].includes(subscription.tier)
      ? subscription.tier
      : "";
  const pendingStop = paidSubscriptionTier
    ? pendingSubscriptionStop(subscription)
    : null;
  const pendingStopDate = membershipDateLabel(
    pendingStop?.effectiveAt || subscription.renewalDate
  );
  const paidPlanName =
    (typeof agencySubscriptionPlans === "function" ? agencySubscriptionPlans() : SUBSCRIPTION_PLANS).find((plan) => plan.tier === paidSubscriptionTier)
      ?.name || paidSubscriptionTier;
  const activePlan = (typeof agencySubscriptionPlans === "function" ? agencySubscriptionPlans() : SUBSCRIPTION_PLANS).find((plan) => plan.tier === activeSubscriptionTier);
  const membershipSummary = activeSubscriptionTier === "free"
    ? "Free"
    : subscription.source === "trial"
      ? `${subscription.tier} · essai`
      : ["premiumSeat", "agencyReward"].includes(subscription.source)
        ? `${subscription.tier} · offert`
        : activePlan?.name || activeSubscriptionTier;
  const accountDescription = activeSubscriptionTier === "free"
    ? "Jeux vidéo, Commandes et Matchs nécessitent un accès Pro ou Premium actif. Machines IRL est réservé à Premium."
    : subscription.source === "trial"
      ? "Vous profitez d’un essai actif. Vos droits restent synchronisés avec votre compte."
      : subscription.source === "agencyReward"
        ? "Votre accès Pro est offert grâce au palier Diamant de votre agence, tant qu’elle compte au moins 25 créateurs abonnés."
        : subscription.source === "premiumSeat"
          ? "Votre accès Pro vous est offert. Aucun abonnement personnel n’est nécessaire."
        : "Vos avantages sont actifs sur votre compte ShenPulse.";
  const renewalDate = !pendingStop && paidSubscriptionTier
    ? membershipDateLabel(subscription.renewalDate)
    : "";
  const membershipPlanLabel = (plan) => {
    if (activeSubscriptionTier !== plan.tier) {
      return plan.tier === "free" ? "OFFRE GRATUITE" : "OFFRE MENSUELLE";
    }
    if (plan.tier === "free") return "OFFRE ACTUELLE";
    if (paidSubscriptionTier === plan.tier) return "ABONNEMENT ACTUEL";
    if (subscription.source === "trial") return "ESSAI ACTIF";
    if (["premiumSeat", "agencyReward"].includes(subscription.source)) return "ACCÈS PRO OFFERT";
    return "ACCÈS ACTUEL";
  };
  const premiumBeneficiary =
    snapshot.state.commerce?.premiumSeat?.beneficiaryEmail || "";
  const paidGames = visibleGamePacks().filter(
    (pack) => pack.accessMode === "purchase"
  );
  return `
    <div class="reference-page membership-page membership-workspace">
      ${renderStudioHero("membership", "Plus de liberté pour vos lives.", "Commencez gratuitement, choisissez votre rythme. Premium inclut toujours tous les avantages Pro.")}
      <section class="membership-account" aria-labelledby="membership-account-title">
        <span class="membership-account-icon" aria-hidden="true">${membershipIcon("account")}</span>
        <div class="membership-account-copy">
          <span class="membership-eyebrow" id="membership-account-title">VOTRE OFFRE ACTUELLE</span>
          <div class="membership-account-title"><h3>${escapeHtml(activePlan?.name || "Free")}</h3><span class="membership-current">${escapeHtml(membershipSummary)}</span></div>
          <p>${accountDescription}</p>
          ${renewalDate ? `<small class="membership-renewal"><span aria-hidden="true">${membershipIcon("calendar")}</span>Prochaine échéance : <strong>${escapeHtml(renewalDate)}</strong></small>` : ""}
        </div>
        ${paidSubscriptionTier ? `<div class="membership-account-tools">
          ${pendingStop
            ? `<button class="button" type="button" disabled>Arrêt programmé</button>`
            : subscriptionStopBusy
              ? `<button class="button danger" type="button" disabled>Arrêt en cours…</button>`
              : `<button class="button membership-stop-button" type="button" data-action="subscription-stop" ${subscriptionCheckoutBusyTier ? "disabled" : ""}>Arrêter l’abonnement</button>`}
          <small>L’arrêt prend effet à la fin de la période payée.</small>
        </div>` : `<span class="membership-account-sync"><span aria-hidden="true">${membershipIcon("shield")}</span>Accès liés à votre compte</span>`}
      </section>
      ${pendingStop ? `
        <section class="membership-stop-notice" role="status">
          <div><span class="membership-notice-icon" aria-hidden="true">${membershipIcon("calendar")}</span><div><h3>Arrêt programmé</h3><p>Votre abonnement ${escapeHtml(paidPlanName)} s’arrêtera le <strong>${escapeHtml(pendingStopDate || "dernier jour de la période payée")}</strong>. Il reste actif avec tous ses avantages jusqu’à cette date.</p></div></div>
          <span class="badge warning">RENOUVELLEMENT ARRÊTÉ</span>
        </section>
      ` : ""}
      ${subscriptionCheckoutBusyTier ? `<p class="membership-checkout-notice" role="status">Paiement en cours. Vous pouvez annuler sans modifier votre abonnement.</p>` : ""}
      <section class="membership-offers" aria-labelledby="membership-offers-title">
        <header class="membership-section-heading"><div><span class="membership-eyebrow">À CHAQUE LIVE, SON OFFRE</span><h3 id="membership-offers-title">Choisissez la liberté qui vous ressemble.</h3><p>Trois offres, des droits clairs. Les abonnements sont mensuels.</p></div><span class="membership-billing">Abonnements mensuels</span></header>
      ${checkoutPaymentMethodsField("subscriptionPaymentProvider", subscription, Boolean(subscriptionCheckoutBusyTier))}
      <div class="subscription-grid">
        ${(typeof agencySubscriptionPlans === "function" ? agencySubscriptionPlans() : SUBSCRIPTION_PLANS).map((plan) => `
          <article class="subscription-card tier-${escapeHtml(plan.tier)} ${activeSubscriptionTier === plan.tier ? "current" : ""} ${plan.tier === "premium" ? "premium" : ""}" ${activeSubscriptionTier === plan.tier ? 'aria-current="true"' : ""}>
            <header><span class="membership-plan-icon" aria-hidden="true">${membershipIcon(plan.tier)}</span><small>${membershipPlanLabel(plan)}</small></header>
            <h3>${escapeHtml(plan.name)}</h3>
            <div class="membership-plan-price"><strong>${plan.price === 0 ? "Gratuit" : `${plan.price.toFixed(2).replace(".", ",")} €`}</strong><span>${plan.price ? "/ mois" : "Sans abonnement"}</span></div>
            <p>${escapeHtml(plan.description)}</p>
            <ul>${plan.features.map((feature) => `<li><span aria-hidden="true">${membershipIcon("check")}</span><span>${escapeHtml(feature)}</span></li>`).join("")}</ul>
            ${subscriptionCheckoutBusyTier === plan.tier
              ? `<button class="button primary" type="button" data-action="subscription-checkout-cancel" data-tier="${escapeHtml(plan.tier)}">Annuler le paiement</button>`
              : activeSubscriptionTier === plan.tier && plan.tier !== "free" && !(typeof agencyCanApplyTariff === "function" && !pendingStop && agencyCanApplyTariff(plan.tier, subscription))
                ? `<button class="button" type="button" disabled>Offre active</button>`
              : plan.tier === "free"
                ? `<button class="button" type="button" disabled>${activeSubscriptionTier === "free" ? "Offre active" : "Offre gratuite"}</button>`
                : `<button class="button primary" type="button" data-action="subscription-checkout" data-tier="${escapeHtml(plan.tier)}" ${subscriptionCheckoutBusyTier || subscriptionStopBusy ? "disabled" : ""}>Choisir ${escapeHtml(plan.name)}</button>`}
          </article>`).join("")}
      </div>
        <p class="membership-offers-footnote"><span aria-hidden="true">${membershipIcon("shield")}</span>Vos accès sont synchronisés sur votre compte. Vous gardez la maîtrise de votre abonnement.</p>
      </section>
      ${hasActivePaidPremium() ? `
        <section class="premium-seat-panel">
          <div class="premium-seat-copy">
            <span class="premium-seat-icon" aria-hidden="true">${membershipIcon("gift")}</span>
            <div>
              <small>AVANTAGE PREMIUM</small>
              <h3>Offrez un accès Pro</h3>
              <p>Renseignez l’adresse e-mail du compte ShenPulse qui bénéficiera gratuitement d’un espace Pro complet.</p>
              ${premiumBeneficiary
                ? `<span class="premium-seat-current">Accès Pro actuellement offert à <strong>${escapeHtml(premiumBeneficiary)}</strong></span>`
                : ""}
            </div>
          </div>
          <form id="premium-seat-form" class="premium-seat-form">
            <label for="premium-beneficiary-email">Adresse e-mail du bénéficiaire</label>
            <div>
              <span aria-hidden="true">${membershipIcon("mail")}</span>
              <input id="premium-beneficiary-email" name="beneficiaryEmail" value="${escapeHtml(premiumBeneficiary)}" type="email" required maxlength="254" placeholder="utilisateur@exemple.fr" autocomplete="email" autocapitalize="none" spellcheck="false">
              <button class="button primary" type="submit">Offrir l’accès Pro</button>
            </div>
            <small>Un seul compte peut bénéficier de cet accès. Le bénéficiaire devra se connecter avec exactement cette adresse e-mail.</small>
          </form>
        </section>
      ` : ""}
      <section class="membership-games-access" aria-labelledby="membership-games-title">
        <span class="membership-access-icon" aria-hidden="true">${membershipIcon("games")}</span>
        <div><h3 id="membership-games-title">Vos accès, sans confusion.</h3><p>Jeux vidéo, Commandes et Matchs sont accessibles avec Pro ou Premium, y compris pendant un essai Pro actif ou avec un accès Pro offert. Machines IRL est réservé à Premium. Pour les jeux compatibles, le jeu original et le pack adapté restent nécessaires. Les modules vendus séparément exigent aussi leur achat ou un essai produit actif.</p></div>
      </section>
      <details class="commerce-games">
        <summary><span class="membership-module-copy"><strong>Modules vendus séparément</strong><span>Un accès Pro ou Premium actif est requis en plus de l’achat unique ou de l’essai produit actif.</span></span><span class="membership-module-count">${paidGames.length} ${paidGames.length === 1 ? "jeu" : "jeux"}</span><span class="membership-module-arrow" aria-hidden="true">${membershipIcon("chevron")}</span></summary>
        <div class="commerce-game-list">
          ${paidGames.map((pack) => `<article><img src="${escapeHtml(gameArtwork(pack))}" alt="" loading="lazy" decoding="async" width="54" height="54"><div><strong>${escapeHtml(pack.name)}</strong><small>ACHAT UNIQUE · ACCÈS PRO REQUIS</small></div><b>${escapeHtml(gamePrice(pack))}</b></article>`).join("")}
        </div>
      </details>
    </div>`;
}

/** Chemins partagés : une seule table réutilisée à chaque rendu de la page. */
const MEMBERSHIP_ICON_PATHS = Object.freeze({
    free: '<path d="M8 5h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z"/><path d="m9 12 2 2 4-4"/>',
    pro: '<path d="m14 3-9 11h7l-2 7 9-11h-7l2-7Z"/>',
    premium: '<path d="m3 7 5 5 4-8 4 8 5-5-2 12H5L3 7Z"/><path d="M7 22h10"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    account: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3M14 15h3"/>',
    calendar: '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4M16 3v4M4 11h16m-13 4 2 2 4-4"/>',
    shield: '<path d="m12 3 8 3v5c0 5-3 8-8 10-5-2-8-5-8-10V6l8-3Z"/><path d="m8 12 3 3 5-5"/>',
    gift: '<path d="M12 8v13M3 12h18M5 12v9h14v-9"/><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
    games: '<path d="M8 7h8c3 0 4 3 5 7 .5 3-1 5-3 4l-3-2H9l-3 2c-2 1-3.5-1-3-4 1-4 2-7 5-7Z"/><path d="M8 10v5m-2.5-2.5h5M16 11h.01M18 14h.01"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>'
});

/** Pictogrammes vectoriels locaux : pas d’emoji flou ni de requête externe. */
function membershipIcon(kind) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${MEMBERSHIP_ICON_PATHS[kind] || MEMBERSHIP_ICON_PATHS.account}</svg>`;
}
