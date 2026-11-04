"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { createHash } = require("node:crypto");
const { createRequire } = require("node:module");
const profileModule = require("../src/main/game-runtime/farming-profile");
const { PreparedFileGame, attributes } = require("../src/main/prepared-file-games");
const { installerForGame } = require("../src/main/game-installer-manifest");
const { detectInstalledGames } = require("../src/main/game-runtime/discovery");
const { launchExternalGame } = require("../src/main/game-runtime/external-launch");
const { execFileSync } = require("node:child_process");
const fsSync = require("node:fs");

const lua54 = process.env.SHENPULSE_LUA54 || ["emulator-zShMbJ", "emulator-m3FQOP", "emulator-mvD1kf", "emulator-mfl88y"]
  .map(folder => path.resolve(__dirname, "../.artifacts/cc-audit", folder, "BizHawk/Bizhawk-2.9.1/dll/lua54.dll"))
  .find(file => fsSync.existsSync(file));
test("le concessionnaire suit la carte et refuse une destination indisponible", {
  skip: process.platform !== "win32" || !lua54 ? "Lua 5.4 Windows requis (SHENPULSE_LUA54)" : false
}, () => {
  const root = path.resolve(__dirname, "..");
  const output = execFileSync("python", [path.join(__dirname, "fixtures/lua-runtime-runner.py"), lua54,
    path.join(__dirname, "fixtures/farming-dealer-harness.lua")], { cwd: root, windowsHide: true, encoding: "utf8" });
  assert.match(output, /Farming dealer behavior checks passed/);
});

const gameId = "farming-simulator-25";
const manifest = installerForGame(gameId);
const bytes = Buffer.from("Farming module fixture; never executed");
const spec = {
  module: ".shenpulse-farming-mods/FS25_ShenPulse.zip",
  moduleSha256: createHash("sha256").update(bytes).digest("hex"),
  installer: { fileGame: "fs25" }
};
async function write(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, value);
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-farming-steam-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const steam = path.join(root, "steamapps/common/Farming Simulator 25");
  const xbox = path.join(root, "XboxGames/Farming Simulator 25 (PC)/Content");
  const documentsPath = path.join(root, "Documents");
  const localAppDataPath = path.join(root, "LocalAppData");
  const xboxProfile = path.join(localAppDataPath, "Packages", profileModule.XBOX_IDENTITY + "_fixture", "LocalCache/Local");
  const steamProfile = path.join(documentsPath, "My Games/FarmingSimulator2025");
  const managedProfile = path.join(localAppDataPath, "ShenPulse/game-profiles/farming-simulator-25/steam");
  for (const directory of [steam, xbox]) {
    await write(path.join(directory, "x64/FarmingSimulator2025Game.exe"), "fixture, never executed");
    await write(path.join(directory, "FarmingSimulator2025.exe"), "fixture, never executed");
    await write(path.join(directory, spec.module), bytes);
  }
  await write(path.join(xbox, "MicrosoftGame.config"), '<Game><Identity Name="' + profileModule.XBOX_IDENTITY + '"/></Game>');
  await write(path.join(xbox, "gamelaunchhelper.exe"), "fixture, never executed");
  await write(path.join(xboxProfile, "savegame1/careerSavegame.xml"), "Xbox save, must not change");
  await write(path.join(xboxProfile, "mods/FS25_ShenPulse.zip"), "Previously validated Xbox module");
  await fs.mkdir(steamProfile, { recursive: true });
  const original = profileModule.farmingProfile;
  t.mock.method(profileModule, "farmingProfile", (target, options) => original(target, { ...options, localAppDataPath }));
  const state = { settings: { account: { uid: "fixture-owner" } }, session: { profileId: "one" }, game: { installations: { [gameId]: { path: steam, platform: "steam" } } } };
  return { root, steam, xbox, documentsPath, localAppDataPath, xboxProfile, steamProfile, managedProfile, state };
}

test("Farming détecte les deux éditions et conserve leurs lanceurs distincts", async t => {
  const f = await fixture(t);
  const found = await detectInstalledGames(gameId, manifest, f.steam, { steam: async () => [f.steam], xbox: async () => [f.xbox], registeredXbox: async () => [] });
  assert.deepEqual(found, [{ path: f.steam, platform: "steam" }, { path: f.xbox, platform: "xbox" }]);
  // Readiness is covered separately; no fixture binary is ever launched.
  const filename = path.resolve(__dirname, "../src/main/game-runtime/external-launch.js");
  const originalRequire = createRequire(filename), module = { exports: {} };
  vm.runInNewContext(await fs.readFile(filename, "utf8"), {
    module, process, Buffer, console,
    require: id => id === "./owner-integration-installation" ? { assertOwnerIntegrationReady: async () => {} }
      : id.endsWith("owner-prepared-modules.json") ? { [gameId]: spec } : originalRequire(id)
  }, { filename });
  for (const platform of ["steam", "xbox"]) {
    const calls = [];
    await module.exports.launchExternalGame({ gameId, manifest, installation: { path: f[platform], platform }, assertAccess() {},
      findRunning: async () => null, documentsPath: f.documentsPath, localAppDataPath: f.localAppDataPath,
      shell: { openExternal: async uri => calls.push(uri), openPath: async file => { calls.push(file); return ""; } }, waitForWindowsProcessWindow: async () => {} });
    assert.deepEqual(calls, platform === "steam" ? [require("../src/main/game-runtime/farming-managed-profile").farmingSteamLaunchUri(f.managedProfile)] : [path.join(f.xbox, "gamelaunchhelper.exe")]);
  }
  await assert.rejects(launchExternalGame({ gameId, manifest, installation: { path: f.steam, platform: "steam" }, assertAccess() {},
    findRunning: async () => ({ ProcessId: 42, ExecutablePath: path.join(f.xbox, "x64/FarmingSimulator2025Game.exe") }) }), /autre installation/);
});

test("installer le module Steam préserve le mod et la sauvegarde Xbox", async t => {
  const f = await fixture(t);
  const filename = path.resolve(__dirname, "../src/main/game-runtime/owner-integration-installation.js");
  const originalRequire = createRequire(filename), module = { exports: {} };
  vm.runInNewContext(await fs.readFile(filename, "utf8"), {
    module, process, Buffer, console,
    require: id => id.endsWith("owner-prepared-modules.json") ? { [gameId]: spec } : originalRequire(id)
  }, { filename });
  const beforeSave = await fs.readFile(path.join(f.xboxProfile, "savegame1/careerSavegame.xml"));
  const beforeMod = await fs.readFile(path.join(f.xboxProfile, "mods/FS25_ShenPulse.zip"));
  await write(path.join(f.steamProfile, "mods/FS25_ShenPulse.zip"), "Previous Steam module");
  const backupRoot = path.join(f.root, "backup");
  const receipt = await module.exports.configureOwnerIntegration(gameId, { targetPath: f.steam, documentsPath: f.documentsPath, localAppDataPath: f.localAppDataPath, backupRoot });
  assert.equal(receipt[0].path, path.join(f.managedProfile, "mods/FS25_ShenPulse.zip"));
  assert.deepEqual(await fs.readFile(receipt[0].path), bytes);
  assert.equal(await fs.readFile(path.join(f.steamProfile, "mods/FS25_ShenPulse.zip"), "utf8"), "Previous Steam module");
  assert.deepEqual(await fs.readFile(path.join(f.xboxProfile, "savegame1/careerSavegame.xml")), beforeSave);
  assert.deepEqual(await fs.readFile(path.join(f.xboxProfile, "mods/FS25_ShenPulse.zip")), beforeMod);
  await module.exports.assertOwnerIntegrationReady(gameId, f.steam, { documentsPath: f.documentsPath, localAppDataPath: f.localAppDataPath });
  // Updating Xbox still uses its original profile; it never redirects into Steam.
  const xboxReceipt = await module.exports.configureOwnerIntegration(gameId, { targetPath: f.xbox, documentsPath: f.documentsPath, localAppDataPath: f.localAppDataPath, backupRoot });
  assert.equal(xboxReceipt[0].root, "farming-mods");
  assert.equal(xboxReceipt[0].path, path.join(f.xboxProfile, "mods/FS25_ShenPulse.zip"));
  assert.deepEqual(await fs.readFile(xboxReceipt[0].path), bytes);
  assert.deepEqual(await fs.readFile(path.join(f.xboxProfile, "savegame1/careerSavegame.xml")), beforeSave);
  assert.deepEqual(await fs.readFile(receipt[0].path), bytes);
  assert.equal(await fs.readFile(path.join(f.steamProfile, "mods/FS25_ShenPulse.zip"), "utf8"), "Previous Steam module");
});

test("changer d’édition Farming reconnecte le pont au bon profil, même dans la même session", async t => {
  const f = await fixture(t);
  const bridge = new PreparedFileGame({ store: { getState: () => f.state }, gameId, spec, documentsPath: f.documentsPath, localAppDataPath: f.localAppDataPath, pollMs: 5, timeoutMs: 500 });
  t.after(() => bridge.close());
  await bridge.start();
  const steamDirectory = bridge.directory;
  await fs.writeFile(bridge.heartbeat, "ready");
  assert.equal(bridge.status().connected, true);
  f.state.game.installations[gameId] = { path: f.xbox, platform: "xbox" };
  assert.equal(bridge.status().connected, false, "La présence Steam ne prouve pas la connexion Xbox");
  await bridge.start();
  assert.equal(bridge.directory, path.join(f.xboxProfile, "modSettings/ShenPulse"));
  assert.notEqual(bridge.directory, steamDirectory);
  assert.equal(bridge.status().connected, false);
  await fs.writeFile(bridge.heartbeat, "ready");
  let request;
  const timer = setInterval(async () => {
    try {
      request = attributes(await fs.readFile(bridge.input, "utf8"));
      await fs.writeFile(bridge.output, '<ShenPulse id="' + request.id + '" status="0"/>');
    } catch {}
  }, 5);
  t.after(() => clearInterval(timer));
  assert.equal((await bridge.send("money1k")).status, 0);
  assert.equal(request.code, "money1k");
  assert.equal(await fs.readFile(path.join(steamDirectory, "request.xml"), "utf8").catch(() => null), null);
});

test("un accès au profil refusé explique le blocage sans annoncer une fausse connexion", async t => {
  const f = await fixture(t);
  const bridge = new PreparedFileGame({ store: { getState: () => f.state }, gameId, spec, documentsPath: f.documentsPath, localAppDataPath: f.localAppDataPath });
  t.after(() => bridge.close());
  const original = fs.mkdir;
  t.mock.method(fs, "mkdir", async (directory, options) => {
    if (directory === path.join(f.managedProfile, "modSettings/ShenPulse")) throw Object.assign(Error("Access denied"), { code: "EACCES" });
    return original(directory, options);
  });
  await assert.rejects(bridge.start(), error => /dossier local Farming.*est refusé/.test(error.message) && error.cause.code === "EACCES");
  assert.equal(bridge.status().connected, false);
  assert.equal(bridge.status().listening, false);
});

test("un refus Windows au nettoyage d’une ancienne réponse explique aussi le blocage", async t => {
  const f = await fixture(t);
  const bridge = new PreparedFileGame({ store: { getState: () => f.state }, gameId, spec, documentsPath: f.documentsPath, localAppDataPath: f.localAppDataPath });
  t.after(() => bridge.close());
  const original = fs.rm;
  await bridge.start();
  await bridge.close();
  const response = path.join(f.managedProfile, "modSettings/ShenPulse/response.xml");
  await write(response, '<ShenPulse id="ancienne-reponse" status="0"/>');
  t.mock.method(fs, "rm", async (file, options) => {
    if (file === response) throw Object.assign(Error("Operation not permitted"), { code: "EPERM" });
    return original(file, options);
  });
  await assert.rejects(bridge.start(), error => /dossier local Farming.*est refusé/.test(error.message) && error.cause.code === "EPERM");
  assert.equal(bridge.status().listening, false);
  assert.equal(bridge.status().connected, false);
});
