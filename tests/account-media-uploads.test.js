"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { AccountService } = require("../src/main/account-service");
const { createStore, jsonResponse } = require("./helpers/account-service-fixtures");

function fixture(fetchImpl) {
  const store = createStore();
  store.state.settings.account = { uid: "ordinary_user", email: "user@example.com" };
  const service = new AccountService({ store, fetchImpl });
  service.idToken = "firebase-test-token";
  service.expiresAt = Date.now() + 3600000;
  return { store, service };
}

const request = { fileName: "Mon son.mp3", contentType: "audio/mpeg", size: 12, expectedUid: "ordinary_user" };

test("un compte gratuit sans secret B2 prépare un import avec son identité Firebase", async () => {
  let call;
  const result = { ok: true, media: { key: "mediauploads/ordinary_user/object.mp3" }, upload: { method: "PUT" } };
  const { service, store } = fixture(async (url, options) => {
    call = { url, options };
    return jsonResponse(result);
  });
  assert.deepEqual(await service.prepareMediaUpload({ ...request, ownerId: "forged-owner" }), result);
  assert.equal(call.url, "https://shenpulse.leuridan.fr/api/media/uploads/create");
  assert.equal(call.options.headers.Authorization, "Bearer firebase-test-token");
  assert.equal(call.options.redirect, "error");
  assert.deepEqual(JSON.parse(call.options.body), {
    ownerId: "ordinary_user", fileName: request.fileName, contentType: request.contentType, size: 12
  });
  assert.equal(store.state.commerce.subscription.tier, "free");
  assert.equal(store.secrets.size, 0);
});

test("refuse les fichiers invalides avant de contacter le stockage", async () => {
  const { service } = fixture(() => assert.fail("aucune requête attendue"));
  for (const invalid of [
    { size: 0 }, { size: 201 * 1024 * 1024 }, { size: 1.2 },
    { fileName: "../son.mp3" }, { fileName: "C:\\son.mp3" }, { fileName: "" },
    { contentType: "application/javascript" }
  ]) {
    await assert.rejects(() => service.prepareMediaUpload({ ...request, ...invalid }), /fichier|format/);
  }
});

test("une déconnexion ou un compte différent interdit la préparation", async () => {
  const { service, store } = fixture(() => assert.fail("aucune requête attendue"));
  store.state.settings.account.uid = "other_user";
  await assert.rejects(() => service.prepareMediaUpload(request), /compte.*changé/);
  store.state.settings.account.uid = "";
  await assert.rejects(() => service.prepareMediaUpload(request), /compte.*changé/);
});

test("un changement de compte pendant la requête invalide le ticket reçu", async () => {
  const { service, store } = fixture(async () => {
    store.state.settings.account.uid = "other_user";
    return jsonResponse({ ok: true });
  });
  await assert.rejects(() => service.prepareMediaUpload(request), /compte.*changé/);
});

test("un changement de compte pendant le renouvellement interdit l’appel du courtier", async () => {
  const { service, store } = fixture(async (url) => {
    assert.match(url, /securetoken/);
    store.state.settings.account.uid = "other_user";
    return jsonResponse({ user_id: "ordinary_user", id_token: "renewed", expires_in: "3600" });
  });
  service.idToken = "";
  store.state.settings.account.refreshTokenSecretId = store.setSecret("", "test-refresh");
  await assert.rejects(() => service.prepareMediaUpload(request), /compte.*changé/);
});

test("les erreurs du serveur restent utiles sans révéler de diagnostic privé", async () => {
  for (const [status, error, pattern] of [
    [401, "Authentification Firebase manquante", /session.*expiré/],
    [500, "Authentification Firebase invalide: diagnostic-secret", /session.*expiré/],
    [413, "internal-details", /200 Mio/],
    [429, "internal-details", /Patientez/],
    [500, "diagnostic-secret", /préparer.*500/]
  ]) {
    const { service } = fixture(async () => jsonResponse({ error }, status));
    await assert.rejects(() => service.prepareMediaUpload(request), (failure) => {
      assert.match(failure.message, pattern);
      assert.doesNotMatch(failure.message, /diagnostic-secret|internal-details/);
      return true;
    });
  }
  const { service } = fixture(async () => { throw new Error("private-url-and-token"); });
  await assert.rejects(() => service.prepareMediaUpload(request), /temporairement inaccessible/);
});
