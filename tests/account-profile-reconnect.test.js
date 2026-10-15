"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { StateStore } = require("../src/main/store");
const { AccountService } = require("../src/main/account-service");
const { normalizeSongRequestSettings } = require("../src/main/spotify/song-request-settings");

/** Aucun transport réel : une URL inattendue fait immédiatement échouer le test. */
function syntheticAccountFetch(requests) {
  const users = new Map([
    ["alpha@example.test", { uid: "fixture-alpha", email: "alpha@example.test", name: "Alpha" }],
    ["beta@example.test", { uid: "fixture-beta", email: "beta@example.test", name: "Beta" }]
  ]);
  const byToken = (token, prefix) => [...users.values()].find((user) => token === `${prefix}${user.uid}`);
  const json = (payload) => new Response(JSON.stringify(payload), { status: 200 });
  return async (url, options = {}) => {
    await Promise.resolve(); // Les frontières asynchrones sont celles du service réel.
    const target = new URL(url);
    requests.push(target.pathname);
    if (target.hostname === "identitytoolkit.googleapis.com" && target.pathname === "/v1/accounts:signInWithPassword") {
      const body = JSON.parse(options.body), user = users.get(body.email);
      assert.ok(user, "le test n'autorise que ses comptes synthétiques");
      assert.equal(body.password, "fixture-password");
      return json({ email: user.email, localId: user.uid, displayName: user.name,
        idToken: `fixture-id-${user.uid}`, refreshToken: `fixture-refresh-${user.uid}`, expiresIn: "3600" });
    }
    if (target.hostname === "identitytoolkit.googleapis.com" && target.pathname === "/v1/accounts:lookup") {
      const user = byToken(JSON.parse(options.body).idToken, "fixture-id-");
      assert.ok(user);
      return json({ users: [{ localId: user.uid, email: user.email, displayName: user.name,
        emailVerified: true, providerUserInfo: [{ providerId: "password" }] }] });
    }
    if (target.hostname === "securetoken.googleapis.com" && target.pathname === "/v1/token") {
      const user = byToken(new URLSearchParams(options.body).get("refresh_token"), "fixture-refresh-");
      assert.ok(user);
      return json({ user_id: user.uid, id_token: `fixture-id-${user.uid}`,
        refresh_token: `fixture-refresh-${user.uid}`, expires_in: "3600" });
    }
    if (target.hostname === "account.fixture.invalid" &&
        ["/api/account/entitlements", "/api/entitlements/subscription"].includes(target.pathname)) {
      const user = [...users.values()].find((entry) => target.searchParams.get("uid") === entry.uid);
      assert.ok(user);
      if (target.pathname === "/api/account/entitlements") {
        assert.equal(options.headers.Authorization, `Bearer fixture-id-${user.uid}`);
      }
      return json({ checkedAt: "2026-10-15T10:00:00.000Z", source: "free", tier: "free", gameEntitlements: [] });
    }
    throw new Error(`Transport non simulé interdit : ${target.hostname}${target.pathname}`);
  };
}

test("AccountService et le vrai StateStore restaurent deux profils après reconnexion, sans mélanger A et B", async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-account-profile-integration-"));
  const stores = [], requests = [], generations = [], activations = [];
  const fetchImpl = syntheticAccountFetch(requests);
  const open = () => {
    const store = new StateStore(directory, { isEncryptionAvailable: () => false });
    store.load();
    stores.push(store);
    const atomicWrite = store.storage.atomicWrite.bind(store.storage);
    store.storage.atomicWrite = (filePath, content, ...args) => {
      if (filePath === store.filePath) {
        const saved = JSON.parse(content);
        generations.push({ activeUid: saved.activeAccountUid || "", identityUid: saved.settings.account.uid || "" });
        assert.equal(saved.settings.account.uid || "", saved.activeAccountUid || "",
          "aucune génération disque ne doit associer les profils d'un compte à l'identité d'un autre");
      }
      return atomicWrite(filePath, content, ...args);
    };
    const activateAccount = store.activateAccount.bind(store);
    store.activateAccount = (uid, accountSession) => {
      activations.push({ uid, identityUid: accountSession?.uid || "" });
      assert.equal(accountSession?.uid, uid, "AccountService fournit l'identité complète à la transaction du store");
      return activateAccount(uid, accountSession);
    };
    return { store, account: new AccountService({ store, fetchImpl, webOrigin: "https://account.fixture.invalid" }) };
  };
  context.after(() => {
    for (const store of stores) store.flush();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const login = async (session, email) => {
    const status = await session.account.login({ email, password: "fixture-password" });
    assert.equal(status.authenticated, true);
    assert.equal(session.store.getActiveAccountUid(), status.uid);
    return status;
  };
  const voice = (name, rate) => ({ enabled: true, language: "fr-FR", voice: name, rate, pitch: 1, volume: 0.6, profanityFilter: true });
  const voiceA1 = voice("Voix A1", 1.1), voiceA2 = voice("Voix A2", 1.4);
  const musicA1 = normalizeSongRequestSettings({ enabled: true, maxQueue: 7, commands: { request: "!a1" } });
  const musicA2 = normalizeSongRequestSettings({ enabled: false, maxQueue: 13, commands: { request: "!a2" } });
  const sound = { id: "custom:fixture-alpha-sound", name: "Son Alpha", kind: "sound", source: "custom",
    url: "https://media.fixture.invalid/alpha.mp3", contentType: "audio/mpeg", size: 128 };
  let session = open();
  await login(session, "alpha@example.test");
  const firstProfileId = session.store.state.session.profileId;
  session.store.upsert("profiles", { id: firstProfileId, name: "A1" });
  session.store.set("settings.tts", voiceA1);
  session.store.set("settings.spotify.songRequests", musicA1);
  session.store.upsert("rules", { id: "rule-a1", name: "Action A1", enabled: true,
    trigger: { type: "follow" }, actions: [{ id: "action-a1", type: "tts.speak", config: { text: "A1" } }] });
  session.store.upsert("profiles", { id: "profile-a2", name: "A2" });
  session.store.selectProfile("profile-a2");
  session.store.set("settings.tts", voiceA2);
  session.store.set("settings.spotify.songRequests", musicA2);
  session.store.upsert("rules", { id: "rule-a2", name: "Action A2", enabled: true,
    trigger: { type: "follow" }, actions: [{ id: "action-a2", type: "audio.play", config: { url: sound.url } }] });
  session.store.mutate((state) => { state.customSounds = [sound]; });
  const verifyAlpha = (store) => {
    assert.deepEqual(store.state.profiles.map((profile) => [profile.id, profile.name]), [[firstProfileId, "A1"], ["profile-a2", "A2"]]);
    assert.equal(store.state.session.profileId, "profile-a2");
    assert.deepEqual(store.state.settings.tts, voiceA2);
    assert.deepEqual(store.state.settings.spotify.songRequests, musicA2);
    assert.equal(store.state.rules[0].id, "rule-a2");
    assert.deepEqual(store.state.customSounds, [sound]);
    store.selectProfile(firstProfileId);
    assert.deepEqual(store.state.settings.tts, voiceA1);
    assert.deepEqual(store.state.settings.spotify.songRequests, musicA1);
    assert.equal(store.state.rules[0].id, "rule-a1");
    store.selectProfile("profile-a2");
  };
  session.account.logout();
  assert.equal(session.store.getActiveAccountUid(), "");
  assert.equal(session.store.getAccountSession().uid, "");
  session.store.flush();
  session = open();
  assert.deepEqual(session.store.state.rules, []);
  await login(session, "alpha@example.test");
  verifyAlpha(session.store);
  await login(session, "beta@example.test");
  assert.equal(session.store.state.profiles.length, 1);
  assert.equal(session.store.state.profiles[0].name, "Démarrage");
  assert.deepEqual(session.store.state.rules, []);
  assert.deepEqual(session.store.state.customSounds, []);
  assert.equal(session.store.state.settings.tts.voice, "");
  assert.equal(session.store.state.settings.spotify.songRequests.enabled, false);
  assert.equal(session.store.state.settings.spotify.songRequests.maxQueue, 20);
  session.account.logout();
  session.store.flush();
  session = open();
  await login(session, "alpha@example.test");
  verifyAlpha(session.store);
  assert.equal(activations.length, 4);
  assert.equal(activations.every(({ uid, identityUid }) => uid === identityUid), true);
  assert.ok(generations.some(({ activeUid }) => activeUid === "fixture-alpha"));
  assert.ok(generations.some(({ activeUid }) => activeUid === "fixture-beta"));
  assert.ok(generations.some(({ activeUid }) => activeUid === ""));
  assert.equal(requests.filter((request) => request === "/v1/accounts:signInWithPassword").length, 4);
});
