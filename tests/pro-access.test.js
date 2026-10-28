"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const pro = require("../src/shared/pro-access");
const game = require("../src/main/game-access");
const scene = require("../resources/overlays/scene-layout");
const state = (subscription) => ({ commerce: { subscription } });
const now = Date.parse("2026-10-14T12:00:00Z");

test("le même contrat Pro est disponible dans Node et dans le navigateur", () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/shared/pro-access.js"), "utf8"), context);
  assert.equal(typeof context.ShenPulseProAccess.hasProAccess, "function");
  assert.equal(context.ShenPulseProAccess.hasProAccess(state({ tier: "pro", status: "active" }), now), true);
  assert.equal(game.hasActiveGameSubscription, pro.hasProAccess);
  assert.equal(game.commerceExpiryMs, pro.commerceExpiryMs);
  assert.equal(Object.isFrozen(pro), true);
  assert.equal(Object.isFrozen(pro.PRO_SECTIONS), true);
  assert.deepEqual(pro.PRO_SECTIONS, ["games", "irl", "commands", "matches"]);
  for (const id of pro.PRO_SECTIONS) assert.equal(pro.requiresProSection(id), true);
  for (const id of [undefined, "admin", "music", "overlays", "users"]) assert.equal(pro.requiresProSection(id), false);
});

test("Pro et Premium actifs ou payés, essais valides et places offertes restent compatibles", () => {
  for (const tier of ["pro", "premium"]) {
    for (const status of ["active", "paid"]) {
      for (const source of ["own", "premiumSeat", "subscription"]) {
        const snapshot = state({ tier, status, source });
        assert.equal(pro.hasProAccess(snapshot, now), true);
        assert.equal(scene.activeProAccess(snapshot, now), true);
      }
    }
    for (const status of ["active", "trial"]) {
      assert.equal(pro.hasProAccess(state({ tier, status, source: "trial", expiresAtMs: now + 1 }), now), true);
      assert.equal(pro.hasProAccess(state({ tier, status, source: "trial", expiresAt: new Date(now + 1000).toISOString() }), now), true);
    }
  }
});

test("la fin d'essai, un paiement en attente et les statuts révoqués n'ouvrent aucune fonction Pro", () => {
  for (const tier of ["free", "inconnu", ""]) assert.equal(pro.hasProAccess(state({ tier, status: "active" }), now), false);
  for (const status of ["approval_pending", "cancelled", "expired", "free", "revoked", "suspended", ""]) {
    assert.equal(pro.hasProAccess(state({ tier: "pro", status }), now), false);
    assert.equal(scene.activeProAccess(state({ tier: "pro", status }), now), false);
  }
  for (const expiresAtMs of [0, now - 1, now]) {
    const snapshot = state({ tier: "premium", status: "active", source: "trial", expiresAtMs });
    assert.equal(pro.hasProAccess(snapshot, now), false);
    assert.equal(game.hasActiveGameSubscription(snapshot, now), false);
    assert.equal(scene.activeProAccess(snapshot, now), false);
  }
  assert.equal(pro.hasProAccess(state({ tier: "pro", status: "trial", expiresAtMs: now + 1 }), now), true);
  assert.equal(pro.hasProAccess(), false);
});

test("les échéances historiques utilisent renewalDate sans fabriquer de date valide", () => {
  assert.equal(pro.commerceExpiryMs({ renewalDate: "2026-10-14T12:00:00Z" }), now);
  assert.equal(pro.commerceExpiryMs({ expiresAtMs: now + 1, expiresAt: "invalide" }), now + 1);
  assert.equal(pro.commerceExpiryMs({ expiresAt: "invalide" }), 0);
  assert.equal(pro.commerceExpiryMs(), 0);
});

test("Machines IRL exige Premium et les autres rubriques restent accessibles en Pro",()=>{
 assert.equal(pro.requiredSectionTier('irl'),'premium');
 for(const id of ['games','commands','matches'])assert.equal(pro.requiredSectionTier(id),'pro');
 for(const source of ['own','premiumSeat','agencyReward','trial']){
  const snapshot=state({tier:'pro',status:'active',source,expiresAtMs:now+1000});
  assert.equal(pro.hasSectionAccess(snapshot,'irl',now),false,source);
  assert.equal(pro.hasPremiumAccess(snapshot,now),false,source);
  assert.equal(pro.hasSectionAccess(snapshot,'games',now),true,source);
 }
 for(const status of ['active','paid'])assert.equal(pro.hasSectionAccess(state({tier:'premium',status}),'irl',now),true);
 for(const status of ['free','cancelled','approval_pending','expired'])assert.equal(pro.hasPremiumAccess(state({tier:'premium',status}),now),false);
 assert.equal(pro.hasPremiumAccess(state({tier:'premium',status:'trial',expiresAtMs:now+1}),now),true);
 assert.equal(pro.hasPremiumAccess(state({tier:'premium',status:'trial',expiresAtMs:now}),now),false);
});
