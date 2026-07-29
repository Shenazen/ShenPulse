"use strict";

const { normalizeEmail, requireEmail } = require("./account-service");

function hasActivePaidPremium(subscription = {}) {
  return (
    subscription.tier === "premium" &&
    ["active", "paid"].includes(String(subscription.status || "")) &&
    subscription.source !== "trial"
  );
}

/**
 * Applique uniquement une réponse déjà vérifiée par le serveur.
 * L’attribution réelle est effectuée par /api/payments/premium-seat avec le
 * jeton Firebase du propriétaire Premium.
 */
function applyVerifiedPremiumSeat(
  state,
  incoming = {},
  now = new Date()
) {
  if (!state?.commerce || !hasActivePaidPremium(state.commerce.subscription)) {
    throw new Error(
      "Un abonnement Premium payé et actif est requis pour offrir cet accès Pro."
    );
  }
  const beneficiaryEmail = requireEmail(
    incoming.beneficiaryEmail || incoming.email
  );
  const ownerEmail = normalizeEmail(state.settings?.account?.email);
  if (ownerEmail && beneficiaryEmail === ownerEmail) {
    throw new Error(
      "Choisissez un autre compte : le propriétaire possède déjà Premium."
    );
  }
  const timestamp = now.toISOString();
  const previous = state.commerce.premiumSeat || {};
  state.commerce.premiumSeat = {
    beneficiaryEmail,
    beneficiaryEmails: [beneficiaryEmail],
    grantedAt:
      previous.beneficiaryEmail === beneficiaryEmail &&
      previous.grantedAt
        ? previous.grantedAt
        : timestamp,
    source: "premium",
    status: "active",
    tier: "pro",
    updatedAt: timestamp
  };
  return state.commerce.premiumSeat;
}

module.exports = {
  applyVerifiedPremiumSeat,
  hasActivePaidPremium
};
