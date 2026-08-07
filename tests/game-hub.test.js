"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  GameHub,
  interpolateCommand,
  resolveEffectCode,
  rconPacket,
  readRconPacket,
  validatePack
} = require("../src/main/game-hub");
const net = require("node:net");
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

test("résout les variantes de code Cult of the Lamb depuis leurs paramètres", () => {
  assert.equal(
    resolveEffectCode(
      {
        id: "cult-set-weapon",
        code: "weapon_0",
        codeByParameter: {
          parameter: "weapon",
          values: {
            1: "weapon_0",
            5: "weapon_450"
          }
        }
      },
      { parameters: { weapon: 5 } }
    ),
    "weapon_450"
  );
});

test("résout la variante Stardew la plus proche pour une valeur libre", () => {
  assert.equal(
    resolveEffectCode(
      {
        id: "stardew-give-money",
        code: "give_money_1000",
        codeByParameter: {
          parameter: "amount",
          mode: "nearest",
          values: {
            100: "give_money_100",
            1000: "give_money_1000",
            10000: "give_money_10000"
          }
        }
      },
      { parameters: { amount: 8700 } }
    ),
    "give_money_10000"
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

test("initialise les six actions Coin Pusher en mode manuel sans doubler les cadeaux LIVE", () => {
  const state = {
    session: { activeGamePackId: "coin-pusher" },
    commerce: {
      subscription: {
        tier: "pro",
        source: "subscription",
        status: "active"
      },
      gameEntitlements: ["coin-pusher"]
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

  const pack = hub.listPacks().find((entry) => entry.id === "coin-pusher");
  assert.equal(pack.effects.length, 6);
  assert.equal(
    pack.effects.find((effect) => effect.id === "pluie-de-pieces")
      .quantityParameter,
    "coinCount"
  );
  assert.equal(hub.initializeDefaultInteractions("coin-pusher").added, 6);
  const interactions = state.game.interactionRulesByPack["coin-pusher"];
  assert.equal(interactions.length, 6);
  assert.ok(interactions.every((rule) => rule.trigger.enabled === false));
  assert.ok(
    interactions.some(
      (rule) =>
        rule.actions[0]?.config?.effectId === "pluie-de-pieces" &&
        rule.actions[0]?.config?.parameters?.coinCount === 20
    )
  );
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

test("initialise le catalogue Cult of the Lamb et parle au bridge BepInEx", async () => {
  const state = {
    session: { activeGamePackId: "cult-of-the-lamb" },
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
      interactionRulesByPack: {},
      connectorOverrides: {
        "cult-of-the-lamb": { port: 0 }
      }
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

  const pack = hub
    .listPacks()
    .find((entry) => entry.id === "cult-of-the-lamb");
  assert.equal(pack.connector.type, "tcp-server");
  assert.equal(pack.connector.port, 58431);
  assert.equal(pack.effects.length, 32);
  assert.equal(
    hub.initializeDefaultInteractions("cult-of-the-lamb").added,
    34
  );
  const mappings =
    state.game.interactionRulesByPack["cult-of-the-lamb"];
  assert.equal(mappings.length, 34);
  assert.ok(
    mappings.some(
      (rule) =>
        rule.conditions.some(
          (condition) => condition.value === "Galaxy"
        ) &&
        rule.actions[0].config.effectId === "cult-spell-fireball"
    )
  );

  const status = await hub.prepareConnection("cult-of-the-lamb");
  const frames = [];
  const client = net.createConnection({
    host: "127.0.0.1",
    port: status.port
  });
  let input = "";
  client.on("data", (chunk) => {
    input += chunk.toString("utf8");
    let separator = input.indexOf("\0");
    while (separator >= 0) {
      const request = JSON.parse(input.slice(0, separator));
      input = input.slice(separator + 1);
      frames.push(request);
      client.write(
        `${JSON.stringify({
          id: request.id,
          status: 0,
          message: ""
        })}\0`
      );
      separator = input.indexOf("\0");
    }
  });
  await new Promise((resolve, reject) => {
    client.once("connect", resolve);
    client.once("error", reject);
  });

  try {
    await hub.trigger(
      "cult-set-weapon",
      { user: { displayName: "Test" } },
      {
        packId: "cult-of-the-lamb",
        parameters: { weapon: 5, level: 7 }
      }
    );
    await hub.trigger(
      "cult-invincible",
      { user: { displayName: "Test" } },
      {
        packId: "cult-of-the-lamb",
        parameters: { seconds: 11 }
      }
    );
    assert.equal(frames[0].code, "weapon_450");
    assert.equal(frames[0].level, 7);
    assert.equal(frames[1].code, "invincible");
    assert.equal(frames[1].duration, 11_000);
  } finally {
    client.destroy();
    await hub.disconnectAll();
  }
});

test("initialise et exécute les catalogues Stardew Valley et Terraria", async () => {
  const state = {
    session: { activeGamePackId: "stardew-valley" },
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
      interactionRulesByPack: {},
      connectorOverrides: {
        "stardew-valley": { port: 0 },
        terraria: { port: 0 }
      }
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

  const stardew = hub
    .listPacks()
    .find((entry) => entry.id === "stardew-valley");
  const terraria = hub
    .listPacks()
    .find((entry) => entry.id === "terraria");
  assert.equal(stardew.connector.type, "tcp-server");
  assert.equal(stardew.connector.port, 58432);
  assert.equal(stardew.effects.length, 28);
  assert.equal(terraria.connector.type, "tcp-server");
  assert.equal(terraria.connector.port, 58433);
  assert.equal(terraria.effects.length, 25);
  assert.equal(
    hub.initializeDefaultInteractions("stardew-valley").added,
    28
  );
  assert.equal(
    hub.initializeDefaultInteractions("terraria").added,
    25
  );

  const stardewStatus = await hub.prepareConnection("stardew-valley");
  const stardewFrames = [];
  const stardewClient = mockSimpleTcpGame(
    stardewStatus.port,
    stardewFrames
  );
  await connected(stardewClient);
  try {
    await hub.trigger(
      "stardew-spawn-mob",
      { user: { displayName: "Nova" } },
      {
        packId: "stardew-valley",
        parameters: { count: 7 }
      }
    );
    await hub.trigger(
      "stardew-frozen",
      { user: { displayName: "Nova" } },
      {
        packId: "stardew-valley",
        parameters: { seconds: 13 }
      }
    );
    assert.equal(stardewFrames[0].code, "spawn_slime");
    assert.equal(stardewFrames[0].quantity, 7);
    assert.equal(stardewFrames[0].viewer, "Nova");
    assert.equal(stardewFrames[1].duration, 13_000);
  } finally {
    stardewClient.destroy();
    await hub.disconnectAll();
  }

  const terrariaStatus = await hub.prepareConnection("terraria");
  const terrariaFrames = [];
  const terrariaClient = mockSimpleTcpGame(
    terrariaStatus.port,
    terrariaFrames
  );
  await connected(terrariaClient);
  try {
    await hub.trigger(
      "terraria-spawn-entity",
      { user: { displayName: "Alex" } },
      {
        packId: "terraria",
        parameters: { count: 12 }
      }
    );
    await hub.trigger(
      "terraria-blind",
      { user: { displayName: "Alex" } },
      {
        packId: "terraria",
        parameters: { seconds: 21 }
      }
    );
    assert.equal(terrariaFrames[0].code, "spawn_critters");
    assert.equal(terrariaFrames[0].quantity, 12);
    assert.equal(terrariaFrames[1].code, "buff_blind");
    assert.equal(terrariaFrames[1].duration, 21_000);
  } finally {
    terrariaClient.destroy();
    await hub.disconnectAll();
  }
});

function mockSimpleTcpGame(port, frames) {
  const client = net.createConnection({
    host: "127.0.0.1",
    port
  });
  let input = "";
  client.on("data", (chunk) => {
    input += chunk.toString("utf8");
    let separator = input.indexOf("\0");
    while (separator >= 0) {
      const request = JSON.parse(input.slice(0, separator));
      input = input.slice(separator + 1);
      frames.push(request);
      client.write(
        `${JSON.stringify({
          id: request.id,
          status: 0,
          message: ""
        })}\0`
      );
      separator = input.indexOf("\0");
    }
  });
  return client;
}

function connected(client) {
  return new Promise((resolve, reject) => {
    client.once("connect", resolve);
    client.once("error", reject);
  });
}

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
