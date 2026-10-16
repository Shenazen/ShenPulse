"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { GAME_INSTALLERS, installerForGame, isIntegratedGame } = require("../src/main/game-installer-manifest");
const { installGame } = require("../src/main/game-runtime/installation");
const { readRendererSource } = require("./helpers/source-bundles");

const GAME_ID = "find-the-needle-demo";
const manifest = GAME_INSTALLERS[GAME_ID];

test("Find The Needle prépare seulement la démo Steam gratuite 5165210", () => {
  assert.equal(installerForGame(GAME_ID), manifest);
  assert.equal(isIntegratedGame(GAME_ID), false);
  assert.equal(manifest.title, "Find The Needle Demo");
  assert.equal(manifest.version, "1.1.0");
  assert.equal(manifest.setupOnly, undefined);
  assert.equal(manifest.localArchiveOnly, true);
  assert.equal(manifest.autoDetect, true);
  assert.equal(manifest.unattended, true);
  assert.deepEqual(manifest.steamAppIds, ["5165210"]);
  assert.equal(manifest.steamLaunchAppId, "5165210");
  assert.deepEqual(manifest.directoryNames, ["Find The Needle Demo"]);
  assert.deepEqual(manifest.executables, ["FindTheNeedle.exe"]);
  assert.deepEqual(manifest.launchExecutables, ["FindTheNeedle.exe"]);
  assert.deepEqual(manifest.assets, []);
  assert.equal(manifest.managedTarget, undefined);
  assert.equal(manifest.temporaryTarget, undefined);
  assert.doesNotMatch(JSON.stringify(manifest), /5160800|https?:\/\/|backblaze/i);
  const renderer = readRendererSource();
  const automaticInstallers = renderer.match(/const AUTOMATED_GAME_INSTALLERS = new Set\(\[([\s\S]*?)\]\)/)?.[1] || "";
  assert.ok(automaticInstallers.includes(`"${GAME_ID}"`), "l’interface propose bien l’association Steam sans installer un autre jeu");
});

/** Charge la vraie découverte avec un disque et un registre entièrement fictifs. */
function discoveryFixture({ installedAppId = "5165210", executable = "FindTheNeedle.exe" } = {}) {
  const programFiles = path.join(os.tmpdir(), "shenpulse-needle-fixture-programs");
  const steamRoot = path.join(programFiles, "Steam");
  const libraryRoot = path.join(os.tmpdir(), "shenpulse-needle-fixture-library");
  const folderName = installedAppId === "5165210" ? "Demo renommée" : "Find The Needle";
  const gameRoot = path.join(libraryRoot, "steamapps", "common", folderName);
  const files = new Map([
    [path.join(steamRoot, "steamapps", "libraryfolders.vdf"), `"libraryfolders" { "0" { "path" "${libraryRoot.replaceAll("\\", "\\\\")}" } }`],
    [path.join(libraryRoot, "steamapps", `appmanifest_${installedAppId}.acf`), `"AppState" { "appid" "${installedAppId}" "installdir" "${folderName}" }`],
    [path.join(gameRoot, executable), "exécutable fictif, jamais lancé"]
  ]);
  const missing = () => Object.assign(new Error("Fichier fictif absent"), { code: "ENOENT" });
  const fakeFs = { promises: {
    async readFile(filename) {
      if (!files.has(filename)) throw missing();
      return files.get(filename);
    },
    async stat(filename) {
      if (filename === gameRoot) return { isDirectory: () => true, isFile: () => false };
      if (files.has(filename)) return { isDirectory: () => false, isFile: () => true };
      throw missing();
    }
  } };
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, "../src/main/game-runtime/discovery.js"), "utf8");
  vm.runInNewContext(source, {
    module,
    process: { platform: "win32", env: { ProgramFiles: programFiles } },
    require(id) {
      if (id === "node:fs") return fakeFs;
      if (id === "node:path") return path;
      if (id === "./processes") return { runProcess: async () => "" };
      if (id === "./paths") return { async findLaunchTarget(directory, names) {
        return names.map((name) => path.join(directory, name)).find((filename) => files.has(filename)) || "";
      } };
      throw new Error(`Dépendance de découverte non prévue : ${id}`);
    }
  }, { filename: "isolated-needle-discovery.js" });
  return { discovery: module.exports, gameRoot };
}

test("la découverte Steam retrouve la démo même dans une bibliothèque et un dossier renommés", async () => {
  const { discovery, gameRoot } = discoveryFixture();
  assert.equal(await discovery.detectInstalledGame(GAME_ID, manifest), gameRoot);
});

test("la découverte de la démo ne confond pas le jeu complet 5160800 ni un exécutable absent", async () => {
  const fullGame = discoveryFixture({ installedAppId: "5160800" });
  assert.equal(await fullGame.discovery.detectInstalledGame(GAME_ID, manifest), "");
  const wrongExecutable = discoveryFixture({ executable: "OtherGame.exe" });
  assert.equal(await wrongExecutable.discovery.detectInstalledGame(GAME_ID, manifest), "");
});

test("l’installation délègue au mod local fourni, sans téléchargement ni lancement du jeu", async () => {
  const state = { game: { installations: {} } };
  const progress = [];
  const gameRoot = path.join(os.tmpdir(), "demo-fictive-jamais-creee");
  const forbidden = () => { throw new Error("Une association seule ne doit ni lancer, ni télécharger, ni déployer de fichiers."); };
  let accessChecks = 0;
  const runtime = {
    store: { getState: () => state, mutate: (mutator) => mutator(state) },
    assertAccess(id) { assert.equal(id, GAME_ID); accessChecks += 1; },
    activeInstalls: new Set(),
    installProgress: new Map(),
    async pickTarget(id, options) { assert.equal(id, GAME_ID); assert.equal(options, manifest); return gameRoot; },
    async validateTarget(directory, options) { assert.equal(directory, gameRoot); assert.equal(options, manifest); },
    progress(id, value) { progress.push(value); this.installProgress.set(id, value); },
    app: { getPath: forbidden },
    launch: forbidden,
    downloadAsset: forbidden,
    installAsset: forbidden
  };
  const filename = path.join(__dirname, "../src/main/game-runtime/installation.js");
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  let delegated = 0;
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), { module, require(id) {
    if (id === "./find-the-needle-mod-installation") return { async installFindTheNeedleMod(incoming, options) {
      assert.equal(incoming, runtime);
      assert.equal(options.gameId, GAME_ID);
      assert.equal(options.targetPath, gameRoot);
      assert.equal(options.manifest, manifest);
      options.assertAccess();
      delegated += 1;
      incoming.progress(GAME_ID, { phase: "complete" });
      return { ok: true, path: gameRoot, modInstalled: true };
    } };
    return localRequire(id);
  } }, { filename });
  const result = await module.exports.installGame(runtime, GAME_ID);
  assert.equal(result.ok, true);
  assert.equal(result.modInstalled, true);
  assert.equal(result.path, gameRoot);
  assert.ok(accessChecks >= 3);
  assert.equal(delegated, 1);
  assert.deepEqual(state.game.installations, {});
  assert.equal(progress.at(-1).phase, "complete");
  assert.equal(runtime.activeInstalls.size, 0);
  assert.equal(runtime.installProgress.size, 0);
});

test("la jaquette Steam locale est le JPEG officiel portrait 300 × 450, sans déformation encodée", () => {
  const artwork = fs.readFileSync(path.join(__dirname, "../src/renderer/assets/games/catalog/find-the-needle-demo.jpg"));
  assert.equal(crypto.createHash("sha256").update(artwork).digest("hex"), "cb639564acaea69cd00c300a7bbcd87b6621f38622250de388013041749881dd");
  assert.equal(artwork.readUInt16BE(0), 0xffd8);
  let dimensions;
  for (let offset = 2; offset + 9 < artwork.length;) {
    assert.equal(artwork[offset], 0xff, "structure JPEG valide");
    const marker = artwork[offset + 1];
    const segmentLength = artwork.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3].includes(marker)) {
      dimensions = { width: artwork.readUInt16BE(offset + 7), height: artwork.readUInt16BE(offset + 5) };
      break;
    }
    assert.ok(segmentLength >= 2);
    offset += segmentLength + 2;
  }
  assert.deepEqual(dimensions, { width: 300, height: 450 });
});
