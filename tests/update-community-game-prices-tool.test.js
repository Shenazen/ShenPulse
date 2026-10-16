"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { TARGETS, assertPostcheck, commerceClient, proposedCatalog, updatePrices, writeBackup } = require("../scripts/update-community-game-prices");

function catalog() {
  return { schemaVersion: 2, products: { "old-game": { id: "old-game", title: "Préservé", accessMode: "purchase", baseAmount: "19.99", currency: "EUR", enabled: false, trialEligible: false, sortOrder: 10 } },
    promotions: {}, subscriptions: Object.fromEntries(["pro", "premium"].map((tier) => [tier, { tier, title: tier, currency: "EUR", enabled: true, priceMonthly: tier === "pro" ? "9.99" : "13.99", sortOrder: 0 }])),
    updatedAt: "before", updatedByEmail: "synthetic@example.invalid", updatedByUid: "synthetic-owner" };
}
function admin() {
  const prod = catalog(), draft = structuredClone(prod), alternate = catalog();
  draft.updatedAt = "draft-metadata"; alternate.products["old-game"].baseAmount = "12.99";
  return { ok: true, catalog: draft, channels: { prod, draft, test: alternate }, history: [{ id: "old-history", action: "publish-test", channel: "test", savedAt: "before", savedByEmail: "synthetic@example.invalid" }] };
}
function published(before, expected) {
  const value = structuredClone(before), next = { ...structuredClone(expected), updatedAt: "after" };
  value.catalog = next; value.channels.prod = next; value.channels.draft = next;
  value.history.unshift({ id: "new-history", action: "publish-prod", channel: "prod", savedAt: "after", savedByEmail: "synthetic@example.invalid" });
  return value;
}
function client(before, operations = []) {
  let current = structuredClone(before);
  return { readAdmin: async () => { operations.push("read"); return { status: 200, value: structuredClone(current) }; },
    readFirebase: async () => ({ status: 401, etag: null, value: null }),
    publish: async (expected) => { operations.push("publish"); current = published(current, expected); return structuredClone(current); } };
}

test("inspection par défaut : aucune sauvegarde, aucune publication, aucun identifiant privé dans les sorties", async () => {
  const before = admin(), operations = [], reports = [];
  await updatePrices({ client: client(before, operations), backup: () => assert.fail("pas de backup"), report: (value) => reports.push(value) });
  assert.deepEqual(operations, ["read"]);
  assert.equal(reports[0].publicationSafe, true);
  assert.doesNotMatch(JSON.stringify(reports), /synthetic|old-history|token|Authorization/);
});
test("plan limité à quatre produits complets, montants exacts, autres offres et disponibilité existante conservées", () => {
  assert.deepEqual(TARGETS, { "tiklive-climb": "9.99", "clash-of-live": "12.99", "tiklive-cube-wars": "9.99", "tiklive-stack-tower": "9.99" });
  const before = admin(), expected = proposedCatalog(before);
  assert.deepEqual(expected.products["old-game"], before.channels.prod.products["old-game"]);
  assert.deepEqual(expected.subscriptions, before.channels.prod.subscriptions);
  assert.deepEqual(expected.promotions, before.channels.prod.promotions);
  for (const [id, price] of Object.entries(TARGETS)) {
    assert.equal(expected.products[id].baseAmount, price);
    assert.equal(expected.products[id].currency, "EUR");
    assert.equal(expected.products[id].accessMode, "purchase");
    assert.equal(expected.products[id].enabled, true);
  }
  before.channels.prod.products["tiklive-climb"] = { ...expected.products["tiklive-climb"], enabled: false, trialEligible: false, baseAmount: "25.99" };
  before.channels.draft = structuredClone(before.channels.prod);
  assert.equal(proposedCatalog(before).products["tiklive-climb"].enabled, false);
  assert.equal(proposedCatalog(before).products["tiklive-climb"].trialEligible, false);
});
test("correction du tarif Clash : seul son montant passe de 2,99 à 12,99 €, les trois autres et leurs champs restent identiques", () => {
  const before = admin(), previous = proposedCatalog(before);
  previous.products["clash-of-live"].baseAmount = "2.99";
  before.channels.prod = structuredClone(previous);
  before.channels.draft = structuredClone(previous);
  const actual = proposedCatalog(before);
  assert.equal(actual.products["clash-of-live"].baseAmount, "12.99");
  const restored = structuredClone(actual);
  restored.products["clash-of-live"].baseAmount = "2.99";
  assert.deepEqual(restored, previous);
  for (const id of ["tiklive-climb", "tiklive-cube-wars", "tiklive-stack-tower"]) {
    assert.equal(actual.products[id].baseAmount, "9.99");
    assert.deepEqual(actual.products[id], previous.products[id]);
  }
});
test("publication : sauvegarde puis relecture exacte, quatre produits prod/draft, test et historique préservés", async () => {
  const before = admin(), operations = [], reports = [];
  const after = await updatePrices({ client: client(before, operations), apply: true,
    backup: (value) => { operations.push("backup"); assert.deepEqual(value, before); }, report: (value) => reports.push(value) });
  assert.deepEqual(operations, ["read", "backup", "read", "publish", "read"]);
  assert.deepEqual(after.channels.test, before.channels.test);
  assert.deepEqual(after.history[1], before.history[0]);
  assert.equal(reports.at(-1).phase, "applied");
});
test("draft divergent, champ inconnu, montant non canonique ou promotion active : refus avant sauvegarde/publication", async () => {
  for (const change of [
    (value) => { value.channels.draft.products["old-game"].baseAmount = "25.99"; },
    (value) => { value.channels.prod.products["old-game"].unknown = "preserve-me"; value.channels.draft = structuredClone(value.channels.prod); },
    (value) => { value.channels.prod.products["old-game"].baseAmount = "19,99"; value.channels.draft = structuredClone(value.channels.prod); },
    (value) => { value.channels.prod.promotions.sale = { id: "sale", enabled: true, startsAt: "", endsAt: "", title: "Promotion", type: "percent", value: 10, productIds: [] }; value.channels.draft = structuredClone(value.channels.prod); }
  ]) {
    const before = admin(); change(before);
    const operations = [];
    await assert.rejects(updatePrices({ client: client(before, operations), apply: true, backup: () => assert.fail("pas de backup"), report: () => {} }));
    assert.deepEqual(operations, ["read"]);
  }
});
test("échec de backup et changement concurrent empêchent l'unique PUT", async () => {
  await assert.rejects(updatePrices({ client: client(admin()), apply: true, backup: () => { throw new Error("BACKUP_FAILED"); }, report: () => {} }), /BACKUP_FAILED/);
  const before = admin(), real = client(before); let reads = 0;
  real.readAdmin = async () => { reads++; const value = structuredClone(before); if (reads > 1) value.channels.test.updatedAt = "concurrent"; return { status: 200, value }; };
  real.publish = () => assert.fail("pas de PUT");
  await assert.rejects(updatePrices({ client: real, apply: true, backup: () => {}, report: () => {} }), /CATALOG_CHANGED/);
});
test("postcheck refuse toute perte d'offre, altération du test ou historique existant modifié", () => {
  const before = admin(), expected = proposedCatalog(before);
  for (const change of [
    (value) => { delete value.channels.prod.products["old-game"]; },
    (value) => { value.channels.test.updatedAt = "changed"; },
    (value) => { value.history[1].savedAt = "changed"; },
    (value) => { value.channels.draft.subscriptions.pro.priceMonthly = "10.99"; }
  ]) { const after = published(before, expected); change(after); assert.throws(() => assertPostcheck(before, after, expected)); }
});
test("client borné : seule API publish-prod, auth mémoire ; jamais PUT Firebase, canal test ou requête PayPal", async () => {
  const calls = [], identity = { uid: "synthetic-owner", idToken: "synthetic-token" };
  const service = commerceClient(identity, async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) }; });
  await service.publish(proposedCatalog(admin()));
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).pathname, "/api/admin/commerce");
  assert.equal(calls[0].options.method, "PUT");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.headers.Authorization, "Bearer synthetic-token");
  assert.equal(JSON.parse(calls[0].options.body).action, "publish-prod");
  assert.doesNotMatch(calls[0].options.body, /synthetic-token/);
});
test("backup privé ne sérialise que canaux et historique, jamais token/identité de requête", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-prices-test-"));
  try {
    const before = admin(); before.requestToken = "do-not-save";
    writeBackup(before, temporary);
    const saved = JSON.parse(fs.readFileSync(path.join(temporary, fs.readdirSync(temporary)[0], "catalogs-before.json"), "utf8"));
    assert.deepEqual(Object.keys(saved).sort(), ["channels", "history", "version"]);
    assert.doesNotMatch(JSON.stringify(saved), /do-not-save/);
    assert.deepEqual(saved.channels, before.channels);
  } finally {
    for (const name of fs.readdirSync(temporary)) {
      fs.unlinkSync(path.join(temporary, name, "catalogs-before.json"));
      fs.rmdirSync(path.join(temporary, name));
    }
    fs.rmdirSync(temporary);
  }
});
