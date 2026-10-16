"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { EventEmitter } = require("node:events");
const { ControlEvent, WebcastEvent } = require("tiktok-live-connector");
const { StateStore } = require("../src/main/store");
const { createDefaultState } = require("../src/main/defaults");
const { ShenPulseCore } = require("../src/main/core");
const { tiktokCurrentViewerCount, tiktokRelayLiveMetadata, tiktokRoomLiveMetadata } = require("../src/main/source-hub");

const sourcePath = path.resolve(__dirname, "../src/main/source-hub.js");
const sourceCode = fs.readFileSync(sourcePath, "utf8");
const realRequire = createRequire(sourcePath);
const clone = (value) => JSON.parse(JSON.stringify(value));
const settled = () => new Promise((resolve) => setImmediate(resolve));

function roomInfo(username = "creator", roomId = "room-a", count = 12) {
  return { data: { id_str: roomId, user_count: count, owner: {
    display_id: username, nickname: "Creator", avatar_thumb: { url_list: ["https://cdn.example/creator.webp"] }
  } } };
}

function workspace(context, plans = []) {
  const connectors = [];
  const sockets = [];
  class FakeConnector extends EventEmitter {
    constructor(username) {
      super();
      this.username = username;
      this.plan = plans.shift() || {};
      this.roomId = this.plan.roomId || "room-a";
      this.roomInfo = this.plan.roomInfo || null;
      this.fetchCalls = 0;
      connectors.push(this);
    }
    async fetchIsLive() { return true; }
    async connect() { return { roomId: this.roomId, roomInfo: this.roomInfo }; }
    async disconnect() { this.disconnected = true; }
    async fetchRoomInfo() {
      this.fetchCalls += 1;
      return this.plan.fetch ? this.plan.fetch() : null;
    }
  }
  class FakeSocket extends EventEmitter {
    constructor() { super(); sockets.push(this); this.readyState = 1; }
    addEventListener(event, listener) { this.on(event, listener); }
    send() {}
    close() { this.emit("close"); }
    message(value) { this.emit("message", { data: JSON.stringify(value) }); }
  }
  const module = { exports: {} };
  new vm.Script(sourceCode, { filename: sourcePath }).runInNewContext({
    require: (request) => request === "tiktok-live-connector"
      ? { ControlEvent, WebcastEvent, TikTokLiveConnection: FakeConnector } : realRequire(request),
    module, exports: module.exports, WebSocket: FakeSocket, URL,
    setTimeout, clearTimeout, clearInterval, queueMicrotask, console
  });
  const state = createDefaultState();
  state.settings.tiktok.username = "creator";
  state.connections.push({ id: "source_tiktok", type: "tiktok-direct", enabled: true,
    status: "disconnected", config: { username: "creator", url: "wss://relay.example.test" } });
  const hub = new module.exports.SourceHub({ store: {
    getState: () => clone(state),
    mutateRuntime: (mutate) => mutate(state),
    getSecret: () => ""
  } });
  const metadata = [];
  hub.on("tiktok-live-metadata", (value) => metadata.push(clone(value)));
  context.after(() => hub.stopAll());
  return { state, hub, connectors, sockets, metadata };
}

test("le connecteur transmet une bataille réelle une fois, jamais comme cadeau/chat, et refuse l’ancien runtime", async (context) => {
  const { hub, connectors } = workspace(context, [{ roomInfo: roomInfo() }]); const matches = [], ordinary = [];
  hub.on("match-event", (event) => matches.push(event)); hub.on("event", (event) => ordinary.push(event));
  await hub.start("source_tiktok"); const connector = connectors[0];
  const packet = { common: { msgId: "real-battle", roomId: "room-a" }, battleId: "battle", action: 4,
    battleSetting: { startTimeMs: String(Date.now()), duration: 300 }, anchorInfo: { 1: { user: { userId: "1", displayId: "creator" } } } };
  const lateListener = connector.listeners("linkMicBattle")[0];
  connector.emit("linkMicBattle", packet); connector.emit(ControlEvent.DECODED_DATA, "WebcastLinkMicBattle", { data: packet });
  await settled(); assert.equal(matches.length, 1); assert.equal(matches[0].battleId, "battle");
  assert.equal(matches[0].source, "source_tiktok"); assert.equal(ordinary.length, 0);
  await hub.stopAll(); lateListener({ ...packet, common: { msgId: "late-battle" } }); assert.equal(matches.length, 1);
});

test("le conteneur TikTok synchronise passivement les dates de match et se détache à la reconnexion", async (context) => {
  const { hub, connectors } = workspace(context, [{ roomInfo: roomInfo() }, { roomInfo: roomInfo() }]);
  const matches = []; hub.on("match-event", (event) => matches.push(event));
  await hub.start("source_tiktok");
  const connector = connectors[0], socket = new EventEmitter();
  connector.emit(ControlEvent.WEBSOCKET_CONNECTED, socket);
  assert.equal(socket.listenerCount("protoMessageFetchResult"), 1);
  const receipt = Date.now(), remote = receipt + 2342;
  socket.emit("protoMessageFetchResult", { now: String(remote) });
  const observed = Date.now();
  connector.emit("linkMicBattle", { common: { msgId: "clock-battle", roomId: "room-a" }, battleId: "clock", action: 4,
    battleSetting: { startTimeMs: String(remote), endTimeMs: String(remote + 301000), duration: 301 } });
  assert.equal(matches.length, 1);
  assert.ok(matches[0].startsAtMs >= receipt && matches[0].startsAtMs <= observed);
  assert.equal(matches[0].endsAtMs - matches[0].startsAtMs, 301000);
  await hub.stopAll();
  assert.equal(socket.listenerCount("protoMessageFetchResult"), 0);
  socket.emit("protoMessageFetchResult", { now: String(Date.now() + 25000) });
  await hub.start("source_tiktok");
  const fresh = Date.now() + 2342;
  connectors[1].emit("linkMicBattle", { common: { msgId: "clock-next", roomId: "room-a" }, battleId: "next", action: 4,
    battleSetting: { startTimeMs: String(fresh), duration: 301 } });
  assert.equal(matches[1].startsAtMs, fresh, "Le nouvel abonnement ne réutilise pas l'horloge du précédent");
});

test("le vrai SDK protobuf transmet début, scores et fin via callbacks ou DECODED_DATA sans doublon", async (context) => {
  const { WebcastLinkMicBattle, WebcastLinkMicArmies, BattleSetting, WebcastLinkMicBattle_BattleUserInfo_BattleBaseUserInfo } = require("tiktok-live-connector");
  const { hub, connectors } = workspace(context, [{ roomInfo: roomInfo() }]); const matches = [];
  hub.on("match-event", (event) => matches.push(event)); await hub.start("source_tiktok");
  const start = WebcastLinkMicBattle.decode(WebcastLinkMicBattle.encode({
    ...WebcastLinkMicBattle.decode(new Uint8Array()), battleId: "100", action: 4,
    battleSetting: { ...BattleSetting.decode(new Uint8Array()), battleId: "100", startTimeMs: String(Date.now()), duration: 300 },
    anchorInfo: { 1: { user: { ...WebcastLinkMicBattle_BattleUserInfo_BattleBaseUserInfo.decode(new Uint8Array()), userId: "1", displayId: "creator", nickName: "Creator" }, tags: [] },
      2: { user: { ...WebcastLinkMicBattle_BattleUserInfo_BattleBaseUserInfo.decode(new Uint8Array()), userId: "2", displayId: "rival" }, tags: [] } }
  }).finish());
  const scores = WebcastLinkMicArmies.decode(WebcastLinkMicArmies.encode({
    ...WebcastLinkMicArmies.decode(new Uint8Array()), battleId: "100", battleStatus: 1,
    battleItems: { 1: { anchorIdStr: "1", hostScore: "50", userArmy: [] }, 2: { anchorIdStr: "2", hostScore: "30", userArmy: [] } }
  }).finish());
  connectors[0].emit(WebcastEvent.LINK_MIC_BATTLE, start);
  connectors[0].emit(ControlEvent.DECODED_DATA, "WebcastLinkMicBattle", { data: start });
  connectors[0].emit(ControlEvent.DECODED_DATA, "WebcastLinkMicArmies", { data: scores });
  connectors[0].emit(WebcastEvent.LINK_MIC_ARMIES, scores);
  const end = { ...start, action: 5, battleResult: { 1: { userId: "1", score: "50", result: 0 }, 2: { userId: "2", score: "30", result: 1 } } };
  connectors[0].emit(ControlEvent.DECODED_DATA, "WebcastLinkMicBattle", { data: end });
  await settled(); assert.equal(matches.length, 3);
  assert.deepEqual(matches.map((event) => event.phase), ["start", "update", "end"]);
  assert.equal(matches[1].participants[0].score, 50); assert.equal(matches[2].participants[0].result, "win");
});

test("un relais TikTok configuré transmet les événements SDK de match, pas des événements génériques ou anciens", async (context) => {
  const { state, hub, sockets } = workspace(context); const matches = [], ordinary = [];
  state.connections.find((entry) => entry.id === "source_tiktok").type = "tiktok-relay";
  hub.on("match-event", (event) => matches.push(event)); hub.on("event", (event) => ordinary.push(event));
  await hub.start("source_tiktok"); const socket = sockets[0]; socket.emit("open");
  socket.message({ event: "linkMicBattle", data: { common: { roomId: "room-a" }, battleId: "unbound", action: 4 } });
  assert.equal(matches.length, 0, "aucun match ne lie implicitement le relais à une nouvelle salle");
  socket.message({ event: "status", data: { live: true, roomId: "room-a" } });
  const packet = { common: { msgId: "relay-battle", roomId: "room-a" }, battleId: "battle", action: 4 };
  socket.message({ event: "linkMicBattle", data: packet });
  socket.message({ event: "WebcastLinkMicBattle", data: packet });
  socket.message({ event: "decodedData", data: { type: "WebcastLinkMicArmies", data: {
    common: { msgId: "relay-scores", roomId: "room-a" }, battleId: "battle", battleStatus: 1, battleItems: { 1: { hostScore: "9" } }
  } } });
  socket.message({ event: "linkMicBattle", data: { ...packet, common: { msgId: "old-battle", roomId: "old-room" } } });
  assert.equal(matches.length, 2); assert.equal(ordinary.length, 0);
  assert.deepEqual(matches.map((event) => event.phase), ["start", "update"]);
  assert.equal(matches[0].source, "source_tiktok"); assert.equal(matches[1].roomId, "room-a");
  const lateListener = socket.listeners("message")[0]; await hub.stopAll();
  lateListener({ data: JSON.stringify({ event: "linkMicBattle", data: { ...packet, common: { msgId: "late" } } }) });
  assert.equal(matches.length, 2);
});

test("un WebSocket générique n'acquiert jamais le canal Matchs du relais TikTok", async (context) => {
  const { state, hub, sockets } = workspace(context); const matches = [];
  state.connections.find((entry) => entry.id === "source_tiktok").type = "websocket";
  hub.on("match-event", (event) => matches.push(event)); await hub.start("source_tiktok");
  sockets[0].emit("open"); sockets[0].message({ event: "linkMicBattle", data: { battleId: "battle", action: 4 } });
  assert.equal(matches.length, 0);
});

test("le connecteur direct ignore le match d’une ancienne salle même si son runtime est encore actif", async (context) => {
  const { hub, connectors } = workspace(context, [{ roomInfo: roomInfo() }]); const matches = [];
  hub.on("match-event", (event) => matches.push(event)); await hub.start("source_tiktok");
  connectors[0].emit(WebcastEvent.LINK_MIC_BATTLE, { common: { roomId: "old-room" }, battleId: "old-battle", action: 4 });
  await settled(); assert.equal(matches.length, 0);
});

test("l’ID du diffuseur vient de room.owner vérifié et n’est jamais celui d’un viewer", () => {
  const info = roomInfo(); info.data.owner.id_str = "1234567890123456789";
  assert.equal(tiktokRoomLiveMetadata(info, "creator", "room-a").broadcaster.userId, "1234567890123456789");
  assert.equal(tiktokRoomLiveMetadata({ data: { user: { id: "viewer" } } }, "creator")?.broadcaster, undefined);
});

test("l'identifiant texte exact du diffuseur est prioritaire au nombre JSON déjà arrondi", () => {
  const exact = "1234567890123456789", info = roomInfo();
  info.data.owner.id = Number(exact); info.data.owner.id_str = exact;
  assert.notEqual(String(info.data.owner.id), exact, "La fixture reproduit la perte de précision du JSON numérique");
  assert.equal(tiktokRoomLiveMetadata(info, "creator", "room-a").broadcaster.userId, exact);
  delete info.data.owner.id_str; info.data.owner.userIdStr = exact;
  assert.equal(tiktokRoomLiveMetadata(info, "creator", "room-a").broadcaster.userId, exact);
});

test("un UID TikTok numérique imprécis n'est jamais enregistré comme identité exacte du diffuseur", () => {
  const info = roomInfo(); info.data.owner.id = Number("1234567890123456789");
  assert.equal(tiktokRoomLiveMetadata(info, "creator", "room-a").broadcaster.userId, undefined);
  for (const id of [0, -1, 1.5, NaN, Infinity, false]) {
    info.data.owner.id = id;
    assert.equal(tiktokRoomLiveMetadata(info, "creator", "room-a").broadcaster.userId, undefined, String(id));
  }
  info.data.owner.id = 123;
  assert.equal(tiktokRoomLiveMetadata(info, "creator", "room-a").broadcaster.userId, "123");
});

test("les alias UID HTTP précis doivent tous s'accorder, sinon la preuve signale un conflit explicite", () => {
  const own = "1234567890123456789", rival = "1234567890123456790";
  for (const field of ["userIdStr", "user_id_str", "userId", "id"]) {
    const info = roomInfo(); Object.assign(info.data.owner, { id_str: own, [field]: rival });
    const metadata = tiktokRoomLiveMetadata(info, "creator", "room-a");
    assert.equal(metadata.broadcaster, null, field);
    assert.equal(metadata.ownerConflict, true, field);
    assert.equal(metadata.roomId, "room-a");
    assert.equal(metadata.currentViewers, 12, "An identity conflict must not fabricate or erase the independent measured audience");
  }
  const agreeing = roomInfo(); Object.assign(agreeing.data.owner,
    { id_str: own, userIdStr: own, user_id_str: own, userId: own, id: Number(own) });
  const metadata = tiktokRoomLiveMetadata(agreeing, "creator", "room-a");
  assert.equal(metadata.broadcaster.userId, own);
  assert.equal("ownerConflict" in metadata, false, "An already rounded numeric alias is not contradictory precise evidence");
});

test("un UID HTTP absent ou malformé reste partiel, jamais une identité ou un faux conflit", () => {
  const values = [undefined, null, "", "0", "01", " 123", "123 ", "1e3", "-1", "1.5", "creator",
    "18446744073709551616", "999999999999999999999999999", true, [], {}, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1];
  for (const value of values) {
    const info = roomInfo(); info.data.owner.id_str = value;
    const metadata = tiktokRoomLiveMetadata(info, "creator", "room-a");
    assert.equal(metadata.broadcaster.userId, undefined, String(value));
    assert.equal("ownerConflict" in metadata, false, String(value));
  }
  const info = roomInfo(); info.data.owner.id_str = "18446744073709551615";
  assert.equal(tiktokRoomLiveMetadata(info, "creator", "room-a").broadcaster.userId, "18446744073709551615");
});

test("un alias HTTP malformé ne masque ni ne contredit un autre UID texte exact valide", () => {
  const own = "1234567890123456789";
  for (const value of ["broken", "0", "01", null, false, Number(own)]) {
    const info = roomInfo(); Object.assign(info.data.owner, { id_str: value, userIdStr: own });
    const metadata = tiktokRoomLiveMetadata(info, "creator", "room-a");
    assert.equal(metadata.broadcaster.userId, own);
    assert.equal("ownerConflict" in metadata, false);
  }
});

test("TikTok host metadata comes from room.owner, supports snake-case avatars, and rejects other hosts or rooms", () => {
  assert.deepEqual(tiktokRoomLiveMetadata(roomInfo(), "@@Creator", "room-a"), {
    roomId: "room-a", broadcaster: { username: "creator", nickname: "Creator", avatarUrl: "https://cdn.example/creator.webp" }, currentViewers: 12
  });
  assert.equal(tiktokRoomLiveMetadata(roomInfo("other"), "creator", "room-a"), null);
  assert.equal(tiktokRoomLiveMetadata(roomInfo("creator", "room-b"), "creator", "room-a"), null);
  assert.equal(tiktokRoomLiveMetadata({ data: { user: { uniqueId: "viewer", avatarUrl: "https://cdn.example/viewer.webp" } } }, "creator"), null);
  assert.equal(tiktokRelayLiveMetadata({ event: "chat", data: { owner: roomInfo().data.owner, viewerCount: 111 } }, "creator"), null);
  const insecure = roomInfo();
  insecure.data.owner.avatar_thumb.url_list = ["http://cdn.example/creator.webp"];
  assert.equal(tiktokRoomLiveMetadata(insecure, "creator", "room-a").broadcaster.avatarUrl, "");
});

test("TikTok current viewers preserve measured zero and never substitute cumulative users or gifters", () => {
  assert.equal(tiktokCurrentViewerCount({ viewerCount: 0 }), 0);
  assert.equal(tiktokCurrentViewerCount({ data: { viewerCount: "15" } }), 15);
  for (const value of [null, undefined, false, "", " ", -1, 1.5, "-2", "2.5", Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(tiktokCurrentViewerCount({ viewerCount: value, totalUser: 200 }), null, String(value));
  }
  assert.equal(tiktokCurrentViewerCount({ totalUser: 200, ranksList: [{ user: { avatarUrl: "https://cdn.example/viewer.webp" } }] }), null);
  assert.equal(tiktokRoomLiveMetadata({ owner: roomInfo().data.owner, total_user: 200 }, "creator").currentViewers, undefined);
});

test("a direct TikTok connection publishes the real host and updates only the current viewer count", async (context) => {
  const { state, hub, connectors, metadata } = workspace(context, [{ roomInfo: roomInfo() }]);
  await hub.start("source_tiktok");
  await settled();
  const connector = connectors[0];
  assert.equal(state.settings.tiktok.status, "live");
  assert.equal(state.settings.tiktok.broadcaster.username, "creator");
  assert.equal(state.settings.tiktok.currentViewers, 12);
  assert.equal(connector.fetchCalls, 0, "Complete connect metadata must not trigger another request");
  connector.emit(WebcastEvent.ROOM_USER, { viewerCount: 0, totalUser: 100 });
  assert.equal(state.settings.tiktok.currentViewers, 0);
  const previousNotifications = metadata.length;
  connector.emit(WebcastEvent.ROOM_USER, { viewerCount: 0 });
  assert.equal(metadata.length, previousNotifications, "Unchanged count does not notify the renderer");
  connector.emit(WebcastEvent.ROOM_USER, { viewerCount: 99, common: { roomId: "other-room" } });
  connector.emit(WebcastEvent.CHAT, { user: { uniqueId: "viewer", avatarUrl: "https://cdn.example/viewer.webp" }, comment: "Hello", viewerCount: 987 });
  assert.equal(state.settings.tiktok.currentViewers, 0);
  assert.equal(state.settings.tiktok.broadcaster.avatarUrl, "https://cdn.example/creator.webp");
});

test("a partial room snapshot fetches host metadata once without delaying LIVE or overwriting a newer roomUser push", async (context) => {
  let resolveRoomInfo;
  const pending = new Promise((resolve) => { resolveRoomInfo = resolve; });
  const { state, hub, connectors } = workspace(context, [{ roomInfo: { data: { id_str: "room-a" } }, fetch: () => pending }]);
  await hub.start("source_tiktok");
  await settled();
  assert.equal(state.settings.tiktok.status, "live");
  assert.equal(state.settings.tiktok.broadcaster, null);
  assert.equal(state.settings.tiktok.currentViewers, null);
  assert.equal(connectors[0].fetchCalls, 1);
  connectors[0].emit(WebcastEvent.ROOM_USER, { viewerCount: 0 });
  resolveRoomInfo(roomInfo());
  await settled();
  assert.equal(state.settings.tiktok.broadcaster.username, "creator");
  assert.equal(state.settings.tiktok.currentViewers, 0);
  assert.equal(connectors[0].fetchCalls, 1);
});

test("missing room metadata and a failed optional fetch never stop a working LIVE", async (context) => {
  const { state, hub, connectors } = workspace(context, [{ fetch: async () => { throw new Error("Photo unavailable"); } }]);
  await hub.start("source_tiktok");
  await settled();
  assert.equal(state.settings.tiktok.status, "live");
  assert.equal(state.settings.tiktok.broadcaster, null);
  assert.equal(state.settings.tiktok.currentViewers, null);
  assert.equal(connectors[0].fetchCalls, 1);
  assert.equal(hub.runtimes.get("source_tiktok").reconnectTimer, null);
});

test("offline and stop clear host/audience metadata but retain the room identity used to resume session counters", async (context) => {
  const { state, hub, connectors } = workspace(context, [{ roomInfo: roomInfo() }]);
  await hub.start("source_tiktok");
  await settled();
  connectors[0].emit(WebcastEvent.STREAM_END);
  assert.equal(state.settings.tiktok.status, "offline");
  assert.equal(state.settings.tiktok.roomId, "room-a");
  assert.equal(state.settings.tiktok.broadcaster, null);
  assert.equal(state.settings.tiktok.currentViewers, null);
  await hub.stop("source_tiktok");
  assert.equal(state.settings.tiktok.status, "disconnected");
  assert.equal(state.settings.tiktok.broadcaster, null);
});

test("late host requests and saved callbacks from a stopped source cannot populate a replacement account or room", async (context) => {
  let resolveOld;
  const pending = new Promise((resolve) => { resolveOld = resolve; });
  const { state, hub, connectors } = workspace(context, [
    { fetch: () => pending },
    { roomId: "room-b", roomInfo: roomInfo("next.creator", "room-b", 7) }
  ]);
  await hub.start("source_tiktok");
  await settled();
  const oldCallback = connectors[0].listeners(WebcastEvent.ROOM_USER)[0];
  await hub.stop("source_tiktok");
  state.settings.tiktok.username = "next.creator";
  state.connections.find((entry) => entry.id === "source_tiktok").config.username = "next.creator";
  await hub.start("source_tiktok");
  await settled();
  oldCallback({ viewerCount: 999 });
  resolveOld(roomInfo());
  await settled();
  assert.equal(state.settings.tiktok.roomId, "room-b");
  assert.equal(state.settings.tiktok.broadcaster.username, "next.creator");
  assert.equal(state.settings.tiktok.currentViewers, 7);
});

test("another TikTok source cannot replace canonical TikTok metadata or its room identity", async (context) => {
  const { state, hub } = workspace(context, [{ roomInfo: roomInfo() }, { roomId: "other-room", roomInfo: roomInfo("other", "other-room", 55) }]);
  await hub.start("source_tiktok");
  await settled();
  state.connections.push({ id: "other-source", type: "tiktok-direct", enabled: true, config: { username: "other" } });
  await hub.start("other-source");
  await settled();
  await hub.stop("other-source");
  assert.equal(state.settings.tiktok.status, "live");
  assert.equal(state.settings.tiktok.roomId, "room-a");
  assert.equal(state.settings.tiktok.broadcaster.username, "creator");
  assert.equal(state.settings.tiktok.currentViewers, 12);
});

test("TikTok relay metadata accepts an explicit room owner and roomUser viewerCount, not chat-user photos", async (context) => {
  const { state, hub, sockets } = workspace(context);
  state.connections.find((entry) => entry.id === "source_tiktok").type = "tiktok-relay";
  await hub.start("source_tiktok");
  sockets[0].emit("open");
  sockets[0].message({ event: "status", data: { live: true, roomId: "room-a", roomInfo: roomInfo() } });
  assert.equal(state.settings.tiktok.broadcaster.username, "creator");
  assert.equal(state.settings.tiktok.currentViewers, 12);
  sockets[0].message({ event: "roomUser", data: { viewerCount: 0, common: { roomId: "room-a" } } });
  sockets[0].message({ event: "roomInfo", data: { ...roomInfo("creator", "other-room", 555).data, status: 2 } });
  sockets[0].message({ event: "streamEnd", data: { roomId: "other-room" } });
  sockets[0].message({ event: "roomUser", data: { viewerCount: 555, common: { roomId: "other-room" } } });
  sockets[0].message({ event: "chat", data: { user: { uniqueId: "viewer", avatarUrl: "https://cdn.example/viewer.webp" }, viewerCount: 999, comment: "Hello" } });
  assert.equal(state.settings.tiktok.currentViewers, 0);
  assert.equal(state.settings.tiktok.status, "live");
  assert.equal(state.settings.tiktok.roomId, "room-a");
  assert.equal(state.settings.tiktok.broadcaster.username, "creator");
  sockets[0].message({ event: "streamEnd", data: {} });
  assert.equal(state.settings.tiktok.currentViewers, null);
  assert.equal(state.settings.tiktok.broadcaster, null);
});

test("a stopped relay callback cannot reintroduce host or audience data", async (context) => {
  const { state, hub, sockets } = workspace(context);
  state.connections.find((entry) => entry.id === "source_tiktok").type = "tiktok-relay";
  await hub.start("source_tiktok");
  sockets[0].emit("open");
  const oldCallback = sockets[0].listeners("message")[0];
  await hub.stop("source_tiktok");
  oldCallback({ data: JSON.stringify({ event: "status", data: { live: true, roomId: "room-a", roomInfo: roomInfo() } }) });
  assert.equal(state.settings.tiktok.status, "disconnected");
  assert.equal(state.settings.tiktok.broadcaster, null);
  assert.equal(state.settings.tiktok.currentViewers, null);
});

test("TikTok host and viewer metadata are runtime-only and discarded by a real StateStore reload", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-live-metadata-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = new StateStore(directory);
  store.load();
  store.activateAccount("creator");
  const refreshTokenSecretId = store.setSecret("", "refresh-token");
  store.set("settings.account", { uid: "creator", email: "creator@example.test", refreshTokenSecretId });
  for (const username of ["creator", ""]) {
    store.set("settings.tiktok", { ...store.getState().settings.tiktok, username,
      status: "live", roomId: "room-a", broadcaster: { username: "creator", avatarUrl: "https://cdn.example/creator.webp" }, currentViewers: 12 });
    store.flush();
    const reopened = new StateStore(directory);
    reopened.load();
    assert.equal(reopened.getState().settings.tiktok.status, username ? "disconnected" : "unconfigured");
    assert.equal(reopened.getState().settings.tiktok.broadcaster, null);
    assert.equal(reopened.getState().settings.tiktok.currentViewers, null);
    reopened.flush();
  }
});

test("TikTok audience changes use coalesced runtime snapshots without changing session counters or logging a session", async (context) => {
  const metadataTime = "2026-10-13T10:00:00.000Z";
  context.mock.timers.enable({ apis: ["Date"], now: Date.parse(metadataTime) });
  const state = createDefaultState();
  state.settings.tiktok.currentViewers = 0;
  state.statistics.sessionLikes = 456;
  state.session.running = true;
  const notifications = [];
  const core = new ShenPulseCore({
    store: { getState: () => state, getSecret: () => "", mutate: (mutate) => mutate(state), mutateRuntime: (mutate) => mutate(state) },
    resourcesDirectory: path.resolve(__dirname, "../resources"),
    notifyRenderer: (channel, payload) => notifications.push({ channel, payload })
  });
  core.publicOverlayRelay.publishState = () => {};
  context.after(() => clearTimeout(core.deferredChangeTimer));
  const before = clone({ statistics: state.statistics, session: state.session, activity: state.activity });
  for (let count = 0; count < 100; count += 1) {
    state.settings.tiktok.currentViewers = count;
    core.sourceHub.emit("tiktok-live-metadata", { currentViewers: count });
  }
  assert.equal(notifications.length, 0);
  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].channel, "runtime-state-changed");
  assert.equal(notifications[0].payload.state.settings.tiktok.currentViewers, 99);
  // L'audience enrichit le nouveau bilan, mais ne crée ni événement, ni session,
  // ni entrée du journal et ne modifie aucun des compteurs historiques.
  const { liveSession: beforeLive, ...beforeCounters } = before.statistics;
  const { liveSession: afterLive, ...afterCounters } = clone(state.statistics);
  assert.deepEqual(afterCounters, beforeCounters);
  assert.deepEqual(clone(state.session), before.session);
  assert.deepEqual(clone(state.activity), before.activity);
  assert.deepEqual(afterLive, { ...beforeLive, hasData: true, platform: "tiktok",
    currentViewers: 99, peakViewers: 99, viewersByPlatform: { tiktok: 99, kick: null },
    audienceHistory: [{ timestamp: metadataTime, viewers: 99 }] });
  assert.deepEqual(notifications[0].payload.state.statistics.liveSession, { ...afterLive, participantCount: 0 });
  assert.deepEqual(Object.keys(notifications[0].payload.state.settings), ["tiktok"]);
});
