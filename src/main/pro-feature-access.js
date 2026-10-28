"use strict";

/** Droits Pro côté processus principal, communs aux IPC et aux effets LIVE.
 * Le palier commercial ne remplace jamais une restriction de visibilité.
 * Les gardes asynchrones relisent les droits avant chaque nouvel effet et
 * annulent une opération si le compte ou le profil a changé entre-temps.
 */
const { hasSectionAccess, requiredSectionTier, requiresProSection } = require("../shared/pro-access");
const visibility = require("../shared/visibility-catalog");
const { assertAuthenticatedAccount, ADMIN_OWNER_EMAIL } = require("./account-access");
const { readState } = require("./state-projection");

const PRO_ACCESS_PATHS = Object.freeze(["commerce.subscription", "settings.account", "settings.siteVisibility", "session.profileId"]);

function accessError(message, code = "PRO_FEATURE_REQUIRED") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isVerifiedAdmin(state) {
  const account = state.settings?.account || {};
  return account.emailVerified === true && String(account.email || "").trim().toLowerCase() === ADMIN_OWNER_EMAIL;
}

function scopeAllowed(state, section, id) {
  return visibility.canAccessScope(visibility.scopeFor(state.settings?.siteVisibility, section, id), isVerifiedAdmin(state));
}

function proFeatureAllowed(state, section, nowMs = Date.now()) {
  if (requiresProSection(section) && !hasSectionAccess(state, section, nowMs)) return false;
  if (!scopeAllowed(state, "navigation", section)) return false;
  if (section !== "irl") return true;
  const overrides = state.settings?.siteVisibility?.actionTypeOverrides || {};
  return scopeAllowed(state, "features", "irl.shelly") && scopeAllowed(state, "actionTypes", "irl.shelly") &&
    overrides[visibility.storageKey("irl.shelly")] !== false && overrides["irl.shelly"] !== false;
}

function assertProFeatureState(state, section, nowMs = Date.now()) {
  if (requiresProSection(section) && !hasSectionAccess(state, section, nowMs)) {
    const premium = requiredSectionTier(section) === "premium";
    throw accessError(premium ? "Machines IRL nécessite un abonnement ShenPulse Premium actif." : "Cette fonctionnalité nécessite au moins un abonnement ShenPulse Pro actif.", premium ? "PREMIUM_FEATURE_REQUIRED" : "PRO_FEATURE_REQUIRED");
  }
  if (!proFeatureAllowed(state, section, nowMs)) {
    throw accessError("Cette fonctionnalité est désactivée ou réservée par l’administrateur.", "FEATURE_ACCESS_FORBIDDEN");
  }
  return state;
}

function assertProFeatureAccess(store, section, { authenticated = true } = {}) {
  if (authenticated) assertAuthenticatedAccount(store);
  return assertProFeatureState(readState(store, PRO_ACCESS_PATHS), section);
}

/** Retourne une assertion, pas un snapshot conservant les autres profils. */
function createProFeatureGuard(store, section, { authenticated = true, shouldExecute, assertAdditional } = {}) {
  const initial = assertProFeatureAccess(store, section, { authenticated });
  const identity = (state) => JSON.stringify([state.settings?.account?.uid || "", state.session?.profileId || ""]);
  const initialIdentity = identity(initial);
  return () => {
    if (typeof shouldExecute === "function" && !shouldExecute()) {
      throw accessError("Le contexte LIVE de la commande a changé.", "COMMAND_CONTEXT_CHANGED");
    }
    const fresh = assertProFeatureAccess(store, section, { authenticated });
    if (initialIdentity !== identity(fresh)) {
      throw accessError("Le compte ou le profil de cette opération a changé.", "FEATURE_CONTEXT_CHANGED");
    }
    assertAdditional?.(fresh);
    return true;
  };
}

module.exports = { PRO_ACCESS_PATHS, proFeatureAllowed, assertProFeatureState, assertProFeatureAccess, createProFeatureGuard };
