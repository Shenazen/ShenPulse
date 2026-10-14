"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { createDefaultState } = require("../src/main/defaults");
const { StateStore } = require("../src/main/store");
const { MAIN_RENDERER_URL } = require("../src/main/integration-ipc-access");
const { ShenPulseCore } = require("../src/main/core");

function ipcFixture() {
  const handlers = new Map();
  const calls = [];
  const state = createDefaultState();
  state.commerce.subscription = { tier: "pro", status: "active" };
  state.settings.account = { uid: "owner", email: "owner@example.com", refreshTokenSecretId: "account-token" };
  const frame = { url: MAIN_RENDERER_URL };
  const contents = { mainFrame: frame, getURL: () => frame.url, isDestroyed: () => false };
  const store = { getState: () => state, getSecret: () => "fixture-token",
    upsert: (collection, item) => {
      calls.push("upsert");
      const index = state[collection].findIndex((entry) => entry.id === item.id);
      if (index < 0) state[collection].push(item); else state[collection][index] = item;
      return state;
    },
    remove: (collection, id) => { calls.push("remove"); state[collection] = state[collection].filter((entry) => entry.id !== id); return state; },
    selectProfile: (id) => { calls.push("select"); state.session.profileId = id; return state; } };
  const core = { snapshot: () => ({ state }), notifyRenderer: () => calls.push("notify"),
    liveEventActions: { chatbot: { syncTimers: () => calls.push("sync"), reset: () => calls.push("reset") }, commandExecutor: { validateTargets() {} } },
    stopGameSession: async () => calls.push("stop-game"), ruleEngine: { resetProfileState: () => calls.push("reset-rules") } };
  const filename = path.resolve(__dirname, "../src/main/ipc.js");
  const realRequire = createRequire(filename);
  const module = { exports: {} };
  new vm.Script(fs.readFileSync(filename, "utf8"), { filename }).runInNewContext({
    require: (request) => request === "electron" ? { ipcMain: {
      removeHandler: (channel) => handlers.delete(channel), handle: (channel, handler) => handlers.set(channel, handler)
    } } : realRequire(request), module, exports: module.exports, __dirname: path.dirname(filename), __filename: filename
  });
  module.exports.registerIpc({ core, store, getWindow: () => ({ webContents: contents, isDestroyed: () => false }) });
  return { handlers, calls, state, frame, contents, core, event: { sender: contents, senderFrame: frame } };
}

test("Free ne peut créer, modifier ou supprimer une commande par accès IPC direct", () => {
  const f = ipcFixture(); f.state.commerce.subscription = { tier: "free", status: "free" };
  const command = { id: "skip", command: "!skip", execution: { type: "music", operation: "next" } };
  f.state.commands = [command];
  assert.throws(() => f.handlers.get("entity:upsert")(f.event, "commands", command), { code: "COMMANDS_ACCESS_FORBIDDEN" });
  assert.throws(() => f.handlers.get("entity:remove")(f.event, "commands", "skip"), { code: "COMMANDS_ACCESS_FORBIDDEN" });
  assert.equal(f.calls.length, 0); assert.deepEqual(f.state.commands, [command]);
});

test("une commande exécutable se sauvegarde sans réponse ni permission d'envoyer au chat", () => {
  const f = ipcFixture();
  f.state.settings.siteVisibility = { actionTypes: { "chat:reply": { scope: "hidden" } } };
  let targetValidated;
  f.core.liveEventActions.commandExecutor = { validateTargets: (item) => { targetValidated = item.execution; } };
  f.handlers.get("entity:upsert")(f.event, "commands", { id: "skip", command: "!skip", execution: { type: "music", operation: "next" }, enabled: true });
  assert.deepEqual(targetValidated, { type: "music", operation: "next" });
  assert.equal(f.state.commands[0].response, "");
  assert.deepEqual(f.calls, ["upsert", "sync", "notify"]);
});

test("référence invalide refusée avant sauvegarde, mais une commande cassée peut être désactivée", () => {
  const f = ipcFixture();
  f.core.liveEventActions.commandExecutor = { validateTargets: () => { throw new Error("Cible manquante"); } };
  const item = { id: "missing", command: "!missing", execution: { type: "action", actionId: "removed-action" } };
  assert.throws(() => f.handlers.get("entity:upsert")(f.event, "commands", item), /Cible manquante/);
  assert.equal(f.calls.length, 0);
  f.handlers.get("entity:upsert")(f.event, "commands", { ...item, enabled: false });
  assert.equal(f.state.commands[0].enabled, false);
  assert.equal(f.state.commands[0].execution.actionId, "removed-action");
});

test("Commandes conserve son propre contrôle d'accès et permet la suppression sans chat.reply", () => {
  const f = ipcFixture();
  const item = { id: "skip", command: "!skip", execution: { type: "music", operation: "next" }, enabled: false };
  f.state.settings.siteVisibility = { navigation: { commands: { scope: "hidden" } } };
  assert.throws(() => f.handlers.get("entity:upsert")(f.event, "commands", item), { code: "COMMANDS_ACCESS_FORBIDDEN" });
  assert.equal(f.calls.length, 0);
  f.state.settings.siteVisibility = { actionTypes: { "chat:reply": { scope: "hidden" } } };
  f.state.commands = [item];
  f.handlers.get("entity:remove")(f.event, "commands", item.id);
  assert.equal(f.state.commands.length, 0);
});

test("CRUD Commandes réutilise l'IPC existant et préserve les textes historiques sans les envoyer", () => {
  const f = ipcFixture();
  const item = { id: "hello", command: "!hello", aliases: ["!bonjour"], response: "Bonjour {{user.displayName}}", enabled: true, cooldownMs: 30000,
    execution: { type: "music", operation: "next" } };
  f.handlers.get("entity:upsert")(f.event, "commands", item);
  assert.equal(f.state.commands[0].kind, "command");
  assert.equal(f.state.commands[0].audience, "all");
  assert.deepEqual(f.calls, ["upsert", "sync", "notify"]);
  f.handlers.get("entity:upsert")(f.event, "commands", { ...f.state.commands[0], enabled: false });
  assert.equal(f.state.commands[0].enabled, false);
  assert.equal(f.state.commands[0].response, item.response);
  assert.equal(f.state.commands.length, 1);
  f.handlers.get("entity:remove")(f.event, "commands", "hello");
  assert.equal(f.state.commands.length, 0);
  assert.deepEqual(f.calls.slice(-3), ["remove", "sync", "notify"]);
});

test("IPC Commandes refuse les anciens messages et valide les commandes exécutables avant toute écriture", () => {
  const f = ipcFixture();
  const save = (item) => f.handlers.get("entity:upsert")(f.event, "commands", item);
  const execution = { type: "music", operation: "next" };
  save({ id: "one", command: "!bonjour", aliases: ["!hello"], execution });
  const before = f.calls.length;
  assert.throws(() => save({ id: "two", command: "!hello", execution }), /existe déjà/);
  assert.throws(() => save({ id: "two", command: "!", execution }), /commande/);
  assert.throws(() => save({ id: "two", kind: "timer", response: "Bonjour", intervalMs: 1000 }), /déclencher/);
  assert.throws(() => save({ id: "auto", kind: "auto-reply", keywords: ["bonjour"], response: "Bonjour" }), /déclencher/);
  assert.throws(() => save({ id: "reply", command: "!reply", response: "Bonjour" }), /déclencher/);
  assert.throws(() => save({ id: "timer", kind: "timer", execution, response: "Un", intervalMs: 60000 }), /déclencher/);
  assert.equal(f.calls.length, before);
  assert.equal(f.state.commands.length, 1);
});

test("mutations ChatBot refusées aux pages distantes, jeux, sous-frames et invités", () => {
  for (const channel of ["entity:upsert", "entity:remove"]) {
    const f = ipcFixture();
    const invoke = (event) => f.handlers.get(channel)(event, "commands", channel.endsWith("upsert") ? { id: "one", command: "!hello", response: "Bonjour" } : "one");
    const gameFrame = { url: MAIN_RENDERER_URL };
    const gameContents = { mainFrame: gameFrame, getURL: () => MAIN_RENDERER_URL, isDestroyed: () => false };
    for (const event of [
      { sender: gameContents, senderFrame: gameFrame },
      { sender: f.contents, senderFrame: { url: MAIN_RENDERER_URL } },
      { sender: f.contents, senderFrame: null }
    ]) assert.throws(() => invoke(event), { code: "IPC_SENDER_FORBIDDEN" });
    f.frame.url = "https://untrusted.example/";
    assert.throws(() => invoke(f.event), { code: "IPC_SENDER_FORBIDDEN" });
    f.frame.url = MAIN_RENDERER_URL;
    f.state.settings.account = {};
    assert.throws(() => invoke(f.event), { code: "ACCOUNT_REQUIRED" });
    assert.equal(f.calls.length, 0);
  }
});

test("scope historique commands/chat conserve les droits des commandes, indépendamment de chat.reply", () => {
  for (const visibility of [
    { navigation: { commands: { scope: "hidden" } } },
    { navigation: { chat: { scope: "admin" } } }
  ]) {
    const f = ipcFixture();
    f.state.settings.siteVisibility = visibility;
    assert.throws(() => f.handlers.get("entity:upsert")(f.event, "commands", { id: "one", command: "!hello", execution: { type: "music", operation: "next" } }), { code: "COMMANDS_ACCESS_FORBIDDEN" });
    assert.equal(f.calls.length, 0);
  }
});

test("une ancienne réponse n'est plus modifiable par Commandes et ses données ne sont pas supprimées", () => {
  const f = ipcFixture();
  const legacy = { id: "legacy", command: "!ancien nom", response: "x".repeat(800), cooldownMs: 7200000, custom: { preserved: true }, enabled: true };
  f.state.commands = [legacy];
  assert.throws(() => f.handlers.get("entity:upsert")(f.event, "commands", { ...legacy, enabled: false }), /déclencher/);
  assert.equal(f.state.commands[0].response.length, 800);
  assert.equal(f.state.commands[0].cooldownMs, 7200000);
  assert.deepEqual(f.state.commands[0].custom, { preserved: true });
  assert.equal(f.state.commands[0].enabled, true);
  assert.equal(f.calls.length, 0);
  f.handlers.get("entity:remove")(f.event, "commands", legacy.id);
  assert.equal(f.state.commands.length, 0, "la suppression explicite reste possible pour récupération");
});

test("les anciennes réponses inactives ne réservent plus un nom de commande exécutable", () => {
  const f = ipcFixture();
  const legacy = { id: "legacy", command: "!hello", response: "Ancienne réponse", enabled: true };
  f.state.commands = [legacy];
  f.handlers.get("entity:upsert")(f.event, "commands", { id: "new", command: "!hello", execution: { type: "music", operation: "next" } });
  assert.deepEqual(f.state.commands[0], legacy);
  assert.equal(f.state.commands.length, 2);
});

test("sélection de profil nettoie le ChatBot avant la transition et le resynchronise après", async () => {
  const f = ipcFixture();
  await f.handlers.get("profile:select")(f.event, "profile-2");
  assert.deepEqual(f.calls, ["reset", "stop-game", "select", "reset-rules", "sync", "notify"]);
  assert.equal(f.state.session.profileId, "profile-2");
});

test("trois types de messages restent isolés et conservés dans les profils du store existant", () => {
  const store = new StateStore(path.join(os.tmpdir(), "shenpulse-chatbot-in-memory"));
  store.touch = () => {}; // Aucun fichier utilisateur ni secret n'est lu/écrit.
  const first = store.state.profiles[0].id;
  store.upsert("profiles", { id: "profile-2", name: "Deuxième profil" });
  const entries = [
    { id: "command", command: "!hello", aliases: ["!salut"], response: "Bonjour", enabled: true },
    { id: "auto", kind: "auto-reply", keywords: ["discord", "serveur"], response: "Lien", enabled: true },
    { id: "timer", kind: "timer", messages: ["Un", "Deux"], intervalMs: 60000, minChatMessages: 5, response: "Un", enabled: true }
  ];
  for (const entry of entries) store.upsert("commands", entry);
  store.selectProfile("profile-2");
  assert.deepEqual(store.state.commands, []);
  store.upsert("commands", { id: "second", command: "!other", response: "Autre", enabled: true });
  store.selectProfile(first);
  assert.deepEqual(store.state.commands, entries);
  store.selectProfile("profile-2");
  assert.deepEqual(store.state.commands.map((entry) => entry.id), ["second"]);
});

test("une commande musicale lente ne retarde pas les règles du même commentaire dans le moteur de production", async (context) => {
  const store = new StateStore(path.join(os.tmpdir(), "shenpulse-chatbot-live-in-memory"));
  store.touch = () => {};
  store.state.activeAccountUid = "fixture-owner";
  store.state.settings.account = { uid: "fixture-owner", email: "owner@example.com", refreshTokenSecretId: "fixture-token" };
  store.state.commerce.subscription = { tier: "pro", status: "active" };
  store.secrets["fixture-token"] = { encrypted: false, value: Buffer.from("fixture-only-token").toString("base64") };
  store.state.session.running = true;
  store.state.settings.kick.live = true;
  store.state.connections.push({ id: "source_kick", type: "kick-native", status: "connected", enabled: true });
  store.state.commands = [{ id: "hello", command: "!hello", execution: { type: "music", operation: "next" }, enabled: true }];
  const core = new ShenPulseCore({ store, resourcesDirectory: path.resolve(__dirname, "../resources"), notifyRenderer: () => {} });
  context.after(() => { clearTimeout(core.deferredChangeTimer); core.liveEventActions.chatbot.reset(); core.overlayCompletionController.stop(); });
  // Le fournisseur de ce test est autorisé, sans jeton réel ni appel Kick.
  core.kickService.status = () => ({ connected: true, scopes: ["chat:write"] });
  core.sourceHub.runtimes.set("source_kick", { send: () => {} });
  let release;
  core.sourceHub.send = () => { throw new Error("La production Commandes ne doit envoyer aucun message."); };
  core.spotifyService.control = () => new Promise((resolve) => { release = resolve; });
  let rules = 0;
  core.ruleEngine.process = async () => { rules += 1; };
  core.overlayCompletionController.handleLikeGoalChange = async () => {};
  let timeout;
  const completed = await Promise.race([
    core.ingest({ type: "chat", source: "source_kick", user: { id: "lou", name: "Lou" }, data: { message: "!hello" } }).then(() => true),
    new Promise((resolve) => { timeout = setTimeout(() => resolve(false), 100); })
  ]);
  clearTimeout(timeout);
  assert.equal(completed, true);
  assert.equal(rules, 1);
  assert.equal(core.liveEventActions.chatbot.activeDeliveries.size, 1);
  release({ ok: true }); await core.liveEventActions.chatbot.whenIdle();
});
