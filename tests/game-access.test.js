"use strict";

const {
  readOverlayRuntimeSource,
  readOverlayStyles,
  readRendererSource,
  readRendererStyles
} = require("./helpers/source-bundles");

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  assertGameAccess,
  hasActiveGameSubscription,
  hasGameAccess,
  hasGameEntitlement
} = require("../src/main/game-access");

const root = path.join(__dirname, "..");
const includedGame = { id: "included", accessMode: "included" };
const paidGame = { id: "paid", accessMode: "purchase" };

function state({
  tier = "free",
  source = tier === "free" ? "free" : "subscription",
  status = tier === "free" ? "free" : "active",
  expiresAtMs = 0,
  gameEntitlements = []
} = {}) {
  return {
    commerce: {
      subscription: { tier, source, status, expiresAtMs },
      gameEntitlements
    }
  };
}

test("un palier payant sans statut actif reste verrouillé", () => {
  for (const status of [
    "approval_pending",
    "cancelled",
    "expired",
    "free",
    "revoked",
    "suspended"
  ]) {
    assert.equal(
      hasGameAccess(state({ tier: "pro", status }), includedGame),
      false,
      `le statut ${status} ne doit pas ouvrir les jeux`
    );
  }
  assert.equal(
    hasGameAccess(state({ tier: "premium", status: "paid" }), includedGame),
    true
  );
});

test("la galerie gratuite ne donne accès à aucun jeu", () => {
  const freeState = state();
  assert.equal(hasGameEntitlement(freeState, includedGame), true);
  assert.equal(hasActiveGameSubscription(freeState), false);
  assert.equal(hasGameAccess(freeState, includedGame), false);
  assert.throws(
    () => assertGameAccess(freeState, includedGame),
    /abonnement ShenPulse Pro ou Premium actif/
  );
});

test("un abonnement actif ouvre les jeux inclus", () => {
  assert.equal(
    hasGameAccess(state({ tier: "pro" }), includedGame),
    true
  );
  assert.equal(
    hasGameAccess(state({ tier: "premium" }), includedGame),
    true
  );
});

test("un jeu vendu séparément exige abonnement et droit produit", () => {
  const purchased = ["paid"];
  assert.equal(
    hasGameAccess(state({ gameEntitlements: purchased }), paidGame),
    false
  );
  assert.equal(
    hasGameAccess(state({ tier: "pro" }), paidGame),
    false
  );
  assert.equal(
    hasGameAccess(
      state({ tier: "pro", gameEntitlements: purchased }),
      paidGame
    ),
    true
  );
});

test("les essais expirés sont refusés et les essais actifs acceptés", () => {
  const nowMs = Date.parse("2026-07-28T12:00:00.000Z");
  assert.equal(
    hasGameAccess(
      state({
        tier: "pro",
        source: "trial",
        status: "active",
        expiresAtMs: nowMs + 60_000
      }),
      includedGame,
      nowMs
    ),
    true
  );
  assert.equal(
    hasGameAccess(
      state({
        tier: "pro",
        source: "trial",
        status: "active",
        expiresAtMs: nowMs - 1
      }),
      includedGame,
      nowMs
    ),
    false
  );
  assert.equal(
    hasGameAccess(
      state({
        tier: "pro",
        gameEntitlements: [{
          gameId: "paid",
          source: "trial",
          status: "active",
          expiresAtMs: nowMs - 1
        }]
      }),
      paidGame,
      nowMs
    ),
    false
  );
});

test("le renderer et les IPC appliquent le verrou avant d’entrer", () => {
  const renderer = readRendererSource();
  const ipc = fs.readFileSync(
    path.join(root, "src", "main", "ipc.js"),
    "utf8"
  );
  const core = fs.readFileSync(
    path.join(root, "src", "main", "core.js"),
    "utf8"
  );
  const hub = fs.readFileSync(
    path.join(root, "src", "main", "game-hub.js"),
    "utf8"
  );
  const runtime = fs.readFileSync(
    path.join(root, "src", "main", "game-runtime.js"),
    "utf8"
  );
  const preload = fs.readFileSync(
    path.join(root, "src", "main", "preload.js"),
    "utf8"
  );

  assert.match(
    renderer,
    /function isGameUnlocked\(pack\) \{\s*return hasProAccess\(\) && hasGameEntitlement\(pack\);/
  );
  assert.match(
    renderer,
    /if \(action === "open-game"\)[\s\S]*?pack\.accessMode === "purchase"[\s\S]*?!hasGameEntitlement\(pack\)[\s\S]*?openGamePurchaseDialog\(pack\)[\s\S]*?if \(!requireGameAccess\(pack\)\) return;/
  );
  assert.match(renderer, /Le catalogue reste accessible/);
  assert.match(renderer, /Acheter le jeu/);
  assert.match(renderer, /function openGamePurchaseDialog\(pack\)/);
  assert.match(renderer, /api\.account\.startGameCheckout/);
  assert.doesNotMatch(
    renderer,
    /class="tile-action-button"[^>]*aria-disabled/
  );
  assert.match(ipc, /const requireGameAccess = \(packId\) =>/);
  assert.match(ipc, /handle\("game:install"[\s\S]*?requireGameAccess\(targetId\);/);
  assert.match(ipc, /handle\("game:launch"[\s\S]*?requireGameAccess\(targetId\);/);
  assert.match(core, /startGameSession\(packId\)[\s\S]*?this\.gameHub\.assertAccess\(targetId\);/);
  assert.match(hub, /async trigger\(effectId[\s\S]*?this\.assertAccess\(packId\);/);
  assert.match(runtime, /status\(gameId\) \{\s*this\.assertAccess\(gameId\);/);
  assert.match(runtime, /async install\(gameId\) \{\s*this\.assertAccess\(gameId\);/);
  assert.match(runtime, /async launch\(gameId\) \{\s*this\.assertAccess\(gameId\);/);
  assert.match(preload, /auditGameInteraction:/);
  assert.match(ipc, /handle\(\s*"game:interaction-audit"/);
  assert.match(ipc, /Math\.min\(\s*360000/);
  assert.match(ipc, /Oui, c’est correct/);
  assert.match(ipc, /Non, il faut réparer/);
});
