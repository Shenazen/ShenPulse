"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { COMMUNITY_HEART_IMAGE_URL } = require("../src/shared/gift-identity");
const { GIFT_IDENTITY_CORRECTION_REASON, collectGiftReferenceUpdates, applyGiftReferenceUpdates } = require("../src/main/state/gift-upgrade-migration");

const customImage = "https://example.invalid/verified-custom-gift.webp";
const catalog = [
  { id: "7934", alternateIds: ["heart-me"], name: "Cœur sur moi", cost: 1,
    giftFamily: "community-heart", imageUrl: COMMUNITY_HEART_IMAGE_URL },
  { id: "157842", name: "Shenazen Pulse", cost: 1, imageUrl: customImage },
  { id: "6267", name: "Corgi", cost: 299, imageUrl: "https://example.invalid/corgi.webp" }
];
const clone = (value) => JSON.parse(JSON.stringify(value));
function oldCustom(overrides = {}) {
  return { field: "data.giftName", operator: "equals", value: "Cœur sur moi", giftId: "157842",
    giftIds: ["7934", "17712", "heart-me", "62816", "601333", "community-heart", "custom-legacy"],
    giftFamily: "community-heart", giftCost: 17, giftImageUrl: "https://example.invalid/wrong-heart.webp", ...overrides };
}
function stateFor(condition) {
  return { rules: [{ id: "configured", name: "My custom sound title", enabled: false,
    conditions: [condition, { field: "data.value", operator: "gte", value: 30 }],
    cooldown: { globalMs: 12000, perUserMs: 4000 },
    actions: [{ id: "sound", type: "audio.play", config: { volume: 43, url: "https://example.invalid/my-sound.mp3" } }],
    actionSelection: { mode: "random", randomCount: 1 } }] };
}

test("known custom gift correction is planned before backup and changes only gift metadata", () => {
  const state = stateFor(oldCustom()), before = clone(state);
  const updates = collectGiftReferenceUpdates(state, catalog);
  assert.deepEqual(state, before, "collector must not mutate references before the new backup");
  assert.ok(updates.length > 0);
  assert.ok(updates.every((update) => update.reason === GIFT_IDENTITY_CORRECTION_REASON));
  applyGiftReferenceUpdates(updates);
  const condition = state.rules[0].conditions[0];
  assert.equal(condition.giftId, "157842");
  assert.equal(condition.value, "Shenazen Pulse");
  assert.equal(condition.giftFamily, "");
  assert.deepEqual(condition.giftIds, ["custom-legacy"]);
  assert.equal(condition.giftImageUrl, customImage);
  assert.equal(condition.giftCost, 17);
  assert.deepEqual(state.rules[0].actions, before.rules[0].actions);
  assert.deepEqual(state.rules[0].cooldown, before.rules[0].cooldown);
  assert.deepEqual(state.rules[0].actionSelection, before.rules[0].actionSelection);
  assert.equal(state.rules[0].name, before.rules[0].name);
  assert.equal(state.rules[0].enabled, false);
  assert.deepEqual(state.rules[0].conditions[1], before.rules[0].conditions[1]);
  assert.equal(collectGiftReferenceUpdates(state, catalog).length, 0);
});

test("known custom ID needs the false-family or legacy-label plus heart-alias signature", () => {
  const clean = oldCustom({ value: "My user label", giftFamily: "", giftIds: ["custom-legacy"], giftImageUrl: customImage });
  const familyOnly = oldCustom({ value: "Other stale title", giftIds: [] });
  const aliasesOnly = oldCustom({ giftFamily: "", giftIds: ["7934"] });
  const state = { rules: [{ conditions: [clone(clean), familyOnly, aliasesOnly] }] };
  applyGiftReferenceUpdates(collectGiftReferenceUpdates(state, catalog));
  assert.deepEqual(state.rules[0].conditions[0], clean);
  for (const condition of state.rules[0].conditions.slice(1)) {
    assert.equal(condition.giftId, "157842");
    assert.equal(condition.value, "Shenazen Pulse");
    assert.deepEqual(condition.giftIds, []);
  }
});

test("true heart legacy families lose false custom and retired aliases but keep their primary IDs", () => {
  const conditions = ["7934", "heart-me"].map((giftId) => oldCustom({ giftId,
    giftIds: ["157842", "17712", "62816", "601333", "unknown-custom", "7934", "heart-me"] }));
  const state = { rules: [{ conditions }] };
  applyGiftReferenceUpdates(collectGiftReferenceUpdates(state, catalog));
  conditions.forEach((condition, index) => {
    assert.equal(condition.giftId, ["7934", "heart-me"][index]);
    assert.deepEqual(condition.giftIds, [index === 0 ? "heart-me" : "7934"]);
    assert.equal(condition.giftImageUrl, COMMUNITY_HEART_IMAGE_URL);
    assert.equal(condition.giftCost, 17);
  });
  assert.equal(collectGiftReferenceUpdates(state, catalog).length, 0);
});

test("retired merged representative remaps only with a legacy-heart signature or explicit verified alias", () => {
  const legacy = oldCustom({ giftId: "17712", giftIds: [] });
  const aliasProof = oldCustom({ giftId: "17712", value: "Creator's saved label", giftFamily: "", giftIds: ["7934", "157842"] });
  const unproven = oldCustom({ giftId: "17712", value: "Cœur de la communauté", giftFamily: "", giftIds: [], giftImageUrl: "keep.webp" });
  const state = { rules: [{ conditions: [legacy, aliasProof, clone(unproven)] }] };
  applyGiftReferenceUpdates(collectGiftReferenceUpdates(state, catalog));
  for (const condition of [legacy, aliasProof]) {
    assert.equal(condition.giftId, "7934");
    assert.deepEqual(condition.giftIds, ["heart-me"]);
    assert.equal(condition.giftFamily, "community-heart");
    assert.equal(condition.giftImageUrl, COMMUNITY_HEART_IMAGE_URL);
    assert.equal(condition.giftCost, 17);
  }
  assert.equal(legacy.value, "Cœur sur moi");
  assert.equal(aliasProof.value, "Creator's saved label", "an arbitrary creator label is not a legacy name");
  assert.deepEqual(state.rules[0].conditions[2], unproven);
});

test("integrated gift fields and wheel trigger names are corrected without touching effects or history", () => {
  const broken = { giftId: "157842", giftIds: ["7934"], giftFamily: "community-heart", name: "Cœur sur moi",
    image: "wrong.webp", cost: 99, seconds: 8, enabled: false, coinCount: 29 };
  const state = { game: { connectorOverrides: { fixture: { guardGift: clone(broken),
    giftId: "157842", giftFamily: "community-heart", giftName: "Cœur sur moi", giftImage: "wrong.webp", giftValue: 21,
    queue: [clone(broken)], activePlayers: [clone(broken)] } } },
  overlayConfigs: { wheel: { wheels: [
    { trigger: "Cœur sur moi", triggerGift: { giftId: "157842", giftFamily: "community-heart", giftCost: 55 },
      segments: [{ label: "Keep effect", actionId: "saved-action" }] },
    { trigger: "Cœur sur moi", giftValueFilter: { operator: "gte", value: 3 }, triggerGift: clone(broken) }
  ] } } };
  const before = clone(state);
  applyGiftReferenceUpdates(collectGiftReferenceUpdates(state, catalog));
  const config = state.game.connectorOverrides.fixture;
  assert.equal(config.guardGift.name, "Shenazen Pulse");
  assert.equal(config.guardGift.image, customImage);
  assert.equal(config.guardGift.cost, 99);
  assert.equal(config.guardGift.seconds, 8);
  assert.equal(config.guardGift.coinCount, 29);
  assert.equal(config.guardGift.enabled, false);
  assert.equal(config.giftName, "Shenazen Pulse");
  assert.equal(config.giftImage, customImage);
  assert.equal(config.giftValue, 21);
  assert.deepEqual(config.queue, before.game.connectorOverrides.fixture.queue);
  assert.deepEqual(config.activePlayers, before.game.connectorOverrides.fixture.activePlayers);
  assert.equal(state.overlayConfigs.wheel.wheels[0].trigger, "Shenazen Pulse");
  assert.equal(state.overlayConfigs.wheel.wheels[0].triggerGift.giftCost, 55);
  assert.deepEqual(state.overlayConfigs.wheel.wheels[0].segments, before.overlayConfigs.wheel.wheels[0].segments);
  assert.deepEqual(state.overlayConfigs.wheel.wheels[1], before.overlayConfigs.wheel.wheels[1]);
  assert.equal(collectGiftReferenceUpdates(state, catalog).length, 0);
});

test("all saved workspaces are repaired in place without crossing account boundaries", () => {
  const state = { ...stateFor(oldCustom()), activeAccountUid: "account-a", settings: { account: { uid: "account-a" } },
    profiles: [{ id: "profile-a", workspace: stateFor(oldCustom({ giftCost: 51 })) }],
    accountWorkspaces: { a: { ownerUid: "account-a", ...stateFor(oldCustom({ giftCost: 61 })) },
      b: { ownerUid: "account-b", ...stateFor(oldCustom({ giftCost: 71 })), profiles: [
        { id: "profile-b", workspace: stateFor(oldCustom({ giftCost: 81 })) }] } },
    unclaimedAccountWorkspace: { ownerUid: "", ...stateFor(oldCustom({ giftCost: 91 })) } };
  applyGiftReferenceUpdates(collectGiftReferenceUpdates(state, catalog));
  const spaces = [state, state.profiles[0].workspace, state.accountWorkspaces.a, state.accountWorkspaces.b,
    state.accountWorkspaces.b.profiles[0].workspace, state.unclaimedAccountWorkspace];
  assert.deepEqual(spaces.map((space) => space.rules[0].conditions[0].giftCost), [17, 51, 61, 71, 81, 91]);
  assert.ok(spaces.every((space) => space.rules[0].conditions[0].value === "Shenazen Pulse"));
  assert.equal(state.activeAccountUid, "account-a");
  assert.equal(state.settings.account.uid, "account-a");
  assert.equal(state.accountWorkspaces.a.ownerUid, "account-a");
  assert.equal(state.accountWorkspaces.b.ownerUid, "account-b");
  assert.equal(state.unclaimedAccountWorkspace.ownerUid, "");
});

test("unknown IDs, unrelated gifts and unverified old catalogues never authorize identity rewrites", () => {
  const unknown = oldCustom({ giftId: "unknown-creator", giftIds: ["unknown-alias"] });
  const ordinary = oldCustom({ giftId: "6267", giftIds: [], giftImageUrl: catalog[2].imageUrl, value: "Corgi" });
  const state = { rules: [{ conditions: [clone(unknown), clone(ordinary)] }] };
  assert.equal(collectGiftReferenceUpdates(state, catalog).length, 0);
  assert.deepEqual(state.rules[0].conditions, [unknown, ordinary]);
  const oldMergedCatalog = [{ ...catalog[0], id: "17712", alternateIds: ["7934", "heart-me", "157842"] }];
  const oldState = stateFor(oldCustom());
  const updates = collectGiftReferenceUpdates(oldState, oldMergedCatalog);
  assert.ok(updates.every((update) => update.reason !== GIFT_IDENTITY_CORRECTION_REASON));
  applyGiftReferenceUpdates(updates);
  assert.equal(oldState.rules[0].conditions[0].giftId, "157842");
  assert.equal(oldState.rules[0].conditions[0].value, "Cœur sur moi");
});

test("explicit variant-only operations do not run this separate automatic correction", () => {
  const state = stateFor(oldCustom());
  assert.equal(collectGiftReferenceUpdates(state, catalog, { onlyConfirmed: true }).length, 0);
  assert.equal(state.rules[0].conditions[0].value, "Cœur sur moi");
});
