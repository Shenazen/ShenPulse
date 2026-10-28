"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), net = require("node:net");
const { execFileSync } = require("node:child_process");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { ShopGameBridge } = require("../src/main/shop-game-bridge");
const { RuleEngine } = require("../src/main/rule-engine"), { ActionRunner } = require("../src/main/action-runner"), { GameHub } = require("../src/main/game-hub");
const { createDefaultState } = require("../src/main/defaults"), { getRuleEngineState, getStateProjection } = require("../src/main/state/projections");
const { defaultGameInteractionRule } = require("../src/main/game-hub/interaction-defaults"), { normalizeEvent } = require("../src/main/event-normalizer");
const { authenticatedFixtureStore } = require("./helpers/authenticated-store");
const root = path.resolve(__dirname, ".."), gameId = "shift-at-midnight", token = "b".repeat(64);
const pack = () => loadShenazenGameCatalog(path.join(root, "resources")).find(game => game.id === gameId);
async function temp(t) { const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-shift-")); t.after(() => fs.rm(dir, { recursive: true, force: true })); return dir; }
test("Shift conserve les noms lors des insertions de clients et termine ses effets sans cumul", { skip: process.platform !== "win32" }, async t => {
 const output = path.join(await temp(t), "shift-queue.exe");
 execFileSync(path.join(process.env.WINDIR, "Microsoft.NET/Framework64/v4.0.30319/csc.exe"), ["/nologo", "/target:exe", "/out:" + output, ...["native/shop-games/QueuedViewerNames.cs", "native/shop-games/TemporaryEffects.cs", "tests/fixtures/shift-queue-harness.cs"].map(file => path.join(root, file))], { windowsHide: true, stdio: "pipe" });
 assert.match(execFileSync(output, [], { encoding: "utf8", windowsHide: true }), /16 Shift behavior checks passed/);
});
test("le catalogue Shift sépare facteurs, quantités et durées avec une restauration accessible", async () => {
 const game = pack(); assert.equal(game.effects.length, 36);
 for (const code of ["slow_motion", "fast_forward"]) {
  const effect = game.effects.find(effect => effect.code === code); assert.equal(effect.duration, 20);
  assert.ok(effect.parameters.some(parameter => parameter.id === "facteur")); assert.ok(!effect.parameters.some(parameter => parameter.id === "amount"));
 }
 assert.equal(game.effects.find(effect => effect.code === "stuck_player").duration, 6);
 assert.ok(game.effects.some(effect => effect.code === "reset_effects"));
 assert.ok(game.defaultMappings.every(mapping => mapping.triggerEnabled === true));
 const source = await fs.readFile(path.join(root, "native/shop-games/ShiftRuntime.cs"), "utf8");
 const accepted = source.match(/new HashSet<string>\(\("([a-z_ ]+)"\)/)[1].split(" ");
 assert.deepEqual(accepted.sort(), game.effects.map(effect => effect.code).sort());
});
test("les 36 cadeaux Shift passent par le moteur de règles et transmettent le nom du donateur et les paramètres", async t => {
 const dir = await temp(t), received = [];
 const server = net.createServer(socket => { let input = ""; socket.on("data", bytes => { input += bytes; if (!input.includes("\n")) return; const request = JSON.parse(input); if (request.code !== "__status") received.push(request); socket.end(JSON.stringify({ id: request.id, gameId, status: 0, ready: true, executionConfirmed: false }) + "\n"); }); });
 await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
 await fs.mkdir(path.join(dir, "BepInEx/config"), { recursive: true }); await fs.writeFile(path.join(dir, "BepInEx/config/ShenPulse." + gameId + ".json"), JSON.stringify({ gameId, token, port: 58446 }));
 const game = pack(), state = createDefaultState();
 state.settings.account = { uid: "shift-user", email: "shift@example.test", refreshTokenSecretId: "fixture-account" }; state.commerce.subscription = { tier: "pro", source: "subscription", status: "active" }; state.rules = [];
 state.game.installations[gameId] = { path: dir }; state.session.game = { running: true, packId: gameId, profileId: state.session.profileId };
 const store = authenticatedFixtureStore({ getState: () => structuredClone(state), getStateProjection: paths => getStateProjection(state, {}, paths), getRuleEngineState: type => getRuleEngineState(state, type) });
 const hub = new GameHub({ store, resourcesDirectory: path.join(root, "resources") }); hub.packs = [game]; t.after(() => hub.disconnectAll());
 const bridge = new ShopGameBridge({ gameId, installationPath: dir }); const request = bridge.tcpRequest.bind(bridge); bridge.tcpRequest = (message, _port, ...args) => request(message, server.address().port, ...args); hub.serverBridges.set(gameId + ":shop-mod", bridge);
 const engine = new RuleEngine({ store, actionRunner: new ActionRunner({ store, gameHub: hub }) }); const failures = []; engine.on("action-result", result => { if (!result.ok) failures.push(result.error?.message); });
 const viewer = 'Élodie "cadeau" 🦆';
 for (const effect of game.effects) {
  const mapping = game.defaultMappings.find(mapping => mapping.effectId === effect.id); const rule = defaultGameInteractionRule(game, effect, { ...mapping, triggerEnabled: true }, game.interactionCatalogVersion);
  rule.conditions = [{ field: "data.giftName", operator: "equals", value: effect.name, giftId: "fixture-" + effect.code }]; state.game.interactionRulesByPack[gameId] = [rule];
  await engine.process(normalizeEvent({ event: "gift", data: { giftId: "fixture-" + effect.code, giftName: effect.name, count: 1, user: { id: "shift-viewer", nickname: viewer } } }, "tiktok"));
 }
 assert.deepEqual(failures, []); assert.equal(received.length, 36); assert.deepEqual(received.map(message => message.code), game.effects.map(effect => effect.code)); assert.ok(received.every(message => message.viewer === viewer));
 const slow = received.find(message => message.code === "slow_motion"); assert.equal(slow.duration, 20); assert.equal(slow.parameters.facteur, .5);
 const funds = received.find(message => message.code === "funds"); assert.equal(funds.duration, 0); assert.equal(funds.parameters.amount, 100);
 state.session.game.running = false; await engine.process(normalizeEvent({ event: "gift", data: { giftId: "fixture-reset_effects", giftName: game.effects.at(-1).name, user: { nickname: viewer } } }, "tiktok")); assert.equal(received.length, 36);
});
