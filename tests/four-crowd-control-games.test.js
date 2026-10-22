"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const vm = require("node:vm");
const { once } = require("node:events");
const { createHash } = require("node:crypto");
const { JSDOM } = require("jsdom");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { installerForGame } = require("../src/main/game-installer-manifest");
const { GameHub } = require("../src/main/game-hub");
const { authenticatedFixtureStore } = require("./helpers/authenticated-store");
const { WindowsInputService, normalizeWindowsInputSequence } = require("../src/main/windows-input-service");
const { FALLOUT_DLC, NATIVE_MODULES, dedicateModulePort, validateFourGamesTarget, stageFourGamesInstallation } = require("../src/main/game-runtime/four-games-installation");
const { validateTarget } = require("../src/main/game-runtime/target-selection");
const { registeredXboxInstallCandidates } = require("../src/main/game-runtime/discovery");
const { safeInstallerAssetUrl } = require("../src/main/game-runtime/paths");
const root = path.resolve(__dirname, "..");
const ids = ["dead-by-daylight", "dredge", "egging-on", "fallout-4"];
const packs = loadShenazenGameCatalog(path.join(root, "resources")).filter(p => ids.includes(p.id));

function fixture() {
  const state = {
    session: { activeGamePackId: "dredge", profileId: "test" },
    commerce: { subscription: { tier: "pro", status: "active", source: "subscription" }, gameEntitlements: [] },
    game: { installations: {}, connectorOverrides: {}, recentPacks: [], interactionCatalogVersions: {}, interactionRulesByPack: {} }, rules: []
  };
  const store = authenticatedFixtureStore({ getState: () => state, mutate: fn => fn(state) });
  return { state, store };
}

async function directory(t) {
  const p = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-four-games-"));
  t.after(() => fs.rm(p, { recursive: true, force: true }));
  return p;
}

test("les quatre catalogues ont leurs interactions, images, durées et parcours, sans cadeau imposé", async () => {
  for (const pack of packs) {
    assert.equal(pack.effects.length, { "dead-by-daylight": 20, dredge: 113, "egging-on": 37, "fallout-4": 298 }[pack.id]);
    assert.equal(new Set(pack.effects.map(e => e.id)).size, pack.effects.length);
    assert.equal(new Set(pack.effects.map(e => e.code)).size, pack.effects.length);
    assert.equal(pack.installerVersion, installerForGame(pack.id).version);
    assert.deepEqual(pack.guide.journey, ["installation", "interactions", "overlays", "launch"]);
    assert.ok(pack.defaultMappings.every(m => !m.triggerEnabled));
    for (const effect of pack.effects) {
      assert.ok(effect.name && effect.description && effect.category);
      assert.equal(effect.service, "native");
      await fs.access(path.resolve(root, "src/renderer", effect.image));
    }
    for (const asset of installerForGame(pack.id).assets) {
      assert.equal(safeInstallerAssetUrl(asset.url), asset.url);
      if (asset.id === "managed-bootstrap") {
        const bytes = await fs.readFile(await require("./helpers/installer-download-fixture").localAssetPath(asset));
        assert.equal(bytes.length, asset.size);
        assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
      }
      assert.match(asset.sha256, /^[a-f0-9]{64}$/);
      assert.ok(asset.size > 0);
    }
  }
  const dredge = packs.find(p => p.id === "dredge");
  assert.equal(dredge.effects.find(e => e.code === "despawn").available, false);
  assert.equal(dredge.effects.find(e => e.id.endsWith("money100")).code, "give100");
  assert.equal(dredge.effects.find(e => e.id.endsWith("item-research-item")).code, "item_research-item");
  for (const [id, count] of [["dredge", 53], ["egging-on", 37]]) {
    const files = (await fs.readdir(path.join(root, "resources/game-interactions", id))).filter(f => /-native-\d+-/.test(f));
    assert.equal(files.length, count);
    const effects = packs.find(p => p.id === id).effects;
    assert.ok(files.every(file => effects.some(e => e.id === file.replace(/\.webp$/, ""))));
  }
});

test("les 20 commandes DBD relâchent leurs touches, adaptent ZQSD et ciblent seulement le jeu préparé", async t => {
  const { state, store } = fixture();
  const target = await directory(t);
  const exe = path.join(target, "DeadByDaylight/Binaries/WinGDK/DeadByDaylight-WinGDK-Shipping.exe");
  await fs.mkdir(path.dirname(exe), { recursive: true }); await fs.writeFile(exe, "fixture");
  state.game.installations["dead-by-daylight"] = { path: target };
  state.game.connectorOverrides["dead-by-daylight"] = { processName: "notepad.exe", type: "demo", keyLayout: "azerty" };
  const calls = [];
  const input = new WindowsInputService({ execute: async (...args) => { calls.push(args); return { ok: true }; } });
  const hub = new GameHub({ store, resourcesDirectory: path.join(root, "resources"), packsDirectory: path.join(root, "resources/packs"), windowsInputService: input });
  hub.loadPacks();
  const pack = packs.find(p => p.id === "dead-by-daylight");
  for (const effect of pack.effects) {
    const held = new Set();
    for (const event of normalizeWindowsInputSequence(effect.inputSequence)) {
      const key = `${event.kind}/${event.keyCode ?? event.button}`;
      if (event.action === "down") held.add(key);
      if (event.action === "up") held.delete(key);
    }
    assert.equal(held.size, 0, effect.code);
    assert.equal((await hub.trigger(effect.id, { source: "test" }, { packId: pack.id })).status, "success");
  }
  assert.equal(calls.length, 20);
  assert.ok(calls.every(([, processName]) => processName === "DeadByDaylight-WinGDK-Shipping"));
  assert.equal(calls[0][2][0].keyCode, 90);
  assert.equal(calls.find(([, , events]) => events.some(e => e.keyCode === 49))?.[3], "scan-code");
  state.game.connectorOverrides[pack.id].keyLayout = "zsqd";
  await hub.trigger(pack.effects.find(e => e.code === "dbd_dbd_drunk_walk").id, {}, { packId: pack.id });
  assert.deepEqual(calls.at(-1)[2].filter(e => e.kind === "keyboard" && e.action === "down").map(e => e.keyCode), [90, 83, 68, 81, 68, 83]);
  state.game.connectorOverrides[pack.id].gestureKeys = "letters";
  for (const [code, keys] of [["dbd_dbd_point", [80, 80]], ["dbd_dbd_come_here", [79, 79]], ["dbd_dbd_gesture_spam", [80, 80, 79, 79, 80, 80, 79, 79, 80, 80, 79, 79]]]) {
    const effect = pack.effects.find(e => e.code === code);
    const original = effect.inputSequence;
    await hub.trigger(effect.id, {}, { packId: pack.id });
    assert.deepEqual(calls.at(-1)[2].map(e => e.keyCode), keys);
    assert.equal(calls.at(-1)[3], "virtual-key");
    assert.equal(effect.inputSequence, original);
  }
  await fs.unlink(exe);
  await hub.testConnection(pack.id);
  assert.equal(calls.at(-1)[1], "DeadByDaylight-Win64-Shipping");
  state.commerce.subscription = { tier: "free", status: "inactive" };
  await assert.rejects(hub.trigger(pack.effects[0].id, {}, { packId: pack.id }));
  assert.equal(calls.length, 25);
});

test("le hub conserve les associations personnalisées des quatre jeux en enrichissant leurs catalogues", () => {
  const { state, store } = fixture();
  const hub = new GameHub({ store, resourcesDirectory: path.join(root, "resources"), packsDirectory: path.join(root, "resources/packs") });
  hub.loadPacks();
  for (const pack of packs) {
    hub.initializeDefaultInteractions(pack.id);
    const custom = state.game.interactionRulesByPack[pack.id][0];
    Object.assign(custom, { title: "Mon cadeau", actionId: "action-existante", threshold: 42, enabled: false });
    const before = structuredClone(custom);
    assert.equal(hub.initializeDefaultInteractions(pack.id).added, 0);
    assert.deepEqual(state.game.interactionRulesByPack[pack.id][0], before);
  }
});

test("les trois modules transmettent leurs codes exacts et les millisecondes sur des connexions séparées", async t => {
  const { state, store } = fixture();
  const hub = new GameHub({ store, resourcesDirectory: path.join(root, "resources"), packsDirectory: path.join(root, "resources/packs") });
  hub.loadPacks();
  t.after(() => hub.disconnectAll());
  const peers = [];
  t.after(() => peers.forEach(p => p.destroy()));
  for (const id of ["dredge", "egging-on", "fallout-4"]) {
    state.game.connectorOverrides[id] = { port: 0 };
    hub.packs.find(pack => pack.id === id).connector.port = 0;
    const address = await hub.prepareConnection(id);
    const peer = net.connect(address.port, "127.0.0.1"); peers.push(peer);
    await once(peer, "connect");
    let buffer = ""; const received = [];
    peer.on("data", data => {
      buffer += data.toString();
      let split;
      while ((split = buffer.indexOf("\0")) >= 0) {
        const request = JSON.parse(buffer.slice(0, split)); buffer = buffer.slice(split + 1); received.push(request);
        peer.write(JSON.stringify({ id: request.id, type: 0, status: 0 }) + "\0");
      }
    });
    const pack = packs.find(p => p.id === id);
    for (const effect of pack.effects.filter(e => e.available)) {
      const result = await hub.trigger(effect.id, { source: "test" }, { packId: id, duration: effect.duration ? 7 : 0 });
      assert.equal(result.ok, true);
      assert.equal(received.at(-1).code, effect.code);
      assert.equal(received.at(-1).duration, effect.duration ? 7000 : 0);
    }
    assert.equal(received.length, pack.effects.filter(e => e.available).length);
  }
  const defaults = loadShenazenGameCatalog(path.join(root, "resources"));
  const ports = ["blue-prince", "dredge", "egging-on", "fallout-4"].map(id => defaults.find(p => p.id === id).connector.port);
  assert.equal(new Set(ports).size, ports.length);
});

test("Fallout Game Pass, DLC manquants, ancien F4SE et version incorrecte sont refusés avant copie", async t => {
  const target = await directory(t), manifest = installerForGame("fallout-4");
  await fs.writeFile(path.join(target, "Fallout4.exe"), "fixture");
  await fs.writeFile(path.join(target, "MicrosoftGame.config"), "game pass");
  await assert.rejects(validateTarget({}, target, manifest), /Game Pass.*compatible/);
  assert.deepEqual((await fs.readdir(target)).sort(), ["Fallout4.exe", "MicrosoftGame.config"]);
  await fs.unlink(path.join(target, "MicrosoftGame.config"));
  await assert.rejects(validateFourGamesTarget(target, manifest), /six DLC/);
  await fs.mkdir(path.join(target, "Data"));
  for (const name of FALLOUT_DLC) await fs.writeFile(path.join(target, "Data", name), "fixture");
  await assert.rejects(validateFourGamesTarget(target, manifest), /F4SE 0.7.9/);
  for (const name of ["steam_api64.dll", "f4se_loader.exe", "f4se_1_11_240.dll"]) await fs.writeFile(path.join(target, name), "fixture");
  await assert.rejects(validateFourGamesTarget(target, manifest, { platform: "win32", execute: async () => "1.10.984.0" }), /1.11.240/);
  await validateFourGamesTarget(target, manifest, { platform: "win32", execute: async () => "1.11.240.0" });
  assert.equal(manifest.requireLaunchExecutable, true);
  assert.deepEqual(manifest.launchExecutables, ["f4se_loader.exe"]);
});

test("les fichiers préparés gardent les préférences MelonLoader et placent ccver à la racine Fallout", async t => {
  const target = await directory(t), stage = await directory(t);
  await fs.mkdir(path.join(stage, "Data")); await fs.writeFile(path.join(stage, "Data/ccver"), "version");
  await stageFourGamesInstallation({ gameId: "fallout-4", targetPath: target, deploymentRoot: stage });
  assert.equal(await fs.readFile(path.join(stage, "ccver"), "utf8"), "version");
  await assert.rejects(fs.access(path.join(stage, "Data/ccver")));
  const bytes = Buffer.alloc(30); bytes[4] = 0x20; bytes.writeInt32LE(51337, 5);
  const patched = Buffer.from(bytes); patched.writeInt32LE(58438, 5);
  const hash = v => createHash("sha256").update(v).digest("hex");
  const spec = { offset: 5, port: 58438, original: hash(bytes), patched: hash(patched) };
  assert.deepEqual(dedicateModulePort(bytes, spec), patched);
  assert.equal(bytes.readInt32LE(5), 51337);
  assert.throws(() => dedicateModulePort(Buffer.alloc(30), spec), /version du module/);
  assert.equal(NATIVE_MODULES.dredge.port, packs.find(p => p.id === "dredge").connector.port);
  assert.equal(NATIVE_MODULES["egging-on"].port, packs.find(p => p.id === "egging-on").connector.port);
});

test("la détection Xbox résout les packages à nom technique sans modifier WindowsApps", async t => {
  const target = await directory(t), calls = [];
  assert.deepEqual(await registeredXboxInstallCandidates({ xboxIdentity: "AlibiGames.EggingOn" }, {
    platform: "win32", execute: async (...args) => { calls.push(args); return target + "\r\n"; }
  }), [await fs.realpath(target)]);
  assert.equal(calls.length, 1);
  assert.match(calls[0][1].at(-1), /Get-AppxPackage -Name 'AlibiGames.EggingOn'/);
  assert.deepEqual(await registeredXboxInstallCandidates({ xboxIdentity: "'; bad" }, { platform: "win32", execute: () => assert.fail() }), []);
});

test("les quatre fiches offrent installation, associations, deux overlays et démarrage", async () => {
  const bootstrap = await fs.readFile(path.join(root, "src/renderer/app/core/bootstrap.js"), "utf8");
  const context = vm.createContext({
    snapshot: { state: { game: { installations: {} }, settings: {} } },
    MANAGED_BIZHAWK_GAME_IDS: new Set(), CONFIGURABLE_INTEGRATED_GAMES: new Set(), MINECRAFT_MODE_IDS: [], MINECRAFT_ROUND_MODE_IDS: [],
    gameInstallBusyId: "", gameLaunchBusyId: "", escapeHtml: v => String(v ?? ""), renderGamePageMessage: () => "", activeGameSession: () => null,
    gameMappedEffects: () => [], overlayProfileName: () => "Test", visibilityTools: { gameScopeFor: () => "public" }, siteVisibility: {}
  });
  for (const name of ["AUTOMATED_GAME_INSTALLERS", "GAME_OVERLAY_GENERATOR_ONLY_IDS"]) vm.runInContext(bootstrap.match(new RegExp(`const ${name} = new Set\\(\\[[\\s\\S]*?\\]\\);`))[0], context);
  vm.runInContext(await fs.readFile(path.join(root, "src/renderer/app/features/games/overlay-cards.js"), "utf8"), context);
  vm.runInContext(bootstrap.match(/const GTA_INTERACTION_OVERLAY_BACKGROUNDS = \[[\s\S]*?\];/)[0], context);
  for (const pack of packs) {
    let page = JSDOM.fragment(context.renderGameInstallation(pack, true));
    assert.equal(page.querySelector('[data-action="install-game"]').disabled, false);
    if (pack.id === "dead-by-daylight") {
      assert.equal(page.querySelector('[data-game-gesture-keys]').value, "numbers");
      context.snapshot.state.game.connectorOverrides = { [pack.id]: { gestureKeys: "letters", keyLayout: "zsqd" } };
      page = JSDOM.fragment(context.renderGameInstallation(pack, true));
      assert.equal(page.querySelector('[data-game-gesture-keys]').value, "letters");
      assert.equal(page.querySelector('[data-game-key-layout]').value, "zsqd");
      assert.match(page.textContent, /Désigner.*P.*Venez ici.*O/);
    } else assert.equal(page.querySelector('[data-game-gesture-keys]'), null);
    context.snapshot.state.game.installations[pack.id] = { installerVersion: "1.0.0", assetCount: installerForGame(pack.id).assets.length, satisfiedAssetIds: installerForGame(pack.id).assets.map(a => a.id) };
    page = JSDOM.fragment(context.renderGameLaunch(pack, true));
    assert.equal(page.querySelector('[data-action="launch-game"]').disabled, false);
    page = JSDOM.fragment(context.renderGameOverlays(pack, true));
    assert.equal(page.querySelectorAll('[data-action="download-game-interaction-overlay"]').length, 2);
  }
});
