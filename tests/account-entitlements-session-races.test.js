"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { syncEntitlements } = require("../src/main/account/entitlements");
const { createStore, jsonResponse } = require("./helpers/account-service-fixtures");

function deferred() {
  let resolve, reject;
  const promise = new Promise((accept, refuse) => { resolve = accept; reject = refuse; });
  return { promise, resolve, reject };
}

const proPayload = { tier: "pro", source: "own", gameEntitlements: [], checkedAt: "2026-10-15T12:00:00.000Z" };

function fixture({ token = async () => "fake-token", fetchImpl = async () => jsonResponse(proPayload) } = {}) {
  const store = createStore();
  store.state.settings.account = { uid: "account-a", email: "a@example.invalid" };
  const service = { store, sessionGeneration: 0, webOrigin: "https://example.invalid", fetch: fetchImpl };
  let mutations = 0;
  const mutate = store.mutate;
  store.mutate = (...args) => { mutations++; return mutate(...args); };
  const flow = { token, session: () => store.state.settings.account };
  return {
    service, store, flow, mutations: () => mutations,
    switchAccount(uid = "account-b") {
      service.sessionGeneration++;
      store.state.settings.account = { uid, email: `${uid}@example.invalid` };
    }
  };
}

function stale(error) {
  assert.equal(error.code, "ACCOUNT_SESSION_CHANGED");
  assert.equal(error.staleSession, true);
  assert.notEqual(error.invalidSession, true);
  return true;
}

test("les droits de la connexion courante restent appliqués normalement", async () => {
  const item = fixture();
  const payload = await syncEntitlements(item.service, {}, item.flow);
  assert.equal(payload.tier, "pro");
  assert.equal(item.store.state.commerce.subscription.tier, "pro");
  assert.equal(item.mutations(), 1);
});

test("changer de compte pendant le jeton interdit les requêtes de droits et toute mutation", async () => {
  const token = deferred();
  const item = fixture({ token: () => token.promise, fetchImpl: () => assert.fail("aucun appel de droits") });
  const pending = syncEntitlements(item.service, {}, item.flow);
  item.switchAccount();
  token.resolve("fake-token-a");
  await assert.rejects(pending, stale);
  assert.equal(item.store.state.settings.account.uid, "account-b");
  assert.equal(item.mutations(), 0);
});

test("un ancien refus du jeton ne devient jamais une session invalide pour le compte suivant", async () => {
  const token = deferred();
  const item = fixture({ token: () => token.promise, fetchImpl: () => assert.fail("aucun appel de droits") });
  const pending = syncEntitlements(item.service, {}, item.flow);
  item.switchAccount();
  const expired = new Error("ancien jeton expiré");
  expired.invalidSession = true;
  token.reject(expired);
  await assert.rejects(pending, stale);
  assert.equal(item.mutations(), 0);
});

async function pendingRights({ silent = false } = {}) {
  const response = deferred(), entered = deferred();
  let requests = 0;
  const item = fixture({ fetchImpl: async () => {
    if (++requests === 2) entered.resolve();
    await response.promise;
    return jsonResponse(proPayload);
  } });
  const pending = syncEntitlements(item.service, { silent }, item.flow);
  await entered.promise;
  return { ...item, pending, response };
}

test("des réponses de droits tardives ne sont jamais appliquées au compte B", async () => {
  const item = await pendingRights();
  item.switchAccount();
  item.response.resolve();
  await assert.rejects(item.pending, stale);
  assert.equal(item.store.state.settings.account.uid, "account-b");
  assert.equal(item.store.state.commerce.subscription.tier, "free");
  assert.equal(item.mutations(), 0);
});

test("une reconnexion au même UID invalide aussi la réponse de l'ancienne génération", async () => {
  const item = await pendingRights();
  item.switchAccount("account-a");
  item.response.resolve();
  await assert.rejects(item.pending, stale);
  assert.equal(item.mutations(), 0);
});

test("une synchronisation silencieuse périmée termine sans erreur ni mutation", async () => {
  const item = await pendingRights({ silent: true });
  item.switchAccount();
  item.response.resolve();
  assert.equal(await item.pending, null);
  assert.equal(item.mutations(), 0);
});

test("les anciens doubles sans génération restent compatibles tant que l'UID est stable", async () => {
  const item = fixture();
  delete item.service.sessionGeneration;
  await syncEntitlements(item.service, {}, item.flow);
  assert.equal(item.store.state.commerce.subscription.tier, "pro");
  assert.equal(item.mutations(), 1);
});

test("sans identité, aucun renouvellement ni accès réseau n'est tenté", async () => {
  const item = fixture({ token: () => assert.fail("aucun renouvellement"), fetchImpl: () => assert.fail("aucun réseau") });
  item.store.state.settings.account.uid = "";
  await assert.rejects(syncEntitlements(item.service, {}, item.flow), (error) => error.invalidSession === true);
  assert.equal(await syncEntitlements(item.service, { silent: true }, item.flow), null);
  assert.equal(item.mutations(), 0);
});
