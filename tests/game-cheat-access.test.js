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
  ADMIN_EMAIL,
  AdminService,
  normalizePublicVisibility,
  normalizeSiteSettings
} = require("../src/main/admin-service");
const { AccountService } = require("../src/main/account-service");
const { createDefaultState } = require("../src/main/defaults");
const {
  GAME_CHEAT_ACCESS_ID,
  gameCheatAccessGrantMap,
  gameCheatEmailHash
} = require("../src/shared/game-cheat-access");

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function createAccountStore() {
  const state = createDefaultState();
  const secrets = new Map();
  let sequence = 0;
  return {
    state,
    getState: () => structuredClone(state),
    mutate(callback) {
      callback(state);
    },
    set(key, value) {
      const parts = String(key).split(".");
      let target = state;
      while (parts.length > 1) target = target[parts.shift()];
      target[parts[0]] = structuredClone(value);
    },
    setSecret(id, value) {
      const key = id || `secret_${++sequence}`;
      if (value) secrets.set(key, value);
      else secrets.delete(key);
      return key;
    },
    getSecret: (id) => secrets.get(id) || "",
    activateAccount() {},
    deactivateAccount() {}
  };
}

test("normalise la liste globale des comptes autorisés sans exposer les e-mails", () => {
  const settings = normalizeSiteSettings({
    cheatAccess: {
      [GAME_CHEAT_ACCESS_ID]: {
        entries: [
          { email: " User@Example.com " },
          { email: "user@example.com" },
          { email: "adresse-invalide" },
          { email: ADMIN_EMAIL }
        ]
      }
    }
  });
  assert.deepEqual(settings.cheatAccess[GAME_CHEAT_ACCESS_ID].entries, [
    { email: "user@example.com" }
  ]);
  assert.equal(
    JSON.stringify(normalizePublicVisibility(settings)).includes(
      "user@example.com"
    ),
    false
  );
  assert.deepEqual(gameCheatAccessGrantMap(settings), {
    [gameCheatEmailHash("user@example.com")]: true
  });
});

test("publie les droits de triche sous forme d’empreintes Firebase", async () => {
  const requests = [];
  const store = {
    getState: () => ({ settings: { admin: {} } }),
    set() {}
  };
  const service = new AdminService({
    store,
    accountService: {
      identityForInternalUse: async () => ({
        email: ADMIN_EMAIL,
        emailVerified: true,
        idToken: "owner-token",
        uid: "owner_uid"
      })
    },
    fetchImpl: async (url, options = {}) => {
      requests.push({
        url: String(url),
        method: options.method || "GET",
        body: options.body ? JSON.parse(options.body) : undefined
      });
      return jsonResponse(options.body ? JSON.parse(options.body) : {});
    }
  });

  await service.saveSiteSettings({
    cheatAccess: {
      [GAME_CHEAT_ACCESS_ID]: {
        entries: [{ email: "allowed@example.com" }]
      }
    }
  });

  const publication = requests.find((request) =>
    request.url.includes("/site/gameCheatAccess.json")
  );
  assert.equal(publication.method, "PUT");
  assert.deepEqual(publication.body, {
    [gameCheatEmailHash("allowed@example.com")]: true
  });
});

test("vérifie le droit du compte Firebase actif sans accepter d’e-mail fourni par le rendu", async () => {
  const store = createAccountStore();
  const requestedUrls = [];
  const service = new AccountService({
    store,
    fetchImpl: async (url, options = {}) => {
      const target = String(url);
      requestedUrls.push(target);
      if (target.includes("accounts:lookup")) {
        return jsonResponse({
          users: [
            {
              email: "allowed@example.com",
              localId: "allowed_uid",
              emailVerified: true,
              providerUserInfo: [{ providerId: "password" }]
            }
          ]
        });
      }
      if (target.includes("/api/account/entitlements")) {
        return jsonResponse({
          checkedAt: new Date().toISOString(),
          gameEntitlements: [],
          source: "free",
          tier: "free"
        });
      }
      if (target.includes("/api/entitlements/subscription")) {
        return jsonResponse({
          checkedAt: new Date().toISOString(),
          gameEntitlements: [],
          source: "free",
          tier: "free"
        });
      }
      if (target.includes("/site/gameCheatAccess/")) {
        assert.equal(options.headers["Cache-Control"], "no-store");
        return jsonResponse(true);
      }
      return jsonResponse({
        email: "allowed@example.com",
        expiresIn: "3600",
        idToken: "id-token",
        localId: "allowed_uid",
        refreshToken: "refresh-token"
      });
    }
  });

  await service.login({
    email: "allowed@example.com",
    password: "secret"
  });
  const access = await service.gameCheatAccess();
  assert.equal(access.allowed, true);
  assert.ok(
    requestedUrls.some((url) =>
      url.includes(
        `/site/gameCheatAccess/${gameCheatEmailHash("allowed@example.com")}.json`
      )
    )
  );
});

test("l’administration et DealOrNoDeal utilisent le droit global par e-mail", () => {
  const renderer = readRendererSource();
  const preload = fs.readFileSync(
    path.join(__dirname, "..", "src", "main", "preload.js"),
    "utf8"
  );
  const rules = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "firebase", "database.rules.json"),
      "utf8"
    )
  );
  assert.match(renderer, /Triche de jeux/);
  assert.match(renderer, /gameCheatAccessAllowed === true/);
  assert.match(renderer, /showCheatTab = canUseDealCheatSettings\(\)/);
  assert.match(preload, /account:game-cheat-access/);
  assert.equal(rules.rules.site.gameCheatAccess[".read"], false);
  assert.equal(
    rules.rules.site.gameCheatAccess.$emailHash[".read"],
    "auth != null && auth.token.email_verified == true"
  );
});
