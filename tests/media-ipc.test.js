"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { registerMediaIpc } = require("../src/main/ipc/media");

function fixture({ changeAt = "", canceled = false } = {}) {
  const state = { settings: { account: { uid: "member-a" } }, customSounds: [], customMedia: [] };
  const handlers = new Map(), uploads = [], notifications = [];
  let dialogs = 0, mutations = 0;
  const store = {
    getState: () => state,
    mutate: (mutator) => { mutations += 1; mutator(state); }
  };
  const result = { id: "custom:test", name: "Mon média", url: "https://f003.backblazeb2.com/file/shenpulse-media/mediauploads/member-a/test.mp3" };
  registerMediaIpc({
    handle: (channel, handler) => handlers.set(channel, handler), store,
    core: { snapshot: () => ({ state }), notifyRenderer: (channel) => notifications.push(channel) },
    backblazeMedia: {
      uploadSound: async (...args) => { uploads.push(args); if (changeAt === "upload") state.settings.account.uid = "member-b"; return result; },
      uploadMedia: async (...args) => { uploads.push(args); if (changeAt === "upload") state.settings.account.uid = "member-b"; return result; }
    },
    getWindow: () => ({}),
    dialog: { showOpenDialog: async () => {
      dialogs += 1;
      if (changeAt === "dialog") state.settings.account.uid = "member-b";
      return { canceled, filePaths: canceled ? [] : ["C:/fixture/media.mp3"] };
    } }
  });
  return { state, store, handlers, uploads, notifications, result, counts: () => ({ dialogs, mutations }) };
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
