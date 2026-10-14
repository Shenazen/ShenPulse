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
  FEATURE_ITEMS,
  auditVisibility,
  canAccessScope,
  canonicalizeVisibility,
  migrateVisibility,
  scopeFor
} = require("../src/shared/visibility-catalog");

const CURRENT_PAGE_IDS = [
  "home",
  "dashboard",
  "live",
  "actions",
  "sounds",
  "rules",
  "overlays",
  "games",
  "irl",
  "goals",
  "commands",
  "matches",
  "membership",
  "connections",
  "activity",
  "settings",
  "admin",
  "users",
  "voice",
  "music",
  "controllers"
];

test("l’inventaire admin reprend exactement les pages déclarées par ShenPulseNew", () => {
  const source = readRendererSource();
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
  assert.match(
    source,
    /pack\.ownerOnly !== true \|\| isVerifiedAdminSession\(\)/
  );
  assert.match(source, /function canAccessActionType\(type\)/);
  assert.match(source, /function visibleNavigationEntries\(\)/);
  assert.match(source, /ensureCurrentPageAccess\(\)/);
  assert.match(source, /api\.admin\.visibility\(\)/);
});

test("les listes de visibilité attendent un vrai changement avant d’enregistrer", () => {
  const source = readRendererSource();
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
  const source = readRendererSource();
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
  assert.equal(migrated.schemaVersion, 9);
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

test("Studio Live and overlays have independent scopes after the version 8 migration", () => {
  const catalog = { navigation: [{ id: "studio" }, { id: "overlays" }] };
  const legacy = canonicalizeVisibility({ schemaVersion: 7,
    navigation: { studio: { scope: "admin" } } }, catalog);
  assert.equal(legacy.schemaVersion, 9);
  assert.deepEqual(legacy.navigation.overlays, { scope: "admin" });
  assert.deepEqual(legacy.navigation.studio, { scope: "public" });
  const updated = canonicalizeVisibility({ schemaVersion: 8,
    navigation: { studio: { scope: "hidden" } } }, catalog);
  assert.deepEqual(updated.navigation.studio, { scope: "hidden" });
  assert.deepEqual(updated.navigation.overlays, { scope: "public" });
});

test("the dedicated voice and music pages retain legacy audio navigation scopes", () => {
  const catalog = { navigation: [{ id: "sounds" }, { id: "voice" }, { id: "music" }] };
  const migrated = canonicalizeVisibility({ schemaVersion: 7,
    navigation: { sounds: { scope: "hidden" }, song: { scope: "admin" } } }, catalog);
  assert.deepEqual(migrated.navigation.sounds, { scope: "hidden" });
  assert.deepEqual(migrated.navigation.voice, { scope: "hidden" });
  assert.deepEqual(migrated.navigation.music, { scope: "admin" });
});

test("Accueil is public by default and does not overwrite saved navigation visibility", () => {
  const catalog = { navigation: [{ id: "home", defaultScope: "public" },
    { id: "dashboard" }, { id: "studio" }, { id: "overlays" }] };
  const migrated = canonicalizeVisibility({ schemaVersion: 7,
    navigation: { dashboard: { scope: "hidden" }, studio: { scope: "admin" } } }, catalog);
  assert.equal(migrated.schemaVersion, 9, "la migration commerciale conserve les droits des autres pages");
  assert.deepEqual(migrated.navigation.home, { scope: "public" });
  assert.deepEqual(migrated.navigation.dashboard, { scope: "hidden" });
  assert.deepEqual(migrated.navigation.overlays, { scope: "admin" });
  const restricted = canonicalizeVisibility({ schemaVersion: 8,
    navigation: { home: { scope: "admin" }, dashboard: { scope: "public" } } }, catalog);
  assert.deepEqual(restricted.navigation.home, { scope: "admin" }, "explicit admin scope remains authoritative");
  assert.deepEqual(restricted.navigation.dashboard, { scope: "public" });
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

test("les interactions IRL sont publiques par défaut, avec abonnement vérifié séparément", () => {
  const catalog = {
    navigation: [{ id: "irl", defaultScope: "public" }],
    features: FEATURE_ITEMS,
    actionTypes: [
      {
        id: "irl.shelly",
        defaultScope: "public"
      }
    ]
  };
  const visibility = canonicalizeVisibility({}, catalog);
  assert.deepEqual(visibility.navigation.irl, { scope: "public" });
  assert.deepEqual(visibility.features["irl:shelly"], { scope: "public" });
  assert.deepEqual(visibility.actionTypes["irl:shelly"], { scope: "public" });
  assert.equal(FEATURE_ITEMS.find((item) => item.id === "irl.shelly").ownerOnly, undefined);
});

test("la migration IRL ouvre uniquement les anciennes portées forcées propriétaire", () => {
  const old = { schemaVersion: 8, navigation: { irl: { scope: "admin" }, games: { scope: "admin" } },
    features: { "irl:shelly": { scope: "admin", detail: "conservé" }, "obs:websocket": { scope: "admin" } },
    actionTypes: { "irl.shelly": { scope: "admin" }, "http:request": { scope: "hidden" } },
    games: { private: { scope: "admin" } }, actionTypeOverrides: { "irl:shelly": false } };
  const saved = structuredClone(old);
  const migrated = migrateVisibility(old);
  assert.equal(migrated.schemaVersion, 9);
  assert.equal(scopeFor(old, "navigation", "irl"), "public", "le chemin chaud interprète aussi le cache brut");
  assert.deepEqual(migrated.navigation.irl, { scope: "public" });
  assert.deepEqual(migrated.features["irl:shelly"], { scope: "public", detail: "conservé" });
  assert.deepEqual(migrated.actionTypes["irl.shelly"], { scope: "public" });
  assert.deepEqual(migrated.navigation.games, saved.navigation.games);
  assert.deepEqual(migrated.features["obs:websocket"], saved.features["obs:websocket"]);
  assert.deepEqual(migrated.games, saved.games);
  assert.deepEqual(migrated.actionTypeOverrides, saved.actionTypeOverrides);
  assert.deepEqual(old, saved, "le document d'origine ne doit pas être muté");
  assert.deepEqual(migrateVisibility(migrated), migrated, "migration idempotente");
});

test("IRL conserve les interdictions anciennes et toutes les restrictions modernes", () => {
  for (const schemaVersion of [0, 8, 9, 100]) {
    for (const scope of ["hidden", false]) {
      const source = { schemaVersion, navigation: { irl: scope }, features: { "irl:shelly": scope }, actionTypes: { "irl:shelly": scope } };
      const migrated = migrateVisibility(source);
      for (const [section, id] of [["navigation", "irl"], ["features", "irl.shelly"], ["actionTypes", "irl.shelly"]]) {
        assert.equal(scopeFor(source, section, id), "hidden");
        assert.equal(scopeFor(migrated, section, id), "hidden");
      }
    }
  }
  const source = { schemaVersion: 9, navigation: { irl: { scope: "admin" } },
    features: { "irl:shelly": { scope: "admin" } }, actionTypes: { "irl:shelly": { scope: "admin" } } };
  assert.deepEqual(migrateVisibility(source), source);
  assert.equal(scopeFor(source, "navigation", "irl"), "admin");
});

test("relever le schéma conserve l'alias historique Studio des overlays", () => {
  const migrated = migrateVisibility({ schemaVersion: 7, navigation: { studio: { scope: "hidden" } } });
  assert.equal(scopeFor(migrated, "navigation", "overlays"), "hidden");
  assert.equal(scopeFor(migrated, "navigation", "studio"), "public");
});
