"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  ClashOfLiveBridge,
  buildClashOfLiveActionUrl
} = require("../src/main/clash-of-live-bridge");
const {
  CLASH_OF_LIVE_DEFAULT_MAPPINGS,
  CLASH_OF_LIVE_EFFECTS,
  CLASH_OF_LIVE_WHEEL_PRESETS
} = require("../src/main/clash-of-live-catalog");
const { GameHub } = require("../src/main/game-hub");
const { GAME_INSTALLERS } = require("../src/main/game-installer-manifest");

const resourcesDirectory = path.join(__dirname, "..", "resources");
const patchScript = fs.readFileSync(
  path.join(__dirname, "..", "scripts", "patch-clash-of-live.ps1"),
  "utf8"
);

test("affiche Clash Of ShenPulse comme un jeu à installation automatique", () => {
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
  assert.match(bootstrap, /"clash-of-live"/);
  assert.match(gameAccess, /"clash-of-live"/);
});

test("construit une copie autonome et préserve la licence originale", () => {
  assert.match(patchScript, /validate-license\.php/);
  assert.match(patchScript, /game-launch-verify\.php/);
  assert.match(patchScript, /game-session\.php/);
  assert.match(patchScript, /TIKLIVE_TICKET/);
  assert.match(patchScript, /TikLiveLicence\.Demarrer bootstrap method/);
  assert.match(patchScript, /removedLicenceKey/);
  assert.match(patchScript, /removedTikLiveLauncher/);
  assert.match(patchScript, /originalLicenceKeyPreserved/);
  assert.match(patchScript, /patch-unity-texture\.py/);
});

test("publie les 15 effets et les 17 interactions actives", () => {
  assert.equal(CLASH_OF_LIVE_EFFECTS.length, 15);
  assert.equal(CLASH_OF_LIVE_DEFAULT_MAPPINGS.length, 17);
  assert.equal(
    new Set(CLASH_OF_LIVE_EFFECTS.map((effect) => effect.code)).size,
    15
  );
  assert.ok(
    CLASH_OF_LIVE_DEFAULT_MAPPINGS.every(
      (mapping) => mapping.triggerEnabled === true
    )
  );
  assert.deepEqual(
    CLASH_OF_LIVE_DEFAULT_MAPPINGS
      .filter((mapping) => mapping.triggerType !== "gift")
      .map((mapping) => mapping.triggerType),
    ["chat", "like", "follow", "share"]
  );
  assert.equal(CLASH_OF_LIVE_WHEEL_PRESETS.length, 1);
  assert.equal(CLASH_OF_LIVE_WHEEL_PRESETS[0].segments.length, 12);
  assert.equal(
    CLASH_OF_LIVE_DEFAULT_MAPPINGS.find(
      (mapping) => mapping.id === "clash-of-live-spin-chat"
    ).actionType,
    "wheel.spin"
  );
});

test("traduit un événement ShenPulse vers une route locale du jeu", () => {
  const url = buildClashOfLiveActionUrl(
    { url: "http://127.0.0.1:4244" },
    { effect: { code: "rouge/dragon", quantity: 1 } },
    {
      user: {
        displayName: "Éloïse & Sam",
        avatarUrl: "https://images.example/avatar 42.png"
      }
    }
  );
  assert.equal(url.origin, "http://127.0.0.1:4244");
  assert.equal(url.pathname, "/rouge/dragon");
  assert.equal(url.searchParams.get("username"), "Éloïse & Sam");
  assert.equal(
    url.searchParams.get("avatar"),
    "https://images.example/avatar 42.png"
  );
});

test("refuse toute passerelle distante", () => {
  assert.throws(
    () =>
      buildClashOfLiveActionUrl(
        { url: "http://example.com:4244" },
        { effect: { code: "bleu/squelette", quantity: 1 } }
      ),
    /rester sur cet ordinateur/
  );
});

test("vérifie le service et répète une invocation multiple", async () => {
  const calls = [];
  const bridge = new ClashOfLiveBridge({
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return {
        ok: true,
        status: 200,
        json: async () =>
          String(url).endsWith("/health")
            ? { ok: true, port: 4244, enAttente: 0 }
            : { ok: true, unite: "squelette", camp: "bleu" }
      };
    }
  });

  const status = await bridge.status({ url: "http://localhost:4244" });
  const result = await bridge.trigger(
    { url: "http://localhost:4244" },
    { effect: { code: "bleu/squelette", quantity: 3 } },
    { user: { displayName: "Nova" } }
  );

  assert.equal(status.ok, true);
  assert.equal(result.sent, true);
  assert.equal(result.count, 3);
  assert.equal(calls.length, 4);
  assert.ok(calls.every((call) => call.options.method === "GET"));
});

test("branche le catalogue, la roue et le pont Clash Of ShenPulse", async () => {
  const state = subscribedState();
  const calls = [];
  const clashOfLiveBridge = {
    status: async (connector) => {
      calls.push({ operation: "status", connector });
      return { ok: true, state: { port: 4244 } };
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
    clashOfLiveBridge
  });
  hub.loadPacks();

  const pack = hub.listPacks().find((entry) => entry.id === "clash-of-live");
  assert.ok(pack);
  assert.equal(pack.name, "Clash Of ShenPulse");
  assert.equal(pack.connector.type, "clash-of-live-http");
  assert.equal(pack.connector.url, "http://127.0.0.1:4244");
  assert.equal(pack.price, 19.99);
  assert.equal(pack.requiresPro, true);
  assert.equal(pack.installerVersion, "1.0.0-shenpulse1");

  const initialized = hub.initializeDefaultInteractions(pack.id);
  assert.equal(initialized.added, 17);
  const spinRule = state.game.interactionRulesByPack[pack.id].find(
    (rule) => rule.gameInteraction.presetId === "clash-of-live-spin-chat"
  );
  assert.equal(spinRule.actions[0].type, "wheel.spin");
  assert.equal(spinRule.actions[0].config.wheelId, "wheel_clash_of_live");

  await hub.testConnection(pack.id);
  await hub.trigger(
    "clash-of-live-rouge-squelette",
    { user: { displayName: "Viewer" }, data: { giftName: "Rose" } },
    { packId: pack.id, parameters: { amount: 3 } }
  );
  assert.deepEqual(
    calls.map((call) => call.operation),
    ["status", "trigger"]
  );
  assert.equal(calls[1].payload.effect.code, "rouge/squelette");
  assert.equal(calls[1].payload.effect.quantity, 3);
});

test("associe l’archive Backblaze et l’exécutable autonome", () => {
  const installer = GAME_INSTALLERS["clash-of-live"];
  assert.equal(installer.managedTarget, true);
  assert.equal(installer.unattended, true);
  assert.deepEqual(installer.launchExecutables, ["Clash Of ShenPulse.exe"]);
  assert.equal(installer.assets.length, 1);
  assert.equal(installer.assets[0].action, "extract");
  assert.equal(installer.assets[0].size, 35021268);
  assert.equal(
    installer.assets[0].sha256,
    "bf49da011d7029864e1456eab64700d448b476cdefeaf4a95ceb1e4456c98a56"
  );
  assert.match(installer.assets[0].url, /backblazeb2\.com/);
});

function subscribedState() {
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
      subscription: {
        tier: "pro",
        source: "subscription",
        status: "active"
      },
      gameEntitlements: ["clash-of-live"]
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
