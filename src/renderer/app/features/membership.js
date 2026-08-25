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
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function renderMembership() {
  const subscription = currentSubscription();
  const activeSubscriptionTier = hasProAccess()
    ? subscription.tier
    : "free";
  const paidSubscriptionTier =
    subscription.source === "own" &&
    ["active", "paid"].includes(String(subscription.status || ""))
      ? subscription.tier
      : "";
  const pendingStop = paidSubscriptionTier
    ? pendingSubscriptionStop(subscription)
    : null;
  const pendingStopDate = membershipDateLabel(
    pendingStop?.effectiveAt || subscription.renewalDate
  );
  const paidPlanName =
    SUBSCRIPTION_PLANS.find((plan) => plan.tier === paidSubscriptionTier)
      ?.name || paidSubscriptionTier;
  const membershipSummary =
    subscription.source === "trial"
      ? `${subscription.tier} · essai`
      : subscription.source === "premiumSeat"
        ? `${subscription.tier} · offert`
        : activeSubscriptionTier;
  const membershipPlanLabel = (plan) => {
    if (activeSubscriptionTier !== plan.tier) {
      return plan.tier === "free" ? "OFFRE GRATUITE" : "OFFRE MENSUELLE";
    }
    if (plan.tier === "free") return "OFFRE ACTUELLE";
    if (paidSubscriptionTier === plan.tier) return "ABONNEMENT ACTUEL";
    if (subscription.source === "trial") return "ESSAI ACTIF";
    if (subscription.source === "premiumSeat") return "ACCÈS PRO OFFERT";
    return "ACCÈS ACTUEL";
  };
  const premiumBeneficiary =
    snapshot.state.commerce?.premiumSeat?.beneficiaryEmail || "";
  const paidGames = visibleGamePacks().filter(
    (pack) => pack.accessMode === "purchase"
  );
  return `
    <div class="reference-page membership-page">
      <section class="page-hero compact">
        <div><span class="hero-chip">ACCÈS SHENPULSE</span><h2>Tarifs & abonnements</h2><p>Les droits sont synchronisés par le compte ShenPulse. Premium comprend toujours l’intégralité de Pro.</p></div>
        <span class="membership-current">${escapeHtml(membershipSummary || "free")}</span>
      </section>
      ${pendingStop ? `
        <section class="studio-panel commerce-note panel-pink membership-stop-notice">
          <div><span class="panel-accent"></span><div><h3>Arrêt programmé</h3><p>Votre abonnement ${escapeHtml(paidPlanName)} s’arrêtera le <strong>${escapeHtml(pendingStopDate || "dernier jour de la période payée")}</strong>. Il reste actif avec tous ses avantages jusqu’à cette date.</p></div></div>
          <span class="badge warning">RENOUVELLEMENT ARRÊTÉ</span>
        </section>
      ` : ""}
      <div class="subscription-grid">
        ${SUBSCRIPTION_PLANS.map((plan) => `
          <article class="subscription-card ${activeSubscriptionTier === plan.tier ? "current" : ""} ${plan.tier === "premium" ? "premium" : ""}" ${activeSubscriptionTier === plan.tier ? 'aria-current="true"' : ""}>
            <header><span>${plan.tier === "premium" ? "♛" : plan.tier === "pro" ? "◆" : "○"}</span><div><small>${membershipPlanLabel(plan)}</small><h3>${plan.name}</h3></div></header>
            <strong>${plan.price === 0 ? "Gratuit" : `${plan.price.toFixed(2).replace(".", ",")} €`}<small>${plan.price ? " / mois" : ""}</small></strong>
            <p>${plan.description}</p>
            <ul>${plan.features.map((feature) => `<li>✓ ${feature}</li>`).join("")}</ul>
            ${activeSubscriptionTier === plan.tier && plan.tier !== "free"
              ? `<button class="button" type="button" disabled>Offre active</button>`
              : plan.tier === "free"
                ? paidSubscriptionTier
                  ? pendingStop
                    ? `<button class="button" type="button" disabled>Arrêt programmé</button>`
                    : subscriptionStopBusy
                      ? `<button class="button danger" type="button" disabled>Arrêt en cours…</button>`
                      : `<button class="button danger" type="button" data-action="subscription-stop">Arrêter l’abonnement</button>`
                  : `<button class="button" type="button" disabled>${activeSubscriptionTier === "free" ? "Offre active" : "Offre gratuite"}</button>`
                : subscriptionCheckoutBusyTier === plan.tier
                  ? `<button class="button primary" type="button" data-action="subscription-checkout-cancel" data-tier="${escapeHtml(plan.tier)}">Annuler PayPal</button>`
                  : `<button class="button primary" type="button" data-action="subscription-checkout" data-tier="${escapeHtml(plan.tier)}" ${subscriptionCheckoutBusyTier ? "disabled" : ""}>Choisir ${plan.name}</button>`}
          </article>`).join("")}
      </div>
      ${hasActivePaidPremium() ? `
        <section class="premium-seat-panel">
          <div class="premium-seat-copy">
            <span class="premium-seat-icon" aria-hidden="true">♛</span>
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
              <span aria-hidden="true">✉</span>
              <input id="premium-beneficiary-email" name="beneficiaryEmail" value="${escapeHtml(premiumBeneficiary)}" type="email" required maxlength="254" placeholder="utilisateur@exemple.fr" autocomplete="email" autocapitalize="none" spellcheck="false">
              <button class="button primary" type="submit">Offrir l’accès Pro</button>
            </div>
            <small>Un seul compte peut bénéficier de cet accès. Le bénéficiaire devra se connecter avec exactement cette adresse e-mail.</small>
          </form>
        </section>
      ` : ""}
      <section class="studio-panel commerce-note panel-cyan">
        <div><span class="panel-accent"></span><div><h3>Accès aux jeux</h3><p>Le catalogue est visible avec l’offre Free, mais l’entrée dans tous les jeux exige un abonnement Pro ou Premium actif. Premium comprend toujours tous les droits Pro.</p></div></div>
        <span class="badge success">PREMIUM = PRO + PREMIUM</span>
      </section>
      <section class="commerce-games">
        <header><div><h3>Jeux vendus séparément</h3><p>Ces jeux demandent à la fois un abonnement Pro ou Premium actif et l’achat du jeu, ou un essai de jeu actif.</p></div><span>${paidGames.length} jeux</span></header>
        <div>
          ${paidGames.map((pack) => `<article><img src="${escapeHtml(gameArtwork(pack))}" alt=""><div><strong>${escapeHtml(pack.name)}</strong><small>ABONNEMENT + ACHAT UNIQUE</small></div><b>${escapeHtml(gamePrice(pack))}</b></article>`).join("")}
        </div>
      </section>
    </div>`;
}
