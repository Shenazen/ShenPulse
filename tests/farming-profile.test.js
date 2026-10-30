"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os");
const { farmingProfile, XBOX_IDENTITY } = require("../src/main/game-runtime/farming-profile");

test("Farming expose l’identité Xbox et le lanceur nécessaires à la détection et au lancement automatiques", () => {
  const { installerForGame } = require("../src/main/game-installer-manifest");
  const manifest=installerForGame("farming-simulator-25");
  assert.equal(manifest.xboxIdentity,XBOX_IDENTITY);
  assert.ok(manifest.xboxDirectoryNames.includes("Farming Simulator 25 (PC)"));
  assert.ok(manifest.launchExecutables.includes("gamelaunchhelper.exe"));
  assert.ok(manifest.executables.includes("x64/FarmingSimulator2025Game.exe"));
});

test("Farming utilise le profil de l’édition installée, sans confondre Xbox et Steam", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-farming-profile-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const xbox = path.join(root, "xbox"), steam = path.join(root, "steam"), documentsPath = path.join(root, "Documents"), localAppDataPath = path.join(root, "Local");
  await fs.mkdir(xbox); await fs.mkdir(steam);
  await fs.writeFile(path.join(xbox, "MicrosoftGame.config"), '<Game><Identity Name="' + XBOX_IDENTITY + '"/></Game>');
  await assert.rejects(farmingProfile(xbox, { documentsPath, localAppDataPath }), /première fois/);
  const profile = path.join(localAppDataPath, "Packages", XBOX_IDENTITY + "_test", "LocalCache", "Local");
  await fs.mkdir(profile, { recursive: true });
  assert.equal((await farmingProfile(xbox, { documentsPath, localAppDataPath })).modsDirectory, path.join(profile, "mods"));
  assert.equal((await farmingProfile(steam, { documentsPath, localAppDataPath })).directory, path.join(documentsPath, "My Games", "FarmingSimulator2025"));
  const custom = path.join(root, "custom-mods");
  await fs.writeFile(path.join(profile, "gameSettings.xml"), '<gameSettings><modsDirectoryOverride active="true" directory="' + custom + '"/></gameSettings>');
  assert.equal((await farmingProfile(xbox, { documentsPath, localAppDataPath })).modsDirectory, custom);
});
