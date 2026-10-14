"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { StateStore } = require("../src/main/store");
const { createGuestSnapshot, shouldSuppressRendererChannel } = require("../src/main/account-access");

test("directory sharing is opt-out by default and isolated between account workspaces", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-directory-integration-"));
  const store = new StateStore(directory, { isEncryptionAvailable: () => false });
  try {
    store.load();
    assert.deepEqual(store.getState().settings.liveDirectory, { publishEnabled: false });
    store.activateAccount("directory_alpha");
    store.set("settings.liveDirectory", { publishEnabled: true });
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
    assert.equal(store.getState().settings.liveDirectory.publishEnabled, false);
    store.importState({ rules: [], settings: { liveDirectory: { publishEnabled: true } } });
    assert.equal(store.getState().settings.liveDirectory.publishEnabled, false);
    store.activateAccount("directory_alpha");
    assert.equal(store.getState().settings.liveDirectory.publishEnabled, true);
    store.deactivateAccount();
    assert.equal(store.getState().settings.liveDirectory.publishEnabled, false);
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
