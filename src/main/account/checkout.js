"use strict";

const crypto = require("node:crypto");
const { BROWSER_AUTH_TIMEOUT_MS } = require("./constants");
const { createPaymentLoopbackCallback } = require("./payment-loopback");
const { requireGameProductId, requireSubscriptionTier, cleanUid, paypalApprovalUrl, withoutApprovalUrl } = require("./validation");
const { requestJson, invalidSessionError } = require("./http-client");

/** Achat de jeu : identité, ordre, retour local vérifié puis capture ; nettoyage dans tous les cas. */
async function runGameCheckout(service, incoming = {}, flow) {
  const productId = requireGameProductId(incoming.productId);
  const token = await flow.token();
  await flow.synchronizeIdentity(token);
  const session = flow.session();
  const uid = cleanUid(session.uid);
  if (!uid) throw invalidSessionError("Session ShenPulse expirée.");
  if (typeof service.openExternal !== "function") {
    throw new Error(
      "L’ouverture de PayPal n’est pas disponible dans cette version de ShenPulse."
    );
  }

  const state = crypto.randomBytes(32).toString("base64url");
  const callback = await createPaymentLoopbackCallback({
    state,
    timeoutMs: BROWSER_AUTH_TIMEOUT_MS
  });
  service.gameCheckoutCancel = callback.cancel;

  try {
    const createPayload = await requestJson(service,
      `${service.webOrigin}/api/payments/orders/create`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          desktopCallbackPort: callback.port,
          desktopCallbackState: state,
          ownerId: uid,
          productId,
          requestId: crypto.randomUUID()
        }),
        signal: AbortSignal.timeout(25000)
      }
    );
    if (createPayload.alreadyPurchased) {
      await service.syncEntitlements({ silent: true });
      flow.ensureGameEntitlement(productId);
      return {
        ...withoutApprovalUrl(createPayload),
        alreadyPurchased: true,
        checkoutOpened: false,
        productId
      };
    }

    const approvalUrl = paypalApprovalUrl(createPayload.approvalUrl);
    if (!approvalUrl) {
      throw new Error("PayPal n’a pas renvoyé de lien d’achat.");
    }

    await service.openExternal(approvalUrl);
    const browserResult = await callback.result;
    if (browserResult.cancelled) {
      return {
        ...withoutApprovalUrl(createPayload),
        cancelled: true,
        checkoutOpened: true,
        productId
      };
    }

    const returnedOrderId = String(browserResult.token || "").trim();
    const createdOrderId = String(createPayload.id || "").trim();
    if (
      returnedOrderId &&
      createdOrderId &&
      returnedOrderId !== createdOrderId
    ) {
      throw new Error(
        "Le retour PayPal ne correspond pas à l’achat lancé."
      );
    }
    const orderId = returnedOrderId || createdOrderId;
    if (!orderId) {
      throw new Error(
        "PayPal n’a pas renvoyé l’identifiant de la commande."
      );
    }

    const capturePayload = await requestJson(service,
      `${service.webOrigin}/api/payments/orders/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orderId,
          ownerId: uid,
          productId,
          token: orderId
        }),
        signal: AbortSignal.timeout(25000)
      }
    );
    const purchasedProductId = requireGameProductId(
      capturePayload.productId || productId
    );
    await service.syncEntitlements({ silent: true });
    flow.ensureGameEntitlement(purchasedProductId);

    return {
      ...withoutApprovalUrl(createPayload),
      ...withoutApprovalUrl(capturePayload),
      checkoutCompleted: true,
      checkoutOpened: true,
      orderId,
      productId: purchasedProductId
    };
  } finally {
    if (service.gameCheckoutCancel === callback.cancel) {
      service.gameCheckoutCancel = null;
    }
    callback.close();
  }
}

/** Abonnement et prorata : conserve les confirmations et l'annulation de chaque étape PayPal. */
async function runSubscriptionCheckout(service, incoming = {}, flow) {
  const tier = requireSubscriptionTier(incoming.tier);
  const token = await flow.token();
  await flow.synchronizeIdentity(token);
  const session = flow.session();
  const uid = cleanUid(session.uid);
  if (!uid) throw invalidSessionError("Session ShenPulse expirée.");
  if (typeof service.openExternal !== "function") {
    throw new Error(
      "L’ouverture de PayPal n’est pas disponible dans cette version de ShenPulse."
    );
  }

  const state = crypto.randomBytes(32).toString("base64url");
  const callback = await createPaymentLoopbackCallback({
    state,
    timeoutMs: BROWSER_AUTH_TIMEOUT_MS
  });
  service.subscriptionCheckoutCancel = callback.cancel;

  try {
    const payload = await requestJson(service,
      `${service.webOrigin}/api/payments/subscriptions/create`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          desktopCallbackPort: callback.port,
          desktopCallbackState: state,
          ownerId: uid,
          requestId: crypto.randomUUID(),
          tier
        }),
        signal: AbortSignal.timeout(25000)
      }
    );

    const approvalUrl = paypalApprovalUrl(payload.approvalUrl);
    if (!approvalUrl) {
      if (
        !payload.alreadyActive &&
        !payload.scheduled &&
        !payload.ok
      ) {
        throw new Error("PayPal n’a pas renvoyé de lien d’abonnement.");
      }
      return {
        ...withoutApprovalUrl(payload),
        checkoutOpened: false,
        tier: String(payload.tier || payload.targetTier || tier)
      };
    }

    await service.openExternal(approvalUrl);
    const browserResult = await callback.result;
    if (browserResult.cancelled) {
      return {
        ...withoutApprovalUrl(payload),
        cancelled: true,
        checkoutOpened: true,
        tier: String(payload.tier || payload.targetTier || tier)
      };
    }

    const subscriptionId = String(
      browserResult.subscriptionId || payload.id || ""
    ).trim();
    if (!subscriptionId) {
      throw new Error(
        "PayPal n’a pas renvoyé l’identifiant de l’abonnement."
      );
    }

    const prorationState = crypto
      .randomBytes(32)
      .toString("base64url");
    const prorationCallback = await createPaymentLoopbackCallback({
      state: prorationState,
      timeoutMs: BROWSER_AUTH_TIMEOUT_MS
    });
    service.subscriptionCheckoutCancel = prorationCallback.cancel;
    let syncPayload;
    try {
      syncPayload = await requestJson(service,
        `${service.webOrigin}/api/payments/subscriptions/sync`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            desktopCallbackPort: prorationCallback.port,
            desktopCallbackState: prorationState,
            ownerId: uid,
            subscriptionId,
            tier,
            token: browserResult.token || ""
          }),
          signal: AbortSignal.timeout(25000)
        }
      );

      const prorationApprovalUrl = paypalApprovalUrl(
        syncPayload.approvalUrl
      );
      if (prorationApprovalUrl) {
        await service.openExternal(prorationApprovalUrl);
        const prorationResult = await prorationCallback.result;
        if (prorationResult.cancelled) {
          return {
            ...withoutApprovalUrl(payload),
            ...withoutApprovalUrl(syncPayload),
            cancelled: true,
            checkoutOpened: true,
            prorationCancelled: true,
            subscriptionId,
            tier
          };
        }
        const orderId = String(prorationResult.token || "").trim();
        if (!orderId) {
          throw new Error(
            "PayPal n’a pas renvoyé l’identifiant du paiement complémentaire."
          );
        }
        const capturePayload = await requestJson(service,
          `${service.webOrigin}/api/payments/subscriptions/proration/capture`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              orderId,
              ownerId: uid,
              subscriptionId,
              tier,
              token: orderId
            }),
            signal: AbortSignal.timeout(25000)
          }
        );
        syncPayload = {
          ...syncPayload,
          ...capturePayload,
          approvalUrl: undefined,
          requiresProrationPayment: false
        };
      }
    } finally {
      if (service.subscriptionCheckoutCancel === prorationCallback.cancel) {
        service.subscriptionCheckoutCancel = null;
      }
      prorationCallback.close();
    }
    await service.syncEntitlements();

    return {
      ...withoutApprovalUrl(payload),
      ...withoutApprovalUrl(syncPayload),
      checkoutCompleted: true,
      checkoutOpened: true,
      subscriptionId,
      tier: String(
        syncPayload.tier ||
        syncPayload.targetTier ||
        payload.tier ||
        payload.targetTier ||
        tier
      )
    };
  } finally {
    if (service.subscriptionCheckoutCancel === callback.cancel) {
      service.subscriptionCheckoutCancel = null;
    }
    callback.close();
  }
}

module.exports = { runGameCheckout, runSubscriptionCheckout };
