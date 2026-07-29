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

function createStore(email) {
  const state = createDefaultState();
  state.settings.account.email = email;
  return {
    getState: () => structuredClone(state),
    mutate: (callback) => callback(state),
    state
  };
}

test("un essai Pro avec jeux déverrouille les jeux sans achat séparé", () => {
  const now = Date.parse("2026-07-27T10:00:00.000Z");
  const store = createStore("viewer@example.com");
  const changed = applyTrialGrant(store, {
    id: "trial_games",
    email: "Viewer@Example.com",
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

test("les droits offerts sont appliqués uniquement à l’adresse e-mail bénéficiaire", () => {
  const now = Date.parse("2026-07-27T10:00:00.000Z");
  const store = createStore("owner@example.com");
  applyTrialGrant(store, {
    id: "trial_recipient",
    email: "recipient@example.com",
    subscriptionTrial: true,
    gameTrialIds: ["coin-pusher"],
    expiresAtMs: now + 86_400_000
  }, now);

  assert.equal(store.state.commerce.subscription.tier, "free");
  assert.equal(store.state.commerce.trial.cachedGrants.length, 1);

  store.state.settings.account.email = "recipient@example.com";
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
  const store = createStore("viewer@example.com");
  store.state.commerce.gameEntitlements = ["permanent-game"];
  applyTrialGrant(store, {
    id: "trial_remove",
    email: "viewer@example.com",
    subscriptionTrial: true,
    gameTrialIds: ["temporary-game"],
    expiresAtMs: now + 86_400_000
  }, now);

  applyTrialRevocation(store, { trialId: "trial_remove" }, now);

  assert.equal(store.state.commerce.subscription.tier, "free");
  assert.deepEqual(store.state.commerce.gameEntitlements, ["permanent-game"]);
  assert.equal(store.state.commerce.trial.active, false);
});
