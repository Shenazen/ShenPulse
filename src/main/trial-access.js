"use strict";

function normalizeTrialEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email.slice(0, 254)
    : "";
}

function trialExpiryMs(trial) {
  const numeric = Number(trial?.expiresAtMs || 0);
  if (numeric > 0) return numeric;
  const parsed = Date.parse(String(trial?.expiresAt || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function activeTrial(trial, email, nowMs = Date.now()) {
  if (!trial || typeof trial !== "object") return false;
  if (
    normalizeTrialEmail(
      trial.email ||
      trial.beneficiaryEmail ||
      trial.grantedToEmail
    ) !== email
  ) {
    return false;
  }
  if (trial.revoked === true || trial.status === "revoked") return false;
  const expiresAtMs = trialExpiryMs(trial);
  return expiresAtMs > nowMs;
}

function normalizeTrialGrant(trial) {
  const source = trial?.trial && typeof trial.trial === "object"
    ? trial.trial
    : trial;
  const gameTrialIds = Array.from(
    new Set(
      (Array.isArray(source?.gameTrialIds) ? source.gameTrialIds : [])
        .map((gameId) => String(gameId || "").trim())
        .filter(Boolean)
    )
  ).slice(0, 500);
  return {
    id: String(source?.id || source?.trialId || "").slice(0, 240),
    email: normalizeTrialEmail(
      source?.email ||
      source?.beneficiaryEmail ||
      source?.grantedToEmail
    ),
    subscriptionTrial: Boolean(source?.subscriptionTrial),
    gameTrialIds,
    startsAt: String(source?.startsAt || ""),
    startsAtMs: Number(source?.startsAtMs || 0),
    expiresAt: String(source?.expiresAt || ""),
    expiresAtMs: trialExpiryMs(source),
    pending: Boolean(source?.pending),
    revoked: Boolean(source?.revoked),
    source: "trial",
    status: String(source?.status || "active")
  };
}

function reconcileTrialAccess(state, incomingTrials, nowMs = Date.now()) {
  const email = normalizeTrialEmail(state?.settings?.account?.email);
  if (!state?.commerce) return false;
  const cachedGrants = (Array.isArray(incomingTrials) ? incomingTrials : [])
    .map(normalizeTrialGrant)
    .filter(
      (trial) =>
        trial.email &&
        trial.revoked !== true &&
        trial.status !== "revoked" &&
        trial.expiresAtMs > nowMs
    );
  const trials = cachedGrants
    .filter((trial) => activeTrial(trial, email, nowMs))
    .map(normalizeTrialGrant);
  const gameExpires = new Map();
  let subscriptionExpiresAtMs = 0;
  for (const trial of trials) {
    if (trial.subscriptionTrial) {
      subscriptionExpiresAtMs = Math.max(
        subscriptionExpiresAtMs,
        trial.expiresAtMs
      );
    }
    for (const gameId of trial.gameTrialIds) {
      gameExpires.set(
        gameId,
        Math.max(gameExpires.get(gameId) || 0, trial.expiresAtMs)
      );
    }
  }

  const permanentEntitlements = (
    Array.isArray(state.commerce.gameEntitlements)
      ? state.commerce.gameEntitlements
      : []
  ).filter(
    (entry) =>
      typeof entry === "string" ||
      (entry && entry.source !== "trial" && entry.status !== "trial")
  );
  const trialEntitlements = [...gameExpires.entries()].map(
    ([gameId, expiresAtMs]) => ({
      gameId,
      source: "trial",
      status: "active",
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs
    })
  );
  state.commerce.gameEntitlements = [
    ...permanentEntitlements,
    ...trialEntitlements
  ];

  const currentSubscription = state.commerce.subscription || {};
  const currentTier = String(currentSubscription.tier || "free");
  const hasPermanentPaidSubscription =
    ["pro", "premium"].includes(currentTier) &&
    currentSubscription.source !== "trial";
  if (!hasPermanentPaidSubscription) {
    state.commerce.subscription = subscriptionExpiresAtMs > nowMs
      ? {
          tier: "pro",
          source: "trial",
          status: "active",
          priceMonthly: 0,
          renewalDate: new Date(subscriptionExpiresAtMs).toISOString(),
          expiresAt: new Date(subscriptionExpiresAtMs).toISOString(),
          expiresAtMs: subscriptionExpiresAtMs
        }
      : {
          tier: "free",
          source: "free",
          status: "free",
          priceMonthly: 0,
          renewalDate: ""
        };
  }

  state.commerce.trial = {
    email,
    active: trials.length > 0,
    subscription: subscriptionExpiresAtMs > nowMs,
    subscriptionExpiresAtMs,
    gameIds: [...gameExpires.keys()],
    grants: trials,
    cachedGrants,
    syncedAt: new Date(nowMs).toISOString()
  };
  return true;
}

function applyTrialDashboard(store, dashboard, nowMs = Date.now()) {
  if (dashboard?.errors?.trials) return false;
  const trials = Array.isArray(dashboard?.trials?.trials)
    ? dashboard.trials.trials
    : Array.isArray(dashboard?.trials)
      ? dashboard.trials
      : [];
  let changed = false;
  store.mutate((state) => {
    changed = reconcileTrialAccess(state, trials, nowMs);
  }, true);
  return changed;
}

function applyTrialGrant(store, grant, nowMs = Date.now()) {
  const state = store.getState();
  const currentGrants = Array.isArray(state.commerce?.trial?.cachedGrants)
    ? state.commerce.trial.cachedGrants
    : Array.isArray(state.commerce?.trial?.grants)
      ? state.commerce.trial.grants
    : [];
  const nextGrant = normalizeTrialGrant(grant);
  const grants = [
    ...currentGrants.filter(
      (entry) =>
        !nextGrant.id ||
        String(entry.id || "") !== nextGrant.id
    ),
    nextGrant
  ];
  let changed = false;
  store.mutate((nextState) => {
    changed = reconcileTrialAccess(nextState, grants, nowMs);
  }, true);
  return changed;
}

function applyTrialRevocation(store, revocation, nowMs = Date.now()) {
  const state = store.getState();
  const revokedId = String(
    revocation?.trialId || revocation?.id || ""
  );
  const currentGrants = Array.isArray(state.commerce?.trial?.cachedGrants)
    ? state.commerce.trial.cachedGrants
    : Array.isArray(state.commerce?.trial?.grants)
      ? state.commerce.trial.grants
    : [];
  const grants = currentGrants.filter(
    (entry) => !revokedId || String(entry.id || "") !== revokedId
  );
  let changed = false;
  store.mutate((nextState) => {
    changed = reconcileTrialAccess(nextState, grants, nowMs);
  }, true);
  return changed;
}

function activeGameEntitlement(entry, gameId, nowMs = Date.now()) {
  if (typeof entry === "string") return entry === gameId;
  if (!entry || entry.gameId !== gameId) return false;
  if (entry.source !== "trial" && entry.status !== "trial") return true;
  const expiresAtMs =
    Number(entry.expiresAtMs || 0) ||
    Date.parse(String(entry.expiresAt || ""));
  return Number.isFinite(expiresAtMs) && expiresAtMs > nowMs;
}

module.exports = {
  activeGameEntitlement,
  applyTrialDashboard,
  applyTrialGrant,
  applyTrialRevocation,
  normalizeTrialEmail,
  normalizeTrialGrant,
  reconcileTrialAccess
};
