"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), vm = require("node:vm");
const { createRequire } = require("node:module"), { createHash } = require("node:crypto");
const { detectInstalledGames } = require("../src/main/game-runtime/discovery");
const { installationPlatform } = require("../src/main/game-runtime/installation-platform");
const { launchExternalGame } = require("../src/main/game-runtime/external-launch");
const { shopInstallationPath } = require("../src/main/game-runtime/shop-games-installation");
const { installerForGame } = require("../src/main/game-installer-manifest");
const gameId = "hogwarts-legacy", manifest = installerForGame(gameId);
async function write(file, bytes) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, bytes); }
async function fixture(t) {
 const root = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-platform-")); t.after(() => fs.rm(root, { recursive: true, force: true }));
 const steam = path.join(root, "Library/steamapps/common/Hogwarts Legacy"), xbox = path.join(root, "XboxGames/Hogwarts Legacy/Content");
 for (const [directory, platform, binary] of [[steam, "steam", "Win64"], [xbox, "xbox", "WinGDK"]]) {
  const module = path.join(directory, "Phoenix/Binaries", binary);
  await write(path.join(module, "HogwartsLegacy.exe"), "fixture, never executed");
  await write(path.join(directory, platform === "steam" ? "HogwartsLegacy.exe" : "gamelaunchhelper.exe"), "fixture, never executed");
  if (platform === "xbox") await write(path.join(directory, "MicrosoftGame.Config"), '<Game><Identity Name="' + manifest.xboxIdentity + '" /></Game>');
  await write(path.join(module, "ue4ss/Mods/ShenPulse/bridge.json"), JSON.stringify({ gameId, token: "b".repeat(64) }));
  await write(path.join(module, "shenpulse-module.json"), JSON.stringify({ gameId, version: manifest.version, files: [{ file: "HogwartsLegacy.exe", sha256: createHash("sha256").update("fixture, never executed").digest("hex") }] }));
 }
 return { root, steam, xbox };
}
function isolated(filename, overrides) {
 const full = path.resolve(__dirname, "../src/main/game-runtime/", filename), original = createRequire(full), module = { exports: {} };
 return fs.readFile(full, "utf8").then(source => { vm.runInNewContext(source, { module, process, Buffer, console, require: id => overrides[id] || original(id) }, { filename: full }); return module.exports; });
}

test("la détection propose Steam et Xbox et déduplique la jonction du même jeu", async t => {
 const f = await fixture(t), alias = path.join(f.root, "XboxAlias"); await fs.symlink(f.xbox, alias, "junction");
 const found = await detectInstalledGames(gameId, manifest, f.steam, { steam: async () => [f.steam], xbox: async () => [f.xbox], registeredXbox: async () => [alias] });
 assert.deepEqual(found, [{ path: f.steam, platform: "steam" }, { path: f.xbox, platform: "xbox" }]);
 assert.equal(await installationPlatform(f.xbox, manifest), "xbox");
});

test("le choix de plateforme respecte la sélection, le dossier précédent et l’annulation", async t => {
 const f = await fixture(t), installations = [{ path: f.steam, platform: "steam" }, { path: f.xbox, platform: "xbox" }];
 const picker = await isolated("target-selection.js", { "./discovery": { detectInstalledGames: async () => installations } });
 for (const selected of [0, 1, 3]) {
  const dialogs = [], validations = [], state = { game: { installations: { [gameId]: { path: f.xbox, platform: "xbox" } } } };
  const before = JSON.stringify(state);
  const runtime = { store: { getState: () => state }, getWindow: () => null, dialog: { showMessageBox: async (_w, options) => { dialogs.push(options); return { response: dialogs.length === 1 ? selected : 0 }; } }, validateTarget: async target => validations.push(target) };
  assert.equal(await picker.pickTarget(runtime, gameId, manifest), selected === 3 ? "" : installations[selected].path);
  assert.deepEqual(Array.from(dialogs[0].buttons), ["Steam", "Xbox / Game Pass", "Choisir un autre dossier", "Annuler"]);
  assert.equal(dialogs[0].defaultId, 1); assert.equal(JSON.stringify(state), before);
  assert.deepEqual(validations, selected === 3 ? [] : [installations[selected].path]);
 }
});

test("choisir un dossier manuellement ne reprend pas l’ancienne édition", async t => {
 const f = await fixture(t), dialogs = [];
 const picker = await isolated("target-selection.js", { "./discovery": { detectInstalledGames: async () => [{ path: f.xbox, platform: "xbox" }, { path: f.steam, platform: "steam" }] } });
 const runtime = { store: { getState: () => ({ game: { installations: { [gameId]: { path: f.xbox } } } }) }, getWindow: () => null,
 dialog: { showMessageBox: async (_w, options) => { dialogs.push(options); return { response: 2 }; }, showOpenDialog: async () => ({ filePaths: [f.steam] }) }, validateTarget: async () => {} };
 assert.equal(await picker.pickTarget(runtime, gameId, manifest), f.steam); assert.equal(dialogs.length, 1);
});

test("le lancement utilise uniquement Steam ou le lanceur Xbox de l’installation mémorisée", async t => {
 const f = await fixture(t);
 for (const platform of ["steam", "xbox"]) {
  const calls = [], selected = f[platform];
  const result = await launchExternalGame({ gameId, manifest, installation: { path: selected, platform }, assertAccess() {}, findRunning: async () => null,
    shell: { openPath: async file => { calls.push(["path", file]); return ""; }, openExternal: async uri => calls.push(["steam", uri]) }, waitForWindowsProcessWindow: async () => {} });
  assert.equal(result.platform, platform);
  assert.deepEqual(calls, platform === "steam" ? [["steam", "steam://rungameid/990080"]] : [["path", path.join(f.xbox, "gamelaunchhelper.exe")]]);
 }
});

test("un jeu ouvert depuis l’autre édition ou impossible à identifier ne lance aucune seconde copie", async t => {
 const f = await fixture(t); let launches = 0;
 const options = { gameId, manifest, installation: { path: f.steam, platform: "steam" }, assertAccess() {},
 shell: { openPath: async () => { launches++; }, openExternal: async () => { launches++; } }, waitForWindowsProcessWindow: async () => {} };
 await assert.rejects(launchExternalGame({ ...options, findRunning: async () => ({ ProcessId: 42, ExecutablePath: path.join(f.xbox, "Phoenix/Binaries/WinGDK/HogwartsLegacy.exe") }) }), /autre installation/);
 await assert.rejects(launchExternalGame({ ...options, findRunning: async () => ({ ProcessId: 42 }) }), /Impossible de vérifier/);
 const selected = { ProcessId: 43, ExecutablePath: path.join(f.steam, "Phoenix/Binaries/Win64/HogwartsLegacy.exe") };
 assert.equal((await launchExternalGame({ ...options, findRunning: async () => selected })).alreadyRunning, true);
 await assert.rejects(launchExternalGame({ ...options, findRunning: async () => ({ ...selected, processes: [selected, { ProcessId: 42, ExecutablePath: path.join(f.xbox, "HogwartsLegacy.exe") }] }) }), /autre installation/);
 assert.equal(launches, 0);
});

test("la jonction Xbox désigne la même installation et un lanceur Xbox manquant ne bascule jamais sur Steam", async t => {
 const f = await fixture(t), alias = path.join(f.root, "PackageAlias"); await fs.symlink(f.xbox, alias, "junction");
 const options = { gameId, manifest, installation: { path: f.xbox, platform: "xbox" }, assertAccess() {},
 findRunning: async () => ({ ProcessId: 42, ExecutablePath: path.join(alias, "Phoenix/Binaries/WinGDK/HogwartsLegacy.exe") }), shell: { openPath() { throw new Error("unexpected launch"); } }, waitForWindowsProcessWindow: async () => {} };
 assert.equal((await launchExternalGame(options)).alreadyRunning, true);
 await fs.unlink(path.join(f.xbox, "gamelaunchhelper.exe"));
 await write(path.join(f.xbox, "HogwartsLegacy.exe"), "wrong fallback launcher");
 await assert.rejects(launchExternalGame({ ...options, findRunning: async () => null }), /lanceur.*introuvable/);
});

test("le pont Hogwarts choisit Win64 pour Steam même si un ancien dossier WinGDK subsiste", async t => {
 const f = await fixture(t); await write(path.join(f.steam, "Phoenix/Binaries/WinGDK/HogwartsLegacy.exe"), "leftover");
 assert.equal(await shopInstallationPath(gameId, f.steam), path.join(f.steam, "Phoenix/Binaries/Win64"));
 await fs.unlink(path.join(f.steam, "Phoenix/Binaries/Win64/HogwartsLegacy.exe"));
 await assert.rejects(shopInstallationPath(gameId, f.steam), /introuvable/);
});

test("installer mémorise la plateforme seulement après le déploiement, sans modifier les règles", async t => {
 const f = await fixture(t), original = { gameId, path: f.xbox, platform: "xbox", installerVersion: "old" };
 const state = { game: { installations: { [gameId]: original } }, actions: [{ id: "keep-action" }], rules: [{ id: "keep-rule" }] }, extras = JSON.stringify({ actions: state.actions, rules: state.rules });
 const install = await isolated("installation.js", { "./mod-installation-ready": { assertModGameClosed: async () => {} } });
 const runtime = { store: { getState: () => state, mutate: fn => fn(state) }, assertAccess() {}, activeInstalls: new Set(), installProgress: new Map(),
  progress(id, value) { this.installProgress.set(id, value); }, pickTarget: async () => f.steam, validateTarget: async () => {}, app: { getPath: key => path.join(f.root, key) },
  downloadAsset: async () => {}, installAsset: async ({ targetPath }) => {
    for (const name of ["dwmapi.dll", "SHENPULSE-MODULE.txt", "THIRD-PARTY-NOTICES.txt", "ue4ss/Mods/ShenPulse/Scripts/main.lua"]) await write(path.join(targetPath, name), "fixture");
    await write(path.join(targetPath, "shenpulse-module.json"), JSON.stringify({ gameId, version: manifest.version, files: [{ file: "dwmapi.dll", sha256: createHash("sha256").update("fixture").digest("hex") }] }));
  } };
 assert.equal((await install.installGame(runtime, gameId)).ok, true); assert.equal(state.game.installations[gameId].platform, "steam"); assert.equal(state.game.installations[gameId].path, f.steam);
 assert.equal(JSON.stringify({ actions: state.actions, rules: state.rules }), extras);
 runtime.pickTarget = async () => ""; const before = JSON.stringify(state); assert.equal((await install.installGame(runtime, gameId)).canceled, true); assert.equal(JSON.stringify(state), before);
 runtime.pickTarget = async () => f.xbox; runtime.downloadAsset = async () => { throw new Error("download fixture failure"); };
 await assert.rejects(install.installGame(runtime, gameId), /download fixture failure/); assert.equal(JSON.stringify(state), before);
});


test("la fiche et le bouton Lancer nomment la plateforme enregistrée et échappent le dossier", async () => {
 const context = vm.createContext({
  MANAGED_BIZHAWK_GAME_IDS:new Set(), CONFIGURABLE_INTEGRATED_GAMES:new Set(), AUTOMATED_GAME_INSTALLERS:new Set([gameId]), MINECRAFT_MODE_IDS:[], MINECRAFT_ROUND_MODE_IDS:[],
  snapshot:{state:{game:{installations:{}}}}, gameInstallBusyId:"",gameLaunchBusyId:"", formatAdminDate:()=>"23 octobre",renderGamePageMessage:()=>"",gameMappedEffects:()=>[],activeGameSession:()=>null,
  escapeHtml:value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;")
 });
 vm.runInContext(await fs.readFile(path.resolve(__dirname,"../src/renderer/app/features/games/overlay-cards.js"),"utf8"),context);
 const pack={id:gameId,name:"Hogwarts Legacy",guide:{mode:"native"}};
 for(const [platform,label]of [["steam","Steam"],["xbox","Xbox / Game Pass"]]){
  context.snapshot.state.game.installations[gameId]={platform,path:'C:/Jeux/<test>',installedAt:"2026-10-23"};
  const install=context.renderGameInstallation(pack,true),launch=context.renderGameLaunch(pack,true);
  assert.ok(install.includes("Interactions installées pour "+label)); assert.ok(install.includes("&lt;test>")); assert.ok(launch.includes("Hogwarts Legacy ("+label+") et activer"));
 }
});
