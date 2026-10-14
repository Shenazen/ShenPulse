"use strict";

/** Recherche une échéance d'essai parmi les formats historiques supportés. */
function entitlementExpiryMs(payload = {}) {
  const trial =
    payload.trial && typeof payload.trial === "object"
      ? payload.trial
      : {};
  for (const value of [
    payload.expiresAtMs,
    payload.subscriptionExpiresAtMs,
    trial.expiresAtMs,
    payload.expiresAt,
    payload.subscriptionExpiresAt,
    trial.expiresAt
  ]) {
    const numeric = Number(value || 0);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    const parsed = Date.parse(String(value || ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

/** Fusionne les réponses vérifiées sans doublonner les produits ni inventer de droits. */
function mergeEntitlementPayloads(
  accountPayload = null,
  publicPayload = null
) {
  const account =
    accountPayload && typeof accountPayload === "object"
      ? accountPayload
      : null;
  const verifiedPublic =
    publicPayload && typeof publicPayload === "object"
      ? publicPayload
      : null;
  if (!account && !verifiedPublic) return null;

  const publicHasAccess = ["pro", "premium"].includes(
    String(verifiedPublic?.tier || "")
  );
  const accountHasAccess = ["pro", "premium"].includes(
    String(account?.tier || "")
  );
  const primary =
    publicHasAccess && !accountHasAccess
      ? verifiedPublic
      : account || verifiedPublic;
  const gameEntitlements = [];
  const seenGameIds = new Set();
  for (const entry of [
    ...(Array.isArray(account?.gameEntitlements)
      ? account.gameEntitlements
      : []),
    ...(Array.isArray(verifiedPublic?.gameEntitlements)
      ? verifiedPublic.gameEntitlements
      : [])
  ]) {
    const gameId = entitlementGameId(entry);
    if (!gameId || seenGameIds.has(gameId)) continue;
    seenGameIds.add(gameId);
    gameEntitlements.push(entry);
  }

  return {
    ...(account || {}),
    ...(primary || {}),
    checkedAt: String(
      primary?.checkedAt ||
      account?.checkedAt ||
      verifiedPublic?.checkedAt ||
      new Date().toISOString()
    ),
    gameEntitlements
  };
}

/** Identifiant commun aux anciennes entrées texte et aux achats détaillés. */
function entitlementGameId(entry) {
  return String(
    typeof entry === "string"
      ? entry
      : entry?.gameId || entry?.productId || entry?.id || ""
  ).trim();
}

/** Un essai doit rester non expiré ; un achat en attente n'est pas actif. */
function activeGameEntitlement(entry, nowMs = Date.now()) {
  if (typeof entry === "string") return Boolean(entitlementGameId(entry));
  if (!entry || typeof entry !== "object") return false;
  const status = String(entry.status || "").trim().toLowerCase();
  const source = String(entry.source || "").trim().toLowerCase();
  if (source === "trial" || status === "trial") {
    return entitlementExpiryMs(entry) > nowMs;
  }
  return (
    !status ||
    ["active", "captured", "completed", "paid", "purchased"].includes(
      status
    )
  );
}

/** État compatible d'une entrée de droit déjà validée. */
function normalizedGameEntitlementStatus(entry) {
  if (typeof entry === "string") return "active";
  const status = String(entry?.status || "").trim().toLowerCase();
  if (entry?.source === "trial" || status === "trial") return "trial";
  return status || "active";
}

/** Conserve uniquement un changement différé de palier avec échéance valide. */
function normalizeSubscriptionPendingChange(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const targetTier = ["free", "pro", "premium"].includes(
    String(value.targetTier || "")
  )
    ? String(value.targetTier)
    : "";
  const effectiveAt = String(value.effectiveAt || "").trim();
  const effectiveAtMs = Number(value.effectiveAtMs || Date.parse(effectiveAt));
  if (!targetTier || !effectiveAt || !Number.isFinite(effectiveAtMs)) {
    return null;
  }
  return {
    effectiveAt,
    effectiveAtMs,
    fromTier: ["free", "pro", "premium"].includes(
      String(value.fromTier || "")
    )
      ? String(value.fromTier)
      : "free",
    targetTier,
    type: String(value.type || "").trim()
  };
}

/** Vérifie la forme attendue avant toute application de droits locaux. */
function validEntitlementPayload(payload) {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      ["free", "pro", "premium"].includes(String(payload.tier || "")) &&
      Array.isArray(payload.gameEntitlements)
  );
}

module.exports = { entitlementExpiryMs, mergeEntitlementPayloads, entitlementGameId, activeGameEntitlement, normalizedGameEntitlementStatus, normalizeSubscriptionPendingChange, validEntitlementPayload };
