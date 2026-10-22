"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ADMIN_EMAIL,
  AdminService,
  normalizeSiteSettings,
  normalizePublicVisibility
} = require("../src/main/admin-service");
const { registerAdminIpc } = require("../src/main/ipc/admin");
const { VISIBILITY_SCHEMA_VERSION } = require("../src/shared/visibility-catalog");

function jsonResponse(value) {
  return { ok: true, text: async () => JSON.stringify(value) };
}

test("les réglages et le miroir public conservent chaque choix explicite de visibilité des jeux privés", () => {
  for (const normalize of [normalizeSiteSettings, normalizePublicVisibility]) {
    for (const scope of ["public", "admin", "hidden"]) {
      const settings = normalize({ schemaVersion: VISIBILITY_SCHEMA_VERSION, games: {
        fortnite: { scope }, "find-the-needle-demo": scope, other: false
      } });
      assert.deepEqual(settings.games.fortnite, { scope });
      assert.deepEqual(settings.games["find-the-needle-demo"], { scope });
      assert.deepEqual(settings.games.other, { scope: "hidden" });
    }
  }
});

test("une configuration de jeu invalide ne se transforme pas en ouverture publique", () => {
  for (const normalize of [normalizeSiteSettings, normalizePublicVisibility]) {
    for (const invalid of [undefined, null, true, 0, "", "invalid", {}, { scope: "invalid" }]) {
      const settings = normalize({ games: {
        fortnite: invalid, "find-the-needle-demo": invalid,
        preserved: { scope: "admin" }
      } });
      assert.equal(Object.hasOwn(settings.games, "fortnite"), false);
      assert.equal(Object.hasOwn(settings.games, "find-the-needle-demo"), false);
      assert.deepEqual(settings.games.preserved, { scope: "admin" });
    }
  }
});

test("l'enregistrement propriétaire publie et met en cache les mêmes choix de jeux sans restriction forcée", async () => {
  const requests = [];
  const state = { settings: { admin: {}, siteVisibility: {} } };
  const service = new AdminService({
    store: {
      getState: () => state,
      set(key, value) {
        assert.equal(key, "settings.siteVisibility");
        state.settings.siteVisibility = structuredClone(value);
      }
    },
    accountService: {
      identityForInternalUse: async () => ({
        email: ADMIN_EMAIL, emailVerified: true,
        uid: "owner_uid", idToken: "fixture-token"
      })
    },
    fetchImpl: async (url, options = {}) => {
      const body = JSON.parse(options.body);
      requests.push({ url: String(url), method: options.method, body });
      return jsonResponse(body);
    }
  });

  const games = {
    fortnite: { scope: "public", platforms: ["epic-games", "game-pass"], platformsConfigured: true },
    "find-the-needle-demo": { scope: "hidden", platforms: [], platformsConfigured: true }
  };
  const saved = await service.saveSiteSettings({ schemaVersion: VISIBILITY_SCHEMA_VERSION, games });
  assert.deepEqual(saved.games, games);
  const publication = requests.find((request) => request.url.includes("/site/publicVisibility.json"));
  assert.equal(publication.method, "PUT");
  assert.deepEqual(publication.body.games, games);
  assert.deepEqual(state.settings.siteVisibility.games, games);

  // Une déconnexion réseau ultérieure doit conserver le choix publié.
  service.fetch = async () => { throw new Error("hors ligne"); };
  assert.deepEqual((await service.getPublicVisibility()).games, games);
});

test("les logos restent validés et le choix aucun survit aux tableaux vides supprimés par Firebase", () => {
  for (const normalize of [normalizeSiteSettings, normalizePublicVisibility]) {
    const settings = normalize({ games: {
      custom: { scope: "admin", platforms: ["steam", "steam", "game-pass", "arbitrary", { id: "nintendo" }], platformsConfigured: true },
      none: { scope: "hidden", platformsConfigured: true },
      defaults: { scope: "public" }
    } });
    assert.deepEqual(settings.games.custom, { scope: "admin", platforms: ["steam", "game-pass"], platformsConfigured: true });
    assert.deepEqual(settings.games.none, { scope: "hidden", platforms: [], platformsConfigured: true });
    assert.deepEqual(settings.games.defaults, { scope: "public" });
    const { canonicalizeVisibility } = require("../src/shared/visibility-catalog");
    const canonical = canonicalizeVisibility(settings, { games: [{ id: "custom" }, { id: "none" }, { id: "defaults" }] });
    assert.deepEqual(canonical.games, settings.games);
  }
});

test("un autre compte ne peut pas modifier la visibilité partagée des jeux", async () => {
  let requests = 0;
  const service = new AdminService({
    store: { getState: () => ({ settings: { admin: {} } }) },
    accountService: {
      identityForInternalUse: async () => ({
        email: "creator@example.test", emailVerified: true,
        uid: "creator_uid", idToken: "fixture-token"
      })
    },
    fetchImpl: async () => { requests += 1; return jsonResponse({}); }
  });
  await assert.rejects(service.saveSiteSettings({
    schemaVersion: VISIBILITY_SCHEMA_VERSION,
    games: { fortnite: { scope: "public" } }
  }), /Session administrateur absente/);
  assert.equal(requests, 0);
});

test("le changement de visibilité enregistré réactualise immédiatement la projection de l'application", async () => {
  const handlers = new Map();
  const events = [];
  const saved = { games: { fortnite: { scope: "public" } } };
  const projected = { packs: [{ id: "fortnite" }] };
  registerAdminIpc({
    handle: (channel, listener) => handlers.set(channel, listener),
    core: {
      snapshot: () => projected,
      notifyRenderer: (channel, value) => events.push({ channel, value })
    },
    store: {},
    adminService: { saveSiteSettings: async () => saved }
  });
  assert.equal(await handlers.get("admin:site-save")({}, saved), saved);
  assert.deepEqual(events, [{ channel: "state-changed", value: projected }]);
});

test("un échec d'enregistrement ne diffuse pas une projection de visibilité non publiée", async () => {
  const handlers = new Map();
  let notifications = 0;
  registerAdminIpc({
    handle: (channel, listener) => handlers.set(channel, listener),
    core: {
      snapshot: () => { throw new Error("projection non attendue"); },
      notifyRenderer: () => { notifications += 1; }
    },
    store: {},
    adminService: { saveSiteSettings: async () => { throw new Error("publication indisponible"); } }
  });
  await assert.rejects(handlers.get("admin:site-save")({}, {}), /publication indisponible/);
  assert.equal(notifications, 0);
});
