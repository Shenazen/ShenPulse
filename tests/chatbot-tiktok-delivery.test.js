"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { RelayChatDelivery, RELAY_CHAT_PROTOCOL, MAX_PENDING_RELAY_CHATS } = require("../src/main/sources/relay-chat-delivery");
const { EulerOAuthChatDelivery, validateTikTokChatConfiguration, tiktokChatConfigurationStatus,
  EULER_CHAT_API, MAX_EULER_CHAT_RESPONSE_BYTES } = require("../src/main/sources/euler-oauth-chat-delivery");

const NOW = Date.parse("2026-10-13T18:00:00.000Z");
const config = () => ({ provider: "euler-oauth", apiKeySecretId: "euler-key-ref", accessTokenSecretId: "euler-oauth-ref",
  accountUid: "shenpulse-owner", expiresAt: new Date(NOW + 60000).toISOString(), scopes: ["webcast:chat"], botUsername: "ShenPulseBot" });
const confirmed = () => new Response(JSON.stringify({ code: 200, data: { status_code: 0, data: {}, extra: {} } }));
const settled = () => new Promise((resolve) => setImmediate(resolve));

function timers() {
  const callbacks = new Map();
  return { callbacks, setTimeoutFn: (fn) => { const id = { unref() {} }; callbacks.set(id, fn); return id; },
    clearTimeoutFn: (id) => callbacks.delete(id), expire: () => [...callbacks.values()].forEach((fn) => fn()) };
}

function relay() {
  let now = 0, current = true, roomId = "7123456", id = 0;
  const outbound = [], clock = timers(), changes = [];
  const socket = { readyState: 1, send: (json) => outbound.push(JSON.parse(json)) };
  const delivery = new RelayChatDelivery({ getSocket: () => socket, isCurrent: () => current,
    getRoomId: () => roomId, now: () => now, ...clock, requestId: () => `request-${++id}`,
    onChanged: (status) => changes.push(status) });
  const capability = (extra = {}) => delivery.handle({ action: "chat-capabilities", protocol: RELAY_CHAT_PROTOCOL,
    platform: "tiktok", canSend: true, authenticated: true, acknowledgements: true, ...extra });
  const ack = (requestId, extra = {}) => delivery.handle({ action: "chat-delivery", protocol: RELAY_CHAT_PROTOCOL,
    platform: "tiktok", roomId, requestId, sent: true, ...extra });
  return { delivery, outbound, socket, clock, changes, capability, ack,
    advance: (ms = 1500) => { now += ms; }, changeRoom: () => { roomId = "7654321"; }, stop: () => { current = false; } };
}

function oauth(fetchFn = async () => confirmed()) {
  let now = NOW;
  const session = { config: config(), accountUid: "shenpulse-owner", authenticated: true,
    apiKey: "fixture-api-key", accessToken: "fixture-oauth-token" };
  const requests = [], clock = timers();
  const delivery = new EulerOAuthChatDelivery({ getSession: () => session, now: () => now, ...clock,
    fetchFn: async (url, options) => { requests.push({ url, options }); return fetchFn(url, options); } });
  return { session, delivery, requests, clock, advance: (ms = 1500) => { now += ms; } };
}

test("TikTok configuration: validation pure et expiration ISO sans exposer de secrets", () => {
  const source = config(), before = JSON.stringify(source);
  assert.deepEqual(validateTikTokChatConfiguration(source, { now: NOW, requireCredentials: true }), source);
  assert.equal(JSON.stringify(source), before);
  assert.throws(() => validateTikTokChatConfiguration({ ...source, provider: "fake-provider" }));
  assert.throws(() => validateTikTokChatConfiguration({ ...source, expiresAt: "123456789" }));
  assert.throws(() => validateTikTokChatConfiguration({ ...source, expiresAt: new Date(NOW).toISOString() }, { now: NOW, requireCredentials: true }));
  assert.throws(() => validateTikTokChatConfiguration({ ...source, scopes: ["webcast:fetch"] }, { now: NOW, requireCredentials: true }));
});

test("TikTok configuration: état configuré, scope manquant, compte différent et jeton expiré", () => {
  const options = { now: NOW, accountUid: "shenpulse-owner", authenticated: true, hasApiKey: true, hasAccessToken: true };
  assert.equal(tiktokChatConfigurationStatus(config(), options).canSend, true);
  assert.equal(tiktokChatConfigurationStatus(config(), options).authorization, "configured");
  assert.equal(tiktokChatConfigurationStatus({ provider: "none" }, options).reason, "not-configured");
  assert.equal(tiktokChatConfigurationStatus(config(), { ...options, accountUid: "other" }).reason, "account-mismatch");
  assert.equal(tiktokChatConfigurationStatus(config(), { ...options, hasApiKey: false }).reason, "credentials-missing");
  assert.equal(tiktokChatConfigurationStatus({ ...config(), scopes: ["webcast:fetch"] }, options).reason, "scope-missing");
  assert.equal(tiktokChatConfigurationStatus(config(), { ...options, now: NOW + 60001 }).reason, "token-expired");
  assert.doesNotMatch(JSON.stringify(tiktokChatConfigurationStatus(config(), options)), /SecretId|fixture|token-ref/);
});

test("relais : aucun envoi sans capacité authentifiée et confirmation explicite", async () => {
  const f = relay();
  await assert.rejects(f.delivery.send({ message: "bonjour" }), { code: "relay-chat-unavailable" });
  for (const extra of [{ authenticated: false }, { acknowledgements: false }, { protocol: "other" }, { platform: "kick" }]) {
    f.capability(extra);
    assert.equal(f.delivery.canSend(), false);
  }
  assert.equal(f.outbound.length, 0);
  f.delivery.requestCapabilities();
  assert.deepEqual(f.outbound[0], { action: "chat-capabilities", protocol: RELAY_CHAT_PROTOCOL, platform: "tiktok" });
});

test("relais : socket.send et accepté/en-file ne sont jamais marqués envoyés", async () => {
  const f = relay(); f.capability();
  let completed = false;
  const pending = f.delivery.send({ message: "Bonjour" }).then((result) => { completed = true; return result; });
  const request = f.outbound[0];
  assert.equal(request.action, "send-chat"); assert.equal(request.roomId, "7123456");
  f.ack(request.requestId, { sent: undefined, accepted: true, queued: true });
  await settled(); assert.equal(completed, false);
  f.ack(request.requestId);
  assert.equal((await pending).acknowledged, true);
  assert.equal(f.clock.callbacks.size, 0);
});

test("relais : mauvais protocole, identifiant et salon ne confirment rien", async () => {
  const f = relay(); f.capability();
  const pending = f.delivery.send({ message: "bonjour" });
  f.ack("other"); f.ack("request-1", { roomId: "previous-room" });
  f.ack("request-1", { protocol: "wrong" }); f.ack("request-1", { platform: "kick" });
  assert.equal(f.delivery.pending.size, 1);
  f.clock.expire();
  await assert.rejects(pending, { code: "relay-chat-timeout" });
  assert.equal(f.delivery.pending.size, 0);
  assert.equal(f.delivery.handle({ event: "chat", data: {} }), false);
});

test("relais : refus et erreurs de socket sont génériques, sans recopier le secret distant", async () => {
  const f = relay(); f.capability();
  const pending = f.delivery.send({ message: "bonjour" });
  f.ack("request-1", { sent: false, error: "fixture-private-token" });
  await assert.rejects(pending, (error) => error.code === "relay-chat-rejected" && !error.message.includes("fixture-private-token"));
  f.advance(); f.socket.send = () => { throw new Error("fixture-private-token"); };
  await assert.rejects(f.delivery.send({ message: "bonjour" }), (error) => error.code === "relay-chat-socket-error" && !error.message.includes("fixture-private-token"));
});

test("relais : changement de profil/salon et déconnexion invalident les ACK tardifs", async () => {
  for (const change of ["profile", "room", "reset"]) {
    const f = relay(); f.capability(); let allowed = true;
    const pending = f.delivery.send({ message: "bonjour" }, { shouldSend: () => allowed });
    if (change === "profile") allowed = false;
    else if (change === "room") f.changeRoom();
    else f.delivery.reset();
    f.ack("request-1", { roomId: "7123456" });
    await assert.rejects(pending, { code: "relay-chat-cancelled" });
    assert.equal(f.delivery.pending.size, 0);
    if (change === "reset") assert.equal(f.delivery.canSend(), false);
  }
});

test("relais : file bornée, cadence et longueur limitées sans répétition automatique", async () => {
  const f = relay(); f.capability();
  const waiting = [];
  for (let index = 0; index < MAX_PENDING_RELAY_CHATS; index += 1) {
    waiting.push(f.delivery.send({ message: "bonjour" }).catch((error) => error.code)); f.advance();
  }
  await assert.rejects(f.delivery.send({ message: "bonjour" }), { code: "relay-chat-busy" });
  f.delivery.reset(); await Promise.all(waiting);
  assert.equal(f.clock.callbacks.size, 0); assert.equal(f.outbound.length, MAX_PENDING_RELAY_CHATS);
  f.capability(); await assert.rejects(f.delivery.send({ message: "" }), { code: "relay-chat-invalid-message" });
  await assert.rejects(f.delivery.send({ message: "🙂".repeat(501) }), { code: "relay-chat-invalid-message" });
  const first = f.delivery.send({ message: "bonjour" });
  await assert.rejects(f.delivery.send({ message: "bonjour" }), { code: "relay-chat-rate-limit" });
  f.ack(f.outbound.at(-1).requestId); await first;
});

test("OAuth : vrai POST vers le fournisseur fixé, secrets seulement en headers, réponse plateforme requise", async () => {
  const f = oauth();
  const result = await f.delivery.send("7123456", { message: "Bonjour" });
  assert.deepEqual(result, { sent: true, acknowledged: true, confirmation: "platform", transport: "euler-oauth" });
  const request = f.requests[0];
  assert.equal(request.url, `${EULER_CHAT_API}/webcast/rooms/7123456/chat`);
  assert.equal(request.options.redirect, "error");
  assert.equal(request.options.headers["x-oauth-token"], "fixture-oauth-token");
  assert.equal(request.options.headers["x-api-key"], "fixture-api-key");
  assert.equal(request.options.headers["x-cookie-header"], undefined);
  assert.deepEqual(JSON.parse(request.options.body), { content: "Bonjour", targetRoomId: "7123456" });
  assert.equal(f.clock.callbacks.size, 0); assert.equal(f.delivery.pending.size, 0);
});

test("OAuth : HTTP 200, en-file, JSON malformé et refus TikTok ne deviennent pas un faux envoyé", async () => {
  for (const body of [{ code: 200 }, { code: 200, queued: true }, { code: 200, data: { status_code: 403, data: {} } }, "not-json"]) {
    const f = oauth(async () => new Response(typeof body === "string" ? body : JSON.stringify(body)));
    await assert.rejects(f.delivery.send("7123456", { message: "Bonjour" }), (error) => /tiktok-chat-(not-confirmed|invalid-response)/.test(error.code));
  }
});

test("OAuth : aucune authentification manquante/expirée ni requête vers un salon ambigu", async () => {
  for (const change of [(f) => { f.session.config.provider = "none"; }, (f) => { f.session.accessToken = ""; },
    (f) => { f.session.config.scopes = ["webcast:fetch"]; }, (f) => { f.session.accountUid = "other"; },
    (f) => { f.advance(60001); }]) {
    const f = oauth(); change(f);
    await assert.rejects(f.delivery.send("7123456", { message: "Bonjour" }), { code: "tiktok-chat-authorization-required" });
    assert.equal(f.requests.length, 0);
  }
  const f = oauth();
  for (const room of ["", "room-a", "../other", "0", "7123456?token=private"]) {
    await assert.rejects(f.delivery.send(room, { message: "Bonjour" }), { code: "tiktok-chat-invalid-room" });
  }
  assert.equal(f.requests.length, 0);
});

test("OAuth : profil modifié avant le microtask POST annule sans message", async () => {
  const f = oauth(); let allowed = true;
  const pending = f.delivery.send("7123456", { message: "Bonjour" }, { shouldSend: () => allowed });
  allowed = false;
  await assert.rejects(pending, { code: "tiktok-chat-cancelled" });
  assert.equal(f.requests.length, 0); assert.equal(f.clock.callbacks.size, 0);
});

test("OAuth : un ACK tardif reste réel mais ne peut alimenter le nouveau profil", async () => {
  let release, allowed = true;
  const f = oauth(() => new Promise((resolve) => { release = resolve; }));
  const pending = f.delivery.send("7123456", { message: "Bonjour" }, { shouldSend: () => allowed });
  await settled(); allowed = false; release(confirmed());
  assert.equal((await pending).stale, true);
});

test("OAuth : timeout et reset bornent même un fournisseur ignorant AbortSignal, sans retry", async () => {
  for (const mode of ["timeout", "reset"]) {
    const f = oauth(() => new Promise(() => {}));
    const pending = f.delivery.send("7123456", { message: "Bonjour" });
    await settled();
    if (mode === "timeout") f.clock.expire(); else f.delivery.reset();
    await assert.rejects(pending, { code: mode === "timeout" ? "tiktok-chat-timeout" : "tiktok-chat-cancelled" });
    assert.equal(f.requests.length, 1); assert.equal(f.requests[0].options.signal.aborted, true);
    assert.equal(f.delivery.pending.size, 0); assert.equal(f.clock.callbacks.size, 0);
  }
});

test("OAuth : erreurs d'autorisation/rate-limit et réponses trop grosses restent privées", async () => {
  for (const status of [401, 403, 429, 500]) {
    const f = oauth(async () => new Response("fixture-private-token", { status }));
    await assert.rejects(f.delivery.send("7123456", { message: "Bonjour" }), (error) => !error.message.includes("fixture-private-token"));
    assert.equal(f.requests.length, 1);
  }
  const f = oauth(async () => new Response("x".repeat(MAX_EULER_CHAT_RESPONSE_BYTES + 1)));
  await assert.rejects(f.delivery.send("7123456", { message: "Bonjour" }), { code: "tiktok-chat-invalid-response" });
});
