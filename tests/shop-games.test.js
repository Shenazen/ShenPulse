"use strict";

const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs/promises"), os = require("node:os"), path = require("node:path"), net = require("node:net");
const { ShopGameBridge } = require("../src/main/shop-game-bridge");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { stageShopGameInstallation, hogwartsBinaryDirectory, assertShopModuleReady } = require("../src/main/game-runtime/shop-games-installation");
const { validatePack } = require("../src/main/game-hub/commands");
const { assertModGameClosed } = require("../src/main/game-runtime/mod-installation-ready");
const manifests = require("../src/main/game-installers/shop-games");
const registry = require("../scripts/manifests/game-packs.json");
const ids = Object.keys(manifests);
const token = "a".repeat(64);
const sha256 = bytes => require("node:crypto").createHash("sha256").update(bytes).digest("hex");

async function directory(t) { const root = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-shop-test-")); t.after(() => fs.rm(root, { recursive: true, force: true })); return root; }

test("les clients gardent le bon donateur entre groupes, effets prolongés et réutilisation des personnages", { skip: process.platform !== "win32" }, async t => {
  const { execFileSync } = require("node:child_process");
  const output = path.join(await directory(t), "tcg-customer-attribution.exe");
  const root = path.resolve(__dirname, "..");
  execFileSync(path.join(process.env.WINDIR, "Microsoft.NET/Framework64/v4.0.30319/csc.exe"),
    ["/nologo", "/target:exe", `/out:${output}`, path.join(root, "native/shop-games/CustomerAttribution.cs"), path.join(root, "tests/fixtures/tcg-customer-attribution-harness.cs")], { windowsHide: true, stdio: "pipe" });
  assert.match(execFileSync(output, [], { encoding: "utf8", windowsHide: true }), /fourteen customer attribution behavior checks passed/);
});

test("TCG remplit entièrement les rayons, réveille les cartons et termine les effets sans cumul", { skip: process.platform !== "win32" }, async t => {
  const { execFileSync } = require("node:child_process");
  const output = path.join(await directory(t), "tcg-runtime-effects.exe");
  const root = path.resolve(__dirname, "..");
  execFileSync(path.join(process.env.WINDIR, "Microsoft.NET/Framework64/v4.0.30319/csc.exe"),
    ["/nologo", "/target:exe", `/out:${output}`, ...["native/shop-games/TemporaryEffects.cs", "native/shop-games/TcgShopOperations.cs", "tests/fixtures/tcg-runtime-effects-harness.cs"].map(file => path.join(root, file))], { windowsHide: true, stdio: "pipe" });
  assert.match(execFileSync(output, [], { encoding: "utf8", windowsHide: true }), /runtime behavior checks passed/);
});

test("les quatre packs ont un catalogue exécutable, des guides ShenPulse et un pack Backblaze vérifié", () => {
  const catalog = loadShenazenGameCatalog(path.resolve(__dirname, "../resources"));
  const expected = { "hogwarts-legacy": 73, "tcg-card-shop-simulator": 45, "supermarket-simulator": 42, "shift-at-midnight": 36 };
  for (const id of ids) {
    const pack = catalog.find(p => p.id === id), manifest = manifests[id], asset = manifest.assets[0];
    validatePack(pack);
    assert.equal(pack.effects.length, expected[id]);
    assert.equal(pack.connector.type, "shop-mod");
    assert.equal(pack.guide.mode, "native");
    assert.ok(pack.guide.notes.length >= 5);
    assert.doesNotMatch(JSON.stringify(pack), /SyncLive|Crowd Control/i);
    assert.ok(pack.defaultMappings.every(mapping => mapping.triggerEnabled === true));
    assert.ok(pack.effects.every(effect => effect.available && effect.description));
    assert.match(asset.url, /^https:\/\/f003\.backblazeb2\.com\/file\/shenpulse-media\/installer-assets\//);
    const recorded = registry.assets.find(a => a.gameId === id && a.id === "module");
    assert.equal(asset.sha256, recorded.sha256);
    assert.equal(asset.size, recorded.size);
    assert.ok(manifest.singleInstanceProcesses.length);
    assert.ok(manifest.launchExecutables.includes("gamelaunchhelper.exe"));
  }
});

test("les quatre fiches donnent accès à l'installation automatique, au lancement et aux overlays", async () => {
  const vm = require("node:vm"), { JSDOM } = require("jsdom");
  const bootstrap = await fs.readFile(path.resolve(__dirname, "../src/renderer/app/core/bootstrap.js"), "utf8");
  const source = await fs.readFile(path.resolve(__dirname, "../src/renderer/app/features/games/overlay-cards.js"), "utf8");
  const context = vm.createContext({
    snapshot: { state: { game: { installations: {} }, settings: {} } },
    MANAGED_BIZHAWK_GAME_IDS: new Set(), CONFIGURABLE_INTEGRATED_GAMES: new Set(), MINECRAFT_MODE_IDS: [], MINECRAFT_ROUND_MODE_IDS: [],
    gameInstallBusyId: "", gameLaunchBusyId: "", escapeHtml: value => String(value ?? ""), renderGamePageMessage: () => "", activeGameSession: () => null,
    formatAdminDate: () => "22/10/2026", gameMappedEffects: () => [], overlayProfileName: () => "Essai"
  });
  for (const name of ["AUTOMATED_GAME_INSTALLERS", "GAME_OVERLAY_GENERATOR_ONLY_IDS"]) vm.runInContext(bootstrap.match(new RegExp(`const ${name} = new Set\\(\\[[\\s\\S]*?\\]\\);`))[0], context);
  vm.runInContext(bootstrap.match(/const GTA_INTERACTION_OVERLAY_BACKGROUNDS = \[[\s\S]*?\];/)[0], context);
  vm.runInContext(source, context);
  for (const pack of loadShenazenGameCatalog(path.resolve(__dirname, "../resources")).filter(pack => ids.includes(pack.id))) {
    let page = JSDOM.fragment(context.renderGameInstallation(pack, true));
    assert.equal(page.querySelector('[data-action="install-game"]').dataset.id, pack.id);
    assert.equal(page.querySelector('[data-action="install-game"]').disabled, false);
    context.snapshot.state.game.installations[pack.id] = { installerVersion: pack.installerVersion };
    page = JSDOM.fragment(context.renderGameLaunch(pack, true));
    assert.equal(page.querySelector('[data-action="launch-game"]').disabled, false);
    page = JSDOM.fragment(context.renderGameOverlays(pack, true));
    assert.equal(page.querySelectorAll('[data-action="download-game-interaction-overlay"]').length, 2);
    assert.ok([...page.querySelectorAll('[data-action="download-game-interaction-overlay"]')].every(button => button.disabled));
    assert.match(page.textContent, /Activez au moins une interaction/);
  }
});

test("la fiche d'interactions distingue les tests manuels d'une session LIVE active et propose son activation", async () => {
  const vm = require("node:vm"), { JSDOM } = require("jsdom");
  let session = null;
  const pack = { id: "tcg-card-shop-simulator", name: "TCG Card Shop Simulator", effects: [] };
  const context = vm.createContext({ snapshot: { state: { game: { interactionRulesByPack: {} } } }, activeGameSession: () => session, escapeHtml: value => String(value).replaceAll("<", "&lt;"),
    gameJourneyFor: () => [{ id: "interactions" }, { id: "launch" }], gameMappedEffects: () => [],
    gameEffectSearch: "", gameEffectCategory: "all", eventIconMarkup: () => "", emptyInline: () => "" });
  vm.runInContext(await fs.readFile(path.resolve(__dirname, "../src/renderer/app/features/games/interactions.js"), "utf8"), context);
  let page = JSDOM.fragment(context.renderGameInteractions(pack, true));
  assert.match(page.querySelector('[role="status"]').textContent, /viewers inactifs/);
  assert.match(page.textContent, /tests manuels restent disponibles/);
  assert.equal(page.querySelector('[data-action="start-game-session"]').dataset.id, pack.id);
  assert.equal(page.querySelector('[data-action="start-game-session"]').disabled, false);
  page = JSDOM.fragment(context.renderGameInteractions(pack, false));
  assert.equal(page.querySelector('[data-action="start-game-session"]').disabled, true);
  session = { packId: pack.id, pack };
  page = JSDOM.fragment(context.renderGameInteractions(pack, true));
  assert.match(page.querySelector('[role="status"]').textContent, /viewers actifs/);
  assert.equal(page.querySelector('[data-action="start-game-session"]'), null);
  session = { packId: "autre-jeu", pack: { name: "<Autre jeu>" } };
  page = JSDOM.fragment(context.renderGameInteractions(pack, true));
  assert.match(page.textContent, /Arrêtez-la avant d’activer/);
  assert.equal(page.querySelector('[data-action="start-game-session"]'), null);
  assert.equal(page.querySelector('[data-action="game-step"]').dataset.value, "launch");
});

test("le protocole TCP attend une réponse complète et n’assimile pas une connexion à une exécution", async t => {
  const server = net.createServer(socket => {
    let input = "";
    socket.on("data", chunk => {
      input += chunk;
      if (!input.includes("\n")) return;
      const request = JSON.parse(input);
      socket.write(JSON.stringify({ id: request.id, gameId: request.gameId, status: 3, message: "Magasin fermé" }).slice(0, 14));
      setTimeout(() => socket.end(JSON.stringify({ id: request.id, gameId: request.gameId, status: 3, message: "Magasin fermé" }).slice(14) + "\n"), 10);
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const bridge = new ShopGameBridge({ gameId: "tcg-card-shop-simulator" });
  const result = await bridge.tcpRequest({ id: "test", gameId: "tcg-card-shop-simulator" }, server.address().port, 1000);
  assert.equal(result.status, 3);
  assert.equal(result.message, "Magasin fermé");
  assert.equal(bridge.status().connected, false);
});

test("refuse un résultat de commande portant le mauvais identifiant", async t => {
  const root = await directory(t), config = path.join(root, "BepInEx/config"); await fs.mkdir(config, { recursive: true });
  await fs.writeFile(path.join(config, "ShenPulse.tcg-card-shop-simulator.json"), JSON.stringify({ token, gameId: "tcg-card-shop-simulator", port: 58447 }));
  const bridge = new ShopGameBridge({ gameId: "tcg-card-shop-simulator", installationPath: root });
  bridge.tcpRequest = async () => ({ id: "ancienne-demande", gameId: "tcg-card-shop-simulator", status: 0 });
  await assert.rejects(bridge.send("argent_plus"), /Réponse du module/);
});

test("le canal Hogwarts ignore les anciens résultats et transmet le nom du spectateur comme une donnée", async t => {
  const root = await directory(t), channel = path.join(root, "ue4ss/Mods/ShenPulse"); await fs.mkdir(channel, { recursive: true });
  await fs.writeFile(path.join(channel, "bridge.json"), JSON.stringify({ token, gameId: "hogwarts-legacy" }));
  await fs.writeFile(path.join(channel, "result.json"), JSON.stringify({ id: "ancien", status: 0 }));
  const bridge = new ShopGameBridge({ gameId: "hogwarts-legacy", installationPath: root });
  const operation = bridge.send("soin_complet", { viewer: 'Jean"; os.exit() --\nÉlodie' });
  let content;
  for (let i = 0; i < 50 && !content; i++) { content = await fs.readFile(path.join(channel, "request.lua"), "utf8").catch(() => ""); if (!content) await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.ok(content);
  assert.ok(content.includes("Jean\\034; os.exit() --\\010Élodie"));
  const id = content.match(/id="([a-f0-9-]+)"/)[1];
  await fs.writeFile(path.join(channel, "result.json"), JSON.stringify({ id, gameId: "hogwarts-legacy", status: 0, executionConfirmed: true }));
  const result = await operation;
  assert.equal(result.executionConfirmed, true);
});

test("une fermeture annule les commandes encore en attente et le diagnostic détecte un battement périmé", async t => {
  const root = await directory(t), channel = path.join(root, "ue4ss/Mods/ShenPulse"); await fs.mkdir(channel, { recursive: true });
  await fs.writeFile(path.join(channel, "bridge.json"), JSON.stringify({ token, gameId: "hogwarts-legacy" }));
  await fs.writeFile(path.join(channel, "ready.json"), JSON.stringify({ token, at: Date.now() / 1000 - 30, ready: true }));
  const bridge = new ShopGameBridge({ gameId: "hogwarts-legacy", installationPath: root });
  assert.equal((await bridge.start()).connected, false);
  const pending = bridge.send("soin_complet"); await bridge.close();
  await assert.rejects(pending, /session de jeu/);
  assert.equal(await fs.stat(path.join(channel, "request.lua")).catch(() => null), null);
});

test("Hogwarts installe les signatures Game Pass sans les imposer à Steam et préserve les autres mods", async t => {
  for (const platform of ["WinGDK", "Win64"]) {
    const root = await directory(t), target = path.join(root, "game"), deployment = path.join(root, "deployment"), relative = "Phoenix/Binaries/" + platform;
    await fs.mkdir(path.join(target, relative, "ue4ss/Mods"), { recursive: true });
    await fs.writeFile(path.join(target, relative, "HogwartsLegacy.exe"), "game");
    await fs.writeFile(path.join(target, relative, "ue4ss/Mods/mods.txt"), "MyMod : 1\n");
    await fs.writeFile(path.join(target, relative, "ue4ss/Mods/mods.json"), JSON.stringify([{mod_name:"MyMod",mod_enabled:true}]));
    await fs.mkdir(path.join(deployment, "ue4ss/Mods/ShenPulse"), { recursive: true });
    for (const name of ["dwmapi.dll", "SHENPULSE-MODULE.txt", "THIRD-PARTY-NOTICES.txt"]) await fs.writeFile(path.join(deployment, name), "module");
    await fs.writeFile(path.join(deployment, "shenpulse-module.json"), JSON.stringify({ files: [] }));
    const variants = path.join(deployment, ".shenpulse-variants/xbox/UE4SS_Signatures"); await fs.mkdir(variants, { recursive: true });
    for (const name of ["GUObjectArray.lua", "ConsoleManager.lua"]) await fs.writeFile(path.join(variants, name), "signature-" + name);
    assert.equal(await hogwartsBinaryDirectory(target), relative);
    await stageShopGameInstallation({ gameId: "hogwarts-legacy", targetPath: target, deploymentRoot: deployment });
    const staged = path.join(deployment, relative), list = await fs.readFile(path.join(staged, "ue4ss/Mods/mods.txt"), "utf8");
    assert.match(list, /MyMod : 1/); assert.match(list, /ShenPulse : 1/);
    const mods = JSON.parse(await fs.readFile(path.join(staged, "ue4ss/Mods/mods.json"), "utf8"));
    assert.ok(mods.some(m => m.mod_name === "MyMod" && m.mod_enabled));
    const config = JSON.parse(await fs.readFile(path.join(staged, "ue4ss/Mods/ShenPulse/bridge.json"), "utf8")); assert.match(config.token, /^[a-f0-9]{64}$/);
    const manifest = JSON.parse(await fs.readFile(path.join(staged, "shenpulse-module.json"), "utf8"));
    for (const name of ["GUObjectArray.lua", "ConsoleManager.lua"]) {
      const file = "ue4ss/UE4SS_Signatures/" + name, bytes = await fs.readFile(path.join(staged, file)).catch(() => null);
      if (platform === "WinGDK") { assert.equal(bytes.toString(), "signature-" + name); assert.equal(manifest.files.find(e => e.file === file).sha256, require("node:crypto").createHash("sha256").update(bytes).digest("hex")); }
      else { assert.equal(bytes, null); assert.equal(manifest.files.some(e => e.file === file), false); }
    }
    assert.equal(await fs.stat(path.join(deployment, ".shenpulse-variants")).catch(() => null), null);
  }
});

test("une installation incomplète ou un jeu Xbox déjà ouvert est refusé avant tout remplacement", async t => {
  const root = await directory(t);
  await assert.rejects(assertShopModuleReady("tcg-card-shop-simulator", root), /installé ou mis à jour/);
  let script;
  await assert.rejects(assertModGameClosed("tcg-card-shop-simulator", root, { platform: "win32", execute: async (_program, args) => { script = args.at(-1); return "123"; } }), /Fermez TCG/);
  const encoded = script.match(/FromBase64String\('([^']+)'\)/)[1];
  assert.equal(JSON.parse(Buffer.from(encoded, "base64")).strictNames, true);
});

test("Supermarket sélectionne la variante Xbox et conserve une empreinte correspondant au fichier réellement installé", async t => {
  const root = await directory(t), target = path.join(root, "game"), deployment = path.join(root, "deployment");
  const moduleFile = "BepInEx/plugins/ShenPulse/ShenPulse.Supermarket.Module.dll";
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "MicrosoftGame.config"), "Xbox");
  await fs.mkdir(path.join(deployment, "BepInEx/config"), { recursive: true });
  await fs.mkdir(path.dirname(path.join(deployment, moduleFile)), { recursive: true });
  await fs.mkdir(path.join(deployment, ".shenpulse-variants/xbox"), { recursive: true });
  await fs.writeFile(path.join(deployment, "BepInEx/config/BepInEx.cfg"), "[Logging.Console]\nEnabled = true\n");
  await fs.writeFile(path.join(deployment, moduleFile), "Steam");
  await fs.writeFile(path.join(deployment, ".shenpulse-variants/xbox/ShenPulse.Supermarket.Module.dll"), "Xbox");
  await fs.writeFile(path.join(deployment, "shenpulse-module.json"), JSON.stringify({ gameId: "supermarket-simulator", version: manifests["supermarket-simulator"].version, files: [{ file: moduleFile, sha256: sha256("Steam") }] }));
  await stageShopGameInstallation({ gameId: "supermarket-simulator", targetPath: target, deploymentRoot: deployment });
  assert.equal(await fs.readFile(path.join(deployment, moduleFile), "utf8"), "Xbox");
  assert.equal(await fs.stat(path.join(deployment, ".shenpulse-variants")).catch(() => null), null);
  await assertShopModuleReady("supermarket-simulator", deployment);
  const configurationPath = path.join(deployment, "BepInEx/config/ShenPulse.supermarket-simulator.json");
  const configuration = await fs.readFile(configurationPath, "utf8");
  await fs.writeFile(configurationPath, JSON.stringify({ gameId: "supermarket-simulator", token: "invalide", port: 8586 }));
  await assert.rejects(assertShopModuleReady("supermarket-simulator", deployment), /configuration locale.*invalide/);
  await fs.writeFile(configurationPath, configuration);
  await fs.writeFile(path.join(deployment, moduleFile), "ancien fichier");
  await assert.rejects(assertShopModuleReady("supermarket-simulator", deployment), /absent ou modifié/);
});

test("un accès révoqué pendant la connexion TCP empêche l'envoi de la commande", async t => {
  let received = "";
  const server = net.createServer(socket => socket.on("data", bytes => { received += bytes; }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const bridge = new ShopGameBridge({ gameId: "tcg-card-shop-simulator" });
  await assert.rejects(bridge.tcpRequest({ code: "argent_plus" }, server.address().port, 1000, () => { throw new Error("accès révoqué"); }), /accès révoqué/);
  assert.equal(received, "");
});

test("un cadeau TCG traverse le moteur de règles jusqu'au module avec le nom du viewer uniquement dans sa session active", async t => {
  const { RuleEngine } = require("../src/main/rule-engine");
  const { ActionRunner } = require("../src/main/action-runner");
  const { GameHub } = require("../src/main/game-hub");
  const { createDefaultState } = require("../src/main/defaults");
  const { getRuleEngineState, getStateProjection } = require("../src/main/state/projections");
  const { defaultGameInteractionRule } = require("../src/main/game-hub/interaction-defaults");
  const { normalizeEvent } = require("../src/main/event-normalizer");
  const { authenticatedFixtureStore } = require("./helpers/authenticated-store");
  const gameId = "tcg-card-shop-simulator", root = await directory(t), requests = [];
  const server = net.createServer(socket => {
    let input = "";
    socket.on("data", bytes => {
      input += bytes;
      if (!input.includes("\n")) return;
      const request = JSON.parse(input);
      if (request.code !== "__status") requests.push(request);
      socket.end(JSON.stringify({ id: request.id, gameId, status: 0, ready: true, executionConfirmed: true }) + "\n");
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const config = path.join(root, "BepInEx/config"); await fs.mkdir(config, { recursive: true });
  await fs.writeFile(path.join(config, `ShenPulse.${gameId}.json`), JSON.stringify({ token, gameId, port: 58447 }));
  const pack = loadShenazenGameCatalog(path.resolve(__dirname, "../resources")).find(pack => pack.id === gameId);
  const state = createDefaultState();
  state.settings.account = { uid: "pro-fixture", email: "pro-fixture@example.test", refreshTokenSecretId: "fixture-account" };
  state.commerce.subscription = { tier: "pro", source: "subscription", status: "active" };
  state.rules = [];
  state.game.installations[gameId] = { path: root };
  state.game.interactionRulesByPack[gameId] = ["reputation", "viewer_client"].map((code, index) => {
    const effect = pack.effects.find(effect => effect.code === code);
    const mapping = pack.defaultMappings.find(mapping => mapping.effectId === effect.id);
    const rule = defaultGameInteractionRule(pack, effect, { ...mapping, triggerEnabled: true }, pack.interactionCatalogVersion);
    rule.conditions = [{ field: "data.giftName", operator: "equals", value: index ? "Cœur sur moi" : "Rose", giftId: index ? "7934" : "5655" }];
    return rule;
  });
  const store = authenticatedFixtureStore({ getState: () => structuredClone(state),
    getStateProjection: paths => getStateProjection(state, {}, paths), getRuleEngineState: type => getRuleEngineState(state, type) });
  const hub = new GameHub({ store, resourcesDirectory: path.resolve(__dirname, "../resources") });
  hub.packs = [pack];
  const bridge = new ShopGameBridge({ gameId, installationPath: root });
  const tcpRequest = bridge.tcpRequest.bind(bridge);
  bridge.tcpRequest = (request, _port, ...args) => tcpRequest(request, server.address().port, ...args);
  hub.serverBridges.set(`${gameId}:shop-mod`, bridge);
  t.after(() => hub.disconnectAll());
  const engine = new RuleEngine({ store, actionRunner: new ActionRunner({ store, gameHub: hub }) });
  const failures = []; engine.on("action-result", result => { if (!result.ok) failures.push(result.error); });
  const viewer = 'Élodie "LIVE" — test';
  const gift = (giftId, giftName, count = 1) => normalizeEvent({ event: "gift", data: { giftId, giftName, count, user: { id: "viewer-fixture", nickname: viewer } } }, "tiktok");
  await engine.process(gift("5655", "Rose"));
  assert.equal(requests.length, 0, "le bouton de test ne doit pas activer implicitement les cadeaux LIVE");
  state.session.game = { running: true, packId: gameId, profileId: state.session.profileId };
  await engine.process(gift("5655", "Rose", 3));
  await engine.process(gift("7934", "Cœur sur moi"));
  assert.deepEqual(failures, []);
  assert.deepEqual(requests.map(request => request.code), ["reputation", "reputation", "reputation", "viewer_client"]);
  assert.ok(requests.every(request => request.viewer === viewer && request.token === token && request.quantity === 1));
  state.session.game.profileId = "autre-profil";
  await engine.process(gift("5655", "Rose"));
  assert.equal(requests.length, 4, "les cadeaux ne doivent pas déclencher les interactions d'un autre profil");
  state.session.game.profileId = state.session.profileId;
  const otherCustomerEffects = pack.effects.filter(effect => effect.category === "Clients" && !["reputation", "viewer_client"].includes(effect.code));
  for (const effect of otherCustomerEffects) {
    const mapping = pack.defaultMappings.find(mapping => mapping.effectId === effect.id);
    const rule = defaultGameInteractionRule(pack, effect, { ...mapping, triggerEnabled: true }, pack.interactionCatalogVersion);
    rule.conditions = [{ field: "data.giftName", operator: "equals", value: effect.name, giftId: `fixture-${effect.code}` }];
    state.game.interactionRulesByPack[gameId] = [rule];
    await engine.process(gift(`fixture-${effect.code}`, effect.name));
  }
  assert.deepEqual(failures, []);
  assert.deepEqual(requests.slice(4).map(request => request.code), otherCustomerEffects.map(effect => effect.code));
  assert.ok(requests.slice(4).every(request => request.viewer === viewer), "les autres interactions clients doivent aussi recevoir le nom du donateur");
});
