"use strict";

function cleanTikTokUsername(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9._]/g, "")
    .toLowerCase()
    .slice(0, 30);
}

function hasActivePaidPremium(subscription = {}) {
  return (
    subscription.tier === "premium" &&
    ["active", "paid"].includes(String(subscription.status || "")) &&
    subscription.source !== "trial"
  );
}

function assignPremiumSeat(state, incoming = {}, now = new Date()) {
  if (!state?.commerce || !hasActivePaidPremium(state.commerce.subscription)) {
    throw new Error(
      "Un abonnement Premium payé et actif est requis pour offrir cet accès Pro."
    );
  }

  const username = cleanTikTokUsername(
    incoming.username || incoming.beneficiaryUsername
  );
  if (!username) {
    throw new Error("Renseignez le @ TikTok de l’utilisateur.");
  }

  const ownerUsername = cleanTikTokUsername(
    state.settings?.tiktok?.username
  );
  if (ownerUsername && username === ownerUsername) {
    throw new Error(
      "Choisissez un autre utilisateur : votre compte possède déjà Premium."
    );
  }

  const timestamp = now.toISOString();
  const previous = state.commerce.premiumSeat || {};
  state.commerce.premiumSeat = {
    beneficiaryUsername: username,
    grantedAt:
      previous.beneficiaryUsername === username && previous.grantedAt
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
  assignPremiumSeat,
  cleanTikTokUsername,
  hasActivePaidPremium
};
