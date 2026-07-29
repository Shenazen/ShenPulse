"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  ADMIN_EMAIL,
  AdminService,
  commerceStateFromPublicConfig,
  normalizeCommerceCatalog,
  normalizePublicVisibility,
  normalizeSiteSettings,
  normalizeTrialRequest
} = require("../src/main/admin-service");
const { createDefaultState } = require("../src/main/defaults");

test("réserve la connexion admin à l’adresse propriétaire avant tout appel réseau", async () => {
  let fetchCalls = 0;
  const service = new AdminService({
    store: {},
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("ne doit pas être appelé");
    }
  });
  await assert.rejects(
    service.login({ email: "intrus@example.com", password: "secret" }),
    /pas autorisé/
  );
  assert.equal(fetchCalls, 0);
  assert.equal(ADMIN_EMAIL, "alexandre.leuridan@gmail.com");
});

test("refuse le compte propriétaire tant que Firebase ne confirme pas son e-mail", async () => {
  const idToken = [
    "eyJhbGciOiJub25lIn0",
    Buffer.from(
      JSON.stringify({
        email: ADMIN_EMAIL,
        email_verified: false,
        sub: "owner_uid",
        user_id: "owner_uid"
      })
    ).toString("base64url"),
    "signature"
  ].join(".");
  const service = new AdminService({
    store: {},
    fetchImpl: async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          email: ADMIN_EMAIL,
          expiresIn: "3600",
          idToken,
          localId: "owner_uid",
          refreshToken: "refresh_token"
        })
    })
  });

  await assert.rejects(
    service.login({ email: ADMIN_EMAIL, password: "secret" }),
    /n’a pas confirmé/
  );
});

test("le compte ShenPulse propriétaire vérifié ouvre directement l’administration", async () => {
  const service = new AdminService({
    store: {
      getState: () => ({ settings: { admin: {} } })
    },
    accountService: {
      identityForInternalUse: async () => ({
        email: ADMIN_EMAIL,
        emailVerified: true,
        idToken: "firebase_id_token",
        uid: "owner_uid"
      })
    }
  });

  const status = await service.status();
  assert.equal(status.authorized, true);
  assert.equal(status.email, ADMIN_EMAIL);
  assert.equal(status.uid, "owner_uid");
  assert.match(status.lastAuthenticatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("normalise strictement les portées de visibilité distantes", () => {
  const settings = normalizeSiteSettings({
    schemaVersion: 999,
    navigation: {
      actions: { scope: "admin" },
      sounds: { scope: "hidden" },
      studio: { scope: "invalide" },
      "clé interdite /": { scope: "hidden" }
    },
    games: { "connect-four": false }
  });
  assert.equal(settings.schemaVersion, 100);
  assert.deepEqual(settings.navigation.actions, { scope: "admin" });
  assert.deepEqual(settings.navigation.sounds, { scope: "hidden" });
  assert.deepEqual(settings.navigation.studio, { scope: "public" });
  assert.equal(settings.navigation["clé interdite /"], undefined);
  assert.deepEqual(settings.games["connect-four"], { scope: "hidden" });
});

test("le miroir public ne contient que les portées sans donnée propriétaire", () => {
  const visibility = normalizePublicVisibility({
    schemaVersion: 7,
    navigation: {
      dashboard: { scope: "public" },
      goals: { scope: "hidden" }
    },
    actionTypes: {
      "tts:speak": { scope: "admin" }
    },
    cheatAccess: {
      secret: {
        entries: [{ email: "owner@example.com", username: "owner" }]
      }
    },
    updatedBy: "owner@example.com"
  });
  assert.deepEqual(visibility.navigation.goals, { scope: "hidden" });
  assert.deepEqual(visibility.actionTypes["tts:speak"], { scope: "admin" });
  assert.equal(visibility.cheatAccess, undefined);
  assert.equal(visibility.updatedBy, undefined);
});

test("la visibilité publique reste disponible hors ligne après déconnexion", async () => {
  const cached = {
    schemaVersion: 7,
    navigation: {
      goals: { scope: "hidden" }
    }
  };
  const service = new AdminService({
    store: {
      getState: () => ({
        settings: {
          siteVisibility: cached
        }
      })
    },
    fetchImpl: async () => {
      throw new Error("hors ligne");
    }
  });
  const visibility = await service.getPublicVisibility();
  assert.deepEqual(visibility.navigation.goals, { scope: "hidden" });
});

test("valide les tarifs, abonnements et promotions avant publication", () => {
  const catalog = normalizeCommerceCatalog({
    products: {
      "connect-four": {
        accessMode: "purchase",
        baseAmount: "9,99",
        currency: "eur",
        enabled: true,
        sortOrder: 10,
        title: "Puissance 4",
        trialEligible: true
      }
    },
    subscriptions: {
      pro: {
        currency: "EUR",
        enabled: true,
        priceMonthly: "9,99",
        sortOrder: 10,
        title: "Pro"
      }
    },
    promotions: {
      lancement: {
        enabled: true,
        id: "lancement",
        productIds: ["connect-four", "jeu-inconnu"],
        title: "Lancement",
        type: "percent",
        value: 20
      }
    }
  });
  assert.equal(catalog.products["connect-four"].baseAmount, "9.99");
  assert.equal(catalog.subscriptions.pro.priceMonthly, "9.99");
  assert.deepEqual(catalog.promotions.lancement.productIds, ["connect-four"]);
});

test("un essai jeux sans sélection explicite laisse le serveur choisir tous les jeux éligibles", () => {
  const request = normalizeTrialRequest(
    {
      email: "Beneficiaire@Example.com",
      days: 14,
      subscription: true,
      games: true,
      gameIds: []
    },
    "owner_uid"
  );
  assert.equal(request.email, "beneficiaire@example.com");
  assert.equal(
    request.beneficiaryEmail,
    "beneficiaire@example.com"
  );
  assert.equal(request.days, 14);
  assert.equal(Object.hasOwn(request, "gameIds"), false);
});

test("reconstruit un catalogue de secours depuis la configuration commerciale publique", () => {
  const state = commerceStateFromPublicConfig({
    currency: "EUR",
    games: {
      "connect-four": {
        accessMode: "purchase",
        amount: "7.99",
        baseAmount: "9.99",
        currency: "EUR",
        enabled: true,
        id: "connect-four",
        promotion: {
          id: "summer",
          title: "Été",
          type: "percent",
          value: 20
        },
        title: "Puissance 4",
        trialEligible: true
      }
    },
    plans: {
      pro: {
        currency: "EUR",
        enabled: true,
        priceMonthly: 9.99,
        title: "Pro"
      },
      premium: {
        currency: "EUR",
        enabled: true,
        priceMonthly: 13.99,
        title: "Premium"
      }
    }
  });
  assert.equal(state.fallback, true);
  assert.equal(state.catalog.products["connect-four"].baseAmount, "9.99");
  assert.deepEqual(state.catalog.promotions.summer.productIds, ["connect-four"]);
  assert.equal(state.catalog.subscriptions.premium.priceMonthly, "13.99");
});

test("le stockage par défaut sépare la session admin des données publiques", () => {
  const state = createDefaultState();
  assert.deepEqual(state.settings.admin, {
    email: "",
    emailVerified: false,
    uid: "",
    refreshTokenSecretId: "",
    lastAuthenticatedAt: ""
  });
  assert.deepEqual(state.settings.account, {
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

test("le renderer expose les quatre espaces de la console propriétaire", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  for (const label of [
    "Tableau de bord",
    "Visibilité",
    "Offres d’essai",
    "Tarifs & promotions"
  ]) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(source, /Ctrl|ctrlKey/);
});

test("embarque la règle d’index Firebase requise par l’historique commercial", () => {
  const rules = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "firebase", "database.rules.json"),
      "utf8"
    )
  );
  assert.equal(
    rules.rules.site.adminCommerce.history[".indexOn"],
    "savedAt"
  );
  assert.equal(
    rules.rules.site.adminSettings[".write"],
    "auth != null && auth.token.email_verified == true && auth.token.email == 'alexandre.leuridan@gmail.com'"
  );
  assert.equal(rules.rules.site.publicVisibility[".read"], true);
  assert.equal(
    rules.rules.site.publicVisibility[".write"],
    "auth != null && auth.token.email_verified == true && auth.token.email == 'alexandre.leuridan@gmail.com'"
  );
  assert.equal(rules.rules.serverOnly[".read"], false);
  assert.equal(rules.rules.serverOnly[".write"], false);
});
