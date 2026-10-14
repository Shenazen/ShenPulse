"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createDefaultState } = require("../src/main/defaults");
const { PublicOverlayRelay } = require("../src/main/public-overlay-relay");
const { selectStatePaths } = require("../src/main/state-projection");
const { createMatchRelayMessage } = require("../src/main/relay/match-messages");

const pause = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
const response = (status = 200, body = {}) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });
async function until(predicate) {
  for (let index = 0; index < 100; index += 1) { if (predicate()) return; await pause(5); }
  assert.ok(predicate(), "La publication attendue doit démarrer sans attendre une autre source.");
}

function harness({ fetchPatch, refresh } = {}) {
  const state = createDefaultState();
  Object.assign(state.settings.account, { uid: "match-test-owner", email: "fixture@example.invalid", refreshTokenSecretId: "account-secret" });
  state.commerce.subscription = { tier: "pro", source: "paid", status: "active" };
  state.session.profileId = "profile-a";
  state.settings.tiktok.roomId = "room-private-a";
  state.matchSession = { status: "running", startedAtMs: Date.now(), endsAtMs: Date.now() + 300_000,
    participants: [{ id: "private-user-id", username: "creator", own: true, score: 0 }], session: {} };
  const secrets = new Map([["account-secret", "test-token"]]);
  const store = {
    getState() { throw new Error("Le relais Match doit utiliser une projection bornée."); },
    getStateProjection: (paths) => selectStatePaths(state, paths),
    mutate: (fn) => fn(state), getSecret: (key) => secrets.get(key) || "",
    setSecret(key, value) { const id = key || `secret-${secrets.size}`; secrets.set(id, value); return id; }
  };
  const requests = [];
  const relay = new PublicOverlayRelay({ store, fetchImpl: async (url, options = {}) => {
    const request = { url: String(url), signal: options.signal, method: options.method,
      body: options.body && (options.headers?.["Content-Type"] === "application/x-www-form-urlencoded" ? {} : JSON.parse(options.body)) };
    requests.push(request);
    if (request.url.includes("accounts:signUp")) return response(200, { idToken: "installation-token", refreshToken: "installation-refresh", localId: "relay-owner", expiresIn: "3600" });
    if (request.url.includes("securetoken.googleapis.com")) {
      refresh?.(state);
      return response(200, { id_token: "refreshed-token", refresh_token: "installation-refresh", user_id: "relay-owner", expires_in: "3600" });
    }
    return options.method === "PATCH" && fetchPatch ? fetchPatch(request) : response();
  } });
  const writes = () => requests.filter((entry) => entry.method === "PATCH");
  const aliases = () => writes().filter((entry) => entry.body.matchSource);
  return { state, store, relay, requests, writes, aliases };
}

test("Match HTTPS : un PATCH général lent ne retient ni score ni animation", async (t) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let block = false;
  const h = harness({ fetchPatch: async (request) => { if (block && !request.body.matchSource) { block = false; await gate; } return response(); } });
  t.after(() => { release(); return h.relay.stop(); });
  await h.relay.start(); h.requests.length = 0;
  block = true; h.state.overlaySession.likeGoalCurrent = 1; h.relay.publishState();
  await until(() => h.writes().some((entry) => !entry.body.matchSource));
  h.state.matchSession.participants[0].score = 42;
  h.relay.publish("match", { requestId: "animation-1", match: "x2", variant: "gladiador" });
  h.relay.publishState();
  await until(() => h.aliases().some((entry) => entry.body.lastBatch));
  const update = h.aliases().at(-1).body;
  assert.equal(update.state.matches.session.participants[0].score, 42);
  assert.equal(update.lastBatch.messages[0].channel, "match");
  assert.equal(h.writes().filter((entry) => !entry.body.matchSource).length, 1);
  assert.equal(h.relay.eventQueue.length, 0);
  assert.doesNotMatch(JSON.stringify(update), /match-test-owner|private-user-id|profile-a|room-private-a|test-token/);
  assert.match(update.matchSource.contextId, /^[a-f0-9]{64}$/);
  assert.equal(update.lastBatch.contextId, update.matchSource.contextId);
});

test("Match HTTPS : une seule écriture en vol et un seul état récent coalescé", async (t) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let block = false, active = 0, maxActive = 0;
  const h = harness({ fetchPatch: async (request) => {
    if (!request.body.matchSource) return response();
    active += 1; maxActive = Math.max(maxActive, active);
    if (block) { block = false; await gate; }
    active -= 1; return response();
  } });
  t.after(() => { release(); return h.relay.stop(); });
  await h.relay.start(); h.requests.length = 0;
  block = true; h.state.matchSession.participants[0].score = 1; h.relay.publishState();
  await until(() => h.aliases().length === 1);
  const first = h.relay.matchPublisher.flushPromise;
  for (let score = 2; score <= 100; score += 1) { h.state.matchSession.participants[0].score = score; h.relay.publishState(); }
  await pause();
  assert.equal(h.aliases().length, 1);
  assert.equal(h.relay.matchPublisher.flushPromise, first);
  assert.equal(h.relay.matchPublisher.timer, null);
  release();
  await until(() => h.aliases().length === 2);
  assert.equal(h.aliases().at(-1).body.state.matches.session.participants[0].score, 100);
  assert.equal(maxActive, 1);
});

test("Match HTTPS : trois canaux ciblés, ordre, doublons et champs privés exclus", async (t) => {
  const h = harness(); t.after(() => h.relay.stop());
  await h.relay.start(); h.requests.length = 0;
  const animation = { requestId: "animation-2", match: "x3", secret: "do-not-publish" };
  h.relay.publish("match", animation); h.relay.publish("match", animation);
  h.relay.publish("match-media", { playbackId: "video-1", mediaUrl: "http://127.0.0.1:17654/overlay/media/video/demo.webm?token=private", durationMs: 7500, secret: "do-not-publish" });
  h.relay.publish("match-audio", { playbackId: "sound-1", url: "/overlay/media/sounds/demo.ogg", volume: 0.3, secret: "do-not-publish" });
  h.relay.publish("timer", { seconds: 5 });
  await until(() => h.aliases().some((entry) => entry.body.lastBatch) && h.writes().some((entry) => !entry.body.matchSource && entry.body.lastBatch));
  const batch = h.aliases().at(-1).body.lastBatch;
  assert.deepEqual(batch.messages.map((entry) => entry.channel), ["match", "match-media", "match-audio"]);
  assert.equal(batch.messages[1].payload.durationMs, 7500);
  assert.equal(batch.messages[2].payload.volume, 0.3);
  assert.ok(batch.messages.every((entry) => Number.isFinite(Date.parse(entry.timestamp))));
  assert.doesNotMatch(JSON.stringify(batch), /do-not-publish|127\.0\.0\.1|private|token=/);
  assert.deepEqual(h.writes().find((entry) => !entry.body.matchSource && entry.body.lastBatch).body.lastBatch.messages.map((entry) => entry.channel), ["timer"]);
});

test("Match HTTPS : profil changé, accès retiré et message expiré ne jouent pas", async (t) => {
  const h = harness(); t.after(() => h.relay.stop());
  await h.relay.start(); h.requests.length = 0;
  h.relay.publish("match", { requestId: "old-profile", match: "x2" });
  h.state.session.profileId = "profile-b";
  h.relay.publishState(); await pause();
  assert.ok(h.aliases().every((entry) => !entry.body.lastBatch));
  h.relay.publish("match", { requestId: "expired-effect", match: "x2" });
  h.relay.matchPublisher.events[0].message.timestamp = new Date(Date.now() - 16_000).toISOString();
  await pause(); assert.ok(h.aliases().every((entry) => !entry.body.lastBatch));
  h.relay.publish("match", { requestId: "revoked-effect", match: "x2" });
  h.state.commerce.subscription = { tier: "free", status: "active" };
  h.relay.publishState(); await until(() => h.aliases().at(-1)?.body.matchSource.widgetsEnabled === false);
  assert.equal(h.aliases().at(-1).body.state.matches, null);
  assert.ok(h.aliases().every((entry) => !entry.body.lastBatch));
});

test("Match HTTPS : reprise d'authentification relit le profil avant de rejouer", async (t) => {
  let deny = false;
  const h = harness({ fetchPatch: async (request) => { if (deny && request.body.matchSource) { deny = false; return response(401); } return response(); }, refresh: (state) => { state.session.profileId = "profile-new"; } });
  t.after(() => h.relay.stop()); await h.relay.start(); h.requests.length = 0;
  deny = true; h.relay.publish("match", { requestId: "auth-transition", match: "x2" });
  h.state.matchSession.participants[0].score = 10; h.relay.publishState();
  await until(() => h.requests.some((entry) => entry.url.includes("securetoken.googleapis.com")));
  await pause();
  assert.ok(h.aliases()[0].body.lastBatch);
  assert.ok(h.aliases().slice(1).every((entry) => !entry.body.lastBatch));
});

test("Match HTTPS : arrêt annule l'écriture dédiée puis publie hors ligne en dernier", async (t) => {
  let block = false, stalled;
  const h = harness({ fetchPatch: async (request) => {
    if (block && request.body.matchSource) {
      block = false; stalled = request;
      return new Promise((resolve, reject) => request.signal.addEventListener("abort", () => reject(request.signal.reason), { once: true }));
    }
    return response();
  } });
  t.after(() => h.relay.stop()); await h.relay.start(); h.requests.length = 0;
  block = true; h.state.matchSession.participants[0].score = 15; h.relay.publishState();
  await until(() => stalled);
  h.relay.publish("match", { requestId: "cancelled-effect", match: "x2" });
  await h.relay.stop();
  assert.equal(stalled.signal.aborted, true);
  assert.equal(h.aliases().at(-1).body.presence.connected, false);
  assert.equal(h.relay.matchPublisher.events.length, 0);
  const count = h.aliases().length; await pause(); assert.equal(h.aliases().length, count);
});

test("Match HTTPS : seules les ressources publiques autorisées sont transportées", () => {
  const options = { baseUrl: "https://shenpulse-overlays.web.app" };
  assert.equal(createMatchRelayMessage("match-audio", { playbackId: "sound", url: "file:///C:/private.wav" }, options), null);
  assert.equal(createMatchRelayMessage("match-media", { playbackId: "video", mediaUrl: "https://another.example/private.webm?token=secret" }, options), null);
  assert.equal(createMatchRelayMessage("match", { requestId: "animation", match: "unknown" }, options), null);
  assert.equal(createMatchRelayMessage("chat", { message: "private" }, options), null);
  assert.equal(createMatchRelayMessage("match-audio", { playbackId: "sound", url: "/overlay/media/sounds/demo.ogg" }, options).payload.volume, 1);
});

test("Match HTTPS : rotation annule les effets de l'ancien alias sans changer les autres sources", async (t) => {
  let block = false, stalled;
  const h = harness({ fetchPatch: async (request) => {
    if (block && request.body.matchSource) {
      block = false; stalled = request;
      return new Promise((resolve, reject) => request.signal.addEventListener("abort", () => reject(request.signal.reason), { once: true }));
    }
    return response();
  } });
  t.after(() => h.relay.stop()); await h.relay.start(); h.requests.length = 0;
  const oldAlias = h.relay.status().matchChannelId, main = h.relay.status().channelId;
  block = true; h.relay.publish("match", { requestId: "old-alias-effect", match: "x2" });
  await until(() => stalled);
  h.relay.publish("match", { requestId: "queued-old-effect", match: "x3" });
  await h.relay.rotateMatchChannel();
  assert.equal(stalled.signal.aborted, true);
  assert.equal(h.relay.status().channelId, main);
  assert.notEqual(h.relay.status().matchChannelId, oldAlias);
  const deleted = h.requests.findIndex((entry) => entry.method === "DELETE");
  assert.ok(deleted > 0);
  assert.ok(h.requests.slice(deleted + 1).every((entry) => !entry.url.includes(`/${oldAlias}.json`)));
  assert.ok(h.aliases().slice(1).every((entry) => !entry.body.lastBatch));
});

test("Match HTTPS : file hors ligne bornée sans détourner de messages génériques", async (t) => {
  const h = harness(); t.after(() => h.relay.stop()); await h.relay.start();
  h.relay.connected = false;
  for (let index = 0; index < 1200; index += 1) h.relay.publish("match", { requestId: `queued-${index}`, match: "x2" });
  assert.equal(h.relay.matchPublisher.events.length, 1000);
  assert.equal(h.relay.matchPublisher.seenRequests.size, 1000);
  assert.equal(h.relay.matchPublisher.events[0].message.payload.requestId, "queued-200");
  assert.equal(h.relay.eventQueue.length, 0);
});

test("Match HTTPS : uploads B2 et liens signés de la bibliothèque sont conservés", async (t) => {
  const h = harness(); t.after(() => h.relay.stop()); await h.relay.start(); h.requests.length = 0;
  const b2 = "https://f003.backblazeb2.com/file/shenpulse-media/mediauploads/demo.webm";
  const signed = "https://cdn.example.invalid/selected.ogg?Expires=9999999999&Signature=fixture-signature";
  h.state.customSounds = [{ id: "custom:fixture", url: signed }];
  h.relay.publish("match-media", { playbackId: "b2-video", mediaUrl: b2 });
  h.relay.publish("match-audio", { playbackId: "library-sound", url: signed, volume: 0.75 });
  await until(() => h.aliases().some((entry) => entry.body.lastBatch));
  const messages = h.aliases().at(-1).body.lastBatch.messages;
  assert.equal(messages[0].payload.mediaUrl, b2);
  assert.equal(messages[1].payload.url, signed);
  assert.equal(messages[1].payload.volume, 0.75);
});

test("Match HTTPS : URL non choisie ou credentials refusés avec une erreur sans URL", async (t) => {
  const h = harness(); t.after(() => h.relay.stop()); await h.relay.start();
  const sources = ["https://unknown.example.invalid/unselected.webm", "https://user:private@f003.backblazeb2.com/file/shenpulse-media/demo.webm",
    "https://127.0.0.1/private.webm", "https://192.168.1.2/private.webm", "https://[::1]/private.webm", "https://machine.local/private.webm"];
  for (const mediaUrl of sources) {
    h.state.customMedia = mediaUrl.includes("unknown.example") ? [] : [{ id: "fixture", url: mediaUrl }];
    assert.throws(() => h.relay.publish("match-media", { playbackId: "unsafe-media", mediaUrl }), (error) => {
      assert.match(error.message, /média public autorisé/);
      assert.doesNotMatch(error.message, /https:|private|unknown\.example/);
      return true;
    });
  }
  assert.equal(h.relay.matchPublisher.events.length, 0);
});

test("Match HTTPS : une nouvelle room annule l'ancien effet et invalide le contexte même à scores égaux", async (t) => {
  const h = harness(); t.after(() => h.relay.stop()); await h.relay.start();
  const initial = h.aliases().at(-1).body.matchSource.contextId;
  h.requests.length = 0;
  h.relay.publish("match", { requestId: "old-room-effect", match: "x2" });
  h.state.settings.tiktok.roomId = "room-private-b";
  h.relay.publishState();
  await until(() => h.aliases().length > 0);
  const update = h.aliases().at(-1).body;
  assert.notEqual(update.matchSource.contextId, initial);
  assert.match(update.matchSource.contextId, /^[a-f0-9]{64}$/);
  assert.equal(update.lastBatch, undefined);
  assert.equal(update.state.matches.session.participants[0].score, 0);
  assert.doesNotMatch(JSON.stringify(update), /room-private-[ab]|profile-a|match-test-owner/);
  h.relay.publish("match", { requestId: "new-room-effect", match: "x3" });
  await until(() => h.aliases().some((entry) => entry.body.lastBatch));
  const latest = h.aliases().at(-1).body;
  assert.equal(latest.lastBatch.contextId, update.matchSource.contextId);
  assert.equal(latest.lastBatch.messages[0].payload.requestId, "new-room-effect");
  assert.equal(latest.lastBatch.messages.length, 1);
});

test("Match HTTPS : changement de room pendant l'authentification ne rejoue pas l'ancien effet", async (t) => {
  let deny = false;
  const h = harness({ fetchPatch: async (request) => { if (deny && request.body.matchSource) { deny = false; return response(401); } return response(); },
    refresh: (state) => { state.settings.tiktok.roomId = "room-private-after-refresh"; } });
  t.after(() => h.relay.stop()); await h.relay.start(); h.requests.length = 0;
  deny = true;
  h.relay.publish("match", { requestId: "old-room-auth-effect", match: "x2" });
  await until(() => h.requests.some((entry) => entry.url.includes("securetoken.googleapis.com")));
  await pause();
  const attempts = h.aliases();
  assert.ok(attempts[0].body.lastBatch);
  assert.notEqual(attempts.at(-1).body.matchSource.contextId, attempts[0].body.matchSource.contextId);
  assert.ok(attempts.slice(1).every((entry) => !entry.body.lastBatch));
});
