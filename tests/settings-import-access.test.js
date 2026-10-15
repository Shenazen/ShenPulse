"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { StateStore } = require("../src/main/store");
const { createDefaultState } = require("../src/main/defaults");
const { registerDesktopIpc } = require("../src/main/ipc/desktop");

function storeFixture(context, { owner = false, pro = false } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-import-permissions-"));
  const store = new StateStore(directory, { isEncryptionAvailable: () => false });
  store.load();
  store.activateAccount("fixture-user");
  const refreshTokenSecretId = store.setSecret("", "fixture-refresh-token");
  store.set("settings.account", { uid: "fixture-user", emailVerified: true, refreshTokenSecretId,
    email: owner ? "alexandre.leuridan@gmail.com" : "ordinary@example.com" });
  store.mutate((state) => {
    state.commerce.subscription = { tier: pro ? "pro" : "free", status: pro ? "active" : "free" };
    state.settings.apiPort = 22001;
    state.settings.overlayPort = 22002;
    state.settings.controllers.devices = [{ id: "existing-device" }];
  });
  context.after(() => { store.flush(); fs.rmSync(directory, { recursive: true, force: true }); });
  return store;
}

function importedProfile() {
  const imported = createDefaultState();
  imported.rules = [{ id: "imported-rule", name: "Alerte importée", enabled: true, trigger: { type: "follow" },
    actions: [{ id: "imported-action", type: "tts.speak", config: { text: "Bienvenue" } }] }];
  imported.commands = [{ id: "imported-command", command: "!skip", kind: "music" }];
  imported.profiles = [{ id: "imported-profile", name: "Profil importé", enabledRuleIds: ["imported-rule"] }];
  imported.session.profileId = "imported-profile";
  imported.customSounds = [{ id: "custom:imported-sound", url: "https://example.com/sound.mp3" }];
  imported.customMedia = [{ id: "custom:imported-gif", url: "https://example.com/animation.gif", kind: "gif" }];
  imported.settings.locale = "en-US";
  imported.settings.tts.rate = 1.25;
  imported.settings.tiktok.username = "imported_creator";
  imported.settings.overlayConfigs.likeGoal.target = 5000;
  imported.settings.apiPort = 33001;
  imported.settings.overlayPort = 33002;
  imported.settings.allowKeystrokes = true;
  imported.settings.startOverlayServer = false;
  imported.settings.obs = { url: "ws://127.0.0.1:9000", passwordSecretId: "foreign-obs-secret" };
  imported.settings.controllers.devices = [{ id: "foreign-device" }];
  imported.settings.spotify = { accessTokenSecretId: "foreign-spotify-secret" };
  return imported;
}

test("les imports Free et Pro conservent l'infrastructure sans perdre profils, sons, commandes ou overlays", (context) => {
  for (const pro of [false, true]) {
    const store = storeFixture(context, { pro });
    const privateKeys = ["apiPort", "overlayPort", "allowKeystrokes", "startOverlayServer", "obs", "controllers", "spotify", "backblaze"];
    const before = structuredClone(store.state.settings), imported = importedProfile(), original = JSON.stringify(imported);
    store.importState(imported);
    for (const key of privateKeys) assert.deepEqual(store.state.settings[key], before[key], key);
    assert.equal(store.state.settings.locale, "en-US");
    assert.equal(store.state.settings.tts.rate, 1.25);
    assert.equal(store.state.settings.tiktok.username, "imported_creator");
    assert.equal(store.state.settings.overlayConfigs.likeGoal.target, 5000);
    assert.equal(store.state.profiles[0].name, "Profil importé");
    assert.equal(store.state.rules[0].actions[0].config.text, "Bienvenue");
    assert.equal(store.state.commands[0].id, "imported-command");
    assert.equal(store.state.customSounds[0].id, "custom:imported-sound");
    assert.equal(store.state.customMedia[0].id, "custom:imported-gif");
    assert.equal(store.state.activeAccountUid, "fixture-user");
    assert.equal(JSON.stringify(imported), original, "l'import ne modifie jamais son objet source");
  }
});

test("un ancien import sans paramètres infra ne remplace pas ceux du compte par les valeurs par défaut", (context) => {
  const store = storeFixture(context);
  store.importState({ rules: [], settings: { locale: "en-US" } });
  assert.equal(store.state.settings.apiPort, 22001);
  assert.equal(store.state.settings.overlayPort, 22002);
  assert.deepEqual(store.state.settings.controllers.devices, [{ id: "existing-device" }]);
});

test("un ancien import récupère les préférences musicales, jamais les jetons Spotify de l'exporteur", (context) => {
  const store = storeFixture(context), imported = importedProfile();
  const ownSpotify = structuredClone(store.state.settings.spotify);
  imported.settings.spotify.songRequests = { enabled: true, maxQueue: 11, commands: { request: "!musique" } };
  store.importState(imported);
  assert.equal(store.state.settings.spotify.songRequests.enabled, true);
  assert.equal(store.state.settings.spotify.songRequests.maxQueue, 11);
  assert.equal(store.state.settings.spotify.songRequests.commands.request, "!musique");
  assert.equal(store.state.settings.spotify.accessTokenSecretId, ownSpotify.accessTokenSecretId);
  assert.equal(store.state.settings.spotify.refreshTokenSecretId, ownSpotify.refreshTokenSecretId);
  assert.equal(store.state.profiles[0].workspace.songRequestSettings.maxQueue, 11);
  assert.doesNotMatch(JSON.stringify(store.state.profiles), /foreign-spotify-secret/);
});

test("le propriétaire vérifié peut encore restaurer ses paramètres privés depuis son export", (context) => {
  const store = storeFixture(context, { owner: true });
  store.importState(importedProfile());
  assert.equal(store.state.settings.apiPort, 33001);
  assert.equal(store.state.settings.overlayPort, 33002);
  assert.equal(store.state.settings.allowKeystrokes, true);
  assert.equal(store.state.settings.startOverlayServer, false);
  assert.equal(store.state.settings.obs.url, "ws://127.0.0.1:9000");
  assert.deepEqual(store.state.settings.controllers.devices, [{ id: "foreign-device" }]);
});

test("le dialogue d'import refuse un invité et ne cible pas un compte changé pendant la sélection", async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-import-dialog-"));
  const filename = path.join(directory, "profile.json");
  fs.writeFileSync(filename, JSON.stringify(importedProfile()));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const phase of ["guest", "changed", "normal"]) {
    const state = { settings: { account: phase === "guest" ? {} : {
      uid: "fixture-user", email: "ordinary@example.com", refreshTokenSecretId: "account-session"
    } } };
    const handlers = new Map(), calls = [];
    registerDesktopIpc({
      handle: (channel, handler) => handlers.set(channel, handler),
      store: { getState: () => state, getSecret: () => "fixture-refresh", importState: () => calls.push("import") },
      core: { restartServers: async () => calls.push("restart"), snapshot: () => ({ state }), notifyRenderer: () => calls.push("notify") },
      getWindow: () => ({}), dialog: { showOpenDialog: async () => {
        calls.push("dialog");
        if (phase === "changed") state.settings.account.uid = "other-account";
        return { canceled: false, filePaths: [filename] };
      } }
    });
    const importing = handlers.get("data:import")();
    if (phase === "guest") {
      await assert.rejects(importing, { code: "ACCOUNT_REQUIRED" });
      assert.deepEqual(calls, []);
    } else if (phase === "changed") {
      await assert.rejects(importing, { code: "MEDIA_ACCOUNT_CHANGED" });
      assert.deepEqual(calls, ["dialog"]);
    } else {
      assert.equal((await importing).canceled, false);
      assert.deepEqual(calls, ["dialog", "import", "restart", "notify"]);
    }
  }
});
