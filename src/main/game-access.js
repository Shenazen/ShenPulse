"use strict";

function commerceExpiryMs(entry) {
  const numeric = Number(entry?.expiresAtMs || 0);
  if (numeric > 0) return numeric;
  const parsed = Date.parse(
    String(entry?.expiresAt || entry?.renewalDate || "")
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasActiveGameSubscription(state, nowMs = Date.now()) {
  const subscription = state?.commerce?.subscription || {};
  if (!["pro", "premium"].includes(subscription.tier)) return false;
  if (
    subscription.source === "trial" ||
    subscription.status === "trial"
  ) {
    return (
      ["active", "trial"].includes(subscription.status) &&
      commerceExpiryMs(subscription) > nowMs
    );
  }
  return ["active", "paid"].includes(subscription.status);
}

function gameEntitlement(state, pack, nowMs = Date.now()) {
  if (!pack) return null;
  if (pack.accessMode === "included") {
    return {
      gameId: pack.id,
      source: "included",
      status: "active"
    };
  }
  return (
    state?.commerce?.gameEntitlements || []
  ).find((entry) => {
    if (typeof entry === "string") return entry === pack.id;
    if (!entry || entry.gameId !== pack.id) return false;
    const status = String(entry.status || "").trim().toLowerCase();
    const source = String(entry.source || "").trim().toLowerCase();
    if (source === "trial" || status === "trial") {
      return commerceExpiryMs(entry) > nowMs;
    }
    return (
      !status ||
      ["active", "captured", "completed", "paid", "purchased"].includes(
        status
      )
    );
  }) || null;
}

function hasGameEntitlement(state, pack, nowMs = Date.now()) {
  return Boolean(gameEntitlement(state, pack, nowMs));
}

function hasGameAccess(state, pack, nowMs = Date.now()) {
  return (
    hasActiveGameSubscription(state, nowMs) &&
    hasGameEntitlement(state, pack, nowMs)
  );
}

function gameAccessReason(state, pack, nowMs = Date.now()) {
  const missingSubscription = !hasActiveGameSubscription(state, nowMs);
  const missingGame = !hasGameEntitlement(state, pack, nowMs);
  if (missingSubscription && missingGame) {
    return "Un abonnement ShenPulse Pro ou Premium actif et le droit d’accès à ce jeu (achat ou essai) sont requis.";
  }
  if (missingSubscription) {
    return "Un abonnement ShenPulse Pro ou Premium actif est requis pour accéder aux jeux.";
  }
  return "Ce jeu demande aussi un achat ou un essai de jeu actif.";
}

function assertGameAccess(state, pack, nowMs = Date.now()) {
  if (!pack) throw new Error("Ce jeu n’existe plus dans ShenPulse.");
  if (!hasGameAccess(state, pack, nowMs)) {
    throw new Error(gameAccessReason(state, pack, nowMs));
  }
  return pack;
}

module.exports = {
  assertGameAccess,
  commerceExpiryMs,
  gameAccessReason,
  gameEntitlement,
  hasActiveGameSubscription,
  hasGameAccess,
  hasGameEntitlement
};
