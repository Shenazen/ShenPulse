"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { MAIN_RENDERER_URL } = require("../src/main/integration-ipc-access");

const methods = {
  "users:snapshot": "snapshot", "users:block": "setBlocked", "users:block-list": "setBlockedList",
  "users:unblock": "unblock",
  "users:remove": "remove", "users:cleanup": "cleanup", "users:clear": "clear",
  "users:import": "import", "users:export": "export", "users:merge": "merge"
};

function fixture() {
  const handlers = new Map();
  const calls = [];
  const notifications = [];
  const state = { settings: { account: { uid: "fixture-owner", email: "owner@example.com", refreshTokenSecretId: "account-token" } }, connections: [] };
  const frame = { url: MAIN_RENDERER_URL };
  const contents = { mainFrame: frame, getURL: () => frame.url, isDestroyed: () => false };
  const core = {
    viewerService: Object.fromEntries(Object.values(methods).map((method) => [method, (...args) => {
      calls.push({ method, args }); return { ok: true, method };
    }])),
    notifyRenderer: (channel, data) => notifications.push({ channel, data })
  };
  core.viewerService.database = () => ({ revision: 42 });
  const filename = path.resolve(__dirname, "../src/main/ipc.js");
  const realRequire = createRequire(filename);
  const module = { exports: {} };
  new vm.Script(fs.readFileSync(filename, "utf8"), { filename }).runInNewContext({
    require: (request) => request === "electron" ? {
      ipcMain: { removeHandler: (channel) => handlers.delete(channel), handle: (channel, handler) => handlers.set(channel, handler) }
    } : realRequire(request), module, exports: module.exports, __dirname: path.dirname(filename), __filename: filename
  });
  module.exports.registerIpc({ core, store: { getState: () => state, getSecret: () => "fixture-token" },
    getWindow: () => ({ webContents: contents, isDestroyed: () => false }) });
  return { handlers, calls, notifications, state, frame, contents, event: { sender: contents, senderFrame: frame } };
}

test("les opérations Utilisateurs passent par le service et notifient uniquement les mutations", async () => {
  const { handlers, calls, notifications, event } = fixture();
  assert.deepEqual([...handlers.keys()].filter((channel) => channel.startsWith("users:")), Object.keys(methods));
  const options = { streamer: "creator", limit: 50 };
  for (const [channel, method] of Object.entries(methods)) {
    assert.equal((await handlers.get(channel)(event, options, channel === "users:unblock" ? "fixture-owner" : true)).method, method);
    assert.equal(calls.at(-1).method, method);
    assert.equal(calls.at(-1).args[0], options);
  }
  assert.equal(notifications.length, 8);
  assert.equal(notifications.every((notice) => notice.channel === "users-changed" && notice.data.revision === 42), true);
});

test("un déblocage IPC retardé ne cible jamais la base d'un nouveau compte, même avec la même identité publique", () => {
  const { handlers, state, calls, notifications, event } = fixture();
  const options = { platform: "tiktok", streamer: "creator", username: "same_user" };
  const unblock = handlers.get("users:unblock");
  assert.throws(() => unblock(event, options), { code: "VIEWER_CONTEXT_CHANGED" });
  state.settings.account.uid = "next-owner";
  assert.throws(() => unblock(event, options, "fixture-owner"), { code: "VIEWER_CONTEXT_CHANGED" });
  assert.equal(calls.length, 0);
  assert.equal(notifications.length, 0);
  assert.equal(unblock(event, options, "next-owner").method, "unblock");
  assert.equal(calls.length, 1);
});

test("toutes les opérations privées refusent invités, jeux, sous-frames et pages distantes", () => {
  for (const channel of Object.keys(methods)) {
    const { handlers, calls, state, frame, contents, event } = fixture();
    const gameFrame = { url: MAIN_RENDERER_URL };
    const gameContents = { mainFrame: gameFrame, getURL: () => MAIN_RENDERER_URL, isDestroyed: () => false };
    for (const rejected of [
      { sender: gameContents, senderFrame: gameFrame },
      { sender: contents, senderFrame: { url: MAIN_RENDERER_URL } },
      { sender: contents, senderFrame: null }
    ]) assert.throws(() => handlers.get(channel)(rejected), { code: "IPC_SENDER_FORBIDDEN" }, channel);
    frame.url = "https://untrusted.example/";
    assert.throws(() => handlers.get(channel)(event), { code: "IPC_SENDER_FORBIDDEN" }, channel);
    frame.url = MAIN_RENDERER_URL;
    state.settings.account = {};
    assert.throws(() => handlers.get(channel)(event), { code: "ACCOUNT_REQUIRED" }, channel);
    assert.equal(calls.length, 0);
  }
});

test("preload : API Utilisateurs typée et abonnement aux seuls changements autorisés", () => {
  let api;
  const calls = [];
  const listeners = [];
  const filename = path.resolve(__dirname, "../src/main/preload.js");
  new vm.Script(fs.readFileSync(filename, "utf8"), { filename }).runInNewContext({ require: () => ({
    contextBridge: { exposeInMainWorld: (_name, value) => { api = value; } },
    ipcRenderer: { invoke: (...args) => { calls.push(args); }, on: (...args) => listeners.push(args), removeListener: () => {} }
  }) });
  for (const [channel, method] of Object.entries(methods)) {
    api.users[method]("argument", true);
    assert.equal(calls.at(-1)[0], channel);
    assert.equal(calls.at(-1)[1], "argument");
  }
  api.on("users-changed", () => {});
  assert.equal(listeners.at(-1)[0], "users-changed");
  const before = listeners.length;
  api.on("users:private-data", () => {});
  assert.equal(listeners.length, before);
});
