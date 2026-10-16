"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const publicHub = require("../src/main/game-hub");
const { createDefaultState } = require("../src/main/defaults");
const { selectStatePaths } = require("../src/main/state-projection");
const { createEffectPayload } = require("../src/main/game-hub/effect-payload");
const { defaultEffectParameters } = require("../src/main/game-hub/commands");
const { defaultGameInteractionRule } = require("../src/main/game-hub/interaction-defaults");
const { httpBridgeFor } = require("../src/main/game-hub/http-bridges");

function fixture(extra = {}) {
  const state = createDefaultState();
  state.settings.account = { uid: "fixture", email: "fixture@example.test", refreshTokenSecretId: "account" };
  state.commerce.subscription = { tier: "pro", status: "active" };
  const projections = [];
  const store = {
    getStateProjection(paths) { projections.push(paths); return selectStatePaths(state, paths); },
    getState() { throw new Error("Un effet ne doit pas cloner l'état complet."); },
    getSecret(id) { return id === "account" ? "fixture-only-token" : ""; }
  };
  const hub = new publicHub.GameHub({
    store, packsDirectory: path.join(__dirname, "..", "resources", "packs"), ...extra
  });
  const pack = {
    id: "test-pack", name: "Test", accessMode: "included", requiresPro: false,
    connector: { type: "demo" }, effects: [{
      id: "test-effect", name: "Effet", code: "give {{viewer}} {{count}}",
      available: true, parameters: [{ id: "count", defaultValue: 3 }]
    }]
  };
  hub.packs = [pack];
  state.session.activeGamePackId = pack.id;
  return { state, hub, pack, projections };
}

test("la façade GameHub conserve exactement les six exports historiques", () => {
  assert.deepEqual(Object.keys(publicHub).sort(), [
    "GameHub", "interpolateCommand", "rconPacket", "readRconPacket", "resolveEffectCode", "validatePack"
  ]);
});

test("un effet garde ses événements et paramètres sans aucune copie complète d'état", async () => {
  const { hub, pack, projections } = fixture();
  const events = [];
  hub.on("effect-start", (event) => events.push(["start", event]));
  hub.on("effect-result", (event) => events.push(["result", event]));
  assert.equal((await hub.trigger("test-effect", {
    user: { id: "viewer", displayName: "Nova Player" }
  }, { packId: pack.id, parameters: { count: 7 } })).status, "success");
  assert.deepEqual(events.map(([name]) => name), ["start", "result"]);
  assert.equal(events[0][1].payload, events[1][1].payload);
  assert.equal(events[0][1].payload.effect.command, "give Nova_Player 7");
  assert.equal(events[0][1].payload.effect.viewerId, "viewer");
  assert.ok(projections.some((paths) => paths.includes("commerce.subscription") && paths.includes("commerce.gameEntitlements")));
  assert.ok(projections.some((paths) => paths.includes("settings.account") && paths.includes("settings.siteVisibility")));
  const allowed = new Set(["commerce.subscription", "commerce.gameEntitlements", "settings.account", "settings.siteVisibility", "session.profileId", "game.connectorOverrides"]);
  assert.ok(projections.every((paths) => paths.every((key) => allowed.has(key))), "les gardes ne projettent jamais règles, profils complets, catalogue ou historique");
  await hub.trigger("test-effect");
  assert.ok(projections.some((paths) => paths.includes("session.activeGamePackId")));
});

test("la projection conserve le verrou commercial avant tout événement ou transport", async () => {
  const { hub, pack, state } = fixture();
  state.commerce.subscription = { tier: "free", status: "free" };
  pack.requiresPro = true;
  let started = 0;
  hub.on("effect-start", () => { started += 1; });
  await assert.rejects(hub.trigger("test-effect", {}, { packId: pack.id }), /abonnement ShenPulse/);
  assert.equal(started, 0);
  state.commerce.subscription = { tier: "pro", source: "own", status: "active" };
  pack.accessMode = "purchase";
  await assert.rejects(hub.trigger("test-effect", {}, { packId: pack.id }), /achat ou un essai/);
  assert.equal(started, 0);
  state.commerce.gameEntitlements = [{ gameId: pack.id, source: "purchase", status: "paid" }];
  await hub.trigger("test-effect", {}, { packId: pack.id });
  assert.equal(started, 1);
});

test("les paramètres initiaux mutualisés servent à la règle et à la charge utile sans alias", () => {
  const effect = {
    id: "effect", name: "Effet", command: "{{count}}", quantityParameter: "count",
    parameters: [{ id: "count", defaultValue: "4" }, { id: "duration", defaultValue: 8 }]
  };
  const pack = { id: "pack", name: "Pack" };
  const rule = defaultGameInteractionRule(pack, effect, { id: "preset" }, 1);
  const payload = createEffectPayload(effect);
  assert.deepEqual(rule.actions[0].config.parameters, defaultEffectParameters(effect));
  assert.deepEqual(payload.effect.parameters, rule.actions[0].config.parameters);
  assert.equal(payload.effect.quantity, 4);
  payload.effect.parameters.count = 99;
  assert.equal(rule.actions[0].config.parameters.count, 4);
});

test("les six passerelles HTTP réutilisent le même registre pour diagnostic et exécution", async () => {
  const mappings = [
    ["color-strike-http", "colorStrikeBridge"], ["tiklive-climb-http", "tikLiveClimbBridge"],
    ["tiklive-cube-wars-http", "tikLiveCubeWarsBridge"],
    ["tiklive-stack-tower-http", "tikLiveStackTowerBridge"], ["clash-of-live-http", "clashOfLiveBridge"],
    ["find-the-needle-http", "findTheNeedleBridge"]
  ];
  for (const [type, property] of mappings) {
    const calls = [];
    const bridge = {
      async status(connector) { calls.push(["status", connector]); return { ok: true }; },
      async trigger(connector, payload, context) {
        calls.push(["trigger", connector, payload, context]);
        return { status: "success" };
      }
    };
    const { hub, pack } = fixture({ [property]: bridge });
    pack.connector.type = type;
    assert.equal(httpBridgeFor(hub, type), bridge);
    assert.equal((await hub.testConnection(pack.id)).ok, true);
    const context = { user: { id: "viewer" } };
    await hub.trigger("test-effect", context, { packId: pack.id });
    assert.deepEqual(calls.map(([name]) => name), ["status", "trigger"]);
    assert.equal(calls[1][3].user, context.user);
    assert.equal(typeof calls[1][3].assertGameAccess, "function");
    assert.equal(context.assertGameAccess, undefined, "la capture des droits ne modifie pas le contexte d’origine");
    assert.equal(calls[1][2].effect.viewerId, "viewer");
  }
  assert.equal(httpBridgeFor({}, "constructor"), null);
  assert.equal(httpBridgeFor({}, "unknown"), null);
});

test("les transports partagent et libèrent les caches historiques de la façade", async () => {
  const { hub } = fixture();
  let socketCloses = 0;
  let bridgeCloses = 0;
  hub.sockets = new Map([["socket", { destroy() { socketCloses += 1; } }]]);
  hub.serverBridges = new Map([["bridge", { async close() { bridgeCloses += 1; } }]]);
  assert.equal(hub.transports.sockets, hub.sockets);
  assert.equal(hub.transports.serverBridges, hub.serverBridges);
  await hub.disconnectAll();
  assert.equal(socketCloses, 1);
  assert.equal(bridgeCloses, 1);
  assert.equal(hub.sockets.size, 0);
  assert.equal(hub.serverBridges.size, 0);
});
