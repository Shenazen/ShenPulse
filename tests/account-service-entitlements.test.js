"use strict";
const { readMainSource } = require("./helpers/main-source-bundles");
const { readRendererSource } = require("./helpers/source-bundles");
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { AccountService } = require("../src/main/account-service");
const { hasActiveGameSubscription, hasGameEntitlement } = require("../src/main/game-access");
const { createStore, jsonResponse } = require("./helpers/account-service-fixtures");

/** Matérialisation des accès serveur et affichage du compte. */

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
  const main = readMainSource("main.js");
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

