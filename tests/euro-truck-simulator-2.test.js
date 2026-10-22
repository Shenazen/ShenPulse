"use strict";

const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os");
const net = require("node:net"), { once } = require("node:events"), { createHash } = require("node:crypto");
const manifest = require("../src/main/game-installers/euro-truck-simulator-2");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { GameHub } = require("../src/main/game-hub");
const { authenticatedFixtureStore } = require("./helpers/authenticated-store");
const { downloadFixtureAsset } = require("./helpers/installer-download-fixture");
const { extractArchiveSafe } = require("../src/main/game-runtime/archives");
const { commitInstallationDeployment } = require("../src/main/game-runtime/deployments");
const { launchExternalGame } = require("../src/main/game-runtime/external-launch");
const { assertModGameClosed } = require("../src/main/game-runtime/mod-installation-ready");
const { waitForGameConnection } = require("../src/main/game-hub/connection-ready");
const { MODULE_PATH, MODULE_HASHES, configureTruckModule, stageTruckSimulatorInstallation, assertTruckSimulatorReady } = require("../src/main/game-runtime/truck-simulator-installation");
const gameId = "euro-truck-simulator-2", root = path.resolve(__dirname, "..");
const pack = () => loadShenazenGameCatalog(path.join(root, "resources")).find(p => p.id === gameId);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

async function temporary(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-ets2-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

async function extractModule(dir) {
  const archive = path.join(dir, "module.zip"), stage = path.join(dir, "stage");
  await downloadFixtureAsset({ progress() {} }, gameId, manifest.assets[0], archive);
  await extractArchiveSafe(archive, path.join(stage, path.dirname(MODULE_PATH)));
  return stage;
}

test("ETS2 configure le module téléchargé pour ShenPulse sans modifier le jeu, ses sauvegardes ni les autres plugins", async t => {
  const dir = await temporary(t), stage = await extractModule(dir), file = path.join(stage, MODULE_PATH);
  const original = await fs.readFile(file), preserved = Buffer.from(original);
  assert.equal(digest(original), MODULE_HASHES.original);
  const configured = configureTruckModule(original);
  assert.deepEqual(original, preserved, "la source vérifiée reste intacte");
  assert.equal(digest(configured), MODULE_HASHES.patched);
  assert.equal(configured.readUInt16LE(53839), 58441);
  assert.equal(configured.subarray(353353, 353358).toString("ascii"), "58441");
  assert.equal(configured.subarray(11552, 11554).toString("hex"), "b101", "mode compatible même après redémarrage par Steam");
  assert.deepEqual(configureTruckModule(configured), configured, "réinstallation idempotente");
  const corrupted = Buffer.from(original); corrupted[100] ^= 1;
  assert.throws(() => configureTruckModule(corrupted), /version du module/);
  await assert.rejects(stageTruckSimulatorInstallation({ deploymentRoot: stage, assertAccess() { throw Error("Accès révoqué"); } }), /Accès révoqué/);
  assert.deepEqual(await fs.readFile(file), original, "aucune écriture après révocation");
  await stageTruckSimulatorInstallation({ deploymentRoot: stage });
  const target = path.join(dir, "game"), backup = path.join(dir, "backup");
  await fs.mkdir(path.dirname(path.join(target, MODULE_PATH)), { recursive: true });
  await fs.writeFile(path.join(target, MODULE_PATH), original);
  const unrelated = { "save.dat": "progress", "bin/win_x64/eurotrucks2.exe": "game", "bin/win_x64/plugins/telemetry.dll": "telemetry" };
  for (const [name, content] of Object.entries(unrelated)) await fs.writeFile(path.join(target, name), content);
  await commitInstallationDeployment({ deploymentRoot: stage, targetPath: target, backupRoot: backup, tempRoot: dir });
  await assertTruckSimulatorReady(target);
  assert.deepEqual(await fs.readFile(path.join(backup, MODULE_PATH)), original);
  for (const [name, content] of Object.entries(unrelated)) assert.equal(await fs.readFile(path.join(target, name), "utf8"), content);
});

test("ETS2 réutilise le processus ouvert et demande une réparation si son module est ancien ou absent", async t => {
  const dir = await temporary(t), stage = await extractModule(dir), calls = [];
  await fs.writeFile(path.join(stage, "bin/win_x64/eurotrucks2.exe"), "game");
  const args = { gameId, manifest, installation: { path: stage }, assertAccess() {},
    shell: { openPath: async p => { calls.push(p); return ""; } },
    waitForWindowsProcessWindow: async name => calls.push(name), findRunning: async () => null };
  await assert.rejects(launchExternalGame(args), /Réinstaller les interactions/);
  assert.deepEqual(calls, []);
  await stageTruckSimulatorInstallation({ deploymentRoot: stage });
  const existing = await launchExternalGame({ ...args, findRunning: async names => { assert.deepEqual(names, ["eurotrucks2"]); return { ProcessId: 42 }; } });
  assert.equal(existing.alreadyRunning, true);
  assert.deepEqual(calls, ["eurotrucks2"]);
  calls.length = 0;
  await launchExternalGame(args);
  assert.deepEqual(calls, [path.join(stage, "bin/win_x64/eurotrucks2.exe"), "eurotrucks2"]);
  await assert.rejects(assertModGameClosed(gameId, stage, { platform: "win32", execute: async () => "42" }), /Fermez Euro Truck Simulator 2/);
  await fs.rm(path.join(stage, MODULE_PATH));
  await assert.rejects(assertTruckSimulatorReady(stage), /Réinstaller les interactions/);
});

test("les 30 commandes ETS2 fonctionnent pour un compte Pro normal malgré un ancien port enregistré, puis après reconnexion", async t => {
  const state = { settings: { account: { uid: "ets2-user", email: "user@example.test", emailVerified: true, refreshTokenSecretId: "fixture-account" } },
    commerce: { subscription: { tier: "pro", status: "active", source: "subscription" } }, session: { activeGamePackId: gameId },
    game: { connectorOverrides: { [gameId]: { type: "demo", host: "192.0.2.1", port: 51337 } }, interactionRulesByPack: {}, interactionCatalogVersions: {} }, rules: [] };
  const hub = new GameHub({ store: authenticatedFixtureStore({ getState: () => state, mutate: fn => fn(state) }), appVersion: "2.0.5", packsDirectory: path.join(root, "resources/packs") });
  t.after(() => hub.disconnectAll()); hub.loadPacks();
  const game = hub.packs.find(p => p.id === gameId);
  assert.equal(game.connector.port, 58441);
  game.connector.port = 0; // Port éphémère uniquement pour isoler ce test du vrai jeu.
  const ready = await hub.prepareConnection(gameId);
  assert.equal(ready.type, "tcp-server"); assert.equal(ready.host, "127.0.0.1");
  assert.equal(ready.connected, false);
  await assert.rejects(hub.trigger(game.effects[0].id, {}, { packId: gameId }), /pas encore connecté/);
  const sent = [];
  async function connect() {
    const client = net.createConnection({ host: ready.host, port: ready.port });
    t.after(() => client.destroy()); await once(client, "connect");
    let buffer = "";
    client.on("data", chunk => {
      buffer += chunk.toString();
      while (buffer.includes("\0")) {
        const at = buffer.indexOf("\0"), request = JSON.parse(buffer.slice(0, at)); buffer = buffer.slice(at + 1);
        sent.push(request); client.write(JSON.stringify({ id: request.id, type: 0, status: 0 }) + "\0");
      }
    });
    return client;
  }
  const client = await connect();
  assert.equal((await hub.waitForConnection(gameId)).connected, true);
  for (const effect of game.effects) {
    assert.equal((await hub.trigger(effect.id, { source: "test" }, { packId: gameId })).status, 0);
    assert.equal(sent.at(-1).code, effect.code);
    assert.equal(sent.at(-1).duration, (effect.duration || 0) * 1000);
    assert.equal(sent.at(-1).type, 1);
  }
  assert.equal(new Set(sent.map(r => r.id)).size, 30);
  client.destroy();
  const bridge = hub.serverBridges.get(`${gameId}:tcp-server`);
  for (let i = 0; i < 30 && bridge.status().connected; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(bridge.status().connected, false);
  await connect(); await hub.waitForConnection(gameId);
  assert.equal((await hub.trigger(game.effects[0].id, {}, { packId: gameId })).status, 0);
});

test("ETS2 attend une vraie connexion et explique le SDK ou la réparation si le module ne répond pas", async () => {
  const game = pack();
  assert.equal(game.installerVersion, "1.0.5"); assert.equal(manifest.version, "1.0.5");
  assert.equal(game.effects.length, 30);
  assert.equal(game.connector.launchConnectionTimeoutMs, 90000);
  assert.doesNotMatch(JSON.stringify({ steps: game.guide.steps, notes: game.guide.notes }), /Crowd Control/i);
  let elapsed = 0, attempts = 0;
  const hub = { assertAccess: () => game, prepareConnection: async () => { attempts++; return { listening: true, connected: false }; } };
  await assert.rejects(waitForGameConnection(hub, gameId, { now: () => elapsed, sleep: async ms => { elapsed += ms; }, intervalMs: 10000 }), /SDK avancé.*[Rr]éinstall/);
  assert.equal(elapsed, 90000); assert.equal(attempts, 9);
});
