"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  DEMONOLOGIST_DEFAULT_MAPPINGS,
  DEMONOLOGIST_EFFECTS
} = require("../src/main/demonologist-catalog");
const { GameHub } = require("../src/main/game-hub");
const { GAME_INSTALLERS } = require("../src/main/game-installer-manifest");
const {
  applyKeyboardLayout,
  normalizeWindowsInputSequence
} = require("../src/main/windows-input-service");
const { readRendererSource } = require("./helpers/source-bundles");

const resourcesDirectory = path.join(__dirname, "..", "resources");

test("reprend les 31 Input Disrupts officiels de Demonologist", () => {
  assert.equal(DEMONOLOGIST_EFFECTS.length, 31);
  assert.equal(DEMONOLOGIST_DEFAULT_MAPPINGS.length, 31);
  assert.equal(
    new Set(DEMONOLOGIST_EFFECTS.map((effect) => effect.sourceEffectId)).size,
    31
  );
  assert.ok(
    DEMONOLOGIST_DEFAULT_MAPPINGS.every(
      (mapping) => mapping.triggerEnabled === false
    )
  );
  for (const effect of DEMONOLOGIST_EFFECTS) {
    assert.ok(normalizeWindowsInputSequence(effect.inputSequence).length >= 1);
  }
});

test("normalise les commandes clavier, clic et rotation de souris Crowd Control", () => {
  assert.deepEqual(
    normalizeWindowsInputSequence("k,0,69,2;b,10,0,2;r,50,60,-20"),
    [
      {
        kind: "keyboard",
        delayMs: 0,
        keyCode: 69,
        action: "press"
      },
      {
        kind: "mouse-button",
        delayMs: 10,
        button: 0,
        action: "press"
      },
      { kind: "mouse-move", delayMs: 50, dx: 60, dy: -20 }
    ]
  );
  assert.deepEqual(
    applyKeyboardLayout(
      normalizeWindowsInputSequence("k,0,87,0;b,10,2,2;r,20,60,0"),
      "azerty"
    ),
    [
      {
        kind: "keyboard",
        delayMs: 0,
        keyCode: 90,
        action: "down"
      },
      {
        kind: "mouse-button",
        delayMs: 10,
        button: 2,
        action: "press"
      },
      {
        kind: "mouse-move",
        delayMs: 20,
        dx: 60,
        dy: 0
      }
    ]
  );
});

test("compile le pont Windows clavier et souris utilisé par Demonologist", () => {
  const serviceSource = fs.readFileSync(
    path.join(__dirname, "..", "src", "main", "windows-input-service.js"),
    "utf8"
  );
  const csharp = serviceSource.match(
    /Add-Type -TypeDefinition @'\r?\n([\s\S]*?)\r?\n'@/
  )?.[1];
  assert.ok(csharp);
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$source=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:SHENPULSE_TEST_CSHARP)); Add-Type -TypeDefinition $source; 'OK'"
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        SHENPULSE_TEST_CSHARP: Buffer.from(csharp, "utf8").toString("base64")
      }
    }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "OK");
});

test("branche Demonologist sur son processus Windows sans modifier le jeu", async () => {
  const state = subscribedState();
  state.game.connectorOverrides.demonologist = { keyLayout: "azerty" };
  const calls = [];
  const windowsInputService = {
    status: async (processName) => {
      calls.push({ operation: "status", processName });
      return { ok: true, processId: 66 };
    },
    play: async (processName, sequence, keyLayout) => {
      calls.push({ operation: "play", processName, sequence, keyLayout });
      return { ok: true, eventsSent: 1 };
    }
  };
  const hub = new GameHub({
    store: storeFor(state),
    resourcesDirectory,
    packsDirectory: path.join(resourcesDirectory, "packs"),
    windowsInputService
  });
  hub.loadPacks();

  const pack = hub.listPacks().find((entry) => entry.id === "demonologist");
  assert.ok(pack);
  assert.equal(pack.connector.type, "windows-input");
  assert.equal(
    pack.connector.processName,
    "Shivers-Win64-Shipping.exe"
  );
  assert.equal(pack.guide.mode, "input");
  assert.equal(pack.installerVersion, "1.0.0");
  assert.equal(pack.included, true);
  assert.equal(pack.requiresPro, true);
  assert.equal(hub.initializeDefaultInteractions(pack.id).added, 31);

  await hub.testConnection(pack.id);
  await hub.trigger(
    "demonologist-use-tool",
    { user: { id: "viewer", displayName: "Viewer" } },
    { packId: pack.id }
  );
  assert.deepEqual(
    calls.map((call) => [call.operation, call.processName]),
    [
      ["status", "Shivers-Win64-Shipping.exe"],
      ["play", "Shivers-Win64-Shipping.exe"]
    ]
  );
  assert.equal(calls[1].keyLayout, "azerty");
});

test("l’étape Installation propose le bouton commun aux jeux Input Disrupts", () => {
  const renderer = readRendererSource();
  assert.match(renderer, /data-action="install-game"/);
  assert.match(renderer, /↓ Installer les interactions/);
  assert.match(renderer, /data-game-key-layout/);
  assert.doesNotMatch(renderer, /save-fortnite-input-layout/);
  assert.equal(GAME_INSTALLERS.demonologist.setupOnly, true);
});

test("le démarrage de Demonologist lance le jeu avant d’activer sa session", () => {
  const renderer = readRendererSource();
  const installer = GAME_INSTALLERS.demonologist;
  assert.equal(
    installer.waitForWindowProcess,
    "Shivers-Win64-Shipping"
  );
  assert.match(renderer, /demonologistAutoLaunch = pack\.id === "demonologist"/);
  assert.match(renderer, /▶ Lancer Demonologist et activer/);
  assert.match(renderer, /demonologistAutoLaunch && ready[\s\S]*?data-action="launch-game"/);
});

function subscribedState() {
  return {
    settings: {
      account: {
        email: "viewer@example.com",
        emailVerified: true,
        uid: "viewer-uid",
        refreshTokenSecretId: "viewer-secret"
      }
    },
    session: { activeGamePackId: "coin-pusher" },
    commerce: {
      subscription: {
        tier: "pro",
        source: "subscription",
        status: "active"
      },
      gameEntitlements: []
    },
    game: {
      recentPacks: [],
      connectorOverrides: {},
      interactionCatalogVersions: {},
      interactionRulesByPack: {}
    },
    rules: []
  };
}

function storeFor(state) {
  return {
    getState: () => state,
    getSecret: () => "refresh-token",
    mutate: (callback) => callback(state)
  };
}
