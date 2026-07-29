"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  GameHub,
  interpolateCommand,
  rconPacket,
  readRconPacket,
  validatePack
} = require("../src/main/game-hub");
const path = require("node:path");

test("construit et relit un paquet RCON", () => {
  const packet = rconPacket(7, 2, "list");
  const parsed = readRconPacket(packet);
  assert.equal(parsed.requestId, 7);
  assert.equal(parsed.type, 2);
  assert.equal(parsed.body, "list");
  assert.equal(parsed.remainder.length, 0);
});

test("hydrate une commande de jeu sans injecter le viewer", () => {
  assert.equal(
    interpolateCommand("give {{viewer}} stone {{quantity}}", {
      viewer: "Nova Player; op @a",
      quantity: 3,
      duration: 0
    }),
    "give Nova_Player__op__a stone 3"
  );
});

test("hydrate aussi les paramètres propres aux interactions Minecraft", () => {
  assert.equal(
    interpolateCommand(
      "/bedrock supertnt {{count}} {{power}} {{viewer}}",
      {
        viewer: "Nova Player",
        quantity: 1,
        duration: 0,
        parameters: { count: 12, power: 5 }
      }
    ),
    "/bedrock supertnt 12 5 Nova_Player"
  );
});

test("un paramètre Minecraft duration prend le pas sur la durée générique", () => {
  assert.equal(
    interpolateCommand("/bedrock comets {{duration}} {{interval}}", {
      viewer: "Nova Player",
      quantity: 1,
      duration: 0,
      parameters: { duration: 10, interval: 2 }
    }),
    "/bedrock comets 10 2"
  );
});

test("valide l'unicité des effets d'un pack", () => {
  assert.throws(() =>
    validatePack({
      id: "x",
      name: "X",
      connector: { type: "demo" },
      effects: [{ id: "a" }, { id: "a" }]
    })
  );
});

test("initialise une seule fois les interactions GTA prévues pour le profil", () => {
  const state = {
    session: { activeGamePackId: "gtav-montchiliad" },
    commerce: {
      subscription: {
        tier: "pro",
        source: "subscription",
        status: "active"
      },
      gameEntitlements: ["gtav-montchiliad"]
    },
    game: {
      recentPacks: [],
      interactionCatalogVersions: {},
      interactionRulesByPack: {}
    },
    rules: []
  };
  const store = {
    getState: () => state,
    mutate: (callback) => callback(state)
  };
  const resourcesDirectory = path.join(__dirname, "..", "resources");
  const hub = new GameHub({
    store,
    resourcesDirectory,
    packsDirectory: path.join(resourcesDirectory, "packs")
  });
  hub.loadPacks();
  const gtaPack = hub
    .listPacks()
    .find((pack) => pack.id === "gtav-montchiliad");
  assert.equal(gtaPack.connector.type, "tcp-server");
  assert.equal(gtaPack.connector.port, 58430);

  const first = hub.initializeDefaultInteractions("gtav-montchiliad");
  const interactions =
    state.game.interactionRulesByPack["gtav-montchiliad"];
  assert.equal(first.added, 31);
  assert.equal(interactions.length, 31);
  assert.equal(state.rules.length, 0);
  assert.equal(
    state.game.interactionCatalogVersions["gtav-montchiliad"],
    first.version
  );
  assert.ok(
    interactions.some(
      (rule) =>
        rule.trigger.type === "gift" &&
        rule.conditions.some(
          (condition) => condition.value === "Relaxed Goose"
        )
    )
  );
  assert.ok(
    interactions.some(
      (rule) =>
        rule.trigger.type === "like" &&
        rule.trigger.threshold === 500
    )
  );
  assert.ok(
    interactions.some(
      (rule) =>
        rule.actions[0]?.type === "overlay.win-counter" &&
        rule.actions[0]?.config?.operation === "multiplier"
    )
  );

  interactions.pop();
  const second = hub.initializeDefaultInteractions("gtav-montchiliad");
  assert.equal(second.added, 0);
  assert.equal(interactions.length, 30);
});

test("initialise les associations TikTok Bedrock Box et SandBox", () => {
  const state = {
    session: { activeGamePackId: "minecraft-bedrock-box" },
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
      interactionCatalogVersions: {},
      interactionRulesByPack: {}
    },
    rules: []
  };
  const store = {
    getState: () => state,
    mutate: (callback) => callback(state)
  };
  const resourcesDirectory = path.join(__dirname, "..", "resources");
  const hub = new GameHub({
    store,
    resourcesDirectory,
    packsDirectory: path.join(resourcesDirectory, "packs")
  });
  hub.loadPacks();

  assert.equal(
    hub.initializeDefaultInteractions("minecraft-bedrock-box").added,
    28
  );
  assert.equal(
    hub
      .listPacks()
      .find((pack) => pack.id === "minecraft-bedrock-box").connector.type,
    "minecraft-runtime"
  );
  assert.equal(
    hub.initializeDefaultInteractions("minecraft-sandbox-3").added,
    18
  );

  const bedrock =
    state.game.interactionRulesByPack["minecraft-bedrock-box"];
  const sandbox =
    state.game.interactionRulesByPack["minecraft-sandbox-3"];
  assert.equal(bedrock.length, 28);
  assert.equal(sandbox.length, 18);
  assert.ok(
    bedrock.some(
      (rule) =>
        rule.trigger.type === "like" &&
        rule.trigger.threshold === 150
    )
  );
  assert.ok(
    bedrock.some(
      (rule) =>
        rule.conditions.some(
          (condition) => condition.value === "Forever Rosa"
        ) &&
        rule.actions[0].config.parameters.count === 1000
    )
  );
  assert.ok(
    sandbox.some(
      (rule) =>
        rule.conditions.some(
          (condition) => condition.value === "Heart Me"
        ) &&
        rule.actions[0].config.parameters.rows === 2
    )
  );
});

test("envoie les commandes Minecraft au serveur géré par ShenPulse", async () => {
  const state = {
    session: { activeGamePackId: "minecraft-bedrock-box" },
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
      interactionCatalogVersions: {},
      interactionRulesByPack: {}
    },
    rules: []
  };
  const store = {
    getState: () => state,
    mutate: (callback) => callback(state)
  };
  const resourcesDirectory = path.join(__dirname, "..", "resources");
  const hub = new GameHub({
    store,
    resourcesDirectory,
    packsDirectory: path.join(resourcesDirectory, "packs")
  });
  const calls = [];
  hub.setMinecraftRuntime({
    minecraftConnectionStatus: (gameId) => ({ ok: true, gameId }),
    executeMinecraftCommands: async (gameId, commands) => {
      calls.push({ gameId, commands });
      return { status: "success" };
    }
  });
  hub.loadPacks();

  assert.equal(
    (await hub.testConnection("minecraft-bedrock-box")).ok,
    true
  );
  await hub.trigger(
    "bedrock-super-tnt",
    { user: { id: "u1", displayName: "Nova Player" } },
    {
      packId: "minecraft-bedrock-box",
      parameters: { count: 3, power: 4 }
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].gameId, "minecraft-bedrock-box");
  assert.deepEqual(calls[0].commands, [
    "/bedrock supertnt 3 4 Nova_Player",
    '/title @a title "3x Super TNT"',
    '/title @a subtitle "Nova_Player"'
  ]);

  await hub.executeMinecraftCommands(
    "minecraft-bedrock-box",
    ["shenpulse_win set 7"]
  );
  assert.deepEqual(calls[1], {
    gameId: "minecraft-bedrock-box",
    commands: ["shenpulse_win set 7"]
  });
});
