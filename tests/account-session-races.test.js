"use strict";

/** Courses entièrement synthétiques : aucun compte réel, coffre ou appel réseau. */
const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const { AccountService } = require("../src/main/account-service");
const { createStore, jsonResponse } = require("./helpers/account-service-fixtures");

const ACCOUNT_A = { uid: "synthetic-account-a", email: "a@example.invalid", token: "synthetic-token-a", refresh: "synthetic-refresh-a" };
const ACCOUNT_B = { uid: "synthetic-account-b", email: "b@example.invalid", token: "synthetic-token-b", refresh: "synthetic-refresh-b" };
const FREE = { tier: "free", source: "free", gameEntitlements: [] };

function deferred() {
  let resolve, reject;
  const promise = new Promise((accept, refuse) => { resolve = accept; reject = refuse; });
  return { promise, resolve, reject };
}

function authPayload(account) {
  return { email: account.email, localId: account.uid, idToken: account.token, refreshToken: account.refresh, expiresIn: "3600" };
}

function lookupPayload(account) {
  return { users: [{ email: account.email, localId: account.uid, emailVerified: true, providerUserInfo: [{ providerId: "password" }] }] };
}

function settle(promise) {
  // Attacher immédiatement le refus : une opération peut être invalidée avant
  // la réponse simulée sans créer de rejet non observé pendant le test.
  return promise.then((value) => ({ value }), (error) => ({ error }));
}

function stale(error) {
  assert.equal(error?.code, "ACCOUNT_SESSION_CHANGED");
  assert.equal(error.staleSession, true);
  assert.notEqual(error.invalidSession, true);
}

function fixture({ initial = ACCOUNT_A, expired = false, intercept = async () => undefined } = {}) {
  const store = createStore();
  if (initial) {
    const refreshTokenSecretId = store.setSecret("initial-refresh", initial.refresh);
    store.state.settings.account = { uid: initial.uid, email: initial.email, emailVerified: true, refreshTokenSecretId };
    store.activateAccount(initial.uid);
  }
  const service = new AccountService({
    store,
    fetchImpl: async (url, options = {}) => {
      const target = String(url);
      const body = options.body && options.headers?.["Content-Type"] === "application/x-www-form-urlencoded"
        ? Object.fromEntries(new URLSearchParams(options.body))
        : options.body ? JSON.parse(options.body) : {};
      const intercepted = await intercept(target, body);
      if (intercepted !== undefined) return intercepted;
      if (target.includes("accounts:signInWithPassword")) {
        const account = [ACCOUNT_A, ACCOUNT_B].find((item) => item.email === body.email);
        assert.ok(account, "identité synthétique connue requise");
        return jsonResponse(authPayload(account));
      }
      if (target.includes("accounts:lookup")) {
        const account = String(body.idToken).startsWith(ACCOUNT_A.token) || body.idToken === "synthetic-refreshed-a" ? ACCOUNT_A : ACCOUNT_B;
        return jsonResponse(lookupPayload(account));
      }
      if (target.includes("securetoken.googleapis.com")) {
        const account = body.refresh_token === ACCOUNT_A.refresh ? ACCOUNT_A : ACCOUNT_B;
        return jsonResponse({ user_id: account.uid, id_token: account.token, refresh_token: account.refresh, expires_in: "3600" });
      }
      if (target.includes("/api/account/entitlements") || target.includes("/api/entitlements/subscription")) return jsonResponse(FREE);
      assert.fail("aucun autre appel attendu dans les courses synthétiques");
    }
  });
  if (initial) {
    service.idToken = expired ? "" : initial.token;
    service.expiresAt = expired ? 0 : Date.now() + 3600000;
  }
  return { store, service };
}

async function login(service, account = ACCOUNT_B) {
  return service.login({ email: account.email, password: "synthetic-test-password" });
}

function assertCurrentAccount({ store, service }, account = ACCOUNT_B) {
  const current = store.state.settings.account;
  assert.equal(current.uid, account.uid);
  assert.equal(current.email, account.email);
  assert.equal(store.activeAccountUid, account.uid);
  assert.equal(service.idToken, account.token);
  assert.equal(store.getSecret(current.refreshTokenSecretId), account.refresh);
}

function assertOldStatusCannotSignOutB(result) {
  if (result.error) stale(result.error);
  else {
    assert.equal(result.value.authenticated, true);
    assert.equal(result.value.uid, ACCOUNT_B.uid);
  }
}

test("un refresh A tardif ne remplace ni le jeton B ni son secret après connexion B", async () => {
  const entered = deferred(), response = deferred();
  const item = fixture({ expired: true, intercept: async (target, body) => {
    if (target.includes("securetoken.googleapis.com") && body.refresh_token === ACCOUNT_A.refresh) {
      entered.resolve();
      return response.promise;
    }
  } });
  const previousSecretId = item.store.state.settings.account.refreshTokenSecretId;
  const oldStatus = settle(item.service.status());
  await entered.promise;
  await login(item.service);
  assertCurrentAccount(item);
  response.resolve(jsonResponse({ user_id: ACCOUNT_A.uid, id_token: "synthetic-refreshed-a", refresh_token: "synthetic-rotated-a", expires_in: "3600" }));
  assertOldStatusCannotSignOutB(await oldStatus);
  assertCurrentAccount(item);
  assert.equal(item.store.getSecret(previousSecretId), "", "l'ancien refresh ne recrée pas le secret A supprimé");
});

test("un lookup A invalide arrivé après connexion B ne déconnecte jamais B", async () => {
  const entered = deferred(), response = deferred();
  const item = fixture({ intercept: async (target, body) => {
    if (target.includes("accounts:lookup") && body.idToken === ACCOUNT_A.token) {
      entered.resolve();
      return response.promise;
    }
  } });
  const oldStatus = settle(item.service.status());
  await entered.promise;
  await login(item.service);
  response.resolve(jsonResponse({ error: { message: "USER_NOT_FOUND" } }, 400));
  assertOldStatusCannotSignOutB(await oldStatus);
  assertCurrentAccount(item);
});

test("deux connexions concurrentes conservent la dernière demande, pas la dernière réponse", async () => {
  const entered = deferred(), response = deferred();
  const item = fixture({ initial: null, intercept: async (target, body) => {
    if (target.includes("accounts:signInWithPassword") && body.email === ACCOUNT_A.email) {
      entered.resolve();
      return response.promise;
    }
  } });
  const oldLogin = settle(login(item.service, ACCOUNT_A));
  await entered.promise;
  await login(item.service);
  response.resolve(jsonResponse(authPayload(ACCOUNT_A)));
  const result = await oldLogin;
  stale(result.error);
  assertCurrentAccount(item);
  assert.equal([...item.store.secrets.values()].includes(ACCOUNT_A.refresh), false);
});

test("une connexion A interrompue pendant son lookup ne restaure pas A après déconnexion", async () => {
  const entered = deferred(), response = deferred();
  const item = fixture({ initial: null, intercept: async (target, body) => {
    if (target.includes("accounts:lookup") && body.idToken === ACCOUNT_A.token) {
      entered.resolve();
      return response.promise;
    }
  } });
  const oldLogin = settle(login(item.service, ACCOUNT_A));
  await entered.promise;
  item.service.logout();
  response.resolve(jsonResponse(lookupPayload(ACCOUNT_A)));
  const result = await oldLogin;
  stale(result.error);
  assert.equal(item.store.state.settings.account.uid, "");
  assert.equal(item.store.activeAccountUid, "");
  assert.equal(item.service.idToken, "");
  assert.equal([...item.store.secrets.values()].includes(ACCOUNT_A.refresh), false);
});

test("identityForInternalUse ne mélange jamais le token A avec l'identité B", async () => {
  const entered = deferred(), response = deferred();
  const item = fixture({ intercept: async (target, body) => {
    if (target.includes("accounts:lookup") && body.idToken === ACCOUNT_A.token) {
      entered.resolve();
      return response.promise;
    }
  } });
  const oldIdentity = settle(item.service.identityForInternalUse());
  await entered.promise;
  await login(item.service);
  response.resolve(jsonResponse(lookupPayload(ACCOUNT_A)));
  const result = await oldIdentity;
  stale(result.error);
  assertCurrentAccount(item);
});

test("un ancien lookup valide ne réécrit pas le compte A au-dessus du compte B", async () => {
  const entered = deferred(), response = deferred();
  const item = fixture({ intercept: async (target, body) => {
    if (target.includes("accounts:lookup") && body.idToken === ACCOUNT_A.token) {
      entered.resolve();
      return response.promise;
    }
  } });
  const oldStatus = settle(item.service.status());
  await entered.promise;
  await login(item.service);
  response.resolve(jsonResponse(lookupPayload(ACCOUNT_A)));
  assertOldStatusCannotSignOutB(await oldStatus);
  assertCurrentAccount(item);
});

test("une erreur réseau d'un ancien refresh A ne vide pas la connexion B", async () => {
  const entered = deferred(), response = deferred();
  const item = fixture({ expired: true, intercept: async (target, body) => {
    if (target.includes("securetoken.googleapis.com") && body.refresh_token === ACCOUNT_A.refresh) {
      entered.resolve();
      return response.promise;
    }
  } });
  const oldStatus = settle(item.service.status());
  await entered.promise;
  await login(item.service);
  response.reject(new Error("synthetic-network-failure"));
  assertOldStatusCannotSignOutB(await oldStatus);
  assertCurrentAccount(item);
});

test("deux connexions au même UID gardent les derniers jetons et la dernière génération", async () => {
  const entered = deferred(), response = deferred();
  const latest = { ...ACCOUNT_A, token: "synthetic-token-a-latest", refresh: "synthetic-refresh-a-latest" };
  let loginRequests = 0;
  const item = fixture({ initial: null, intercept: async (target, body) => {
    if (target.includes("accounts:signInWithPassword") && body.email === ACCOUNT_A.email) {
      if (++loginRequests === 1) { entered.resolve(); return response.promise; }
      return jsonResponse(authPayload(latest));
    }
  } });
  const oldLogin = settle(login(item.service, ACCOUNT_A));
  await entered.promise;
  await login(item.service, ACCOUNT_A);
  response.resolve(jsonResponse(authPayload(ACCOUNT_A)));
  const result = await oldLogin;
  stale(result.error);
  assertCurrentAccount(item, latest);
});

test("une connexion Google retardée ne rouvre pas le navigateur ni le compte après connexion B", async () => {
  const entered = deferred(), response = deferred();
  const item = fixture({ initial: null, intercept: async (target) => {
    if (target.includes("accounts:createAuthUri")) {
      entered.resolve();
      return response.promise;
    }
  } });
  // Le serveur de retour est local et éphémère ; aucun navigateur ni échange
  // Google réel ne doit être lancé lorsque la réponse arrive périmée.
  item.service.googleLoopbackPort = 0;
  let openings = 0;
  item.service.openExternal = () => { openings++; assert.fail("aucun navigateur réel attendu"); };
  const oldBrowser = settle(item.service.loginWithBrowser({ email: ACCOUNT_A.email }));
  await entered.promise;
  await login(item.service);
  response.resolve(jsonResponse({
    authUri: `https://accounts.google.com/o/oauth2/auth?state=${"s".repeat(64)}`,
    sessionId: "synthetic-browser-session"
  }));
  const result = await oldBrowser;
  stale(result.error);
  assert.equal(openings, 0);
  assertCurrentAccount(item);
});

test("la déconnexion annule le retour Google déjà ouvert et libère immédiatement son port local", { timeout: 2000 }, async (context) => {
  const opened = deferred();
  let callbackUrl;
  const item = fixture({ initial: null, intercept: async (target, body) => {
    if (target.includes("accounts:createAuthUri")) {
      callbackUrl = body.continueUri;
      return jsonResponse({
        authUri: `https://accounts.google.com/o/oauth2/auth?state=${"c".repeat(64)}`,
        sessionId: "synthetic-cancellable-browser-session"
      });
    }
  } });
  item.service.googleLoopbackPort = 0;
  item.service.openExternal = async () => { opened.resolve(); };
  context.after(() => item.service.browserAuthCancel?.());
  const pendingBrowser = settle(item.service.loginWithBrowser({ email: ACCOUNT_A.email }));
  await opened.promise;
  assert.equal(typeof item.service.browserAuthCancel, "function");
  assert.equal(item.service.logout().authenticated, false);
  const result = await pendingBrowser;
  assert.ok(result.error, "la promesse navigateur est bien terminée après annulation");
  assert.notEqual(result.error.invalidSession, true);
  assert.equal(item.service.browserAuthCancel, null);
  assert.equal(item.service.browserAuthPromise, null);
  assert.equal(item.store.state.settings.account.uid, "");
  const port = Number(new URL(callbackUrl).port);
  assert.ok(port > 0);
  const probe = net.createServer();
  context.after(() => new Promise((resolve) => probe.listening ? probe.close(resolve) : resolve()));
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", resolve);
  });
  assert.equal(probe.listening, true, "un nouveau serveur peut réutiliser le même port après logout");
});
