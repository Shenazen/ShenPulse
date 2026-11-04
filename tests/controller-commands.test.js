"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { ControllerCommands, commandAction, controllerCommands } = require("../src/main/controller-commands");
const { ControllerService } = require("../src/main/controller-service");
const { ActionRunner } = require("../src/main/action-runner");
const { createDefaultOverlaySession } = require("../src/main/overlay-session-state");
const { selectStatePaths } = require("../src/main/state/projections");
const plugin = path.resolve(__dirname, "../resources/controllers/com.shenpulse.control.sdPlugin");

function fixture() {
  const state = { session: { profileId: "p" }, profiles: [{ id: "p", name: "Mon profil", enabledRuleIds: ["r"] }],
    rules: [{ id: "r", name: "Ma règle", enabled: true, actions: [{ id: "a", type: "timer.add", config: { operation: "set", seconds: 42 } }] }],
    settings: { controllers: {}, account: { uid: "owner", email: "owner@example.test", refreshTokenSecretId: "account" }, siteVisibility: {}, overlayConfigs: { wheel: { wheels: [] } } },
    commerce: { subscription: { tier: "premium", status: "active" } }, overlaySession: createDefaultOverlaySession() };
  const secrets = new Map([["account", "fixture"]]), published = [], music = [], matches = [];
  const store = { getState: () => state, getStateProjection: paths => selectStatePaths(state, paths),
    getAccountSession: () => state.settings.account, getSecret: id => secrets.get(id),
    setSecret(id, value) { id ||= `s${secrets.size}`; secrets.set(id, value); return id; },
    set(_key, value) { state.settings.controllers = value; }, mutateRuntime: fn => fn(state) };
  const runner = new ActionRunner({ store, notifyRenderer() {}, gameHub: { assertAccess() {} },
    overlayServer: { publish: (...args) => published.push(args), playMatch: config => { matches.push(config); return { ok: true }; } },
    spotifyService: { control: async config => { music.push(config); return { ok: true }; } } });
  const commands = new ControllerCommands({ store, actionRunner: runner, notifyRenderer() {}, snapshot: () => state });
  return { state, store, runner, commands, published, matches, music };
}

test("toutes les animations utilisent le moteur réel avec le pack et le cadrage choisis, sans modifier les wins", async () => {
  const f = fixture(), initial = structuredClone(f.state.overlaySession);
  for (const command of controllerCommands().filter(item => item.id.startsWith("match."))) {
    for (const variant of command.fields[0].options) {
      await f.commands.run(command.id, { variant: variant.value, fit: "cover" });
      assert.match(f.matches.at(-1).originActionId, /^controller_/);
      assert.deepEqual(f.matches.at(-1), { match: command.id.slice(6), variant: variant.value, fit: "cover", volume: 1, originActionId: f.matches.at(-1).originActionId });
    }
  }
  assert.equal(f.matches.length, 27);
  assert.deepEqual(f.state.overlaySession, initial);
  await assert.rejects(f.commands.run("match.cofre", { variant: "dragon" }), /valeur valide/);
  assert.throws(() => commandAction("unknown"), /n’existe pas/);
});

test("wins, multiplicateurs, timers et musique exécutent leurs vraies opérations", async () => {
  const f = fixture();
  await f.commands.run("wins.add", { amount: 7 }); assert.equal(f.state.overlaySession.winCounterCurrent, 7);
  await f.commands.run("wins.remove", { amount: 3 }); assert.equal(f.state.overlaySession.winCounterCurrent, 4);
  await f.commands.run("wins.invert"); assert.equal(f.state.overlaySession.winCounterCurrent, -4);
  await f.commands.run("wins.reset"); assert.equal(f.state.overlaySession.winCounterCurrent, 0);
  await f.commands.run("wins.multiplier", { multiplier: 3, seconds: 120 }); assert.equal(f.state.overlaySession.winCounterMultiplier, 3);
  await f.commands.run("wins.multiplier-stop"); assert.equal(f.state.overlaySession.winCounterMultiplier, 1);
  await f.commands.run("timer.set", { seconds: 900 });
  await f.commands.run("timer.pause"); assert.equal(f.state.overlaySession.timerPaused, true);
  await f.commands.run("timer.add", { seconds: 15 });
  await f.commands.run("timer.remove", { seconds: 5 }); assert.ok(f.state.overlaySession.timerSeconds >= 909);
  await f.commands.run("timer.resume"); assert.equal(f.state.overlaySession.timerPaused, false);
  await f.commands.run("timer.reset");
  for (const operation of ["set", "pause", "resume", "reset"]) await f.commands.run(`multiplier.${operation}`, { multiplier: 4, seconds: 60 });
  for (const item of controllerCommands().filter(item => item.id.startsWith("music."))) await f.commands.run(item.id);
  assert.deepEqual(f.music.map(item => item.operation), ["play", "pause", "next", "previous", "volume_up", "volume_down"]);
  for (const bad of ["", -1, 0, 1.1, true, "NaN", Infinity, 100001]) assert.throws(() => commandAction("wins.add", { amount: bad }), /doit être entre/);
});

test("actions et règles restent liées au profil et aux droits, les changements pendant une règle l’arrêtent", async () => {
  const f = fixture();
  await f.commands.action("a"); assert.equal(f.state.overlaySession.timerSeconds, 42);
  await f.commands.rule("r");
  f.state.profiles[0].enabledRuleIds = [];
  await assert.rejects(f.commands.action("a"), /hors du profil/);
  await assert.rejects(f.commands.rule("r"), /profil actif/);
  f.state.profiles[0].enabledRuleIds = ["r"];
  f.state.rules[0].actions.push({ id: "b", type: "timer.add", config: { seconds: 30 } });
  const original = f.runner.run.bind(f.runner); let count = 0;
  f.runner.run = async (...args) => { const result = await original(...args); count++; f.state.profiles[0].enabledRuleIds = []; return result; };
  await assert.rejects(f.commands.rule("r"), /règle a changé/); assert.equal(count, 1);
  f.state.commerce.subscription = { tier: "free", status: "free" };
  await assert.rejects(f.commands.run("match.x2"), /abonnement/);
  f.state.settings.account = {};
  await assert.rejects(f.commands.run("timer.set"), /Connectez/);
});

test("la roue directe utilise les actions différées protégées et la même configuration que ShenPulse", async () => {
  const f = fixture();
  f.state.settings.overlayConfigs.wheel.wheels = [{ id: "wheel", name: "Ma roue", enabled: true, segments: [
    { id: "one", label: "Premier", weight: 1 }, { id: "two", label: "Deuxième", weight: 1 }
  ] }];
  const timers = [];
  f.runner.wheelActions.setTimeoutImpl = callback => { timers.push(callback); return { unref() {} }; };
  const result = await f.commands.run("wheel.spin");
  assert.equal(result.executed, true);
  assert.equal(f.published.filter(([channel]) => channel === "wheel").length, 1);
  f.state.settings.siteVisibility.overlays = { wheel: { scope: "hidden" } };
  await assert.rejects(f.commands.run("wheel.spin"), /autorisée/);
});

test("le câblage du cœur relie commandes, règles, profils et automatisations aux services réels", async () => {
  const f = fixture(), calls = [];
  Object.assign(f.commands.core, { matches: { testAutomation: id => calls.push(["automation", id]) },
    stopGameSession: async () => calls.push(["stop"]), ruleEngine: { resetProfileState: () => calls.push(["reset"]) },
    liveEventActions: { chatbot: { reset() {}, syncTimers() {} } } });
  f.store.selectProfile = id => { f.state.session.profileId = id; };
  const service = f.commands.createService(""); service.authorize = () => {};
  await service.executeTarget({ targetType: "rule", targetId: "r" });
  assert.equal(f.state.overlaySession.timerSeconds, 42);
  await service.executeTarget({ targetType: "command", targetId: "timer.set", options: { seconds: 100 } });
  assert.equal(f.state.overlaySession.timerSeconds, 100);
  service.getAutomations = () => [{ id: "automation" }];
  const automation = { id: "automation" };
  await service.executeTarget({ targetType: "automation", targetId: automation.id });
  assert.deepEqual(calls[0], ["automation", automation.id]);
  await service.executeTarget({ targetType: "profile", targetId: "p" });
  assert.deepEqual(calls.slice(1), [["stop"], ["reset"]]);
});

test("le panneau utilise son UUID enregistré, conserve ses choix à l’actualisation et signale les erreurs", t => {
  const dom = new JSDOM(fs.readFileSync(path.join(plugin, "inspector.html"), "utf8"), { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window, sent = [];
  w.WebSocket = class { static OPEN = 1; readyState = 1; constructor() { w.sdk = this; } send(value) { sent.push(JSON.parse(value)); } };
  w.eval(fs.readFileSync(path.join(plugin, "inspector.js"), "utf8"));
  w.connectElgatoStreamDeckSocket(1234, "inspector-uuid", "registerPropertyInspector", "{}", JSON.stringify({ context: "different-key-context", action: "com.shenpulse.control.match", payload: { settings: {} } }));
  w.sdk.onopen();
  assert.equal(sent.at(-1).context, "inspector-uuid");
  const reply = payload => w.sdk.onmessage({ data: JSON.stringify({ event: "sendToPropertyInspector", payload }) });
  const targets = { protocolVersion: 2, activeProfile: { name: "Mon profil" }, commands: controllerCommands() };
  reply({ requestId: 1, targets });
  const selector = w.document.getElementById("target"); selector.value = "match.x3"; selector.dispatchEvent(new w.Event("change"));
  assert.equal(sent.at(-1).event, "setSettings"); assert.equal(sent.at(-1).context, "inspector-uuid");
  const variant = w.document.querySelector('[data-key="variant"]'); variant.value = "dragon"; variant.dispatchEvent(new w.Event("change"));
  const oldNode = w.document.querySelector('[data-key="variant"]'); reply({ requestId: 1, targets });
  assert.equal(w.document.querySelector('[data-key="variant"]'), oldNode); assert.equal(oldNode.value, "dragon");
  w.document.getElementById("test").click(); assert.equal(sent.at(-1).payload.settings.options.variant, "dragon");
  reply({ requestId: sent.at(-1).payload.requestId, error: "Compte requis" });
  assert.equal(w.document.getElementById("status").textContent, "Compte requis");
  dom.window.close();
});

test("un appui Stream Deck traverse l’API authentifiée, valide le profil puis exécute le moteur", async t => {
  const f = fixture();
  const service = new ControllerService({ store: f.store, authorize() {}, getCommands: () => f.commands.catalog(), executeCommand: (...args) => f.commands.run(...args) });
  service.port = () => service.server?.address()?.port || 0;
  await service.start(); t.after(() => service.stop());
  const device = service.pair({ code: (await service.pairingCode()).code });
  const endpoint = `http://127.0.0.1:${service.port()}`, sent = [], requests = [];
  class Socket { static OPEN = 1; readyState = 1; send(value) { sent.push(JSON.parse(value)); } }
  const sandbox = vm.createContext({ window: {}, WebSocket: Socket, URL, AbortSignal, fetch: async (...args) => { requests.push(args); return fetch(...args); } });
  vm.runInContext(fs.readFileSync(path.join(plugin, "plugin.js"), "utf8"), sandbox);
  sandbox.window.connectElgatoStreamDeckSocket(1, "plugin", "registerPlugin");
  vm.runInContext(`integrationSettings=${JSON.stringify({ endpoint, token: device.token })}`, sandbox);
  await vm.runInContext("receiveStreamDeckEvent({event:'willAppear',action:'com.shenpulse.control.match',context:'key',payload:{settings:{targetId:'match.x2',options:{variant:'dragon',fit:'contain'}}}})", sandbox);
  await vm.runInContext("receiveStreamDeckEvent({event:'keyDown',action:'com.shenpulse.control.match',context:'key'})", sandbox);
  assert.equal(sent.at(-1).event, "showOk"); assert.deepEqual(f.matches, [{ match: "x2", variant: "dragon", fit: "contain", volume: 1, originActionId: f.matches[0].originActionId }]);
  assert.equal(requests.length, 2);
  const headers = { Authorization: `Bearer ${device.token}`, "Content-Type": "application/json" };
  assert.equal((await fetch(endpoint + "/execute", { method: "POST", headers, body: JSON.stringify({ targetType: "command", targetId: "match.x2", expectedProfileId: "obsolete" }) })).status, 400);
  assert.equal((await fetch(endpoint + "/execute", { method: "POST", headers, body: JSON.stringify({ targetType: "command", targetId: "match.x2", options: { variant: "inexistant" } }) })).status, 400);
  assert.equal((await fetch(endpoint + "/targets")).status, 401);
  assert.equal(f.matches.length, 1);
});
