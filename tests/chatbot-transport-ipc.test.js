"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createDefaultState } = require("../src/main/defaults");
const { registerChatbotTransportIpc, chatbotTransportStatus } = require("../src/main/ipc/chatbot-transport");

function fixture() {
  const state = createDefaultState();
  state.commerce.subscription = { tier: "pro", status: "active" };
  state.settings.account = { uid: "owner", email: "owner@example.test", refreshTokenSecretId: "account-refresh" };
  state.connections = [{ id: "source_tiktok", name: "TikTok", type: "tiktok-direct", enabled: true, status: "connected" }];
  const secrets = new Map([["account-refresh", "private-account-token"]]);
  const handlers = new Map();
  let next = 0, refreshed = 0, reset = 0;
  const store = { safeStorage: { isEncryptionAvailable: () => true }, getState: () => state, getSecret: (key) => secrets.get(key) || "",
    setSecret: (key, value) => { key ||= `secret_${++next}`; secrets.set(key, value); return key; },
    set: (key, value) => { assert.equal(key, "settings.tiktok.chat"); state.settings.tiktok.chat = value; } };
  const core = { sourceHub: { getChatCapabilities: () => ({ canSend: true, transport: "euler-oauth", reason: "configured", confirmation: "platform" }),
    refreshChatCapabilities: () => { refreshed += 1; } }, liveEventActions: { chatbot: { syncTimers: () => {}, reset: () => { reset += 1; } } } };
  registerChatbotTransportIpc({ handle: (key, fn) => handlers.set(key, fn), core, store, integrationChange: (operation) => operation() });
  return { state, secrets, core, store, handlers, refreshed: () => refreshed, reset: () => reset,
    configure: (config) => handlers.get("chatbot:transport-configure")({}, config) };
}

const valid = () => ({ provider: "euler-oauth", apiKey: "private-euler-key", accessToken: "private-oauth-token",
  expiresAt: new Date(Date.now() + 3600000).toISOString(), botUsername: "my.bot", scopes: ["webcast:chat"], enableSend: true });

test("configuration d'envoi encryptée, dérivée du propriétaire et jamais renvoyée en clair", () => {
  const f = fixture();
  const result = f.configure({ ...valid(), accountUid: "foreign", apiKeySecretId: "account-refresh", accessTokenSecretId: "account-refresh" });
  const config = f.state.settings.tiktok.chat;
  assert.equal(config.accountUid, "owner");
  assert.equal(f.secrets.get(config.apiKeySecretId), "private-euler-key");
  assert.equal(f.secrets.get(config.accessTokenSecretId), "private-oauth-token");
  assert.equal(f.secrets.get("account-refresh"), "private-account-token");
  assert.doesNotMatch(JSON.stringify(config), /private-euler|private-oauth/);
  assert.doesNotMatch(JSON.stringify(result), /private-euler|private-oauth|secret_\d/);
  assert.equal(result.configuration.hasAccessToken, true);
  assert.equal(f.refreshed(), 1);
  assert.equal(f.reset(), 1);
});

test("consentement, portée, expiration et compte expéditeur validés avant écriture", () => {
  for (const change of [{ enableSend: false }, { scopes: [] }, { expiresAt: "2020-01-01T00:00:00Z" },
    { botUsername: "" }, { apiKey: "line\nbreak" }, { accessToken: "" }, { provider: "unknown" }]) {
    const f = fixture();
    assert.throws(() => f.configure({ ...valid(), ...change }));
    assert.equal(f.secrets.size, 1);
    assert.equal(f.refreshed(), 0);
    assert.equal(f.state.settings.tiktok.chat, undefined);
  }
});

test("identifiants existants conservés seulement pour leur propre compte", () => {
  const f = fixture();
  f.configure(valid());
  const previous = { ...f.state.settings.tiktok.chat };
  f.configure({ ...valid(), apiKey: "", accessToken: "" });
  assert.equal(f.state.settings.tiktok.chat.apiKeySecretId, previous.apiKeySecretId);
  f.state.settings.account.uid = "another-owner";
  assert.throws(() => f.configure({ ...valid(), apiKey: "", accessToken: "" }), /requis/);
  assert.equal(chatbotTransportStatus(f.core, f.store).configuration.hasAccessToken, false);
  assert.equal(f.state.settings.tiktok.chat.accountUid, "owner");
});

test("désactiver retire uniquement les secrets d'envoi du propriétaire", () => {
  const f = fixture();
  f.configure(valid());
  const previous = { ...f.state.settings.tiktok.chat };
  f.configure({ provider: "none" });
  assert.equal(f.secrets.get(previous.accessTokenSecretId), "");
  assert.equal(f.secrets.get(previous.apiKeySecretId), "");
  assert.equal(f.secrets.get("account-refresh"), "private-account-token");
  assert.equal(f.state.settings.tiktok.chat.provider, "none");
});

test("sources désactivées et non connectées ne revendiquent pas la capacité d'envoi", () => {
  const f = fixture();
  f.state.connections[0].enabled = false;
  assert.equal(chatbotTransportStatus(f.core, f.store).connections[0].canSend, false);
  f.state.connections[0].enabled = true;
  f.state.connections[0].status = "disconnected";
  assert.equal(chatbotTransportStatus(f.core, f.store).connections[0].canSend, false);
});

test("un compte non authentifié ne configure aucun secret", () => {
  const f = fixture();
  f.state.settings.account = {};
  assert.throws(() => f.configure(valid()));
  assert.equal(f.secrets.size, 1);
});

test("l'envoi refuse le fallback base64 quand le chiffrement OS est indisponible", () => {
  const f = fixture();
  f.store.safeStorage.isEncryptionAvailable = () => false;
  assert.throws(() => f.configure(valid()), /chiffrement/);
  assert.equal(f.secrets.size, 1);
});

test("révocation possible même si l'ancienne expiration est malformée", () => {
  const f = fixture();
  f.configure(valid());
  f.state.settings.tiktok.chat.expiresAt = "invalid-date";
  assert.doesNotThrow(() => f.configure({ provider: "none" }));
  assert.equal(f.state.settings.tiktok.chat.provider, "none");
});

test("échec de seconde écriture ne remplace aucun ancien identifiant ni configuration", () => {
  const f = fixture();
  f.configure(valid());
  const previous = structuredClone(f.state.settings.tiktok.chat);
  const setSecret = f.store.setSecret;
  f.store.setSecret = (key, value) => {
    if (value === "new-token") throw new Error("write-failed");
    return setSecret(key, value);
  };
  assert.throws(() => f.configure({ ...valid(), apiKey: "new-key", accessToken: "new-token" }), /write-failed/);
  assert.deepEqual(f.state.settings.tiktok.chat, previous);
  assert.equal(f.store.getSecret(previous.apiKeySecretId), "private-euler-key");
  assert.equal(f.store.getSecret(previous.accessTokenSecretId), "private-oauth-token");
  assert.equal([...f.secrets.values()].includes("new-key"), false);
});
