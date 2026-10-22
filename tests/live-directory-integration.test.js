"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { StateStore } = require("../src/main/store");
const { createGuestSnapshot, shouldSuppressRendererChannel } = require("../src/main/account-access");
const { accountWorkspaceKey } = require("../src/main/state/account-workspace");
const { LIVE_DIRECTORY_DEFAULTS_VERSION } = require("../src/shared/live-directory-protocol");
const preference = publishEnabled => ({ publishEnabled, defaultsVersion: LIVE_DIRECTORY_DEFAULTS_VERSION });

test("directory sharing is opt-out by default and isolated between account workspaces", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-directory-integration-"));
  const store = new StateStore(directory, { isEncryptionAvailable: () => false });
  try {
    store.load();
    assert.deepEqual(store.getState().settings.liveDirectory, preference(true));
    store.activateAccount("directory_alpha");
    store.set("settings.liveDirectory", preference(false));
    store.mutate((state) => {
      state.settings.kick.clientSecretId = "must-stay-private";
      state.connections = [{ id: "source_tiktok", type: "tiktok-direct", enabled: true,
        status: "connected", config: { username: "creator", privateToken: "never-copy" }, secretId: "private" }];
    });
    const projected = store.getLiveDirectoryState();
    assert.equal(JSON.stringify(projected).includes("must-stay-private"), false);
    assert.equal(JSON.stringify(projected).includes("never-copy"), false);
    assert.equal(projected.accountWorkspaces, undefined);
    store.activateAccount("directory_beta");
    assert.equal(store.getState().settings.liveDirectory.publishEnabled, true);
    store.importState({ rules: [], settings: { liveDirectory: preference(false) } });
    assert.equal(store.getState().settings.liveDirectory.publishEnabled, true);
    store.activateAccount("directory_alpha");
    assert.equal(store.getState().settings.liveDirectory.publishEnabled, false);
    store.importState({ rules: [], settings: { liveDirectory: preference(true) } });
    assert.deepEqual(store.getState().settings.liveDirectory, preference(false));
    store.deactivateAccount();
    assert.equal(store.getActiveAccountUid(), "");
    assert.equal(createGuestSnapshot({ state: store.getState() }).state.settings.liveDirectory.publishEnabled, false);
  } finally {
    store.flush();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("la mise à jour active les anciens défauts une fois et conserve une désactivation après redémarrage", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-directory-migration-"));
  const createStore = () => new StateStore(directory, { isEncryptionAvailable: () => false });
  let store = createStore();
  try {
    store.load();
    store.activateAccount("legacy_creator");
    store.activateAccount("private_creator");
    store.set("settings.liveDirectory", preference(false));
    store.deactivateAccount();
    store.flush();
    const file = path.join(directory, "shenpulse-state.json");
    const persisted = JSON.parse(fs.readFileSync(file, "utf8"));
    persisted.settings.liveDirectory = { publishEnabled: false };
    persisted.accountWorkspaces[accountWorkspaceKey("legacy_creator")].settings.liveDirectory = { publishEnabled: false };
    fs.writeFileSync(file, JSON.stringify(persisted));
    store = createStore();
    store.load();
    store.activateAccount("legacy_creator");
    assert.deepEqual(store.getState().settings.liveDirectory, preference(true));
    store.set("settings.liveDirectory", preference(false));
    store.activateAccount("private_creator");
    assert.deepEqual(store.getState().settings.liveDirectory, preference(false));
    store.deactivateAccount();
    store.flush();
    store = createStore();
    store.load();
    store.activateAccount("legacy_creator");
    assert.deepEqual(store.getState().settings.liveDirectory, preference(false));
    store.activateAccount("new_creator");
    assert.deepEqual(store.getState().settings.liveDirectory, preference(true));
  } finally {
    store.flush();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("guest snapshots preserve public directory cards but no publishing preference or ownership", () => {
  const row = { id: "public_1", platform: "TikTok", username: "public_creator", avatarUrl: "https://example.com/photo.png", viewers: 0, own: true };
  const guest = createGuestSnapshot({
    state: { settings: { liveDirectory: { publishEnabled: true }, tiktok: { username: "private_creator" } } },
    liveDirectory: { connected: true, enabled: true, publishing: true, rows: [row], capped: false }
  });
  assert.equal(guest.state.settings.liveDirectory.publishEnabled, false);
  assert.equal(guest.liveDirectory.enabled, false);
  assert.equal(guest.liveDirectory.publishing, false);
  assert.equal(guest.liveDirectory.rows[0].own, false);
  assert.equal(guest.liveDirectory.rows[0].avatarUrl, row.avatarUrl);
  assert.equal(guest.liveDirectory.rows[0].viewers, 0);
  assert.equal(shouldSuppressRendererChannel("live-directory-status", { getState: () => ({ settings: {} }) }), false);
});
