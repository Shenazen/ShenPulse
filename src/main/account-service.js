"use strict";

const crypto = require("node:crypto");
const http = require("node:http");

const FIREBASE_API_KEY = "AIzaSyDHcC8ngIhy2Av8N7J-XdCQq9G8KimGGJk";
const IDENTITY_BASE_URL = "https://identitytoolkit.googleapis.com/v1";
const TOKEN_BASE_URL = "https://securetoken.googleapis.com/v1";
const DEFAULT_WEB_ORIGIN = "https://shenpulse.leuridan.fr";
const BROWSER_AUTH_TIMEOUT_MS = 10 * 60 * 1000;

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

  async syncEntitlements({ silent = false } = {}) {
    try {
      const token = await this.#token();
      const uid = cleanUid(this.#session().uid);
      if (!uid) throw invalidSessionError("Session ShenPulse expirée.");
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
      this.#applyEntitlements(payload);
      return payload;
    } catch (error) {
      if (silent) return null;
      throw error;
    }
  }

  logout() {
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
    const gameEntitlements = Array.isArray(payload.gameEntitlements)
      ? payload.gameEntitlements
          .map((entry) => ({
            id: String(entry?.id || entry?.productId || "").trim(),
            productId: String(
              entry?.productId || entry?.id || ""
            ).trim(),
            source: String(entry?.source || "purchase").trim(),
            status: "active",
            expiresAt: String(entry?.expiresAt || ""),
            expiresAtMs: Math.max(0, Number(entry?.expiresAtMs) || 0)
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

function browserResponseHtml(success) {
  const title = success ? "Connexion terminée" : "Connexion refusée";
  const detail = success
    ? "Vous pouvez fermer cette page et revenir dans ShenPulse."
    : "Revenez dans ShenPulse puis relancez la connexion.";
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><title>${title}</title><body style="margin:0;background:#090b14;color:#f7f7ff;font-family:system-ui;display:grid;place-items:center;min-height:100vh"><main style="max-width:560px;padding:40px;text-align:center;border:1px solid #563080;border-radius:20px;background:#111426"><h1>${title}</h1><p style="color:#aeb6cf">${detail}</p></main></body></html>`;
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
  normalizeEmail,
  requireEmail
};
