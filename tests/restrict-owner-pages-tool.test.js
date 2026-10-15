"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ADMIN_EMAIL } = require("../src/main/admin/constants");
const { AccountService } = require("../src/main/account-service");
const {
  BRANCHES, PAGE_IDS, firebaseNavigationClient, ownerMemoryStore, ownerPatch,
  restrictOwnerPages, scopeSummary, verifiedOwnerIdentity, withoutOwnerScopes, writeNavigationBackup
} = require("../scripts/maintenance/restrict-owner-pages");

function navigation() {
  const entries = {
    home: { scope: "public", label: "Accueil" },
    admin: { scope: "admin", label: "Administration" },
    controllers: { scope: "public", count: 3 },
    settings: { scope: "public", extra: "preserved" },
    irl: { scope: "public" },
    games: { scope: "public" }
  };
  return { adminSettings: structuredClone(entries), publicVisibility: structuredClone(entries) };
}

function ownerSession() {
  return { activeAccountUid: "owner-fixture", settings: { account: {
    uid: "owner-fixture", email: ADMIN_EMAIL, emailVerified: true, refreshTokenSecretId: "test-reference"
  } } };
}

function encryptedSecrets() {
  return { "test-reference": { encrypted: false, value: Buffer.from("fake-refresh").toString("base64") } };
}

function restricted(before) {
  const after = structuredClone(before);
  for (const branch of BRANCHES) for (const id of PAGE_IDS) after[branch][id].scope = "admin";
  return after;
}

test("le plan contient exactement les six feuilles de portée attendues", () => {
  assert.deepEqual(ownerPatch(), {
    "adminSettings/navigation/admin/scope": "admin",
    "adminSettings/navigation/controllers/scope": "admin",
    "adminSettings/navigation/settings/scope": "admin",
    "publicVisibility/navigation/admin/scope": "admin",
    "publicVisibility/navigation/controllers/scope": "admin",
    "publicVisibility/navigation/settings/scope": "admin"
  });
});

test("le mode par défaut lit les portées sans créer de sauvegarde ni modifier Firebase", async () => {
  const before = navigation();
  const reports = [];
  let reads = 0;
  const after = await restrictOwnerPages({
    client: { readNavigation: async () => { reads++; return before; }, patchRestriction: () => assert.fail("aucun PATCH") },
    backup: () => assert.fail("aucune sauvegarde en lecture seule"), report: (record) => reports.push(record)
  });
  assert.equal(reads, 1);
  assert.equal(after, before);
  assert.deepEqual(reports, [{ phase: "dry-run", scopes: scopeSummary(before) }]);
  assert.doesNotMatch(JSON.stringify(reports), /label|count|extra|uid|token|https:/);
});

test("apply sauvegarde avant l'unique PATCH et préserve tous les autres accès et métadonnées", async () => {
  const before = navigation();
  const after = restricted(before);
  const operations = [];
  let reads = 0;
  await restrictOwnerPages({
    apply: true,
    client: {
      readNavigation: async () => { operations.push("read"); return ++reads < 3 ? before : after; },
      patchRestriction: async () => { operations.push("patch"); }
    },
    backup: async (copy) => { assert.deepEqual(copy, before); operations.push("backup"); },
    report: (record) => { assert.equal(record.phase, "applied"); assert.deepEqual(record.scopes, scopeSummary(after)); }
  });
  assert.deepEqual(operations, ["read", "backup", "read", "patch", "read"]);
  assert.deepEqual(withoutOwnerScopes(before), withoutOwnerScopes(after));
});

test("un échec de sauvegarde interdit le PATCH", async () => {
  await assert.rejects(() => restrictOwnerPages({
    apply: true,
    client: { readNavigation: async () => navigation(), patchRestriction: () => assert.fail("aucun PATCH") },
    backup: () => { throw new Error("backup failed"); }
  }), /backup failed/);
});

test("une modification distante concurrente ou une navigation manquante interdit la publication", async () => {
  let reads = 0;
  const before = navigation();
  const concurrent = navigation();
  concurrent.adminSettings.games.scope = "hidden";
  await assert.rejects(() => restrictOwnerPages({
    apply: true, backup: () => {},
    client: { readNavigation: async () => ++reads === 1 ? before : concurrent, patchRestriction: () => assert.fail("aucun PATCH") }
  }), /NAVIGATION_CHANGED/);
  before.publicVisibility = null;
  await assert.rejects(() => restrictOwnerPages({
    apply: true, backup: () => assert.fail("aucune sauvegarde"),
    client: { readNavigation: async () => before, patchRestriction: () => assert.fail("aucun PATCH") }
  }), /NAVIGATION_MISSING/);
});

test("les pages absentes sont résumées par null puis créées uniquement par les six feuilles scope", async () => {
  const before = navigation();
  delete before.adminSettings.admin;
  delete before.publicVisibility.controllers;
  before.publicVisibility.settings = null;
  const summaries = scopeSummary(before);
  assert.equal(summaries.adminSettings.admin, null);
  assert.equal(summaries.publicVisibility.controllers, null);
  assert.equal(summaries.publicVisibility.settings, null);
  const after = structuredClone(before);
  for (const branch of BRANCHES) for (const id of PAGE_IDS) after[branch][id] = { ...(after[branch][id] || {}), scope: "admin" };
  let reads = 0, patches = 0;
  await restrictOwnerPages({
    apply: true, backup: () => {},
    client: {
      readNavigation: async () => ++reads < 3 ? before : after,
      patchRestriction: () => { patches++; assert.equal(Object.keys(ownerPatch()).length, 6); }
    },
    report: (record) => assert.equal(record.phase, "applied")
  });
  assert.equal(patches, 1);
  assert.deepEqual(withoutOwnerScopes(before), withoutOwnerScopes(after));
  assert.equal(after.adminSettings.controllers.count, 3);
});

test("les portées scalaires historiques sont acceptées sans effacer de métadonnées tierces", async () => {
  const before = navigation();
  before.adminSettings.admin = "admin";
  before.adminSettings.controllers = "public";
  before.publicVisibility.controllers = "hidden";
  before.publicVisibility.settings = { extra: "preserved" };
  assert.equal(scopeSummary(before).adminSettings.controllers, "public");
  assert.equal(scopeSummary(before).publicVisibility.controllers, "hidden");
  assert.equal(scopeSummary(before).publicVisibility.settings, null);
  const after = structuredClone(before);
  for (const branch of BRANCHES) for (const id of PAGE_IDS) after[branch][id] = {
    ...(typeof after[branch][id] === "object" ? after[branch][id] : {}), scope: "admin"
  };
  let reads = 0;
  await restrictOwnerPages({
    apply: true, backup: () => {},
    client: { readNavigation: async () => ++reads < 3 ? before : after, patchRestriction: () => {} },
    report: (record) => assert.equal(record.phase, "applied")
  });
  assert.deepEqual(withoutOwnerScopes(before), withoutOwnerScopes(after));
  const invalid = navigation();
  invalid.adminSettings.controllers = "not-a-scope";
  await assert.rejects(() => restrictOwnerPages({
    client: { readNavigation: async () => invalid }, report: () => assert.fail("aucun résumé de données invalides")
  }), /NAVIGATION_MISSING/);
});

test("la vérification refuse une modification hors périmètre sans restauration globale", async () => {
  const before = navigation();
  const after = restricted(before);
  after.publicVisibility.irl.scope = "hidden";
  let reads = 0, patches = 0;
  await assert.rejects(() => restrictOwnerPages({
    apply: true, backup: () => {}, report: () => assert.fail("aucun succès"),
    client: {
      readNavigation: async () => ++reads < 3 ? before : after,
      patchRestriction: () => { patches++; }
    }
  }), /POSTCHECK_FAILED/);
  assert.equal(patches, 1, "aucun PATCH de restauration implicite");
});

test("une restriction déjà appliquée ne provoque aucune écriture", async () => {
  const before = restricted(navigation());
  await restrictOwnerPages({
    apply: true, backup: () => assert.fail("aucune sauvegarde"),
    client: { readNavigation: async () => before, patchRestriction: () => assert.fail("aucun PATCH") },
    report: (record) => assert.equal(record.phase, "already-restricted")
  });
});

test("le client Firebase limite les lectures et utilise un seul PATCH atomique sans redirection", async () => {
  const calls = [];
  const client = firebaseNavigationClient("fake-test-token", async (url, options) => {
    calls.push({ url: new URL(url), options });
    return { ok: true, json: async () => ({ admin: { scope: "admin" } }) };
  });
  await client.readNavigation();
  await client.patchRestriction();
  assert.deepEqual(calls.map((call) => call.url.pathname), [
    "/site/adminSettings/navigation.json", "/site/publicVisibility/navigation.json", "/site.json"
  ]);
  assert.equal(calls[2].options.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[2].options.body), ownerPatch());
  assert.ok(calls.every(({ options }) => options.redirect === "error" && options.credentials === "omit"));
  assert.ok(calls.every(({ options }) => options.method !== "PUT"));
});

test("seul le propriétaire vérifié est autorisé et les mises à jour de session restent en mémoire", async () => {
  const state = ownerSession();
  const secrets = encryptedSecrets();
  const before = JSON.stringify({ state, secrets });
  const store = ownerMemoryStore(state, secrets);
  const account = new AccountService({ store, fetchImpl: async (url) => {
    assert.match(url, /accounts:lookup/);
    return { ok: true, text: async () => JSON.stringify({ users: [{
      localId: "owner-fixture", email: ADMIN_EMAIL, emailVerified: true, displayName: "Test display"
    }] }) };
  } });
  account.idToken = "fake-test-token";
  account.expiresAt = Date.now() + 3600000;
  assert.equal((await verifiedOwnerIdentity(store, account)).uid, "owner-fixture");
  assert.equal(store.getAccountSession().displayName, "Test display");
  store.setSecret("test-reference", "fake-rotated-refresh");
  assert.equal(store.getSecret("test-reference"), "fake-rotated-refresh");
  assert.throws(() => store.set("settings.backblaze", {}), /LOCAL_WRITE_FORBIDDEN/);
  assert.throws(() => store.set("settings.account", { uid: "other" }), /LOCAL_WRITE_FORBIDDEN/);
  assert.equal(JSON.stringify({ state, secrets }), before);
});

test("le compte local non propriétaire ou l'identité Firebase non vérifiée sont refusés", async () => {
  const state = ownerSession();
  state.settings.account.email = "ordinary@example.invalid";
  assert.throws(() => ownerMemoryStore(state, encryptedSecrets()), /OWNER_REQUIRED/);
  state.settings.account.email = ADMIN_EMAIL;
  state.settings.account.emailVerified = false;
  assert.throws(() => ownerMemoryStore(state, encryptedSecrets()), /OWNER_REQUIRED/);
  state.settings.account.emailVerified = true;
  const store = ownerMemoryStore(state, encryptedSecrets());
  for (const identity of [
    { email: ADMIN_EMAIL, emailVerified: false, uid: "owner-fixture", idToken: "fake" },
    { email: ADMIN_EMAIL, emailVerified: true, uid: "other", idToken: "fake" },
    { email: "ordinary@example.invalid", emailVerified: true, uid: "owner-fixture", idToken: "fake" }
  ]) await assert.rejects(() => verifiedOwnerIdentity(store, { identityForInternalUse: async () => identity }), /OWNER_REQUIRED/);
});

test("la sauvegarde réutilisable contient seulement les deux navigations, sans secrets", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-owner-backup-test-"));
  try {
    const before = navigation();
    const file = writeNavigationBackup(before, root);
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.deepEqual(saved, { version: 1, navigation: before });
    assert.equal(path.dirname(path.dirname(file)), root);
    const different = writeNavigationBackup(before, root);
    assert.notEqual(different, file);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), saved);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
