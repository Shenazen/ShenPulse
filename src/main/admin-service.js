"use strict";

const ADMIN_EMAIL = "alexandre.leuridan@gmail.com";
const FIREBASE_API_KEY = "AIzaSyDHcC8ngIhy2Av8N7J-XdCQq9G8KimGGJk";
const FIREBASE_DATABASE_URL =
  "https://shenazenoverlay-default-rtdb.firebaseio.com";
const SHENPULSE_API_URL = "https://shenpulse.leuridan.fr";
const PUBLIC_VISIBILITY_SECTIONS = Object.freeze([
  "navigation",
  "features",
  "actionTypes",
  "overlays",
  "games"
]);
const VISIBILITY_SECTIONS = Object.freeze([
  "navigation",
  "features",
  "games",
  "overlays",
  "setupFeatures",
  "actionTypes",
  "maintenanceFeatures"
]);

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
      this.store.getState?.().settings?.siteVisibility
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
      commerce = commerceResult.value;
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
    return this.#api("/api/admin/commerce", {
      method: "PUT",
      body
    });
  }

  async grantTrial(incoming = {}) {
    return this.#api("/api/admin/trials/grant", {
      method: "POST",
      body: normalizeTrialRequest(incoming, this.#ownerId())
    });
  }

  async updateTrial(incoming = {}) {
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
        body: JSON.stringify(normalizePublicVisibility(settings))
      }
    );
    const payload = await readPayload(response);
    if (!response.ok) {
      throw new Error(
        `Les réglages administrateur sont enregistrés, mais leur visibilité publique n’a pas pu être publiée : ${remoteErrorMessage(payload, response)}`
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
      this.store.getState().settings.admin ||
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

function normalizeSiteSettings(value) {
  const candidate = value && typeof value === "object" ? value : {};
  const result = {
    schemaVersion: Math.max(1, Math.min(100, Number(candidate.schemaVersion) || 6)),
    actionTypeOverrides: {},
    cheatAccess: {}
  };
  for (const section of VISIBILITY_SECTIONS) {
    const source =
      candidate[section] && typeof candidate[section] === "object"
        ? candidate[section]
        : {};
    result[section] = {};
    for (const [rawId, rawConfig] of Object.entries(source).slice(0, 500)) {
      const id = cleanKey(rawId);
      if (!id) continue;
      result[section][id] = { scope: normalizeScope(rawConfig) };
    }
  }
  for (const [rawId, enabled] of Object.entries(
    candidate.actionTypeOverrides || {}
  ).slice(0, 500)) {
    const id = cleanKey(rawId);
    if (id) result.actionTypeOverrides[id] = enabled !== false;
  }
  for (const [rawId, rawAccess] of Object.entries(candidate.cheatAccess || {}).slice(
    0,
    100
  )) {
    const id = cleanKey(rawId);
    if (!id) continue;
    const entries = Array.isArray(rawAccess?.entries) ? rawAccess.entries : [];
    result.cheatAccess[id] = {
      entries: entries
        .slice(0, 250)
        .map((entry) => ({
          email: normalizeEmail(entry?.email).slice(0, 254),
          username: cleanUsername(entry?.username)
        }))
        .filter((entry) => entry.email && entry.username)
    };
  }
  return result;
}

function normalizePublicVisibility(value) {
  const candidate = value && typeof value === "object" ? value : {};
  const result = {
    schemaVersion: Math.max(
      7,
      Math.min(100, Number(candidate.schemaVersion) || 7)
    )
  };
  for (const section of PUBLIC_VISIBILITY_SECTIONS) {
    const source =
      candidate[section] && typeof candidate[section] === "object"
        ? candidate[section]
        : {};
    result[section] = {};
    for (const [rawId, rawConfig] of Object.entries(source).slice(0, 500)) {
      const id = cleanKey(rawId);
      if (!id) continue;
      result[section][id] = { scope: normalizeScope(rawConfig) };
    }
  }
  return result;
}

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

function normalizeTrialRequest(value, ownerId) {
  const email = normalizeEmail(
    value.email || value.beneficiaryEmail || value.recipientEmail
  );
  const games = Boolean(value.games);
  const subscription = Boolean(value.subscription);
  if (!email) {
    throw new Error(
      "Renseignez l’adresse e-mail du compte ShenPulse bénéficiaire."
    );
  }
  if (!games && !subscription) {
    throw new Error("Choisissez au moins l’abonnement Pro ou des jeux.");
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

function normalizeAdminModuleError(error, moduleName) {
  const raw = String(error?.message || error || "").slice(0, 500);
  if (
    moduleName === "commerce" &&
    /index not defined|indexOn|adminCommerce\/history|savedAt/i.test(raw)
  ) {
    return {
      code: "firebase-index-missing",
      message:
        "L’index Firebase de l’historique commercial manque encore. Les autres outils admin restent disponibles et le catalogue est affiché en lecture de secours."
    };
  }
  return {
    code: "module-unavailable",
    message:
      moduleName === "trials"
        ? "Le service des offres d’essai est temporairement indisponible."
        : "Le service commercial est temporairement indisponible."
  };
}

function normalizeScope(value) {
  const scope =
    value && typeof value === "object" ? value.scope : value;
  if (scope === false) return "hidden";
  return scope === "admin" || scope === "hidden" ? scope : "public";
}

function normalizeMoney(value, fallback) {
  const amount = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(amount) && amount >= 0
    ? amount.toFixed(2)
    : fallback;
}

function normalizeCurrency(value) {
  const currency = String(value || "EUR")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
  return currency.length === 3 ? currency : "EUR";
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function cleanUid(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 160);
}

function cleanKey(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9:._-]/g, "")
    .slice(0, 180);
}

function cleanUsername(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9._]/g, "")
    .slice(0, 30);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function firebaseTokenClaims(token) {
  try {
    const payload = String(token || "").split(".")[1] || "";
    if (!payload) return {};
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return {};
  }
}

async function readPayload(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 500) };
  }
}

function firebaseErrorMessage(payload) {
  const code = String(payload?.error?.message || payload?.error || "");
  if (/INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD/.test(code)) {
    return "Adresse ou mot de passe administrateur incorrect.";
  }
  if (/TOO_MANY_ATTEMPTS/.test(code)) {
    return "Trop de tentatives. Réessayez dans quelques minutes.";
  }
  if (/USER_DISABLED/.test(code)) return "Ce compte administrateur est désactivé.";
  return "Connexion Firebase impossible. Vérifiez le compte et réessayez.";
}

function remoteErrorMessage(payload, response) {
  return String(
    payload?.error?.message ||
      payload?.error ||
      payload?.message ||
      `Service ShenPulse indisponible (HTTP ${response.status}).`
  ).slice(0, 500);
}

module.exports = {
  ADMIN_EMAIL,
  AdminService,
  PUBLIC_VISIBILITY_SECTIONS,
  VISIBILITY_SECTIONS,
  normalizeCommerceCatalog,
  commerceStateFromPublicConfig,
  normalizePublicVisibility,
  normalizeSiteSettings,
  normalizeTrialRequest
};
