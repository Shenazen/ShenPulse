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
const { downloadAsset } = require("../src/main/game-runtime/asset-download");
const { extractArchiveSafe } = require("../src/main/game-runtime/archives");
const { commitInstallationDeployment } = require("../src/main/game-runtime/deployments");
const manifest = require("../src/main/game-installers/unturned");
const root = path.join(__dirname, "..");
const resourcesDirectory = path.join(root, "resources");
const pack = () => loadShenazenGameCatalog(resourcesDirectory).find(({ id }) => id === "unturned");

async function temporary(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-unturned-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test("Unturned présente 27 interactions autonomes conformes aux commandes du module", async () => {
  const game = pack();
  assert.equal(game.effects.length, 27);
  assert.equal(new Set(game.effects.map(({ code }) => code)).size, 27);
  const protocol = await fs.readFile(path.join(root, "native/unturned/Protocol.cs"), "utf8");
  const codes = [...protocol.slice(protocol.indexOf("string[] Codes"), protocol.indexOf("public static Request Decode")).matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
  assert.deepEqual(game.effects.map(({ code }) => code), codes);
  const effects = await fs.readFile(path.join(root, "native/unturned/Effects.cs"), "utf8");
  assert.deepEqual([...effects.matchAll(/case "([a-z_]+)"/g)].map((match) => match[1]).sort(), [...codes].sort());
  assert.ok(game.effects.every(({ available, service }) => available && service === "native"));
  assert.equal(game.guide.mode, "native");
  assert.deepEqual(game.guide.journey, ["installation", "interactions", "overlays", "launch"]);
  assert.doesNotMatch(JSON.stringify(game), /StreamToEarn|crowd\s*control/i);
  await fs.access(path.join(root, "src/renderer/assets/games", game.artwork));
});

test("les paramètres Unturned transmettent les quantités sans les multiplier deux fois", () => {
  const game = pack();
  const spawn = game.effects.find(({ code }) => code === "spawn_animals");
  const payload = createEffectPayload(spawn, { user: { name: "Viewer" } }, { parameters: { amount: 7, assetId: 4 } });
  assert.equal(payload.effect.quantity, 7);
  assert.deepEqual(payload.effect.parameters, { amount: 7, radius: 8, assetId: 4 });
  const heal = game.effects.find(({ code }) => code === "heal");
  assert.equal(createEffectPayload(heal, {}, { parameters: { value: -30 } }).effect.parameters.value, -30);
  assert.equal(game.defaultMappings.length, 27);
  assert.ok(game.defaultMappings.every(({ enabled, triggerEnabled }) => enabled && !triggerEnabled));
});

test("l’archive Unturned déploie le module autonome et sa bibliothèque libre avec sauvegarde", async (t) => {
  const directory = await temporary(t), asset = manifest.assets[0];
  const archive = path.join(directory, asset.fileName);
  await downloadAsset({ resourcesDirectory, progress() {} }, "unturned", asset, archive);
  const bytes = await fs.readFile(archive);
  assert.equal(bytes.length, asset.size);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
  const stage = path.join(directory, "stage");
  await extractArchiveSafe(archive, stage);
  const relative = "Modules/ShenPulse.Unturned";
  const config = JSON.parse(await fs.readFile(path.join(stage, relative, "ShenPulse.Unturned.module"), "utf8"));
  assert.equal(config.Name, "ShenPulse.Unturned");
  assert.equal(config.Version, manifest.version + ".0");
  assert.ok(config.Assemblies.every(({ Role }) => Role === "Client"));
  assert.deepEqual(config.Assemblies.map(({ Path }) => Path), ["/0Harmony.dll", "/ShenPulse.Unturned.dll"]);
  const dll = await fs.readFile(path.join(stage, relative, "ShenPulse.Unturned.dll"));
  assert.equal(dll.subarray(0, 2).toString("ascii"), "MZ");
  assert.deepEqual((await fs.readdir(path.join(stage, relative))).sort(), ["0Harmony.dll", "README.txt", "ShenPulse.Unturned.dll", "ShenPulse.Unturned.module", "THIRD-PARTY-NOTICES.txt"]);
  const harmony = await fs.readFile(path.join(stage, relative, "0Harmony.dll"));
  assert.equal(harmony.subarray(0, 2).toString("ascii"), "MZ");
  const notices = await fs.readFile(path.join(stage, relative, "THIRD-PARTY-NOTICES.txt"), "utf8");
  assert.match(notices, /Harmony 2\.4\.3/);
  assert.match(notices, /Andreas Pardeike/);
  assert.match(notices, /MonoMod/);
  assert.match(notices, /Mono\.Cecil/);
  const target = path.join(directory, "game"), backup = path.join(directory, "backup");
  await fs.mkdir(path.join(target, relative), { recursive: true });
  await fs.writeFile(path.join(target, relative, "ShenPulse.Unturned.dll"), "previous module");
  await fs.writeFile(path.join(target, relative, "user-settings.json"), "keep");
  await commitInstallationDeployment({ deploymentRoot: stage, targetPath: target, backupRoot: backup, tempRoot: directory });
  assert.deepEqual(await fs.readFile(path.join(target, relative, "ShenPulse.Unturned.dll")), dll);
  assert.equal(await fs.readFile(path.join(backup, relative, "ShenPulse.Unturned.dll"), "utf8"), "previous module");
  assert.equal(await fs.readFile(path.join(target, relative, "user-settings.json"), "utf8"), "keep");
});

test("le module Unturned intégré est refusé si son empreinte ne correspond pas", async (t) => {
  const directory = await temporary(t);
  const destination = path.join(directory, "module.zip");
  await assert.rejects(downloadAsset({ resourcesDirectory, progress() {} }, "unturned", { ...manifest.assets[0], sha256: "0".repeat(64) }, destination), /intégrité/);
  await assert.rejects(fs.access(destination));
});

test("le parcours Unturned prépare la connexion locale et attend la confirmation du jeu", async (t) => {
  const state = { session: { activeGamePackId: "unturned" },
    commerce: { subscription: { tier: "pro", source: "subscription", status: "active" } },
    game: { recentPacks: [], interactionCatalogVersions: {}, interactionRulesByPack: {} }, rules: [] };
  const activated = [];
  const hub = new GameHub({
    store: authenticatedFixtureStore({ getState: () => state, mutate: (fn) => fn(state) }),
    resourcesDirectory, packsDirectory: path.join(resourcesDirectory, "packs"),
    crowdControlPortReleaser: () => { throw new Error("Aucune application tierce ne doit être utilisée."); },
    windowsInputService: { activate: async (name) => activated.push(name) }
  });
  t.after(() => hub.disconnectAll());
  hub.loadPacks();
  hub.packs.find(({ id }) => id === "unturned").connector.port = 0;
  assert.equal(hub.initializeDefaultInteractions("unturned").added, 27);
  assert.equal(hub.initializeDefaultInteractions("unturned").added, 0);
  const ready = await hub.prepareConnection("unturned");
  assert.equal(ready.listening, true);
  const client = net.createConnection({ host: "127.0.0.1", port: ready.port });
  await once(client, "connect");
  assert.equal((await hub.testConnection("unturned")).connected, true);
  let buffer = "", latest;
  client.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    const separator = buffer.indexOf("\0");
    if (separator < 0) return;
    latest = JSON.parse(buffer.slice(0, separator)); buffer = buffer.slice(separator + 1);
    const status = latest.code === "day" ? 3 : 0;
    setTimeout(() => client.write(JSON.stringify({ id: latest.id, type: 0, status, message: status ? "Chargez une partie solo." : "Exécuté" }) + "\0"), 15);
  });
  const result = await hub.trigger("unturned-spawn-animals", { source: "manual-test", user: { name: "Créateur" } }, { packId: "unturned", parameters: { amount: 4, assetId: 5 } });
  assert.equal(result.ok, true);
  assert.equal(latest.code, "spawn_animals");
  assert.equal(latest.quantity, 4);
  assert.equal(latest.parameters.assetId, 5);
  assert.equal(latest.viewer, "Créateur");
  assert.deepEqual(activated, ["Unturned"]);
  await assert.rejects(hub.trigger("unturned-day", {}, { packId: "unturned" }), (error) => error.status === 3 && /solo/.test(error.message));
  state.commerce.subscription.status = "inactive";
  await assert.rejects(hub.prepareConnection("unturned"), /abonnement/);
});
