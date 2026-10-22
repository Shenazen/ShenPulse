"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { once } = require("node:events");
const { createHash } = require("node:crypto");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const manifest = require("../src/main/game-installers/escape-from-duckov");
const visibility = require("../src/shared/visibility-catalog");
const { GameHub } = require("../src/main/game-hub");
const { authenticatedFixtureStore } = require("./helpers/authenticated-store");
const { ADMIN_EMAIL } = require("../src/main/admin/constants");
const { downloadFixtureAsset } = require("./helpers/installer-download-fixture");
const { extractArchiveSafe } = require("../src/main/game-runtime/archives");
const { stageFourGamesInstallation, NATIVE_MODULES, dedicateModulePort } = require("../src/main/game-runtime/four-games-installation");
const { commitInstallationDeployment } = require("../src/main/game-runtime/deployments");
const { launchExternalGame } = require("../src/main/game-runtime/external-launch");
const { launchSteamGame } = require("../src/main/game-runtime/steam-launch");
const { assertModGameClosed } = require("../src/main/game-runtime/mod-installation-ready");
const root = path.resolve(__dirname, ".."), gameId = "escape-from-duckov";
const pack = () => loadShenazenGameCatalog(path.join(root, "resources")).find(pack => pack.id === gameId);

async function temporary(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-duckov-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

test("le correctif Duckov équipe les ennemis sans changer les commandes normales ni le joueur", { skip: process.platform !== "win32" }, async t => {
  const { execFileSync } = require("node:child_process");
  const dir = await temporary(t), output = path.join(dir, "compatibility-tests.exe");
  execFileSync(path.join(process.env.WINDIR, "Microsoft.NET/Framework64/v4.0.30319/csc.exe"),
    ["/nologo", "/target:exe", `/out:${output}`, path.join(root, "native/escape-from-duckov/Compatibility.cs"), path.join(root, "tests/fixtures/duckov-compatibility-harness.cs")], { windowsHide: true, stdio: "pipe" });
  assert.match(execFileSync(output, [], { encoding: "utf8", windowsHide: true }), /eight behavior checks passed/);
});

test("Duckov présente ses 83 effets natifs Steam et ses conditions de jeu", async () => {
  const game = pack();
  assert.equal(game.effects.length, 83);
  assert.equal(new Set(game.effects.map(e => e.id)).size, 83);
  assert.equal(new Set(game.effects.map(e => e.code)).size, 83);
  assert.equal(game.ownerOnly, true);
  assert.equal(game.minAppVersion, "2.0.5");
  assert.equal(game.catalogCategory, "action");
  assert.equal(game.installerVersion, manifest.version);
  assert.deepEqual(manifest.steamAppIds, ["3167020"]);
  assert.equal(game.connector.port, 58440);
  assert.equal(game.connector.durationMultiplier, 1000);
  assert.deepEqual(game.guide.journey, ["installation", "interactions", "overlays", "launch"]);
  assert.match(game.guide.notes.join(" "), /refuge/);
  assert.doesNotMatch(JSON.stringify({ steps: game.guide.steps, notes: game.guide.notes }), /Crowd Control/i);
  assert.ok(game.defaultMappings.every(m => m.enabled && !m.triggerEnabled));
  for (const effect of game.effects) {
    assert.equal(effect.code, effect.sourceEffectId);
    assert.equal(effect.available, true);
    assert.ok(effect.name && effect.description && effect.sourceName && effect.category);
    if (effect.duration) assert.equal(effect.parameters[0].defaultValue, effect.duration);
    await fs.access(path.resolve(root, "src/renderer", effect.image));
  }
  await fs.access(path.join(root, "src/renderer/assets/games", game.artwork));
});

test("Duckov reste privé et conserve sa version minimale lors de sa future publication", () => {
  const game = pack(), source = { schemaVersion: 11, games: {} };
  for (const version of ["2.0.4", "2.0.5", "99.0.0"]) assert.equal(visibility.canAccessGame(source, game, false, version), false);
  assert.equal(visibility.canAccessGame(source, game, true, "2.0.5"), true);
  const canonical = visibility.canonicalizeVisibility(source, { games: [{ id: gameId, defaultScope: "admin", minAppVersion: game.minAppVersion }] });
  assert.deepEqual(canonical.games[gameId], { scope: "admin", minAppVersion: "2.0.5" });
  source.games[gameId] = { scope: "public" };
  assert.equal(visibility.canAccessGame(source, game, false, "2.0.4"), false);
  assert.equal(visibility.canAccessGame(source, game, false, "2.0.5-beta"), false);
  assert.equal(visibility.canAccessGame(source, game, false, "2.0.5"), true);
  source.games[gameId].scope = "hidden";
  assert.equal(visibility.canAccessGame(source, game, true, "99.0.0"), false);
});

test("les 83 codes Duckov et leurs durées passent par la passerelle du jeu", async t => {
  const state = { settings: { account: { uid: "duckov-owner", email: ADMIN_EMAIL, emailVerified: true, refreshTokenSecretId: "fixture-account" } },
    commerce: { subscription: { tier: "pro", status: "active", source: "subscription" } },
    session: { activeGamePackId: gameId }, game: { connectorOverrides: {}, interactionRulesByPack: {}, interactionCatalogVersions: {} }, rules: [] };
  const hub = new GameHub({ store: authenticatedFixtureStore({ getState: () => state, mutate: fn => fn(state) }), appVersion: "2.0.5", packsDirectory: path.join(root, "resources/packs"), windowsInputService: { activate: async () => {} } });
  t.after(() => hub.disconnectAll());
  hub.loadPacks();
  const game = hub.packs.find(p => p.id === gameId); game.connector.port = 0;
  const prepared = await hub.prepareConnection(gameId);
  const client = net.createConnection({ host: "127.0.0.1", port: prepared.port });
  t.after(() => client.destroy()); await once(client, "connect");
  let buffer = ""; const sent = [];
  client.on("data", chunk => {
    buffer += chunk.toString();
    while (buffer.includes("\0")) {
      const at = buffer.indexOf("\0"), request = JSON.parse(buffer.slice(0, at)); buffer = buffer.slice(at + 1);
      sent.push(request); client.write(JSON.stringify({ id: request.id, type: 0, status: 0 }) + "\0");
    }
  });
  for (const effect of game.effects) {
    const result = await hub.trigger(effect.id, { source: "test" }, { packId: gameId });
    assert.equal(result.status, 0);
    const request = sent.at(-1);
    assert.equal(request.type, 1);
    assert.equal(request.code, effect.code);
    assert.equal(request.duration, (effect.duration || 0) * 1000);
  }
  assert.equal(sent.length, 83);
});

test("l’archive Duckov s’installe sans toucher aux sauvegardes ni aux préférences existantes", async t => {
  const dir = await temporary(t), archive = path.join(dir, "mod.zip"), asset = manifest.assets[0];
  await downloadFixtureAsset({ progress() {} }, gameId, asset, archive);
  const stage = path.join(dir, "stage"), target = path.join(dir, "game"), backup = path.join(dir, "backup");
  await extractArchiveSafe(archive, stage);
  await fs.access(path.join(stage, "Mods/ShenPulse.Duckov.Compatibility.dll"));
  await assert.rejects(fs.access(path.join(stage, "Mods/ShenPulse.DuckovProbe.dll")), { code: "ENOENT" });
  await fs.mkdir(path.join(target, "UserData"), { recursive: true });
  await fs.mkdir(path.join(target, "Mods"));
  await fs.writeFile(path.join(target, "Duckov.exe"), "original game");
  await fs.writeFile(path.join(target, "save.dat"), "original progress");
  await fs.writeFile(path.join(target, "Mods/CrowdControl.dll"), "old module");
  await fs.writeFile(path.join(target, "UserData/Loader.cfg"), "[Loader]\nCustomPreference = true\n");
  await stageFourGamesInstallation({ gameId, targetPath: target, deploymentRoot: stage });
  const dll = await fs.readFile(path.join(stage, "Mods/CrowdControl.dll"));
  assert.equal(dll.readInt32LE(NATIVE_MODULES[gameId].offset), 58440);
  assert.equal(createHash("sha256").update(dll).digest("hex"), NATIVE_MODULES[gameId].patched);
  await commitInstallationDeployment({ deploymentRoot: stage, targetPath: target, backupRoot: backup, tempRoot: dir });
  assert.equal(await fs.readFile(path.join(backup, "Mods/CrowdControl.dll"), "utf8"), "old module");
  assert.equal(await fs.readFile(path.join(target, "UserData/Loader.cfg"), "utf8"), "[Loader]\nCustomPreference = true\n");
  assert.equal(await fs.readFile(path.join(target, "Duckov.exe"), "utf8"), "original game");
  assert.equal(await fs.readFile(path.join(target, "save.dat"), "utf8"), "original progress");
  assert.throws(() => dedicateModulePort(Buffer.alloc(dll.length), NATIVE_MODULES[gameId]), /version du module/);
});

test("Duckov refuse une réparation pendant la partie et ne lance jamais deux instances", async t => {
  const dir = await temporary(t); await fs.writeFile(path.join(dir, "Duckov.exe"), "game");
  await assert.rejects(assertModGameClosed(gameId, dir, { platform: "win32", execute: async () => "314" }), /Fermez Escape From Duckov/);
  const calls = [];
  const args = { gameId, manifest, installation: { path: dir }, shell: { openPath: async () => { throw new Error("Direct executable forbidden"); }, openExternal: async url => calls.push(url) },
    assertAccess() {}, waitForWindowsProcessWindow: async name => calls.push(name), findRunning: async () => ({ ProcessId: 42 }) };
  const existing = await launchExternalGame(args);
  assert.equal(existing.alreadyRunning, true); assert.deepEqual(calls, ["Duckov"]);
  calls.length = 0;
  await launchExternalGame({ ...args, findRunning: async () => null });
  assert.deepEqual(calls, ["steam://rungameid/3167020", "Duckov"]);
  await assert.rejects(launchSteamGame({ ...args, executable: path.join(dir, "Duckov.exe"), manifest: { ...manifest, steamLaunchAppId: "999" } }), /non autorisé/);
});
