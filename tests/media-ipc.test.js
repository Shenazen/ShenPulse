"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { registerMediaIpc } = require("../src/main/ipc/media");
const { SOUND_CATALOG } = require("../src/main/catalogs");
const { StateStore } = require("../src/main/store");

function fixture({ changeAt = "", canceled = false, file = "C:/fixture/media.mp3" } = {}) {
  const state = { settings: { account: { uid: "member-a" } }, customSounds: [], customMedia: [] };
  const handlers = new Map(), uploads = [], notifications = [], mutationOptions = [], snapshots = [];
  let dialogs = 0, mutations = 0, dialogOptions;
  const store = {
    getState: () => state,
    mutate: (mutator, immediate) => { mutations += 1; mutationOptions.push(immediate); mutator(state); }
  };
  const result = { id: "custom:test", name: "Mon média", url: "https://f003.backblazeb2.com/file/shenpulse-media/mediauploads/member-a/test.mp3" };
  registerMediaIpc({
    handle: (channel, handler) => handlers.set(channel, handler), store,
    core: { snapshot: () => { const value = { state }; snapshots.push(value); return value; }, notifyRenderer: (channel) => notifications.push(channel) },
    backblazeMedia: {
      uploadSound: async (...args) => { uploads.push(args); if (changeAt === "upload") state.settings.account.uid = "member-b"; return result; },
      uploadMedia: async (...args) => { uploads.push(args); if (changeAt === "upload") state.settings.account.uid = "member-b"; return result; }
    },
    getWindow: () => ({}),
    dialog: { showOpenDialog: async (_window, options) => {
      dialogOptions = options;
      dialogs += 1;
      if (changeAt === "dialog") state.settings.account.uid = "member-b";
      return { canceled, filePaths: canceled ? [] : [file] };
    } }
  });
  return { state, store, handlers, uploads, notifications, result, mutationOptions, snapshots, dialogOptions: () => dialogOptions, counts: () => ({ dialogs, mutations }) };
}

test("les deux imports IPC utilisent le stockage géré et conservent le propriétaire de la demande", async () => {
  for (const [channel, requestedKind, listKey] of [
    ["sound:upload", undefined, "customSounds"],
    ["media:upload", "sound", "customSounds"],
    ["media:upload", "visual", "customMedia"]
  ]) {
    const item = fixture();
    const response = await item.handlers.get(channel)({}, requestedKind);
    assert.equal(response.canceled, false);
    assert.equal(item.state[listKey][0], item.result);
    assert.deepEqual(item.uploads[0].at(-1), { expectedUid: "member-a" });
    assert.deepEqual(item.notifications, ["state-changed"]);
    assert.deepEqual(item.counts(), { dialogs: 1, mutations: 1 });
  }
});

test("changer de compte pendant le choix de fichier empêche tout upload", async () => {
  for (const channel of ["sound:upload", "media:upload"]) {
    const item = fixture({ changeAt: "dialog" });
    await assert.rejects(item.handlers.get(channel)({}, "visual"), { code: "MEDIA_ACCOUNT_CHANGED" });
    assert.equal(item.uploads.length, 0);
    assert.equal(item.counts().mutations, 0);
    assert.equal(item.notifications.length, 0);
  }
});

test("changer de compte pendant le transfert n'ajoute jamais un média au nouveau compte", async () => {
  for (const channel of ["sound:upload", "media:upload"]) {
    const item = fixture({ changeAt: "upload" });
    await assert.rejects(item.handlers.get(channel)({}, "visual"), { code: "MEDIA_ACCOUNT_CHANGED" });
    assert.equal(item.uploads.length, 1);
    assert.equal(item.counts().mutations, 0);
    assert.deepEqual(item.state.customSounds, []);
    assert.deepEqual(item.state.customMedia, []);
    assert.equal(item.notifications.length, 0);
  }
});

test("l'annulation du dialogue n'effectue aucune opération de stockage", async () => {
  for (const channel of ["sound:upload", "media:upload"]) {
    const item = fixture({ canceled: true });
    assert.deepEqual(await item.handlers.get(channel)({}, "visual"), { canceled: true });
    assert.equal(item.uploads.length, 0);
    assert.equal(item.counts().mutations, 0);
    assert.equal(item.notifications.length, 0);
  }
});

test("un espace actif incohérent ne peut même pas ouvrir le dialogue d'import", async () => {
  const item = fixture();
  item.store.getActiveAccountUid = () => "member-b";
  for (const channel of ["sound:upload", "media:upload"]) {
    await assert.rejects(item.handlers.get(channel)({}, "visual"), { code: "MEDIA_ACCOUNT_CHANGED" });
  }
  assert.deepEqual(item.counts(), { dialogs: 0, mutations: 0 });
});

test("retirer un son ne modifie que le catalogue du compte, persiste immédiatement et notifie une fois", () => {
  const item = fixture();
  item.state.customSounds = [item.result, { id: "custom:other", name: "Autre son" }];
  item.state.rules = [{ id: "action", actions: [{ type: "sound.play", config: { soundId: item.result.id, url: item.result.url } }] }];
  item.state.profileWorkspaces = { one: { rules: structuredClone(item.state.rules) }, two: { rules: structuredClone(item.state.rules) } };
  item.state.customMedia = [{ id: "custom:video", kind: "video", url: "https://example.test/fixture.webm" }];
  const before = structuredClone(item.state);
  const response = item.handlers.get("sound:remove")({}, item.result.id, "member-a");
  assert.deepEqual(item.state, { ...before, customSounds: [before.customSounds[1]] });
  assert.deepEqual(item.mutationOptions, [true]);
  assert.deepEqual(item.notifications, ["state-changed"]);
  assert.equal(item.snapshots.length, 1);
  assert.equal(response.snapshot, item.snapshots[0]);
  assert.deepEqual(item.counts(), { dialogs: 0, mutations: 1 });
  assert.deepEqual(item.uploads, []);
});

test("retrait : UID obligatoire exact, compte changé, espace incohérent ou invité ne mutent jamais", () => {
  for (const expectedUid of [undefined, null, {}, 4, "", " ", "member-b", " member-a", "member-a "]) {
    const item = fixture(); item.state.customSounds = [item.result];
    const before = structuredClone(item.state);
    assert.throws(() => item.handlers.get("sound:remove")({}, item.result.id, expectedUid), { code: "MEDIA_ACCOUNT_CHANGED" });
    assert.deepEqual(item.state, before);
    assert.equal(item.counts().mutations, 0);
    assert.deepEqual(item.notifications, []);
  }
  for (const change of ["account", "workspace", "guest"]) {
    const item = fixture(); item.state.customSounds = [item.result];
    if (change === "account") item.state.settings.account.uid = "member-b";
    if (change === "workspace") item.store.getActiveAccountUid = () => "member-b";
    if (change === "guest") item.state.settings.account = {};
    assert.throws(() => item.handlers.get("sound:remove")({}, item.result.id, "member-a"), { code: "MEDIA_ACCOUNT_CHANGED" });
    assert.equal(item.counts().mutations, 0);
    assert.deepEqual(item.notifications, []);
  }
});

test("retrait : identifiants invalides, étrangers, intégrés et doublons sont refusés sans mutation", () => {
  const invalidIds = [undefined, null, {}, ["custom:test"], 1, "", "custom:", "custom:test ", " custom:test", "custom:../test", "custom:test\n", `custom:${"a".repeat(201)}`, "custom:foreign", SOUND_CATALOG[0].id];
  for (const soundId of invalidIds) {
    const item = fixture(); item.state.customSounds = [item.result, SOUND_CATALOG[0]];
    const before = structuredClone(item.state);
    assert.throws(() => item.handlers.get("sound:remove")({}, soundId, "member-a"), { code: "CUSTOM_SOUND_NOT_FOUND" });
    assert.deepEqual(item.state, before);
    assert.equal(item.counts().mutations, 0);
    assert.deepEqual(item.notifications, []);
  }
  const item = fixture(); item.state.customSounds = [item.result, { ...item.result }];
  assert.throws(() => item.handlers.get("sound:remove")({}, item.result.id, "member-a"), { code: "CUSTOM_SOUND_NOT_FOUND" });
  assert.equal(item.counts().mutations, 0);
  item.state.customSounds = [];
  assert.throws(() => item.handlers.get("sound:remove")({}, item.result.id, "member-a"), { code: "CUSTOM_SOUND_NOT_FOUND" });
});

test("les anciens imports sans préfixe ni source restent retirables, les sources intégrées restent protégées", () => {
  const item = fixture();
  item.state.customSounds = [{ id: "sound_global", name: "Ancien import" }];
  item.handlers.get("sound:remove")({}, "sound_global", "member-a");
  assert.deepEqual(item.state.customSounds, []);
  assert.equal(item.counts().mutations, 1);
  for (const sound of [
    { id: "sound_foreign_source", source: "builtin" },
    { id: " ", source: "custom" },
    { id: "son\nretour", source: "custom" },
    { id: "son\u007fcontrole", source: "custom" },
    { id: "x".repeat(161), source: "custom" }
  ]) {
    const rejected = fixture(); rejected.state.customSounds = [sound];
    assert.throws(() => rejected.handlers.get("sound:remove")({}, sound.id, "member-a"), { code: "CUSTOM_SOUND_NOT_FOUND" });
    assert.equal(rejected.counts().mutations, 0);
    assert.deepEqual(rejected.notifications, []);
  }
});

test("le retrait d'un son reste acquis après redémarrage et ne touche ni profils ni autre compte", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-sound-remove-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let store = new StateStore(directory, { isEncryptionAvailable: () => false });
  store.load();
  const session = (uid) => ({ uid, refreshTokenSecretId: store.setSecret("", `fixture-token-${uid}`) });
  const accountA = session("member-a"), accountB = session("member-b");
  store.activateAccount("member-a", accountA);
  const sound = { id: "custom:test", name: "Son synthétique", url: "https://example.test/fixture.mp3", source: "custom" };
  store.upsert("profiles", { id: "profile-one", name: "Profil un" });
  store.upsert("profiles", { id: "profile-two", name: "Profil deux" });
  for (const profile of ["profile-one", "profile-two"]) {
    store.selectProfile(profile);
    store.upsert("rules", { id: `rule-${profile}`, name: "Son configuré", enabled: true, trigger: { type: "follow" }, actions: [{ id: `action-${profile}`, type: "sound.play", config: { soundId: sound.id, url: sound.url } }] });
  }
  store.mutate((state) => { state.customSounds = [sound]; }, true);
  const references = structuredClone(store.state.profileWorkspaces);
  const rules = structuredClone(store.state.rules);
  store.activateAccount("member-b", accountB);
  store.mutate((state) => { state.customSounds = [{ ...sound, name: "Son du compte B" }]; }, true);
  store.activateAccount("member-a", accountA);
  const handlers = new Map(), notices = [];
  registerMediaIpc({ handle: (channel, handler) => handlers.set(channel, handler), store,
    core: { snapshot: () => ({ state: store.getState() }), notifyRenderer: (...args) => notices.push(args) } });
  handlers.get("sound:remove")({}, sound.id, "member-a");
  assert.deepEqual(store.state.customSounds, []);
  assert.deepEqual(store.state.rules, rules);
  assert.deepEqual(store.state.profileWorkspaces, references);
  assert.equal(notices.length, 1);
  store = new StateStore(directory, { isEncryptionAvailable: () => false });
  store.load();
  assert.equal(store.getActiveAccountUid(), "member-a");
  assert.deepEqual(store.state.customSounds, []);
  for (const profile of ["profile-one", "profile-two"]) {
    store.selectProfile(profile);
    assert.equal(store.state.rules[0].actions[0].config.url, sound.url);
    assert.equal(store.state.rules[0].actions[0].config.soundId, sound.id);
  }
  store.activateAccount("member-b", accountB);
  assert.deepEqual(store.state.customSounds, [{ ...sound, name: "Son du compte B" }]);
  store.activateAccount("member-a", accountA);
  assert.deepEqual(store.state.customSounds, []);
  store.flush();
});

test("preload : removeCustomSound conserve l'identifiant et l'UID attendu sans les transformer", () => {
  const calls = []; let api;
  const filename = path.resolve(__dirname, "../src/main/preload.js");
  new vm.Script(fs.readFileSync(filename, "utf8"), { filename }).runInNewContext({ require: () => ({
    contextBridge: { exposeInMainWorld: (_name, value) => { api = value; } },
    ipcRenderer: { invoke: (...args) => { calls.push(args); return "fixture-result"; } }
  }) });
  assert.equal(api.removeCustomSound("custom:test", "member-a"), "fixture-result");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "sound:remove");
  assert.equal(calls[0][1], "custom:test");
  assert.equal(calls[0][2], "member-a");
});

test("le logo et la bannière agence n’acceptent que des images et utilisent le stockage du compte", async () => {
  const item=fixture({file:"C:/fixture/banner.WEBP"});
  await item.handlers.get("media:upload")({}, "agency-image");
  assert.deepEqual(item.dialogOptions().filters[0].extensions,["png","jpg","jpeg","webp"]);
  assert.equal(item.uploads[0][1],"visual");
  assert.deepEqual(item.uploads[0][2],{expectedUid:"member-a"});
  const video=fixture({file:"C:/fixture/video.mp4"});
  await assert.rejects(video.handlers.get("media:upload")({},"agency-image"),/image PNG/);
  assert.equal(video.uploads.length,0);
  assert.equal(video.counts().mutations,0);
});
