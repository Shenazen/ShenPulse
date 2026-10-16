"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const visibility = require("../src/shared/visibility-catalog");
const { GameHub } = require("../src/main/game-hub");
const { snapshotForRenderer } = require("../src/main/account-access");
const { FindTheNeedleBridge } = require("../src/main/find-the-needle-bridge");

function fixture({ owner = false, scope, schemaVersion = visibility.VISIBILITY_SCHEMA_VERSION, pro = true } = {}) {
  const state = {
    settings: { account: { uid: "fixture-user", email: owner ? "alexandre.leuridan@gmail.com" : "viewer@example.test", emailVerified: true, refreshTokenSecretId: "fixture-secret" },
      siteVisibility: { schemaVersion, games: scope === undefined ? {} : { fortnite: { scope }, "find-the-needle-demo": { scope } } } },
    session: { profileId: "profile-1", activeGamePackId: "find-the-needle-demo" },
    commerce: { subscription: { tier: pro ? "pro" : "free", status: pro ? "active" : "free" } }, game: { connectorOverrides: {} }
  };
  const store = { getState: () => structuredClone(state), getAccountSession: () => state.settings.account,
    getActiveAccountUid: () => state.settings.account.uid, getSecret: id => id === "fixture-secret" ? "fixture-only" : "" };
  let requests = 0;
  const hub = new GameHub({ store, packsDirectory: "fixture-unused", findTheNeedleBridge: new FindTheNeedleBridge({ fetchImpl: async (_url, options) => {
    requests += 1;
    return new Response(JSON.stringify(options.method === "GET"
      ? { ok: true, mod: "s2e-find-the-needle", version: "1.2.7", game: { ready: true, compatible: true } }
      : { ok: true, command: "givemoney", version: "1.2.7" }), { headers: { "Content-Type": "application/json" } });
  } }) });
  hub.packs = ["fortnite", "find-the-needle-demo"].map(id => ({ id, name: id, ownerOnly: true, accessMode: "included", connector: { type: "find-the-needle-http" }, effects: [{ id: "effect", code: "givemoney", available: true }] }));
  return { state, store, hub, requests: () => requests };
}

test("un ancien défaut propriétaire reste fermé tant que le propriétaire ne choisit pas Public sur le nouveau schéma", () => {
  for (const schemaVersion of [0, 8, 10, "incorrect", Infinity, visibility.VISIBILITY_SCHEMA_VERSION]) {
    for (const scope of [undefined, "admin", "public", "hidden", false, "incorrect"]) {
      const f = fixture({ schemaVersion, scope });
      const open = scope === "public" && Number.isFinite(schemaVersion) && schemaVersion >= visibility.VISIBILITY_SCHEMA_VERSION;
      for (const pack of f.hub.packs) {
        assert.equal(visibility.canAccessGame(f.state.settings.siteVisibility, pack, false), open);
        if (open) assert.equal(f.hub.assertAccess(pack.id).id, pack.id);
        else assert.throws(() => f.hub.assertAccess(pack.id));
      }
      const snapshot = snapshotForRenderer({ state: f.state, packs: f.hub.packs }, f.store);
      assert.equal(snapshot.packs.length, open ? 2 : 0);
    }
  }
});

test("Public rend le vrai transport utilisable par un abonné non propriétaire, sans donner les droits d’administration", async () => {
  const f = fixture({ scope: "public" });
  assert.equal((await f.hub.testConnection("find-the-needle-demo")).ok, true);
  assert.equal((await f.hub.trigger("effect", {}, { packId: "find-the-needle-demo" })).sent, true);
  assert.equal(f.requests(), 3, "un diagnostic puis health + POST de l’effet");
  assert.throws(() => require("../src/main/account-access").assertAdminAccount(f.store), { code: "ADMIN_ACCOUNT_REQUIRED" });
  const free = fixture({ scope: "public", pro: false });
  await assert.rejects(free.hub.trigger("effect", {}, { packId: "find-the-needle-demo" }), { code: "PRO_FEATURE_REQUIRED" });
  assert.equal(free.requests(), 0);
});

test("Moi uniquement et Masqué bloquent à nouveau diagnostic et effet avant le transport", async () => {
  for (const scope of ["admin", "hidden"]) {
    for (const owner of [false, true]) {
      const f = fixture({ scope, owner });
      if (scope === "admin" && owner) assert.equal((await f.hub.testConnection("find-the-needle-demo")).ok, true);
      else {
        await assert.rejects(f.hub.testConnection("find-the-needle-demo"));
        await assert.rejects(f.hub.trigger("effect", {}, { packId: "find-the-needle-demo" }));
        assert.equal(f.requests(), 0);
      }
    }
  }
});

test("la migration neutralise les anciens Public masqués par le verrou sans écraser les nouveaux choix", () => {
  for (const id of ["fortnite", "find-the-needle-demo"]) {
    const legacy = { schemaVersion: 10, games: { [id]: { scope: "public" }, ordinary: { scope: "public" } } };
    const migrated = visibility.migrateVisibility(legacy);
    assert.equal(migrated.games[id].scope, "admin");
    assert.equal(migrated.games.ordinary.scope, "public");
    assert.equal(legacy.games[id].scope, "public", "source non modifiée");
    assert.deepEqual(visibility.migrateVisibility(migrated), migrated);
    const modern = { schemaVersion: visibility.VISIBILITY_SCHEMA_VERSION, games: { [id]: { scope: "public" } } };
    assert.equal(visibility.migrateVisibility(modern).games[id].scope, "public");
    for (const scope of ["admin", "hidden"]) assert.equal(visibility.migrateVisibility({ ...legacy, games: { [id]: { scope } } }).games[id].scope, scope);
  }
});

test("le propriétaire garde le catalogue complet dans sa console, même après masquage", () => {
  const f = fixture({ owner: true, scope: "hidden" });
  const snapshot = { state: f.state, packs: f.hub.packs };
  assert.equal(snapshotForRenderer(snapshot, f.store), snapshot);
  assert.equal(visibility.canAccessGame(f.state.settings.siteVisibility, f.hub.packs[0], true), false);
});

test("une révocation de visibilité pendant la connexion empêche toute POST d’effet", async () => {
  for (const scope of ["hidden", "admin"]) {
    const f = fixture({ scope: "public" });
    const methods = [];
    f.hub.findTheNeedleBridge = new FindTheNeedleBridge({ fetchImpl: async (_url, options) => {
      methods.push(options.method);
      f.state.settings.siteVisibility.games["find-the-needle-demo"] = { scope };
      return new Response(JSON.stringify({ ok: true, mod: "s2e-find-the-needle", version: "1.2.7", game: { ready: true, compatible: true } }));
    } });
    await assert.rejects(f.hub.trigger("effect", {}, { packId: "find-the-needle-demo" }));
    assert.deepEqual(methods, ["GET"]);
  }
});
