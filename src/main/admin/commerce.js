"use strict";

/** admin : module « commerce », sans initialisation externe au chargement. */
const { THIERCELIEUX_EXTENSION_PRODUCTS } = require("../../shared/thiercelieux-products");
const { normalizeMoney, normalizeCurrency, normalizeDate, cleanKey, normalizeEmail } = require("./validation");

function normalizeCommerceCatalog(value) {
  const candidate = value && typeof value === "object" ? value : {};
  const products = {};
  const subscriptions = {};
  const promotions = {};
  for (const [rawId, raw] of Object.entries(candidate.products || {}).slice(
    0,
    500
  )) {
    const id = cleanKey(rawId);
    if (!id || !raw || typeof raw !== "object") continue;
    const included = raw.accessMode === "included";
    products[id] = {
      accessMode: included ? "included" : "purchase",
      baseAmount: included ? "0.00" : normalizeMoney(raw.baseAmount, "19.99"),
      currency: normalizeCurrency(raw.currency),
      enabled: raw.enabled !== false,
      id,
      sortOrder: Math.trunc(Number(raw.sortOrder) || 0),
      title: String(raw.title || id).trim().slice(0, 120),
      trialEligible: Boolean(raw.trialEligible)
    };
  }
  for (const product of THIERCELIEUX_EXTENSION_PRODUCTS) {
    const current = products[product.id] || {};
    products[product.id] = {
      accessMode: "purchase",
      baseAmount: product.price.toFixed(2),
      currency: product.currency,
      enabled: current.enabled !== false,
      id: product.id,
      sortOrder: Number(current.sortOrder || 500),
      title: product.name,
      trialEligible: false
    };
  }
  for (const tier of ["pro", "premium"]) {
    const raw = candidate.subscriptions?.[tier];
    if (!raw || typeof raw !== "object") continue;
    subscriptions[tier] = {
      currency: normalizeCurrency(raw.currency),
      enabled: raw.enabled !== false,
      priceMonthly: normalizeMoney(
        raw.priceMonthly,
        tier === "premium" ? "13.99" : "9.99"
      ),
      sortOrder: Math.trunc(Number(raw.sortOrder) || 0),
      tier,
      title: String(raw.title || tier).trim().slice(0, 80)
    };
  }
  for (const [rawId, raw] of Object.entries(candidate.promotions || {}).slice(
    0,
    100
  )) {
    const id = cleanKey(rawId);
    if (!id || !raw || typeof raw !== "object") continue;
    promotions[id] = {
      enabled: raw.enabled !== false,
      endsAt: normalizeDate(raw.endsAt),
      id,
      productIds: Array.from(
        new Set(
          (Array.isArray(raw.productIds) ? raw.productIds : [])
            .map(cleanKey)
            .filter((productId) => products[productId])
        )
      ).slice(0, 500),
      startsAt: normalizeDate(raw.startsAt),
      title: String(raw.title || "Promotion").trim().slice(0, 120),
      type: raw.type === "fixed" ? "fixed" : "percent",
      value: Math.max(0.01, Math.min(100000, Number(raw.value) || 0.01))
    };
  }
  return {
    schemaVersion: Math.max(1, Math.min(100, Number(candidate.schemaVersion) || 1)),
    products,
    promotions,
    subscriptions,
    updatedAt: String(candidate.updatedAt || ""),
    updatedByEmail: String(candidate.updatedByEmail || ""),
    updatedByUid: String(candidate.updatedByUid || "")
  };
}

function normalizeCommerceState(value) {
  const candidate = value && typeof value === "object" ? value : {};
  const catalog = normalizeCommerceCatalog(candidate.catalog || {});
  const channels = {};
  for (const channel of ["draft", "prod", "test"]) {
    channels[channel] = normalizeCommerceCatalog(
      candidate.channels?.[channel] || catalog
    );
  }
  return {
    ...candidate,
    catalog,
    channels
  };
}

function normalizeTrialRequest(value, ownerId) {
  const email = normalizeEmail(
    value.email || value.beneficiaryEmail || value.recipientEmail
  );
  const games = Boolean(value.games);
  const subscription = value.subscription === true || value.subscription === "true";
  const subscriptionTier = subscription ? String(value.subscriptionTier || "pro") : "";
  const countsForAgency = value.countsForAgency === true || value.countsForAgency === "true";
  if (subscription && !["pro", "premium"].includes(subscriptionTier)) {
    throw new Error("Choisissez un accès Pro ou Premium.");
  }
  if (countsForAgency && !subscription) {
    throw new Error("Le comptage agence nécessite un essai Pro ou Premium.");
  }
  if (!email) {
    throw new Error(
      "Renseignez l’adresse e-mail du compte ShenPulse bénéficiaire."
    );
  }
  if (!games && !subscription) {
    throw new Error("Choisissez un accès Pro, Premium ou des jeux.");
  }
  const gameIds = Array.from(
    new Set(
      (Array.isArray(value.gameIds) ? value.gameIds : [])
        .map(cleanKey)
        .filter(Boolean)
    )
  ).slice(0, 200);
  const result = {
    days: Math.max(1, Math.min(365, Math.trunc(Number(value.days) || 7))),
    games,
    ownerId,
    subscription,
    subscriptionTier,
    countsForAgency,
    email,
    beneficiaryEmail: email
  };
  if (games && gameIds.length) result.gameIds = gameIds;
  return result;
}

function commerceStateFromPublicConfig(value) {
  const payload = value && typeof value === "object" ? value : {};
  const products = {};
  const promotions = {};
  for (const [rawId, raw] of Object.entries(payload.games || {}).slice(0, 500)) {
    const id = cleanKey(rawId);
    if (!id || !raw || typeof raw !== "object") continue;
    products[id] = {
      accessMode: raw.accessMode === "included" ? "included" : "purchase",
      baseAmount: normalizeMoney(
        raw.baseAmount ?? raw.amount,
        raw.accessMode === "included" ? "0.00" : "19.99"
      ),
      currency: normalizeCurrency(raw.currency || payload.currency),
      enabled: raw.enabled !== false,
      id,
      sortOrder: Math.trunc(Number(raw.sortOrder) || 0),
      title: String(raw.title || id).trim().slice(0, 120),
      trialEligible: Boolean(raw.trialEligible)
    };
    const promotion = raw.promotion;
    const promotionId = cleanKey(promotion?.id);
    if (promotionId && !promotions[promotionId]) {
      promotions[promotionId] = {
        enabled: true,
        endsAt: "",
        id: promotionId,
        productIds: [],
        startsAt: "",
        title: String(promotion.title || "Promotion").trim().slice(0, 120),
        type: promotion.type === "fixed" ? "fixed" : "percent",
        value: Math.max(0.01, Number(promotion.value) || 0.01)
      };
    }
    if (promotionId) promotions[promotionId].productIds.push(id);
  }
  const subscriptions = {};
  for (const tier of ["pro", "premium"]) {
    const raw = payload.plans?.[tier];
    if (!raw || typeof raw !== "object") continue;
    subscriptions[tier] = {
      currency: normalizeCurrency(raw.currency || payload.currency),
      enabled: raw.enabled !== false,
      priceMonthly: normalizeMoney(
        raw.priceMonthly,
        tier === "premium" ? "13.99" : "9.99"
      ),
      sortOrder: tier === "premium" ? 20 : 10,
      tier,
      title: String(raw.title || tier).trim().slice(0, 80)
    };
  }
  const catalog = normalizeCommerceCatalog({
    schemaVersion: 1,
    products,
    promotions,
    subscriptions
  });
  return {
    catalog,
    channels: { draft: catalog, prod: catalog, test: catalog },
    fallback: true,
    history: [],
    ok: false
  };
}

function emptyCommerceState() {
  const catalog = normalizeCommerceCatalog({});
  return {
    catalog,
    channels: { draft: catalog, prod: catalog, test: catalog },
    fallback: true,
    history: [],
    ok: false
  };
}

module.exports = { normalizeCommerceCatalog, normalizeCommerceState, normalizeTrialRequest, commerceStateFromPublicConfig, emptyCommerceState };

