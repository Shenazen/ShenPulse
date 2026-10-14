"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  TikLiveStackTowerBridge,
  buildTikLiveStackTowerActionUrl
} = require("../src/main/tiklive-stack-tower-bridge");
const {
  TIKLIVE_STACK_TOWER_DEFAULT_MAPPINGS,
  TIKLIVE_STACK_TOWER_EFFECTS,
  TIKLIVE_STACK_TOWER_WHEEL_PRESETS
} = require("../src/main/tiklive-stack-tower-catalog");
const { GiftCatalog } = require("../src/main/catalogs");
const { GameHub } = require("../src/main/game-hub");
const { GAME_INSTALLERS } = require("../src/main/game-installer-manifest");
const { RuleEngine } = require("../src/main/rule-engine");

const resourcesDirectory = path.join(__dirname, "..", "resources");
const patchScript = fs.readFileSync(
  path.join(__dirname, "..", "scripts", "patch-tiklive-stack-tower.ps1"),
  "utf8"
);

test("affiche Stack Tower comme un jeu à installation automatique", () => {
  const bootstrap = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app", "core", "bootstrap.js"),
    "utf8"
  );
  const gameAccess = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app", "features", "games", "access.js"),
    "utf8"
  );
  assert.match(bootstrap, /"tiklive-stack-tower"/);
  assert.match(gameAccess, /"tiklive-stack-tower"/);
});

test("construit Stack Tower sans modifier l’installation TikLive d’origine", () => {
  assert.match(patchScript, /TIKLIVE_TICKET/);
  assert.match(patchScript, /game-launch-verify\.php/);
  assert.match(patchScript, /game-session\.php/);
  assert.match(patchScript, /TikLiveLicence\.Demarrer bootstrap method/);
  assert.match(patchScript, /removedLicenceKey/);
  assert.match(patchScript, /originalLicenceKeyPreserved/);
  assert.match(patchScript, /removedTikLiveLauncher/);
});

test("publie les 28 effets natifs et les 36 actions de Stack Tower", () => {
  assert.equal(TIKLIVE_STACK_TOWER_EFFECTS.length, 28);
  assert.equal(TIKLIVE_STACK_TOWER_DEFAULT_MAPPINGS.length, 36);
  assert.equal(
    new Set(TIKLIVE_STACK_TOWER_EFFECTS.map((effect) => effect.code)).size,
    28
  );
  assert.equal(
    TIKLIVE_STACK_TOWER_DEFAULT_MAPPINGS.filter(
      (mapping) => mapping.triggerType === "gift"
    ).length,
    31
  );
  assert.deepEqual(
    TIKLIVE_STACK_TOWER_DEFAULT_MAPPINGS
      .filter((mapping) => mapping.triggerType !== "gift")
      .map((mapping) => [mapping.triggerType, mapping.triggerEnabled]),
    [
      ["manual", false],
      ["chat", true],
      ["like", true],
      ["follow", true],
      ["share", true]
    ]
  );
  assert.equal(
    TIKLIVE_STACK_TOWER_DEFAULT_MAPPINGS.find(
      (mapping) => mapping.id === "tiklive-stack-tower-likes-100"
    ).threshold,
    100
  );
  assert.equal(
    TIKLIVE_STACK_TOWER_DEFAULT_MAPPINGS.find(
      (mapping) => mapping.id === "tiklive-stack-tower-spin-chat"
    ).actionType,
    "wheel.spin"
  );
  assert.equal(TIKLIVE_STACK_TOWER_WHEEL_PRESETS.length, 1);
  assert.equal(TIKLIVE_STACK_TOWER_WHEEL_PRESETS[0].segments.length, 15);
  assert.ok(
    TIKLIVE_STACK_TOWER_WHEEL_PRESETS[0].segments.every(
      (segment) => segment.action === "action" && segment.actionId
    )
  );
});

test("traduit une interaction vers l’API locale Stack Tower", () => {
  const action = buildTikLiveStackTowerActionUrl(
    { url: "http://127.0.0.1:7817" },
    { effect: { code: "stabilise", quantity: 15, viewerId: "fallback" } },
    {
      user: { id: "viewer-42", displayName: "Éloïse & Sam" },
      data: { giftName: "Cornet de crème glacée", count: 3, value: 1 }
    }
  );
  assert.equal(action.pathname, "/action");
  assert.equal(action.searchParams.get("fx"), "stabilise");
  assert.equal(action.searchParams.get("n"), "15");
  assert.equal(action.searchParams.get("d"), "3");
  assert.equal(action.searchParams.get("uid"), "viewer-42");
  assert.equal(action.searchParams.get("username"), "Éloïse & Sam");
  assert.equal(Array.from(action.searchParams.keys()).at(-1), "username");

  const wheel = buildTikLiveStackTowerActionUrl(
    {},
    { effect: { code: "roue", quantity: 1 } },
    { user: { displayName: "Nova" }, data: { giftName: "TikTok" } }
  );
  assert.equal(wheel.pathname, "/roue");
  assert.equal(wheel.searchParams.has("fx"), false);
});

test("refuse d’envoyer Stack Tower vers un hôte distant", () => {
  assert.throws(
    () =>
      buildTikLiveStackTowerActionUrl(
        { url: "http://example.com:7817" },
        { effect: { code: "plus1", quantity: 1 } }
      ),
    /rester sur cet ordinateur/
  );
});

test("vérifie l’identité du serveur Stack Tower et remonte ses refus", async () => {
  const calls = [];
  const bridge = new TikLiveStackTowerBridge({
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith("/etat")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ jeu: "tour", scene: "jeu" })
        };
      }
      return { ok: true, status: 200, text: async () => "etages 1 en file" };
    }
  });
  const status = await bridge.status({ url: "http://localhost:7817" });
  const result = await bridge.trigger(
    {},
    { effect: { code: "plus1", quantity: 1 } },
    { user: { displayName: "Nova" } }
  );
  assert.equal(status.ok, true);
  assert.equal(result.sent, true);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.options.method === "GET"));

  const refusingBridge = new TikLiveStackTowerBridge({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => "roue indisponible"
    })
  });
  await assert.rejects(
    refusingBridge.trigger({}, { effect: { code: "random", quantity: 1 } }),
    /roue indisponible/
  );
});

test("branche le catalogue, l’achat et la roue Stack Tower", async () => {
  const state = purchasedGameState();
  const calls = [];
  const tikLiveStackTowerBridge = {
    status: async (connector) => {
      calls.push({ operation: "status", connector });
      return { ok: true, state: { jeu: "tour" } };
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
    giftCatalog: new GiftCatalog(resourcesDirectory),
    tikLiveStackTowerBridge
  });
  hub.loadPacks();

  const pack = hub.listPacks().find(
    (entry) => entry.id === "tiklive-stack-tower"
  );
  assert.ok(pack);
  assert.equal(pack.name, "ShenPulse Stack Tower");
  assert.equal(pack.connector.type, "tiklive-stack-tower-http");
  assert.equal(pack.connector.url, "http://127.0.0.1:7817");
  assert.equal(pack.accessMode, "purchase");
  assert.equal(pack.price, 19.99);
  assert.equal(pack.requiresPro, false);
  assert.equal(pack.artwork, "catalog/shenpulse-stack-tower.png");
  assert.equal(pack.installerVersion, "1.0.0-shenpulse1");

  const initialization = hub.initializeDefaultInteractions(pack.id);
  assert.equal(initialization.added, 36);
  const rules = state.game.interactionRulesByPack[pack.id];
  const giftRules = rules.filter((rule) => rule.trigger.type === "gift");
  assert.equal(giftRules.length, 31);
  assert.ok(
    giftRules.every(
      (rule) => rule.conditions[0].giftId && rule.conditions[0].giftImageUrl
    )
  );
  const spinRule = rules.find(
    (rule) => rule.gameInteraction.presetId === "tiklive-stack-tower-spin-chat"
  );
  assert.equal(spinRule.actions[0].type, "wheel.spin");
  assert.equal(spinRule.actions[0].config.wheelId, "wheel_tiklive_stack_tower");
  assert.equal(
    state.settings.overlayConfigs.wheel.wheels[0].id,
    "wheel_tiklive_stack_tower"
  );

  await hub.testConnection(pack.id);
  await hub.trigger(
    "tiklive-stack-tower-stabilise",
    { user: { id: "viewer", displayName: "Viewer" } },
    { packId: pack.id, parameters: { amount: 18 } }
  );
  assert.deepEqual(calls.map((call) => call.operation), ["status", "trigger"]);
  assert.equal(calls[1].payload.effect.code, "stabilise");
  assert.equal(calls[1].payload.effect.quantity, 18);
});

test("associe le paquet Backblaze et l’exécutable au lanceur ShenPulse", () => {
  const installer = GAME_INSTALLERS["tiklive-stack-tower"];
  assert.equal(installer.managedTarget, true);
  assert.equal(installer.unattended, true);
  assert.equal(installer.assets.length, 1);
  assert.equal(installer.assets[0].action, "extract");
  assert.equal(installer.assets[0].size, 38164935);
  assert.equal(
    installer.assets[0].sha256,
    "32547a3f680581c36fa3d256f5e3e535fdbca6683266e757eec1832a7e12dc7c"
  );
  assert.match(installer.assets[0].url, /backblazeb2\.com/);
  assert.deepEqual(
    installer.launchExecutables,
    ["ShenPulse Stack Tower.exe"]
  );
});

test("déclenche cadeau, likes, partage et !spin pendant une session", async () => {
  const state = purchasedGameState();
  state.session.profileId = "profile-1";
  state.session.game = {
    running: true,
    packId: "tiklive-stack-tower",
    profileId: "profile-1"
  };
  state.profiles = [{ id: "profile-1", enabledRuleIds: [] }];
  const giftCatalog = new GiftCatalog(resourcesDirectory);
  const hub = new GameHub({
    store: storeFor(state),
    resourcesDirectory,
    packsDirectory: path.join(resourcesDirectory, "packs"),
    giftCatalog
  });
  hub.loadPacks();
  hub.initializeDefaultInteractions("tiklive-stack-tower");

  const actions = [];
  const engine = new RuleEngine({
    store: storeFor(state),
    giftCatalog,
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
    data: { giftId: "6064", giftName: "GG", giftCost: 1, count: 1 }
  });
  await engine.process({
    type: "like",
    source: "tiktok",
    user: { id: "viewer-1", displayName: "Alice" },
    data: { count: 100 }
  });
  await engine.process({
    type: "share",
    source: "tiktok",
    user: { id: "viewer-1", displayName: "Alice" },
    data: {}
  });
  await engine.process({
    type: "chat",
    source: "tiktok",
    user: { id: "viewer-1", displayName: "Alice" },
    data: { message: "!spin" }
  });

  assert.equal(actions.length, 4);
  assert.equal(actions[0].config.effectId, "tiklive-stack-tower-plus1");
  assert.equal(actions[1].config.effectId, "tiklive-stack-tower-plus1");
  assert.equal(actions[2].config.effectId, "tiklive-stack-tower-bouclier");
  assert.equal(actions[3].type, "wheel.spin");
  assert.equal(actions[3].config.wheelId, "wheel_tiklive_stack_tower");
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
      },
      overlayConfigs: {}
    },
    session: { activeGamePackId: "coin-pusher" },
    commerce: {
      subscription: { tier: "pro", source: "own", status: "active" },
      gameEntitlements: ["tiklive-stack-tower"]
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
