"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const { once } = require("node:events");
const { createHash } = require("node:crypto");
const { GameHub } = require("../src/main/game-hub");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { createEffectPayload } = require("../src/main/game-hub/effect-payload");
const { authenticatedFixtureStore } = require("./helpers/authenticated-store");
const { downloadFixtureAsset: downloadAsset } = require("./helpers/installer-download-fixture");
const { extractArchiveSafe } = require("../src/main/game-runtime/archives");
const { commitInstallationDeployment } = require("../src/main/game-runtime/deployments");
const { findLaunchTarget } = require("../src/main/game-runtime/paths");
const manifest = require("../src/main/game-installers/crash-bandicoot-n-sane-trilogy");
const root = path.join(__dirname, ".."), resourcesDirectory = path.join(root, "resources");
const gameId = "crash-bandicoot-n-sane-trilogy";
const pack = () => loadShenazenGameCatalog(resourcesDirectory).find(({ id }) => id === gameId);

async function temporary(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-crash-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test("Crash remplace la fiche visuelle par 26 interactions autonomes", async () => {
  const game = pack();
  assert.equal(game.effects.length, 26);
  assert.equal(new Set(game.effects.map(({ code }) => code)).size, 26);
  const recipes = await fs.readFile(path.join(root, "native/crash-bandicoot/Recipes.cs"), "utf8");
  const cases = [...recipes.matchAll(/case "([a-z0-9_]+)"/g)].map(match => match[1]);
  const counters = [...recipes.slice(recipes.indexOf("string[] Counters"), recipes.indexOf("public static Recipe For")).matchAll(/"([a-z]+)"/g)].map(match => match[1]);
  assert.deepEqual(game.effects.map(({ code }) => code).sort(), [...counters, ...cases].sort());
  assert.ok(game.effects.every(({ available, service }) => available && service === "native"));
  assert.equal(game.guide.mode, "native");
  assert.deepEqual(game.guide.journey, ["installation", "interactions", "overlays", "launch"]);
  assert.doesNotMatch(JSON.stringify(game), /StreamToEarn|crowd\s*control/i);
  assert.equal(game.installerVersion, manifest.version);
  await fs.access(path.join(root, "src/renderer/assets/games", game.artwork));
});

test("Crash transmet quantités et durées configurées sans conversion supplémentaire", () => {
  const game = pack();
  const lives = game.effects.find(({ code }) => code === "givelife");
  const camera = game.effects.find(({ code }) => code === "fov_30");
  assert.equal(createEffectPayload(lives, {}, { parameters: { amount: 7 } }).effect.quantity, 7);
  assert.equal(createEffectPayload(camera, {}, { parameters: { durationSeconds: 42 } }).effect.duration, 42);
  assert.equal(createEffectPayload(camera).effect.duration, 15);
  assert.equal(game.connector.durationMultiplier, undefined);
  assert.equal(game.defaultMappings.length, 26);
  assert.ok(game.defaultMappings.every(({ enabled, triggerEnabled }) => enabled && !triggerEnabled));
});

test("l’installateur Crash détecte Steam et déploie uniquement son pont, avec sauvegarde", async (t) => {
  const directory = await temporary(t), asset = manifest.assets[0];
  assert.equal(manifest.autoDetect, true);
  assert.equal(manifest.unattended, true);
  assert.deepEqual(manifest.steamAppIds, ["731490"]);
  assert.deepEqual(manifest.executables, ["CrashBandicootNSaneTrilogy.exe"]);
  assert.deepEqual(manifest.launchExecutables, ["ShenPulse.CrashBridge.exe"]);
  const archive = path.join(directory, asset.fileName);
  await downloadAsset({ resourcesDirectory, progress() {} }, gameId, asset, archive);
  const bytes = await fs.readFile(archive);
  assert.equal(bytes.length, asset.size);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
  const stage = path.join(directory, "stage");
  await extractArchiveSafe(archive, stage);
  assert.deepEqual((await fs.readdir(stage)).sort(), ["ShenPulse.CrashBridge.README.txt", "ShenPulse.CrashBridge.exe"]);
  const exe = await fs.readFile(path.join(stage, "ShenPulse.CrashBridge.exe"));
  assert.equal(exe.subarray(0, 2).toString("ascii"), "MZ");
  const target = path.join(directory, "game"), backup = path.join(directory, "backup");
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, "ShenPulse.CrashBridge.exe"), "previous bridge");
  await fs.writeFile(path.join(target, "CrashBandicootNSaneTrilogy.exe"), "original game");
  await fs.writeFile(path.join(target, "save.dat"), "user progress");
  await commitInstallationDeployment({ deploymentRoot: stage, targetPath: target, backupRoot: backup, tempRoot: directory });
  assert.deepEqual(await fs.readFile(path.join(target, "ShenPulse.CrashBridge.exe")), exe);
  assert.equal(await fs.readFile(path.join(backup, "ShenPulse.CrashBridge.exe"), "utf8"), "previous bridge");
  assert.equal(await fs.readFile(path.join(target, "CrashBandicootNSaneTrilogy.exe"), "utf8"), "original game");
  assert.equal(await fs.readFile(path.join(target, "save.dat"), "utf8"), "user progress");
  assert.equal(await findLaunchTarget(target, manifest.launchExecutables, false), path.join(target, "ShenPulse.CrashBridge.exe"));
});

test("une archive Crash altérée est refusée avant le déploiement", async (t) => {
  const directory = await temporary(t), destination = path.join(directory, "bridge.zip");
  await assert.rejects(downloadAsset({ resourcesDirectory, progress() {} }, gameId, { ...manifest.assets[0], sha256: "0".repeat(64) }, destination), /intégrité/);
  await assert.rejects(fs.access(destination));
});

test("GameHub attend l’exécution Crash réelle et remonte les refus du niveau", async (t) => {
  const state = { session: { activeGamePackId: gameId },
    commerce: { subscription: { tier: "pro", source: "subscription", status: "active" } },
    game: { recentPacks: [], interactionCatalogVersions: {}, interactionRulesByPack: {} }, rules: [] };
  const activated = [];
  const hub = new GameHub({
    store: authenticatedFixtureStore({ getState: () => state, mutate: fn => fn(state) }),
    resourcesDirectory, packsDirectory: path.join(resourcesDirectory, "packs"),
    crowdControlPortReleaser: () => { throw new Error("Aucune dépendance à une autre application."); },
    windowsInputService: { activate: async name => activated.push(name) }
  });
  t.after(() => hub.disconnectAll());
  hub.loadPacks(); hub.packs.find(({ id }) => id === gameId).connector.port = 0;
  assert.equal(hub.initializeDefaultInteractions(gameId).added, 26);
  assert.equal(hub.initializeDefaultInteractions(gameId).added, 0);
  const ready = await hub.prepareConnection(gameId);
  const client = net.createConnection({ host: "127.0.0.1", port: ready.port });
  await once(client, "connect");
  let buffer = "", latest;
  client.on("data", chunk => {
    buffer += chunk.toString("utf8");
    while (buffer.includes("\0")) {
      const i = buffer.indexOf("\0"); latest = JSON.parse(buffer.slice(0, i)); buffer = buffer.slice(i + 1);
      const status = latest.code === "takeboxes" ? 3 : 0;
      setTimeout(() => client.write(JSON.stringify({ id: latest.id, type: 0, status, message: status ? "Le jeu est en pause." : "Appliqué" }) + "\0"), 15);
    }
  });
  const result = await hub.trigger(`${gameId}-givelife`, { source: "manual-test" }, { packId: gameId, parameters: { amount: 3 } });
  assert.equal(result.ok, true); assert.equal(latest.quantity, 3);
  await hub.trigger(`${gameId}-groundspeed-300`, {}, { packId: gameId, parameters: { durationSeconds: 32 } });
  assert.equal(latest.code, "groundspeed_300"); assert.equal(latest.duration, 32);
  assert.deepEqual(activated, ["CrashBandicootNSaneTrilogy"]);
  await assert.rejects(hub.trigger(`${gameId}-takeboxes`, {}, { packId: gameId }), error => error.status === 3 && /pause/.test(error.message));
});
