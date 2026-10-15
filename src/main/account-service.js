"use strict";

const { gameCheatEmailHash } = require("../shared/game-cheat-access");
const { FIREBASE_API_KEY, FIREBASE_DATABASE_URL, IDENTITY_BASE_URL, TOKEN_BASE_URL, DEFAULT_WEB_ORIGIN, GOOGLE_LOOPBACK_PORT } = require("./account/constants");
const { normalizeEmail, requireEmail, requirePassword, cleanUid, cleanDisplayName, cleanUrl, normalizeWebOrigin } = require("./account/validation");
const { readPayload, apiError, firebaseAuthError, invalidSessionError, isInvalidSessionError } = require("./account/http-client");
const { normalizeSubscriptionPendingChange } = require("./account/entitlement-payload");
const entitlements = require("./account/entitlements");
const { runGameCheckout, runSubscriptionCheckout } = require("./account/checkout");
const { runBrowserAuth } = require("./account/browser-auth");
const { createLoopbackCallback } = require("./account/browser-loopback");
const { createGoogleIdTokenLoopback } = require("./account/google-loopback");
const { createPaymentLoopbackCallback } = require("./account/payment-loopback");
const { prepareMediaUpload } = require("./account/media-uploads");

/** Façade compatible du compte : garde les jetons en mémoire et orchestre les domaines métier. */
class AccountService {
  constructor({
    store,
    fetchImpl = globalThis.fetch,
    openExternal = null,
    webOrigin = DEFAULT_WEB_ORIGIN,
    googleLoopbackPort = GOOGLE_LOOPBACK_PORT
  }) {
    this.store = store;
    this.fetch = fetchImpl;
    this.openExternal = openExternal;
    this.webOrigin = normalizeWebOrigin(webOrigin);
    this.googleLoopbackPort = Number(googleLoopbackPort);
    this.idToken = "";
    this.expiresAt = 0;
    this.refreshPromise = null;
    this.browserAuthPromise = null;
    this.subscriptionCheckoutPromise = null;
    this.gameCheckoutPromise = null;
    this.subscriptionCheckoutCancel = null;
    this.gameCheckoutCancel = null;
  }

  /** Vérifie la session ; une panne réseau conserve l'identité locale avec offline=true. */
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

  /** Connexion par mot de passe : le mot de passe n'est jamais écrit dans le store. */
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

  /** Inscription et vérification e-mail, avec confirmation locale avant toute requête. */
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

  /** Demande de réinitialisation sans révéler l'existence de l'adresse saisie. */
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

  /** Réutilise une seule connexion Google en cours et valide son retour local. */
  async loginWithBrowser(incoming = {}) {
    if (this.browserAuthPromise) return this.browserAuthPromise;
    if (typeof this.openExternal !== "function") {
      throw new Error(
        "La connexion Google n’est pas disponible dans cette version de ShenPulse."
      );
    }
    const rawEmailHint = String(incoming.email || "").trim();
    const emailHint = rawEmailHint ? requireEmail(rawEmailHint) : "";
    this.browserAuthPromise = this.#runBrowserAuth(emailHint).finally(() => {
      this.browserAuthPromise = null;
    });
    return this.browserAuthPromise;
  }

  /** Attribue le siège Premium puis relit les droits confirmés par le serveur. */
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

  /** Un seul checkout d'abonnement peut être en cours par instance. */
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

  /** Programme l'arrêt et conserve les droits jusqu'à l'échéance renvoyée par le serveur. */
  async stopSubscription() {
    const token = await this.#token();
    await this.#synchronizeIdentity(token);
    const uid = cleanUid(this.#session().uid);
    if (!uid) throw invalidSessionError("Session ShenPulse expirée.");

    const response = await this.fetch(
      `${this.webOrigin}/api/payments/subscriptions/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ownerId: uid }),
        signal: AbortSignal.timeout(20000)
      }
    );
    const payload = await readPayload(response);
    if (!response.ok) throw apiError(payload, response.status);

    await this.syncEntitlements();
    const pendingChange = normalizeSubscriptionPendingChange({
      effectiveAt: payload.effectiveAt,
      fromTier: payload.tier,
      targetTier: payload.targetTier,
      type: payload.scheduled ? "cancel" : ""
    });
    if (pendingChange) {
      this.store.mutate((state) => {
        const subscription = state.commerce?.subscription;
        if (!subscription || !["pro", "premium"].includes(subscription.tier)) {
          return;
        }
        subscription.pendingChange = pendingChange;
      }, true);
    }
    return payload;
  }

  /** Un seul checkout de jeu peut être en cours par instance. */
  async startGameCheckout(incoming = {}) {
    if (this.gameCheckoutPromise) {
      return this.gameCheckoutPromise;
    }
    this.gameCheckoutPromise = this.#runGameCheckout(incoming).finally(() => {
      this.gameCheckoutPromise = null;
    });
    return this.gameCheckoutPromise;
  }

  /** Annule les retours locaux sélectionnés, jamais un paiement distant. */
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
    return runGameCheckout(this, incoming, this.#flowContext());
  }

  async #runSubscriptionCheckout(incoming = {}) {
    return runSubscriptionCheckout(this, incoming, this.#flowContext());
  }

  /** Recharge les droits privés et publics vérifiés ; silent ne supprime pas l'identité locale. */
  async syncEntitlements(options = {}) {
    return entitlements.syncEntitlements(this, options, this.#flowContext());
  }

  /** Déconnexion explicite : annule les attentes et vide les jetons du compte actif. */
  logout() {
    this.cancelCheckout();
    this.#clearSession();
    return this.#publicStatus(false);
  }

  /** Identité vérifiée réservée au processus principal, jamais exposée directement au rendu. */
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

  /** Présence LIVE interne : réutilise la session chiffrée sans lookup par heartbeat. */
  async identityForLiveDirectory() {
    const expectedUid = cleanUid(this.#session().uid);
    if (!expectedUid) throw invalidSessionError("Session ShenPulse expirée.");
    const idToken = await this.#token();
    const uid = cleanUid(this.#session().uid);
    if (uid !== expectedUid) throw invalidSessionError("Le compte ShenPulse a changé.");
    return { uid, idToken };
  }

  /** Stockage partagé pour tout compte connecté, sans condition d’abonnement. */
  async prepareMediaUpload(incoming = {}) {
    return prepareMediaUpload(this, incoming, {
      identity: () => this.identityForLiveDirectory(),
      currentUid: () => cleanUid(this.#session().uid)
    });
  }

  /** Vérifie le droit du compte actif par empreinte d'e-mail, jamais par saisie du rendu. */
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

  async #runBrowserAuth(emailHint = "") {
    return runBrowserAuth(this, emailHint, this.#flowContext());
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

  #ensureGameEntitlement(productId) {
    return entitlements.ensureGameEntitlement(this, productId);
  }

  #clearCommercialRights() {
    return entitlements.clearCommercialRights(this);
  }

  /** Contrat interne explicite : les domaines ne lisent pas directement les méthodes privées. */
  #flowContext() {
    return {
      token: () => this.#token(),
      session: () => this.#session(),
      synchronizeIdentity: (token) => this.#synchronizeIdentity(token),
      identityRequest: (...args) => this.#identityRequest(...args),
      acceptAuthPayload: (...args) => this.#acceptAuthPayload(...args),
      publicStatus: (authenticated) => this.#publicStatus(authenticated),
      ensureGameEntitlement: (productId) => this.#ensureGameEntitlement(productId)
    };
  }

  #session() {
    return this.store.getAccountSession?.() || this.store.getState().settings.account || {};
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

module.exports = {
  AccountService,
  cleanDisplayName,
  cleanUid,
  createGoogleIdTokenLoopback,
  createLoopbackCallback,
  createPaymentLoopbackCallback,
  normalizeEmail,
  requireEmail
};
