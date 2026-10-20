"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const os = require("node:os");
const { JSDOM } = require("jsdom");
const { ControllerService } = require("../src/main/controller-service");
const root = path.join(__dirname, "..");

function page(t) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, "src/renderer/index.html"), "utf8"), { runScripts: "outside-only", pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const window = dom.window;
  const state = {
    session: { profileId: "profile-1" },
    settings: { account: { uid: "test-owner" }, controllers: {} },
    rules: [{ id: "rule-1", name: "Alerte", enabled: true, actions: [{ id: "sound-1", type: "audio.play", name: "Son", enabled: true }] }],
    profiles: [{ id: "profile-1", name: "Profil test" }]
  };
  const calls = [];
  const secrets = new Map();
  const store = {
    getState: () => state,
    set(key, value) { const [parent, child] = key.split("."); state[parent][child] = value; },
    setSecret(key, value) { const id = key || "device-secret"; secrets.set(id, value); return id; },
    getSecret: (key) => secrets.get(key)
  };
  const localPluginDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-controller-page-test-"));
  t.after(() => {
    assert.ok(path.resolve(localPluginDirectory).startsWith(path.join(os.tmpdir(), "shenpulse-controller-page-test-")));
    fs.rmSync(localPluginDirectory, { recursive: true, force: true });
  });
  fs.writeFileSync(path.join(localPluginDirectory, "manifest.json"), "{}");
  const service = new ControllerService({ store, authorize() {}, pluginDirectory: path.join(root, "resources/controllers/com.shenpulse.control.sdPlugin"), localPluginDirectory, executeAction: async (id) => calls.push(id), selectProfile: async (id) => calls.push(id) });
  service.start = async () => service.status();
  const notices = [];
  const content = window.document.getElementById("content");
  Object.assign(window, {
    snapshot: { state }, content, currentPage: "controllers", dialogSessionId: 0, dialogSubmitHandler: null,
    isVerifiedAdminSession: () => window.snapshot.state.settings.account.uid === "test-owner",
    renderOwnerOnlyPagePlaceholder: () => "Accès réservé", renderStudioHero: () => "", emptyInline: (text) => `<p>${text}</p>`,
    bindOverlayRuntimeFrames() {}, render() { content.innerHTML = window.renderControllers(); },
    toast: (...args) => notices.push(args), acceptSnapshot: (value) => { window.snapshot = value; },
    escapeHtml: (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;"),
    api: {
      getSnapshot: async () => ({ state }),
      controllers: {
        status: async () => service.status(), pair: () => service.pairingCode(),
        connectLocal: () => service.connectLocalPlugin(),
        install: async () => ({ installed: true }), revoke: async (id) => service.revoke(id),
        saveMapping: async (mapping) => service.saveMapping(mapping),
        removeMapping: async (id) => service.removeMapping(id), execute: (options) => service.executeMapping(options)
      }
    }
  });
  for (const [name, id] of Object.entries({ dialog: "editor-dialog", dialogForm: "editor-form", dialogTitle: "dialog-title", dialogKicker: "dialog-kicker", dialogBody: "dialog-body", dialogError: "dialog-error", dialogSubmitButton: "dialog-submit" })) window[name] = window.document.getElementById(id);
  window.dialog.showModal = () => { window.dialog.open = true; };
  window.dialog.close = () => { window.dialog.open = false; };
  for (const file of ["src/shared/controller-contract.js", "src/renderer/app/core/components.js", "src/renderer/app/editors/core.js", "src/renderer/app/features/controllers.js", "src/renderer/app/actions/handlers/contracts.js", "src/renderer/app/actions/handlers/controllers.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), dom.getInternalVMContext(), { filename: file });
  }
  let pending;
  content.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (target) pending = window.handleControllerAction({ action: target.dataset.action, id: target.dataset.id });
  });
  window.render();
  return {
    window, content, state, service, calls, notices,
    async click(action) { const button = content.querySelector(`[data-action="${action}"]`); assert.ok(button, action); assert.equal(button.disabled, false, action); button.click(); await pending; },
    async submit() { await window.dialogSubmitHandler(new window.FormData(window.dialogForm)); window.dialog.close(); window.render(); }
  };
}

test("tous les boutons d’association ouvrent, enregistrent, exécutent et suppriment une vraie commande", async (t) => {
  const p = page(t);
  await p.click("controller-mapping-add");
  assert.equal(p.window.dialog.open, true);
  assert.equal(p.window.dialogTitle.textContent, "Associer une commande MIDI");
  p.window.dialogBody.querySelector('[name="name"]').value = "Mon pad";
  await p.submit();
  assert.equal(p.state.settings.controllers.mappings.length, 1);
  await p.click("controller-mapping-edit");
  p.window.dialogBody.querySelector('[name="number"]').value = "61";
  await p.submit();
  assert.equal(p.state.settings.controllers.mappings[0].number, 61);
  await p.click("controller-mapping-test");
  assert.deepEqual(p.calls, ["sound-1"]);
  assert.equal(p.notices.at(-1)[0], "Commande exécutée");
  await p.click("controller-mapping-test");
  assert.equal(p.notices.at(-1)[0], "Commande non exécutée");
  await p.click("controller-mapping-remove");
  assert.equal(p.state.settings.controllers.mappings.length, 0);
  assert.equal(p.content.querySelector('[data-action="controller-mapping-test"]'), null);
});

test("connexion automatique, révocation, actualisation et installation donnent le résultat attendu", async (t) => {
  const p = page(t);
  await p.click("controller-connect-local");
  assert.equal(p.service.status().automaticConnection, true);
  assert.equal(p.content.querySelector('[data-action="controller-pair"]'), null);
  await p.click("controller-refresh");
  assert.match(p.content.textContent, /Stream Deck de ce PC/);
  assert.equal(p.notices.at(-1)[0], "Contrôleurs actualisés");
  await p.click("controller-revoke");
  assert.equal(p.service.status().devices.length, 0);
  assert.equal(p.content.querySelector('[data-action="controller-revoke"]'), null);
  await p.click("controller-install");
  assert.equal(p.notices.at(-1)[0], "Plugin ShenPulse installé");
  p.window.api.controllers.install = async () => { throw new Error("Échec de copie vérifié"); };
  await p.click("controller-install");
  assert.equal(p.notices.at(-1)[2], true);
  assert.match(p.notices.at(-1)[1], /Échec de copie vérifié/);
});

test("apprendre connecte le MIDI, ouvre le formulaire au signal puis déconnecte les ports", async (t) => {
  const p = page(t);
  let closed = 0;
  const input = { id: "pad-usb", name: "Mon contrôleur", state: "connected", close: async () => { closed++; } };
  const access = { inputs: new Map([[input.id, input]]) };
  let requested = 0;
  p.window.navigator.requestMIDIAccess = async () => { requested++; return access; };
  await p.click("controller-midi-learn");
  assert.equal(requested, 1);
  assert.match(p.content.textContent, /En attente d’un signal/);
  input.onmidimessage({ data: [0x91, 42, 110] });
  assert.equal(p.window.dialog.open, true);
  assert.equal(p.window.dialogBody.querySelector('[name="channel"]').value, "2");
  assert.equal(p.window.dialogBody.querySelector('[name="number"]').value, "42");
  await p.submit();
  assert.equal(p.state.settings.controllers.mappings[0].deviceId, "pad-usb");
  input.onmidimessage({ data: [0x91, 42, 110] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(p.calls, ["sound-1"]);
  await p.click("controller-midi-connect");
  assert.equal(requested, 1, "la recherche réutilise la connexion MIDI");
  await p.click("controller-midi-learn");
  await p.click("controller-midi-learn");
  assert.equal(p.notices.at(-1)[0], "Apprentissage MIDI annulé");
  await p.click("controller-midi-disconnect");
  assert.equal(closed, 1);
  assert.equal(input.onmidimessage, null);
});

test("absence de matériel ou autorisation refusée reste visible, sans faux succès", async (t) => {
  const p = page(t);
  p.window.navigator.requestMIDIAccess = async () => { throw new p.window.DOMException("Denied", "NotAllowedError"); };
  await p.click("controller-midi-connect");
  assert.match(p.notices.at(-1)[1], /accès MIDI a été refusé/);
  assert.equal(p.notices.at(-1)[2], true);
  p.window.navigator.requestMIDIAccess = async () => ({ inputs: new Map() });
  await p.click("controller-midi-connect");
  assert.equal(p.notices.at(-1)[0], "Aucun appareil MIDI détecté");
});

test("une connexion MIDI retardée ne survit pas à une déconnexion ni au changement de compte", async (t) => {
  const p = page(t);
  let finish;
  let closed = 0;
  const access = { inputs: new Map([["late", { close: async () => { closed++; } }]]) };
  p.window.navigator.requestMIDIAccess = () => new Promise((resolve) => { finish = resolve; });
  const connecting = p.click("controller-midi-connect");
  p.window.disconnectMidiController();
  p.window.snapshot.state.settings.account.uid = "another-account";
  finish(access);
  await connecting;
  assert.equal(closed, 1);
  assert.equal(access.onstatechange, null);
  assert.ok(!p.notices.some(([title]) => title === "MIDI connecté"));
});
