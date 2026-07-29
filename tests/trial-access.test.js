"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createDefaultState } = require("../src/main/defaults");
const {
  activeGameEntitlement,
  applyTrialGrant,
  applyTrialRevocation,
  reconcileTrialAccess
} = require("../src/main/trial-access");

function createStore(username) {
  const state = createDefaultState();
  state.settings.tiktok.username = username;
  return {
    getState: () => structuredClone(state),
    mutate: (callback) => callback(state),
    state
  };
}

test("un essai Pro avec jeux déverrouille les jeux sans achat séparé", () => {
  const now = Date.parse("2026-07-27T10:00:00.000Z");
  const store = createStore("viewer");
  const changed = applyTrialGrant(store, {
    id: "trial_games",
    username: "@Viewer",
    subscriptionTrial: true,
    gameTrialIds: ["gta-v-mont-chiliad", "connect-four"],
    expiresAtMs: now + 86_400_000
  }, now);

  assert.equal(changed, true);
  assert.equal(store.state.commerce.subscription.tier, "pro");
  assert.equal(store.state.commerce.subscription.source, "trial");
  assert.deepEqual(
    store.state.commerce.trial.gameIds,
    ["gta-v-mont-chiliad", "connect-four"]
  );
  const entitlement = store.state.commerce.gameEntitlements.find(
    (entry) => entry.gameId === "gta-v-mont-chiliad"
  );
  assert.equal(
    activeGameEntitlement(entitlement, "gta-v-mont-chiliad", now),
    true
  );
  assert.equal(
    activeGameEntitlement(entitlement, "gta-v-mont-chiliad", now + 86_400_001),
    false
  );
});

test("les droits offerts sont réappliqués quand le compte TikTok change", () => {
  const now = Date.parse("2026-07-27T10:00:00.000Z");
  const store = createStore("owner");
  applyTrialGrant(store, {
    id: "trial_recipient",
    username: "recipient",
    subscriptionTrial: true,
    gameTrialIds: ["coin-pusher"],
    expiresAtMs: now + 86_400_000
  }, now);

  assert.equal(store.state.commerce.subscription.tier, "free");
  assert.equal(store.state.commerce.trial.cachedGrants.length, 1);

  store.state.settings.tiktok.username = "@recipient";
  reconcileTrialAccess(
    store.state,
    store.state.commerce.trial.cachedGrants,
    now
  );

  assert.equal(store.state.commerce.subscription.tier, "pro");
  assert.deepEqual(store.state.commerce.trial.gameIds, ["coin-pusher"]);
});

test("la révocation retire seulement les droits temporaires", () => {
  const now = Date.parse("2026-07-27T10:00:00.000Z");
  const store = createStore("viewer");
  store.state.commerce.gameEntitlements = ["permanent-game"];
  applyTrialGrant(store, {
    id: "trial_remove",
    username: "viewer",
    subscriptionTrial: true,
    gameTrialIds: ["temporary-game"],
    expiresAtMs: now + 86_400_000
  }, now);

  applyTrialRevocation(store, { trialId: "trial_remove" }, now);

  assert.equal(store.state.commerce.subscription.tier, "free");
  assert.deepEqual(store.state.commerce.gameEntitlements, ["permanent-game"]);
  assert.equal(store.state.commerce.trial.active, false);
});
