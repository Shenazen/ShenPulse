"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { changedSessionError } = require("../src/main/account/session-guard");
const { createDefaultState } = require("../src/main/defaults");

function deferred() {
  let resolve;
  const promise = new Promise((accept) => { resolve = accept; });
  return { promise, resolve };
}

const settle = (promise) => promise.then((value) => ({ value }), (error) => ({ error }));

function fixture(hooks = {}) {
  const handlers = new Map(), events = [];
  const state = createDefaultState();
  state.activeAccountUid = "a";
  state.settings.account = { uid: "a", email: "a@example.invalid", refreshTokenSecretId: "synthetic-secret" };
  state.profiles = [{ id: "synthetic-profile-a", name: "Profil A" }];
  const store = {
    getState: () => structuredClone(state),
    getActiveAccountUid: () => state.activeAccountUid,
    getSecret: () => "synthetic-refresh"
  };
  const record = (name) => events.push({ name, uid: state.activeAccountUid });
  const setUid = (uid) => {
    state.activeAccountUid = uid;
    state.settings.account = uid ? { uid, email: `${uid}@example.invalid`, refreshTokenSecretId: "synthetic-secret" } : {};
  };
  const publicStatus = () => ({ authenticated: Boolean(state.activeAccountUid), uid: state.activeAccountUid });
  const accountService = {
    sessionGeneration: 0,
    invalidatePendingSessionOperations() { this.sessionGeneration++; record("invalidate"); },
    async login(incoming) { record("login"); setUid(incoming.email.split("@")[0]); return publicStatus(); },
    async loginWithBrowser() {
      record("browser");
      const generation = this.sessionGeneration;
      await hooks.browser?.();
      if (this.sessionGeneration !== generation) throw changedSessionError();
      setUid("browser-account");
      return publicStatus();
    },
    async status() { await hooks.status?.(); return publicStatus(); },
    logout() { this.sessionGeneration++; record("logout"); setUid(""); return publicStatus(); }
  };
  const core = {
    async suspendAccountWorkspace() { record("suspend"); await hooks.suspend?.(); },
    async resumeAccountWorkspace() { record("resume"); await hooks.resume?.(); },
    async stopSession() { record("stop-live-start"); await hooks.stopLive?.(); record("stop-live-end"); },
    async stopGameSession() { record("stop-game-start"); await hooks.stopGame?.(); record("stop-game-end"); },
    snapshot: () => ({ state }),
    notifyRenderer: () => record("notify"),
    overlayServer: { refreshAccess: () => record("refresh-access"), matchSource: { clear: () => record("clear-match") } },
    gameHub: { assertAccess: () => {} }
  };
  const ipcPath = path.resolve(__dirname, "../src/main/ipc.js");
  const realRequire = createRequire(ipcPath);
  const module = { exports: {} };
  const electron = { ipcMain: { removeHandler: (channel) => handlers.delete(channel), handle: (channel, listener) => handlers.set(channel, listener) } };
  new vm.Script(fs.readFileSync(ipcPath, "utf8"), { filename: ipcPath }).runInNewContext({
    require: (request) => request === "electron" ? electron : realRequire(request),
    module, exports: module.exports, __filename: ipcPath, __dirname: path.dirname(ipcPath)
  });
  module.exports.registerIpc({
    core, store, accountService,
    adminService: { logout: () => record("admin-logout") }, getWindow: () => null
  });
  return { accountService, core, events, state, setUid, call: (channel, argument) => handlers.get(channel)({}, argument) };
}

test("la déconnexion IPC invalide immédiatement les opérations puis arrête et reprend une seule fois", async () => {
  const item = fixture();
  const profilesBefore = structuredClone(item.state.profiles);
  const pending = item.call("account:logout");
  assert.equal(item.accountService.sessionGeneration, 1, "invalidation avant tout await local");
  assert.equal(item.events[0].name, "invalidate");
  const result = await pending;
  assert.equal(result.authenticated, false);
  assert.equal(item.state.activeAccountUid, "");
  assert.deepEqual(item.state.profiles, profilesBefore);
  for (const name of ["stop-live-start", "stop-live-end", "stop-game-start", "stop-game-end", "suspend", "resume", "logout", "admin-logout", "clear-match", "notify"]) {
    assert.equal(item.events.filter((event) => event.name === name).length, 1, name);
  }
  assert.ok(item.events.findIndex((event) => event.name === "stop-live-end") < item.events.findIndex((event) => event.name === "suspend"));
  assert.ok(item.events.findIndex((event) => event.name === "logout") < item.events.findIndex((event) => event.name === "resume"));
  assert.equal(item.events.find((event) => event.name === "resume").uid, "");
});

test("un statut A tardif ne suspend ni ne réinitialise l'espace B déjà repris", async () => {
  const entered = deferred(), response = deferred();
  const item = fixture({ status: async () => { entered.resolve(); await response.promise; } });
  const oldStatus = item.call("account:status");
  await entered.promise;
  await item.call("account:login", { email: "b@example.invalid", password: "synthetic-password" });
  const lifecycleBefore = item.events.filter((event) => ["suspend", "resume"].includes(event.name));
  response.resolve();
  assert.equal((await oldStatus).uid, "b");
  assert.equal(item.state.activeAccountUid, "b");
  assert.deepEqual(item.events.filter((event) => ["suspend", "resume"].includes(event.name)), lifecycleBefore);
});

test("une authentification navigateur en attente ne bloque pas la déconnexion IPC", { timeout: 2000 }, async () => {
  const entered = deferred(), response = deferred();
  const item = fixture({ browser: async () => { entered.resolve(); await response.promise; } });
  const oldBrowser = settle(item.call("account:login-browser", { email: "a@example.invalid" }));
  await entered.promise;
  await item.call("account:logout");
  assert.equal(item.state.activeAccountUid, "");
  const resumed = item.events.filter((event) => event.name === "resume").length;
  response.resolve();
  assert.equal((await oldBrowser).error.code, "ACCOUNT_SESSION_CHANGED");
  assert.equal(item.state.activeAccountUid, "");
  assert.equal(item.events.filter((event) => event.name === "resume").length, resumed, "l'ancien navigateur ne reprend aucun espace");
});

test("le login B attend les arrêts locaux d'un logout antérieur, mais pas son opération périmée", async () => {
  const entered = deferred(), response = deferred();
  const item = fixture({ stopLive: async () => { entered.resolve(); await response.promise; } });
  const oldLogout = settle(item.call("account:logout"));
  await entered.promise;
  const nextLogin = item.call("account:login", { email: "b@example.invalid", password: "synthetic-password" });
  // Vider les continuations déjà prêtes, sans attente temporelle ni réseau.
  for (let index = 0; index < 6; index++) await Promise.resolve();
  const prematureLogin = item.events.some((event) => event.name === "login");
  response.resolve();
  const previous = await oldLogout;
  await nextLogin;
  assert.equal(prematureLogin, false, "aucun changement de compte pendant un ancien stop local");
  assert.equal(previous.error.code, "ACCOUNT_SESSION_CHANGED");
  assert.equal(item.state.activeAccountUid, "b");
  assert.equal(item.events.find((event) => event.name === "stop-live-end").uid, "a");
  assert.equal(item.events.filter((event) => event.name === "logout").length, 0, "le logout périmé ne vide pas B");
  assert.equal(item.events.filter((event) => event.name === "resume").length, 1);
  assert.equal(item.events.find((event) => event.name === "resume").uid, "b");
});

test("un échec de connexion courant reprend une seule fois l'espace précédent sans le remplacer", async () => {
  const item = fixture();
  item.accountService.login = async () => { throw new Error("synthetic-login-failure"); };
  await assert.rejects(item.call("account:login", { email: "b@example.invalid", password: "synthetic-password" }), /synthetic-login-failure/);
  assert.equal(item.state.activeAccountUid, "a");
  assert.equal(item.events.filter((event) => event.name === "suspend").length, 1);
  assert.equal(item.events.filter((event) => event.name === "resume").length, 1);
  assert.equal(item.events.find((event) => event.name === "resume").uid, "a");
});
