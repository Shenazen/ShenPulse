"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  AccountService
} = require("../src/main/account-service");
const {
  createDefaultState
} = require("../src/main/defaults");

function createStore() {
  const state = createDefaultState();
  const secrets = new Map();
  return {
    getState: () => structuredClone(state),
    mutate(callback) {
      callback(state);
      return structuredClone(state);
    },
    set(targetPath, value) {
      const parts = String(targetPath).split(".");
      let target = state;
      while (parts.length > 1) {
        target = target[parts.shift()];
      }
      target[parts[0]] = structuredClone(value);
    },
    setSecret(secretId, value) {
      const id = secretId || "refresh-token-secret";
      if (value) secrets.set(id, value);
      else secrets.delete(id);
      return id;
    },
    getSecret: (secretId) => secrets.get(secretId) || "",
    activateAccount() {},
    deactivateAccount() {},
    state
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function firebaseUser(email = "buyer@example.com") {
  return {
    email,
    localId: "buyer_uid",
    emailVerified: true
  };
}

function firebaseLogin(email = "buyer@example.com") {
  return {
    email,
    localId: "buyer_uid",
    idToken: "id-token",
    refreshToken: "refresh-token",
    expiresIn: "3600"
  };
}

test("une réponse serveur vide retire un ancien droit de jeu local", async () => {
  const store = createStore();
  store.state.commerce.gameEntitlements = [{
    gameId: "coin-pusher",
    productId: "coin-pusher",
    source: "purchase",
    status: "active"
  }];
  const service = new AccountService({
    store,
    fetchImpl: async (url) => {
      const target = String(url);
      if (target.includes("accounts:lookup")) {
        return jsonResponse({ users: [firebaseUser()] });
      }
      if (target.includes("/api/account/entitlements")) {
        return jsonResponse({ error: "indisponible" }, 503);
      }
      if (target.includes("/api/entitlements/subscription")) {
        return jsonResponse({
          checkedAt: "2026-07-30T12:00:00.000Z",
          gameEntitlements: [],
          source: "own",
          tier: "pro"
        });
      }
      return jsonResponse(firebaseLogin());
    }
  });

  await service.login({
    email: "buyer@example.com",
    password: "mot-de-passe"
  });

  assert.deepEqual(store.state.commerce.gameEntitlements, []);
});

test("la synchronisation ne transforme plus un paiement en attente en achat", async () => {
  const store = createStore();
  const service = new AccountService({
    store,
    fetchImpl: async (url) => {
      const target = String(url);
      if (target.includes("accounts:lookup")) {
        return jsonResponse({ users: [firebaseUser()] });
      }
      if (target.includes("/api/account/entitlements")) {
        return jsonResponse({
          checkedAt: "2026-07-30T12:00:00.000Z",
          gameEntitlements: [
            {
              gameId: "coin-pusher",
              source: "purchase",
              status: "approval_pending"
            },
            {
              gameId: "connect-four",
              source: "purchase",
              status: "captured"
            }
          ],
          source: "own",
          tier: "pro"
        });
      }
      if (target.includes("/api/entitlements/subscription")) {
        return jsonResponse({ error: "indisponible" }, 503);
      }
      return jsonResponse(firebaseLogin());
    }
  });

  await service.login({
    email: "buyer@example.com",
    password: "mot-de-passe"
  });

  assert.deepEqual(
    store.state.commerce.gameEntitlements.map((entry) => ({
      gameId: entry.gameId,
      status: entry.status
    })),
    [{
      gameId: "connect-four",
      status: "captured"
    }]
  );
});
