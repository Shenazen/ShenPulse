"use strict";

const { TRIAL_ENTITLEMENT_LEASE_MS } = require("./constants");
const { normalizeEmail, cleanUid, requireGameProductId } = require("./validation");
const { requestJson, invalidSessionError } = require("./http-client");
const { entitlementExpiryMs, mergeEntitlementPayloads, entitlementGameId, activeGameEntitlement, normalizedGameEntitlementStatus, normalizeSubscriptionPendingChange, validEntitlementPayload } = require("./entitlement-payload");

/** Fusionne les deux réponses vérifiées et ne transforme jamais une panne en nouveau droit. */
async function syncEntitlements(service, { silent = false } = {}, flow) {
  // La synchronisation appartient à une connexion précise, pas seulement à
  // un UID : déconnexion/reconnexion du même compte invalide aussi le résultat.
  const uid = cleanUid(flow.session().uid);
  const generation = Number.isSafeInteger(service.sessionGeneration) ? service.sessionGeneration : 0;
  const assertCurrentSession = () => {
    const currentGeneration = Number.isSafeInteger(service.sessionGeneration) ? service.sessionGeneration : 0;
    if (cleanUid(flow.session().uid) !== uid || currentGeneration !== generation) {
      const error = new Error("Le compte ShenPulse a changé pendant la synchronisation des droits.");
      error.code = "ACCOUNT_SESSION_CHANGED";
      error.staleSession = true;
      // Une ancienne réponse ne prouve jamais que le nouveau compte est
      // invalide et ne doit donc pas provoquer sa déconnexion.
      throw error;
    }
  };
  try {
    if (!uid) throw invalidSessionError("Session ShenPulse expirée.");
    const token = await flow.token();
    assertCurrentSession();
    const [accountResult, publicResult] = await Promise.allSettled([
      accountEntitlements(service, token, uid),
      publicEntitlements(service, uid)
    ]);
    assertCurrentSession();
    const accountPayload =
      accountResult.status === "fulfilled"
        ? accountResult.value
        : null;
    const publicPayload =
      publicResult.status === "fulfilled"
        ? publicResult.value
        : null;
    const payload = mergeEntitlementPayloads(
      accountPayload,
      publicPayload
    );
    if (!payload) {
      throw (
        (accountResult.status === "rejected"
          ? accountResult.reason
          : null) ||
        (publicResult.status === "rejected"
          ? publicResult.reason
          : null) ||
        new Error("Impossible de synchroniser les droits ShenPulse.")
      );
    }
    applyEntitlements(service, payload);
    return payload;
  } catch (error) {
    if (silent) return null;
    // Le renouvellement du jeton peut lui-même échouer après un changement
    // de compte. Convertir alors l'ancien refus, sans invalider la session B.
    assertCurrentSession();
    throw error;
  }
}

async function accountEntitlements(service, token, uid) {
  const payload = await requestJson(service,
    `${service.webOrigin}/api/account/entitlements?uid=${encodeURIComponent(
      uid
    )}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000)
    }
  );
  if (!validEntitlementPayload(payload)) {
    throw new Error(
      "Le serveur n’a pas renvoyé les droits privés ShenPulse attendus."
    );
  }
  return payload;
}

async function publicEntitlements(service, uid) {
  const payload = await requestJson(service,
    `${service.webOrigin}/api/entitlements/subscription?uid=${encodeURIComponent(
      uid
    )}`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(15000)
    }
  );
  if (!validEntitlementPayload(payload)) {
    throw new Error(
      "Le serveur n’a pas renvoyé les droits publics ShenPulse attendus."
    );
  }
  return payload;
}

/** Applique uniquement les droits admissibles et conserve le bail limité des essais. */
function applyEntitlements(service, payload = {}) {
  const tier = ["pro", "premium"].includes(payload.tier)
    ? payload.tier
    : "free";
  const source = ["own", "premiumSeat", "trial"].includes(
    payload.source
  )
    ? payload.source
    : "free";
  const trialExpiresAtMs =
    source === "trial"
      ? entitlementExpiryMs(payload) ||
        Date.now() + TRIAL_ENTITLEMENT_LEASE_MS
      : 0;
  const trialExpiresAt = trialExpiresAtMs
    ? new Date(trialExpiresAtMs).toISOString()
    : "";
  const gameEntitlements = Array.isArray(payload.gameEntitlements)
    ? payload.gameEntitlements
        .filter((entry) => activeGameEntitlement(entry))
        .map((entry) => ({
          id: entitlementGameId(entry),
          gameId: String(
            typeof entry === "string"
              ? entry
              : entry?.gameId || entry?.productId || entry?.id || ""
          ).trim(),
          productId: String(
            typeof entry === "string"
              ? entry
              : entry?.productId || entry?.id || ""
          ).trim(),
          source: String(
            typeof entry === "string"
              ? "purchase"
              : entry?.source || "purchase"
          ).trim(),
          status: normalizedGameEntitlementStatus(entry),
          expiresAt: String(
            typeof entry === "string" ? "" : entry?.expiresAt || ""
          ),
          expiresAtMs: Math.max(
            0,
            Number(
              typeof entry === "string" ? 0 : entry?.expiresAtMs
            ) || 0
          )
        }))
        .filter((entry) => /^[a-z0-9][a-z0-9-]{1,159}$/.test(entry.id))
    : [];
  const beneficiaryEmail = normalizeEmail(payload.beneficiaryEmail);
  const beneficiaryEmails = Array.isArray(payload.beneficiaryEmails)
    ? payload.beneficiaryEmails.map(normalizeEmail).filter(Boolean)
    : beneficiaryEmail
      ? [beneficiaryEmail]
      : [];
  service.store.mutate((state) => {
    state.commerce.subscription = {
      tier,
      source,
      status: tier === "free" ? "free" : "active",
      priceMonthly:
        source === "own" ? Math.max(0, Number(payload.priceMonthly) || 0) : 0,
      renewalDate: String(payload.renewalDate || ""),
      pendingChange:
        source === "own"
          ? normalizeSubscriptionPendingChange(payload.pendingChange)
          : null,
      expiresAt: trialExpiresAt,
      expiresAtMs: trialExpiresAtMs,
      syncedAt: String(payload.checkedAt || new Date().toISOString())
    };
    state.commerce.premiumSeat = {
      beneficiaryEmail,
      beneficiaryEmails,
      grantedAt:
        state.commerce.premiumSeat?.beneficiaryEmail ===
          beneficiaryEmail
          ? String(state.commerce.premiumSeat?.grantedAt || "")
          : beneficiaryEmail
            ? new Date().toISOString()
            : "",
      source: "premium",
      status:
        tier === "premium" && source === "own"
          ? beneficiaryEmail
            ? "active"
            : "available"
          : "inactive",
      tier: "pro",
      updatedAt: String(payload.checkedAt || new Date().toISOString())
    };
    state.commerce.gameEntitlements = gameEntitlements;
  }, true);
}

/** Matérialise une capture d'achat confirmée sans créer de doublon de produit. */
function ensureGameEntitlement(service, productId) {
  const id = requireGameProductId(productId);
  service.store.mutate((state) => {
    const current = Array.isArray(state.commerce.gameEntitlements)
      ? state.commerce.gameEntitlements
      : [];
    if (current.some((entry) => entitlementGameId(entry) === id)) return;
    state.commerce.gameEntitlements = [
      ...current,
      {
        expiresAt: "",
        expiresAtMs: 0,
        gameId: id,
        id,
        productId: id,
        source: "purchase",
        status: "active"
      }
    ];
  }, true);
}

/** Retire les droits locaux après une déconnexion explicite ou une nouvelle inscription. */
function clearCommercialRights(service) {
  service.store.mutate((state) => {
    state.commerce.subscription = {
      tier: "free",
      source: "free",
      status: "free",
      priceMonthly: 0,
      renewalDate: "",
      pendingChange: null,
      syncedAt: ""
    };
    state.commerce.premiumSeat = {
      beneficiaryEmail: "",
      beneficiaryEmails: [],
      grantedAt: "",
      source: "premium",
      status: "inactive",
      tier: "pro",
      updatedAt: ""
    };
    state.commerce.gameEntitlements = [];
  }, true);
}

module.exports = { syncEntitlements, applyEntitlements, ensureGameEntitlement, clearCommercialRights };
