"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createDefaultOverlayConfigs } = require("../src/main/defaults");
const { createDefaultState } = require("../src/main/defaults");
const { StateStore } = require("../src/main/store");

function createStore(directory) {
  return new StateStore(directory, {
    isEncryptionAvailable: () => false
  });
}

function identify(store, uid, email) {
  store.activateAccount(uid);
  const refreshTokenSecretId = store.setSecret(
    "",
    `refresh-token-${uid}`
  );
  store.set("settings.account", {
    email,
    uid,
    displayName: email.split("@")[0],
    photoUrl: "",
    providerId: "password",
    emailVerified: true,
    refreshTokenSecretId,
    lastAuthenticatedAt: "2026-07-29T12:00:00.000Z"
  });
}

test("chaque UID possède seul ses actions, médias, intégrations, overlays et jeux", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-account-workspace-")
  );
  try {
    const store = createStore(directory);
    store.load();
    identify(store, "uid_alpha", "alpha@example.com");

    store.upsert("rules", {
      id: "rule_alpha",
      name: "Action Alpha",
      enabled: true,
      trigger: { type: "gift" },
      actions: [{
        id: "action_alpha",
        type: "tts.speak",
        config: { text: "Alpha" }
      }]
    });
    store.mutate((state) => {
      state.customSounds = [{ id: "sound_alpha", name: "Son Alpha" }];
      state.customMedia = [{ id: "media_alpha", name: "Média Alpha" }];
      state.settings.tts.voice = "Voix Alpha";
      state.settings.spotify = {
        ...state.settings.spotify,
        clientId: "spotify_alpha",
        refreshTokenSecretId: "spotify_secret_alpha"
      };
      state.settings.overlayConfigs.likeGoal.theme = "minecraft";
      state.game.connectorOverrides["gtav-montchiliad"] = {
        port: 32001
      };
      state.game.roundSettingsByPack["minecraft-bedrock-box"] = {
        durationMinutes: 12,
        autoRestart: true
      };
      state.game.installations["minecraft-bedrock-box"] = {
        status: "installed",
        path: "C:\\Games\\Alpha"
      };
      state.commerce.subscription = {
        tier: "premium",
        source: "own",
        status: "active"
      };
    }, true);

    identify(store, "uid_beta", "beta@example.com");
    let state = store.getState();
    assert.deepEqual(state.rules, []);
    assert.deepEqual(state.customSounds, []);
    assert.deepEqual(state.customMedia, []);
    assert.equal(state.settings.tts.voice, "");
    assert.equal(state.settings.spotify.clientId, "");
    assert.equal(
      state.settings.overlayConfigs.likeGoal.theme,
      createDefaultOverlayConfigs().likeGoal.theme
    );
    assert.deepEqual(state.game.connectorOverrides, {});
    assert.deepEqual(state.game.roundSettingsByPack, {});
    assert.deepEqual(state.game.installations, {});
    assert.equal(state.commerce.subscription.tier, "free");

    store.upsert("rules", {
      id: "rule_beta",
      name: "Action Beta",
      enabled: true,
      trigger: { type: "follow" },
      actions: []
    });
    store.mutate((next) => {
      next.customSounds = [{ id: "sound_beta", name: "Son Beta" }];
      next.settings.tts.voice = "Voix Beta";
      next.settings.spotify.clientId = "spotify_beta";
      next.settings.overlayConfigs.likeGoal.theme = "terraria";
      next.game.installations["terraria"] = {
        status: "installed",
        path: "C:\\Games\\Beta"
      };
    }, true);

    identify(store, "uid_alpha", "alpha@example.com");
    state = store.getState();
    assert.deepEqual(state.rules.map((entry) => entry.id), ["rule_alpha"]);
    assert.deepEqual(
      state.customSounds.map((entry) => entry.id),
      ["sound_alpha"]
    );
    assert.deepEqual(
      state.customMedia.map((entry) => entry.id),
      ["media_alpha"]
    );
    assert.equal(state.settings.tts.voice, "Voix Alpha");
    assert.equal(state.settings.spotify.clientId, "spotify_alpha");
    assert.equal(state.settings.overlayConfigs.likeGoal.theme, "minecraft");
    assert.equal(
      state.game.installations["minecraft-bedrock-box"].status,
      "installed"
    );
    assert.equal(state.game.installations.terraria, undefined);
    assert.equal(state.commerce.subscription.tier, "premium");

    store.deactivateAccount();
    state = store.getState();
    assert.deepEqual(state.rules, []);
    assert.deepEqual(state.customSounds, []);
    assert.deepEqual(state.game.installations, {});
    assert.equal(JSON.stringify(state).includes("accountWorkspaces"), false);

    identify(store, "uid_beta", "beta@example.com");
    state = store.getState();
    assert.deepEqual(state.rules.map((entry) => entry.id), ["rule_beta"]);
    assert.deepEqual(
      state.customSounds.map((entry) => entry.id),
      ["sound_beta"]
    );
    assert.equal(state.settings.tts.voice, "Voix Beta");
    assert.equal(state.settings.spotify.clientId, "spotify_beta");
    assert.equal(state.settings.overlayConfigs.likeGoal.theme, "terraria");
    assert.equal(state.game.installations.terraria.status, "installed");
    assert.equal(state.game.installations["minecraft-bedrock-box"], undefined);

    store.flush();

    const reopened = createStore(directory);
    state = reopened.load();
    assert.equal(reopened.getActiveAccountUid(), "uid_beta");
    assert.deepEqual(state.rules.map((entry) => entry.id), ["rule_beta"]);
    assert.equal(state.settings.spotify.clientId, "spotify_beta");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("une configuration héritée sans compte est réclamée une seule fois", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-account-legacy-")
  );
  try {
    const legacyState = createDefaultState();
    legacyState.rules = [{
      id: "legacy_rule",
      name: "Ancienne action",
      actions: []
    }];
    legacyState.profiles[0].workspace.rules = structuredClone(
      legacyState.rules
    );
    fs.writeFileSync(
      path.join(directory, "shenpulse-state.json"),
      JSON.stringify(legacyState, null, 2),
      "utf8"
    );

    const migrated = createStore(directory);
    migrated.load();
    identify(migrated, "first_uid", "first@example.com");
    assert.deepEqual(
      migrated.getState().rules.map((entry) => entry.id),
      ["legacy_rule"]
    );

    identify(migrated, "second_uid", "second@example.com");
    assert.deepEqual(migrated.getState().rules, []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
