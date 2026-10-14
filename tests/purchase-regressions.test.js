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
const vm = require("node:vm");
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
  const activity = [
    { category: "tiktok", level: "info", title: "Recherche TikTok" },
    { category: "connection", level: "warning", title: "Reconnexion bruyante" },
    { category: "tiktok", level: "error", title: "Vraie erreur", detail: "Connexion refusée" },
    { category: "tiktok", level: "error", title: "Vraie erreur", detail: "Connexion refusée" },
    ...Array.from({ length: 8 }, (_, index) => ({ category: "action", level: "success", title: `Action ${index}`, detail: "Exécutée" }))
  ];
  const context = vm.createContext({
    snapshot: { state: { session: { running: false }, activity } },
    isAccountAuthenticated: () => true,
    escapeHtml: String,
    formatTime: () => "12:00",
    eventIcons: {}
  });
  const features = path.join(root, "src", "renderer", "app", "features");
  vm.runInContext(`${fs.readFileSync(path.join(features, "dashboard.js"), "utf8")}\n${fs.readFileSync(path.join(features, "auxiliary-pages.js"), "utf8")}`, context);
  const entries = context.visibleActivityEntries(context.snapshot.state);
  assert.equal(entries.length, 9);
  const journal = context.renderActivity();
  assert.doesNotMatch(journal, /Recherche TikTok|Reconnexion bruyante/);
  assert.equal((journal.match(/Vraie erreur/g) || []).length, 1);
  assert.match(journal, /Action 7/);
  context.snapshot.state.session.running = true;
  assert.equal(context.visibleActivityEntries(context.snapshot.state).length, activity.length);
});
