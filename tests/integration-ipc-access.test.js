"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { assertIntegrationIpcSender, sameLocalDocumentUrl, MAIN_RENDERER_URL } = require("../src/main/integration-ipc-access");

function fixture() {
  const handlers = new Map();
  const calls = [];
  const state = { settings: { account: { uid: "creator", email: "creator@example.com", refreshTokenSecretId: "account-token" } }, connections: [] };
  const frame = { url: MAIN_RENDERER_URL };
  const contents = { mainFrame: frame, getURL: () => frame.url, isDestroyed: () => false };
  let mainWindow = { webContents: contents, isDestroyed: () => false };
  const operation = (name) => (...args) => { calls.push({ name, args }); return { ok: true, operation: name }; };
  const core = {
    kickService: Object.fromEntries(["status", "configure", "connect", "disconnect"].map((name) => [name, operation(`kick:${name}`)])),
    controllerService: Object.fromEntries(["status", "pairingCode", "connectLocalPlugin", "installPlugin", "revoke", "saveMapping", "removeMapping", "executeMapping"].map((name) => [name, operation(`controllers:${name}`)])),
    liveDirectory: {
      suspendPublication: operation("directory:suspend"),
      resumePublication: operation("directory:resume"),
      sync: operation("directory:sync")
    },
    snapshot: () => ({ state }),
    restartServers: operation("server:restart"),
    notifyRenderer: () => {},
    gameHub: { assertAccess: operation("game:access") }
  };
  const ipcPath = path.resolve(__dirname, "../src/main/ipc.js");
  const realRequire = createRequire(ipcPath);
  const module = { exports: {} };
  const electron = { ipcMain: { removeHandler: (channel) => handlers.delete(channel), handle: (channel, handler) => handlers.set(channel, handler) } };
  new vm.Script(fs.readFileSync(ipcPath, "utf8"), { filename: ipcPath }).runInNewContext({
    require: (request) => request === "electron" ? electron : realRequire(request),
    module, exports: module.exports, __dirname: path.dirname(ipcPath), __filename: ipcPath
  });
  module.exports.registerIpc({
    core,
    store: { getState: () => state, getSecret: () => "refresh-token", mutate: (mutator, immediate) => {
      mutator(state); calls.push({ name: "store:mutate", args: [immediate] });
    }, set: (key, value) => {
      if (key !== "settings.liveDirectory") throw new Error("Unexpected settings write");
      state.settings.liveDirectory = value;
    } },
    gameRuntime: { sendThiercelieuxCommand: operation("game:thiercelieux-command") },
    getWindow: () => mainWindow,
    onStartupReady: operation("startup:ready")
  });
  return { handlers, calls, state, frame, contents, core, event: { sender: contents, senderFrame: frame }, setWindow: (window) => { mainWindow = window; } };
}

test("tous les IPC IRL refusent Free et les sous-frames avant d’appeler un service", () => {
  const channels = ["irl:status", "irl:scan", "irl:pair", "irl:add", "irl:remove", "irl:rename", "irl:enabled", "irl:test"];
  const f = fixture();
  for (const channel of channels) {
    assert.throws(() => f.handlers.get(channel)({ sender: f.contents, senderFrame: { url: MAIN_RENDERER_URL } }, {}),
      { code: "IPC_SENDER_FORBIDDEN" }, channel);
    assert.throws(() => f.handlers.get(channel)(f.event, {}), { code: "PRO_FEATURE_REQUIRED" }, channel);
  }
  assert.equal(f.calls.length, 0);
});

test("sound:remove exige le document principal exact et un compte connecté avant tout retrait", () => {
  const f = fixture();
  const remove = f.handlers.get("sound:remove");
  const secondFrame = { url: MAIN_RENDERER_URL };
  const secondContents = { mainFrame: secondFrame, getURL: () => MAIN_RENDERER_URL, isDestroyed: () => false };
  for (const event of [
    undefined, {},
    { sender: secondContents, senderFrame: secondFrame },
    { sender: f.contents, senderFrame: secondFrame },
    { sender: f.contents, senderFrame: null }
  ]) assert.throws(() => remove(event, "custom:fixture", "creator"), { code: "IPC_SENDER_FORBIDDEN" });
  for (const url of ["https://untrusted.example/", MAIN_RENDERER_URL + "?gameId=fixture", MAIN_RENDERER_URL + "#other"]) {
    f.frame.url = url;
    assert.throws(() => remove(f.event, "custom:fixture", "creator"), { code: "IPC_SENDER_FORBIDDEN" });
  }
  f.frame.url = MAIN_RENDERER_URL;
  f.setWindow(null);
  assert.throws(() => remove(f.event, "custom:fixture", "creator"), { code: "IPC_SENDER_FORBIDDEN" });
  f.setWindow({ webContents: f.contents, isDestroyed: () => true });
  assert.throws(() => remove(f.event, "custom:fixture", "creator"), { code: "IPC_SENDER_FORBIDDEN" });
  f.setWindow({ webContents: f.contents, isDestroyed: () => false });
  f.state.settings.account = {};
  assert.throws(() => remove(f.event, "custom:fixture", "creator"), { code: "ACCOUNT_REQUIRED" });
  assert.equal(f.calls.length, 0);
});

test("sound:remove est disponible pour tout compte authentifié, Free comme Pro", () => {
  for (const tier of ["free", "pro"]) {
    const f = fixture();
    f.state.commerce = { subscription: { tier, status: tier === "pro" ? "active" : "free" } };
    f.state.customSounds = [{ id: "ancien_import", name: "Son de test" }];
    const response = f.handlers.get("sound:remove")(f.event, "ancien_import", "creator");
    assert.deepEqual(f.state.customSounds, []);
    assert.equal(response.snapshot.state, f.state);
    assert.deepEqual(f.calls, [{ name: "store:mutate", args: [true] }]);
  }
});

test("startup:ready accepte un seul signal invité du renderer principal, jamais du splash ou d'une sous-frame", () => {
  const f = fixture(); f.state.settings.account = {};
  const ready = f.handlers.get("startup:ready");
  for (const event of [undefined, {}, { sender: f.contents, senderFrame: { url: MAIN_RENDERER_URL } }]) {
    assert.throws(() => ready(event), { code: "IPC_SENDER_FORBIDDEN" });
  }
  const splash = { url: MAIN_RENDERER_URL.replace("index.html", "splash.html") };
  const splashContents = { mainFrame: splash, getURL: () => splash.url, isDestroyed: () => false };
  assert.throws(() => ready({ sender: splashContents, senderFrame: splash }), { code: "IPC_SENDER_FORBIDDEN" });
  assert.equal(ready(f.event, { authenticated: true }).ready, true);
  assert.equal(ready(f.event).ready, true);
  assert.deepEqual(f.calls, [{ name: "startup:ready", args: [] }]);
  assert.deepEqual(f.state.settings.account, {}, "le signal ne peut jamais connecter un compte");
});

test("les aperçus directs IRL et jeu ne contournent pas l’abonnement via action:test", () => {
  const f = fixture(); let previews = 0;
  f.core.previewAction = () => { previews += 1; return { ok: true }; };
  for (const action of [
    { type: "irl.shelly", config: { deviceId: "fixture" } }, { type: "game.effect", config: { packId: "fixture" } },
    { type: "overlay.win-counter", config: { packId: "fixture" } }
  ]) assert.throws(() => f.handlers.get("action:test")(f.event, action), { code: "PRO_FEATURE_REQUIRED" });
  assert.equal(previews, 0);
});

const integrationChannels = [
  "kick:status", "kick:configure", "kick:connect", "kick:disconnect",
  "controllers:status", "controllers:pair", "controllers:connect-local", "controllers:install", "controllers:revoke",
  "controllers:mapping-save", "controllers:mapping-remove", "controllers:execute"
];

test("Matchs exige le renderer principal, l’authentification et Pro avant lecture ou effet", async () => {
  const channels = ["matches:status", "matches:config-save", "matches:automation-save", "matches:automation-remove", "matches:automation-test",
    "matches:widget-test", "matches:wins-reset", "matches:wins-adjust", "matches:contributors-reset"];
  const f = fixture();
  for (const channel of channels) {
    assert.throws(() => f.handlers.get(channel)({ sender: f.contents, senderFrame: { url: MAIN_RENDERER_URL } }, {}), { code: "IPC_SENDER_FORBIDDEN" });
    if (channel === "matches:status") assert.throws(() => f.handlers.get(channel)(f.event, {}), { code: "PRO_FEATURE_REQUIRED" });
    else await assert.rejects(f.handlers.get(channel)(f.event, {}), { code: "PRO_FEATURE_REQUIRED" });
  }
  f.state.settings.account = {};
  assert.throws(() => f.handlers.get("matches:status")(f.event), { code: "ACCOUNT_REQUIRED" });
});

test("les IPC Kick acceptent un compte connecté et les contrôleurs exigent le propriétaire", async () => {
  const { handlers, event, calls, state } = fixture();
  assert.deepEqual([...handlers.keys()].filter((channel) => /^(kick|controllers):/.test(channel)), integrationChannels);
  for (const channel of integrationChannels) {
    if (channel.startsWith("controllers:")) {
      state.settings.account.email = "alexandre.leuridan@gmail.com";
      state.settings.account.emailVerified = true;
    }
    const result = await handlers.get(channel)(event, { id: "mapping" });
    assert.equal(result.ok, true, channel);
  }
  assert.equal(calls.length, integrationChannels.length);
});

test("les contrôleurs et le redémarrage des services restent privés même pour un compte Pro", () => {
  for (const pro of [false, true]) {
    const { handlers, event, calls, state } = fixture();
    state.commerce = { subscription: { tier: pro ? "pro" : "free", active: pro } };
    for (const channel of [...integrationChannels.filter((key) => key.startsWith("controllers:")), "server:restart"]) {
      assert.throws(() => handlers.get(channel)(event, {}), { code: "ADMIN_ACCOUNT_REQUIRED" }, channel);
    }
    assert.equal(calls.length, 0);
  }
});

test("seul le propriétaire vérifié peut redémarrer les services ou accéder aux contrôleurs", async () => {
  const { handlers, event, state, calls } = fixture();
  state.settings.account.email = "alexandre.leuridan@gmail.com";
  for (const verified of [false, true]) {
    state.settings.account.emailVerified = verified;
    for (const channel of ["controllers:status", "server:restart"]) {
      if (!verified) assert.throws(() => handlers.get(channel)(event), { code: "ADMIN_ACCOUNT_REQUIRED" });
      else assert.equal((await handlers.get(channel)(event)).ok, true);
    }
  }
  assert.deepEqual(calls.map((call) => call.name), ["controllers:status", "server:restart"]);
  state.settings.account = {};
  assert.throws(() => handlers.get("server:restart")(event), { code: "ACCOUNT_REQUIRED" });
});

test("every integration IPC rejects a remote page, a game window, and subframes without invoking services", () => {
  for (const channel of integrationChannels) {
    const { handlers, calls, frame, contents, event } = fixture();
    const gameFrame = { url: MAIN_RENDERER_URL };
    const gameContents = { mainFrame: gameFrame, getURL: () => MAIN_RENDERER_URL, isDestroyed: () => false };
    for (const rejected of [
      { sender: gameContents, senderFrame: gameFrame },
      { sender: contents, senderFrame: { url: MAIN_RENDERER_URL } },
      { sender: contents, senderFrame: null },
      { sender: contents, senderFrame: { url: "https://untrusted.example/" } }
    ]) {
      assert.throws(() => handlers.get(channel)(rejected, {}), { code: "IPC_SENDER_FORBIDDEN" }, channel);
    }
    frame.url = "https://untrusted.example/";
    assert.throws(() => handlers.get(channel)(event, {}), { code: "IPC_SENDER_FORBIDDEN" }, channel);
    assert.equal(calls.length, 0, channel);
  }
});

test("integration IPC fails closed for destroyed windows, missing senders, URL suffixes and teardown races", () => {
  const { contents, frame, event } = fixture();
  const window = { webContents: contents, isDestroyed: () => false };
  for (const invalidWindow of [null, { ...window, isDestroyed: () => true }, { ...window, webContents: { ...contents, isDestroyed: () => true } }]) {
    assert.throws(() => assertIntegrationIpcSender("kick:connect", event, invalidWindow), { code: "IPC_SENDER_FORBIDDEN" });
  }
  assert.throws(() => assertIntegrationIpcSender("controllers:pair", null, window), { code: "IPC_SENDER_FORBIDDEN" });
  for (const suffix of ["?gameId=example", "#other", "/../games/host.html"]) {
    frame.url = MAIN_RENDERER_URL + suffix;
    assert.throws(() => assertIntegrationIpcSender("controllers:install", event, window), { code: "IPC_SENDER_FORBIDDEN" });
  }
  Object.defineProperty(frame, "url", { get: () => { throw new Error("Frame was destroyed"); } });
  assert.throws(() => assertIntegrationIpcSender("kick:status", event, window), { code: "IPC_SENDER_FORBIDDEN" });
});

test("Windows local document comparison normalizes case and encoding without admitting other files or origins", () => {
  const expected = "file:///C:/Users/Alexa/Documents/Dev%20Agence/ShenPulseNew/src/renderer/index.html";
  for (const variant of [
    "file:///c:/users/alexa/documents/dev%20agence/shenpulsenew/src/renderer/index.html",
    "file:///C:/Users/Alexa/Documents/Dev Agence/ShenPulseNew/src/renderer/index.html",
    "file:///C:/Users/Alexa/Documents/Dev%20Agence/ShenPulseNew/src/renderer/%69ndex.html"
  ]) assert.equal(sameLocalDocumentUrl(variant, expected, "win32"), true, variant);
  for (const variant of [
    expected + "?gameId=example", expected + "#other",
    expected.replace("index.html", "games/host.html"),
    "https://untrusted.example/index.html", "file://untrusted.example/C:/index.html",
    expected.replace("renderer/index", "renderer%2Findex"), "not a URL"
  ]) assert.equal(sameLocalDocumentUrl(variant, expected, "win32"), false, variant);
  assert.equal(sameLocalDocumentUrl("file:///tmp/Index.html", "file:///tmp/index.html", "linux"), false);
});

test("Windows case and encoded spelling variants remain usable through real integration IPC handlers", async () => {
  const { handlers, event, frame, calls, state } = fixture();
  state.settings.account.email = "alexandre.leuridan@gmail.com";
  state.settings.account.emailVerified = true;
  frame.url = MAIN_RENDERER_URL.replace("index.html", "%69ndex.html");
  if (process.platform === "win32") frame.url = frame.url.toLowerCase();
  assert.equal((await handlers.get("controllers:status")(event)).ok, true);
  assert.equal(calls.length, 1);
});

test("canonical integration IPC still requires account authentication", () => {
  const { handlers, event, state, calls } = fixture();
  state.settings.account = {};
  for (const channel of integrationChannels) {
    assert.throws(() => handlers.get(channel)(event, {}), { code: "ACCOUNT_REQUIRED" }, channel);
  }
  assert.equal(calls.length, 0);
});

test("historical game IPC is unchanged and still accepts its game renderer", async () => {
  const { handlers, calls } = fixture();
  const frame = { url: "file:///historical/games/host.html?gameId=thiercelieux" };
  const event = { sender: { mainFrame: frame }, senderFrame: frame };
  const result = await handlers.get("game:thiercelieux-command")(event, { type: "start" });
  assert.equal(result.ok, true);
  assert.deepEqual(calls.map((call) => call.name), ["game:access", "game:thiercelieux-command"]);
  assert.equal(calls.at(-1).args[0].type, "start");
  assert.doesNotThrow(() => assertIntegrationIpcSender("game:effect", null, null));
});

test("Spotify et la configuration ChatBot réservés au renderer principal authentifié", () => {
  for (const channel of ["spotify:status", "spotify:connect", "spotify:control", "chatbot:transport-status", "chatbot:transport-configure"]) {
    const { handlers, contents, state } = fixture();
    assert.throws(() => handlers.get(channel)({ sender: contents, senderFrame: { url: MAIN_RENDERER_URL } }, {}), { code: "IPC_SENDER_FORBIDDEN" });
    const event = { sender: contents, senderFrame: contents.mainFrame };
    state.settings.account = {};
    assert.throws(() => handlers.get(channel)(event, {}), { code: "ACCOUNT_REQUIRED" });
  }
});

test("public LIVE visibility requires a deliberate boolean from the authenticated main renderer", async () => {
  const { handlers, event, state, calls, contents } = fixture();
  const configure = handlers.get("live-directory:configure");
  assert.throws(() => configure({ sender: contents, senderFrame: { url: MAIN_RENDERER_URL } }, { publishEnabled: true }), { code: "IPC_SENDER_FORBIDDEN" });
  await assert.rejects(() => configure(event, { publishEnabled: "true" }), /visibilité/);
  const optedIn = await configure(event, { publishEnabled: true, email: "must-not-save@example.com" });
  assert.equal(state.settings.liveDirectory.publishEnabled, true);
  assert.deepEqual(state.settings.liveDirectory, { publishEnabled: true, defaultsVersion: 1 });
  assert.equal(optedIn.state.settings.liveDirectory.publishEnabled, true);
  assert.deepEqual(calls.map((entry) => entry.name), ["directory:resume", "directory:sync"]);
  calls.length = 0;
  await configure(event, { publishEnabled: false });
  assert.deepEqual(state.settings.liveDirectory, { publishEnabled: false, defaultsVersion: 1 });
  assert.deepEqual(calls.map((entry) => entry.name), ["directory:suspend", "directory:sync"]);
  state.settings.account = {};
  assert.throws(() => configure(event, { publishEnabled: true }), { code: "ACCOUNT_REQUIRED" });
});
