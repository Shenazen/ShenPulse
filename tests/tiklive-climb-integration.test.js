"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  TikLiveClimbBridge,
  buildTikLiveClimbActionUrl
} = require("../src/main/tiklive-climb-bridge");
const {
  TIKLIVE_CLIMB_DEFAULT_MAPPINGS,
  TIKLIVE_CLIMB_EFFECTS,
  TIKLIVE_CLIMB_WHEEL_PRESETS
} = require("../src/main/tiklive-climb-catalog");
const { GameHub } = require("../src/main/game-hub");
const { GAME_INSTALLERS } = require("../src/main/game-installer-manifest");
const { RuleEngine } = require("../src/main/rule-engine");

const resourcesDirectory = path.join(__dirname, "..", "resources");
const climbPatchScript = fs.readFileSync(
  path.join(__dirname, "..", "scripts", "patch-tiklive-climb.ps1"),
  "utf8"
);

test("affiche Climb comme un jeu à installation automatique", () => {
  const bootstrap = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "src",
      "renderer",
      "app",
      "core",
      "bootstrap.js"
    ),
    "utf8"
  );
  const gameAccess = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "src",
      "renderer",
      "app",
      "features",
      "games",
      "access.js"
    ),
    "utf8"
  );
  const automatedInstallerSet = bootstrap.slice(
    bootstrap.indexOf("const AUTOMATED_GAME_INSTALLERS"),
    bootstrap.indexOf("const MANAGED_BIZHAWK_GAME_IDS")
  );

  assert.match(automatedInstallerSet, /"tiklive-climb"/);
  assert.match(gameAccess, /"tiklive-climb"/);
});

test("construit une copie autonome sans modifier la licence d’origine", () => {
  assert.match(climbPatchScript, /TIKLIVE_TICKET/);
  assert.match(climbPatchScript, /game-launch-verify\.php/);
  assert.match(climbPatchScript, /game-session\.php/);
  assert.match(climbPatchScript, /TikLiveLicence\.Demarrer bootstrap method/);
  assert.match(climbPatchScript, /removedLicenceKey/);
  assert.match(climbPatchScript, /originalLicenceKeyPreserved/);
});

test("publie les 18 effets et les 26 interactions actives de Climb", () => {
  assert.equal(TIKLIVE_CLIMB_EFFECTS.length, 18);
  assert.equal(TIKLIVE_CLIMB_DEFAULT_MAPPINGS.length, 26);
  assert.equal(
    new Set(TIKLIVE_CLIMB_EFFECTS.map((effect) => effect.code)).size,
    18
  );
  assert.ok(
    TIKLIVE_CLIMB_DEFAULT_MAPPINGS.every(
      (mapping) => mapping.triggerEnabled === true
    )
  );
  assert.deepEqual(
    TIKLIVE_CLIMB_DEFAULT_MAPPINGS
      .filter((mapping) => mapping.triggerType !== "gift")
      .map((mapping) => mapping.triggerType),
    ["chat", "like", "follow", "share"]
  );
  assert.equal(
    TIKLIVE_CLIMB_DEFAULT_MAPPINGS.find(
      (mapping) => mapping.id === "tiklive-climb-ballon-10"
    ).parameters.amount,
    10
  );
  assert.equal(
    TIKLIVE_CLIMB_DEFAULT_MAPPINGS.find(
      (mapping) => mapping.id === "tiklive-climb-spin-chat"
    ).actionType,
    "wheel.spin"
  );
  assert.equal(TIKLIVE_CLIMB_WHEEL_PRESETS.length, 1);
  assert.equal(TIKLIVE_CLIMB_WHEEL_PRESETS[0].segments.length, 12);
  assert.ok(
    TIKLIVE_CLIMB_WHEEL_PRESETS[0].segments.every(
      (segment) => segment.action === "action" && segment.actionId
    )
  );
});

test("traduit un événement ShenPulse vers l’API locale de Climb", () => {
  const url = buildTikLiveClimbActionUrl(
    { url: "http://127.0.0.1:7777" },
    {
      effect: {
        code: "ballon",
        quantity: 10,
        viewer: "Secours",
        viewerId: "fallback"
      }
    },
    {
      user: {
        id: "viewer-42",
        displayName: "Éloïse & Sam",
        avatarUrl: "https://images.example/avatar 42.png"
      },
      data: { giftName: "Cœur & Rose", count: 3, value: 5 }
    }
  );

  assert.equal(url.origin, "http://127.0.0.1:7777");
  assert.equal(url.pathname, "/action");
  assert.equal(url.searchParams.get("fx"), "ballon");
  assert.equal(url.searchParams.get("n"), "10");
  assert.equal(url.searchParams.get("d"), "15");
  assert.equal(url.searchParams.get("username"), "Éloïse & Sam");
  assert.equal(url.searchParams.get("uid"), "viewer-42");
  assert.equal(url.searchParams.get("gift"), "Cœur & Rose");
  assert.equal(
    Array.from(url.searchParams.keys()).at(-1),
    "username",
    "Climb exige username en dernier dans la chaîne de requête"
  );
});

test("utilise le point d’entrée natif de la roue Climb", () => {
  const url = buildTikLiveClimbActionUrl(
    { url: "http://localhost:7777" },
    { effect: { code: "roue", quantity: 1 } },
    { user: { displayName: "Nova" }, data: { giftName: "TikTok" } }
  );

  assert.equal(url.pathname, "/roue");
  assert.equal(url.searchParams.has("fx"), false);
  assert.equal(Array.from(url.searchParams.keys()).at(-1), "username");
});

test("refuse d’envoyer les interactions Climb vers un hôte distant", () => {
  assert.throws(
    () =>
      buildTikLiveClimbActionUrl(
        { url: "http://example.com:7777" },
        { effect: { code: "souffle", quantity: 1 } }
      ),
    /rester sur cet ordinateur/
  );
});

test("vérifie l’état et envoie une action avec des requêtes GET locales", async () => {
  const calls = [];
  const bridge = new TikLiveClimbBridge({
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith("/etat")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ jeu: "climb", scene: "menu" })
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => "Action reçue"
      };
    }
  });

  const status = await bridge.status({ url: "http://localhost:7777" });
  const result = await bridge.trigger(
    { url: "http://localhost:7777" },
    { effect: { code: "ballon", quantity: 10 } },
    { user: { displayName: "Nova" }, data: { giftName: "Rose" } }
  );

  assert.equal(status.ok, true);
  assert.equal(status.state.scene, "menu");
  assert.equal(result.sent, true);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.options.method === "GET"));
  assert.match(calls[1].url, /\/action\?/);
});

test("remonte les refus explicites du jeu au lieu d’annoncer un faux succès", async () => {
  const bridge = new TikLiveClimbBridge({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => "La partie n’est pas lancée"
    })
  });

  await assert.rejects(
    bridge.trigger({}, { effect: { code: "seisme", quantity: 1 } }),
    /partie n’est pas lancée/
  );
});

test("branche le catalogue ShenPulse sur le pont Climb", async () => {
  const state = subscribedState();
  state.game.interactionCatalogVersions["tiklive-climb"] = 20261011;
  state.game.interactionRulesByPack["tiklive-climb"] = [{
    id: "rule_tiklive-climb_tiklive-climb-souffle",
    enabled: false,
    gameInteraction: {
      catalogVersion: 20261011,
      default: true,
      presetId: "tiklive-climb-souffle"
    },
    actions: []
  }];
  const calls = [];
  const tikLiveClimbBridge = {
    status: async (connector) => {
      calls.push({ operation: "status", connector });
      return { ok: true, state: { jeu: "climb" } };
    },
    trigger: async (connector, payload, context) => {
      calls.push({ operation: "trigger", connector, payload, context });
      return { status: "success", sent: true };
    }
  };
  const hub = new GameHub({
    store: storeFor(state),
    resourcesDirectory,
    packsDirectory: path.join(resourcesDirectory, "packs"),
    tikLiveClimbBridge
  });
  hub.loadPacks();

  const pack = hub.listPacks().find((entry) => entry.id === "tiklive-climb");
  assert.ok(pack);
  assert.equal(pack.connector.type, "tiklive-climb-http");
  assert.equal(pack.connector.url, "http://127.0.0.1:7777");
  assert.equal(pack.accessMode, "purchase");
  assert.equal(pack.price, 19.99);
  assert.equal(pack.requiresPro, true);
  assert.equal(pack.installerVersion, "1.0.0-shenpulse1");
  const initialization = hub.initializeDefaultInteractions(pack.id);
  assert.equal(initialization.added, 25);
  assert.equal(initialization.removed, 0);
  assert.equal(initialization.repaired, 1);
  const rules = state.game.interactionRulesByPack[pack.id];
  const spinRule = rules.find(
    (rule) => rule.gameInteraction.presetId === "tiklive-climb-spin-chat"
  );
  assert.equal(spinRule.trigger.type, "chat");
  assert.equal(spinRule.conditions[0].value, "^\\s*!spin\\s*$");
  assert.equal(spinRule.actions[0].type, "wheel.spin");
  assert.equal(spinRule.actions[0].config.wheelId, "wheel_tiklive_climb");
  assert.equal(
    state.settings.overlayConfigs.wheel.wheels[0].id,
    "wheel_tiklive_climb"
  );

  await hub.testConnection(pack.id);
  await hub.trigger(
    "tiklive-climb-ballon",
    {
      user: { id: "viewer", displayName: "Viewer" },
      data: { giftName: "Rose", count: 1, value: 1 }
    },
    { packId: pack.id, parameters: { amount: 12 } }
  );

  assert.deepEqual(
    calls.map((call) => call.operation),
    ["status", "trigger"]
  );
  assert.equal(calls[1].payload.effect.code, "ballon");
  assert.equal(calls[1].payload.effect.quantity, 12);
  assert.equal(calls[1].context.data.giftName, "Rose");
});

test("associe le dossier autonome et son exécutable au lanceur ShenPulse", () => {
  const installer = GAME_INSTALLERS["tiklive-climb"];
  assert.equal(installer.managedTarget, true);
  assert.equal(installer.unattended, true);
  assert.equal(installer.assets.length, 1);
  assert.equal(installer.assets[0].action, "extract");
  assert.equal(installer.assets[0].size, 38061187);
  assert.equal(
    installer.assets[0].sha256,
    "1e01dfe77e0dd0e0d7f70e7c9f25e203625a1b60519757775b5273231cb5a688"
  );
  assert.match(installer.assets[0].url, /backblazeb2\.com/);
  assert.deepEqual(installer.launchExecutables, ["ShenPulse Climb.exe"]);
});

test("déclenche les cadeaux, likes et !spin pendant une session Climb", async () => {
  const state = subscribedState();
  state.session.profileId = "profile-1";
  state.session.game = {
    running: true,
    packId: "tiklive-climb",
    profileId: "profile-1"
  };
  state.profiles = [{ id: "profile-1", enabledRuleIds: [] }];
  const hub = new GameHub({
    store: storeFor(state),
    resourcesDirectory,
    packsDirectory: path.join(resourcesDirectory, "packs")
  });
  hub.loadPacks();
  hub.initializeDefaultInteractions("tiklive-climb");

  const actions = [];
  const engine = new RuleEngine({
    store: storeFor(state),
    actionRunner: {
      async run(action) {
        actions.push(action);
        return { ok: true };
      }
    }
  });

  await engine.process({
    type: "gift",
    source: "tiktok",
    user: { id: "viewer-1", displayName: "Alice" },
    data: { giftName: "Rose", count: 1 }
  });
  await engine.process({
    type: "like",
    source: "tiktok",
    user: { id: "viewer-1", displayName: "Alice" },
    data: { count: 9 }
  });
  await engine.process({
    type: "like",
    source: "tiktok",
    user: { id: "viewer-1", displayName: "Alice" },
    data: { count: 1 }
  });
  await engine.process({
    type: "chat",
    source: "tiktok",
    user: { id: "viewer-1", displayName: "Alice" },
    data: { message: "!spin" }
  });

  assert.equal(actions.length, 3);
  assert.equal(actions[0].config.effectId, "tiklive-climb-souffle");
  assert.equal(actions[1].config.effectId, "tiklive-climb-ballon");
  assert.equal(actions[1].config.parameters.amount, 1);
  assert.equal(actions[2].type, "wheel.spin");
  assert.equal(actions[2].config.wheelId, "wheel_tiklive_climb");
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
      gameEntitlements: ["tiklive-climb"]
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
