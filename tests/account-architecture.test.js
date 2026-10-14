"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const account = require("../src/main/account-service");
const validation = require("../src/main/account/validation");
const { requestJson } = require("../src/main/account/http-client");
const { createGoogleIdTokenLoopback } = require("../src/main/account/google-loopback");
const { createPaymentLoopbackCallback } = require("../src/main/account/payment-loopback");

test("la façade de compte conserve tous les exports historiques", () => {
  assert.deepEqual(Object.keys(account).sort(), [
    "AccountService", "cleanDisplayName", "cleanUid", "createGoogleIdTokenLoopback",
    "createLoopbackCallback", "createPaymentLoopbackCallback", "normalizeEmail", "requireEmail"
  ]);
  assert.equal(account.normalizeEmail, validation.normalizeEmail);
  assert.equal(account.requireEmail, validation.requireEmail);
  assert.equal(account.cleanUid, validation.cleanUid);
  assert.equal(account.createGoogleIdTokenLoopback, createGoogleIdTokenLoopback);
  assert.equal(account.createPaymentLoopbackCallback, createPaymentLoopbackCallback);
});

test("la requête JSON commune préserve exactement le contexte et les options de l'appelant", async () => {
  const options = {
    method: "POST", headers: { Authorization: "Bearer synthetic-test-token" },
    body: '{"productId":"test-product"}', signal: AbortSignal.timeout(1000)
  };
  const service = {
    async fetch(url, received) {
      assert.equal(this, service);
      assert.equal(url, "https://example.test/payment");
      assert.equal(received, options);
      return new Response('{"ok":true}', { status: 200 });
    }
  };
  assert.deepEqual(await requestJson(service, "https://example.test/payment", options), { ok: true });
});

test("le lecteur JSON commun conserve erreurs, réponses vides et classification de session", async () => {
  const service = { fetch: async () => new Response("", { status: 200 }) };
  assert.deepEqual(await requestJson(service, "https://example.test", {}), {});
  service.fetch = async () => new Response("Refus textuel", { status: 401 });
  await assert.rejects(requestJson(service, "https://example.test", {}), (error) =>
    error.message === "Refus textuel" && error.status === 401 && error.invalidSession === true);
  service.fetch = async () => new Response('{"message":"Interdit"}', { status: 403 });
  await assert.rejects(requestJson(service, "https://example.test", {}), (error) =>
    error.message === "Interdit" && error.status === 403 && error.invalidSession === false);
  const offline = new Error("Panne réseau");
  service.fetch = async () => { throw offline; };
  await assert.rejects(requestJson(service, "https://example.test", {}), (error) => error === offline);
});

function identityFixture() {
  let session = { uid: "test_uid", email: "test@example.com", refreshTokenSecretId: "refresh" };
  const store = {
    getAccountSession: () => structuredClone(session),
    getSecret: () => "synthetic-refresh-token",
    setSecret() {},
    getState() { throw new Error("La présence ne doit pas cloner l'état complet."); }
  };
  return { store, changeAccount: (uid) => { session = { ...session, uid }; } };
}

test("deux demandes de présence partagent un seul renouvellement et gardent la projection de compte", async () => {
  const { store } = identityFixture();
  let respond;
  let calls = 0;
  const service = new account.AccountService({
    store, fetchImpl: async (url, options) => {
      calls += 1;
      assert.match(url, /securetoken\.googleapis\.com/);
      assert.equal(options.method, "POST");
      return new Promise((resolve) => { respond = resolve; });
    }
  });
  const first = service.identityForLiveDirectory();
  const second = service.identityForLiveDirectory();
  assert.equal(calls, 1);
  respond(new Response(JSON.stringify({
    user_id: "test_uid", id_token: "synthetic-id-token", expires_in: "3600"
  }), { status: 200 }));
  assert.deepEqual(await first, { uid: "test_uid", idToken: "synthetic-id-token" });
  assert.deepEqual(await second, { uid: "test_uid", idToken: "synthetic-id-token" });
  assert.equal(service.refreshPromise, null);
  await service.identityForLiveDirectory();
  assert.equal(calls, 1);
});

test("un changement de compte pendant le renouvellement ne publie pas l'identité précédente", async () => {
  const { store, changeAccount } = identityFixture();
  let respond;
  const service = new account.AccountService({
    store, fetchImpl: () => new Promise((resolve) => { respond = resolve; })
  });
  const identity = service.identityForLiveDirectory();
  changeAccount("other_uid");
  respond(new Response(JSON.stringify({
    user_id: "test_uid", id_token: "synthetic-id-token", expires_in: "3600"
  }), { status: 200 }));
  await assert.rejects(identity, /compte ShenPulse a changé/);
});
