"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { JSDOM } = require("jsdom");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { installerForGame } = require("../src/main/game-installer-manifest");
const { normalizeWindowsInputSequence, WindowsInputService } = require("../src/main/windows-input-service");
const { GameHub } = require("../src/main/game-hub");
const { authenticatedFixtureStore } = require("./helpers/authenticated-store");
const root = path.resolve(__dirname, "..");
const gameId = "ark-survival-ascended";
const manifest = installerForGame(gameId);
const pack = loadShenazenGameCatalog(path.join(root, "resources")).find(item => item.id === gameId);

function fixture() {
  const state = {
    session: { profileId: "profile", activeGamePackId: gameId },
    commerce: { subscription: { tier: "pro", status: "active", source: "subscription" }, gameEntitlements: [] },
    game: { installations: {}, connectorOverrides: {}, recentPacks: [], interactionCatalogVersions: {}, interactionRulesByPack: {} },
    rules: []
  };
  return { state, store: authenticatedFixtureStore({ getState: () => state, mutate: fn => fn(state) }) };
}

test("ARK expose les 29 séquences officielles avec un libellé court et douze cadeaux par défaut", async () => {
  const source = require("../resources/catalogs/ark-survival-ascended-effects.json");
  assert.equal(pack.effects.length, 29);
  assert.equal(new Set(pack.effects.map(effect => effect.id)).size, 29);
  assert.deepEqual(pack.effects.map(effect => effect.code), Object.keys(source));
  for (const effect of pack.effects) {
    assert.equal(effect.available, true);
    assert.equal(effect.inputSequence, source[effect.code].action.sequence.events);
    assert.ok(effect.name && effect.description && effect.category);
    await fs.access(path.resolve(root, "src/renderer", effect.image));
    const held = new Set();
    for (const event of normalizeWindowsInputSequence(effect.inputSequence)) {
      const key = `${event.kind}/${event.keyCode ?? event.button}`;
      if (event.action === "down") held.add(key);
      if (event.action === "up") held.delete(key);
    }
    assert.equal(held.size, 0, `${effect.code} doit relâcher ses touches et boutons`);
  }
  assert.equal(pack.defaultMappings.length, 12);
  assert.ok(pack.defaultMappings.every(mapping => mapping.enabled && mapping.triggerEnabled));
  assert.equal(pack.effects.find(effect => effect.code === "ark_hotbar_roulette").keyboardInputMode, "scan-code");
  assert.deepEqual(pack.guide.journey, ["installation", "interactions", "overlays", "launch"]);
  assert.equal(pack.installerVersion, manifest.version);
});

test("le hub ARK conserve les associations et refuse la redirection du processus ou la perte d’accès", async () => {
  const { state, store } = fixture();
  state.game.connectorOverrides[gameId] = { type: "demo", processName: "AnotherGame.exe", keyLayout: "azerty" };
  const calls = [];
  const input = new WindowsInputService({ execute: async (...args) => { calls.push(args); return { ok: true }; } });
  const hub = new GameHub({ store, resourcesDirectory: path.join(root, "resources"), packsDirectory: path.join(root, "resources/packs"), windowsInputService: input });
  hub.loadPacks();
  assert.equal(hub.initializeDefaultInteractions(gameId).added, 12);
  const custom = state.game.interactionRulesByPack[gameId][0];
  custom.title = "Mon cadeau ARK";
  assert.equal(hub.initializeDefaultInteractions(gameId).added, 0);
  assert.equal(state.game.interactionRulesByPack[gameId][0].title, "Mon cadeau ARK");
  await hub.testConnection(gameId);
  for (const effect of pack.effects) {
    assert.equal((await hub.trigger(effect.id, { source: "test" }, { packId: gameId })).status, "success");
  }
  assert.equal(calls.length, 30);
  assert.ok(calls.every(([, processName]) => processName === "ArkAscended"));
  assert.equal(calls[1][2][0].keyCode, 90, "l’avance ZQSD est adaptée");
  assert.equal(calls.find(([, , events]) => events[0]?.keyCode === 49)?.[3], "scan-code");
  state.commerce.subscription = { tier: "free", status: "inactive" };
  await assert.rejects(hub.trigger("ark-jump", {}, { packId: gameId }));
  assert.equal(calls.length, 30);
});

test("la préparation ARK ne déploie aucun fichier et valide les exécutables imbriqués Game Pass", async t => {
  const { installGame } = require("../src/main/game-runtime/installation");
  const { validateTarget } = require("../src/main/game-runtime/target-selection");
  const { findLaunchTarget } = require("../src/main/game-runtime/paths");
  const target = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-ark-install-"));
  t.after(() => fs.rm(target, { recursive: true, force: true }));
  const executable = path.join(target, "ShooterGame/Binaries/WinGDK/ArkAscended.exe");
  await fs.mkdir(path.dirname(executable), { recursive: true });
  await fs.writeFile(executable, "fixture");
  await fs.writeFile(path.join(target, "gamelaunchhelper.exe"), "fixture launcher");
  const { state, store } = fixture();
  const before = await fs.readdir(target, { recursive: true });
  const progress = [];
  const runtime = {
    store, assertAccess() {}, createAccessGuard: () => () => {}, activeInstalls: new Set(), installProgress: new Map(),
    progress(id, update) { progress.push(update); this.installProgress.set(id, update); }, pickTarget: async () => target,
    validateTarget: (directory, entry) => validateTarget({}, directory, entry)
  };
  const result = await installGame(runtime, gameId);
  assert.equal(result.setupOnly, true);
  assert.equal(state.game.installations[gameId].source, "local-setup");
  assert.equal(state.game.installations[gameId].assetCount, 0);
  assert.deepEqual(await fs.readdir(target, { recursive: true }), before);
  assert.equal(await findLaunchTarget(target, manifest.launchExecutables), path.join(target, "gamelaunchhelper.exe"));
  assert.equal(progress.at(-1).percent, 100);
  assert.equal(manifest.xboxIdentity, "StudioWildcard.ARKSurvivalAscended");
  assert.ok(manifest.xboxDirectoryNames.includes("ARK- Survival Ascended"));
  assert.equal(manifest.launchExecutables.some(name => name.includes("WinGDK/ArkAscended")), false, "l’édition GDK doit conserver son identité Xbox via le lanceur natif");
});

test("le lancement ARK ouvre le lanceur Xbox, attend la fenêtre et refuse un lanceur absent", async t => {
  const filename = path.join(root, "src/main/game-runtime.js");
  const originalRequire = createRequire(filename);
  const calls = [];
  const loaded = { exports: {} };
  const context = vm.createContext({ module: loaded, exports: loaded.exports, __dirname: path.dirname(filename), process, Buffer, console, setTimeout, clearTimeout, setInterval, clearInterval,
    require: id => id === "electron" ? { shell: { openPath: async target => { calls.push(["open", target]); return ""; } } } : id === "./game-runtime/processes" ? { ...originalRequire(id), waitForWindowsProcessWindow: async (...args) => calls.push(["wait", ...args]) } : originalRequire(id)
  });
  vm.runInContext(await fs.readFile(filename, "utf8"), context, { filename });
  const target = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-ark-launch-"));
  t.after(() => fs.rm(target, { recursive: true, force: true }));
  const helper = path.join(target, "gamelaunchhelper.exe");
  await fs.writeFile(helper, "fixture");
  const { state, store } = fixture();
  state.game.installations[gameId] = { path: target };
  const runtime = new loaded.exports.GameRuntimeService({ app: { getPath: () => target }, store, getWindow: () => null, notifyRenderer() {} });
  assert.equal((await runtime.launch(gameId)).ok, true);
  assert.deepEqual(calls, [["open", helper], ["wait", "ArkAscended", 180000]]);
  await fs.unlink(helper);
  await assert.rejects(runtime.launch(gameId), /lanceur.*introuvable/);
  assert.equal(calls.length, 2);
});

test("les quatre étapes ARK exposent le clavier, les overlays et le lancement seulement après préparation", async () => {
  const bootstrap = await fs.readFile(path.join(root, "src/renderer/app/core/bootstrap.js"), "utf8");
  const context = vm.createContext({
    snapshot: { state: { game: { installations: {} }, settings: {} } },
    MANAGED_BIZHAWK_GAME_IDS: new Set(), CONFIGURABLE_INTEGRATED_GAMES: new Set(),
    MINECRAFT_MODE_IDS: [], MINECRAFT_ROUND_MODE_IDS: [], gameInstallBusyId: "", gameLaunchBusyId: "",
    escapeHtml: value => String(value ?? ""), renderGamePageMessage: () => "", activeGameSession: () => null,
    gameMappedEffects: () => [], overlayProfileName: () => "Test", visibilityTools: { gameScopeFor: () => "public" }, siteVisibility: {}
  });
  for (const name of ["AUTOMATED_GAME_INSTALLERS", "GAME_OVERLAY_GENERATOR_ONLY_IDS"]) {
    vm.runInContext(bootstrap.match(new RegExp(`const ${name} = new Set\\(\\[[\\s\\S]*?\\]\\);`))[0], context);
  }
  vm.runInContext(await fs.readFile(path.join(root, "src/renderer/app/features/games/overlay-cards.js"), "utf8"), context);
  vm.runInContext(bootstrap.match(/const GTA_INTERACTION_OVERLAY_BACKGROUNDS = \[[\s\S]*?\];/)[0], context);
  let page = JSDOM.fragment(context.renderGameInstallation(pack, true));
  assert.match(page.textContent, /Steam ou Xbox Game Pass/);
  assert.ok(page.querySelector('[data-game-key-layout]'));
  assert.equal(page.querySelector('[data-action="install-game"]').disabled, false);
  page = JSDOM.fragment(context.renderGameLaunch(pack, true));
  assert.equal(page.querySelector('[data-action="launch-game"]'), null);
  context.snapshot.state.game.installations[gameId] = { installerVersion: manifest.version };
  page = JSDOM.fragment(context.renderGameLaunch(pack, true));
  assert.equal(page.querySelector('[data-action="launch-game"]').disabled, false);
  assert.match(page.textContent, /Lancer ARK: Survival Ascended et activer/);
  page = JSDOM.fragment(context.renderGameOverlays(pack, true));
  assert.equal(page.querySelectorAll('[data-action="download-game-interaction-overlay"]').length, 2);
});
