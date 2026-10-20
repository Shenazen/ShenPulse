"use strict";

/** Qualification Electron avec données artificielles, sans compte, effet ni plugin utilisateur. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");
const { WebSocketServer } = require("ws");
const appRoot = path.resolve(process.argv.find((value) => value.startsWith("--app-root="))?.slice(11) || path.join(__dirname, ".."));
const { createDefaultState } = require(path.join(appRoot, "src/main/defaults"));
const { ControllerService } = require(path.join(appRoot, "src/main/controller-service"));
const { appPermissionAllowed } = require(path.join(appRoot, "src/main/app-permissions"));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-controller-smoke-"));
app.setPath("userData", path.join(temporary, "chromium"));
process.env.APPDATA = path.join(temporary, "appdata");
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("no-proxy-server");
const rendererDirectory = path.join(appRoot, "src/renderer");
const state = createDefaultState();
const account = { uid: "controller-smoke", email: "alexandre.leuridan@gmail.com", emailVerified: true, authenticated: true, displayName: "Qualification contrôleurs" };
state.settings.account = account;
state.settings.controllers = {};
state.settings.publicOverlayRelay.enabled = false;
state.connections = [];
state.rules = [{ id: "fixture-rule", name: "Action test", enabled: true, trigger: { type: "gift" }, actions: [{ id: "fixture-action", type: "audio.play", enabled: true, config: {} }] }];
state.commerce.subscription = { tier: "pro", status: "active", source: "own" };
const effects = [], permissions = [], errors = [];
const secrets = new Map();
const store = {
  getState: () => state,
  set(key, value) { const [parent, child] = key.split("."); state[parent][child] = value; },
  setSecret(key, value) { const id = key || "fixture-device"; secrets.set(id, value); return id; },
  getSecret: (key) => secrets.get(key)
};
const service = new ControllerService({ store, authorize() {}, pluginDirectory: path.join(appRoot, "resources/controllers/com.shenpulse.control.sdPlugin"), executeAction: async (id) => effects.push(id), selectProfile: async (id) => effects.push(id) });
service.port = () => service.server?.address()?.port || 0;
const snapshot = () => ({ state, appVersion: "fixture", packs: [], soundCatalog: [], mediaCatalog: [], overlayUrls: {}, localOverlayUrls: {}, publicOverlayRelay: {}, services: {}, liveDirectory: { available: false, rows: [] } });
const handlers = {
  "snapshot:get": snapshot, "account:status": () => account,
  "admin:status": () => ({ ...account, authorized: true }),
  "admin:dashboard": () => ({ status: { ...account, authorized: true }, commerce: { catalog: { products: {}, subscriptions: {}, promotions: {} } }, errors: {} }),
  "admin:visibility-public": () => ({ schemaVersion: 7, navigation: {}, features: {}, games: {}, overlays: {} }),
  "account:game-cheat-access": () => ({ allowed: true }), "account:sync-entitlements": () => ({}),
  "catalog:gifts": () => ({ gifts: [], total: 0 }), "startup:ready": () => ({ ready: true }),
  "game:install-status": () => null, "updates:check": () => ({ available: false }),
  "controllers:status": () => service.status(), "controllers:pair": () => service.pairingCode(),
  "controllers:install": () => service.installPlugin(), "controllers:revoke": (_event, id) => service.revoke(id),
  "controllers:connect-local": () => service.connectLocalPlugin(),
  "controllers:mapping-save": (_event, value) => service.saveMapping(value),
  "controllers:mapping-remove": (_event, id) => service.removeMapping(id),
  "controllers:execute": (_event, value) => service.executeMapping(value)
};
for (const [channel, listener] of Object.entries(handlers)) ipcMain.handle(channel, listener);
let target;
const deadline = setTimeout(() => { process.stderr.write("Controller smoke timeout\n"); app.exit(1); }, 60000);
const evaluate = (source) => target.webContents.executeJavaScript(source, true);
async function until(source) {
  for (let index = 0; index < 100; index++) {
    if (await evaluate(`Boolean(${source})`).catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error(`Condition non atteinte : ${source}`);
}
async function click(action) {
  await evaluate(`document.querySelector('[data-action="${action}"]').click()`);
}
async function run() {
  target = new BrowserWindow({ width: 1440, height: 1000, show: false, webPreferences: {
    preload: path.join(appRoot, "src/main/preload.js"), contextIsolation: true,
    nodeIntegration: false, sandbox: true, webSecurity: true, backgroundThrottling: false
  } });
  target.webContents.on("console-message", (_event, _level, message) => { if (/Error|failed|not defined/i.test(message)) errors.push(message); });
  target.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: /^https?:/.test(details.url) }));
  const permission = (contents, name, details = {}) => {
    const allowed = appPermissionAllowed({ permission: name, requestingUrl: details.requestingUrl || "", contentsUrl: contents?.getURL() || "", isMainFrame: details.isMainFrame === true, authenticated: true, rendererDirectory });
    permissions.push({ name, allowed, isMainFrame: details.isMainFrame, requestingUrl: details.requestingUrl });
    return allowed;
  };
  target.webContents.session.setPermissionCheckHandler((contents, name, _origin, details) => permission(contents, name, details));
  target.webContents.session.setPermissionRequestHandler((contents, name, callback, details) => callback(permission(contents, name, details)));
  await target.loadFile(path.join(rendererDirectory, "index.html"));
  await until("typeof adminSession !== 'undefined' && adminSession.authorized");
  await evaluate("currentPage = 'controllers'; render()");
  await click("controller-refresh");
  await until("document.getElementById('toast-region').textContent.includes('Contrôleurs actualisés')");
  await click("controller-mapping-add");
  await until("document.getElementById('editor-dialog').open");
  await evaluate("document.getElementById('editor-form').requestSubmit()");
  await until("!document.getElementById('editor-dialog').open");
  assert.equal(service.status().mappings.length, 1);
  await click("controller-mapping-edit");
  await until("document.getElementById('editor-dialog').open");
  await evaluate("document.querySelector('#dialog-body [name=number]').value = '44'; document.getElementById('editor-form').requestSubmit()");
  await until("!document.getElementById('editor-dialog').open");
  assert.equal(service.status().mappings[0].number, 44);
  await click("controller-mapping-test");
  await until("document.getElementById('toast-region').textContent.includes('Commande exécutée')");
  assert.deepEqual(effects, ["fixture-action"]);
  await click("controller-mapping-remove");
  await until("!document.querySelector('[data-action=controller-mapping-test]')");
  await click("controller-install");
  await until("document.getElementById('toast-region').textContent.includes('Plugin ShenPulse installé')");
  await until("document.querySelector('[data-action=controller-revoke]')");
  await click("controller-revoke");
  await until("!document.querySelector('[data-action=controller-revoke]')");
  await click("controller-connect-local");
  await until("document.querySelector('[data-action=controller-revoke]')");
  assert.equal(service.status().pluginInstalled, true);
  assert.equal(service.status().automaticConnection, true);
  await verifyAutomaticPlugin();
  // Web MIDI réel : vérifie l'autorisation Electron, sans envoyer de commande matérielle.
  const midi = await evaluate("navigator.requestMIDIAccess({sysex:false}).then(access => ({ok:true, inputs:access.inputs.size, sysexEnabled:access.sysexEnabled}), error => ({ok:false, name:error.name, message:error.message}))");
  assert.equal(midi.ok, true, JSON.stringify({ midi, permissions }));
  assert.equal(midi.sysexEnabled, false);
  await click("controller-midi-learn");
  await until("document.querySelector('[data-action=controller-midi-learn]').textContent.includes('Annuler')");
  await click("controller-midi-learn");
  await click("controller-midi-disconnect");
  await until("!document.querySelector('[data-action=controller-midi-disconnect]')");
  fs.writeFileSync(path.join(temporary, "report.json"), JSON.stringify({ passed: true, effects, midi, permissions, errors }, null, 2));
  process.stdout.write(`Controller Electron smoke passed: ${temporary}\n`);
}

async function verifyAutomaticPlugin() {
  const host = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise((resolve) => host.once("listening", resolve));
  const plugin = new BrowserWindow({ show: false, webPreferences: { partition: "isolated-controller-plugin-qa", contextIsolation: true, nodeIntegration: false, sandbox: true } });
  plugin.webContents.on("console-message", (event) => { if (event.message) errors.push(`plugin: ${event.message}`); });
  plugin.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: /^(https?|wss?):/.test(details.url) && new URL(details.url).hostname !== "127.0.0.1" }));
  plugin.webContents.session.setPermissionCheckHandler((_contents, name) => ["loopback-network", "local-network", "local-network-access"].includes(name));
  plugin.webContents.session.setPermissionRequestHandler((_contents, name, callback) => callback(["loopback-network", "local-network", "local-network-access"].includes(name)));
  const messages = [];
  let socket;
  host.on("connection", (client) => {
    socket = client;
    client.on("message", (raw) => {
      const message = JSON.parse(raw);
      messages.push(message);
      if (message.event === "getGlobalSettings") client.send(JSON.stringify({ event: "didReceiveGlobalSettings", payload: { settings: {} } }));
    });
  });
  const waitMessage = async (predicate) => {
    for (let index = 0; index < 100; index++) {
      const message = messages.find(predicate);
      if (message) return message;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    const diagnostic = await plugin.webContents.executeJavaScript("({state:streamDeckSocket?.readyState,url:streamDeckSocket?.url})").catch(() => ({}));
    throw new Error(`Réponse du plugin automatique absente (${messages.map((message) => message.event).join(", ")}, ${JSON.stringify(diagnostic)}).`);
  };
  try {
    await plugin.loadFile(path.join(service.localPluginDirectory, "plugin.html"));
    await plugin.webContents.executeJavaScript(`window.connectElgatoStreamDeckSocket(${host.address().port}, 'fixture-plugin', 'registerPlugin')`);
    await waitMessage((message) => message.event === "getGlobalSettings");
    socket.send(JSON.stringify({ event: "sendToPlugin", context: "fixture-key", payload: { command: "targets", requestId: 1 } }));
    const first = await waitMessage((message) => message.event === "sendToPropertyInspector" && message.payload.requestId === 1);
    assert.ok(first.payload.targets, JSON.stringify(first.payload));
    assert.equal(first.payload.targets.activeProfile.id, state.session.profileId);
    state.profiles.push({ id: "second-profile", name: "Profil suivant" });
    state.session.profileId = "second-profile";
    socket.send(JSON.stringify({ event: "sendToPlugin", context: "fixture-key", payload: { command: "targets", requestId: 2 } }));
    const second = await waitMessage((message) => message.event === "sendToPropertyInspector" && message.payload.requestId === 2);
    assert.equal(second.payload.targets.activeProfile.name, "Profil suivant");
    socket.send(JSON.stringify({ event: "willAppear", context: "fixture-key", action: "com.shenpulse.control.action", payload: { settings: { targetId: "fixture-action" } } }));
    socket.send(JSON.stringify({ event: "keyDown", context: "fixture-key" }));
    await waitMessage((message) => message.event === "showOk");
    assert.deepEqual(effects, ["fixture-action", "fixture-action"]);
  } finally {
    plugin.destroy();
    for (const client of host.clients) client.terminate();
    await new Promise((resolve) => host.close(resolve));
  }
}
app.whenReady().then(run).then(async () => { clearTimeout(deadline); await service.stop(); target.destroy(); app.exit(0); }).catch(async (error) => {
  clearTimeout(deadline);
  fs.writeFileSync(path.join(temporary, "failure.json"), JSON.stringify({ error: error.stack, permissions, errors }, null, 2));
  process.stderr.write(`${error.stack}\nReport: ${temporary}\n`);
  await service.stop(); target?.destroy(); app.exit(1);
});
