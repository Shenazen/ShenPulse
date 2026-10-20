"use strict";

const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { giftCatalogScope, sameGiftCatalogScope, trustedRoomGiftContext, synchronizeGiftCatalogScope } = require("../src/main/core/gift-scope");
const { registerMediaIpc } = require("../src/main/ipc/media");
const identity = require("../src/shared/gift-identity");
const { GiftCatalog } = require("../src/main/catalogs/gifts");
const { ingestCreatorEvent } = require("../src/main/core/ingestion");
const { tiktokGiftRecipientIds, tiktokConnectorPayload } = require("../src/main/sources/tiktok-protocol");

function stateFixture() {
  const state = { settings: { account: { uid: "member-a" }, tiktok: { username: "Creator", roomId: "123", status: "live", broadcaster: { userId: "9001" } } },
    session: { profileId: "profile-a", running: true },
    connections: [{ id: "source_tiktok", enabled: true, type: "tiktok-direct", config: { username: "creator" } }] };
  return { state, store: { getState: () => state } };
}

test("gift scope captures account/profile/creator/room, clears immediately and never substitutes the login name", () => {
  const f = stateFixture(), calls = [], core = { store: f.store, giftCatalog: { setRoomScope: (...args) => calls.push(args) } };
  const first = synchronizeGiftCatalogScope(core);
  assert.equal(first.username, "creator");
  assert.deepEqual(calls[0], ["creator", { roomId: "123" }]);
  for (const change of [
    () => { f.state.session.profileId = "b"; }, () => { f.state.settings.account.uid = "b"; },
    () => { f.state.settings.tiktok.username = "other"; }, () => { f.state.settings.tiktok.roomId = "456"; }
  ]) { change(); assert.equal(sameGiftCatalogScope(first, giftCatalogScope(f.store)), false); }
  f.state.settings.tiktok = {};
  synchronizeGiftCatalogScope(core);
  assert.deepEqual(calls.at(-1), ["", { roomId: "" }]);
});

test("only a bound primary LIVE gift can personalize the current creator's catalogue", () => {
  const f = stateFixture(), core = { store: f.store };
  const event = { source: "source_tiktok", type: "gift", data: { raw: { roomId: "123", channelUsername: "@creator", giftRecipientIds: ["9001"] } } };
  assert.deepEqual(trustedRoomGiftContext(core, event), { username: "creator", roomId: "123", verified: true });
  for (const source of ["manual", "api", "source_other"]) assert.equal(trustedRoomGiftContext(core, { ...event, source }), null);
  for (const raw of [{}, { roomId: "456", channelUsername: "creator" }, { roomId: "123", channelUsername: "rival" }]) {
    assert.equal(trustedRoomGiftContext(core, { ...event, data: { raw } }), null);
  }
  for (const extra of [{ giftRecipientIds: [] }, { giftRecipientIds: ["9002"] },
    { giftRecipientIds: ["9001", "9002"] }, { giftMessageRoomId: "456" }]) {
    assert.equal(trustedRoomGiftContext(core, { ...event, data: { raw: { ...event.data.raw, ...extra } } }), null);
  }
  f.state.connections[0].enabled = false; assert.equal(trustedRoomGiftContext(core, event), null);
  f.state.connections[0].enabled = true; f.state.settings.tiktok.status = "disconnected";
  assert.equal(trustedRoomGiftContext(core, event), null);
});

test("gift recipient proof is preserved losslessly and never inferred from the sender or anchor", () => {
  const own = "9007199254740993123", rival = "9007199254740993456";
  assert.deepEqual(tiktokGiftRecipientIds({ user: { id: own }, anchorId: own }), []);
  assert.deepEqual(tiktokGiftRecipientIds({ toUser: { id_str: own, id: Number(own) }, giftExtra: { toUserId: own } }), [own]);
  assert.deepEqual(tiktokGiftRecipientIds({ toUser: { id_str: own }, receiverUserId: rival }), [own, rival]);
  assert.deepEqual(tiktokGiftRecipientIds({ receiverUserId: "18446744073709551616" }), []);
  const payload = tiktokConnectorPayload("gift", { toUser: { id_str: own }, common: { roomId: "123" } }, "creator");
  assert.deepEqual(payload.giftRecipientIds, [own]); assert.equal(payload.giftMessageRoomId, "123");
});

test("gift searches return the current local catalogue before a TikTok refresh completes", async () => {
  for (const key of ["creator", "account", "profile", "room"]) {
    const f = stateFixture(), handlers = new Map(); let release, searches = 0;
    registerMediaIpc({ handle: (channel, callback) => handlers.set(channel, callback), store: f.store,
      core: { refreshGiftCatalog: () => new Promise((done) => { release = done; }),
        giftCatalog: { search: () => { searches += 1; return {}; } } } });
    const result = await handlers.get("catalog:gifts")({}, "Rose", 100);
    assert.deepEqual(result, {});
    assert.equal(searches, 1, "La recherche locale n'attend pas le réseau TikTok.");
    if (key === "creator") f.state.settings.tiktok.username = "other";
    if (key === "account") f.state.settings.account.uid = "other";
    if (key === "profile") f.state.session.profileId = "other";
    if (key === "room") f.state.settings.tiktok.roomId = "456";
    release(); await Promise.resolve();
    assert.equal(searches, 1, "Le rafraîchissement tardif ne rejoue pas une recherche pour l'ancien compte.");
  }
});

function renderer() {
  const f = stateFixture();
  const context = vm.createContext({ snapshot: { state: f.state }, ShenPulseGiftIdentity: identity,
    giftCatalogById: new Map(), giftCatalogByName: new Map(), GIFT_CATALOG: [] });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/core/ui-foundations.js"), "utf8"), context);
  context.rememberGifts([{ id: "7934", alternateIds: ["heart-me"], name: "Cœur sur moi", cost: 1,
    imageUrl: identity.COMMUNITY_HEART_IMAGE_URL }]);
  return { ...f, context };
}

test("the distinct creator gift keeps its provider name and custom art only in its own room, separate from the red heart", () => {
  const f = renderer(), imageUrl = "https://example.invalid/creator-heart.webp";
  const room = { username: "creator", roomId: "123", available: true };
  assert.equal(f.context.rememberRoomGifts([{ id: "157842", name: "Shenazen Pulse", imageUrl, cost: 1 }], room), true);
  assert.equal(f.context.giftForIdentity("Shenazen Pulse", "157842").imageUrl, imageUrl);
  assert.equal(f.context.giftForIdentity("Shenazen Pulse").name, "Shenazen Pulse");
  assert.equal(f.context.giftForIdentity("Cœur sur moi", "7934").imageUrl, identity.COMMUNITY_HEART_IMAGE_URL);
  assert.equal(f.context.giftForIdentity("Cœur sur moi", "heart-me").imageUrl, identity.COMMUNITY_HEART_IMAGE_URL);
  assert.equal(f.context.GIFT_CATALOG[0].imageUrl, identity.COMMUNITY_HEART_IMAGE_URL);
  assert.equal(f.context.giftForIdentity("Cœur sur moi", "unknown"), null);
  f.state.settings.tiktok.username = "other";
  assert.equal(f.context.giftForIdentity("Shenazen Pulse", "157842"), null);
  assert.equal(f.context.giftForIdentity("Cœur sur moi", "7934").imageUrl, identity.COMMUNITY_HEART_IMAGE_URL);
  assert.equal(f.context.rememberRoomGifts([{ id: "157842", name: "Shenazen Pulse", imageUrl, cost: 1 }], room), false);
});

test("room images are invalidated on account, profile and room changes, including rows learned before global lookup", () => {
  for (const property of ["account", "profile", "room"]) {
    const f = renderer(), imageUrl = "https://example.invalid/custom.webp";
    f.context.rememberRoomGifts([{ id: "157842", name: "Shenazen Pulse", cost: 1, imageUrl }], { username: "creator", roomId: "123", partial: true });
    assert.equal(f.context.giftForIdentity("Shenazen Pulse", "157842").imageUrl, imageUrl);
    if (property === "account") f.state.settings.account.uid = "b";
    if (property === "profile") f.state.session.profileId = "b";
    if (property === "room") f.state.settings.tiktok.roomId = "456";
    assert.equal(f.context.giftForIdentity("Shenazen Pulse", "157842"), null);
    assert.equal(f.context.GIFT_CATALOG.length, 1);
  }
});

test("a filtered search preserves other verified room images without adding them to the global identity cache", () => {
  const f = renderer(), room = { username: "creator", roomId: "123", available: true };
  const imageUrl = "https://example.invalid/heart.webp";
  f.context.rememberRoomGifts([{ id: "157842", name: "Shenazen Pulse", cost: 1, imageUrl }], room);
  f.context.rememberRoomGifts([{ id: "5655", name: "Rose", cost: 1, imageUrl: "https://example.invalid/rose.webp" }], room);
  assert.equal(f.context.giftForIdentity("Shenazen Pulse", "157842").imageUrl, imageUrl);
  assert.equal(f.context.giftForIdentity("Cœur sur moi", "7934").imageUrl, identity.COMMUNITY_HEART_IMAGE_URL);
  assert.equal(f.context.giftForIdentity("Rose", "5655").id, "5655");
  assert.equal(f.context.GIFT_CATALOG.length, 1);
});

test("the true Heart Me remains the fixed red heart despite room skins, legacy aliases and creator changes", () => {
  const f = renderer(), room = { username: "creator", roomId: "123", available: true };
  f.context.rememberRoomGifts([{ id: "7934", name: "Envoie-moi un cœur", cost: 1,
    imageUrl: "https://example.invalid/composed.blue.webp", alternateIds: ["157842", "17712", "heart-me"] }], room);
  for (const id of ["7934", "heart-me"]) {
    const gift = f.context.giftForIdentity("Envoie-moi un cœur", id);
    assert.equal(gift.name, "Cœur sur moi"); assert.equal(gift.imageUrl, identity.COMMUNITY_HEART_IMAGE_URL);
    assert.ok(!(gift.alternateIds || []).some((alias) => alias === "157842" || alias === "17712"));
  }
  f.state.settings.tiktok.username = "other";
  assert.equal(f.context.giftForIdentity("Cœur sur moi", "7934").imageUrl, identity.COMMUNITY_HEART_IMAGE_URL);
});

test("an accepted real gift updates only current room metadata without emitting viewer data or fabricating availability", async () => {
  const f = stateFixture(), messages = [];
  const catalog = new GiftCatalog(path.join(__dirname, "../resources"), { fileNames: [] });
  catalog.setRoomScope("creator", { roomId: "123" });
  const core = { store: f.store, giftCatalog: catalog, followSessionGuard: { accept: () => true },
    viewerService: { recordEvent() {}, isBlocked: () => false }, overlayServer: { publishEvent() {} },
    notifyRenderer: (channel, payload) => messages.push({ channel, payload }), ruleEngine: { process: async () => {} },
    overlayCompletionController: { handleLikeGoalChange: async () => {} } };
  const hooks = { recordEvent: () => ({}), handleCommand: async () => {}, handleWheelGiftTriggers: async () => {}, changed() {} };
  await ingestCreatorEvent(core, hooks, { source: "source_tiktok", type: "gift", user: { id: "private-viewer", name: "private-name" },
    data: { giftId: "157842", giftName: "Shenazen Pulse", giftImageUrl: "https://example.invalid/personal.webp", value: 1,
      raw: { roomId: "123", channelUsername: "creator", giftRecipientIds: ["9001"] } } });
  const result = messages.find((row) => row.channel === "gift-room-catalog-updated");
  assert.ok(result); assert.equal(result.payload.room.available, false); assert.equal(result.payload.room.partial, true);
  assert.equal(result.payload.roomGifts[0].imageUrl, "https://example.invalid/personal.webp");
  assert.doesNotMatch(JSON.stringify(result), /private-viewer|private-name/);
});

test("gift updates are explicitly allowed through preload and scoped to authenticated renderers", () => {
  for (const relative of ["src/main/preload.js", "src/main/account-access.js"]) {
    const source = fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
    assert.ok(source.includes('"gift-catalog-updated"')); assert.ok(source.includes('"gift-room-catalog-updated"'));
  }
});
