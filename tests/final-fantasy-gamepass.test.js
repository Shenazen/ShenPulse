"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const records = require("../resources/catalogs/owner-game-preparation.json").games;
const { finalFantasyRecord } = require("../src/main/game-catalog/final-fantasy");
const { OWNER_INTEGRATIONS } = require("../src/main/game-catalog/owner-integrations");

test("les cinq Final Fantasy conservent leurs 538 codes et leurs identifiants, avec des noms courts", () => {
  let count = 0;
  for (let number = 1; number <= 5; number++) {
    const original = records.find(g => g.id === `final-fantasy-${number}-pixel-remaster`);
    const adapted = finalFantasyRecord(original); count += adapted.effects.length;
    assert.deepEqual(adapted.effects.map(e => e.id).sort(), original.effects.map(e => e.id).sort());
    assert.deepEqual(adapted.effects.map(e => e.code).sort(), original.effects.map(e => e.code).sort());
    for (const effect of adapted.effects) {
      assert.ok(effect.name.trim().split(/\s+/).length <= 2, effect.code + " " + effect.name);
      assert.doesNotMatch(effect.description, /\{\{|Twitch|subscriber|Max subscribers/);
    }
    const pack = OWNER_INTEGRATIONS.find(g => g.id === original.id);
    assert.equal(pack.connector.viewerIdentity, true);
    for (const column of ["help", "trap"]) assert.equal(pack.defaultMappings.filter(m => m.marketColumn === column).length, 6);
    assert.ok(pack.defaultMappings.every(m => !/_[45]$/.test(pack.effects.find(e => e.id === m.effectId).code)));
  }
  assert.equal(count, 538);
  const unrelated = { id: "unrelated", effects: [] }; assert.equal(finalFantasyRecord(unrelated), unrelated);
});

test("le code de la queue de phénix de Final Fantasy II correspond au module", () => {
  const game = finalFantasyRecord(records.find(g => g.id === "final-fantasy-2-pixel-remaster"));
  assert.ok(game.effects.some(e => e.code === "giveitem_Phoenix+Down_8"));
  assert.ok(!game.effects.some(e => e.code === "giveitem_Phoeni+Down_8"));
});

test("chaque édition sélectionne son propre pack et ses dépendances vérifiées", async t => {
  const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os");
  const { createHash } = require("node:crypto");
  const definitions = require("../resources/catalogs/owner-prepared-modules.json");
  const registry = require("../scripts/manifests/game-packs.json");
  const { installerForGame } = require("../src/main/game-installer-manifest");
  const { installationPlatform } = require("../src/main/game-runtime/installation-platform");
  const { assertOwnerIntegrationReady } = require("../src/main/game-runtime/owner-integration-installation");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-ff-platforms-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (let n = 1; n <= 5; n++) {
    const id = `final-fantasy-${n}-pixel-remaster`, spec = definitions[id], installer = installerForGame(id);
    const xbox = installer.assets.filter(a => !a.platforms?.length || a.platforms.includes("xbox"));
    const steam = installer.assets.filter(a => !a.platforms?.length || a.platforms.includes("steam"));
    assert.equal(xbox.length, 1); assert.equal(xbox[0].id, "xbox-module");
    assert.equal(steam.length, 1); assert.equal(steam[0].id, "module");
    assert.notEqual(xbox[0].sha256, steam[0].sha256);
    const published = registry.assets.find(a => a.gameId === id && a.id === "xbox-module");
    assert.equal(xbox[0].sha256, published.sha256); assert.equal(xbox[0].size, published.size);
    assert.equal(xbox[0].url, "https://f003.backblazeb2.com/file/shenpulse-media/" + published.key);
    assert.equal(installer.xboxIdentity, `39EA002F.FF${n}DF`);
    assert.equal(installer.launchExecutables[0], "gamelaunchhelper.exe");
    assert.ok(Object.keys(spec.platformModules.xbox.moduleDependencies).some(p => p.endsWith("ShenPulse.FinalFantasy.Runtime.dll")));
    const target = path.join(root, String(n)); await fs.mkdir(target);
    await fs.writeFile(path.join(target, "gamelaunchhelper.exe"), "synthetic Xbox identity");
    assert.equal(await installationPlatform(target, installer), "xbox");
    // Synthetic hashes exercise the actual integrity gate without distributing game binaries in tests.
    const moduleBytes = Buffer.from("module " + n), supportBytes = Buffer.from("support " + n);
    const hash = b => createHash("sha256").update(b).digest("hex");
    definitions[id] = { ...spec, platformModules: { xbox: { module: "module.dll", moduleSha256: hash(moduleBytes), moduleDependencies: { "support.dll": hash(supportBytes) } } } };
    try {
      await fs.writeFile(path.join(target, "module.dll"), moduleBytes);
      await assert.rejects(assertOwnerIntegrationReady(id, target), /réparé/);
      await fs.writeFile(path.join(target, "support.dll"), supportBytes);
      await assertOwnerIntegrationReady(id, target);
      await fs.writeFile(path.join(target, "support.dll"), "altered");
      await assert.rejects(assertOwnerIntegrationReady(id, target), /réparé/);
    } finally { definitions[id] = spec; }
  }
});

test("un cadeau transmet le nom et la photo au jeu, avec reprise pendant le chargement de l’avatar", async t => {
  const { GameHub } = require("../src/main/game-hub"), net = require("node:net"), path = require("node:path");
  const { authenticatedFixtureStore } = require("./helpers/authenticated-store");
  const pack = structuredClone(OWNER_INTEGRATIONS.find(g => g.id === "final-fantasy-1-pixel-remaster"));
  // A synthetic Pro account exercises the gift transport without a real account or game process.
  pack.ownerOnly = false; pack.connector.port = 0; pack.connector.temporaryFailureRetryIntervalMs = 50;
  const state = { session: { activeGamePackId: pack.id }, commerce: { subscription: { tier: "pro", source: "subscription", status: "active" }, gameEntitlements: [] }, game: {}, rules: [] };
  const store = authenticatedFixtureStore({ getState: () => state, mutate: callback => callback(state) });
  const resourcesDirectory = path.resolve(__dirname, "../resources");
  const hub = new GameHub({ store, resourcesDirectory, packsDirectory: path.join(resourcesDirectory, "packs") }); hub.packs = [pack];
  const address = await hub.prepareConnection(pack.id), frames = [];
  const client = net.createConnection({ host: "127.0.0.1", port: address.port });
  t.after(async () => { client.destroy(); await hub.disconnectAll(); });
  await new Promise((resolve, reject) => { client.once("connect", resolve); client.once("error", reject); });
  let buffer = "";
  client.on("data", chunk => {
    buffer += chunk.toString(); let end;
    while ((end = buffer.indexOf("\0")) >= 0) {
      const frame = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1); frames.push(frame);
      client.write(JSON.stringify({ id: frame.id, status: frames.length === 1 ? 3 : 0 }) + "\0");
    }
  });
  const effect = pack.effects.find(e => e.code === "viewerbattle");
  await hub.trigger(effect.id, { source: "gift", user: { id: "synthetic-viewer", displayName: "Léa", avatarUrl: "https://example.com/lea.png" } }, { packId: pack.id });
  assert.equal(frames.length, 2);
  assert.equal(frames[1].code, "viewerbattle");
  assert.deepEqual(frames[1].viewers, [{ name: "Léa", avatar: "https://example.com/lea.png" }]);
});
