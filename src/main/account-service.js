"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const {
  gameCheatEmailHash
} = require("../shared/game-cheat-access");

const FIREBASE_API_KEY = "AIzaSyDHcC8ngIhy2Av8N7J-XdCQq9G8KimGGJk";
const FIREBASE_DATABASE_URL =
  "https://shenazenoverlay-default-rtdb.firebaseio.com";
const IDENTITY_BASE_URL = "https://identitytoolkit.googleapis.com/v1";
const TOKEN_BASE_URL = "https://securetoken.googleapis.com/v1";
const DEFAULT_WEB_ORIGIN = "https://shenpulse.leuridan.fr";
const BROWSER_AUTH_TIMEOUT_MS = 10 * 60 * 1000;
const TRIAL_ENTITLEMENT_LEASE_MS = 10 * 60 * 1000;

class AccountService {
  constructor({
    store,
    fetchImpl = globalThis.fetch,
    openExternal = null,
    webOrigin = DEFAULT_WEB_ORIGIN
  }) {
    this.store = store;
    this.fetch = fetchImpl;
    this.openExternal = openExternal;
    this.webOrigin = normalizeWebOrigin(webOrigin);
    this.idToken = "";
    this.expiresAt = 0;
    this.refreshPromise = null;
    this.browserAuthPromise = null;
    this.subscriptionCheckoutPromise = null;
    this.gameCheckoutPromise = null;
    this.subscriptionCheckoutCancel = null;
    this.gameCheckoutCancel = null;
  }

  async status() {
    const session = this.#session();
    if (
      !normalizeEmail(session.email) ||
      !cleanUid(session.uid) ||
      !session.refreshTokenSecretId
    ) {
      return this.#publicStatus(false);
    }
    try {
      const token = await this.#token();
      await this.#synchronizeIdentity(token);
      await this.syncEntitlements({ silent: true });
      return this.#publicStatus(true);
    } catch (error) {
      if (isInvalidSessionError(error)) {
        this.#clearSession();
        return this.#publicStatus(false);
      }
      // Une coupure réseau ne supprime jamais la session chiffrée locale.
      return {
        ...this.#publicStatus(true),
        offline: true
      };
    }
  }

  async login(incoming = {}) {
    const email = requireEmail(incoming.email);
    const password = requirePassword(incoming.password, {
      minimumLength: 1
    });
    const payload = await this.#identityRequest(
      "accounts:signInWithPassword",
      {
        email,
        password,
        returnSecureToken: true
      }
    );
    await this.#acceptAuthPayload(payload, {
      fallbackEmail: email,
      providerId: "password"
    });
    await this.syncEntitlements({ silent: true });
    return this.#publicStatus(true);
  }

  async register(incoming = {}) {
    const email = requireEmail(incoming.email);
    const password = requirePassword(incoming.password, {
      minimumLength: 8
    });
    const confirmation = String(incoming.passwordConfirmation || "");
    if (password !== confirmation) {
      throw new Error("Les deux mots de passe ne correspondent pas.");
    }

    let payload = await this.#identityRequest("accounts:signUp", {
      email,
      password,
      returnSecureToken: true
    });
    const displayName =
      cleanDisplayName(incoming.displayName) ||
      cleanDisplayName(email.split("@")[0]);
    if (displayName) {
      const updated = await this.#identityRequest("accounts:update", {
        idToken: payload.idToken,
        displayName,
        returnSecureToken: true
      });
      payload = {
        ...payload,
        ...updated,
        refreshToken: updated.refreshToken || payload.refreshToken
      };
    }

    await this.#sendOobCode("VERIFY_EMAIL", {
      idToken: payload.idToken
    }).catch(() => {});
    await this.#acceptAuthPayload(payload, {
      fallbackEmail: email,
      providerId: "password"
    });
    this.#clearCommercialRights();
    return this.#publicStatus(true);
  }

  async requestPasswordReset(incoming = {}) {
    const email = requireEmail(incoming.email);
    try {
      await this.#sendOobCode("PASSWORD_RESET", { email });
    } catch (error) {
      // Ne révèle pas si une adresse existe lorsque Firebase autorise encore
      // l'énumération des comptes.
      if (!["EMAIL_NOT_FOUND", "USER_NOT_FOUND"].includes(error?.code)) {
        throw error;
      }
    }
    return {
      ok: true,
      message:
        "Si cette adresse correspond à un compte ShenPulse, un e-mail de réinitialisation vient d’être envoyé."
    };
  }

  async loginWithBrowser() {
    if (this.browserAuthPromise) return this.browserAuthPromise;
    if (typeof this.openExternal !== "function") {
      throw new Error(
        "La connexion Google n’est pas disponible dans cette version de ShenPulse."
      );
    }
    this.browserAuthPromise = this.#runBrowserAuth().finally(() => {
      this.browserAuthPromise = null;
    });
    return this.browserAuthPromise;
  }

  async assignPremiumSeat(incoming = {}) {
    const beneficiaryEmail = requireEmail(
      incoming.beneficiaryEmail || incoming.email
    );
    const token = await this.#token();
    const uid = cleanUid(this.#session().uid);
    const response = await this.fetch(
      `${this.webOrigin}/api/payments/premium-seat`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          beneficiaryEmail,
          beneficiaryEmails: [beneficiaryEmail],
          ownerId: uid
        }),
        signal: AbortSignal.timeout(20000)
      }
    );
    const payload = await readPayload(response);
    if (!response.ok) throw apiError(payload, response.status);
    await this.syncEntitlements();
    return payload;
  }

  async startSubscriptionCheckout(incoming = {}) {
    if (this.subscriptionCheckoutPromise) {
      return this.subscriptionCheckoutPromise;
    }
    this.subscriptionCheckoutPromise = this.#runSubscriptionCheckout(
      incoming
    ).finally(() => {
      this.subscriptionCheckoutPromise = null;
    });
    return this.subscriptionCheckoutPromise;
  }

  async startGameCheckout(incoming = {}) {
    if (this.gameCheckoutPromise) {
      return this.gameCheckoutPromise;
    }
    this.gameCheckoutPromise = this.#runGameCheckout(incoming).finally(() => {
      this.gameCheckoutPromise = null;
    });
    return this.gameCheckoutPromise;
  }

  cancelCheckout(incoming = {}) {
    const type = String(incoming.type || "all").trim().toLowerCase();
    let cancelled = false;
    if (
      ["all", "subscription"].includes(type) &&
      typeof this.subscriptionCheckoutCancel === "function"
    ) {
      cancelled = this.subscriptionCheckoutCancel() || cancelled;
    }
    if (
      ["all", "game"].includes(type) &&
      typeof this.gameCheckoutCancel === "function"
    ) {
      cancelled = this.gameCheckoutCancel() || cancelled;
    }
    return {
      cancelled,
      pending: cancelled,
      type
    };
  }

  async #runGameCheckout(incoming = {}) {
    const productId = requireGameProductId(incoming.productId);
    const token = await this.#token();
    await this.#synchronizeIdentity(token);
    const session = this.#session();
    const uid = cleanUid(session.uid);
    if (!uid) throw invalidSessionError("Session ShenPulse expirée.");
    if (session.emailVerified !== true) {
      throw new Error(
        "Vérifiez votre adresse e-mail avant de lancer l’achat."
      );
    }
    if (typeof this.openExternal !== "function") {
      throw new Error(
        "L’ouverture de PayPal n’est pas disponible dans cette version de ShenPulse."
      );
    }

    const state = crypto.randomBytes(32).toString("base64url");
    const callback = await createPaymentLoopbackCallback({
      state,
      timeoutMs: BROWSER_AUTH_TIMEOUT_MS
    });
    this.gameCheckoutCancel = callback.cancel;

    try {
      const createResponse = await this.fetch(
        `${this.webOrigin}/api/payments/orders/create`,
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
      const createPayload = await readPayload(createResponse);
      if (!createResponse.ok) {
        throw apiError(createPayload, createResponse.status);
      }
      if (createPayload.alreadyPurchased) {
        await this.syncEntitlements({ silent: true });
        this.#ensureGameEntitlement(productId);
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

      await this.openExternal(approvalUrl);
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

      const captureResponse = await this.fetch(
        `${this.webOrigin}/api/payments/orders/capture`,
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
      const capturePayload = await readPayload(captureResponse);
      if (!captureResponse.ok) {
        throw apiError(capturePayload, captureResponse.status);
      }
      const purchasedProductId = requireGameProductId(
        capturePayload.productId || productId
      );
      await this.syncEntitlements({ silent: true });
      this.#ensureGameEntitlement(purchasedProductId);

      return {
        ...withoutApprovalUrl(createPayload),
        ...withoutApprovalUrl(capturePayload),
        checkoutCompleted: true,
        checkoutOpened: true,
        orderId,
        productId: purchasedProductId
      };
    } finally {
      if (this.gameCheckoutCancel === callback.cancel) {
        this.gameCheckoutCancel = null;
      }
      callback.close();
    }
  }

  async #runSubscriptionCheckout(incoming = {}) {
    const tier = requireSubscriptionTier(incoming.tier);
    const token = await this.#token();
    await this.#synchronizeIdentity(token);
    const session = this.#session();
    const uid = cleanUid(session.uid);
    if (!uid) throw invalidSessionError("Session ShenPulse expirée.");
    if (session.emailVerified !== true) {
      throw new Error(
        "Vérifiez votre adresse e-mail avant de lancer l’abonnement."
      );
    }
    if (typeof this.openExternal !== "function") {
      throw new Error(
        "L’ouverture de PayPal n’est pas disponible dans cette version de ShenPulse."
      );
    }

    const state = crypto.randomBytes(32).toString("base64url");
    const callback = await createPaymentLoopbackCallback({
      state,
      timeoutMs: BROWSER_AUTH_TIMEOUT_MS
    });
    this.subscriptionCheckoutCancel = callback.cancel;

    try {
      const response = await this.fetch(
        `${this.webOrigin}/api/payments/subscriptions/create`,
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
      const payload = await readPayload(response);
      if (!response.ok) throw apiError(payload, response.status);

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

      await this.openExternal(approvalUrl);
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
      this.subscriptionCheckoutCancel = prorationCallback.cancel;
      let syncPayload;
      try {
        const syncResponse = await this.fetch(
          `${this.webOrigin}/api/payments/subscriptions/sync`,
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
        syncPayload = await readPayload(syncResponse);
        if (!syncResponse.ok) {
          throw apiError(syncPayload, syncResponse.status);
        }

        const prorationApprovalUrl = paypalApprovalUrl(
          syncPayload.approvalUrl
        );
        if (prorationApprovalUrl) {
          await this.openExternal(prorationApprovalUrl);
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
          const captureResponse = await this.fetch(
            `${this.webOrigin}/api/payments/subscriptions/proration/capture`,
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
          const capturePayload = await readPayload(captureResponse);
          if (!captureResponse.ok) {
            throw apiError(capturePayload, captureResponse.status);
          }
          syncPayload = {
            ...syncPayload,
            ...capturePayload,
            approvalUrl: undefined,
            requiresProrationPayment: false
          };
        }
      } finally {
        if (this.subscriptionCheckoutCancel === prorationCallback.cancel) {
          this.subscriptionCheckoutCancel = null;
        }
        prorationCallback.close();
      }
      await this.syncEntitlements();

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
      if (this.subscriptionCheckoutCancel === callback.cancel) {
        this.subscriptionCheckoutCancel = null;
      }
      callback.close();
    }
  }

  async syncEntitlements({ silent = false } = {}) {
    try {
      const token = await this.#token();
      const uid = cleanUid(this.#session().uid);
      if (!uid) throw invalidSessionError("Session ShenPulse expirée.");
      const [accountResult, publicResult] = await Promise.allSettled([
        this.#accountEntitlements(token, uid),
        this.#publicEntitlements(uid)
      ]);
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
      this.#applyEntitlements(payload);
      return payload;
    } catch (error) {
      if (silent) return null;
      throw error;
    }
  }

  async #accountEntitlements(token, uid) {
    const response = await this.fetch(
      `${this.webOrigin}/api/account/entitlements?uid=${encodeURIComponent(
        uid
      )}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15000)
      }
    );
    const payload = await readPayload(response);
    if (!response.ok) throw apiError(payload, response.status);
    if (!validEntitlementPayload(payload)) {
      throw new Error(
        "Le serveur n’a pas renvoyé les droits privés ShenPulse attendus."
      );
    }
    return payload;
  }

  async #publicEntitlements(uid) {
    const response = await this.fetch(
      `${this.webOrigin}/api/entitlements/subscription?uid=${encodeURIComponent(
        uid
      )}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(15000)
      }
    );
    const payload = await readPayload(response);
    if (!response.ok) throw apiError(payload, response.status);
    if (!validEntitlementPayload(payload)) {
      throw new Error(
        "Le serveur n’a pas renvoyé les droits publics ShenPulse attendus."
      );
    }
    return payload;
  }

  logout() {
    this.cancelCheckout();
    this.#clearSession();
    return this.#publicStatus(false);
  }

  async identityForInternalUse() {
    const idToken = await this.#token();
    await this.#synchronizeIdentity(idToken);
    const session = this.#session();
    return {
      email: normalizeEmail(session.email),
      emailVerified: session.emailVerified === true,
      idToken,
      uid: cleanUid(session.uid)
    };
  }

  async gameCheatAccess() {
    const session = this.#session();
    if (
      session.emailVerified !== true ||
      !normalizeEmail(session.email) ||
      !cleanUid(session.uid)
    ) {
      return { allowed: false, checkedAt: "" };
    }
    const token = await this.#token();
    await this.#synchronizeIdentity(token);
    const current = this.#session();
    if (current.emailVerified !== true) {
      return { allowed: false, checkedAt: "" };
    }
    const emailHash = gameCheatEmailHash(current.email);
    if (!emailHash) return { allowed: false, checkedAt: "" };
    const response = await this.fetch(
      `${FIREBASE_DATABASE_URL}/site/gameCheatAccess/${emailHash}.json?auth=${encodeURIComponent(token)}`,
      {
        headers: { "Cache-Control": "no-store" },
        signal: AbortSignal.timeout(10000)
      }
    );
    const payload = await readPayload(response);
    if (!response.ok) throw apiError(payload, response.status);
    return {
      allowed: payload === true,
      checkedAt: new Date().toISOString()
    };
  }

  async #runBrowserAuth() {
    const state = crypto.randomBytes(32).toString("base64url");
    const callbackResult = await createLoopbackCallback({
      onReady: async (callbackUrl) => {
        const target = new URL("/login", this.webOrigin);
        target.searchParams.set("desktop", "1");
        target.searchParams.set("callback", callbackUrl);
        target.searchParams.set("state", state);
        await this.openExternal(target.toString());
      },
      state,
      timeoutMs: BROWSER_AUTH_TIMEOUT_MS
    });

    const redeemResponse = await this.fetch(
      `${this.webOrigin}/api/auth/desktop/redeem`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: callbackResult.code,
          state
        }),
        signal: AbortSignal.timeout(20000)
      }
    );
    const redeemPayload = await readPayload(redeemResponse);
    if (!redeemResponse.ok) {
      throw apiError(redeemPayload, redeemResponse.status);
    }
    if (!redeemPayload.customToken) {
      throw new Error(
        "Le navigateur n’a pas renvoyé une session ShenPulse valide."
      );
    }

    const payload = await this.#identityRequest(
      "accounts:signInWithCustomToken",
      {
        token: redeemPayload.customToken,
        returnSecureToken: true
      }
    );
    await this.#acceptAuthPayload(payload, {
      fallbackEmail: redeemPayload.email,
      providerId: redeemPayload.providerId || "google.com"
    });
    await this.syncEntitlements({ silent: true });
    return this.#publicStatus(true);
  }

  async #acceptAuthPayload(
    payload,
    { fallbackEmail = "", providerId = "" } = {}
  ) {
    if (!payload?.idToken || !payload?.refreshToken) {
      throw new Error("Firebase n’a pas confirmé le compte ShenPulse.");
    }
    const lookup = await this.#lookup(payload.idToken).catch(() => null);
    const email = normalizeEmail(
      lookup?.email || payload.email || fallbackEmail
    );
    const uid = cleanUid(
      lookup?.localId || payload.localId || payload.user_id
    );
    if (!email || !uid) {
      throw new Error("Firebase n’a pas confirmé l’identité du compte.");
    }

    const previous = this.#session();
    const sameAccount = cleanUid(previous.uid) === uid;
    if (
      !sameAccount &&
      previous.refreshTokenSecretId
    ) {
      this.store.setSecret(previous.refreshTokenSecretId, "");
    }
    const refreshTokenSecretId = this.store.setSecret(
      sameAccount ? previous.refreshTokenSecretId : "",
      String(payload.refreshToken)
    );
    this.idToken = String(payload.idToken);
    this.expiresAt =
      Date.now() +
      Math.max(60, Number(payload.expiresIn) || 3600) * 1000;
    const providers = Array.isArray(lookup?.providerUserInfo)
      ? lookup.providerUserInfo
      : [];
    const resolvedProvider =
      String(providers[0]?.providerId || providerId || "password").trim();
    this.store.activateAccount?.(uid);
    this.store.set("settings.account", {
      email,
      uid,
      displayName: cleanDisplayName(
        lookup?.displayName || payload.displayName
      ),
      photoUrl: cleanUrl(lookup?.photoUrl),
      providerId: resolvedProvider,
      emailVerified: lookup?.emailVerified === true,
      refreshTokenSecretId,
      lastAuthenticatedAt: new Date().toISOString()
    });
  }

  async #identityRequest(action, body) {
    const response = await this.fetch(
      `${IDENTITY_BASE_URL}/${action}?key=${encodeURIComponent(
        FIREBASE_API_KEY
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000)
      }
    );
    const payload = await readPayload(response);
    if (!response.ok) throw firebaseAuthError(payload);
    return payload;
  }

  async #sendOobCode(requestType, values) {
    return this.#identityRequest("accounts:sendOobCode", {
      requestType,
      ...values
    });
  }

  async #lookup(idToken) {
    const payload = await this.#identityRequest("accounts:lookup", {
      idToken
    });
    return Array.isArray(payload.users) ? payload.users[0] : null;
  }

  async #synchronizeIdentity(idToken) {
    const current = this.#session();
    const lookup = await this.#lookup(idToken);
    const email = normalizeEmail(lookup?.email);
    const uid = cleanUid(lookup?.localId);
    if (
      !email ||
      !uid ||
      email !== normalizeEmail(current.email) ||
      uid !== cleanUid(current.uid)
    ) {
      throw invalidSessionError(
        "La session ne correspond plus au compte ShenPulse."
      );
    }
    const providers = Array.isArray(lookup?.providerUserInfo)
      ? lookup.providerUserInfo
      : [];
    this.store.set("settings.account", {
      ...current,
      email,
      uid,
      displayName: cleanDisplayName(
        lookup?.displayName || current.displayName
      ),
      photoUrl: cleanUrl(lookup?.photoUrl || current.photoUrl),
      providerId: String(
        providers[0]?.providerId || current.providerId || "password"
      ).trim(),
      emailVerified: lookup?.emailVerified === true
    });
  }

  async #token() {
    if (
      this.idToken &&
      this.expiresAt - Date.now() > 2 * 60 * 1000
    ) {
      return this.idToken;
    }
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.#refreshToken().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  async #refreshToken() {
    const session = this.#session();
    const uid = cleanUid(session.uid);
    const refreshToken = this.store.getSecret(
      session.refreshTokenSecretId
    );
    if (!uid || !refreshToken) {
      throw invalidSessionError("Session ShenPulse expirée.");
    }

    const response = await this.fetch(
      `${TOKEN_BASE_URL}/token?key=${encodeURIComponent(
        FIREBASE_API_KEY
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken
        }).toString(),
        signal: AbortSignal.timeout(15000)
      }
    );
    const payload = await readPayload(response);
    if (!response.ok) throw firebaseAuthError(payload, true);
    if (cleanUid(payload.user_id) !== uid || !payload.id_token) {
      throw invalidSessionError(
        "La session ne correspond plus au compte ShenPulse."
      );
    }
    if (
      payload.refresh_token &&
      payload.refresh_token !== refreshToken
    ) {
      this.store.setSecret(
        session.refreshTokenSecretId,
        String(payload.refresh_token)
      );
    }
    this.idToken = String(payload.id_token);
    this.expiresAt =
      Date.now() +
      Math.max(60, Number(payload.expires_in) || 3600) * 1000;
    return this.idToken;
  }

  #applyEntitlements(payload = {}) {
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
    this.store.mutate((state) => {
      state.commerce.subscription = {
        tier,
        source,
        status: tier === "free" ? "free" : "active",
        priceMonthly:
          source === "own" ? Math.max(0, Number(payload.priceMonthly) || 0) : 0,
        renewalDate: String(payload.renewalDate || ""),
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

  #ensureGameEntitlement(productId) {
    const id = requireGameProductId(productId);
    this.store.mutate((state) => {
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

  #clearCommercialRights() {
    this.store.mutate((state) => {
      state.commerce.subscription = {
        tier: "free",
        source: "free",
        status: "free",
        priceMonthly: 0,
        renewalDate: "",
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

  #session() {
    return this.store.getState().settings.account || {};
  }

  #publicStatus(authenticated) {
    const session = this.#session();
    const valid = Boolean(
      authenticated &&
        normalizeEmail(session.email) &&
        cleanUid(session.uid)
    );
    return {
      authenticated: valid,
      email: valid ? normalizeEmail(session.email) : "",
      uid: valid ? cleanUid(session.uid) : "",
      displayName: valid
        ? cleanDisplayName(session.displayName)
        : "",
      photoUrl: valid ? cleanUrl(session.photoUrl) : "",
      providerId: valid ? String(session.providerId || "") : "",
      emailVerified: valid && session.emailVerified === true,
      lastAuthenticatedAt: valid
        ? String(session.lastAuthenticatedAt || "")
        : "",
      offline: false
    };
  }

  #clearSession() {
    const session = this.#session();
    if (session.refreshTokenSecretId) {
      this.store.setSecret(session.refreshTokenSecretId, "");
    }
    this.idToken = "";
    this.expiresAt = 0;
    this.store.deactivateAccount?.();
    this.store.set("settings.account", {
      email: "",
      uid: "",
      displayName: "",
      photoUrl: "",
      providerId: "",
      emailVerified: false,
      refreshTokenSecretId: "",
      lastAuthenticatedAt: ""
    });
    this.#clearCommercialRights();
  }
}

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

function entitlementGameId(entry) {
  return String(
    typeof entry === "string"
      ? entry
      : entry?.gameId || entry?.productId || entry?.id || ""
  ).trim();
}

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

function normalizedGameEntitlementStatus(entry) {
  if (typeof entry === "string") return "active";
  const status = String(entry?.status || "").trim().toLowerCase();
  if (entry?.source === "trial" || status === "trial") return "trial";
  return status || "active";
}

function validEntitlementPayload(payload) {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      ["free", "pro", "premium"].includes(String(payload.tier || "")) &&
      Array.isArray(payload.gameEntitlements)
  );
}

async function createLoopbackCallback({
  onReady,
  state,
  timeoutMs
}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      server.close(() => {});
      if (error) reject(error);
      else resolve(value);
    };
    const server = http.createServer((request, response) => {
      let target;
      try {
        target = new URL(
          request.url || "/",
          "http://127.0.0.1"
        );
      } catch {
        response.writeHead(400).end();
        return;
      }
      if (target.pathname !== "/callback") {
        response.writeHead(404).end();
        return;
      }
      const receivedState = target.searchParams.get("state") || "";
      const code = target.searchParams.get("code") || "";
      const error = target.searchParams.get("error") || "";
      const stateMatches =
        receivedState.length === state.length &&
        crypto.timingSafeEqual(
          Buffer.from(receivedState),
          Buffer.from(state)
        );
      if (!stateMatches || !code || error) {
        response.writeHead(400, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'"
        });
        response.end(browserResponseHtml(false));
        finish(
          new Error(
            error ||
              "Le retour du navigateur n’a pas pu être vérifié."
          )
        );
        return;
      }
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'"
      });
      response.end(browserResponseHtml(true));
      finish(null, { code });
    });
    const timeout = setTimeout(
      () =>
        finish(
          new Error(
            "La connexion a expiré. Relancez-la depuis ShenPulse."
          )
        ),
      timeoutMs
    );
    server.once("error", (error) => finish(error));
    server.listen(0, "127.0.0.1", async () => {
      try {
        const address = server.address();
        if (!address || typeof address === "string") {
          throw new Error("Le retour local de connexion est indisponible.");
        }
        await onReady(
          `http://127.0.0.1:${address.port}/callback`
        );
      } catch (error) {
        finish(error);
      }
    });
  });
}

async function createPaymentLoopbackCallback({ state, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let ready = false;
    let settled = false;
    let timeout = null;
    let resolveResult;
    let rejectResult;
    const result = new Promise((resolveCallback, rejectCallback) => {
      resolveResult = resolveCallback;
      rejectResult = rejectCallback;
    });
    // Le résultat peut être fermé avant que l'appelant commence à l'attendre.
    result.catch(() => {});

    const finish = (error, value) => {
      if (settled) return false;
      settled = true;
      if (timeout) clearTimeout(timeout);
      server.close(() => {});
      if (error) rejectResult(error);
      else resolveResult(value);
      return true;
    };
    const server = http.createServer((request, response) => {
      let target;
      try {
        target = new URL(request.url || "/", "http://127.0.0.1");
      } catch {
        response.writeHead(400).end();
        return;
      }
      if (target.pathname !== "/payment-callback") {
        response.writeHead(404).end();
        return;
      }

      const receivedState = target.searchParams.get("state") || "";
      const status = target.searchParams.get("status") || "";
      const stateMatches =
        receivedState.length === state.length &&
        crypto.timingSafeEqual(
          Buffer.from(receivedState),
          Buffer.from(state)
        );
      if (
        !stateMatches ||
        !["success", "cancelled"].includes(status)
      ) {
        response.writeHead(400, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy":
            "default-src 'none'; style-src 'unsafe-inline'"
        });
        response.end(paymentResponseHtml("error"));
        finish(
          new Error(
            "Le retour PayPal n’a pas pu être vérifié par ShenPulse."
          )
        );
        return;
      }

      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'",
        "Cache-Control": "no-store"
      });
      response.end(paymentResponseHtml(status));
      finish(null, {
        cancelled: status === "cancelled",
        subscriptionId: String(
          target.searchParams.get("subscription_id") ||
          target.searchParams.get("subscriptionId") ||
          ""
        ).trim(),
        token: String(target.searchParams.get("token") || "").trim()
      });
    });

    server.once("error", (error) => {
      if (!ready) reject(error);
      else finish(error);
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        const error = new Error(
          "Le retour local de paiement est indisponible."
        );
        server.close(() => {});
        reject(error);
        return;
      }
      ready = true;
      timeout = setTimeout(
        () =>
          finish(
            new Error(
              "Le paiement a expiré. Relancez-le depuis ShenPulse."
            )
          ),
        timeoutMs
      );
      resolve({
        cancel: () =>
          finish(null, {
            cancelled: true,
            subscriptionId: "",
            token: ""
          }),
        close: () => finish(null, { closed: true }),
        port: address.port,
        result
      });
    });
  });
}

function browserResponseHtml(success) {
  const title = success ? "Connexion terminée" : "Connexion refusée";
  const detail = success
    ? "Vous pouvez fermer cette page et revenir dans ShenPulse."
    : "Revenez dans ShenPulse puis relancez la connexion.";
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><title>${title}</title><body style="margin:0;background:#090b14;color:#f7f7ff;font-family:system-ui;display:grid;place-items:center;min-height:100vh"><main style="max-width:560px;padding:40px;text-align:center;border:1px solid #563080;border-radius:20px;background:#111426"><h1>${title}</h1><p style="color:#aeb6cf">${detail}</p></main></body></html>`;
}

function paymentResponseHtml(status) {
  const cancelled = status === "cancelled";
  const error = status === "error";
  const title = error
    ? "Retour PayPal refusé"
    : cancelled
      ? "Paiement annulé"
      : "Paiement validé";
  const detail = error
    ? "Ce retour ne correspond pas au paiement lancé depuis ShenPulse."
    : cancelled
      ? "ShenPulse a bien reçu l’annulation. Vous pouvez fermer cette page."
      : "ShenPulse finalise votre achat et synchronise vos accès. Vous pouvez fermer cette page.";
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><title>${title}</title><body style="margin:0;background:#090b14;color:#f7f7ff;font-family:system-ui;display:grid;place-items:center;min-height:100vh"><main style="max-width:560px;padding:40px;text-align:center;border:1px solid #563080;border-radius:20px;background:#111426"><h1>${title}</h1><p style="color:#aeb6cf">${detail}</p></main></body></html>`;
}

function withoutApprovalUrl(payload = {}) {
  const result = { ...(payload || {}) };
  delete result.approvalUrl;
  return result;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 254);
}

function requireEmail(value) {
  const email = normalizeEmail(value);
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email) ||
    email.includes("..")
  ) {
    throw new Error("Renseignez une adresse e-mail valide.");
  }
  return email;
}

function requirePassword(value, { minimumLength = 8 } = {}) {
  const password = String(value || "");
  if (password.length < minimumLength) {
    throw new Error(
      minimumLength > 1
        ? `Le mot de passe doit contenir au moins ${minimumLength} caractères.`
        : "Renseignez le mot de passe du compte ShenPulse."
    );
  }
  if (password.length > 500) {
    throw new Error("Le mot de passe est trop long.");
  }
  return password;
}

function cleanUid(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9:_-]/g, "")
    .slice(0, 160);
}

function cleanDisplayName(value) {
  return String(value || "").trim().slice(0, 120);
}

function cleanUrl(value) {
  const url = String(value || "").trim();
  return /^https:\/\//i.test(url) ? url.slice(0, 2048) : "";
}

function requireSubscriptionTier(value) {
  const tier = String(value || "").trim().toLowerCase();
  if (!["pro", "premium"].includes(tier)) {
    throw new Error("Choisissez un abonnement Pro ou Premium.");
  }
  return tier;
}

function requireGameProductId(value) {
  const productId = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,159}$/.test(productId)) {
    throw new Error("Choisissez un jeu disponible à l’achat.");
  }
  return productId;
}

function paypalApprovalUrl(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    if (
      url.protocol !== "https:" ||
      (url.hostname !== "paypal.com" &&
        !url.hostname.endsWith(".paypal.com"))
    ) {
      throw new Error();
    }
    return url.toString();
  } catch {
    throw new Error("Le lien d’abonnement reçu ne pointe pas vers PayPal.");
  }
}

function normalizeWebOrigin(value) {
  try {
    const url = new URL(String(value || DEFAULT_WEB_ORIGIN));
    if (url.protocol !== "https:") throw new Error();
    return url.origin;
  } catch {
    return DEFAULT_WEB_ORIGIN;
  }
}

async function readPayload(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text } };
  }
}

function apiError(payload, status = 0) {
  const message = String(
    payload?.error?.message || payload?.error || payload?.message || ""
  ).trim();
  const error = new Error(
    message || `Le service ShenPulse a refusé la demande (${status}).`
  );
  error.status = status;
  if ([401, 403].includes(Number(status))) {
    error.invalidSession = Number(status) === 401;
  }
  return error;
}

function firebaseAuthError(payload, refreshing = false) {
  const code = String(
    payload?.error?.message || payload?.error || ""
  )
    .split(" : ")[0]
    .trim()
    .toUpperCase();
  const invalidCodes = new Set([
    "EMAIL_NOT_FOUND",
    "INVALID_PASSWORD",
    "INVALID_LOGIN_CREDENTIALS",
    "INVALID_REFRESH_TOKEN",
    "TOKEN_EXPIRED",
    "USER_DISABLED",
    "USER_NOT_FOUND"
  ]);
  const messages = {
    EMAIL_EXISTS:
      "Cette adresse e-mail est déjà utilisée. Connectez-vous ou réinitialisez le mot de passe.",
    EMAIL_NOT_FOUND: "Adresse ou mot de passe incorrect.",
    INVALID_EMAIL: "Cette adresse e-mail n’est pas valide.",
    INVALID_PASSWORD: "Adresse ou mot de passe incorrect.",
    INVALID_LOGIN_CREDENTIALS:
      "Adresse ou mot de passe incorrect.",
    INVALID_REFRESH_TOKEN:
      "La session ShenPulse a expiré. Reconnectez-vous.",
    TOKEN_EXPIRED:
      "La session ShenPulse a expiré. Reconnectez-vous.",
    USER_DISABLED: "Ce compte ShenPulse a été désactivé.",
    USER_NOT_FOUND: "Ce compte ShenPulse n’existe plus.",
    WEAK_PASSWORD:
      "Le mot de passe doit contenir au moins 8 caractères.",
    OPERATION_NOT_ALLOWED:
      "Cette méthode de connexion n’est pas activée dans Firebase.",
    TOO_MANY_ATTEMPTS_TRY_LATER:
      "Trop de tentatives. Réessayez dans quelques minutes."
  };
  const error = new Error(
    messages[code] ||
      (refreshing
        ? "Impossible de renouveler la session ShenPulse."
        : "Connexion au compte ShenPulse impossible.")
  );
  error.code = code;
  error.invalidSession = invalidCodes.has(code);
  return error;
}

function invalidSessionError(message) {
  const error = new Error(message);
  error.invalidSession = true;
  return error;
}

function isInvalidSessionError(error) {
  return error?.invalidSession === true;
}

module.exports = {
  AccountService,
  cleanDisplayName,
  cleanUid,
  createLoopbackCallback,
  createPaymentLoopbackCallback,
  normalizeEmail,
  requireEmail
};
