"use strict";

const {
  readOverlayRuntimeSource,
  readOverlayStyles,
  readRendererSource,
  readRendererStyles
} = require("./helpers/source-bundles");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  hasGameAccess
} = require("../src/main/game-access");

const root = path.resolve(__dirname, "..");
const paidGame = { id: "paid", accessMode: "purchase" };

function state(status) {
  return {
    commerce: {
      subscription: {
        tier: "pro",
        source: "own",
        status: "active"
      },
      gameEntitlements: [{
        gameId: "paid",
        source: "purchase",
        status
      }]
    }
  };
}

test("un paiement de jeu en attente ou annulé ne déverrouille rien", () => {
  for (const status of [
    "approval_pending",
    "cancelled",
    "canceled",
    "failed",
    "pending",
    "refunded",
    "revoked"
  ]) {
    assert.equal(
      hasGameAccess(state(status), paidGame),
      false,
      `le droit ${status} ne doit pas déverrouiller le jeu`
    );
  }
  assert.equal(hasGameAccess(state("captured"), paidGame), true);
});

test("le thème classique retire complètement l'ancien cadre de classement", () => {
  const overlayRuntime = readOverlayRuntimeSource();
  const overlayCss = readOverlayStyles();
  assert.match(
    overlayRuntime,
    /if \(!path\) \{\s*element\.hidden = true;\s*element\.removeAttribute\("src"\);/
  );
  assert.match(
    overlayCss,
    /\.theme-frame\[hidden\]\s*\{\s*display:\s*none !important;/
  );
});

test("les journaux masquent aussi l'ancien bruit TikTok hors LIVE", () => {
  const renderer = readRendererSource();
  assert.match(
    renderer,
    /function visibleActivityEntries\(state = \{\}\)[\s\S]*\["connection", "tiktok"\]\.includes\(category\)[\s\S]*seenOfflineErrors/
  );
  assert.match(
    renderer,
    /const recent = visibleActivityEntries\(state\)\.slice\(0, 6\);/
  );
  assert.match(
    renderer,
    /const entries = visibleActivityEntries\(snapshot\.state\);/
  );
});
