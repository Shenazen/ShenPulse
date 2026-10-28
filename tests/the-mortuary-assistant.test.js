"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { once } = require("node:events");
const { WebSocket } = require("ws");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { SimpleWebSocketGameBridge } = require("../src/main/simple-websocket-game-bridge");
const { downloadFixtureAsset: downloadAsset } = require("./helpers/installer-download-fixture");
const { commitInstallationDeployment } = require("../src/main/game-runtime/deployments");
const { extractArchiveSafe } = require("../src/main/game-runtime/archives");
const { GameHub } = require("../src/main/game-hub");
const { authenticatedFixtureStore } = require("./helpers/authenticated-store");
const manifest = require("../src/main/game-installers/the-mortuary-assistant");
const root = path.join(__dirname, "..");
const resourcesDirectory = path.join(root, "resources");

async function connected(t, options = {}) {
  const bridge = new SimpleWebSocketGameBridge({ port: 0, timeoutMs: 1000, ...options });
  t.after(() => bridge.close());
  await bridge.start();
  const client = new WebSocket(`ws://127.0.0.1:${bridge.port}/`);
  await once(client, "open");
  return { bridge, client };
}

async function temporary(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-mortuary-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test("Mortuary publie les 22 effets natifs en français sans référence tierce", async () => {
  const pack = loadShenazenGameCatalog(resourcesDirectory).find((entry) => entry.id === "the-mortuary-assistant");
  assert.equal(pack.effects.length, 22);
  assert.equal(new Set(pack.effects.map((entry) => entry.code)).size, 22);
  assert.equal(pack.connector.type, "websocket-server");
  assert.equal(pack.connector.port, 58434);
  assert.equal(pack.connector.durationMultiplier, 1000);
  assert.ok(pack.effects.every((entry) => entry.available && entry.service === "native"));
  assert.equal(pack.effects.filter((entry) => entry.duration === 30).length, 11);
  assert.equal(pack.defaultMappings.length, 12);
  assert.ok(pack.defaultMappings.every((entry) => entry.enabled && entry.triggerEnabled));
  assert.equal(pack.guide.mode, "native");
  assert.deepEqual(pack.guide.journey, ["installation", "interactions", "overlays", "launch"]);
  assert.doesNotMatch(JSON.stringify(pack), /crowd\s*control/i);
  await fs.access(path.join(root, "src/renderer/assets/games", pack.artwork));
});

test("WebSocket corrèle deux effets concurrents, sans confondre état et accusé", async (t) => {
  const { bridge, client } = await connected(t);
  const requests = [];
  client.on("message", (data) => {
    requests.push(JSON.parse(data));
    if (requests.length !== 2) return;
    for (const request of requests.toReversed()) {
      assert.equal(request.type, 1);
      assert.equal(request.duration, 30000);
      client.send(JSON.stringify({ type: 253, id: request.id, status: 0 }));
      client.send(JSON.stringify({ type: 1, id: request.id, status: 8 }));
      client.send(JSON.stringify({ type: 0, id: request.id, status: 0, message: request.code }));
    }
  });
  const results = await Promise.all([
    bridge.send("fast_movement", { duration: 30000 }),
    bridge.send("pause_possession", { duration: 30000 })
  ]);
  assert.deepEqual(results.map((result) => result.message), ["fast_movement", "pause_possession"]);
  assert.equal(bridge.pending.size, 0);
});

test("WebSocket conserve le refus temporaire du jeu et expire les messages invalides", async (t) => {
  const { bridge, client } = await connected(t, { timeoutMs: 50 });
  client.once("message", (data) => {
    const { id } = JSON.parse(data);
    client.send(JSON.stringify({ id, type: 0, status: 3, message: "Le démon n’est pas encore éveillé." }));
  });
  await assert.rejects(bridge.send("demonic_activity"), (error) => error.status === 3 && /démon/.test(error.message));
  client.on("message", (data) => {
    const { id } = JSON.parse(data);
    client.send("{invalid");
    client.send("null");
    client.send(JSON.stringify({ id, type: 0 }));
  });
  await assert.rejects(bridge.send("lights_out"), /n’a pas confirmé/);
  assert.equal(bridge.pending.size, 0);
});

test("WebSocket refuse les pages Web et une configuration exposée au réseau", async (t) => {
  const { bridge } = await connected(t);
  const browser = new WebSocket(`ws://127.0.0.1:${bridge.port}/`, { origin: "https://example.test" });
  const [error] = await once(browser, "error");
  assert.match(error.message, /403/);
  await assert.rejects(new SimpleWebSocketGameBridge({ host: "0.0.0.0", port: 0 }).start(), /mal configurée/);
});

test("WebSocket annule les effets à la déconnexion et accepte la reconnexion", async (t) => {
  const { bridge, client } = await connected(t);
  client.once("message", () => client.close());
  await assert.rejects(bridge.send("lights_out"), /déconnecté/);
  assert.equal(bridge.pending.size, 0);
  const next = new WebSocket(`ws://127.0.0.1:${bridge.port}/`);
  await once(next, "open");
  next.on("message", (data) => next.send(JSON.stringify({ id: JSON.parse(data).id, type: 0, status: 0 })));
  assert.equal((await bridge.send("restore_lights")).ok, true);
});

test("WebSocket ne transmet rien lorsque l’accès est révoqué après démarrage", async (t) => {
  const { bridge, client } = await connected(t);
  let sent = false;
  client.on("message", () => { sent = true; });
  let checks = 0;
  await assert.rejects(bridge.send("lights_out", {}, { assertAccess: () => {
    if (++checks === 2) throw new Error("Accès révoqué");
  } }), /Accès révoqué/);
  assert.equal(sent, false);
  assert.equal(bridge.pending.size, 0);
});

test("le pack téléchargé est vérifié, extrait et déployé avec sauvegarde du mod précédent", async (t) => {
  const directory = await temporary(t);
  const asset = manifest.assets.find((entry) => entry.id === "mod");
  const destination = path.join(directory, "mod.zip");
  await downloadAsset({ resourcesDirectory, progress() {} }, "the-mortuary-assistant", asset, destination);
  assert.equal((await fs.stat(destination)).size, asset.size);
  assert.equal(crypto.createHash("sha256").update(await fs.readFile(destination)).digest("hex"), asset.sha256);
  const stage = path.join(directory, "stage");
  await extractArchiveSafe(destination, stage);
  const mod = await fs.readFile(path.join(stage, "Mods/ShenPulse.TheMortuaryAssistant.dll"));
  assert.ok(mod.includes(Buffer.from("ShenPulse.TheMortuaryAssistant")));
  assert.ok(!mod.includes(Buffer.from("Crowd Control", "utf16le")));
  assert.ok(!mod.includes(Buffer.from("crowdcontrol.live", "utf16le")));
  await assert.rejects(fs.access(path.join(stage, "Mods/CrowdControl.TheMortuaryAssistant.dll")));
  await fs.access(path.join(stage, "UserLibs/ConnectorLib.JSON.dll"));
  await fs.access(path.join(stage, "MelonLoader/net6/MelonLoader.dll"));
  const target = path.join(directory, "game");
  const backup = path.join(directory, "backup");
  await fs.mkdir(path.join(target, "Mods"), { recursive: true });
  await fs.writeFile(path.join(target, manifest.retiredFiles[0]), "previous mod");
  const smallStage = path.join(directory, "small");
  await fs.mkdir(path.join(smallStage, "Mods"), { recursive: true });
  await fs.writeFile(path.join(smallStage, "Mods/ShenPulse.TheMortuaryAssistant.dll"), mod);
  await commitInstallationDeployment({ deploymentRoot: smallStage, targetPath: target, backupRoot: backup, tempRoot: directory, retiredFiles: manifest.retiredFiles });
  assert.equal(await fs.readFile(path.join(backup, manifest.retiredFiles[0]), "utf8"), "previous mod");
  await assert.rejects(fs.access(path.join(target, manifest.retiredFiles[0])));
  assert.deepEqual(await fs.readFile(path.join(target, "Mods/ShenPulse.TheMortuaryAssistant.dll")), mod);
});

test("le pack téléchargé refuse la corruption et les sorties de dossier", async (t) => {
  const directory = await temporary(t);
  const asset = manifest.assets.find((entry) => entry.id === "mod");
  const runtime = { resourcesDirectory, progress() {} };
  const destination = path.join(directory, "refused.zip");
  await assert.rejects(downloadAsset(runtime, "the-mortuary-assistant", { ...asset, sha256: "0".repeat(64) }, destination), /intégrité/);
  await assert.rejects(fs.access(destination));
  await assert.rejects(fs.access(`${destination}.partial`));
  await assert.rejects(downloadAsset(runtime, "the-mortuary-assistant", { ...asset, url: "https://untrusted.invalid/pack.zip" }, destination), /non autorisé/);
});

test("le hub prépare Mortuary, initialise ses cadeaux et transmet la durée au mod", async (t) => {
  const id = "the-mortuary-assistant";
  const state = {
    session: { activeGamePackId: id },
    commerce: { subscription: { tier: "pro", source: "subscription", status: "active" } },
    game: { recentPacks: [], interactionCatalogVersions: {}, interactionRulesByPack: {} }, rules: []
  };
  const activated = [];
  const hub = new GameHub({
    store: authenticatedFixtureStore({ getState: () => state, mutate: (fn) => fn(state) }),
    resourcesDirectory, packsDirectory: path.join(resourcesDirectory, "packs"),
    crowdControlPortReleaser: () => { throw new Error("Aucune dépendance au logiciel tiers"); },
    windowsInputService: { activate: async (processName) => activated.push(processName) }
  });
  t.after(() => hub.disconnectAll());
  hub.loadPacks();
  hub.packs.find((pack) => pack.id === id).connector.port = 0;
  assert.equal(hub.initializeDefaultInteractions(id).added, 12);
  assert.equal(hub.initializeDefaultInteractions(id).added, 0);
  const ready = await hub.prepareConnection(id);
  assert.equal(ready.listening, true);
  assert.equal(ready.connected, false);
  const client = new WebSocket(`ws://127.0.0.1:${ready.port}/`);
  await once(client, "open");
  assert.equal((await hub.testConnection(id)).connected, true);
  client.on("message", (data) => {
    const request = JSON.parse(data);
    assert.equal(request.code, "fast_movement");
    assert.equal(request.duration, 17000);
    client.send(JSON.stringify({ type: 0, id: request.id, status: 0, timeRemaining: 17000 }));
  });
  await hub.trigger("mortuary-fast-movement", { source: "manual-test" }, { packId: id, duration: 17 });
  assert.deepEqual(activated, ["The Mortuary Assistant"]);
  state.commerce.subscription.status = "inactive";
  await assert.rejects(hub.prepareConnection(id), /abonnement/);
});

test("une migration refuse les chemins sortants avant toute copie", async (t) => {
  const directory = await temporary(t);
  const stage = path.join(directory, "stage");
  const target = path.join(directory, "game");
  await fs.mkdir(stage);
  await fs.mkdir(target);
  await fs.writeFile(path.join(stage, "new.txt"), "new");
  await assert.rejects(commitInstallationDeployment({
    deploymentRoot: stage, targetPath: target, backupRoot: path.join(directory, "backup"),
    tempRoot: directory, retiredFiles: ["../outside.dll"]
  }), /non sûr/);
  await assert.rejects(fs.access(path.join(target, "new.txt")));
});
