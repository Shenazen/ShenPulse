"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { StateStore } = require("../src/main/store");
const { accountWorkspaceKey } = require("../src/main/state/account-workspace");
const { normalizeSongRequestSettings } = require("../src/main/spotify/song-request-settings");
const { normalizeProfileWorkspace } = require("../src/main/state/profile-workspace");

function fixture(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-account-persistence-"));
  const stores = [];
  const open = () => {
    const store = new StateStore(directory, { isEncryptionAvailable: () => false });
    store.load();
    stores.push(store);
    return store;
  };
  context.after(() => {
    for (const store of stores) store.flush();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { open, directory };
}

function identify(store, uid) {
  store.activateAccount(uid);
  const refreshTokenSecretId = store.setSecret("", `fixture-refresh-${uid}`);
  store.set("settings.account", { uid, email: `${uid}@example.com`, refreshTokenSecretId, emailVerified: true });
}

function configure(store, suffix) {
  store.upsert("profiles", { id: `profile-${suffix}`, name: `Profil ${suffix}` });
  store.selectProfile(`profile-${suffix}`);
  store.upsert("rules", { id: `rule-${suffix}`, name: `Action ${suffix}`, enabled: true,
    trigger: { type: "follow" }, actions: [{ id: `action-${suffix}`, type: "tts.speak", config: { text: suffix } }] });
  store.set("settings.tts.voice", `Voix ${suffix}`);
  store.mutate((state) => { state.customSounds = [{ id: `sound-${suffix}`, url: `https://example.com/${suffix}.mp3` }]; });
  store.flush();
}

test("déconnexion, reconnexion et redémarrage retrouvent exactement les profils de chaque UID", (context) => {
  const { open } = fixture(context);
  const store = open();
  identify(store, "alpha"); configure(store, "alpha");
  store.deactivateAccount();
  store.set("settings.account", {});
  store.flush();
  const restarted = open();
  assert.deepEqual(restarted.getState().rules, []);
  identify(restarted, "beta"); configure(restarted, "beta");
  identify(restarted, "alpha");
  assert.equal(restarted.state.session.profileId, "profile-alpha");
  assert.equal(restarted.state.rules[0].id, "rule-alpha");
  assert.equal(restarted.state.settings.tts.voice, "Voix alpha");
  assert.equal(restarted.state.customSounds[0].id, "sound-alpha");
  assert.equal(restarted.state.profiles.some((profile) => profile.id === "profile-beta"), false);
  restarted.flush();
  const reopened = open();
  assert.equal(reopened.getActiveAccountUid(), "alpha");
  assert.equal(reopened.state.session.profileId, "profile-alpha");
  identify(reopened, "beta");
  assert.equal(reopened.state.session.profileId, "profile-beta");
  assert.equal(reopened.state.rules[0].id, "rule-beta");
});

test("un cache de workspace absent ne fait pas perdre les profils encore présents dans l'état actif", (context) => {
  const { open } = fixture(context);
  const store = open();
  identify(store, "alpha"); configure(store, "alpha");
  const saved = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
  delete saved.accountWorkspaces[accountWorkspaceKey("alpha")];
  fs.writeFileSync(store.filePath, JSON.stringify(saved));
  const recovered = open();
  assert.equal(recovered.getActiveAccountUid(), "alpha");
  assert.equal(recovered.state.session.profileId, "profile-alpha");
  assert.equal(recovered.state.rules[0].id, "rule-alpha");
  assert.equal(recovered.state.settings.tts.voice, "Voix alpha");
  const backupPath = path.join(recovered.directory, "shenpulse-state.before-account-workspace-recovery-v1.json");
  const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  assert.equal(backup.session.profileId, "profile-alpha");
  assert.equal(backup.accountWorkspaces[accountWorkspaceKey("alpha")], undefined);
  assert.equal(backup.rules[0].id, "rule-alpha");
});

test("même sans session déchiffrable, un état identifié n'est pas perdu avant la reconnexion", (context) => {
  const { open } = fixture(context);
  const store = open();
  identify(store, "alpha"); configure(store, "alpha");
  const saved = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
  delete saved.accountWorkspaces[accountWorkspaceKey("alpha")];
  saved.settings.account.refreshTokenSecretId = "unavailable-after-update";
  fs.writeFileSync(store.filePath, JSON.stringify(saved));
  const recovered = open();
  assert.equal(recovered.getActiveAccountUid(), "", "aucune exposition du compte sans session valide");
  assert.deepEqual(recovered.state.rules, []);
  identify(recovered, "beta");
  assert.deepEqual(recovered.state.rules, [], "un autre compte ne récupère pas les profils alpha");
  identify(recovered, "alpha");
  assert.equal(recovered.state.session.profileId, "profile-alpha");
  assert.equal(recovered.state.rules[0].id, "rule-alpha");
});

test("un échec disque lors du changement de compte ne modifie ni le compte actif ni ses profils", (context) => {
  const { open } = fixture(context);
  const store = open();
  identify(store, "alpha"); configure(store, "alpha");
  const before = structuredClone(store.state), atomicWrite = store.storage.atomicWrite.bind(store.storage);
  store.storage.atomicWrite = () => { throw new Error("fixture-disque-indisponible"); };
  try {
    assert.throws(() => store.activateAccount("beta"), /fixture-disque-indisponible/);
    assert.deepEqual(store.state, before);
  } finally { store.storage.atomicWrite = atomicWrite; }
});

test("un échec disque à la déconnexion ne remplace pas les profils en mémoire par un espace vierge", (context) => {
  const { open } = fixture(context);
  const store = open();
  identify(store, "alpha"); configure(store, "alpha");
  const before = structuredClone(store.state), atomicWrite = store.storage.atomicWrite.bind(store.storage);
  store.storage.atomicWrite = () => { throw new Error("fixture-disque-indisponible"); };
  try {
    assert.throws(() => store.deactivateAccount(), /fixture-disque-indisponible/);
    assert.deepEqual(store.state, before);
  } finally { store.storage.atomicWrite = atomicWrite; }
});

test("l'ajout, le renommage et la suppression d'un profil sont confirmés sur disque avant le retour", (context) => {
  const { open } = fixture(context);
  const store = open();
  identify(store, "alpha");
  const persistedProfiles = () => JSON.parse(fs.readFileSync(store.filePath, "utf8"))
    .accountWorkspaces[accountWorkspaceKey("alpha")].profiles;
  store.upsert("profiles", { id: "immediate-profile", name: "Nouveau profil" });
  assert.equal(persistedProfiles().find((profile) => profile.id === "immediate-profile").name, "Nouveau profil");
  store.upsert("profiles", { id: "immediate-profile", name: "Profil renommé" });
  assert.equal(persistedProfiles().find((profile) => profile.id === "immediate-profile").name, "Profil renommé");
  store.remove("profiles", "immediate-profile");
  assert.equal(persistedProfiles().some((profile) => profile.id === "immediate-profile"), false);
});

test("l'identité et les profils changent dans la même génération disque, jamais sous le compte précédent", (context) => {
  const { open } = fixture(context), store = open();
  identify(store, "alpha"); configure(store, "alpha");
  const refreshTokenSecretId = store.setSecret("", "fixture-beta-refresh");
  store.activateAccount("beta", { uid: "beta", email: "beta@example.com", refreshTokenSecretId });
  let saved = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
  assert.equal(saved.activeAccountUid, "beta");
  assert.equal(saved.settings.account.uid, "beta");
  assert.equal(saved.profiles.some((profile) => profile.id === "profile-alpha"), false);
  const before = structuredClone(store.state);
  assert.throws(() => store.activateAccount("alpha", { uid: "beta" }), /identité de connexion/);
  assert.deepEqual(store.state, before);
  store.deactivateAccount();
  saved = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
  assert.equal(saved.activeAccountUid, "");
  assert.equal(saved.settings.account.uid, "");
  assert.equal(saved.settings.account.refreshTokenSecretId, "");
});

test("chaque profil retrouve sa voix complète et ses règles musicales sans déplacer le compte Spotify", (context) => {
  const { open } = fixture(context), store = open();
  identify(store, "alpha");
  const firstId = store.state.session.profileId;
  const voiceA = { enabled: true, language: "fr-FR", voice: "Voix Alpha", rate: 1.3, pitch: 0.7, volume: 0.4, profanityFilter: false };
  const voiceB = { enabled: false, language: "en-US", voice: "Voice Beta", rate: 0.8, pitch: 1.2, volume: 0.7, profanityFilter: true };
  const songsA = normalizeSongRequestSettings({ enabled: true, maxQueue: 8, maxPerViewer: 2, blockedArtists: ["Artiste Alpha"], commands: { request: "!alpha" } });
  const songsB = normalizeSongRequestSettings({ enabled: false, maxQueue: 17, allowExplicit: true, cooldownSeconds: 25, commands: { request: "!beta" } });
  store.mutate((state) => {
    state.settings.tts = voiceA;
    state.settings.spotify = { ...state.settings.spotify, songRequests: songsA,
      accessTokenSecretId: "fixture-spotify-access", refreshTokenSecretId: "fixture-spotify-refresh",
      requestQueue: [{ id: "shared-request" }], requestHistory: [{ id: "shared-history" }] };
    state.settings.irl.devices = [{ id: "shared-irl-device" }];
  });
  store.upsert("profiles", { id: "profile-beta", name: "Profil Beta" });
  store.selectProfile("profile-beta");
  store.set("settings.tts", voiceB);
  store.set("settings.spotify.songRequests", songsB);
  store.selectProfile(firstId);
  assert.deepEqual(store.state.settings.tts, voiceA);
  assert.deepEqual(store.state.settings.spotify.songRequests, songsA);
  assert.equal(store.state.settings.spotify.accessTokenSecretId, "fixture-spotify-access");
  assert.equal(store.state.settings.spotify.refreshTokenSecretId, "fixture-spotify-refresh");
  assert.deepEqual(store.state.settings.spotify.requestQueue, [{ id: "shared-request" }]);
  assert.deepEqual(store.state.settings.spotify.requestHistory, [{ id: "shared-history" }]);
  assert.deepEqual(store.state.settings.irl.devices, [{ id: "shared-irl-device" }]);
  for (const profile of store.state.profiles) {
    assert.doesNotMatch(JSON.stringify(profile.workspace), /fixture-spotify-|shared-request|shared-history|shared-irl-device/);
    assert.equal(profile.workspace.settings, undefined);
    assert.equal(profile.workspace.commerce, undefined);
  }
  store.flush();
  const reopened = open();
  assert.deepEqual(reopened.state.settings.tts, voiceA);
  assert.deepEqual(reopened.state.settings.spotify.songRequests, songsA);
  reopened.selectProfile("profile-beta");
  assert.deepEqual(reopened.state.settings.tts, voiceB);
  assert.deepEqual(reopened.state.settings.spotify.songRequests, songsB);
  reopened.deactivateAccount();
  identify(reopened, "alpha");
  assert.deepEqual(reopened.state.settings.tts, voiceB);
  assert.deepEqual(reopened.state.settings.spotify.songRequests, songsB);
});

test("les anciens profils héritent des préférences de leur propre compte, sans écraser leurs valeurs spécifiques", (context) => {
  const { open } = fixture(context), store = open();
  for (const uid of ["alpha", "beta"]) {
    identify(store, uid);
    configure(store, uid);
    store.set("settings.tts.voice", `Voix héritée ${uid}`);
    store.set("settings.spotify.songRequests", normalizeSongRequestSettings({ enabled: true, maxQueue: uid === "alpha" ? 7 : 13 }));
    store.flush();
  }
  identify(store, "alpha"); store.flush();
  const saved = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
  const makeLegacy = (profiles) => { for (const profile of profiles) {
    delete profile.workspace.tts; delete profile.workspace.songRequestSettings; profile.workspace.schemaVersion = 1;
  } };
  makeLegacy(saved.profiles);
  for (const workspace of Object.values(saved.accountWorkspaces)) makeLegacy(workspace.profiles);
  fs.writeFileSync(store.filePath, JSON.stringify(saved));
  const recovered = open();
  for (const profile of recovered.state.profiles) {
    assert.equal(profile.workspace.tts.voice, "Voix héritée alpha");
    assert.equal(profile.workspace.songRequestSettings.maxQueue, 7);
  }
  identify(recovered, "beta");
  for (const profile of recovered.state.profiles) {
    assert.equal(profile.workspace.tts.voice, "Voix héritée beta");
    assert.equal(profile.workspace.songRequestSettings.maxQueue, 13);
  }
  const normalized = normalizeProfileWorkspace({ tts: { voice: "Voix propre" }, songRequestSettings: { maxQueue: 4 } }, {
    ttsFallback: { voice: "Voix héritée", volume: 0.3 }, songRequestSettingsFallback: { enabled: true, maxQueue: 19 }
  });
  assert.equal(normalized.tts.voice, "Voix propre");
  assert.equal(normalized.tts.volume, 0.3);
  assert.equal(normalized.songRequestSettings.maxQueue, 4);
  assert.equal(normalized.songRequestSettings.enabled, true);
});
