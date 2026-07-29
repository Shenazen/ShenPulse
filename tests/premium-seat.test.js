"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createDefaultState } = require("../src/main/defaults");
const {
  applyVerifiedPremiumSeat,
  hasActivePaidPremium
} = require("../src/main/premium-seat");

test("normalise l’adresse e-mail du bénéficiaire Premium", () => {
  const state = createDefaultState();
  state.settings.account.email = "owner@example.com";
  state.commerce.subscription = {
    tier: "premium",
    source: "own",
    status: "active"
  };
  const seat = applyVerifiedPremiumSeat(
    state,
    { beneficiaryEmail: "  Beneficiaire@Example.COM " },
    new Date("2026-07-29T08:00:00.000Z")
  );
  assert.equal(seat.beneficiaryEmail, "beneficiaire@example.com");
});

test("réserve l’accès offert aux achats Premium actifs", () => {
  assert.equal(
    hasActivePaidPremium({
      tier: "premium",
      source: "own",
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
      source: "own",
      status: "active"
    }),
    false
  );
});

test("enregistre le bénéficiaire comme un espace Pro offert", () => {
  const state = createDefaultState();
  state.settings.account.email = "proprietaire@example.com";
  state.commerce.subscription = {
    tier: "premium",
    source: "own",
    status: "active",
    priceMonthly: 13.99
  };

  const seat = applyVerifiedPremiumSeat(
    state,
    { beneficiaryEmail: "beneficiaire@example.com" },
    new Date("2026-07-29T08:00:00.000Z")
  );

  assert.deepEqual(seat, {
    beneficiaryEmail: "beneficiaire@example.com",
    beneficiaryEmails: ["beneficiaire@example.com"],
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
    () =>
      applyVerifiedPremiumSeat(state, {
        beneficiaryEmail: "beneficiaire@example.com"
      }),
    /Premium payé et actif/
  );
});
