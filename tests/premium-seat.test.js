"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createDefaultState } = require("../src/main/defaults");
const {
  assignPremiumSeat,
  cleanTikTokUsername,
  hasActivePaidPremium
} = require("../src/main/premium-seat");

test("nettoie le @ TikTok du bénéficiaire Premium", () => {
  assert.equal(cleanTikTokUsername("  @@Utilisateur.Test !  "), "utilisateur.test");
});

test("réserve l’accès offert aux achats Premium actifs", () => {
  assert.equal(
    hasActivePaidPremium({
      tier: "premium",
      source: "account",
      status: "active"
    }),
    true
  );
  assert.equal(
    hasActivePaidPremium({
      tier: "premium",
      source: "trial",
      status: "active"
    }),
    false
  );
  assert.equal(
    hasActivePaidPremium({
      tier: "pro",
      source: "account",
      status: "active"
    }),
    false
  );
});

test("enregistre le bénéficiaire comme un espace Pro offert", () => {
  const state = createDefaultState();
  state.settings.tiktok.username = "proprietaire";
  state.commerce.subscription = {
    tier: "premium",
    source: "account",
    status: "active",
    priceMonthly: 13.99
  };

  const seat = assignPremiumSeat(
    state,
    { username: "@Beneficiaire" },
    new Date("2026-07-29T08:00:00.000Z")
  );

  assert.deepEqual(seat, {
    beneficiaryUsername: "beneficiaire",
    grantedAt: "2026-07-29T08:00:00.000Z",
    source: "premium",
    status: "active",
    tier: "pro",
    updatedAt: "2026-07-29T08:00:00.000Z"
  });
});

test("refuse un bénéficiaire sans achat Premium validé", () => {
  const state = createDefaultState();
  assert.throws(
    () => assignPremiumSeat(state, { username: "@beneficiaire" }),
    /Premium payé et actif/
  );
});
