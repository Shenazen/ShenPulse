"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { AccountService, createGoogleIdTokenLoopback } = require("../src/main/account-service");
const { createStore, jsonResponse } = require("./helpers/account-service-fixtures");

/** Authentification, inscription, vérification et conservation de l'identité. */

test("connecte un compte utilisateur sans conserver son mot de passe", async () => {
  const store = createStore();
  let requestBody = null;
  const service = new AccountService({
    store,
    fetchImpl: async (url, options = {}) => {
      if (String(url).includes("accounts:lookup")) {
        return jsonResponse({
          users: [{
            email: "User@Example.com",
            localId: "firebase_uid",
            displayName: "Utilisateur Test",
            emailVerified: true,
            providerUserInfo: [{ providerId: "password" }]
          }]
        });
      }
      if (String(url).includes("/api/account/entitlements")) {
        return jsonResponse({
          checkedAt: "2026-07-29T12:00:00.000Z",
          gameEntitlements: [],
          source: "free",
          tier: "free"
        });
      }
      requestBody = JSON.parse(options.body);
      return jsonResponse({
        email: "User@Example.com",
        localId: "firebase_uid",
        displayName: "Utilisateur Test",
        idToken: "id-token",
        refreshToken: "refresh-token",
        expiresIn: "3600"
      });
    }
  });

  const status = await service.login({
    email: " User@Example.com ",
    password: "mot-de-passe"
  });

  assert.equal(requestBody.password, "mot-de-passe");
  assert.deepEqual(status, {
    authenticated: true,
    email: "user@example.com",
    uid: "firebase_uid",
    displayName: "Utilisateur Test",
    photoUrl: "",
    providerId: "password",
    emailVerified: true,
    lastAuthenticatedAt:
      store.state.settings.account.lastAuthenticatedAt,
    offline: false
  });
  assert.equal(
    store.secrets.get(
      store.state.settings.account.refreshTokenSecretId
    ),
    "refresh-token"
  );
  assert.equal(
    JSON.stringify(store.state.settings.account).includes(
      "mot-de-passe"
    ),
    false
  );
  assert.equal(store.activeAccountUid, "firebase_uid");
  // LIVE heartbeats reuse the main-process token, without exposing private profile fields.
  requestBody = null;
  assert.deepEqual(await service.identityForLiveDirectory(), { uid: "firebase_uid", idToken: "id-token" });
  assert.equal(requestBody, null);
  service.logout();
  await assert.rejects(() => service.identityForLiveDirectory(), /expirée/);
});

test("connecte Google directement avec Firebase et un retour local vérifié", async () => {
  const store = createStore();
  const googleIdToken = "g".repeat(160);
  const googleState = "s".repeat(64);
  let openedUrl = "";
  let createAuthBody = null;
  let signInBody = null;
  const service = new AccountService({
    store,
    googleLoopbackPort: 0,
    openExternal: async (url) => {
      openedUrl = String(url);
      const redirectUri = new URL(openedUrl).searchParams.get(
        "redirect_uri"
      );
      const callbackResponse = await fetch(
        new URL("/callback/complete", redirectUri),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken: googleIdToken,
            state: googleState
          })
        }
      );
      assert.equal(callbackResponse.status, 200);
    },
    fetchImpl: async (url, options = {}) => {
      const target = String(url);
      if (target.includes("accounts:createAuthUri")) {
        createAuthBody = JSON.parse(options.body);
        const authUri = new URL(
          "https://accounts.google.com/o/oauth2/auth"
        );
        authUri.searchParams.set("response_type", "id_token");
        authUri.searchParams.set("redirect_uri", createAuthBody.continueUri);
        authUri.searchParams.set("state", googleState);
        return jsonResponse({
          authUri: authUri.toString(),
          providerId: "google.com",
          sessionId: "firebase-google-session"
        });
      }
      if (target.includes("accounts:signInWithIdp")) {
        signInBody = JSON.parse(options.body);
        return jsonResponse({
          email: "alexandre.leuridan@gmail.com",
          localId: "google-admin-uid",
          displayName: "Alexandre Leuridan",
          idToken: "firebase-id-token",
          refreshToken: "firebase-refresh-token",
          expiresIn: "3600"
        });
      }
      if (target.includes("accounts:lookup")) {
        return jsonResponse({
          users: [{
            email: "alexandre.leuridan@gmail.com",
            localId: "google-admin-uid",
            displayName: "Alexandre Leuridan",
            emailVerified: true,
            providerUserInfo: [{ providerId: "google.com" }]
          }]
        });
      }
      if (target.includes("/api/account/entitlements")) {
        return jsonResponse({
          checkedAt: "2026-08-21T12:00:00.000Z",
          gameEntitlements: [],
          source: "free",
          tier: "free"
        });
      }
      throw new Error(`Appel inattendu: ${target}`);
    }
  });

  const status = await service.loginWithBrowser({
    email: "alexandre.leuridan@gmail.com"
  });

  assert.equal(createAuthBody.identifier, "alexandre.leuridan@gmail.com");
  assert.match(createAuthBody.continueUri, /^http:\/\/localhost:\d+\/callback$/);
  assert.equal(createAuthBody.providerId, "google.com");
  assert.equal(
    new URL(openedUrl).searchParams.get("login_hint"),
    "alexandre.leuridan@gmail.com"
  );
  assert.equal(signInBody.requestUri, createAuthBody.continueUri);
  assert.equal(signInBody.sessionId, "firebase-google-session");
  assert.equal(
    new URLSearchParams(signInBody.postBody).get("id_token"),
    googleIdToken
  );
  assert.equal(
    new URLSearchParams(signInBody.postBody).get("providerId"),
    "google.com"
  );
  assert.equal(status.authenticated, true);
  assert.equal(status.email, "alexandre.leuridan@gmail.com");
  assert.equal(status.providerId, "google.com");
  assert.equal(status.emailVerified, true);
  assert.equal(
    store.secrets.get(
      store.state.settings.account.refreshTokenSecretId
    ),
    "firebase-refresh-token"
  );
});

test("refuse un retour Google avec un état local falsifié", async () => {
  const callback = await createGoogleIdTokenLoopback({
    port: 0,
    timeoutMs: 2000
  });
  callback.expectState("a".repeat(64));
  const response = await fetch(
    new URL("/callback/complete", callback.url),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken: "g".repeat(160),
        state: "b".repeat(64)
      })
    }
  );

  assert.equal(response.status, 400);
  await assert.rejects(callback.result, /n'a pas pu être vérifié/);
});

test("l’inscription refuse deux mots de passe différents avant Firebase", async () => {
  const store = createStore();
  let fetchCalls = 0;
  const service = new AccountService({
    store,
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("ne doit pas être appelé");
    }
  });

  await assert.rejects(
    service.register({
      email: "viewer@example.com",
      password: "mot-de-passe",
      passwordConfirmation: "autre-mot-de-passe"
    }),
    /ne correspondent pas/
  );
  assert.equal(fetchCalls, 0);
});

test("l’inscription explique qu’une adresse Firebase existe déjà", async () => {
  const service = new AccountService({
    store: createStore(),
    fetchImpl: async () =>
      jsonResponse({ error: { message: "EMAIL_EXISTS" } }, 400)
  });

  await assert.rejects(
    service.register({
      email: "viewer@example.com",
      password: "mot-de-passe",
      passwordConfirmation: "mot-de-passe"
    }),
    /déjà utilisée/
  );
});

test("conserve l’identité visible lors d’une coupure réseau", async () => {
  const store = createStore();
  const secretId = store.setSecret("", "refresh-token");
  store.state.settings.account = {
    email: "viewer@example.com",
    uid: "viewer_uid",
    displayName: "Viewer",
    refreshTokenSecretId: secretId,
    lastAuthenticatedAt: "2026-07-29T12:00:00.000Z"
  };
  const service = new AccountService({
    store,
    fetchImpl: async () => {
      throw new TypeError("hors ligne");
    }
  });

  const status = await service.status();

  assert.equal(status.authenticated, true);
  assert.equal(status.email, "viewer@example.com");
  assert.equal(status.offline, true);
  assert.equal(
    store.state.settings.account.refreshTokenSecretId,
    secretId
  );
});

test("resynchronise la vérification Firebase avant d’ouvrir l’administration", async () => {
  const store = createStore();
  const secretId = store.setSecret("", "refresh-token");
  store.state.settings.account = {
    email: "alexandre.leuridan@gmail.com",
    uid: "admin_uid",
    displayName: "Alexandre",
    photoUrl: "",
    providerId: "password",
    emailVerified: false,
    refreshTokenSecretId: secretId,
    lastAuthenticatedAt: "2026-07-29T12:00:00.000Z"
  };
  const service = new AccountService({
    store,
    fetchImpl: async (url) => {
      if (String(url).includes("securetoken.googleapis.com")) {
        return jsonResponse({
          id_token: "refreshed-id-token",
          refresh_token: "refresh-token",
          expires_in: "3600",
          user_id: "admin_uid"
        });
      }
      if (String(url).includes("accounts:lookup")) {
        return jsonResponse({
          users: [{
            email: "alexandre.leuridan@gmail.com",
            localId: "admin_uid",
            displayName: "Alexandre",
            emailVerified: true,
            providerUserInfo: [{ providerId: "password" }]
          }]
        });
      }
      if (String(url).includes("/api/account/entitlements")) {
        return jsonResponse({
          checkedAt: "2026-07-29T12:00:00.000Z",
          gameEntitlements: [],
          source: "free",
          tier: "free"
        });
      }
      throw new Error(`Appel inattendu: ${url}`);
    }
  });

  const status = await service.status();

  assert.equal(status.authenticated, true);
  assert.equal(status.emailVerified, true);
  assert.equal(store.state.settings.account.emailVerified, true);
});

test("la déconnexion efface le jeton et l’identité locale", () => {
  const store = createStore();
  const secretId = store.setSecret("", "refresh-token");
  store.state.settings.account = {
    email: "viewer@example.com",
    uid: "viewer_uid",
    displayName: "Viewer",
    refreshTokenSecretId: secretId,
    lastAuthenticatedAt: "2026-07-29T12:00:00.000Z"
  };
  const service = new AccountService({
    store,
    fetchImpl: async () => {
      throw new Error("ne doit pas être appelé");
    }
  });

  const status = service.logout();

  assert.equal(status.authenticated, false);
  assert.equal(store.secrets.has(secretId), false);
  assert.equal(store.activeAccountUid, "");
  assert.deepEqual(store.state.settings.account, {
    email: "",
    uid: "",
    displayName: "",
    photoUrl: "",
    providerId: "",
    emailVerified: false,
    refreshTokenSecretId: "",
    lastAuthenticatedAt: ""
  });
});
