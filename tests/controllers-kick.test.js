"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const { ControllerService, normalizeMapping } = require("../src/main/controller-service");
const { normalizeMidiMessage, midiMappingMatches } = require("../src/shared/controller-contract");
const { KickService, normalizeKickEvent, verifyKickSignature } = require("../src/main/kick-service");

function mockStore(extra = {}) {
  const state = { settings: {}, connections: [], rules: [{ id: "rule_1", name: "Alerte", enabled: true, actions: [{ id: "sound_1", type: "audio.play", name: "Alerte" }, { id: "disabled", type: "audio.play", name: "Arrêtée", enabled: false }, { id: "group_1", type: "action.group", name: "Groupe" }] }], profiles: [{ id: "profile_1", name: "Show" }], ...extra };
  const secrets = new Map();
  return {
    getState: () => state,
    set: (key, value) => {
      const parts = key.split(".");
      let target = state;
      while (parts.length > 1) target = target[parts.shift()];
      target[parts[0]] = value;
    },
    mutate: (mutator) => mutator(state),
    mutateRuntime: (mutator) => mutator(state),
    setSecret: (key, value) => { const id = key || crypto.randomUUID(); secrets.set(id, value); return id; },
    getSecret: (key) => secrets.get(key) || ""
  };
}

test("MIDI notes, release and control changes share one normalized contract", () => {
  assert.deepEqual(normalizeMidiMessage([0x92, 60, 110], "pad"), { deviceId: "pad", channel: 3, kind: "note", number: 60, value: 110 });
  assert.equal(normalizeMidiMessage([0x82, 60, 127]).value, 0);
  assert.equal(normalizeMidiMessage([0x92, 60, 0]).value, 0);
  assert.equal(normalizeMidiMessage([0xb0, 8, 64]).kind, "cc");
  assert.equal(normalizeMidiMessage([0xf0, 60, 127]), null);
  assert.equal(normalizeMidiMessage([0x90, 60, 128]), null);
  assert.equal(normalizeMidiMessage([0x90, 60]), null);
});

test("MIDI mappings respect device, channel, value and enabled status", () => {
  const mapping = normalizeMapping({ channel: 2, kind: "note", number: 48, targetType: "action", targetId: "sound_1", deviceId: "pad", threshold: 80 });
  assert.equal(midiMappingMatches(mapping, normalizeMidiMessage([0x91, 48, 100], "pad")), true);
  assert.equal(midiMappingMatches(mapping, normalizeMidiMessage([0x91, 48, 70], "pad")), false);
  assert.equal(midiMappingMatches(mapping, normalizeMidiMessage([0x91, 48, 100], "other")), false);
  assert.equal(midiMappingMatches(mapping, normalizeMidiMessage([0x90, 48, 100], "pad")), false);
  assert.throws(() => normalizeMapping({ channel: 17, kind: "note", number: 48, targetType: "action", targetId: "sound_1" }));
});

test("controller pairing codes are single use and revoke clears the device token", async () => {
  const store = mockStore();
  const service = new ControllerService({ store, authorize: () => {}, executeAction: async () => {}, selectProfile: async () => {} });
  service.start = async () => service.status();
  const { code } = await service.pairingCode();
  assert.match(code, /^\d{8}$/);
  assert.throws(() => service.pair({ code: "invalid" }));
  const paired = service.pair({ code, name: "Mon Stream Deck" });
  assert.ok(paired.token.length > 32);
  assert.throws(() => service.pair({ code }));
  assert.equal(service.status().devices[0].name, "Mon Stream Deck");
  assert.equal(service.status().devices[0].secretId, undefined);
  const secretId = store.getState().settings.controllers.devices[0].secretId;
  service.revoke(paired.deviceId);
  assert.equal(store.getSecret(secretId), "");
  assert.equal(service.status().devices.length, 0);
});

test("pairing expires and locks out after six failed attempts", async () => {
  const service = new ControllerService({ store: mockStore(), authorize: () => {} });
  service.start = async () => service.status();
  const { code } = await service.pairingCode();
  for (let i = 0; i < 6; i++) assert.throws(() => service.pair({ code: "wrong" }));
  assert.throws(() => service.pair({ code }), /expiré/);
  await service.pairingCode();
  service.pendingPairing.expiresAt = Date.now() - 1;
  assert.throws(() => service.pair({ code: service.pendingPairing.code }), /expiré/);
});

test("controller commands invoke real callbacks and enforce MIDI cooldowns", async () => {
  const calls = [];
  const service = new ControllerService({ store: mockStore(), authorize: () => {}, executeAction: async (id) => calls.push(id), selectProfile: async (id) => calls.push(id) });
  service.saveMapping({ id: "pad", name: "Pad", channel: 1, kind: "note", number: 60, targetType: "action", targetId: "sound_1", deviceId: "usb", threshold: 50 });
  await service.executeMapping({ id: "pad", value: 10, deviceId: "usb" });
  await service.executeMapping({ id: "pad", value: 127, deviceId: "other" });
  await service.executeMapping({ id: "pad", value: 127, deviceId: "usb" });
  await service.executeMapping({ id: "pad", value: 127, deviceId: "usb" });
  await service.executeTarget({ targetType: "profile", targetId: "profile_1" });
  assert.deepEqual(calls, ["sound_1", "profile_1"]);
  await assert.rejects(service.executeTarget({ targetType: "action", targetId: "disabled" }), /désactivée/);
  await assert.rejects(service.executeTarget({ targetType: "arbitrary", targetId: "sound_1" }));
});

test("controller HTTP API requires pairing, blocks remote origins, and cannot authenticate an empty token", async (context) => {
  const calls = [];
  const store = mockStore();
  const service = new ControllerService({ store, authorize: () => {}, executeAction: async (id) => calls.push(id), selectProfile: async () => {} });
  service.port = () => 0;
  await service.start();
  context.after(() => service.stop());
  assert.equal(service.server.address().address, "127.0.0.1");
  const base = `http://127.0.0.1:${service.server.address().port}`;
  const pair = await service.pairingCode();
  const response = await fetch(`${base}/pair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: pair.code }) });
  const { token, deviceId } = await response.json();
  assert.equal(response.status, 200);
  assert.equal((await fetch(`${base}/targets`)).status, 401);
  assert.equal((await fetch(`${base}/targets`, { headers: { Origin: "https://untrusted.example", Authorization: `Bearer ${token}` } })).status, 403);
  const targetResponse = await fetch(`${base}/targets`, { headers: { Authorization: `Bearer ${token}` } });
  assert.deepEqual((await targetResponse.json()).actions, [{ id: "sound_1", name: "Alerte" }]);
  await fetch(`${base}/execute`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ targetType: "action", targetId: "sound_1" }) });
  assert.deepEqual(calls, ["sound_1"]);
  service.revoke(deviceId);
  assert.equal((await fetch(`${base}/targets`, { headers: { Authorization: `Bearer ${token}` } })).status, 401);
  store.getState().settings.controllers.devices = [{ id: "revoked", secretId: "missing" }];
  assert.equal((await fetch(`${base}/targets`, { headers: { Authorization: "Bearer " } })).status, 401);
});

test("Kick events preserve identity, roles, gifts and subscription quantity", () => {
  const chat = normalizeKickEvent("chat.message.sent", { sender: { user_id: 12, username: "Lou", identity: { badges: [{ type: "moderator" }, { type: "subscriber" }] } }, content: "Salut" }, "message-1");
  assert.equal(chat.type, "chat");
  assert.equal(chat.user.id, "12");
  assert.equal(chat.user.moderator, true);
  assert.equal(chat.user.subscriber, true);
  assert.equal(chat.data.message, "Salut");
  assert.equal(chat.source, "source_kick");
  const subscriptions = normalizeKickEvent("channel.subscription.gifts", { gifter: { username: "Lou" }, giftees: [{}, {}, {}] });
  assert.equal(subscriptions.data.count, 3);
  const gift = normalizeKickEvent("kicks.gifted", { sender: { username: "Lou" }, gift: { name: "Rage Quit", type: "LEVEL_UP", amount: 500 } });
  assert.equal(gift.type, "gift");
  assert.equal(gift.data.value, 500);
  assert.equal(gift.data.giftName, "Rage Quit");
  assert.equal(normalizeKickEvent("unknown", {}), null);
});

test("Kick verifies signed raw bytes and rejects stale timestamps or changed payloads", () => {
  const keys = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const rawBody = Buffer.from('{"content":"bonjour"}');
  const timestamp = new Date().toISOString();
  const id = "signed-message";
  const signature = crypto.sign("RSA-SHA256", Buffer.concat([Buffer.from(`${id}.${timestamp}.`), rawBody]), keys.privateKey).toString("base64");
  const values = { publicKey: keys.publicKey, id, timestamp, signature, rawBody };
  assert.equal(verifyKickSignature(values), true);
  assert.equal(verifyKickSignature({ ...values, rawBody: Buffer.from("{}") }), false);
  assert.equal(verifyKickSignature({ ...values, now: Date.now() + 360000 }), false);
  assert.equal(verifyKickSignature({ ...values, signature: "invalid" }), false);
});

test("Kick browser authorization uses PKCE and a validated loopback callback", async (context) => {
  const store = mockStore();
  const clientSecretId = store.setSecret("", "test-secret");
  store.set("settings.kick", { clientId: "test-client", clientSecretId, webhookUrl: "https://live.example/kick/webhook" });
  let opened;
  let tokenValues;
  const service = new KickService({
    store,
    openExternal: async (url) => {
      opened = new URL(url);
      const callback = new URL(opened.searchParams.get("redirect_uri"));
      callback.searchParams.set("state", "invalid-state");
      callback.searchParams.set("code", "authorization-code");
      assert.equal((await fetch(callback)).status, 400);
      callback.searchParams.set("state", opened.searchParams.get("state"));
      assert.equal((await fetch(callback)).status, 200);
    },
    fetchImpl: async (url, options) => {
      if (String(url).endsWith("/token")) {
        tokenValues = options.body;
        return new Response(JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_in: 3600 }), { status: 200 });
      }
      assert.equal(String(url), "https://api.kick.com/public/v1/users");
      return new Response(JSON.stringify({ data: [{ user_id: 99, name: "Créateur" }] }), { status: 200 });
    }
  });
  service.port = () => service.server?.address()?.port || 0;
  context.after(() => service.dispose());
  const result = await service.connect();
  assert.equal(opened.origin, "https://id.kick.com");
  assert.equal(opened.searchParams.get("redirect"), "127.0.0.1");
  assert.equal(opened.searchParams.get("code_challenge_method"), "S256");
  assert.equal(crypto.createHash("sha256").update(tokenValues.get("code_verifier")).digest("base64url"), opened.searchParams.get("code_challenge"));
  assert.equal(tokenValues.get("client_secret"), "test-secret");
  assert.equal(result.connected, true);
  assert.equal(result.account.name, "Créateur");
  assert.equal(store.getState().connections[0].type, "kick-native");
  assert.equal(store.getState().settings.kick.access_token, undefined);
});

test("Kick webhook ingestion accepts signed account events once and rejects other broadcasters", async (context) => {
  const store = mockStore({ settings: { kick: { account: { id: "99" } } } });
  const service = new KickService({ store, openExternal: async () => {} });
  const keys = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  service.currentPublicKey = async () => keys.publicKey;
  service.port = () => service.server?.address()?.port || 0;
  await service.ensureServer();
  context.after(() => service.dispose());
  service.runtime = { id: "source_kick" };
  const events = [];
  service.on("event", (event) => events.push(event));
  const endpoint = `http://127.0.0.1:${service.port()}/kick/webhook`;
  const sendSigned = (id, broadcaster = 99) => {
    const body = JSON.stringify({ broadcaster: { user_id: broadcaster }, sender: { user_id: 123, username: "Lou" }, content: "Salut" });
    const timestamp = new Date().toISOString();
    const signature = crypto.sign("RSA-SHA256", Buffer.from(`${id}.${timestamp}.${body}`), keys.privateKey).toString("base64");
    return fetch(endpoint, { method: "POST", body, headers: { "kick-event-message-id": id, "kick-event-message-timestamp": timestamp, "kick-event-signature": signature, "kick-event-type": "chat.message.sent" } });
  };
  assert.equal((await fetch(endpoint, { method: "POST", body: "{}" })).status, 401);
  assert.equal((await sendSigned("first-message")).status, 200);
  assert.equal((await sendSigned("first-message")).status, 200);
  assert.equal((await sendSigned("another-account", 55)).status, 403);
  assert.equal(events.length, 1);
  assert.equal(events[0].data.message, "Salut");
  assert.ok(store.getState().settings.kick.lastEventAt);
  await service.stop();
  assert.equal((await sendSigned("after-stop")).status, 200);
  assert.equal(events.length, 1);
});

test("Stream Deck plugin has packaged assets and turns key presses into authenticated action commands", async () => {
  const directory = path.join(__dirname, "..", "resources", "controllers", "com.shenpulse.control.sdPlugin");
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
  for (const asset of [manifest.CodePath, `${manifest.Icon}.png`, "plugin.js", "inspector.js", ...manifest.Actions.map((entry) => entry.PropertyInspectorPath)]) assert.ok(fs.existsSync(path.join(directory, asset)), asset);
  const sent = [];
  const requests = [];
  class FakeWebSocket {
    static OPEN = 1;
    constructor() { this.readyState = 1; }
    send(message) { sent.push(JSON.parse(message)); }
  }
  const sandbox = vm.createContext({ window: {}, WebSocket: FakeWebSocket, URL, AbortSignal, fetch: async (url, options) => { requests.push({ url, options }); return new Response('{"ok":true}', { status: 200 }); } });
  vm.runInContext(fs.readFileSync(path.join(directory, "plugin.js"), "utf8"), sandbox);
  sandbox.window.connectElgatoStreamDeckSocket(1234, "plugin", "registerPlugin");
  await vm.runInContext("receiveStreamDeckEvent({event:'didReceiveGlobalSettings',payload:{settings:{endpoint:'http://127.0.0.1:21217',token:'paired-token'}}})", sandbox);
  await vm.runInContext("receiveStreamDeckEvent({event:'willAppear',context:'key',action:'com.shenpulse.control.action',payload:{settings:{targetId:'sound_1'}}})", sandbox);
  await vm.runInContext("receiveStreamDeckEvent({event:'keyDown',context:'key'})", sandbox);
  assert.equal(requests[0].url, "http://127.0.0.1:21217/execute");
  assert.equal(requests[0].options.headers.Authorization, "Bearer paired-token");
  assert.deepEqual(JSON.parse(requests[0].options.body), { targetType: "action", targetId: "sound_1" });
  assert.equal(sent.at(-1).event, "showOk");
  await vm.runInContext("receiveStreamDeckEvent({event:'didReceiveGlobalSettings',payload:{settings:{endpoint:'https://untrusted.example',token:'paired-token'}}})", sandbox);
  await vm.runInContext("receiveStreamDeckEvent({event:'keyDown',context:'key'})", sandbox);
  assert.equal(requests.length, 1);
  assert.equal(sent.at(-1).event, "showAlert");
});
