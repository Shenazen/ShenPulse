"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { GiftCatalog, LOCALIZED_GIFT_REFRESH_MS, MAX_ROOM_GIFT_CACHES, dedupeRoomGifts, fetchFrenchTikTokGifts, normalizeGift } = require("../src/main/catalogs/gifts");
const { COMMUNITY_HEART_IMAGE_URL, findCatalogGift } = require("../src/shared/gift-identity");

const resources = path.join(__dirname, "../resources");
const rawGift = (id, name = `Gift ${id}`, image = `${id}.webp`) => ({ id, name, diamond_count: 1,
  image: { uri: `resource/${image}`, url_list: [`https://example.invalid/${image}`] } });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(setImmediate);
const catalog = (fetchLocalizedGifts = async () => []) => new GiftCatalog(resources, { fileNames: [], fetchLocalizedGifts });

test("room catalog is separate and unavailable before any creator response", () => {
  const gifts = catalog();
  assert.deepEqual(gifts.search().room, { username: "", roomId: "", available: false, partial: false, fetchedAt: "", total: 0 });
  assert.deepEqual(gifts.search().roomGifts, []);
  gifts.setRoomScope(" @Creator ", { roomId: "123" });
  assert.equal(gifts.search().room.username, "creator");
  assert.equal(gifts.search().room.roomId, "123");
  assert.equal(gifts.search().room.available, false);
});

test("creator panel has one fixed red heart, preserves separately named creator gifts and omits the pretzel choice", async () => {
  const raw = [rawGift("7934", "Heart Me", "creator-heart.webp"), rawGift("17712", "Community Heart", "creator-heart.webp"),
    { ...rawGift("157842", "Shenazen Pulse", "saliency_seg_creator.webp"), combo: true },
    rawGift("11111", "Same name", "same.webp"), rawGift("22222", "Same name", "same.webp")];
  const original = JSON.stringify(raw);
  const gifts = catalog(async () => raw);
  await gifts.refreshLocalized("creator", { roomId: "123" });
  const result = gifts.search("", 10000);
  assert.equal(result.room.available, true);
  assert.equal(result.room.partial, false);
  assert.equal(result.room.roomId, "123");
  assert.equal(result.roomGifts.length, 4);
  const heart = result.roomGifts.find((row) => row.id === "7934");
  assert.equal(heart.imageUrl, COMMUNITY_HEART_IMAGE_URL); assert.equal(heart.name, "Cœur sur moi");
  const custom = result.roomGifts.find((row) => row.id === "157842");
  assert.equal(custom.name, "Shenazen Pulse"); assert.equal(custom.imageUrl, "https://example.invalid/saliency_seg_creator.webp");
  assert.equal(custom.giftFamily, ""); assert.deepEqual(custom.alternateIds, []);
  assert.equal(result.roomGifts.some((row) => row.id === "17712"), false);
  const historical = findCatalogGift(result.gifts, { id: "17712" });
  assert.equal(historical.selectable, false); assert.equal(historical.name, "Community Heart");
  assert.notEqual(historical, findCatalogGift(result.gifts, { id: "7934" }));
  assert.equal(findCatalogGift(result.gifts, { id: "7934" }).imageUrl, COMMUNITY_HEART_IMAGE_URL);
  assert.notEqual(findCatalogGift(result.gifts, { id: "11111" }), findCatalogGift(result.gifts, { id: "22222" }));
  assert.equal(JSON.stringify(raw), original);
});

test("switching creators immediately replaces availability while retaining historical references and isolated cached art", async () => {
  const calls = [];
  const gifts = catalog(async (username, { roomId }) => { calls.push([username, roomId]);
    return [rawGift("157842", "Shenazen Pulse", `${username}.webp`), rawGift(username === "alice" ? "11111" : "22222")]; });
  await gifts.refreshLocalized("alice", { roomId: "123" });
  gifts.setRoomScope("bob", { roomId: "456" });
  assert.equal(gifts.search().room.available, false);
  assert.deepEqual(gifts.search().roomGifts, []);
  await gifts.refreshLocalized("bob", { roomId: "456" });
  assert.deepEqual(new Set(gifts.search().roomGifts.map((row) => row.id)), new Set(["157842", "22222"]));
  assert.ok(findCatalogGift(gifts.gifts, { id: "11111" }));
  await gifts.refreshLocalized("ALICE", { roomId: "123" });
  assert.equal(calls.length, 2, "only the matching creator/room cache may be reused");
  assert.equal(gifts.search().roomGifts.find((row) => row.id === "157842").imageUrl, "https://example.invalid/alice.webp");
});

test("an in-flight creator A cannot satisfy B or pollute B, history or A's cache after switching", async () => {
  const pendingA = deferred(), pendingB = deferred(), calls = [];
  const gifts = catalog((username) => { calls.push(username); return username === "alice" && calls.filter((name) => name === "alice").length === 1
    ? pendingA.promise : username === "bob" ? pendingB.promise : [rawGift("33333")]; });
  const a = gifts.refreshLocalized("alice", { roomId: "123" });
  const b = gifts.refreshLocalized("bob", { roomId: "456" });
  await flush(); assert.deepEqual(calls, ["alice", "bob"]);
  pendingB.resolve([rawGift("22222")]); await b;
  pendingA.resolve([rawGift("11111")]); await a;
  assert.equal(gifts.search().room.username, "bob");
  assert.deepEqual(gifts.search().roomGifts.map((row) => row.id), ["22222"]);
  assert.equal(findCatalogGift(gifts.gifts, { id: "11111" }), null);
  await gifts.refreshLocalized("alice", { roomId: "123" });
  assert.deepEqual(calls, ["alice", "bob", "alice"], "obsolete A response did not warm a cache");
  assert.deepEqual(gifts.search().roomGifts.map((row) => row.id), ["33333"]);
});

test("same-creator room changes and forced refreshes invalidate older completions", async () => {
  for (const nextRoom of ["123", "456"]) {
    const old = deferred(), fresh = deferred(); let calls = 0;
    const gifts = catalog(() => ++calls === 1 ? old.promise : fresh.promise);
    const first = gifts.refreshLocalized("creator", { roomId: "123" });
    const second = gifts.refreshLocalized("creator", { roomId: nextRoom, force: true });
    await flush(); fresh.resolve([rawGift("22222")]); await second;
    old.resolve([rawGift("11111")]); await first;
    assert.deepEqual(gifts.search().roomGifts.map((row) => row.id), ["22222"]);
    assert.equal(gifts.search().room.roomId, nextRoom);
    assert.equal(findCatalogGift(gifts.gifts, { id: "11111" }), null);
  }
});

test("only the same active room generation shares an in-flight refresh", async () => {
  const pending = deferred(); let calls = 0;
  const gifts = catalog(() => { calls += 1; return pending.promise; });
  const first = gifts.refreshLocalized("creator", { roomId: "123" });
  const second = gifts.refreshLocalized("@CREATOR", { roomId: "123" });
  await flush(); assert.equal(calls, 1);
  pending.resolve([rawGift("11111")]); await Promise.all([first, second]);
  assert.equal(gifts.search().room.available, true);
});

test("failed creator B has no availability from A and empty/rejected responses never damage historical references", async () => {
  let response = [rawGift("11111")];
  const gifts = catalog(async () => response);
  await gifts.refreshLocalized("alice", { roomId: "123" });
  const historical = gifts.gifts; response = [];
  await assert.rejects(gifts.refreshLocalized("bob", { roomId: "456" }), /vide/);
  assert.equal(gifts.gifts, historical);
  assert.equal(gifts.search().room.username, "bob");
  assert.equal(gifts.search().room.available, false);
  assert.deepEqual(gifts.search().roomGifts, []);
  assert.equal(gifts.localizedUsername, "alice");
});

test("clearing creator scope revokes pending publication without modifying history or warming old cache", async () => {
  const pending = deferred(); let calls = 0;
  const gifts = catalog(() => { calls += 1; return calls === 1 ? pending.promise : [rawGift("22222")]; });
  const result = gifts.refreshLocalized("creator", { roomId: "123" });
  gifts.setRoomScope(""); pending.resolve([rawGift("11111")]); await result;
  assert.deepEqual(gifts.search().roomGifts, []);
  assert.deepEqual(gifts.gifts, []);
  await gifts.refreshLocalized("creator", { roomId: "123" });
  assert.equal(calls, 2);
});

test("only verified own-room LIVE gifts seed a partial panel and preserve exact custom artwork", () => {
  const gifts = catalog(); gifts.setRoomScope("creator", { roomId: "123" });
  const event = { giftId: "157842", giftName: "Shenazen Pulse", value: 1, giftImageUrl: "https://example.invalid/live-custom.webp" };
  for (const context of [{}, { username: "creator", roomId: "123" }, { verified: true, username: "rival", roomId: "123" },
    { verified: true, username: "creator", roomId: "456" }]) assert.equal(gifts.acceptRoomLiveGift(event, context), false);
  assert.equal(gifts.acceptRoomLiveGift(event, { verified: true, username: "@CREATOR", roomId: "123" }), true);
  assert.equal(gifts.acceptRoomLiveGift(event, { verified: true, username: "creator", roomId: "123" }), false);
  const result = gifts.search();
  assert.equal(result.room.available, false); assert.equal(result.room.partial, true); assert.equal(result.room.fetchedAt, "");
  assert.equal(result.roomGifts[0].id, "157842"); assert.equal(result.roomGifts[0].name, "Shenazen Pulse");
  assert.equal(result.roomGifts[0].imageUrl, event.giftImageUrl);
  assert.deepEqual(result.roomGifts[0].alternateIds, []);
  assert.deepEqual(result.gifts, [], "room observation does not rewrite the historical identity catalog");
  gifts.setRoomScope("rival", { roomId: "456" }); assert.deepEqual(gifts.search().roomGifts, []);
});

test("LIVE artwork enrichment stays current after a catalog refresh and ID-only updates retain metadata", async () => {
  const gifts = catalog(async () => [rawGift("157842", "Shenazen Pulse", "composed.panel.webp")]);
  await gifts.refreshLocalized("creator", { roomId: "123" });
  const context = { verified: true, username: "creator", roomId: "123" };
  assert.equal(gifts.acceptRoomLiveGift({ giftId: "157842", giftImageUrl: "https://example.invalid/live.webp" }, context), true);
  await gifts.refreshLocalized("creator", { roomId: "123", force: true });
  const gift = gifts.search().roomGifts[0];
  assert.equal(gift.cost, 1); assert.equal(gift.name, "Shenazen Pulse");
  assert.equal(gift.imageUrl, "https://example.invalid/live.webp");
  assert.equal(gifts.search().room.available, true);
});

test("panel snapshots are bounded, searchable copies and creator caches are bounded", async () => {
  const gifts = catalog(async () => [rawGift("11111", "First"), rawGift("22222", "Second")]);
  for (let i = 0; i < MAX_ROOM_GIFT_CACHES + 3; i += 1) await gifts.refreshLocalized(`creator${i}`, { roomId: String(i + 1) });
  assert.equal(gifts.roomCache.size, MAX_ROOM_GIFT_CACHES);
  const result = gifts.search("second", 1);
  assert.equal(result.room.total, 2); assert.equal(result.roomGifts.length, 1); assert.equal(result.roomGifts[0].id, "22222");
  result.roomGifts[0].imageUrl = "https://example.invalid/mutated.webp"; result.roomGifts[0].alternateIds.push("fake");
  assert.equal(gifts.search("second").roomGifts[0].imageUrl, "https://example.invalid/22222.webp");
  assert.deepEqual(gifts.search("second").roomGifts[0].alternateIds, []);
});

test("room deduplication only combines the same exact ID, never a family, name, price or picture", () => {
  const rows = dedupeRoomGifts([rawGift("7934", "Heart Me", "same.webp"), rawGift("157842", "Shenazen Pulse", "same.webp"),
    rawGift("11111", "Same name", "same.webp"), rawGift("22222", "Same name", "same.webp"), rawGift("22222", "Updated", "updated.webp")]);
  assert.equal(rows.length, 4);
  assert.ok(rows.every((row) => row.alternateIds.length === 0));
  assert.equal(rows.find((row) => row.id === "22222").imageUrl, "https://example.invalid/updated.webp");
});

test("same-ID duplicates prefer the creator's composed artwork regardless of response order", () => {
  const composed = { ...rawGift("157842", "Shenazen Pulse", "composed.creator.webp"), is_displayed_on_panel: false };
  const generic = { ...rawGift("157842", "Shenazen Pulse", "generic.webp"), is_displayed_on_panel: true };
  for (const values of [[composed, generic], [generic, composed]]) {
    const [gift] = dedupeRoomGifts(values);
    assert.equal(gift.imageUrl, "https://example.invalid/composed.creator.webp");
    assert.equal(gift.imageUri, "resource/composed.creator.webp");
    assert.equal(gift.id, "157842"); assert.deepEqual(gift.alternateIds, []);
  }
  const visible = { ...rawGift("11111", "Same gift", "visible.webp"), is_displayed_on_panel: true };
  const hidden = { ...rawGift("11111", "Same gift", "hidden.webp"), is_displayed_on_panel: false };
  assert.equal(dedupeRoomGifts([visible, hidden])[0].imageUrl, "https://example.invalid/visible.webp");
});

test("all room/live heart variants stay red, without rewriting names or artwork of separate segmented gifts", () => {
  for (const source of ["catalog", "tiklive", "tiktok-fr", "live", "tiktok-room"]) {
    for (const id of ["7934", "heart-me"]) {
      const gift = normalizeGift({ id, name: "Envoie-moi un cœur", cost: 1, imageUrl: "https://example.invalid/composed.webp", source });
      assert.equal(gift.name, "Cœur sur moi"); assert.equal(gift.imageUrl, COMMUNITY_HEART_IMAGE_URL);
    }
    for (const id of ["157842", "62816", "601333", "999999"]) {
      const gift = normalizeGift({ id, name: "Shenazen Pulse", cost: 1, combo: true,
        imageUri: "resource/saliency_seg_custom.png", imageUrl: "https://example.invalid/blue.webp", source,
        giftFamily: "community-heart" });
      assert.equal(gift.name, "Shenazen Pulse"); assert.equal(gift.imageUrl, "https://example.invalid/blue.webp");
      assert.equal(gift.giftFamily, ""); assert.deepEqual(gift.alternateIds, []);
    }
  }
});

test("recovering a retained personal name removes only known erroneous heart aliases, not independent historical IDs", () => {
  const gift = normalizeGift({ id: "157842", name: "Cœur sur moi", originalName: "Shenazen Pulse", giftFamily: "community-heart",
    alternateIds: ["7934", "heart-me", "17712", "62816", "601333", "verified-independent-alias"],
    alternateNames: ["Heart Me", "Cœur sur moi", "Previous personal name"], cost: 1, imageUrl: "https://example.invalid/blue.webp" });
  assert.equal(gift.id, "157842"); assert.equal(gift.name, "Shenazen Pulse");
  assert.deepEqual(gift.alternateIds, ["verified-independent-alias"]);
  assert.deepEqual(gift.alternateNames, ["Previous personal name"]);
  const refreshed = normalizeGift({ id: "157842", name: "Shenazen Pulse", originalName: "Cœur sur moi", giftFamily: "community-heart" });
  assert.equal(refreshed.originalName, "", "a former automatic heart label is not kept as the creator gift's search alias");
  const noOriginal = normalizeGift({ id: "999999", name: "Cœur sur moi", giftFamily: "community-heart" });
  assert.equal(noOriginal.name, "Cœur sur moi", "do not invent a missing original name");
  assert.equal(noOriginal.giftFamily, "");
  const actual = normalizeGift({ id: "7934", name: "Heart Me", alternateIds: ["heart-me", "17712", "157842", "62816", "601333"] });
  assert.deepEqual(actual.alternateIds, ["heart-me"]);
});

test("availability requires a resolved room and a non-expired creator response", async () => {
  const unresolved = catalog(async () => [rawGift("11111")]);
  await unresolved.refreshLocalized("creator");
  assert.equal(unresolved.getRoomCatalog().room.available, false);
  assert.deepEqual(unresolved.getRoomCatalog().roomGifts, []);
  assert.ok(findCatalogGift(unresolved.gifts, { id: "11111" }), "historical reference recovery remains available");
  const gifts = catalog(async () => [rawGift("11111")]);
  await gifts.refreshLocalized("creator", { roomId: "123" });
  assert.equal(gifts.getRoomCatalog().room.available, true);
  gifts.roomCache.values().next().value.fetchedAtMs = Date.now() - LOCALIZED_GIFT_REFRESH_MS - 1;
  assert.equal(gifts.getRoomCatalog().room.available, false);
  assert.deepEqual(gifts.getRoomCatalog().roomGifts, []);
  assert.equal(gifts.acceptRoomLiveGift(rawGift("22222"), { verified: true, username: "creator", roomId: "123" }), true);
  assert.equal(gifts.getRoomCatalog().room.partial, true);
  assert.deepEqual(gifts.getRoomCatalog().roomGifts.map((row) => row.id), ["22222"]);
});

test("resolved room mismatch rejects before publishing a creator catalog", async () => {
  const gifts = catalog(async () => ({ roomId: "456", gifts: [rawGift("11111")] }));
  await assert.rejects(gifts.refreshLocalized("creator", { roomId: "123" }), /salle/);
  assert.equal(gifts.search().room.available, false); assert.deepEqual(gifts.gifts, []); assert.equal(gifts.roomCache.size, 0);
});

test("public fetch binds the resolved creator room and refuses a stale expected room before fetching gifts", async () => {
  let reads = 0;
  const createConnection = () => ({ clientParams: {}, fetchRoomId: async () => "123",
    async fetchAvailableGifts() { reads += 1; assert.equal(this.clientParams.room_id, "123"); return [rawGift("11111")]; } });
  await assert.rejects(fetchFrenchTikTokGifts("creator", { createConnection, roomId: "456" }), /salle/);
  assert.equal(reads, 0);
  const result = await fetchFrenchTikTokGifts("creator", { createConnection, roomId: "123" });
  assert.equal(result.roomId, "123"); assert.equal(result[0].id, "11111"); assert.equal(Object.keys(result).includes("roomId"), false);
});
