"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { pathToFileURL } = require("node:url");
const { addBoundedSet } = require("../src/shared/bounded-collection");
const { readMainSource } = require("./helpers/main-source-bundles");

// Contrat capturé depuis l’application empaquetée avant cette refonte.
const HISTORICAL_CHANNELS = [
  "account:checkout-cancel",
  "account:game-cheat-access",
  "account:game-checkout",
  "account:login",
  "account:login-browser",
  "account:logout",
  "account:password-reset",
  "account:register",
  "account:status",
  "account:subscription-checkout",
  "account:subscription-stop",
  "account:sync-entitlements",
  "action:test",
  "admin:commerce-save",
  "admin:dashboard",
  "admin:login",
  "admin:logout",
  "admin:site-save",
  "admin:status",
  "admin:trial-grant",
  "admin:trial-revoke",
  "admin:trial-update",
  "admin:visibility-public",
  "catalog:gifts",
  "catalog:media",
  "catalog:sounds",
  "clipboard:write",
  "connection:save",
  "connection:start",
  "connection:stop",
  "controllers:execute",
  "controllers:install",
  "controllers:mapping-remove",
  "controllers:mapping-save",
  "controllers:pair",
  "controllers:revoke",
  "controllers:status",
  "data:clear",
  "data:export",
  "data:import",
  "entity:remove",
  "entity:upsert",
  "event:simulate",
  "event:test",
  "external:open",
  "game:configure",
  "game:deal-host-state",
  "game:effect",
  "game:initialize-interactions",
  "game:install",
  "game:interaction-audit",
  "game:interaction:remove",
  "game:interaction:save",
  "game:launch",
  "game:round-settings:save",
  "game:runtime-status",
  "game:select",
  "game:select-rom",
  "game:session:start",
  "game:session:stop",
  "game:test",
  "game:thiercelieux-command",
  "game:thiercelieux-host-state",
  "game:window-format",
  "irl:add",
  "irl:enabled",
  "irl:pair",
  "irl:remove",
  "irl:rename",
  "irl:scan",
  "irl:status",
  "irl:test",
  "kick:configure",
  "kick:connect",
  "kick:disconnect",
  "kick:status",
  "live-directory:configure",
  "media:upload",
  "obs:test",
  "overlay:configuration",
  "overlay:match-url-rotate",
  "overlay:public-urls-rotate",
  "premium-seat:assign",
  "profile:select",
  "rule:test",
  "server:restart",
  "session:start",
  "session:stop",
  "settings:save",
  "snapshot:get",
  "sound:upload",
  "spotify:connect",
  "spotify:control",
  "spotify:disconnect",
  "spotify:status",
  "tiktok:save",
  "tiktok:start",
  "tiktok:stop",
  "timer:test",
  "updates:check",
  "updates:install",
  "window:close",
  "window:maximize",
  "window:minimize"
];

const NEW_CHANNELS = [
  "game:uninstall", "game:interactions:reset", "game:interactions:move", "game:wins:level",
  // Existing game-page overlay presentation and studio installation contracts.
  "overlay:game-pack-presentation", "studio:install", "studio:status",
  "controllers:connect-local",
  "startup:ready",
  "sound:remove",
  "users:block", "users:block-list", "users:cleanup", "users:clear", "users:export", "users:import", "users:merge", "users:remove", "users:snapshot", "users:unblock",
  "chatbot:transport-status", "chatbot:transport-configure",
  "matches:status", "matches:config-save", "matches:automation-save", "matches:automation-remove", "matches:automation-test",
  "matches:visual-status", "matches:visual-sources", "matches:visual-preview", "matches:visual-save",
  "matches:widget-test", "matches:wins-reset", "matches:wins-adjust", "matches:contributors-reset"
];

function registeredHandlers() {
  const handlers = new Map();
  const state = { settings: { account: {} }, connections: [], session: { game: {} } };
  const file = path.resolve(__dirname, "../src/main/ipc.js");
  const localRequire = createRequire(file);
  const module = { exports: {} };
  // Le garde d'authentification se teste depuis la vraie origine locale autorisée.
  // Un expéditeur arbitraire serait refusé plus tôt et masquerait une régression.
  const rendererUrl = pathToFileURL(path.resolve(__dirname, "../src/renderer/index.html")).href;
  const mainFrame = { url: rendererUrl };
  const webContents = { mainFrame, getURL: () => rendererUrl, isDestroyed: () => false };
  const mainWindow = { webContents, isDestroyed: () => false };
  const trustedEvent = { sender: webContents, senderFrame: mainFrame };
  new vm.Script(fs.readFileSync(file, "utf8"), { filename: file }).runInNewContext({
    require: (name) => name === "electron" ? { ipcMain: {
      removeHandler: (channel) => handlers.delete(channel),
      handle: (channel, handler) => { assert.equal(handlers.has(channel), false); handlers.set(channel, handler); }
    } } : localRequire(name),
    module, exports: module.exports
  });
  const controller = module.exports.registerIpc({
    core: { gameHub: { assertAccess: () => {} } },
    store: { getState: () => state, getSecret: () => "" },
    getWindow: () => mainWindow
  });
  return { handlers, controller, facade: module.exports, trustedEvent };
}

test("la façade conserve les 104 canaux IPC utiles, sans export vidéo, et le contrôleur d’audit", () => {
  const { handlers, controller } = registeredHandlers();
  assert.equal(HISTORICAL_CHANNELS.length, 104);
  assert.equal(handlers.has("overlay:match-video-prepare"), false);
  assert.deepEqual([...handlers.keys()].sort(), [...HISTORICAL_CHANNELS, ...NEW_CHANNELS].sort());
  assert.equal(typeof controller.auditGameInteraction, "function");
});

test("tous les domaines IPC non publics gardent leur garde d’authentification", () => {
  const { handlers, trustedEvent } = registeredHandlers();
  const publicChannels = new Set(["account:login", "account:login-browser", "account:logout", "account:password-reset", "account:register", "account:status", "admin:status", "admin:visibility-public", "catalog:gifts", "catalog:media", "catalog:sounds", "external:open", "snapshot:get", "startup:ready", "updates:check", "updates:install", "window:close", "window:maximize", "window:minimize"]);
  for (const [channel, handler] of handlers) {
    if (publicChannels.has(channel)) continue;
    assert.throws(() => handler(trustedEvent, {}), { code: "ACCOUNT_REQUIRED" }, channel);
  }
});

test("les quatre canaux de lecture visuelle restent explicites, authentifiés et réservés à la fenêtre principale", () => {
  const { handlers, trustedEvent } = registeredHandlers();
  const channels = ["matches:visual-status", "matches:visual-sources", "matches:visual-preview", "matches:visual-save"];
  for (const channel of channels) {
    assert.equal(NEW_CHANNELS.filter((entry) => entry === channel).length, 1, channel);
    assert.equal(handlers.has(channel), true, channel);
    assert.throws(() => handlers.get(channel)(trustedEvent, {}), { code: "ACCOUNT_REQUIRED" }, channel);
    assert.throws(() => handlers.get(channel)({}, {}), { code: "IPC_SENDER_FORBIDDEN" }, channel);
  }
});

test("les intégrations et les commandes ChatBot refusent également un expéditeur non autorisé", () => {
  const { handlers } = registeredHandlers();
  for (const [channel, handler] of handlers) {
    if (!["sound:remove", "startup:ready"].includes(channel) && !/^(kick|controllers|live-directory|users|spotify|chatbot|irl|matches):/.test(channel)) continue;
    assert.throws(() => handler({}, {}), { code: "IPC_SENDER_FORBIDDEN" }, channel);
  }
  for (const channel of ["entity:upsert", "entity:remove"]) {
    assert.throws(() => handlers.get(channel)({}, "commands", {}), { code: "IPC_SENDER_FORBIDDEN" }, channel);
  }
});

test("les exports publics des validateurs IPC délèguent aux vraies fonctions de domaine", () => {
  const { facade } = registeredHandlers();
  const sanitizers = require("../src/main/ipc/sanitizers");
  for (const name of Object.keys(sanitizers)) assert.equal(facade[name], sanitizers[name]);
});

test("le composant Set borné conserve capacité, ordre et comportement des doublons", () => {
  const ids = new Set();
  assert.equal(addBoundedSet(ids, "a", 2), ids);
  addBoundedSet(ids, "b", 2);
  addBoundedSet(ids, "b", 2);
  assert.deepEqual([...ids], ["a", "b"]);
  addBoundedSet(ids, "c", 2);
  assert.deepEqual([...ids], ["b", "c"]);
});

test("les tests source lisent les modules importés et non une fausse copie du monolithe", () => {
  assert.match(readMainSource("ipc.js"), /handle\("game:deal-host-state"/);
  assert.match(readMainSource("action-runner.js"), /class WheelActionController/);
  assert.match(readMainSource("core.js"), /class GameSessionService/);
  assert.match(readMainSource("source-hub.js"), /function tiktokRoomLiveMetadata/);
  assert.match(readMainSource("main.js"), /function createInteractionAuditRunner/);
});
