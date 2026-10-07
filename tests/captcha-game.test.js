"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { GAME_INSTALLERS } = require("../src/main/game-installer-manifest");
const { sanitizeGameConfiguration } = require("../src/main/ipc");
const {
  GAME_INTERACTION_ACTION_TYPES,
  isGameInteractionActionType
} = require("../src/shared/game-interaction-action-types");
const { readRendererSource } = require("./helpers/source-bundles");

const root = path.join(__dirname, "..");

test("publie CAPTCHA à 3,99 € avec abonnement et installation temporaire", () => {
  const catalog = loadShenazenGameCatalog(path.join(root, "resources"));
  const game = catalog.find((entry) => entry.id === "captcha");
  const installer = GAME_INSTALLERS.captcha;

  assert.ok(game);
  assert.equal(game.name, "CAPTCHA");
  assert.equal(game.price, 3.99);
  assert.equal(game.accessMode, "purchase");
  assert.equal(game.requiresPro, true);
  assert.equal(game.installerVersion, "1.0.0");
  assert.equal(game.effects[0].actionType, "audio.play");
  assert.deepEqual(game.guide.journey, [
    "installation",
    "interactions",
    "overlays",
    "launch"
  ]);

  assert.equal(installer.temporaryTarget, true);
  assert.equal(installer.managedTarget, true);
  assert.deepEqual(installer.launchExecutables, ["VHS_Project.exe"]);
  assert.equal(installer.assets[0].action, "extract");
  assert.equal(installer.assets[0].sourcePath, "CAPTCHA.exe/Windows");
  assert.equal(installer.assets[0].size, 666900864);
  assert.equal(
    installer.assets[0].sha256,
    "b03eb2d8e695d14a90d3f8875ffd228d7edded6e74814f9e6eebe81d053870b8"
  );
  assert.match(
    installer.assets[0].url,
    /^https:\/\/f003\.backblazeb2\.com\/file\/shenpulse-media\/installer-assets\/captcha\/1\.0\.0\/CAPTCHA\.exe\.rar$/
  );
});

test("branche les cadeaux CAPTCHA sur la bibliothèque sonore et une sortie globale", () => {
  const renderer = readRendererSource();
  assert.match(renderer, /renderCaptchaAudioRouting/);
  assert.match(renderer, /refreshCaptchaAudioOutputs/);
  assert.match(renderer, /device\.kind === "audiooutput"/);
  assert.match(renderer, /audio\.setSinkId\(payload\.outputDeviceId\)/);
  assert.match(renderer, /soundPickerField\("gameSoundUrl"/);
  assert.match(renderer, /pack\.id === "captcha"/);
  assert.match(renderer, /Aucun overlay pour le moment/);
  assert.deepEqual(GAME_INTERACTION_ACTION_TYPES, [
    "game.effect",
    "overlay.win-counter",
    "audio.play"
  ]);
  assert.equal(isGameInteractionActionType("audio.play"), true);

  assert.deepEqual(
    sanitizeGameConfiguration("captcha", {
      audioOutputDeviceId: "virtual-cable-output",
      ignored: "kept-for-forward-compatibility"
    }),
    {
      audioOutputDeviceId: "virtual-cable-output",
      ignored: "kept-for-forward-compatibility"
    }
  );
});

test("conserve un manifeste Backblaze vérifiable pour l'archive CAPTCHA", () => {
  const manifestPath = path.join(
    root,
    "resources",
    "installer-assets",
    "captcha",
    "1.0.0",
    "manifest.json"
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.gameId, "captcha");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.assets[0].sourceName, "CAPTCHA.exe.rar");
  assert.equal(manifest.assets[0].remoteName, "CAPTCHA.exe.rar");
  assert.equal(manifest.assets[0].size, 666900864);
});
