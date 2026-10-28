"use strict";

/** Contrat commercial partagé, sans réseau ni mutation.
 * Un essai expiré ne devient jamais un abonnement payé. Les droits d'achat
 * de jeux restent séparés de ce droit d'accès aux fonctions Pro.
 */
(function exposeProAccess(root, factory) {
  const contract = factory();
  if (typeof module === "object" && module.exports) module.exports = contract;
  if (root) root.ShenPulseProAccess = contract;
})(typeof globalThis === "object" ? globalThis : this, () => {
  const PRO_SECTIONS = Object.freeze(["games", "irl", "commands", "matches"]);

  function commerceExpiryMs(entry) {
    const numeric = Number(entry?.expiresAtMs || 0);
    if (numeric > 0) return numeric;
    const parsed = Date.parse(String(entry?.expiresAt || entry?.renewalDate || ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function hasProAccess(state, nowMs = Date.now()) {
    const subscription = state?.commerce?.subscription || {};
    if (!["pro", "premium"].includes(subscription.tier)) return false;
    if (subscription.source === "agencyReward") {
      return subscription.tier === "pro" && subscription.status === "active" && commerceExpiryMs(subscription) > nowMs;
    }
    if (subscription.source === "trial" || subscription.status === "trial") {
      return ["active", "trial"].includes(subscription.status) && commerceExpiryMs(subscription) > nowMs;
    }
    return ["active", "paid"].includes(subscription.status);
  }

  function requiresProSection(id) { return PRO_SECTIONS.includes(String(id || "")); }

  return Object.freeze({ hasProAccess, commerceExpiryMs, PRO_SECTIONS, requiresProSection });
});
