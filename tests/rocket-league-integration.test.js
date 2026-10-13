"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  ROCKET_LEAGUE_DEFAULT_MAPPINGS,
  ROCKET_LEAGUE_EFFECTS
} = require("../src/main/rocket-league-catalog");
const { GameHub } = require("../src/main/game-hub");
const {
  applyKeyboardLayout,
  normalizeWindowsInputSequence
} = require("../src/main/windows-input-service");

const resourcesDirectory = path.join(__dirname, "..", "resources");

test("intègre les 21 interactions Rocket League en français et désactivées par défaut", () => {
  assert.equal(ROCKET_LEAGUE_EFFECTS.length, 21);
  assert.equal(ROCKET_LEAGUE_DEFAULT_MAPPINGS.length, 21);
  assert.equal(
    new Set(ROCKET_LEAGUE_EFFECTS.map((effect) => effect.id)).size,
    21
  );
  assert.ok(
    ROCKET_LEAGUE_DEFAULT_MAPPINGS.every(
      (mapping) => mapping.triggerEnabled === false
    )
  );

  const effectsBySourceId = new Map(
    ROCKET_LEAGUE_EFFECTS.map((effect) => [effect.sourceEffectId, effect])
  );
  assert.equal(
    effectsBySourceId.get("rl_rl_drunk_drive").name,
    "Conduite titubante"
  );
  assert.equal(
    effectsBySourceId.get("rl_rl_full_boost").name,
    "Pleine vitesse"
  );
  assert.equal(
    effectsBySourceId.get("rl_rl_aerial").name,
    "Tentative aérienne"
  );
  assert.equal(
    effectsBySourceId.get("rl_rl_scoreboard").name,
    "Tableau des scores"
  );
  assert.doesNotMatch(
    JSON.stringify(ROCKET_LEAGUE_EFFECTS),
    /crowd\s*control/i
  );
});

test("valide toutes les séquences Rocket League et adapte la conduite au clavier AZERTY", () => {
  for (const effect of ROCKET_LEAGUE_EFFECTS) {
    assert.ok(normalizeWindowsInputSequence(effect.inputSequence).length >= 1);
  }

  const fullSpeed = ROCKET_LEAGUE_EFFECTS.find(
    (effect) => effect.sourceEffectId === "rl_rl_full_boost"
  );
  assert.deepEqual(
    normalizeWindowsInputSequence(fullSpeed.inputSequence).map(
      (event) => event.kind
    ),
    ["keyboard", "mouse-button", "keyboard", "mouse-button"]
  );

  const drive = applyKeyboardLayout(
    normalizeWindowsInputSequence("k,0,87,0;k,10,65,0;k,10,83,0;k,10,68,0"),
    "azerty"
  );
  assert.deepEqual(
    drive.map((event) => event.keyCode),
    [90, 81, 83, 68]
  );
});

test("cible uniquement RocketLeague.exe avec le connecteur clavier et souris", async () => {
  const state = proState();
  state.game.connectorOverrides["rocket-league"] = {
    keyLayout: "azerty"
  };
  const calls = [];
  const windowsInputService = {
    status: async (processName) => {
      calls.push({ operation: "status", processName });
      return { ok: true, processId: 42 };
    },
    play: async (processName, sequence, keyLayout) => {
      calls.push({ operation: "play", processName, sequence, keyLayout });
      return { ok: true, eventsSent: 4 };
    }
  };
  const hub = new GameHub({
    store: storeFor(state),
    resourcesDirectory,
    packsDirectory: path.join(resourcesDirectory, "packs"),
    windowsInputService
  });
  hub.loadPacks();

  const rocketLeague = hub
    .listPacks()
    .find((pack) => pack.id === "rocket-league");
  assert.ok(rocketLeague);
  assert.equal(rocketLeague.name, "Rocket League");
  assert.equal(rocketLeague.connector.type, "windows-input");
  assert.equal(rocketLeague.connector.processName, "RocketLeague.exe");
  assert.equal(rocketLeague.effects.length, 21);
  assert.equal(hub.initializeDefaultInteractions("rocket-league").added, 21);

  await hub.testConnection("rocket-league");
  await hub.trigger(
    "rocket-league-pleine-vitesse",
    { user: { id: "viewer", displayName: "Viewer" } },
    { packId: "rocket-league" }
  );

  assert.deepEqual(
    calls.map((call) => [call.operation, call.processName]),
    [
      ["status", "RocketLeague.exe"],
      ["play", "RocketLeague.exe"]
    ]
  );
  assert.equal(calls[1].keyLayout, "azerty");
});

test("n’affiche aucune attribution externe dans la fiche Rocket League", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "src", "main", "game-catalog.js"),
    "utf8"
  );
  const start = source.indexOf('game("rocket-league"');
  const end = source.indexOf('game("demonologist"', start);
  const entry = source.slice(start, end);
  assert.match(entry, /source: "ShenPulse · Interactions Rocket League"/);
  assert.doesNotMatch(entry, /Crowd Control/);
});

function proState() {
  return {
    settings: {
      account: {
        email: "creator@example.com",
        emailVerified: true,
        uid: "creator-uid",
        refreshTokenSecretId: "creator-secret"
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
    getSecret: (secretId) =>
      secretId === "creator-secret" ? "refresh-token" : "",
    mutate: (callback) => callback(state)
  };
}
