"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { AccountService } = require("../src/main/account-service");
const { createDefaultState } = require("../src/main/defaults");

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
  const renderer = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
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
  assert.match(main, /screen\.getPrimaryDisplay\(\)\.workAreaSize/);
});
