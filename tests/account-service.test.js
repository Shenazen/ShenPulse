"use strict";

const {
  readOverlayRuntimeSource,
  readOverlayStyles,
  readRendererSource,
  readRendererStyles
} = require("./helpers/source-bundles");

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  AccountService,
  createGoogleIdTokenLoopback,
  createPaymentLoopbackCallback
} = require("../src/main/account-service");
const { createDefaultState } = require("../src/main/defaults");
const {
  hasActiveGameSubscription,
  hasGameEntitlement
} = require("../src/main/game-access");

function createStore() {
  const state = createDefaultState();
  const secrets = new Map();
  let secretSequence = 0;
  const store = {
    state,
    secrets,
    activeAccountUid: "",
    getState: () => structuredClone(state),
    mutate(callback) {
      callback(state);
      return structuredClone(state);
    },
    set(path, value) {
      const parts = String(path).split(".");
      let target = state;
      while (parts.length > 1) {
        const part = parts.shift();
        target = target[part];
      }
      target[parts[0]] = structuredClone(value);
    },
    setSecret(secretId, value) {
      const id = secretId || `secret_${++secretSequence}`;
      if (value) secrets.set(id, value);
      else secrets.delete(id);
      return id;
    },
    getSecret: (secretId) => secrets.get(secretId) || "",
    activateAccount(uid) {
      store.activeAccountUid = String(uid || "");
    },
    deactivateAccount() {
      store.activeAccountUid = "";
    }
  };
  return store;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

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

test("matérialise immédiatement un essai Pro renvoyé par le serveur", async () => {
  const store = createStore();
  const beforeSync = Date.now();
  const service = new AccountService({
    store,
    fetchImpl: async (url) => {
      if (String(url).includes("accounts:lookup")) {
        return jsonResponse({
          users: [{
            email: "trial-user@example.com",
            localId: "trial_user_uid",
            emailVerified: true
          }]
        });
      }
      if (String(url).includes("/api/account/entitlements")) {
        return jsonResponse({
          checkedAt: new Date().toISOString(),
          gameEntitlements: [{
            expiresAtMs: beforeSync + 15 * 86_400_000,
            productId: "connect-four",
            source: "trial"
          }],
          source: "trial",
          tier: "pro"
        });
      }
      return jsonResponse({
        email: "trial-user@example.com",
        localId: "trial_user_uid",
        idToken: "id-token",
        refreshToken: "refresh-token",
        expiresIn: "3600"
      });
    }
  });

  await service.login({
    email: "trial-user@example.com",
    password: "mot-de-passe"
  });

  assert.equal(store.state.commerce.subscription.tier, "pro");
  assert.equal(store.state.commerce.subscription.source, "trial");
  assert.equal(
    store.state.commerce.subscription.expiresAtMs > beforeSync,
    true
  );
  assert.equal(hasActiveGameSubscription(store.state), true);
  assert.equal(
    hasGameEntitlement(
      store.state,
      { id: "connect-four", accessMode: "purchase" }
    ),
    true
  );
  assert.equal(
    store.state.commerce.gameEntitlements[0].gameId,
    "connect-four"
  );
});

test("utilise l’accès public vérifié si la synchronisation privée échoue", async () => {
  const store = createStore();
  const beforeSync = Date.now();
  const service = new AccountService({
    store,
    fetchImpl: async (url) => {
      if (String(url).includes("accounts:lookup")) {
        return jsonResponse({
          users: [{
            email: "trial-fallback@example.com",
            localId: "trial_fallback_uid",
            emailVerified: true
          }]
        });
      }
      if (String(url).includes("/api/account/entitlements")) {
        return jsonResponse(
          { error: "Synchronisation privée indisponible" },
          503
        );
      }
      if (String(url).includes("/api/entitlements/subscription")) {
        return jsonResponse({
          checkedAt: new Date().toISOString(),
          expiresAt: new Date(
            beforeSync + 15 * 86_400_000
          ).toISOString(),
          expiresAtMs: beforeSync + 15 * 86_400_000,
          gameEntitlements: [{
            expiresAtMs: beforeSync + 15 * 86_400_000,
            gameId: "coin-pusher",
            productId: "coin-pusher",
            source: "trial"
          }],
          source: "trial",
          tier: "pro"
        });
      }
      return jsonResponse({
        email: "trial-fallback@example.com",
        localId: "trial_fallback_uid",
        idToken: "id-token",
        refreshToken: "refresh-token",
        expiresIn: "3600"
      });
    }
  });

  await service.login({
    email: "trial-fallback@example.com",
    password: "mot-de-passe"
  });

  assert.equal(hasActiveGameSubscription(store.state), true);
  assert.equal(
    hasGameEntitlement(
      store.state,
      { id: "coin-pusher", accessMode: "purchase" }
    ),
    true
  );
});

test("ouvre le checkout PayPal même si l’e-mail du compte n’est pas vérifié", async () => {
  const store = createStore();
  const openedUrls = [];
  let checkoutRequest = null;
  let syncRequest = null;
  const service = new AccountService({
    store,
    openExternal: async (url) => {
      openedUrls.push(url);
      const callbackUrl = new URL(
        `http://127.0.0.1:${checkoutRequest.body.desktopCallbackPort}/payment-callback`
      );
      callbackUrl.searchParams.set(
        "state",
        checkoutRequest.body.desktopCallbackState
      );
      callbackUrl.searchParams.set("status", "success");
      callbackUrl.searchParams.set(
        "subscription_id",
        "I-SANDBOX"
      );
      const callbackResponse = await fetch(callbackUrl);
      assert.equal(callbackResponse.status, 200);
    },
    fetchImpl: async (url, options = {}) => {
      if (String(url).includes("accounts:lookup")) {
        return jsonResponse({
          users: [{
            email: "sandbox-buyer@example.com",
            localId: "sandbox_buyer_uid",
            emailVerified: false
          }]
        });
      }
      if (String(url).includes("/api/payments/subscriptions/create")) {
        checkoutRequest = {
          authorization: options.headers.Authorization,
          body: JSON.parse(options.body)
        };
        return jsonResponse({
          approvalUrl:
            "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=BA-TEST",
          id: "I-SANDBOX",
          tier: "pro"
        });
      }
      if (String(url).includes("/api/payments/subscriptions/sync")) {
        syncRequest = {
          authorization: options.headers.Authorization,
          body: JSON.parse(options.body)
        };
        return jsonResponse({
          ok: true,
          paypalStatus: "ACTIVE",
          subscriptionId: "I-SANDBOX",
          tier: "pro"
        });
      }
      if (
        String(url).includes("/api/account/entitlements") ||
        String(url).includes("/api/entitlements/subscription")
      ) {
        return jsonResponse({
          checkedAt: "2026-07-30T08:00:00.000Z",
          gameEntitlements: [],
          source: "free",
          tier: "free"
        });
      }
      return jsonResponse({
        email: "sandbox-buyer@example.com",
        localId: "sandbox_buyer_uid",
        idToken: "id-token",
        refreshToken: "refresh-token",
        expiresIn: "3600"
      });
    }
  });

  await service.login({
    email: "sandbox-buyer@example.com",
    password: "mot-de-passe"
  });
  const result = await service.startSubscriptionCheckout({ tier: "pro" });

  assert.equal(result.checkoutOpened, true);
  assert.equal(result.checkoutCompleted, true);
  assert.equal(result.approvalUrl, undefined);
  assert.equal(checkoutRequest.authorization, "Bearer id-token");
  assert.equal(checkoutRequest.body.ownerId, "sandbox_buyer_uid");
  assert.equal(checkoutRequest.body.tier, "pro");
  assert.equal(
    Number.isInteger(checkoutRequest.body.desktopCallbackPort),
    true
  );
  assert.match(
    checkoutRequest.body.desktopCallbackState,
    /^[a-zA-Z0-9_-]{43}$/
  );
  assert.match(checkoutRequest.body.requestId, /^[0-9a-f-]{36}$/i);
  assert.equal(syncRequest.authorization, "Bearer id-token");
  assert.equal(
    Number.isInteger(syncRequest.body.desktopCallbackPort),
    true
  );
  assert.match(
    syncRequest.body.desktopCallbackState,
    /^[a-zA-Z0-9_-]{43}$/
  );
  const {
    desktopCallbackPort: _desktopCallbackPort,
    desktopCallbackState: _desktopCallbackState,
    ...syncBody
  } = syncRequest.body;
  assert.deepEqual(syncBody, {
    ownerId: "sandbox_buyer_uid",
    subscriptionId: "I-SANDBOX",
    tier: "pro",
    token: ""
  });
  assert.deepEqual(openedUrls, [
    "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=BA-TEST"
  ]);
});

test("annule immédiatement l’attente si la fenêtre PayPal a été fermée", async () => {
  const store = createStore();
  let markPayPalOpened;
  const paypalOpened = new Promise((resolve) => {
    markPayPalOpened = resolve;
  });
  let syncCalls = 0;
  const service = new AccountService({
    store,
    openExternal: async () => {
      markPayPalOpened();
    },
    fetchImpl: async (url) => {
      if (String(url).includes("accounts:lookup")) {
        return jsonResponse({
          users: [{
            email: "cancelled-buyer@example.com",
            localId: "cancelled_buyer_uid",
            emailVerified: true
          }]
        });
      }
      if (String(url).includes("/api/payments/subscriptions/create")) {
        return jsonResponse({
          approvalUrl:
            "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=BA-CANCEL",
          id: "I-CANCEL",
          tier: "premium"
        });
      }
      if (String(url).includes("/api/payments/subscriptions/sync")) {
        syncCalls += 1;
        return jsonResponse({
          ok: true,
          paypalStatus: "ACTIVE",
          subscriptionId: "I-CANCEL",
          tier: "premium"
        });
      }
      if (
        String(url).includes("/api/account/entitlements") ||
        String(url).includes("/api/entitlements/subscription")
      ) {
        return jsonResponse({
          checkedAt: "2026-07-30T08:00:00.000Z",
          gameEntitlements: [],
          source: "free",
          tier: "free"
        });
      }
      return jsonResponse({
        email: "cancelled-buyer@example.com",
        localId: "cancelled_buyer_uid",
        idToken: "id-token",
        refreshToken: "refresh-token",
        expiresIn: "3600"
      });
    }
  });

  await service.login({
    email: "cancelled-buyer@example.com",
    password: "mot-de-passe"
  });
  const checkout = service.startSubscriptionCheckout({
    tier: "premium"
  });
  await paypalOpened;

  assert.deepEqual(
    service.cancelCheckout({ type: "subscription" }),
    {
      cancelled: true,
      pending: true,
      type: "subscription"
    }
  );
  assert.deepEqual(await checkout, {
    cancelled: true,
    checkoutOpened: true,
    id: "I-CANCEL",
    tier: "premium"
  });
  assert.equal(syncCalls, 0);
  assert.equal(
    service.cancelCheckout({ type: "subscription" }).cancelled,
    false
  );
});

test("programme l’arrêt PayPal et conserve l’abonnement jusqu’à l’échéance", async () => {
  const store = createStore();
  const effectiveAt = "2026-09-15T10:00:00.000Z";
  let cancelRequest = null;
  const service = new AccountService({
    store,
    fetchImpl: async (url, options = {}) => {
      if (String(url).includes("accounts:lookup")) {
        return jsonResponse({
          users: [{
            email: "subscriber@example.com",
            localId: "subscriber_uid",
            emailVerified: true
          }]
        });
      }
      if (String(url).includes("/api/payments/subscriptions/cancel")) {
        cancelRequest = {
          authorization: options.headers.Authorization,
          body: JSON.parse(options.body)
        };
        return jsonResponse({
          effectiveAt,
          ok: true,
          scheduled: true,
          targetTier: "free",
          tier: "pro"
        });
      }
      if (String(url).includes("/api/account/entitlements")) {
        return jsonResponse({
          checkedAt: "2026-08-11T10:00:00.000Z",
          gameEntitlements: [],
          pendingChange: {
            effectiveAt,
            effectiveAtMs: Date.parse(effectiveAt),
            fromTier: "pro",
            targetTier: "free",
            type: "cancel"
          },
          priceMonthly: 9.99,
          renewalDate: effectiveAt,
          source: "own",
          tier: "pro"
        });
      }
      if (String(url).includes("/api/entitlements/subscription")) {
        return jsonResponse({
          checkedAt: "2026-08-11T10:00:00.000Z",
          gameEntitlements: [],
          priceMonthly: 9.99,
          source: "own",
          tier: "pro"
        });
      }
      return jsonResponse({
        email: "subscriber@example.com",
        localId: "subscriber_uid",
        idToken: "id-token",
        refreshToken: "refresh-token",
        expiresIn: "3600"
      });
    }
  });

  await service.login({
    email: "subscriber@example.com",
    password: "mot-de-passe"
  });
  const result = await service.stopSubscription();

  assert.equal(cancelRequest.authorization, "Bearer id-token");
  assert.deepEqual(cancelRequest.body, { ownerId: "subscriber_uid" });
  assert.equal(result.scheduled, true);
  assert.equal(store.state.commerce.subscription.tier, "pro");
  assert.equal(store.state.commerce.subscription.status, "active");
  assert.deepEqual(store.state.commerce.subscription.pendingChange, {
    effectiveAt,
    effectiveAtMs: Date.parse(effectiveAt),
    fromTier: "pro",
    targetTier: "free",
    type: "cancel"
  });
});

test("achète un jeu sans imposer la vérification de l’e-mail Firebase", async () => {
  const store = createStore();
  const openedUrls = [];
  let createRequest = null;
  let captureRequest = null;
  const service = new AccountService({
    store,
    openExternal: async (url) => {
      openedUrls.push(url);
      const callbackUrl = new URL(
        `http://127.0.0.1:${createRequest.body.desktopCallbackPort}/payment-callback`
      );
      callbackUrl.searchParams.set(
        "state",
        createRequest.body.desktopCallbackState
      );
      callbackUrl.searchParams.set("status", "success");
      callbackUrl.searchParams.set("token", "ORDER-GAME");
      const callbackResponse = await fetch(callbackUrl);
      assert.equal(callbackResponse.status, 200);
    },
    fetchImpl: async (url, options = {}) => {
      if (String(url).includes("accounts:lookup")) {
        return jsonResponse({
          users: [{
            email: "game-buyer@example.com",
            localId: "game_buyer_uid",
            emailVerified: false
          }]
        });
      }
      if (String(url).includes("/api/payments/orders/create")) {
        createRequest = {
          authorization: options.headers.Authorization,
          body: JSON.parse(options.body)
        };
        return jsonResponse({
          approvalUrl:
            "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-GAME",
          amount: "4.99",
          currency: "EUR",
          id: "ORDER-GAME",
          productId: "coin-pusher"
        });
      }
      if (String(url).includes("/api/payments/orders/capture")) {
        captureRequest = {
          authorization: options.headers.Authorization,
          body: JSON.parse(options.body)
        };
        return jsonResponse({
          ok: true,
          orderId: "ORDER-GAME",
          productId: "coin-pusher"
        });
      }
      if (String(url).includes("/api/account/entitlements")) {
        return new Response(
          "<!doctype html><html><body>ShenPulse</body></html>",
          {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" }
          }
        );
      }
      if (String(url).includes("/api/entitlements/subscription")) {
        return jsonResponse({
          checkedAt: "2026-07-30T08:00:00.000Z",
          gameEntitlements: [],
          source: "own",
          tier: "pro"
        });
      }
      return jsonResponse({
        email: "game-buyer@example.com",
        localId: "game_buyer_uid",
        idToken: "id-token",
        refreshToken: "refresh-token",
        expiresIn: "3600"
      });
    }
  });

  await service.login({
    email: "game-buyer@example.com",
    password: "mot-de-passe"
  });
  const result = await service.startGameCheckout({
    productId: "coin-pusher"
  });

  assert.equal(result.checkoutOpened, true);
  assert.equal(result.checkoutCompleted, true);
  assert.equal(result.approvalUrl, undefined);
  assert.equal(result.orderId, "ORDER-GAME");
  assert.equal(result.productId, "coin-pusher");
  assert.equal(createRequest.authorization, "Bearer id-token");
  assert.equal(createRequest.body.ownerId, "game_buyer_uid");
  assert.equal(createRequest.body.productId, "coin-pusher");
  assert.equal(
    Number.isInteger(createRequest.body.desktopCallbackPort),
    true
  );
  assert.match(
    createRequest.body.desktopCallbackState,
    /^[a-zA-Z0-9_-]{43}$/
  );
  assert.match(createRequest.body.requestId, /^[0-9a-f-]{36}$/i);
  assert.equal(captureRequest.authorization, "Bearer id-token");
  assert.deepEqual(captureRequest.body, {
    orderId: "ORDER-GAME",
    ownerId: "game_buyer_uid",
    productId: "coin-pusher",
    token: "ORDER-GAME"
  });
  assert.deepEqual(openedUrls, [
    "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-GAME"
  ]);
  assert.equal(
    store.state.commerce.gameEntitlements.some(
      (entry) => entry.gameId === "coin-pusher"
    ),
    true
  );
});

test("un upgrade Premium revient aussi dans l’application après le prorata", async () => {
  const store = createStore();
  const openedUrls = [];
  let checkoutBody = null;
  let syncBody = null;
  let captureBody = null;
  const returnToApp = async (body, parameters) => {
    const callbackUrl = new URL(
      `http://127.0.0.1:${body.desktopCallbackPort}/payment-callback`
    );
    callbackUrl.searchParams.set(
      "state",
      body.desktopCallbackState
    );
    callbackUrl.searchParams.set("status", "success");
    for (const [key, value] of Object.entries(parameters)) {
      callbackUrl.searchParams.set(key, value);
    }
    const response = await fetch(callbackUrl);
    assert.equal(response.status, 200);
  };
  const service = new AccountService({
    store,
    openExternal: async (url) => {
      openedUrls.push(url);
      if (openedUrls.length === 1) {
        await returnToApp(checkoutBody, {
          subscription_id: "I-UPGRADE"
        });
      } else {
        await returnToApp(syncBody, {
          token: "ORDER-PRORATION"
        });
      }
    },
    fetchImpl: async (url, options = {}) => {
      if (String(url).includes("accounts:lookup")) {
        return jsonResponse({
          users: [{
            email: "upgrade-buyer@example.com",
            localId: "upgrade_buyer_uid",
            emailVerified: true
          }]
        });
      }
      if (String(url).includes("/api/payments/subscriptions/create")) {
        checkoutBody = JSON.parse(options.body);
        return jsonResponse({
          approvalUrl:
            "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=BA-UPGRADE",
          id: "I-UPGRADE",
          tier: "premium"
        });
      }
      if (String(url).includes("/api/payments/subscriptions/sync")) {
        syncBody = JSON.parse(options.body);
        return jsonResponse({
          approvalUrl:
            "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-PRORATION",
          ok: true,
          requiresProrationPayment: true,
          subscriptionId: "I-UPGRADE",
          targetTier: "premium",
          tier: "pro"
        });
      }
      if (
        String(url).includes(
          "/api/payments/subscriptions/proration/capture"
        )
      ) {
        captureBody = JSON.parse(options.body);
        return jsonResponse({
          ok: true,
          subscriptionId: "I-UPGRADE",
          tier: "premium"
        });
      }
      if (
        String(url).includes("/api/account/entitlements") ||
        String(url).includes("/api/entitlements/subscription")
      ) {
        return jsonResponse({
          checkedAt: "2026-07-30T08:00:00.000Z",
          gameEntitlements: [],
          source: "own",
          status: "active",
          tier: "premium"
        });
      }
      return jsonResponse({
        email: "upgrade-buyer@example.com",
        localId: "upgrade_buyer_uid",
        idToken: "id-token",
        refreshToken: "refresh-token",
        expiresIn: "3600"
      });
    }
  });

  await service.login({
    email: "upgrade-buyer@example.com",
    password: "mot-de-passe"
  });
  const result = await service.startSubscriptionCheckout({
    tier: "premium"
  });

  assert.equal(result.checkoutCompleted, true);
  assert.equal(result.requiresProrationPayment, false);
  assert.equal(result.tier, "premium");
  assert.deepEqual(captureBody, {
    orderId: "ORDER-PRORATION",
    ownerId: "upgrade_buyer_uid",
    subscriptionId: "I-UPGRADE",
    tier: "premium",
    token: "ORDER-PRORATION"
  });
  assert.deepEqual(openedUrls, [
    "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=BA-UPGRADE",
    "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-PRORATION"
  ]);
});

test("refuse un lien de checkout qui ne pointe pas vers PayPal", async () => {
  const store = createStore();
  let opened = false;
  const service = new AccountService({
    store,
    openExternal: async () => {
      opened = true;
    },
    fetchImpl: async (url) => {
      if (String(url).includes("accounts:lookup")) {
        return jsonResponse({
          users: [{
            email: "sandbox-buyer@example.com",
            localId: "sandbox_buyer_uid",
            emailVerified: true
          }]
        });
      }
      if (String(url).includes("/api/payments/subscriptions/create")) {
        return jsonResponse({
          approvalUrl: "https://example.com/faux-paypal",
          id: "I-SANDBOX",
          tier: "premium"
        });
      }
      if (
        String(url).includes("/api/account/entitlements") ||
        String(url).includes("/api/entitlements/subscription")
      ) {
        return jsonResponse({
          checkedAt: "2026-07-30T08:00:00.000Z",
          gameEntitlements: [],
          source: "free",
          tier: "free"
        });
      }
      return jsonResponse({
        email: "sandbox-buyer@example.com",
        localId: "sandbox_buyer_uid",
        idToken: "id-token",
        refreshToken: "refresh-token",
        expiresIn: "3600"
      });
    }
  });

  await service.login({
    email: "sandbox-buyer@example.com",
    password: "mot-de-passe"
  });
  await assert.rejects(
    service.startSubscriptionCheckout({ tier: "premium" }),
    /ne pointe pas vers PayPal/
  );
  assert.equal(opened, false);
});

test("le retour PayPal local vérifie le jeton et distingue une annulation", async () => {
  const state = "a".repeat(43);
  const cancelledCallback = await createPaymentLoopbackCallback({
    state,
    timeoutMs: 2000
  });
  const cancelledUrl = new URL(
    `http://127.0.0.1:${cancelledCallback.port}/payment-callback`
  );
  cancelledUrl.searchParams.set("state", state);
  cancelledUrl.searchParams.set("status", "cancelled");
  const cancelledResponse = await fetch(cancelledUrl);
  assert.equal(cancelledResponse.status, 200);
  assert.deepEqual(await cancelledCallback.result, {
    cancelled: true,
    subscriptionId: "",
    token: ""
  });

  const protectedCallback = await createPaymentLoopbackCallback({
    state,
    timeoutMs: 2000
  });
  const forgedUrl = new URL(
    `http://127.0.0.1:${protectedCallback.port}/payment-callback`
  );
  forgedUrl.searchParams.set("state", "b".repeat(43));
  forgedUrl.searchParams.set("status", "success");
  const forgedResponse = await fetch(forgedUrl);
  assert.equal(forgedResponse.status, 400);
  await assert.rejects(
    protectedCallback.result,
    /n’a pas pu être vérifié/
  );
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

test("la carte latérale expose l’email et une vraie déconnexion", () => {
  const renderer = readRendererSource();
  const markup = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "src",
      "renderer",
      "index.html"
    ),
    "utf8"
  );
  const main = fs.readFileSync(
    path.join(__dirname, "..", "src", "main", "main.js"),
    "utf8"
  );
  assert.match(markup, /id="account-email"/);
  assert.match(markup, /data-action="account-logout"/);
  assert.match(renderer, /accountSession\.email/);
  assert.match(renderer, /api\.account\.logout\(\)/);
  assert.match(renderer, /function visibleAccountSession\(\)/);
  assert.match(renderer, /if \(isVerifiedAdminSession\(\)\)/);
  assert.match(renderer, /await api\.admin\.logout\(\)/);
  assert.match(markup, /id="account-auth-cta"/);
  assert.match(renderer, /api\.account\.register/);
  assert.match(renderer, /api\.account\s*\.loginWithBrowser/);
  assert.doesNotMatch(
    renderer,
    /vérifiez l’e-mail reçu avant tout paiement/
  );
  assert.match(main, /screen\.getPrimaryDisplay\(\)\.workAreaSize/);
});
