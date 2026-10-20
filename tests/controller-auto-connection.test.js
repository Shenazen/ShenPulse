"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { ControllerService } = require("../src/main/controller-service");

test("le plugin local se connecte sans code et suit le profil actif sans ouvrir les commandes anonymes", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-auto-controller-test-"));
  t.after(() => {
    assert.ok(path.resolve(directory).startsWith(path.join(os.tmpdir(), "shenpulse-auto-controller-test-")));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  fs.writeFileSync(path.join(directory, "manifest.json"), "{}");
  const state = {
    settings: { controllers: {} }, session: { profileId: "first" },
    profiles: [{ id: "first", name: "Premier profil" }, { id: "second", name: "Deuxième profil" }],
    rules: [{ id: "rule", name: "Première action", enabled: true, actions: [{ id: "action-1", type: "audio.play" }] }]
  };
  const secrets = new Map();
  const calls = [];
  const store = {
    getState: () => state,
    set(_key, value) { state.settings.controllers = value; },
    setSecret(key, value) { const id = key || `secret-${secrets.size}`; secrets.set(id, value); return id; },
    getSecret: (key) => secrets.get(key)
  };
  let allowed = true;
  const service = new ControllerService({ store, pluginDirectory: directory, localPluginDirectory: directory,
    authorize() { if (!allowed) { const error = new Error("Compte requis"); error.code = "ADMIN_ACCOUNT_REQUIRED"; throw error; } },
    executeAction: async (id) => calls.push(id), selectProfile: async (id) => calls.push(id)
  });
  t.after(() => service.stop());
  service.port = () => service.server?.address()?.port || 0;
  const connection = () => {
    const context = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(directory, "local-connection.js"), "utf8"), context);
    return context.window.ShenPulseLocalConnection;
  };
  await Promise.all([service.start(), service.start()]);
  const local = connection();
  assert.ok(local.token.length > 32);
  assert.equal(service.status().devices.length, 1);
  assert.equal(service.status().automaticConnection, true);
  assert.ok(!JSON.stringify(service.status()).includes(local.token));
  const headers = { Authorization: `Bearer ${local.token}`, "Content-Type": "application/json" };
  assert.equal((await fetch(`${local.endpoint}/targets`)).status, 401);
  assert.equal((await fetch(`${local.endpoint}/targets`, { headers: { ...headers, Origin: "https://example.test" } })).status, 403);
  const first = await (await fetch(`${local.endpoint}/targets`, { headers })).json();
  assert.equal(first.activeProfile.id, "first");
  assert.equal(first.actions[0].id, "action-1");
  state.session.profileId = "second";
  state.rules[0].actions[0].id = "action-2";
  const second = await (await fetch(`${local.endpoint}/targets`, { headers })).json();
  assert.equal(second.activeProfile.name, "Deuxième profil");
  assert.equal(second.actions[0].id, "action-2");
  const execute = async (id) => fetch(`${local.endpoint}/execute`, { method: "POST", headers, body: JSON.stringify({ targetType: "action", targetId: id }) });
  assert.equal((await execute("action-1")).status, 400);
  assert.equal((await execute("action-2")).status, 200);
  assert.deepEqual(calls, ["action-2"]);
  service.revoke(local.deviceId);
  assert.equal(connection(), null);
  assert.equal((await fetch(`${local.endpoint}/targets`, { headers })).status, 401);
  service.syncLocalConnection();
  assert.equal(connection(), null, "la révocation reste active jusqu’à une reconnexion explicite");
  await service.connectLocalPlugin();
  const fresh = connection();
  assert.notEqual(fresh.token, local.token);
  allowed = false;
  assert.equal((await fetch(`${fresh.endpoint}/targets`, { headers: { Authorization: `Bearer ${fresh.token}` } })).status, 403);
  await service.stop();
  assert.equal(connection(), null);
});
