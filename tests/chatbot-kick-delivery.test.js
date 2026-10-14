"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { KickService } = require("../src/main/kick-service");
const { SourceHub } = require("../src/main/source-hub");
const { ChatbotService } = require("../src/main/chatbot-service");

async function fixture({ expiresAt = 0, fetchImpl } = {}) {
  const requests = [], activities = [];
  const state = {
    commands: [{ id: "hello", command: "!hello", response: "Bonjour", enabled: true }],
    connections: [{ id: "source_kick", type: "kick-native", enabled: true, status: "connected" }],
    session: { running: true, profileId: "profile-1", startedAt: "2026-01-01" },
    commerce: { subscription: { tier: "pro", status: "active" } },
    settings: { account: { uid: "owner", email: "owner@example.com", refreshTokenSecretId: "account-token" },
      siteVisibility: {}, kick: { live: true, account: { id: "987" }, expiresAt, accessTokenSecretId: "kick-token", refreshTokenSecretId: "kick-refresh" } }
  };
  const store = { getState: () => state, getSecret: () => "fixture-only-token", mutateRuntime: (mutator) => mutator(state) };
  const kick = new KickService({ store, openExternal: () => { throw new Error("OAuth réel interdit dans ce test"); },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return fetchImpl ? fetchImpl(url, options, requests.length) : { ok: true, status: 200, json: async () => ({ data: { is_sent: true, message_id: "fixture-only-message" } }) };
    } });
  kick.start = async () => {}; // Ni serveur, ni abonnement webhook, ni OAuth.
  const hub = new SourceHub({ store, kickService: kick });
  await hub.start("source_kick");
  state.settings.kick.live = true; // Faux événement LIVE reçu après la connexion.
  const service = new ChatbotService({ store, sourceHub: hub, overlayServer: { publish: () => {} }, onActivity: (...args) => activities.push(args) });
  const event = { type: "chat", source: "source_kick", user: { id: "lou", name: "lou" }, data: { message: "!hello" } };
  return { state, kick, hub, service, requests, activities, event };
}

test("après refresh différé : aucun HTTP chat si profil, compte, LIVE ou source ont changé", async () => {
  for (const mutate of [
    (f) => { f.state.session.profileId = "profile-2"; },
    (f) => { f.state.settings.account.uid = "another-owner"; },
    (f) => { f.state.settings.account = {}; },
    (f) => { f.state.session.running = false; },
    (f) => { f.state.settings.kick.account.id = "another-kick-account"; },
    (f) => { f.hub.runtimes.set("source_kick", { send: () => {} }); }
  ]) {
    const f = await fixture();
    let release;
    f.kick.refresh = () => new Promise((resolve) => { release = resolve; });
    assert.equal(f.service.handleChat(f.event).queued, true);
    assert.equal(typeof release, "function");
    mutate(f);
    f.state.settings.kick.expiresAt = Date.now() + 3600000;
    release(); await f.service.whenIdle();
    assert.equal(f.requests.length, 0, "le POST /chat n'a pas encore été lancé et doit rester annulable");
    f.service.reset();
  }
});

test("envoi normal conserve le payload Kick existant après refresh et ne bloque pas le chat", async () => {
  const f = await fixture();
  let release;
  f.kick.refresh = () => new Promise((resolve) => { release = resolve; });
  const result = f.service.handleChat(f.event);
  assert.equal(result.queued, true);
  assert.equal(result instanceof Promise, false);
  assert.equal(f.requests.length, 0);
  f.state.settings.kick.expiresAt = Date.now() + 3600000;
  release(); await f.service.whenIdle();
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, "https://api.kick.com/public/v1/chat");
  assert.deepEqual(JSON.parse(f.requests[0].options.body), { content: "Bonjour", type: "user", broadcaster_user_id: 987 });
  assert.equal(f.activities[0][4].sent, true);
  f.service.reset();
});

test("retry HTTP 401 revalide la garde après le second refresh avant tout nouveau POST chat", async () => {
  const f = await fixture({ expiresAt: Date.now() + 3600000,
    fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ message: "expired" }) }) });
  let release;
  f.kick.refresh = () => new Promise((resolve) => { release = resolve; });
  f.service.handleChat(f.event);
  // Le faux HTTP se résout en microtask et déclenche le refresh du retry.
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(f.requests.length, 1);
  assert.equal(typeof release, "function");
  f.state.session.profileId = "profile-2";
  release(); await f.service.whenIdle();
  assert.equal(f.requests.length, 1, "le second POST /chat doit être annulé");
  assert.equal(f.activities.length, 0);
  f.service.reset();
});

test("les autres requêtes Kick restent indépendantes de la garde réservée au chat", async () => {
  const f = await fixture({ expiresAt: Date.now() + 3600000 });
  await f.kick.request("/channels", { shouldSend: () => false });
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, "https://api.kick.com/public/v1/channels");
  f.service.reset();
});

test("une requête HTTP déjà partie n'est pas retirée, mais son résultat reste hors du nouveau profil", async () => {
  let release;
  const f = await fixture({ expiresAt: Date.now() + 3600000,
    fetchImpl: () => new Promise((resolve) => { release = resolve; }) });
  f.service.handleChat(f.event);
  assert.equal(f.requests.length, 1);
  f.state.session.profileId = "profile-2";
  release({ ok: true, status: 200, json: async () => ({ data: [] }) });
  await f.service.whenIdle();
  assert.equal(f.requests.length, 1);
  assert.equal(f.activities.length, 0);
  f.service.reset();
});
