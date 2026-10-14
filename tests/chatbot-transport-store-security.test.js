"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { StateStore } = require("../src/main/store");

function fixture(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-chatbot-security-"));
  const store = new StateStore(directory, { isEncryptionAvailable: () => false });
  store.load(); store.activateAccount("owner");
  const accountSecretId = store.setSecret("", "fixture-account-token");
  store.set("settings.account", { uid: "owner", email: "owner@example.test", refreshTokenSecretId: accountSecretId });
  context.after(() => { store.flush(); fs.rmSync(directory, { recursive: true, force: true }); });
  const own = { provider: "euler-oauth", accountUid: "owner", apiKeySecretId: "owner-api-key", accessTokenSecretId: "owner-oauth-token",
    expiresAt: "2030-10-13T23:00:00.000Z", scopes: ["webcast:chat"], botUsername: "ownerbot" };
  const incoming = () => ({ rules: [{ id: "imported-rule", enabled: true, trigger: { type: "chat" },
    actions: [{ type: "tts.speak", config: { text: "Imported action" } }] }],
    commands: [{ id: "imported-command", command: "!hello", response: "Bonjour" }],
    profiles: [{ id: "profile_starter", name: "Profil importé" }], settings: { tiktok: { username: "imported_creator",
      chat: { provider: "euler-oauth", accountUid: "owner", apiKeySecretId: "other-api-key", accessTokenSecretId: "other-oauth-token",
        expiresAt: "2030-10-13T23:00:00.000Z", scopes: ["webcast:chat"], botUsername: "otherbot",
        accessToken: "plaintext-export-token", sessionId: "plaintext-cookie" } } } });
  return { store, directory, own, incoming };
}

test("importer un profil ne remplace jamais le consentement ou les références d'envoi du propriétaire", (context) => {
  const { store, own, incoming } = fixture(context);
  store.set("settings.tiktok.chat", own);
  const imported = incoming(), before = JSON.stringify(imported);
  store.importState(imported);
  const actual = store.getStateProjection(["settings.tiktok.chat", "settings.tiktok.username", "rules", "commands"]);
  assert.deepEqual(actual.settings.tiktok.chat, own);
  assert.equal(actual.settings.tiktok.username, "imported_creator");
  assert.equal(actual.rules[0].actions[0].config.text, "Imported action");
  assert.equal(actual.commands[0].response, "Bonjour");
  assert.equal(JSON.stringify(imported), before, "l'import ne réécrit pas l'objet source");
});

test("importer une autorisation d'envoi ne l'active pas sur une installation sans consentement", (context) => {
  const { store, incoming } = fixture(context);
  store.importState(incoming());
  assert.deepEqual(store.getStateProjection(["settings.tiktok.chat"]).settings.tiktok.chat, { provider: "none" });
  assert.equal(store.getSecret("other-api-key"), "");
  assert.doesNotMatch(fs.readFileSync(store.filePath, "utf8"), /plaintext-export-token|plaintext-cookie|other-oauth-token/);
});

test("une référence historique d'un autre compte n'est pas adoptée à l'import", (context) => {
  const { store, own, incoming } = fixture(context);
  store.set("settings.tiktok.chat", { ...own, accountUid: "previous-owner" });
  store.importState(incoming());
  assert.deepEqual(store.getStateProjection(["settings.tiktok.chat"]).settings.tiktok.chat, { provider: "none" });
});

test("snapshots publics/runtime et annuaire excluent identifiants du coffre et champs d'authentification inattendus", (context) => {
  const { store, own } = fixture(context);
  store.set("settings.tiktok.chat", { ...own, accessToken: "unexpected-plaintext-token", clientSecret: "unexpected-client-secret",
    nested: { sessionId: "unexpected-cookie" } });
  const current = store.getState(), runtime = store.getRuntimeState(), directory = store.getLiveDirectoryState();
  for (const snapshot of [current, runtime, directory]) {
    assert.doesNotMatch(JSON.stringify(snapshot), /owner-api-key|owner-oauth-token|unexpected-/);
  }
  assert.equal(current.settings.tiktok.chat.provider, "euler-oauth");
  assert.equal(current.settings.tiktok.chat.botUsername, "ownerbot");
  assert.equal(directory.settings.tiktok.chat, undefined);
  assert.equal(store.getStateProjection(["settings.tiktok.chat"]).settings.tiktok.chat.accessTokenSecretId, own.accessTokenSecretId,
    "les services main utilisent la projection interne, pas le snapshot du renderer");
});

test("bascule de compte conserve chaque autorisation propre mais ne divulgue pas ses références", (context) => {
  const { store, own } = fixture(context);
  store.set("settings.tiktok.chat", own);
  store.activateAccount("second-owner");
  assert.equal(store.getStateProjection(["settings.tiktok.chat"]).settings.tiktok.chat?.provider || "none", "none");
  store.activateAccount("owner");
  assert.deepEqual(store.getStateProjection(["settings.tiktok.chat"]).settings.tiktok.chat, own);
  assert.equal(store.getState().settings.tiktok.chat.apiKeySecretId, undefined);
});
