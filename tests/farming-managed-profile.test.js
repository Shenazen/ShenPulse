"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), { createHash } = require("node:crypto");
const { prepareFarmingRuntimeProfile, farmingRuntimeProfile, farmingSteamLaunchUri, assertFarmingRunningProfile } = require("../src/main/game-runtime/farming-managed-profile");
const { PreparedFileGame, attributes } = require("../src/main/prepared-file-games");
const { XBOX_IDENTITY } = require("../src/main/game-runtime/farming-profile");

async function put(file, text) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, text); }
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "farming-appdata-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const target = path.join(root, "Steam/common/Farming Simulator 25"), documentsPath = path.join(root, "Documents"), localAppDataPath = path.join(root, "Local");
  const source = path.join(documentsPath, "My Games/FarmingSimulator2025"), bytes = Buffer.from("module fixture - not executable");
  const modulePath = path.join(target, "module.zip"), moduleSha256 = createHash("sha256").update(bytes).digest("hex");
  await put(modulePath, bytes);
  await put(path.join(source, "savegame1/careerSavegame.xml"), "Original farm");
  await put(path.join(source, "gameSettings.xml"), '<gameSettings><volume>0.5</volume></gameSettings>');
  await put(path.join(source, "mods/other.zip"), "Other mod");
  await put(path.join(source, "mods/FS25_ShenPulse.zip"), "Old mod");
  await put(path.join(source, "modSettings/Other/settings.xml"), "Keep settings");
  await put(path.join(source, "modSettings/ShenPulse/request.xml"), "Never replay this");
  await put(path.join(source, "log.txt"), "Skip log");
  const options = { documentsPath, localAppDataPath, modulePath, moduleSha256, assertClosed: async () => {} };
  return { root, target, source, bytes, options };
}

test("l’installation et le pont fonctionnent sans aucune écriture dans Documents", async t => {
  const f = await fixture(t), writes = [];
  const protectedPath = file => typeof file === "string" && (file === f.options.documentsPath || file.startsWith(f.options.documentsPath + path.sep));
  // Simulate a protected Documents folder, including rename/unlink cleanup.
  for (const method of ["writeFile", "mkdir", "rm", "unlink", "utimes", "rename", "copyFile"]) {
    const original = fs[method];
    t.mock.method(fs, method, async (...args) => {
      const destinations = method === "rename" ? args.slice(0, 2) : [method === "copyFile" ? args[1] : args[0]];
      if (destinations.some(protectedPath)) throw Object.assign(Error("Documents protected"), { code: "EPERM" });
      writes.push(...destinations); return original(...args);
    });
  }
  const profile = await prepareFarmingRuntimeProfile(f.target, f.options);
  assert.ok(profile.directory.startsWith(f.options.localAppDataPath));
  assert.equal(await fs.readFile(path.join(profile.directory, "savegame1/careerSavegame.xml"), "utf8"), "Original farm");
  assert.equal(await fs.readFile(path.join(profile.directory, "mods/other.zip"), "utf8"), "Other mod");
  assert.deepEqual(await fs.readFile(path.join(profile.modsDirectory, "FS25_ShenPulse.zip")), f.bytes);
  assert.equal(await fs.readFile(path.join(profile.directory, "modSettings/ShenPulse/request.xml")).catch(() => null), null);
  assert.equal(await fs.readFile(path.join(profile.directory, "log.txt")).catch(() => null), null);
  const settings = await fs.readFile(path.join(profile.directory, "gameSettings.xml"), "utf8");
  assert.match(settings, /<volume>0.5<\/volume>/); assert.ok(settings.includes(profile.modsDirectory.replace(/\\/g, "/")));
  const state = { game: { installations: { fixture: { path: f.target } } } };
  const bridge = new PreparedFileGame({ store: { getState: () => state }, gameId: "fixture", spec: { module: "module.zip", moduleSha256: f.options.moduleSha256, installer: { fileGame: "fs25" } }, ...f.options, pollMs: 5, timeoutMs: 500 });
  await bridge.start(); assert.equal(bridge.directory, path.join(profile.directory, "modSettings/ShenPulse"));
  await fs.writeFile(bridge.heartbeat, "ready");
  const timer = setInterval(async () => { try { const request = attributes(await fs.readFile(bridge.input, "utf8")); await fs.writeFile(bridge.output, '<ShenPulse id="' + request.id + '" status="0"/>'); } catch {} }, 5);
  try { assert.equal((await bridge.send("money1k")).status, 0); } finally { clearInterval(timer); await bridge.close(); }
  assert.equal(await fs.readFile(path.join(f.source, "mods/FS25_ShenPulse.zip"), "utf8"), "Old mod");
  assert.equal(await fs.readFile(path.join(f.source, "savegame1/careerSavegame.xml"), "utf8"), "Original farm");
  assert.ok(writes.length > 10);
  t.mock.restoreAll(); // fixture cleanup may delete its temporary Documents tree
});

test("une réparation conserve la progression importée et sauvegarde l’ancien module", async t => {
  const f = await fixture(t), profile = await prepareFarmingRuntimeProfile(f.target, f.options);
  const save = path.join(profile.directory, "savegame1/careerSavegame.xml");
  await fs.writeFile(save, "Progress made in ShenPulse");
  await put(path.join(f.source, "savegame1/careerSavegame.xml"), "Different original progress");
  const next = Buffer.from("Updated fixture module"), hash = createHash("sha256").update(next).digest("hex");
  await fs.writeFile(f.options.modulePath, next);
  await prepareFarmingRuntimeProfile(f.target, { ...f.options, moduleSha256: hash });
  assert.equal(await fs.readFile(save, "utf8"), "Progress made in ShenPulse");
  assert.deepEqual(await fs.readFile(path.join(profile.directory, "shenpulse-module-backups", f.options.moduleSha256 + ".zip")), f.bytes);
  assert.deepEqual(await fs.readFile(path.join(profile.modsDirectory, "FS25_ShenPulse.zip")), next);
});

test("les mods personnalisés sont importés sans modifier leur répertoire d’origine", async t => {
  const f = await fixture(t), custom = path.join(f.root, "Custom Mods & More");
  await put(path.join(custom, "special.zip"), "Custom mod");
  const original = '<gameSettings><modsDirectoryOverride active="true" directory="' + custom.replace(/&/g, "&amp;") + '" /></gameSettings>';
  await put(path.join(f.source, "gameSettings.xml"), original);
  const profile = await prepareFarmingRuntimeProfile(f.target, f.options);
  assert.equal(await fs.readFile(path.join(profile.modsDirectory, "special.zip"), "utf8"), "Custom mod");
  assert.equal(await fs.readFile(path.join(f.source, "gameSettings.xml"), "utf8"), original);
});

test("une interruption ne valide pas un import partiel et permet une reprise propre", async t => {
  const f = await fixture(t); let checks = 0;
  await assert.rejects(prepareFarmingRuntimeProfile(f.target, { ...f.options, assertAccess() { if (++checks === 5) throw Error("Account changed"); } }), /Account changed/);
  const profile = await farmingRuntimeProfile(f.target, f.options);
  assert.equal(await fs.stat(profile.directory).catch(() => null), null);
  assert.equal((await fs.readdir(path.dirname(profile.directory))).filter(name => name.startsWith("steam-import-")).length, 0);
  await prepareFarmingRuntimeProfile(f.target, f.options);
  assert.equal(await fs.readFile(path.join(profile.directory, "savegame1/careerSavegame.xml"), "utf8"), "Original farm");
});

test("deux préparations concurrentes n’importent les sauvegardes qu’une fois", async t => {
  const f = await fixture(t);
  const profiles = await Promise.all([prepareFarmingRuntimeProfile(f.target, f.options), prepareFarmingRuntimeProfile(f.target, f.options)]);
  assert.equal(profiles[0].directory, profiles[1].directory);
  assert.deepEqual(await fs.readFile(path.join(profiles[0].modsDirectory, "FS25_ShenPulse.zip")), f.bytes);
});

test("un jeu encore ouvert interdit l’import et le remplacement du module", async t => {
  const f = await fixture(t), closed = async () => { throw Error("Game still running"); };
  await assert.rejects(prepareFarmingRuntimeProfile(f.target, { ...f.options, assertClosed: closed }), /still running/);
  const profile = await prepareFarmingRuntimeProfile(f.target, f.options);
  const next = Buffer.from("New module fixture");
  await fs.writeFile(f.options.modulePath, next);
  await assert.rejects(prepareFarmingRuntimeProfile(f.target, { ...f.options, moduleSha256: createHash("sha256").update(next).digest("hex"), assertClosed: closed }), /still running/);
  assert.deepEqual(await fs.readFile(path.join(profile.modsDirectory, "FS25_ShenPulse.zip")), f.bytes);
});

test("le profil Xbox reste à son emplacement et aucun import Steam n’est créé", async t => {
  const f = await fixture(t), xbox = path.join(f.root, "Xbox");
  await put(path.join(xbox, "MicrosoftGame.config"), '<Game><Identity Name="' + XBOX_IDENTITY + '"/></Game>');
  const original = path.join(f.options.localAppDataPath, "Packages", XBOX_IDENTITY + "_test", "LocalCache/Local");
  await put(path.join(original, "savegame1/careerSavegame.xml"), "Xbox unchanged");
  const profile = await prepareFarmingRuntimeProfile(xbox, { ...f.options, assertClosed() { throw Error("No Xbox migration expected"); } });
  assert.equal(profile.directory, original); assert.equal(profile.managed, undefined);
  assert.equal(await fs.readFile(path.join(original, "savegame1/careerSavegame.xml"), "utf8"), "Xbox unchanged");
  assert.equal(await fs.stat(path.join(f.options.localAppDataPath, "ShenPulse")).catch(() => null), null);
});

test("un jeu ouvert dans le profil standard est refusé sans démarrer une seconde instance", async t => {
  const f = await fixture(t), profile = await farmingRuntimeProfile(f.target, f.options);
  assert.throws(() => assertFarmingRunningProfile({ CommandLine: '"Farming.exe"' }, profile), /autre profil/);
  assert.throws(() => assertFarmingRunningProfile({ CommandLine: 'Farming.exe -profile "' + f.source + '"' }, profile), /autre profil/);
  assert.doesNotThrow(() => assertFarmingRunningProfile({ CommandLine: 'Farming.exe -profile "' + profile.directory + '"' }, profile));
  const uri = farmingSteamLaunchUri(profile.directory);
  assert.equal(decodeURIComponent(uri.split("//")[2].slice(0, -1)), '-profile "' + profile.directory + '"');
  assert.throws(() => farmingSteamLaunchUri('bad"\npath'), /invalide/);
});
