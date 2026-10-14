"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  ColorStrikeBridge,
  buildColorStrikeActionUrl
} = require("../src/main/color-strike-bridge");
const {
  COLOR_STRIKE_DEFAULT_MAPPINGS,
  COLOR_STRIKE_EFFECTS,
  COLOR_STRIKE_WHEEL_PRESETS
} = require("../src/main/color-strike-catalog");
const { GameHub } = require("../src/main/game-hub");
const { GAME_INSTALLERS } = require("../src/main/game-installer-manifest");
const { RuleEngine } = require("../src/main/rule-engine");

const resourcesDirectory = path.join(__dirname, "..", "resources");
const colorStrikePatchScript = fs.readFileSync(
  path.join(__dirname, "..", "scripts", "patch-color-strike.ps1"),
  "utf8"
);

test("affiche Color Strike comme un jeu à installation automatique", () => {
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
  const automatedInstallerSet = bootstrap.slice(
    bootstrap.indexOf("const AUTOMATED_GAME_INSTALLERS"),
    bootstrap.indexOf("const MANAGED_BIZHAWK_GAME_IDS")
  );

  assert.match(automatedInstallerSet, /"color-strike"/);
});

test("la version autonome autorise les effets avancés en partie solo", () => {
  assert.match(colorStrikePatchScript, /seulement en partie multi/);
  assert.match(colorStrikePatchScript, /SoloRestrictionNull\.OpCode/);
  assert.match(colorStrikePatchScript, /patchedSoloOnlyEffects = \$true/);
});

test("publie les 41 effets et les 35 interactions actives de Color Strike", () => {
  assert.equal(COLOR_STRIKE_EFFECTS.length, 41);
  assert.equal(COLOR_STRIKE_DEFAULT_MAPPINGS.length, 35);
  assert.equal(
    new Set(COLOR_STRIKE_EFFECTS.map((effect) => effect.code)).size,
    41
  );
  assert.ok(
    COLOR_STRIKE_DEFAULT_MAPPINGS.every(
      (mapping) => mapping.triggerEnabled === true
    )
  );
  assert.deepEqual(
    COLOR_STRIKE_DEFAULT_MAPPINGS
      .filter((mapping) => mapping.triggerType !== "gift")
      .map((mapping) => mapping.triggerType),
    ["chat", "like", "follow", "share"]
  );
  assert.equal(
    COLOR_STRIKE_DEFAULT_MAPPINGS.find(
      (mapping) => mapping.id === "color-strike-blue-small-15"
    ).parameters.amount,
    15
  );
  assert.equal(
    COLOR_STRIKE_DEFAULT_MAPPINGS.find(
      (mapping) => mapping.id === "color-strike-spin-chat"
    ).actionType,
    "wheel.spin"
  );
  assert.equal(COLOR_STRIKE_WHEEL_PRESETS.length, 1);
  assert.equal(COLOR_STRIKE_WHEEL_PRESETS[0].segments.length, 12);
  assert.ok(
    COLOR_STRIKE_WHEEL_PRESETS[0].segments.every(
      (segment) => segment.action === "action" && segment.actionId
    )
  );
});

test("traduit un événement ShenPulse vers l’API locale de Color Strike", () => {
  const url = buildColorStrikeActionUrl(
    { url: "http://127.0.0.1:7444" },
    {
      effect: {
        code: "bombe",
        quantity: 7,
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

  assert.equal(url.origin, "http://127.0.0.1:7444");
  assert.equal(url.pathname, "/action");
  assert.equal(url.searchParams.get("fx"), "bombe");
  assert.equal(url.searchParams.get("n"), "7");
  assert.equal(url.searchParams.get("d"), "15");
  assert.equal(url.searchParams.get("username"), "Éloïse & Sam");
  assert.equal(url.searchParams.get("uid"), "viewer-42");
  assert.equal(url.searchParams.get("gift"), "Cœur & Rose");
  assert.equal(
    Array.from(url.searchParams.keys()).at(-1),
    "username",
    "Color Strike exige username en dernier dans la chaîne de requête"
  );
});

test("refuse d’envoyer les interactions Color Strike vers un hôte distant", () => {
  assert.throws(
    () =>
      buildColorStrikeActionUrl(
        { url: "http://example.com:7444" },
        { effect: { code: "bombe", quantity: 1 } }
      ),
    /rester sur cet ordinateur/
  );
});

test("vérifie l’état et envoie une action avec des requêtes GET locales", async () => {
  const calls = [];
  const bridge = new ColorStrikeBridge({
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith("/etat")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ jeu: "colorstrike", scene: "menu" })
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => "Action reçue"
      };
    }
  });

  const status = await bridge.status({ url: "http://localhost:7444" });
  const result = await bridge.trigger(
    { url: "http://localhost:7444" },
    { effect: { code: "boost", quantity: 25 } },
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
  const bridge = new ColorStrikeBridge({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => "seulement en partie multi"
    })
  });

  await assert.rejects(
    bridge.trigger({}, { effect: { code: "nuke", quantity: 1 } }),
    /seulement en partie multi/
  );
});

test("branche le catalogue ShenPulse sur le pont Color Strike", async () => {
  const state = purchasedGameState();
  state.game.interactionCatalogVersions["color-strike"] = 20261012;
  state.game.interactionRulesByPack["color-strike"] = [{
    id: "rule_color-strike_color-strike-bombe",
    enabled: false,
    gameInteraction: {
      catalogVersion: 20261012,
      default: true,
      presetId: "color-strike-bombe"
    },
    actions: []
  }];
  const calls = [];
  const colorStrikeBridge = {
    status: async (connector) => {
      calls.push({ operation: "status", connector });
      return { ok: true, state: { jeu: "colorstrike" } };
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
    colorStrikeBridge
  });
  hub.loadPacks();

  const pack = hub.listPacks().find((entry) => entry.id === "color-strike");
  assert.ok(pack);
  assert.equal(pack.connector.type, "color-strike-http");
  assert.equal(pack.connector.url, "http://127.0.0.1:7444");
  assert.equal(pack.accessMode, "purchase");
  assert.equal(pack.price, 19.99);
  assert.equal(pack.requiresPro, false);
  assert.equal(pack.installerVersion, "1.0.9-shenpulse2");
  const initialization = hub.initializeDefaultInteractions(pack.id);
  assert.equal(initialization.added, 35);
  assert.equal(initialization.removed, 1);
  const rules = state.game.interactionRulesByPack[pack.id];
  const spinRule = rules.find(
    (rule) => rule.gameInteraction.presetId === "color-strike-spin-chat"
  );
  assert.equal(spinRule.trigger.type, "chat");
  assert.equal(spinRule.conditions[0].value, "^\\s*!spin\\s*$");
  assert.equal(spinRule.actions[0].type, "wheel.spin");
  assert.equal(spinRule.actions[0].config.wheelId, "wheel_color_strike");
  assert.equal(
    state.settings.overlayConfigs.wheel.wheels[0].id,
    "wheel_color_strike"
  );

  await hub.testConnection(pack.id);
  await hub.trigger(
    "color-strike-bombe",
    {
      user: { id: "viewer", displayName: "Viewer" },
      data: { giftName: "Rose", count: 1, value: 1 }
    },
    { packId: pack.id, parameters: { amount: 9 } }
  );

  assert.deepEqual(
    calls.map((call) => call.operation),
    ["status", "trigger"]
  );
  assert.equal(calls[1].payload.effect.code, "bombe");
  assert.equal(calls[1].payload.effect.quantity, 9);
  assert.equal(calls[1].context.data.giftName, "Rose");
});

test("associe le dossier autonome et son exécutable au lanceur ShenPulse", () => {
  const installer = GAME_INSTALLERS["color-strike"];
  assert.equal(installer.managedTarget, true);
  assert.equal(installer.unattended, true);
  assert.equal(installer.assets.length, 1);
  assert.equal(installer.assets[0].action, "extract");
  assert.equal(installer.assets[0].size, 36481280);
  assert.equal(
    installer.assets[0].sha256,
    "3651ae7d70629530dd47c9945c360bd869dd642e41ed8b86a12dc73d21062d7d"
  );
  assert.match(installer.assets[0].url, /backblazeb2\.com/);
  assert.deepEqual(installer.launchExecutables, ["ShenPulse Color Strike.exe"]);
});

test("déclenche les cadeaux, likes et !spin pendant une session Color Strike", async () => {
  const state = purchasedGameState();
  state.session.profileId = "profile-1";
  state.session.game = {
    running: true,
    packId: "color-strike",
    profileId: "profile-1"
  };
  state.profiles = [{ id: "profile-1", enabledRuleIds: [] }];
  const hub = new GameHub({
    store: storeFor(state),
    resourcesDirectory,
    packsDirectory: path.join(resourcesDirectory, "packs")
  });
  hub.loadPacks();
  hub.initializeDefaultInteractions("color-strike");

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
  assert.equal(actions[0].config.effectId, "color-strike-bombepetite");
  assert.equal(actions[0].config.parameters.amount, 1);
  assert.equal(actions[1].config.effectId, "color-strike-eclabousse");
  assert.equal(actions[2].type, "wheel.spin");
  assert.equal(actions[2].config.wheelId, "wheel_color_strike");
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
      subscription: {
        tier: "pro",
        source: "own",
        status: "active"
      },
      gameEntitlements: ["color-strike"]
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
