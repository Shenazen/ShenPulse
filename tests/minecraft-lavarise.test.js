"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { GAME_INSTALLERS } = require("../src/main/game-installer-manifest");
const { createEffectPayload } = require("../src/main/game-hub/effect-payload");
const { parseMinecraftWinCounterLine } = require("../src/main/game-runtime/minecraft-server");
const { defaultGameInteractionRule } = require("../src/main/game-hub/interaction-defaults");
const { GiftCatalog } = require("../src/main/catalogs");
const { ActionRunner } = require("../src/main/action-runner");
const { GameSessionService } = require("../src/main/core/game-sessions");
const pack = loadShenazenGameCatalog(path.resolve("resources")).find(p => p.id === "minecraft-lavarise");

test("Lava Rise uses a managed, isolated local server with a complete remote installer", () => {
  assert.equal(pack.connector.type, "minecraft-runtime");
  assert.equal(pack.serverAddress, "127.0.0.1:25585");
  assert.equal(pack.minecraftVersion, "26.1.2");
  assert.deepEqual(pack.catalogCategories, ["sandbox", "adventure"]);
  const installer = GAME_INSTALLERS[pack.id];
  assert.equal(installer.managedTarget, true);
  assert.equal(installer.requiresMinecraftEula, true);
  assert.equal(installer.minecraftServer.creativeMode, false);
  assert.equal(installer.minecraftServer.port, 25585);
  assert.deepEqual(installer.assets.map(a => a.id), ["paper", "java", "plugin", "config", "serverProperties"]);
  for (const asset of installer.assets) {
    assert.match(asset.url, /^https:\/\/f003\.backblazeb2\.com\/file\/shenpulse-media\/installer-assets\/minecraft-lavarise\/1\.0\.0\//);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert.ok(asset.size > 0);
  }
  assert.doesNotMatch(JSON.stringify(pack) + JSON.stringify(installer), /tik360|synclive|crowd.?control|stream.?to.?earn/i);
});

test("all 24 game effects interpolate parameters and the viewer into local commands", () => {
  const native = pack.effects.filter(e => e.service === "native");
  assert.equal(native.length, 24);
  assert.equal(new Set(native.map(e => e.image)).size, native.length);
  for (const effect of native) {
    assert.ok(fs.existsSync(path.resolve("src/renderer", effect.image)), effect.image);
    assert.ok(effect.name.split(/\s+/).length <= 2);
    const payload = createEffectPayload(effect, { user: { displayName: "Nova Player; op @a" } });
    for (const command of payload.effect.commands) {
      assert.match(command, /^\/(?:lavarise|shenpulse_lava) /);
      assert.doesNotMatch(command, /\{\{|[\r\n;]/);
      if (/\{\{viewer\}\}/.test(effect.command)) assert.match(command, /Nova_Player__op__a$/);
    }
  }
  const payload = createEffectPayload(pack.effects.find(e => e.id === "lava-freeze"), { user: { name: "Viewer" } }, { parameters: { seconds: 9 } });
  assert.equal(payload.effect.command, "/lavarise freeze 9 Viewer");
});

test("presets provide six helps, six traps and real gift IDs for enabled wins", () => {
  const gifts = new GiftCatalog(path.resolve("resources"));
  for (const column of ["help", "trap"]) assert.equal(pack.defaultMappings.filter(m => m.marketColumn === column).length, 6);
  for (const mapping of pack.defaultMappings.filter(m => m.enabled !== false && m.triggerEnabled !== false)) {
    const effect = pack.effects.find(e => e.id === mapping.effectId);
    const rule = defaultGameInteractionRule(pack, effect, mapping, pack.interactionCatalogVersion, gifts);
    assert.ok(rule.conditions.some(c => c.field === "data.giftName" && c.giftId), mapping.id);
  }
});

test("wins adjustments synchronize the configured target and remaining multiplier, including target zero", async () => {
  const state = { session: {}, settings: { overlayConfigs: { winCounter: { target: 0 } } }, overlaySession: { winCounterCurrent: 3 } };
  const commands = [];
  const runner = new ActionRunner({ store: { getState: () => state, mutateRuntime: fn => fn(state) }, gameHub: { assertAccess() {}, executeMinecraftCommands: async (id, list) => { assert.equal(id, pack.id); commands.push(...list); } }, overlayServer: { publish() {} }, notifyRenderer() {} });
  await runner.run({ type: "overlay.win-counter", config: { packId: pack.id, operation: "adjust", amount: 2 } });
  assert.equal(commands.at(-1), "shenpulse_lava sync 5 1 0 0");
  await runner.run({ type: "overlay.win-counter", config: { packId: pack.id, operation: "multiplier", amount: 3, duration: 10 } });
  assert.match(commands.at(-1), /^shenpulse_lava sync 5 3 (?:9|10) 0$/);
});

test("native results update only an active Lava Rise session and never send a result back into the game", async () => {
  assert.deepEqual(parseMinecraftWinCounterLine("SHENPULSE_WIN_COUNTER current=-3 source=lava-loss"), { current: -3, source: "lava-loss", outcome: "loss" });
  assert.equal(parseMinecraftWinCounterLine("SHENPULSE_WIN_COUNTER current=3 source=sync"), null);
  const state = { session: { game: { running: true, packId: pack.id } }, overlaySession: { winCounterCurrent: 0 } };
  const actions = [];
  const service = new GameSessionService({ store: { getState: () => state }, gameHub: { listPacks: () => [pack] }, minecraftRoundTimer: { resolveNativeOutcome: async () => ({ resolved: false }) }, actionRunner: { run: async action => { actions.push(action); return { current: action.config.amount }; } }, notifyRenderer() {}, onActivity() {}, onChanged() {} });
  assert.equal((await service.handleMinecraftWinCounter({ gameId: pack.id, current: -3, source: "lava-loss", outcome: "loss" })).synchronized, true);
  assert.equal(actions[0].config.operation, "set");
  assert.equal(actions[0].config.packId, undefined);
  state.session.game.packId = "minecraft-bedrock-box";
  assert.equal((await service.handleMinecraftWinCounter({ gameId: pack.id, current: 1 })).synchronized, false);
  assert.equal(actions.length, 1);
});
