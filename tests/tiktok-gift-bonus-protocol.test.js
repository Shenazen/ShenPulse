"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { EventEmitter } = require("node:events");
const { ControlEvent, WebcastEvent } = require("tiktok-live-connector");
const sdk = require("tiktok-live-connector");
const { createDefaultState } = require("../src/main/defaults");
const { normalizeTikTokGiftBonus } = require("../src/main/matches/tiktok-gift-bonus");
const { shouldEmitTikTokEvent } = require("../src/main/sources/tiktok-protocol");

const NOW = 1792136000000, ROOM = "7123456789012345678", OWN = "7234567890123456789", RIVAL = "7345678901234567890";
const clone = (value) => JSON.parse(JSON.stringify(value));
const packet = (multiplier = 2) => ({ common: { msgId: "gift-proof", roomId: ROOM, createTime: NOW },
  matchInfo: { critical: "0", effectCardInUse: false, multiplierType: 0, multiplierValue: String(multiplier) },
  giftExtra: { toUserId: OWN, anchorId: RIVAL }, user: { id: RIVAL, nickname: "never-copy-donor" } });
const normalize = (value, options = {}) => normalizeTikTokGiftBonus(value, { roomId: ROOM,
  channelUsername: "creator", receivedAtMs: NOW + 100, ...options });

test("ordinary credited gift x2/x3 becomes a fresh observation, not an invented task/window", () => {
  for (const multiplier of [2, 3]) {
    const result = normalize(packet(multiplier));
    assert.deepEqual(result, { phase: "gift-bonus", id: "gift-proof", roomId: ROOM, channelUsername: "creator",
      receivedAtMs: NOW + 100, createdAtMs: NOW, giftBonus: { multiplier, recipientIds: [OWN] } });
    for (const field of ["battleId", "startsAtMs", "durationMs", "user", "nickname", "anchorId"]) assert.equal(field in result, false);
  }
});

test("installed SDK round-trip retains exact recipient under giftExtra and credited multiplier", () => {
  const blank = (type, fields) => ({ ...sdk[type].decode(new Uint8Array()), ...fields });
  for (const multiplier of [2, 3]) {
    const source = blank("WebcastGiftMessage", {
      common: blank("CommonMessageData", { msgId: "123456", roomId: ROOM, createTime: String(NOW) }),
      giftExtra: blank("WebcastGiftMessage_GiftMonitorInfo", { toUserId: OWN, anchorId: RIVAL }),
      matchInfo: blank("WebcastGiftMessage_MatchInfo", { multiplierValue: String(multiplier), multiplierType: 0 })
    });
    const decoded = sdk.WebcastGiftMessage.decode(sdk.WebcastGiftMessage.encode(source).finish());
    assert.equal(decoded.toUser, undefined, "monitor recipient works when the public toUser profile is absent");
    assert.deepEqual(normalize(decoded).giftBonus, { multiplier, recipientIds: [OWN] });
  }
});

test("no promotion, item cards and ambiguous multiplier metadata never produce a bonus", () => {
  for (const value of [0, "0", 1, "1", 4, 5, 10, null, undefined, true, false, [], {}, "02", "2.0", " 2", "2e0", NaN, Infinity]) {
    const data = packet(); data.matchInfo.multiplierValue = value;
    assert.equal(normalize(data), null);
  }
  for (const key of ["multiplierType", "critical", "effectCardInUse"]) {
    const data = packet(); delete data.matchInfo[key]; assert.equal(normalize(data), null);
  }
  for (const type of [1, 2, 3, 4, 5, 6, "1", null, false, "", "00"]) {
    const data = packet(); data.matchInfo.multiplierType = type; assert.equal(normalize(data), null);
  }
  for (const critical of [2, 3, 5, 10, "2", false, null, undefined, "00"]) {
    const data = packet(); data.matchInfo.critical = critical; assert.equal(normalize(data), null);
  }
  for (const flag of [true, 0, 1, "false", "0", null, undefined]) {
    const data = packet(); data.matchInfo.effectCardInUse = flag; assert.equal(normalize(data), null);
  }
  for (const critical of [0, "0", 1, "1"]) {
    const data = packet(); data.matchInfo.critical = critical; assert.ok(normalize(data));
  }
});

test("all exact recipient evidence is retained; donor/monitor anchor alone is never sufficient", () => {
  const data = packet(); data.toUser = { id_str: OWN, userId: RIVAL, id: Number(OWN) };
  data.toMemberId = "7456789012345678901"; data.toMemberIdInt = data.toMemberId;
  assert.deepEqual(normalize(data).giftBonus.recipientIds, [OWN, RIVAL, data.toMemberId]);
  const noRecipient = packet(); delete noRecipient.giftExtra.toUserId;
  assert.equal(normalize(noRecipient), null, "neither donor nor monitor anchor identifies the recipient");
  for (const [pathName, value] of [["toMemberId", OWN], ["toMemberIdInt", OWN], ["toUserId", OWN], ["receiverUserId", OWN]]) {
    assert.deepEqual(normalize({ ...noRecipient, [pathName]: value }).giftBonus.recipientIds, [OWN]);
  }
  for (const value of [Number(OWN), 0, -1, "0", "01", " 1", "1e2", true, {}, [], "18446744073709551616", "99999999999999999999999999"]) {
    const invalid = packet(); invalid.giftExtra.toUserId = value; assert.equal(normalize(invalid), null);
  }
  const smallSafe = packet(); smallSafe.giftExtra.toUserId = 123; assert.deepEqual(normalize(smallSafe).giftBonus.recipientIds, ["123"]);
});

test("explicit connected-room binding is mandatory and never borrowed from another field", () => {
  for (const room of [undefined, "", "0", RIVAL, Number(ROOM)]) {
    const data = packet(); data.common.roomId = room; data.roomId = ROOM;
    assert.equal(normalize(data), null);
  }
  assert.equal(normalize(packet(), { roomId: "" }), null);
  assert.equal(normalize(packet(), { roomId: RIVAL }), null);
});

test("server timestamp is translated once; missing proof timestamp/message id is rejected", () => {
  const data = packet(); data.common.createTime = (NOW + 2000) / 1000;
  assert.equal(normalize(data, { clockOffsetMs: 2000 }).createdAtMs, NOW);
  for (const value of [null, undefined, "", 0, "0", true, [], {}, "1e12", Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
    const invalid = packet(); invalid.common.createTime = value; assert.equal(normalize(invalid), null);
  }
  const missingId = packet(); delete missingId.common.msgId; assert.equal(normalize(missingId), null);
  missingId.common.msgId = "0"; assert.equal(normalize(missingId), null);
  assert.equal(normalize(packet(), { receivedAtMs: NaN }), null);
});

test("gift proof dedup is independent of ordinary final-streak gift delivery", () => {
  const runtime = {}, data = packet();
  assert.equal(shouldEmitTikTokEvent(runtime, "giftBonus", data), true);
  assert.equal(shouldEmitTikTokEvent(runtime, "giftBonus", data), false);
  assert.equal(shouldEmitTikTokEvent(runtime, "giftBonus", clone(data)), false);
  assert.equal(shouldEmitTikTokEvent(runtime, "gift", data), true);
});

function workspace(context) {
  const connectors = [], sourcePath = path.resolve(__dirname, "../src/main/source-hub.js"), realRequire = createRequire(sourcePath);
  class FakeConnector extends EventEmitter {
    constructor() { super(); this.roomId = ROOM; connectors.push(this); }
    async fetchIsLive() { return true; }
    async connect() { return { roomId: this.roomId }; }
    async disconnect() {}
    async fetchRoomInfo() { return null; }
  }
  const module = { exports: {} };
  new vm.Script(fs.readFileSync(sourcePath, "utf8"), { filename: sourcePath }).runInNewContext({
    require: (request) => request === "tiktok-live-connector"
      ? { ControlEvent, WebcastEvent, TikTokLiveConnection: FakeConnector } : realRequire(request),
    module, exports: module.exports, URL, setTimeout, clearTimeout, clearInterval, queueMicrotask, console
  });
  const state = createDefaultState();
  state.settings.tiktok.username = "creator";
  state.connections.push({ id: "source_tiktok", type: "tiktok-direct", enabled: true, status: "disconnected", config: { username: "creator" } });
  const hub = new module.exports.SourceHub({ store: { getState: () => clone(state), mutateRuntime: (mutate) => mutate(state), getSecret: () => "" } });
  const matches = [], ordinary = [];
  hub.on("match-event", (event) => matches.push(clone(event))); hub.on("event", (event) => ordinary.push(clone(event)));
  context.after(() => hub.stopAll());
  return { hub, connectors, matches, ordinary };
}

test("SourceHub emits proof immediately; a gift without combo identity retains final-only delivery", async (context) => {
  const { hub, connectors, matches, ordinary } = workspace(context);
  await hub.start("source_tiktok"); const connector = connectors[0];
  const data = { ...packet(), giftType: 1, repeatEnd: false, repeatCount: 1 };
  connector.emit(WebcastEvent.GIFT, data);
  assert.equal(matches.length, 1); assert.equal(matches[0].source, "source_tiktok"); assert.equal(ordinary.length, 0);
  connector.emit(ControlEvent.DECODED_DATA, "WebcastGiftMessage", { data: clone(data) });
  await new Promise(setImmediate); assert.equal(matches.length, 1);
  const final = { ...clone(data), repeatEnd: true };
  connector.emit(WebcastEvent.GIFT, final); await new Promise(setImmediate);
  assert.equal(matches.length, 1); assert.equal(ordinary.length, 1, "bonus proof did not consume final gift dedup");
  const lateListener = connector.listeners(WebcastEvent.GIFT)[0];
  await hub.stopAll(); lateListener({ ...packet(), common: { ...packet().common, msgId: "late" } });
  assert.equal(matches.length, 1);
});

test("SourceHub decoded-only fallback handles fresh intermediate gifts and refuses mismatched rooms", async (context) => {
  const { hub, connectors, matches, ordinary } = workspace(context);
  await hub.start("source_tiktok"); const connector = connectors[0];
  const mismatch = packet(); mismatch.common.roomId = RIVAL;
  connector.emit(ControlEvent.DECODED_DATA, "WebcastGiftMessage", { data: mismatch });
  await new Promise(setImmediate); assert.equal(matches.length, 0);
  const data = { ...packet(3), giftType: 1, repeatEnd: false, repeatCount: 1 };
  connector.emit(ControlEvent.DECODED_DATA, "WebcastGiftMessage", { data });
  await new Promise(setImmediate);
  assert.equal(matches.length, 1); assert.equal(matches[0].giftBonus.multiplier, 3); assert.equal(ordinary.length, 1, "only unrelated ordinary mismatch was delivered");
});
