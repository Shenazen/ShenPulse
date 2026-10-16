"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { EventEmitter } = require("node:events");
const sdk = require("tiktok-live-connector");
const { createDefaultState } = require("../src/main/defaults");
const { tiktokMatchOwnerMetadata, reconcileTikTokOwnerMetadata } = require("../src/main/matches/tiktok-match-owner");

const OWN = "9007199254740993123", RIVAL = "9007199254740993456", ROOM = "7123456789012345678";
const clone = (value) => JSON.parse(JSON.stringify(value));
const settled = () => new Promise(setImmediate);
const packet = () => ({ common: { msgId: "owner-open", roomId: ROOM }, action: 4, battleId: "8000",
  battleSetting: { battleId: "8000", startTimeMs: String(Date.now()), duration: 301 }, anchorInfo: {
    [RIVAL]: { user: { userId: RIVAL, displayId: "rival", nickName: "Rival" } },
    [OWN]: { user: { userId: OWN, displayId: "creator", nickName: "Creator" } }
  } });
const normalize = (data, options = {}) => tiktokMatchOwnerMetadata(data, { roomId: ROOM, channelUsername: "creator", ...options });

test("exact public OPEN displayId identifies the configured creator, never first participant or action author", () => {
  const data = packet(); data.actionByUserId = RIVAL; data.user = { id: RIVAL, displayId: "creator" };
  assert.deepEqual(normalize(data), { roomId: ROOM, broadcaster: { userId: OWN, username: "creator", nickname: "Creator", avatarUrl: "" } });
  assert.equal(normalize(data, { channelUsername: "@CREATOR" }).broadcaster.userId, OWN);
});

test("missing, mismatched and ambiguous creator identity does not acquire owner rights", () => {
  for (const mutate of [
    d => { delete d.anchorInfo; }, d => { d.anchorInfo = []; },
    d => { d.anchorInfo[OWN].user.displayId = "creator-other"; },
    d => { delete d.anchorInfo[OWN].user.displayId; d.anchorInfo[OWN].user.nickName = "creator"; },
    d => { d.anchorInfo[RIVAL].user.displayId = "CREATOR"; },
    d => { d.anchorInfo[OWN].user.userId = RIVAL; },
    d => { d.anchorInfo[OWN].user.id_str = RIVAL; },
    d => { delete d.anchorInfo[OWN].user.userId; },
    d => { d.anchorInfo[OWN].user.userId = Number(OWN); },
    d => { d.anchorInfo[OWN].user.userId = "0"; },
    d => { d.anchorInfo[OWN].user.userId = "09007199254740993123"; },
    d => { d.anchorInfo[OWN].user.userId = true; },
    d => { d.action = 5; }, d => { d.battleId = "0"; },
    d => { d.common.roomId = RIVAL; }, d => { delete d.common.roomId; d.roomId = ROOM; }
  ]) { const data = packet(); mutate(data); assert.equal(normalize(data), null); }
  assert.equal(normalize(packet(), { channelUsername: "" }), null);
  assert.equal(normalize(packet(), { roomId: Number(ROOM) }), null);
  const invalidMap = packet(); invalidMap.anchorInfo["9007199254740993000"] = invalidMap.anchorInfo[OWN]; delete invalidMap.anchorInfo[OWN];
  assert.equal(normalize(invalidMap), null);
});

test("precise text UID wins over an unsafe numeric alias, never over contradictory precise evidence", () => {
  const data = packet(); data.anchorInfo[OWN].user.id = Number(OWN); data.anchorInfo[OWN].user.id_str = OWN;
  assert.equal(normalize(data).broadcaster.userId, OWN);
  data.anchorInfo[OWN].user.id_str = RIVAL; assert.equal(normalize(data), null);
  data.anchorInfo[OWN].user.id_str = OWN; data.anchorInfo[OWN].user.id = 123;
  assert.equal(normalize(data), null, "a different safe numeric alias is contradictory exact evidence");
});

test("installed SDK OPEN codec preserves exact creator map/user IDs and public displayId", () => {
  const blank = (name, fields) => ({ ...sdk[name].decode(new Uint8Array()), ...fields });
  const data = blank("WebcastLinkMicBattle", { action: 4, battleId: "8000",
    common: blank("CommonMessageData", { msgId: "12345", roomId: ROOM }), anchorInfo: {
      [OWN]: blank("WebcastLinkMicBattle_BattleUserInfo", { user: blank("WebcastLinkMicBattle_BattleUserInfo_BattleBaseUserInfo", { userId: OWN, displayId: "creator" }) }),
      [RIVAL]: blank("WebcastLinkMicBattle_BattleUserInfo", { user: blank("WebcastLinkMicBattle_BattleUserInfo_BattleBaseUserInfo", { userId: RIVAL, displayId: "rival" }) })
    } });
  const decoded = sdk.WebcastLinkMicBattle.decode(sdk.WebcastLinkMicBattle.encode(data).finish());
  assert.equal(normalize(decoded).broadcaster.userId, OWN);
});

function workspace(context, plans = [{}]) {
  const connectors = [], sourcePath = path.resolve(__dirname, "../src/main/source-hub.js"), realRequire = createRequire(sourcePath);
  class FakeConnector extends EventEmitter {
    constructor() { super(); this.plan = plans.shift() || {}; this.roomId = this.plan.roomId || ROOM; connectors.push(this); }
    async fetchIsLive() { return true; }
    async connect() {
      this.plan.duringConnect?.(this);
      if (this.plan.wait) await this.plan.wait;
      return { roomId: this.roomId, roomInfo: this.plan.roomInfo };
    }
    async disconnect() {}
    async fetchRoomInfo() { return this.plan.fetch ? this.plan.fetch() : { data: { prompts: [] } }; }
  }
  const module = { exports: {} };
  new vm.Script(fs.readFileSync(sourcePath, "utf8"), { filename: sourcePath }).runInNewContext({
    require: (request) => request === "tiktok-live-connector"
      ? { ControlEvent: sdk.ControlEvent, WebcastEvent: sdk.WebcastEvent, TikTokLiveConnection: FakeConnector } : realRequire(request),
    module, exports: module.exports, URL, setTimeout, clearTimeout, clearInterval, queueMicrotask, console
  });
  const state = createDefaultState(); state.settings.tiktok.username = "creator";
  state.connections.push({ id: "source_tiktok", type: "tiktok-direct", enabled: true, status: "disconnected", config: { username: "creator" } });
  const hub = new module.exports.SourceHub({ store: { getState: () => clone(state), mutateRuntime: (mutate) => mutate(state), getSecret: () => "" } });
  const events = [];
  hub.on("match-event", (event) => events.push({ phase: event.phase, owner: state.settings.tiktok.broadcaster?.userId || "" }));
  context.after(() => hub.stopAll()); return { hub, connectors, state, events };
}

test("SourceHub installs verified OPEN owner before emitting its match when room/info contains only prompts", async (context) => {
  const f = workspace(context); await f.hub.start("source_tiktok"); await settled();
  assert.equal(f.state.settings.tiktok.broadcaster, null);
  f.connectors[0].emit("linkMicBattle", packet());
  assert.equal(f.state.settings.tiktok.broadcaster.userId, OWN);
  assert.deepEqual(f.events, [{ phase: "start", owner: OWN }]);
  f.connectors[0].emit(sdk.ControlEvent.DECODED_DATA, "WebcastLinkMicBattle", { data: packet() });
  await settled(); assert.equal(f.events.length, 1);
});

test("OPEN received during connect is cached once and installed only after current room becomes live", async (context) => {
  let release; const wait = new Promise((resolve) => { release = resolve; });
  const f = workspace(context, [{ wait, duringConnect: (connector) => connector.emit("linkMicBattle", packet()) }]);
  await f.hub.start("source_tiktok"); await settled();
  assert.equal(f.state.settings.tiktok.broadcaster, null);
  assert.equal(f.hub.runtimes.get("source_tiktok").verifiedMatchOwner.broadcaster.userId, OWN);
  release(); await settled(); await settled();
  assert.equal(f.state.settings.tiktok.broadcaster.userId, OWN);
  assert.equal(f.state.settings.tiktok.status, "live");
});

test("a replayed OPEN restores cleared reconnect identity without replaying the ordinary match", async (context) => {
  const f = workspace(context); await f.hub.start("source_tiktok"); await settled();
  f.connectors[0].emit("linkMicBattle", packet()); assert.equal(f.events.length, 1);
  // The direct connection keeps its message replay fence across reconnects,
  // but owner state/cache must be fresh. Reproduce those exact preconditions.
  f.hub.runtimes.get("source_tiktok").verifiedMatchOwner = null;
  f.state.settings.tiktok.broadcaster = null;
  f.connectors[0].emit("linkMicBattle", clone(packet()));
  assert.equal(f.events.length, 1); assert.equal(f.state.settings.tiktok.broadcaster.userId, OWN);
});

test("startup cache from a different resolved room is discarded instead of being reused", async (context) => {
  const f = workspace(context, [{ duringConnect: (connector) => {
    connector.emit("linkMicBattle", packet()); connector.roomId = RIVAL;
  } }]);
  await f.hub.start("source_tiktok"); await settled();
  assert.equal(f.state.settings.tiktok.broadcaster, null);
  assert.equal(f.hub.runtimes.get("source_tiktok").verifiedMatchOwner, null);
});

test("partial HTTP owner cannot erase verified OPEN UID or restore an identity after contradictory rich HTTP evidence", async (context) => {
  let resolvePartial;
  const partial = new Promise((resolve) => { resolvePartial = resolve; });
  const f = workspace(context, [{ fetch: () => partial }]);
  await f.hub.start("source_tiktok"); await settled(); f.connectors[0].emit("linkMicBattle", packet());
  resolvePartial({ data: { id_str: ROOM, owner: { display_id: "creator", nickname: "HTTP nickname" } } });
  await settled(); assert.equal(f.state.settings.tiktok.broadcaster.userId, OWN);
  assert.equal(f.state.settings.tiktok.broadcaster.nickname, "HTTP nickname");
  let resolveConflict; const conflict = new Promise((resolve) => { resolveConflict = resolve; });
  const g = workspace(context, [{ fetch: () => conflict }]);
  await g.hub.start("source_tiktok"); await settled(); g.connectors[0].emit("linkMicBattle", packet());
  resolveConflict({ data: { id_str: ROOM, owner: { id_str: RIVAL, display_id: "creator" } } });
  await settled(); assert.equal(g.state.settings.tiktok.broadcaster, null);
  const later = packet(); later.common.msgId = "owner-open-later"; g.connectors[0].emit("linkMicBattle", later);
  assert.equal(g.state.settings.tiktok.broadcaster, null);
});

test("rich HTTP owner mismatch rejects later OPEN evidence rather than silently switching owner", async (context) => {
  const f = workspace(context, [{ roomInfo: { data: { id_str: ROOM, owner: { id_str: RIVAL, display_id: "creator" } } } }]);
  await f.hub.start("source_tiktok"); await settled(); assert.equal(f.state.settings.tiktok.broadcaster.userId, RIVAL);
  f.connectors[0].emit("linkMicBattle", packet());
  assert.equal(f.state.settings.tiktok.broadcaster, null);
  assert.deepEqual(f.events, [{ phase: "start", owner: "" }]);
});

test("rich initial HTTP identity survives later partial HTTP without needing any OPEN", async (context) => {
  let resolvePartial; const partial = new Promise((resolve) => { resolvePartial = resolve; });
  const f = workspace(context, [{ roomInfo: { data: { id_str: ROOM, owner: { id_str: OWN, display_id: "creator" } } }, fetch: () => partial }]);
  await f.hub.start("source_tiktok"); await settled();
  assert.equal(f.state.settings.tiktok.broadcaster.userId, OWN);
  assert.equal(f.hub.runtimes.get("source_tiktok").verifiedMatchOwner.broadcaster.userId, OWN);
  resolvePartial({ data: { id_str: ROOM, owner: { display_id: "creator", nickname: "Partial HTTP" } } });
  await settled(); assert.equal(f.state.settings.tiktok.broadcaster.userId, OWN);
  assert.equal(f.state.settings.tiktok.broadcaster.nickname, "Partial HTTP");
});

test("rich HTTP-to-HTTP contradiction and contradictory exact aliases fence owner without OPEN", async (context) => {
  for (const owner of [{ id_str: RIVAL, display_id: "creator" }, { id_str: OWN, userId: RIVAL, display_id: "creator" }]) {
    let resolveLater; const later = new Promise((resolve) => { resolveLater = resolve; });
    const f = workspace(context, [{ roomInfo: { data: { id_str: ROOM, owner: { id_str: OWN, display_id: "creator" } } }, fetch: () => later }]);
    await f.hub.start("source_tiktok"); await settled();
    resolveLater({ data: { id_str: ROOM, owner } }); await settled();
    assert.equal(f.state.settings.tiktok.broadcaster, null);
    assert.equal(f.hub.runtimes.get("source_tiktok").matchOwnerConflict, true);
    f.connectors[0].emit("linkMicBattle", packet()); assert.equal(f.state.settings.tiktok.broadcaster, null);
  }
});

test("pure metadata reconciliation preserves unrelated room's cache and never mutates its inputs", () => {
  const runtime = { roomId: ROOM, verifiedMatchOwner: normalize(packet()), matchOwnerConflict: false };
  const state = { roomId: ROOM, username: "creator", broadcaster: runtime.verifiedMatchOwner.broadcaster };
  const before = clone({ runtime, state });
  const other = { roomId: RIVAL, ownerConflict: true, broadcaster: null };
  const result = reconcileTikTokOwnerMetadata(other, runtime, state, "creator");
  assert.equal(result.conflict, false); assert.deepEqual(result.cache, runtime.verifiedMatchOwner);
  assert.deepEqual({ runtime, state }, before);
});

test("stopped/replaced connector and pre-connect cache cannot restore another source's identity", async (context) => {
  const f = workspace(context, [{}, {}]); await f.hub.start("source_tiktok"); await settled();
  const old = f.connectors[0], late = old.listeners("linkMicBattle")[0]; old.emit("linkMicBattle", packet());
  const runtime = f.hub.runtimes.get("source_tiktok"); await f.hub.stopAll();
  assert.equal(runtime.verifiedMatchOwner, null); assert.equal(f.state.settings.tiktok.broadcaster, null);
  await f.hub.start("source_tiktok"); await settled(); late(packet());
  assert.equal(f.state.settings.tiktok.broadcaster, null);
  const otherRoom = packet(); otherRoom.common.roomId = RIVAL; f.connectors[1].emit("linkMicBattle", otherRoom);
  assert.equal(f.state.settings.tiktok.broadcaster, null);
  const duplicate = packet(); duplicate.anchorInfo[RIVAL].user.displayId = "creator";
  f.connectors[1].emit("linkMicBattle", duplicate); assert.equal(f.state.settings.tiktok.broadcaster, null);
});
