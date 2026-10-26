"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), net = require("node:net");
const { execFileSync } = require("node:child_process");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { ShopGameBridge } = require("../src/main/shop-game-bridge");
const { RuleEngine } = require("../src/main/rule-engine"), { ActionRunner } = require("../src/main/action-runner"), { GameHub } = require("../src/main/game-hub");
const { createDefaultState } = require("../src/main/defaults"), { getRuleEngineState, getStateProjection } = require("../src/main/state/projections");
const { defaultGameInteractionRule } = require("../src/main/game-hub/interaction-defaults"), { normalizeEvent } = require("../src/main/event-normalizer");
const { authenticatedFixtureStore } = require("./helpers/authenticated-store");
const root = path.resolve(__dirname, ".."), gameId = "supermarket-simulator", token = "b".repeat(64);
const pack = () => loadShenazenGameCatalog(path.join(root, "resources")).find(game => game.id === gameId);
async function temp(t) { const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-market-")); t.after(() => fs.rm(dir, { recursive: true, force: true })); return dir; }
test("Supermarket conserve chaque client et chaque donateur lors des attentes et des rafales", { skip: process.platform !== "win32" }, async t => {
 const output=path.join(await temp(t),"market-queue.exe");
 execFileSync(path.join(process.env.WINDIR,"Microsoft.NET/Framework64/v4.0.30319/csc.exe"),["/nologo","/target:exe","/out:"+output,...["native/shop-games/ViewerSpawnQueue.cs","native/shop-games/MarketTime.cs","native/shop-games/EmployeeOperations.cs","native/shop-games/ProductReturnPlan.cs","native/shop-games/TemporaryEffects.cs","tests/fixtures/market-queue-harness.cs"].map(f=>path.join(root,f))],{windowsHide:true,stdio:"pipe"});
 assert.match(execFileSync(output,[],{encoding:"utf8",windowsHide:true}),/39 Supermarket behavior checks passed/);
});

test("Supermarket transmet les durées comme des secondes et conserve les paramètres enregistrés", () => {
 const game=pack();assert.equal(game.effects.length,42);
 const {createEffectPayload}=require("../src/main/game-hub/effect-payload");
 for(const effect of game.effects.filter(e=>e.durationParameter)){
  assert.equal(effect.quantityParameter,undefined);
  const payload=createEffectPayload(effect,{}, {quantity:100,parameters:{count:7}}).effect;
  assert.equal(payload.duration,7,"La durée personnalisée doit être conservée.");
  assert.equal(payload.quantity,100,"La quantité d’un cadeau reste distincte des secondes.");
 }
 assert.equal(game.defaultMappings.length,12); assert.ok(game.defaultMappings.every(m=>m.triggerEnabled===true));
});

test("les 42 cadeaux Supermarket passent par le moteur de règles et transmettent le nom du donateur et les paramètres", async t => {
 const dir = await temp(t), received = [];
 const server = net.createServer(socket => { let input = ""; socket.on("data", bytes => { input += bytes; if (!input.includes("\n")) return; const request = JSON.parse(input); if (request.code !== "__status") received.push(request); socket.end(JSON.stringify({ id: request.id, gameId, status: 0, ready: true, executionConfirmed: false }) + "\n"); }); });
 await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
 await fs.mkdir(path.join(dir, "BepInEx/config"), { recursive: true }); await fs.writeFile(path.join(dir, "BepInEx/config/ShenPulse." + gameId + ".json"), JSON.stringify({ gameId, token, port: 58448 }));
 const game = pack(), state = createDefaultState();
 state.settings.account = { uid: "market-user", email: "market@example.test", refreshTokenSecretId: "fixture-account" }; state.commerce.subscription = { tier: "pro", source: "subscription", status: "active" }; state.rules = [];
 state.game.installations[gameId] = { path: dir }; state.session.game = { running: true, packId: gameId, profileId: state.session.profileId };
 const store = authenticatedFixtureStore({ getState: () => structuredClone(state), getStateProjection: paths => getStateProjection(state, {}, paths), getRuleEngineState: type => getRuleEngineState(state, type) });
 const hub = new GameHub({ store, resourcesDirectory: path.join(root, "resources") }); hub.packs = [game]; t.after(() => hub.disconnectAll());
 const bridge = new ShopGameBridge({ gameId, installationPath: dir }); const request = bridge.tcpRequest.bind(bridge); bridge.tcpRequest = (message, _port, ...args) => request(message, server.address().port, ...args); hub.serverBridges.set(gameId + ":shop-mod", bridge);
 const engine = new RuleEngine({ store, actionRunner: new ActionRunner({ store, gameHub: hub }) }); const failures = []; engine.on("action-result", result => { if (!result.ok) failures.push(result.error?.message); });
 const viewer = 'Élodie "cadeau" 🦆';
 for (const effect of game.effects) {
  const mapping = game.defaultMappings.find(mapping => mapping.effectId === effect.id); const rule = defaultGameInteractionRule(game, effect, { ...mapping, triggerEnabled: true }, game.interactionCatalogVersion);
  rule.conditions = [{ field: "data.giftName", operator: "equals", value: effect.name, giftId: "fixture-" + effect.code }]; state.game.interactionRulesByPack[gameId] = [rule];
  await engine.process(normalizeEvent({ event: "gift", data: { giftId: "fixture-" + effect.code, giftName: effect.name, count: 1, user: { id: "market-viewer", nickname: viewer } } }, "tiktok"));
 }
 assert.deepEqual(failures, []); assert.equal(received.length, 42); assert.deepEqual(received.map(message => message.code), game.effects.map(effect => effect.code)); assert.ok(received.every(message => message.viewer === viewer));
 const slow = received.find(message => message.code === "GameSlowDown"); assert.equal(slow.duration, 20); assert.equal(slow.quantity, 1); assert.equal(slow.parameters.count, 20);
 const funds = received.find(message => message.code === "GiveMoney"); assert.equal(funds.duration, 0); assert.equal(funds.quantity, 100);
 const customer=game.effects.find(e=>e.code==="SpawnCustomers"), mapping=game.defaultMappings.find(m=>m.effectId===customer.id);
 const burst=defaultGameInteractionRule(game,customer,{...mapping,parameters:{count:5},triggerEnabled:true},game.interactionCatalogVersion);
 burst.conditions=[{field:"data.giftName",operator:"equals",value:"Burst",giftId:"market-burst"}];state.game.interactionRulesByPack[gameId]=[burst];
 await engine.process(normalizeEvent({event:"gift",data:{giftId:"market-burst",giftName:"Burst",count:3,user:{nickname:viewer}}},"tiktok"));
 assert.deepEqual(received.slice(42).map(r=>({code:r.code,quantity:r.quantity,viewer:r.viewer})),Array.from({length:3},()=>({code:"SpawnCustomers",quantity:5,viewer})));
 state.session.game.running = false; await engine.process(normalizeEvent({ event: "gift", data: { giftId: "fixture-ResetEffects", giftName: game.effects.at(-1).name, user: { nickname: viewer } } }, "tiktok")); assert.equal(received.length, 45);
});
