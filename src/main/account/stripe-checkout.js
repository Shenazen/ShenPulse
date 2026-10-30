"use strict";
const crypto = require("node:crypto");
const { setTimeout: delay } = require("node:timers/promises");
const { BROWSER_AUTH_TIMEOUT_MS } = require("./constants");
const { createPaymentLoopbackCallback } = require("./payment-loopback");
const { requireGameProductId, requireSubscriptionTier, cleanUid, withoutApprovalUrl } = require("./validation");
const { requestJson, invalidSessionError } = require("./http-client");

function stripeApprovalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
        !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname)) throw new Error();
    return url.href;
  } catch { throw new Error("Le lien de paiement reçu ne pointe pas vers Stripe."); }
}

/** L'identité et les accès sont vérifiés par le serveur ; le retour navigateur ne fait pas foi. */
async function runStripeCheckout(service, incoming, flow, kind) {
  const productId = kind === "game" ? requireGameProductId(incoming.productId) : "";
  const tier = kind === "subscription" ? requireSubscriptionTier(incoming.tier) : "";
  const token = await flow.token();
  await flow.synchronizeIdentity(token);
  flow.assertCurrent();
  const uid = cleanUid(flow.session().uid);
  if (!uid) throw invalidSessionError("Session ShenPulse expirée.");
  if (typeof service.openExternal !== "function") throw new Error("L’ouverture du paiement est indisponible.");
  const state = crypto.randomBytes(32).toString("base64url");
  const callback = await createPaymentLoopbackCallback({ state, timeoutMs: BROWSER_AUTH_TIMEOUT_MS });
  const cancelProperty = kind === "game" ? "gameCheckoutCancel" : "subscriptionCheckoutCancel";
  let cancelledBeforeOpen = false;
  const cancel = () => { cancelledBeforeOpen = true; return callback.cancel(); };
  service[cancelProperty] = cancel;
  const post = async (route, body) => {
    const freshToken = await flow.token();
    flow.assertCurrent();
    const result = await requestJson(service, `${service.webOrigin}/api/payments/stripe/${route}`, {
      method: "POST", headers: { Authorization: `Bearer ${freshToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, ownerId: uid }), signal: AbortSignal.timeout(25000)
    });
    flow.assertCurrent();
    return result;
  };
  let payload;
  const finishConfirmedCheckout = async (result, checkoutOpened) => {
    await service.syncEntitlements(); flow.assertCurrent();
    if (result.pending) throw new Error("Votre paiement est en cours de vérification. Vos accès seront synchronisés après confirmation.");
    if (kind === "game") flow.ensureGameEntitlement(productId);
    return { ...withoutApprovalUrl(payload), ...result, ...(result.checkoutCompleted ? { cancelled: false } : {}), checkoutOpened };
  };
  try {
    flow.assertCurrent();
    payload = await post("checkout", { kind, productId, tier,
      ...(["card", "google_pay", "apple_pay", "link"].includes(incoming.paymentMethod) ? { paymentMethod: incoming.paymentMethod } : {}),
      ...(incoming.expectedPrice != null ? { expectedPrice: Number(incoming.expectedPrice) } : {}),
      requestId: crypto.randomUUID(), desktopCallbackPort: callback.port, desktopCallbackState: state });
    if (payload.alreadyPurchased || payload.alreadyActive) {
      await service.syncEntitlements(); flow.assertCurrent();
      if (payload.alreadyPurchased) flow.ensureGameEntitlement(productId);
      return { ...withoutApprovalUrl(payload), checkoutOpened: false };
    }
    const approvalUrl = stripeApprovalUrl(payload.approvalUrl);
    if (cancelledBeforeOpen) {
      const abandoned = !payload.portal ? await post("abandon", { sessionId: payload.id }) : null;
      if (abandoned?.checkoutCompleted) return await finishConfirmedCheckout(abandoned, false);
      return { ...withoutApprovalUrl(payload), checkoutOpened: false, cancelled: true };
    }
    await service.openExternal(approvalUrl);
    const browser = await callback.result;
    flow.assertCurrent();
    if (browser.cancelled) {
      const abandoned = !payload.portal ? await post("abandon", { sessionId: payload.id }) : null;
      if (abandoned?.checkoutCompleted) return await finishConfirmedCheckout(abandoned, true);
      return { ...withoutApprovalUrl(payload), checkoutOpened: true, cancelled: true };
    }
    if (browser.sessionId && !payload.portal && browser.sessionId !== payload.id) throw new Error("Le retour Stripe ne correspond pas au paiement lancé.");
    let result;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      result = await post("sync", { sessionId: payload.id, portal: payload.portal === true });
      if (!result.pending) break;
      await delay(500); flow.assertCurrent();
    }
    return await finishConfirmedCheckout(result, true);
  } finally {
    if (service[cancelProperty] === cancel) service[cancelProperty] = null;
    callback.close();
  }
}
module.exports = { runStripeCheckout, stripeApprovalUrl };
