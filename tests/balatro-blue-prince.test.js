"use strict";
const { localAssetPath } = require("./helpers/installer-download-fixture");

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomBytes, createHash } = require("node:crypto");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { installerForGame } = require("../src/main/game-installer-manifest");
const { detectBalatroEdition, stageBalatroInstallation, INJECTION } = require("../src/main/game-runtime/balatro-installation");
const { extractArchiveSafe } = require("../src/main/game-runtime/archives");
const { BalatroGamePassBridge } = require("../src/main/balatro-gamepass-bridge");
const { safeInstallerAssetUrl } = require("../src/main/game-runtime/paths");
const root = path.resolve(__dirname, "..");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test("les deux fiches proposent l’installation, l’overlay des cadeaux et le lancement depuis ShenPulse", async () => {
  const vm = require("node:vm");
  const { JSDOM } = require("jsdom");
  const source = await fs.readFile(path.join(root, "src/renderer/app/features/games/overlay-cards.js"), "utf8");
  const bootstrap = await fs.readFile(path.join(root, "src/renderer/app/core/bootstrap.js"), "utf8");
  const context = vm.createContext({
    snapshot: { state: { game: { installations: {} }, settings: {} } },
    MANAGED_BIZHAWK_GAME_IDS: new Set(), CONFIGURABLE_INTEGRATED_GAMES: new Set(),
    MINECRAFT_MODE_IDS: [], MINECRAFT_ROUND_MODE_IDS: [], gameInstallBusyId: "", gameLaunchBusyId: "",
    escapeHtml: value => String(value ?? ""), renderGamePageMessage: () => "", activeGameSession: () => null,
    formatAdminDate: () => "21/10/2026", gameMappedEffects: () => [], overlayProfileName: () => "Profil test"
  });
  for (const name of ["AUTOMATED_GAME_INSTALLERS", "GAME_OVERLAY_GENERATOR_ONLY_IDS"]) {
    vm.runInContext(bootstrap.match(new RegExp(`const ${name} = new Set\\(\\[[\\s\\S]*?\\]\\);`))[0], context);
  }
  vm.runInContext(source, context);
  vm.runInContext(bootstrap.match(/const GTA_INTERACTION_OVERLAY_BACKGROUNDS = \[[\s\S]*?\];/)[0], context);
  const catalog = loadShenazenGameCatalog(path.join(root, "resources"));
  for (const id of ["balatro", "blue-prince"]) {
    const pack = catalog.find(pack => pack.id === id);
    let page = JSDOM.fragment(context.renderGameInstallation(pack, true));
    assert.equal(page.querySelector('[data-action="install-game"]').dataset.id, id);
    assert.match(page.textContent, /Installer automatiquement/);
    context.snapshot.state.game.installations[id] = { installerVersion: "1.0.0", installedAt: new Date().toISOString() };
    page = JSDOM.fragment(context.renderGameLaunch(pack, true));
    assert.equal(page.querySelector('[data-action="launch-game"]').dataset.id, id);
    page = JSDOM.fragment(context.renderGameOverlays(pack, true));
    assert.equal(page.querySelectorAll('[data-action="download-game-interaction-overlay"]').length, 2);
    assert.ok([...page.querySelectorAll('[data-action="download-game-interaction-overlay"]')].every(button => button.disabled));
    assert.equal(page.querySelector('[data-value="launch"]').disabled, false);
    assert.match(page.textContent, new RegExp(pack.name));
    assert.match(page.textContent, /Activez au moins une interaction/);
  }
});

test("le hub garde les règles personnalisées et transmet Balatro Game Pass par son canal GDK", async t => {
  const { GameHub } = require("../src/main/game-hub");
  const { authenticatedFixtureStore } = require("./helpers/authenticated-store");
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-balatro-hub-"));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const directory = path.join(temporary, "Assets/shenpulse/channel");
  await fs.mkdir(directory, { recursive: true });
  const token = randomBytes(32).toString("hex");
  await fs.writeFile(path.join(directory, "config.json"), JSON.stringify({ token }));
  await fs.writeFile(path.join(directory, "ready.json"), JSON.stringify({ token, at: Date.now() / 1000, ready: true }));
  const state = {
    profiles: [{ id: "profile" }], session: { profileId: "profile", activeGamePackId: "balatro" },
    commerce: { subscription: { tier: "pro", status: "active", source: "subscription" }, gameEntitlements: [] },
    game: { recentPacks: [], connectorOverrides: {}, interactionRulesByPack: {}, interactionCatalogVersions: {}, installations: { balatro: { path: temporary, edition: "gamepass" } } }, rules: []
  };
  const store = authenticatedFixtureStore({ getState: () => state, mutate: fn => fn(state) });
  const hub = new GameHub({ store, resourcesDirectory: path.join(root, "resources"), packsDirectory: path.join(root, "resources/packs") });
  hub.loadPacks(); t.after(() => hub.disconnectAll());
  assert.equal(hub.initializeDefaultInteractions("balatro").added, 12);
  const custom = state.game.interactionRulesByPack.balatro[0];
  custom.title = "Mon cadeau personnalisé";
  assert.equal(hub.initializeDefaultInteractions("balatro").added, 0);
  assert.equal(state.game.interactionRulesByPack.balatro[0].title, "Mon cadeau personnalisé");
  assert.equal((await hub.prepareConnection("balatro")).connected, true);
  const timer = setInterval(async () => {
    try {
      const request = JSON.parse(await fs.readFile(path.join(directory, "request.json")));
      assert.equal(request.code, "addMoney_5");
      await fs.writeFile(path.join(directory, "response.json"), JSON.stringify({ id: request.id, token, status: 0 }));
    } catch { /* Le message n’est pas encore écrit. */ }
  }, 15);
  t.after(() => clearInterval(timer));
  const effect = hub.listPacks().find(pack => pack.id === "balatro").effects.find(effect => effect.code === "addMoney_5");
  assert.equal((await hub.trigger(effect.id, { source: "test" }, { packId: "balatro" })).status, "success");
  await assert.rejects(hub.trigger("blue-prince-native-26-force-kick", { source: "test" }, { packId: "blue-prince" }), /module officiel/);
  state.commerce.subscription = { tier: "free", status: "inactive" };
  await assert.rejects(hub.trigger(effect.id, { source: "test" }, { packId: "balatro" }));
});

test("une réparation attend la fermeture du jeu sans interrompre sa partie", async () => {
  const { assertModGameClosed } = require("../src/main/game-runtime/mod-installation-ready");
  const calls = [];
  const execute = async (...args) => { calls.push(args); return "12345\r\n"; };
  for (const id of ["balatro", "blue-prince"]) {
    await assert.rejects(assertModGameClosed(id, "C:/XboxGames/Test/Content", { platform: "win32", execute }), /Fermez/);
  }
  assert.equal(calls.length, 2);
  assert.ok(calls.every(([, args]) => !args.join(" ").includes("Stop-Process")));
  await assertModGameClosed("balatro", "C:/XboxGames/Test/Content", { platform: "win32", execute: async () => "" });
  await assertModGameClosed("another-game", "C:/Games", { platform: "win32", execute });
  assert.equal(calls.length, 2);
});

test("Balatro et Blue Prince exposent leurs catalogues complets et le parcours installation/overlays/lancement", () => {
  const catalog = loadShenazenGameCatalog(path.join(root, "resources"));
  for (const [id, count] of [["balatro", 125], ["blue-prince", 76]]) {
    const pack = catalog.find(pack => pack.id === id);
    assert.equal(catalog.filter(pack => pack.id === id).length, 1);
    assert.equal(pack.effects.length, count);
    assert.equal(new Set(pack.effects.map(effect => effect.code)).size, count);
    assert.ok(pack.effects.every(effect => effect.service === "native" && effect.name && effect.description));
    assert.equal(pack.effects.filter(effect => effect.available).length, id === "balatro" ? 125 : 75);
    assert.equal(pack.defaultMappings.length, 12);
    assert.ok(pack.defaultMappings.every(mapping => mapping.triggerEnabled), "les douze cadeaux du pack sont configurés");
    assert.deepEqual(pack.guide.journey, ["installation", "interactions", "overlays", "launch"]);
    assert.equal(pack.installerVersion, installerForGame(id).version);
  }
  const blue = catalog.find(pack => pack.id === "blue-prince");
  assert.equal(blue.effects.filter(effect => effect.id.startsWith("blue-prince-native-")).length, 69);
  assert.ok(blue.effects.some(effect => effect.code === "draft_Chamber-of-Mirrors"));
  assert.ok(blue.effects.some(effect => effect.code === "item_watering can"));
  assert.equal(blue.effects.find(effect => effect.code === "fastmove").duration, 30);
  assert.equal(blue.effects.find(effect => effect.code === "force_kick").available, false);
  assert.equal(blue.defaultMappings.some(mapping => mapping.effectId === "blue-prince-native-26-force-kick"), false);
  const balatro = catalog.find(pack => pack.id === "balatro");
  assert.notEqual(balatro.effects.find(effect => effect.code === "addMoney_5").id, balatro.effects.find(effect => effect.code === "addMoney_-5").id);
});

test("les fichiers d’installation sont versionnés et limités aux origines officielles", async () => {
  for (const id of ["balatro", "blue-prince"]) {
    const manifest = installerForGame(id);
    assert.ok(manifest.autoDetect && manifest.unattended && manifest.xboxIdentity);
    assert.ok(manifest.launchExecutables.includes("gamelaunchhelper.exe"));
    for (const asset of manifest.assets) {
      assert.match(asset.sha256, /^[a-f0-9]{64}$/);
      assert.ok(asset.size > 0);
      if (asset.url) assert.equal(safeInstallerAssetUrl(asset.url), asset.url);
      if (asset.id === "module") {
        const bytes = await fs.readFile(await localAssetPath(asset));
        assert.equal(bytes.length, asset.size);
        assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
      }
    }
  }
  assert.throws(() => safeInstallerAssetUrl("https://github.com/untrusted/project/releases/download/latest/test.zip"));
});

test("l’adaptateur GDK conserve le moteur, les sauvegardes et une injection unique lors d’une réparation", async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-balatro-stage-"));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const target = path.join(temporary, "game"), stage = path.join(temporary, "stage");
  await fs.mkdir(path.join(target, "Assets"), { recursive: true });
  const original = 'require "game"\nfunction love.run() end\n';
  await fs.writeFile(path.join(target, "Assets/main.lua"), original);
  await fs.writeFile(path.join(target, "MicrosoftGame.Config"), '<Game><Identity Name="PlayStack.Balatro" /></Game>');
  await fs.writeFile(path.join(target, "love.exe"), "original GDK engine");
  assert.equal(await detectBalatroEdition(target), "gamepass");
  const asset = installerForGame("balatro").assets[0];
  for (let attempt = 0; attempt < 2; attempt++) {
    await extractArchiveSafe(await localAssetPath(asset), stage);
    await stageBalatroInstallation({ targetPath: target, deploymentRoot: stage, edition: "gamepass" });
    const main = await fs.readFile(path.join(stage, "Assets/main.lua"), "utf8");
    assert.equal(main, original + INJECTION);
    assert.equal(await fs.readFile(path.join(target, "love.exe"), "utf8"), "original GDK engine");
    await fs.copyFile(path.join(stage, "Assets/main.lua"), path.join(target, "Assets/main.lua"));
    assert.equal(await fs.stat(path.join(stage, ".shenpulse-balatro-mods")).catch(() => null), null);
    const config = JSON.parse(await fs.readFile(path.join(stage, "Assets/shenpulse/channel/config.json")));
    assert.match(config.token, /^[a-f0-9]{64}$/);
    assert.equal(config.codes.length, 125);
  }
});

test("le canal Game Pass corrèle les réponses, sérialise les cadeaux et refuse un état ancien", async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-balatro-channel-"));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const directory = path.join(temporary, "Assets/shenpulse/channel");
  await fs.mkdir(directory, { recursive: true });
  const token = randomBytes(32).toString("hex");
  await fs.writeFile(path.join(directory, "config.json"), JSON.stringify({ token }));
  await fs.writeFile(path.join(directory, "ready.json"), JSON.stringify({ token, at: Date.now() / 1000, ready: true }));
  const bridge = new BalatroGamePassBridge({ installationPath: temporary, timeoutMs: 1500 });
  t.after(() => bridge.close());
  await bridge.start();
  assert.equal(bridge.status().connected, true);
  const seen = new Set(), received = [];
  const timer = setInterval(async () => {
    let request;
    try { request = JSON.parse(await fs.readFile(path.join(directory, "request.json"))); } catch { return; }
    if (seen.has(request.id)) return;
    seen.add(request.id); received.push(request.code);
    await fs.writeFile(path.join(directory, "response.json"), JSON.stringify({ id: request.id, token, status: request.code === "unknown" ? 2 : 0 }));
  }, 15);
  t.after(() => clearInterval(timer));
  await fs.writeFile(path.join(directory, "response.json"), JSON.stringify({ id: "old", token, status: 0 }));
  const result = await Promise.all([bridge.send("addMoney_5"), bridge.send("addHands_1")]);
  assert.deepEqual(received, ["addMoney_5", "addHands_1"]);
  assert.ok(result.every(response => response.status === "success"));
  await assert.rejects(bridge.send("unknown"), error => error.status === 2);
  await fs.writeFile(path.join(directory, "ready.json"), JSON.stringify({ token, at: Date.now() / 1000 - 60 }));
  assert.equal(bridge.status().connected, false);
  await assert.rejects(bridge.send("addMoney_5"), /pas connecté/);
  await sleep(30);
});
