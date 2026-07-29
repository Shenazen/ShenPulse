"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  FEATURE_ITEMS,
  auditVisibility,
  canAccessScope,
  canonicalizeVisibility
} = require("../src/shared/visibility-catalog");

const CURRENT_PAGE_IDS = [
  "dashboard",
  "live",
  "actions",
  "sounds",
  "rules",
  "overlays",
  "games",
  "goals",
  "commands",
  "membership",
  "connections",
  "activity",
  "settings",
  "admin"
];

test("l’inventaire admin reprend exactement les pages déclarées par ShenPulseNew", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  const pagesSource = source.slice(
    source.indexOf("const pages ="),
    source.indexOf("const eventIcons")
  );
  const pageIds = [...pagesSource.matchAll(/\bid:\s*"([^"]+)"/g)].map(
    (match) => match[1]
  );
  assert.deepEqual(pageIds.sort(), [...CURRENT_PAGE_IDS].sort());
  assert.match(source, /navigation:\s*navigationItems/);
  assert.match(source, /actionTypes:\s*Object\.entries\(ACTION_TYPE_LABELS\)/);
  assert.match(source, /overlays:\s*overlayDefinitions\(\)\.map/);
  assert.match(source, /games:\s*\(snapshot\?\.packs \|\| \[\]\)\.map/);
  assert.match(source, /function canAccessPage\(page\)/);
  assert.match(source, /canAccessCatalogItem\("navigation", page\.id\)/);
  assert.match(source, /function canAccessOverlay\(item\)/);
  assert.match(source, /function canAccessGame\(pack\)/);
  assert.match(source, /function canAccessActionType\(type\)/);
  assert.match(source, /function visibleNavigationEntries\(\)/);
  assert.match(source, /ensureCurrentPageAccess\(\)/);
  assert.match(source, /api\.admin\.visibility\(\)/);
});

test("les listes de visibilité attendent un vrai changement avant d’enregistrer", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  const actionHandler = source.slice(
    source.indexOf("async function handleAction"),
    source.indexOf('content.addEventListener("input"')
  );
  const changeHandler = source.slice(
    source.indexOf('content.addEventListener("change"'),
    source.indexOf('dialogBody.addEventListener("input"')
  );
  assert.doesNotMatch(actionHandler, /action === "admin-scope"/);
  assert.match(changeHandler, /select\[data-action="admin-scope"\]/);
  assert.match(changeHandler, /saveAdminVisibilityScope/);
});

test("la visibilité s’applique aux contenus et fonctions, pas seulement aux pages", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  assert.match(source, /overlayDefinitions\(\)\.filter\(canAccessOverlay\)/);
  assert.match(source, /function visibleGamePacks\(\)/);
  assert.match(source, /canAccessActionType\(action\.type\)/);
  assert.match(source, /canAccessFeature\("spotify\.playback"\)/);
  assert.ok(FEATURE_ITEMS.some((item) => item.id === "backblaze.media"));
  assert.match(source, /"backblaze\.media"/);
});

test("la migration remplace les identifiants hérités sans perdre leurs portées", () => {
  const catalog = {
    navigation: [
      { id: "dashboard" },
      { id: "live" },
      { id: "overlays" },
      { id: "games" },
      { id: "goals" }
    ],
    features: FEATURE_ITEMS,
    actionTypes: [
      { id: "overlay.alert" },
      { id: "tts.speak" },
      { id: "audio.play" }
    ],
    overlays: [{ id: "coinJar" }, { id: "wheel" }],
    games: [{ id: "connect-four" }]
  };
  const legacy = {
    schemaVersion: 6,
    navigation: {
      lives: { scope: "admin" },
      studio: { scope: "public" },
      "interactive-games": { scope: "public" },
      points: { scope: "hidden" },
      obsolete: { scope: "hidden" }
    },
    setupFeatures: {
      connectorObs: { scope: "admin" }
    },
    maintenanceFeatures: {
      storageSummary: { scope: "hidden" }
    },
    actionTypes: {
      alert: { scope: "admin" },
      sound: { scope: "hidden" },
      tts: { scope: "public" }
    },
    actionTypeOverrides: {
      alert: true,
      sound: false,
      tts: true
    },
    overlays: {
      coinJarTest: { scope: "hidden" },
      wheelActions: { scope: "admin" }
    },
    games: {
      "connect-four": { scope: "public" }
    },
    cheatAccess: {
      "deal-or-no-deal:balancing": {
        entries: [{ email: "owner@example.com", username: "owner" }]
      }
    }
  };

  const migrated = canonicalizeVisibility(legacy, catalog);
  assert.equal(migrated.schemaVersion, 7);
  assert.deepEqual(migrated.navigation.live, { scope: "admin" });
  assert.deepEqual(migrated.navigation.goals, { scope: "hidden" });
  assert.deepEqual(migrated.navigation.dashboard, { scope: "public" });
  assert.deepEqual(migrated.features["obs:websocket"], { scope: "admin" });
  assert.deepEqual(migrated.actionTypes["overlay:alert"], { scope: "admin" });
  assert.deepEqual(migrated.actionTypes["audio:play"], { scope: "hidden" });
  assert.deepEqual(migrated.overlays.coinJar, { scope: "hidden" });
  assert.deepEqual(migrated.overlays.wheel, { scope: "admin" });
  assert.equal(migrated.setupFeatures, undefined);
  assert.equal(migrated.maintenanceFeatures, undefined);
  assert.deepEqual(
    migrated.cheatAccess,
    legacy.cheatAccess,
    "les accès propriétaires non liés à la visibilité sont conservés"
  );
});

test("l’audit distingue les entrées manquantes et obsolètes", () => {
  const catalog = {
    navigation: [{ id: "dashboard" }, { id: "actions" }],
    features: [{ id: "spotify.playback" }]
  };
  const legacy = {
    navigation: {
      actions: { scope: "public" },
      studio: { scope: "hidden" }
    },
    setupFeatures: {
      connectorObs: { scope: "public" }
    }
  };
  assert.deepEqual(auditVisibility(legacy, catalog), {
    changed: true,
    missing: 2,
    obsolete: 2,
    total: 3
  });
  const current = canonicalizeVisibility(legacy, catalog);
  assert.deepEqual(auditVisibility(current, catalog), {
    changed: false,
    missing: 0,
    obsolete: 0,
    total: 3
  });
});

test("masqué reste invisible même pour le propriétaire", () => {
  assert.equal(canAccessScope("public", false), true);
  assert.equal(canAccessScope("admin", false), false);
  assert.equal(canAccessScope("admin", true), true);
  assert.equal(canAccessScope("hidden", false), false);
  assert.equal(canAccessScope("hidden", true), false);
});
