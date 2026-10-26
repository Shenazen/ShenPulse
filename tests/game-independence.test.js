"use strict";

const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), net = require("node:net");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { GAME_INSTALLERS } = require("../src/main/game-installer-manifest");
const { GameHub } = require("../src/main/game-hub");
const { authenticatedFixtureStore } = require("./helpers/authenticated-store");
const { downloadFixtureAsset, localAssetPath } = require("./helpers/installer-download-fixture");
const { extractArchiveSafe } = require("../src/main/game-runtime/archives");
const { safeInstallerAssetUrl } = require("../src/main/game-runtime/paths");
const { MODULES, stageStandaloneModule, configureStandaloneModule, assertStandaloneModuleReady } = require("../src/main/game-runtime/standalone-module-installation");
const { LocalEmulatorHostClient } = require("../src/main/pokemon-red-blue-runtime");
const { bizhawkPeer } = require("./helpers/bizhawk-peer");
const root = path.resolve(__dirname, ".."), catalog = () => loadShenazenGameCatalog(path.join(root, "resources"));

async function temporary(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-independent-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true })); return dir;
}

test("chaque jeu exécutable utilise un moteur ShenPulse identifié et un port dédié, sans client Slim téléchargé", () => {
  const ports = new Map();
  for (const pack of catalog()) {
    assert.notEqual(pack.connector.port, 51337, pack.id);
    assert.notEqual(pack.connector.port, 28380, pack.id);
    assert.notEqual(pack.connector.port, 5420, pack.id);
    assert.equal(pack.connector.closeCrowdControlOnConflict, undefined, pack.id);
    if (["tcp-server", "websocket-server"].includes(pack.connector.type)) {
      assert.ok(GAME_INSTALLERS[pack.id], pack.id);
      assert.equal(ports.has(pack.connector.port), false, `${pack.id} partage le port de ${ports.get(pack.connector.port)}`);
      ports.set(pack.connector.port, pack.id);
    }
    for (const asset of GAME_INSTALLERS[pack.id]?.assets || []) {
      assert.doesNotMatch(asset.fileName, /CrowdControl\.Client|Slim\.exe/i);
      assert.doesNotMatch(asset.url || "", /crowdcontrol\.live/i);
    }
  }
  for (const id of ["pokemon-red-blue", "super-mario-kart"]) {
    assert.equal(ports.has(MODULES[id].port), false); ports.set(MODULES[id].port, id);
  }
  for (const host of ["mods", "one-click"]) assert.throws(() => safeInstallerAssetUrl(`https://${host}.crowdcontrol.live/module.zip`), /non autorisé/);
});

test("les illustrations sans module autonome ne déclenchent pas une passerelle tierce et conservent leurs identifiants", async () => {
  const packs = catalog(), unresolved = packs.filter(p => p.guide.mode === "reference");
  assert.equal(unresolved.length, 15);
  const reference = unresolved[0];
  const state = { commerce: { subscription: { tier: "pro", status: "active", source: "subscription" } }, session: { activeGamePackId: reference.id }, game: { connectorOverrides: {}, interactionRulesByPack: {
    [reference.id]: [{ id: "custom", enabled: true, actions: [{ type: "game-effect", config: { effectId: reference.effects[0].id } }] }]
  } }, rules: [{ id: "kept" }] };
  const store = authenticatedFixtureStore({ getState: () => state, mutate: fn => fn(state) });
  const before = structuredClone(state);
  const hub = new GameHub({ store, packsDirectory: path.join(root, "resources/packs") }); hub.loadPacks();
  for (const pack of unresolved) {
    assert.equal(pack.connector.type, "demo"); assert.ok(pack.effects.every(e => !e.available));
    const effect = pack.effects[0];
    await assert.rejects(hub.trigger(effect.id, {}, { packId: pack.id }), /module autonome|référence visuelle/);
  }
  assert.deepEqual(state, before);
});

test("les anciens ports et types enregistrés ne détournent aucun module natif, sans fermeture d’un autre logiciel", async t => {
  const state = { commerce: { subscription: { tier: "pro", status: "active", source: "subscription" } }, session: {}, game: { connectorOverrides: {} }, rules: [] };
  const hub = new GameHub({ store: authenticatedFixtureStore({ getState: () => state, mutate: fn => fn(state) }), packsDirectory: path.join(root, "resources/packs"),
    crowdControlPortReleaser() { throw Error("Une application tierce ne doit jamais être fermée."); } });
  t.after(() => hub.disconnectAll()); hub.loadPacks();
  for (const pack of hub.packs.filter(p => !p.ownerOnly && ["tcp-server", "websocket-server"].includes(p.connector.type))) {
    state.game.connectorOverrides[pack.id] = { type: "demo", port: 51337, host: "192.0.2.1" };
    pack.connector.port = 0;
    const status = await hub.prepareConnection(pack.id);
    assert.equal(status.type, pack.connector.type); assert.equal(status.host, "127.0.0.1"); assert.equal(status.listening, true);
  }
});

test("Blue Prince, RE3 et Fallout préparent leurs archives réelles sur des ports distincts et refusent un module ancien ou altéré", async t => {
  const dir = await temporary(t);
  for (const id of ["blue-prince", "resident-evil-3", "fallout-4"]) {
    const asset = GAME_INSTALLERS[id].assets.find(a => a.id === "mod"), archive = path.join(dir, `${id}.zip`), stage = path.join(dir, id);
    await downloadFixtureAsset({ progress() {} }, id, asset, archive); await extractArchiveSafe(archive, path.join(stage, asset.targetPath || ""));
    await assert.rejects(assertStandaloneModuleReady(id, stage), /mis à jour/);
    const original = await fs.readFile(path.join(stage, MODULES[id].relative));
    const bad = Buffer.from(original); bad[100] ^= 1;
    assert.throws(() => configureStandaloneModule(bad, MODULES[id]), /pas reconnu/);
    await stageStandaloneModule({ gameId: id, deploymentRoot: stage }); await assertStandaloneModuleReady(id, stage);
    const configured = await fs.readFile(path.join(stage, MODULES[id].relative));
    for (const offset of MODULES[id].offsets || []) assert.equal(configured.readInt32LE(offset), MODULES[id].port);
    for (const edit of MODULES[id].strings || []) assert.equal(configured.subarray(edit.offset, edit.offset + edit.to.length).toString("ascii"), edit.to);
    assert.deepEqual(configureStandaloneModule(configured, MODULES[id]), configured);
  }
});

test("les 400 effets émulés se chargent dans le vrai hôte local sans Slim, avec réponse réelle et écriture mémoire", { skip: process.platform !== "win32" }, async t => {
  const dir = await temporary(t);
  for (const [id, name, expected, system] of [["pokemon-red-blue", "PokemonRedBlue", 313, "GB"], ["super-mario-kart", "SuperMarioKart", 87, "SNES"]]) {
    const installer = GAME_INSTALLERS[id], stage = path.join(dir, id);
    await extractArchiveSafe(await localAssetPath(installer.assets.find(a => a.id === "bridge")), stage);
    await fs.mkdir(path.join(stage, "Bridge/Packs"), { recursive: true });
    const asset = installer.assets.find(a => a.id === "pack"), file = path.join(stage, "Bridge/Packs", asset.fileName);
    await require("../scripts/lib/game-pack-cache").cachedGamePack(asset).then(source => fs.copyFile(source, file));
    await stageStandaloneModule({ gameId: id, deploymentRoot: stage });
    const installed = await fs.readdir(path.join(stage, "Bridge"));
    assert.ok(!installed.some(name => /CrowdControl\.(?:Client|Packs)\./i.test(name)));
    const client = new LocalEmulatorHostClient({ packId: name, gameLabel: name }); let peer;
    try {
      await client.ensureStarted(path.join(stage, "Bridge/ShenPulse.EmulatorHost.exe")); await client.loadPack(file);
      const info = (await client.call("packInfo")).value;
      assert.equal(info.effects.length, expected); assert.equal(info.offline, true);
      assert.deepEqual(new Set(info.effects), new Set(catalog().find(p => p.id === id).effects.map(e => e.code)));
      await client.call("loadConnector", ["Lua"]);
      await assert.rejects(client.call("effectRequest", [{ effect: { id: info.effects[0] } }]), /n’est pas connecté/);
      peer = await bizhawkPeer(MODULES[id].port, system);
      for (let i = 0; i < 50; i++) { if ((await client.call("packInfo")).value.connected) break; await new Promise(resolve => setTimeout(resolve, 100)); }
      assert.equal(client.connectionStatus, "open");
      const code = system === "SNES" ? "coinup" : "givemoney";
      assert.equal((await client.call("effectRequest", [{ effect: { id: code } }], 15000)).success, true);
      assert.ok(peer.writes.length > 0, "la réponse n’est pas un simple accusé de réception");
      if (system === "SNES") assert.equal(peer.memory.get(0xe00), 1);
      await assert.rejects(client.call("effectRequest", [{ effect: { id: "unknown" } }]), /inconnue/);
    } finally { peer?.socket.destroy(); await client.stop(); }
  }
});
