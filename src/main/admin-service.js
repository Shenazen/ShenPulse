"use strict";

const { readState } = require("./state-projection");

/** Façade stable : API historique, implémentations organisées par responsabilités. */
const { gameCheatAccessGrantMap } = require("../shared/game-cheat-access");
const { ADMIN_EMAIL, FIREBASE_API_KEY, FIREBASE_DATABASE_URL, SHENPULSE_API_URL, PUBLIC_VISIBILITY_SECTIONS, VISIBILITY_SECTIONS } = require("./admin/constants");
const { normalizeSiteSettings, normalizePublicVisibility, validateGameVersions, publicVisibilityDocument } = require("./admin/configuration");
const { normalizeCommerceCatalog, normalizeCommerceState, normalizeTrialRequest, commerceStateFromPublicConfig, emptyCommerceState } = require("./admin/commerce");
const { normalizeAdminModuleError, cleanUid, normalizeEmail, firebaseTokenClaims, readPayload, firebaseErrorMessage, remoteErrorMessage } = require("./admin/validation");

class AdminService {
  constructor({
    store,
    accountService = null,
    fetchImpl = globalThis.fetch
  }) {
    this.store = store;
    this.accountService = accountService;
    this.fetch = fetchImpl;
    this.idToken = "";
    this.expiresAt = 0;
    this.refreshPromise = null;
    this.accountAdminSession = null;
  }

  async status() {
    const accountIdentity = await this.#accountAdminIdentity();
    if (accountIdentity) return this.#publicStatus(true);
    const session = this.#session();
    if (!session.refreshTokenSecretId) return this.#publicStatus(false);
    try {
      await this.#token();
      return this.#publicStatus(true);
    } catch {
      this.#clearSession();
      return this.#publicStatus(false);
    }
  }

  async login(incoming = {}) {
    const email = normalizeEmail(incoming.email);
    const password = String(incoming.password || "");
    if (email !== ADMIN_EMAIL) {
      throw new Error("Ce compte n’est pas autorisé à administrer ShenPulse.");
    }
    if (!password) throw new Error("Renseignez le mot de passe du compte administrateur.");

    const response = await this.fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
        signal: AbortSignal.timeout(15000)
      }
    );
    const payload = await readPayload(response);
    if (!response.ok) throw new Error(firebaseErrorMessage(payload));

    const verifiedEmail = normalizeEmail(payload.email);
    const uid = cleanUid(payload.localId);
    const tokenClaims = firebaseTokenClaims(payload.idToken);
    if (
      verifiedEmail !== ADMIN_EMAIL ||
      !uid ||
      tokenClaims.email_verified !== true ||
      normalizeEmail(tokenClaims.email) !== ADMIN_EMAIL ||
      cleanUid(tokenClaims.user_id || tokenClaims.sub) !== uid ||
      !payload.idToken ||
      !payload.refreshToken
    ) {
      throw new Error("Firebase n’a pas confirmé le compte administrateur ShenPulse.");
    }

    const previous = this.#session();
    const refreshTokenSecretId = this.store.setSecret(
      previous.refreshTokenSecretId,
      String(payload.refreshToken)
    );
    this.idToken = String(payload.idToken);
    this.expiresAt =
      Date.now() + Math.max(60, Number(payload.expiresIn) || 3600) * 1000;
    this.store.set("settings.admin", {
      email: verifiedEmail,
      emailVerified: true,
      uid,
      refreshTokenSecretId,
      lastAuthenticatedAt: new Date().toISOString()
    });

    // Confirm that the Firebase session can read the shared admin configuration.
    // Commerce and trial services are loaded separately so one optional module
    // can never invalidate an otherwise valid owner session.
    try {
      await this.getSiteSettings();
    } catch (error) {
      this.#clearSession();
      throw error;
    }
    return this.#publicStatus(true);
  }

  logout() {
    this.#clearSession();
    return this.#publicStatus(false);
  }

  async getPublicVisibility() {
    const fallback = normalizePublicVisibility(
      (typeof this.store.getState === "function" ? readState(this.store, ["settings.siteVisibility"]) : {}).settings?.siteVisibility
    );
    try {
      const response = await this.fetch(
        `${FIREBASE_DATABASE_URL}/site/publicVisibility.json`,
        {
          headers: { "Cache-Control": "no-store" },
          signal: AbortSignal.timeout(10000)
        }
      );
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(remoteErrorMessage(payload, response));
      const visibility = normalizePublicVisibility(payload);
      this.#cachePublicVisibility(visibility);
      return visibility;
    } catch {
      return fallback;
    }
  }

  async getDashboard() {
    const [siteResult, commerceResult, trialsResult] = await Promise.allSettled([
      this.getSiteSettings(),
      this.#api(`/api/admin/commerce?ownerId=${encodeURIComponent(this.#ownerId())}`),
      this.#api(`/api/admin/trials?ownerId=${encodeURIComponent(this.#ownerId())}`)
    ]);
    if (siteResult.status === "rejected") throw siteResult.reason;

    const errors = {};
    let commerce;
    if (commerceResult.status === "fulfilled") {
      commerce = normalizeCommerceState(commerceResult.value);
    } else {
      errors.commerce = normalizeAdminModuleError(
        commerceResult.reason,
        "commerce"
      );
      commerce = await this.#publicCommerceFallback().catch(() =>
        emptyCommerceState()
      );
    }
    const trials =
      trialsResult.status === "fulfilled"
        ? trialsResult.value
        : { ok: false, trials: [] };
    if (trialsResult.status === "rejected") {
      errors.trials = normalizeAdminModuleError(trialsResult.reason, "trials");
    }
    return {
      status: this.#publicStatus(true),
      siteSettings: siteResult.value,
      commerce,
      trials,
      errors
    };
  }

  async getSiteSettings() {
    const token = await this.#token();
    const response = await this.fetch(
      `${FIREBASE_DATABASE_URL}/site/adminSettings.json?auth=${encodeURIComponent(token)}`,
      {
        headers: { "Cache-Control": "no-store" },
        signal: AbortSignal.timeout(15000)
      }
    );
    const payload = await readPayload(response);
    if (!response.ok) throw new Error(remoteErrorMessage(payload, response));
    const settings = normalizeSiteSettings(payload);
    this.#cachePublicVisibility(settings);
    return settings;
  }

  async saveSiteSettings(incoming) {
    const settings = normalizeSiteSettings(incoming);
    validateGameVersions(settings);
    const token = await this.#token();
    const response = await this.fetch(
      `${FIREBASE_DATABASE_URL}/site/adminSettings.json?auth=${encodeURIComponent(token)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          ...settings,
          updatedAt: { ".sv": "timestamp" },
          updatedBy: ADMIN_EMAIL
        })
      }
    );
    const payload = await readPayload(response);
    if (!response.ok) throw new Error(remoteErrorMessage(payload, response));
    const savedSettings = normalizeSiteSettings(payload);
    await this.#publishPublicVisibility(savedSettings, token);
    await this.#publishGameCheatAccess(savedSettings, token);
    this.#cachePublicVisibility(savedSettings);
    return savedSettings;
  }

  async saveCommerce(incoming = {}) {
    const action = new Set([
      "save-draft",
      "publish-test",
      "publish-prod",
      "restore-draft"
    ]).has(incoming.action)
      ? incoming.action
      : "save-draft";
    const body = {
      action,
      ownerId: this.#ownerId()
    };
    if (action === "restore-draft") {
      body.historyId = String(incoming.historyId || "").slice(0, 180);
    } else {
      body.catalog = normalizeCommerceCatalog(incoming.catalog);
    }
    return normalizeCommerceState(await this.#api("/api/admin/commerce", {
      method: "PUT",
      body
    }));
  }

  async grantTrial(incoming = {}) {
    return this.#api("/api/admin/trials/grant", {
      method: "POST",
      body: normalizeTrialRequest(incoming, this.#ownerId())
    });
  }

  async updateTrial(incoming = {}) {
    if (incoming.onlyAgencyCounting === true) {
      const trialId = String(incoming.trialId || "").slice(0, 180);
      if (!trialId || typeof incoming.countsForAgency !== "boolean") {
        throw new Error("Essai ou choix de comptage invalide.");
      }
      return this.#api("/api/admin/trials/update", {
        method: "POST",
        body: { ownerId: this.#ownerId(), trialId, onlyAgencyCounting: true, countsForAgency: incoming.countsForAgency }
      });
    }
    const body = normalizeTrialRequest(incoming, this.#ownerId());
    body.trialId = String(incoming.trialId || "").slice(0, 180);
    if (!body.trialId) throw new Error("Essai introuvable.");
    return this.#api("/api/admin/trials/update", {
      method: "POST",
      body
    });
  }

  async revokeTrial(incoming = {}) {
    const trialId = String(incoming.trialId || "").slice(0, 180);
    if (!trialId) throw new Error("Essai introuvable.");
    return this.#api("/api/admin/trials/revoke", {
      method: "POST",
      body: { ownerId: this.#ownerId(), trialId }
    });
  }

  async #publicCommerceFallback() {
    const response = await this.fetch(
      `${SHENPULSE_API_URL}/api/payments/config?channel=prod`,
      {
        headers: { "Cache-Control": "no-store" },
        signal: AbortSignal.timeout(15000)
      }
    );
    const payload = await readPayload(response);
    if (!response.ok) throw new Error(remoteErrorMessage(payload, response));
    return commerceStateFromPublicConfig(payload);
  }

  async #publishPublicVisibility(settings, token) {
    const response = await this.fetch(
      `${FIREBASE_DATABASE_URL}/site/publicVisibility.json?auth=${encodeURIComponent(token)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify(publicVisibilityDocument(settings))
      }
    );
    const payload = await readPayload(response);
    if (!response.ok) {
      throw new Error(
        `Les réglages administrateur sont enregistrés, mais leur visibilité publique n’a pas pu être publiée : ${remoteErrorMessage(payload, response)}`
      );
    }
  }

  async #publishGameCheatAccess(settings, token) {
    const response = await this.fetch(
      `${FIREBASE_DATABASE_URL}/site/gameCheatAccess.json?auth=${encodeURIComponent(token)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify(gameCheatAccessGrantMap(settings))
      }
    );
    const payload = await readPayload(response);
    if (!response.ok) {
      throw new Error(
        `La liste privée est enregistrée, mais les droits de triche n’ont pas pu être publiés : ${remoteErrorMessage(payload, response)}`
      );
    }
  }

  #cachePublicVisibility(settings) {
    this.store.set?.(
      "settings.siteVisibility",
      normalizePublicVisibility(settings)
    );
  }

  async #api(path, { method = "GET", body, retry = true } = {}) {
    const token = await this.#token();
    const response = await this.fetch(`${SHENPULSE_API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      signal: AbortSignal.timeout(15000),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await readPayload(response);
    if (!response.ok) {
      if (retry && (response.status === 401 || response.status === 403)) {
        this.expiresAt = 0;
        return this.#api(path, { method, body, retry: false });
      }
      throw new Error(remoteErrorMessage(payload, response));
    }
    return payload;
  }

  async #token() {
    const accountIdentity = await this.#accountAdminIdentity();
    if (accountIdentity) return accountIdentity.idToken;
    if (this.accountAdminSession) {
      this.accountAdminSession = null;
      this.idToken = "";
      this.expiresAt = 0;
    }
    if (
      this.idToken &&
      this.expiresAt - Date.now() > 2 * 60 * 1000 &&
      this.#session().email === ADMIN_EMAIL &&
      this.#session().emailVerified === true
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
    if (normalizeEmail(session.email) !== ADMIN_EMAIL || !cleanUid(session.uid)) {
      throw new Error("Session administrateur absente.");
    }
    const refreshToken = this.store.getSecret(session.refreshTokenSecretId);
    if (!refreshToken) throw new Error("Session administrateur expirée.");

    const response = await this.fetch(
      `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(15000),
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken
        }).toString()
      }
    );
    const payload = await readPayload(response);
    if (!response.ok) throw new Error(firebaseErrorMessage(payload));
    const uid = cleanUid(payload.user_id);
    const tokenClaims = firebaseTokenClaims(payload.id_token);
    if (
      uid !== cleanUid(session.uid) ||
      tokenClaims.email_verified !== true ||
      normalizeEmail(tokenClaims.email) !== ADMIN_EMAIL ||
      cleanUid(tokenClaims.user_id || tokenClaims.sub) !== uid ||
      !payload.id_token
    ) {
      throw new Error("La session Firebase ne correspond plus à l’administrateur.");
    }
    if (payload.refresh_token && payload.refresh_token !== refreshToken) {
      this.store.setSecret(session.refreshTokenSecretId, String(payload.refresh_token));
    }
    this.idToken = String(payload.id_token);
    this.expiresAt =
      Date.now() + Math.max(60, Number(payload.expires_in) || 3600) * 1000;
    return this.idToken;
  }

  #ownerId() {
    const uid = cleanUid(this.#session().uid);
    if (!uid) throw new Error("Reconnectez le compte administrateur.");
    return uid;
  }

  #session() {
    return (
      this.accountAdminSession ||
      readState(this.store, ["settings.admin"]).settings.admin ||
      {}
    );
  }

  async #accountAdminIdentity() {
    if (
      !this.accountService ||
      typeof this.accountService.identityForInternalUse !== "function"
    ) {
      return null;
    }
    try {
      const identity =
        await this.accountService.identityForInternalUse();
      if (
        normalizeEmail(identity.email) !== ADMIN_EMAIL ||
        identity.emailVerified !== true ||
        !cleanUid(identity.uid) ||
        !identity.idToken
      ) {
        return null;
      }
      this.accountAdminSession = {
        email: ADMIN_EMAIL,
        emailVerified: true,
        uid: cleanUid(identity.uid),
        lastAuthenticatedAt: new Date().toISOString(),
        source: "account"
      };
      this.idToken = String(identity.idToken);
      return {
        ...this.accountAdminSession,
        idToken: this.idToken
      };
    } catch {
      return null;
    }
  }

  #publicStatus(authorized) {
    const session = this.#session();
    return {
      authorized: Boolean(
        authorized &&
          normalizeEmail(session.email) === ADMIN_EMAIL &&
          session.emailVerified === true &&
          cleanUid(session.uid)
      ),
      email: authorized ? ADMIN_EMAIL : "",
      uid: authorized ? cleanUid(session.uid) : "",
      lastAuthenticatedAt: authorized ? String(session.lastAuthenticatedAt || "") : ""
    };
  }

  #clearSession() {
    const session = this.#session();
    if (session.refreshTokenSecretId) {
      this.store.setSecret(session.refreshTokenSecretId, "");
    }
    this.idToken = "";
    this.expiresAt = 0;
    this.accountAdminSession = null;
    this.store.set("settings.admin", {
      email: "",
      emailVerified: false,
      uid: "",
      refreshTokenSecretId: "",
      lastAuthenticatedAt: ""
    });
  }
}

module.exports = {
  ADMIN_EMAIL,
  AdminService,
  PUBLIC_VISIBILITY_SECTIONS,
  VISIBILITY_SECTIONS,
  normalizeCommerceCatalog,
  normalizeCommerceState,
  commerceStateFromPublicConfig,
  normalizePublicVisibility,
  normalizeSiteSettings,
  normalizeTrialRequest
};
