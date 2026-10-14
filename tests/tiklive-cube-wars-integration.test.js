"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  TikLiveCubeWarsBridge,
  buildTikLiveCubeWarsActionUrl
} = require("../src/main/tiklive-cube-wars-bridge");
const {
  TIKLIVE_CUBE_WARS_DEFAULT_MAPPINGS,
  TIKLIVE_CUBE_WARS_EFFECTS,
  TIKLIVE_CUBE_WARS_WHEEL_PRESETS
} = require("../src/main/tiklive-cube-wars-catalog");
const { GameHub } = require("../src/main/game-hub");
const { GAME_INSTALLERS } = require("../src/main/game-installer-manifest");
const { RuleEngine } = require("../src/main/rule-engine");

const resourcesDirectory = path.join(__dirname, "..", "resources");
const patchScript = fs.readFileSync(
  path.join(__dirname, "..", "scripts", "patch-tiklive-cube-wars.ps1"),
  "utf8"
);

test("affiche Cube Wars comme un jeu à installation automatique", () => {
  const bootstrap = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app", "core", "bootstrap.js"),
    "utf8"
  );
  const gameAccess = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app", "features", "games", "access.js"),
    "utf8"
  );
  assert.match(bootstrap, /"tiklive-cube-wars"/);
  assert.match(gameAccess, /"tiklive-cube-wars"/);
});

test("construit une copie autonome sans modifier l’installation d’origine", () => {
  assert.match(patchScript, /TIKLIVE_TICKET/);
  assert.match(patchScript, /game-launch-verify\.php/);
  assert.match(patchScript, /game-session\.php/);
  assert.match(patchScript, /TikLiveLicence\.Demarrer bootstrap method/);
  assert.match(patchScript, /removedLicenceKey/);
  assert.match(patchScript, /originalLicenceKeyPreserved/);
  assert.match(patchScript, /removedTikLiveLauncher/);
});

test("publie les effets natifs, H\/F et les interactions actives de Cube Wars", () => {
  assert.equal(TIKLIVE_CUBE_WARS_EFFECTS.length, 18);
  assert.equal(TIKLIVE_CUBE_WARS_DEFAULT_MAPPINGS.length, 31);
  assert.equal(
    new Set(TIKLIVE_CUBE_WARS_EFFECTS.map((effect) => effect.code)).size,
    18
  );
  assert.ok(
    TIKLIVE_CUBE_WARS_DEFAULT_MAPPINGS.every(
      (mapping) => mapping.triggerEnabled === true
    )
  );
  assert.deepEqual(
    TIKLIVE_CUBE_WARS_DEFAULT_MAPPINGS
      .filter((mapping) => mapping.triggerType !== "gift")
      .map((mapping) => mapping.triggerType),
    ["chat", "chat", "chat", "like", "follow", "share"]
  );
  assert.equal(
    TIKLIVE_CUBE_WARS_DEFAULT_MAPPINGS.find(
      (mapping) => mapping.id === "tiklive-cube-wars-spin-chat"
    ).actionType,
    "wheel.spin"
  );
  assert.equal(TIKLIVE_CUBE_WARS_WHEEL_PRESETS.length, 1);
  assert.equal(TIKLIVE_CUBE_WARS_WHEEL_PRESETS[0].segments.length, 10);
  assert.ok(
    TIKLIVE_CUBE_WARS_WHEEL_PRESETS[0].segments.every(
      (segment) => segment.action === "action" && segment.actionId
    )
  );
});

test("traduit les effets, la roue et le choix de camp vers l’API locale", () => {
  const action = buildTikLiveCubeWarsActionUrl(
    { url: "http://127.0.0.1:7811" },
    { effect: { code: "vague", quantity: 8, viewerId: "fallback" } },
    {
      user: { id: "viewer-42", displayName: "Éloïse & Sam" },
      data: { giftName: "Cœur & Rose", count: 3, value: 5 }
    }
  );
  assert.equal(action.pathname, "/action");
  assert.equal(action.searchParams.get("fx"), "vague");
  assert.equal(action.searchParams.get("n"), "8");
  assert.equal(action.searchParams.get("d"), "15");
  assert.equal(action.searchParams.get("uid"), "viewer-42");
  assert.equal(action.searchParams.get("username"), "Éloïse & Sam");
  assert.equal(Array.from(action.searchParams.keys()).at(-1), "username");

  const wheel = buildTikLiveCubeWarsActionUrl(
    {},
    { effect: { code: "roue", quantity: 1 } },
    { user: { displayName: "Nova" }, data: { giftName: "TikTok" } }
  );
  assert.equal(wheel.pathname, "/roue");
  assert.equal(wheel.searchParams.has("fx"), false);

  const team = buildTikLiveCubeWarsActionUrl(
    {},
    { effect: { code: "camp-femme", quantity: 1 } },
    { user: { id: "viewer-f", displayName: "Nova" } }
  );
  assert.equal(team.pathname, "/evt");
  assert.equal(team.searchParams.get("type"), "chat");
  assert.equal(team.searchParams.get("txt"), "F");
  assert.equal(Array.from(team.searchParams.keys()).at(-1), "username");
});

test("refuse d’envoyer Cube Wars vers un hôte distant", () => {
  assert.throws(
    () =>
      buildTikLiveCubeWarsActionUrl(
        { url: "http://example.com:7811" },
        { effect: { code: "pousse", quantity: 1 } }
      ),
    /rester sur cet ordinateur/
  );
});

test("vérifie l’identité du serveur Cube Wars et remonte ses refus", async () => {
  const calls = [];
  const bridge = new TikLiveCubeWarsBridge({
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith("/etat")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ jeu: "cubewars", scene: "menu" })
        };
      }
      return { ok: true, status: 200, text: async () => "Action reçue" };
    }
  });
  const status = await bridge.status({ url: "http://localhost:7811" });
  const result = await bridge.trigger(
    {},
    { effect: { code: "bombe", quantity: 1 } },
    { user: { displayName: "Nova" } }
  );
  assert.equal(status.ok, true);
  assert.equal(result.sent, true);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.options.method === "GET"));

  const refusingBridge = new TikLiveCubeWarsBridge({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => "La partie n’est pas lancée"
    })
  });
  await assert.rejects(
    refusingBridge.trigger({}, { effect: { code: "meteore", quantity: 1 } }),
    /partie n’est pas lancée/
  );
});

test("branche le catalogue ShenPulse, l’achat et l’overlay Cube Wars", async () => {
  const state = purchasedGameState();
  const calls = [];
  const tikLiveCubeWarsBridge = {
    status: async (connector) => {
      calls.push({ operation: "status", connector });
      return { ok: true, state: { jeu: "cubewars" } };
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
    tikLiveCubeWarsBridge
  });
  hub.loadPacks();

  const pack = hub.listPacks().find((entry) => entry.id === "tiklive-cube-wars");
  assert.ok(pack);
  assert.equal(pack.connector.type, "tiklive-cube-wars-http");
  assert.equal(pack.connector.url, "http://127.0.0.1:7811");
  assert.equal(pack.accessMode, "purchase");
  assert.equal(pack.price, 19.99);
  assert.equal(pack.requiresPro, false);
  assert.equal(pack.artwork, "catalog/shenpulse-cube-wars.png");
  assert.equal(pack.installerVersion, "1.0.0-shenpulse1");

  const initialization = hub.initializeDefaultInteractions(pack.id);
  assert.equal(initialization.added, 31);
  const rules = state.game.interactionRulesByPack[pack.id];
  const spinRule = rules.find(
    (rule) => rule.gameInteraction.presetId === "tiklive-cube-wars-spin-chat"
  );
  assert.equal(spinRule.actions[0].type, "wheel.spin");
  assert.equal(spinRule.actions[0].config.wheelId, "wheel_tiklive_cube_wars");
  assert.equal(
    state.settings.overlayConfigs.wheel.wheels[0].id,
    "wheel_tiklive_cube_wars"
  );

  await hub.testConnection(pack.id);
  await hub.trigger(
    "tiklive-cube-wars-vague",
    { user: { id: "viewer", displayName: "Viewer" }, data: { giftName: "Rose" } },
    { packId: pack.id, parameters: { amount: 12 } }
  );
  assert.deepEqual(calls.map((call) => call.operation), ["status", "trigger"]);
  assert.equal(calls[1].payload.effect.code, "vague");
  assert.equal(calls[1].payload.effect.quantity, 12);
});

test("associe le paquet Backblaze et l’exécutable au lanceur ShenPulse", () => {
  const installer = GAME_INSTALLERS["tiklive-cube-wars"];
  assert.equal(installer.managedTarget, true);
  assert.equal(installer.unattended, true);
  assert.equal(installer.assets.length, 1);
  assert.equal(installer.assets[0].action, "extract");
  assert.ok(installer.assets[0].size > 10_000_000);
  assert.match(installer.assets[0].sha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(installer.assets[0].sha256, /^0+$/);
  assert.match(installer.assets[0].url, /backblazeb2\.com/);
  assert.deepEqual(installer.launchExecutables, ["ShenPulse Cube Wars.exe"]);
});

test("déclenche cadeau, H\/F, likes et !spin pendant une session Cube Wars", async () => {
  const state = purchasedGameState();
  state.session.profileId = "profile-1";
  state.session.game = {
    running: true,
    packId: "tiklive-cube-wars",
    profileId: "profile-1"
  };
  state.profiles = [{ id: "profile-1", enabledRuleIds: [] }];
  const hub = new GameHub({
    store: storeFor(state),
    resourcesDirectory,
    packsDirectory: path.join(resourcesDirectory, "packs")
  });
  hub.loadPacks();
  hub.initializeDefaultInteractions("tiklive-cube-wars");

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
    type: "chat",
    source: "tiktok",
    user: { id: "viewer-1", displayName: "Alice" },
    data: { message: "F" }
  });
  await engine.process({
    type: "like",
    source: "tiktok",
    user: { id: "viewer-1", displayName: "Alice" },
    data: { count: 10 }
  });
  await engine.process({
    type: "chat",
    source: "tiktok",
    user: { id: "viewer-1", displayName: "Alice" },
    data: { message: "!spin" }
  });

  assert.equal(actions.length, 4);
  assert.equal(actions[0].config.effectId, "tiklive-cube-wars-pousse");
  assert.equal(actions[1].config.effectId, "tiklive-cube-wars-camp-femme");
  assert.equal(actions[2].config.effectId, "tiklive-cube-wars-pousse");
  assert.equal(actions[3].type, "wheel.spin");
  assert.equal(actions[3].config.wheelId, "wheel_tiklive_cube_wars");
});

function purchasedGameState() {
  // Depuis la politique Pro, l’achat du produit s’ajoute à un accès Pro actif.
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
      subscription: { tier: "pro", source: "own", status: "active" },
      gameEntitlements: ["tiklive-cube-wars"]
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
