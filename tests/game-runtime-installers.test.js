"use strict";
const { readMainSource } = require("./helpers/main-source-bundles");
const { readRendererSource } = require("./helpers/source-bundles");
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { GAME_INSTALLERS } = require("../src/main/game-installer-manifest");
const { deployAdditionalInstallTargets, deployGtaEnhancedSave, detectInstalledGame, safeInstallerAssetUrl, stageGtaEnhancedSave } = require("../src/main/game-runtime");
const root = path.join(__dirname, "..");

/** Installateurs et mods des jeux externes, dont les sauvegardes GTA. */

test("publie l’installation Pokémon complète avec sa ROM autorisée", () => {
  assert.deepEqual(
    Object.keys(GAME_INSTALLERS).sort(),
    [
      "ark-survival-ascended",
      "balatro",
      "blue-prince",
      "clash-of-live",
      "color-strike",
      "crash-bandicoot-n-sane-trilogy",
      "cult-of-the-lamb",
      "dead-by-daylight",
      "demonologist",
      "dredge",
      "egging-on",
      "escape-from-duckov",
      "euro-truck-simulator-2",
      "fallout-4",
      "find-the-needle-demo",
      "gtav-montchiliad",
      "hogwarts-legacy",
      "minecraft-bedrock-box",
      "minecraft-sandbox-3",
      "minecraft-survival-plugin",
      "pokemon-red-blue",
      "resident-evil-3",
      "shift-at-midnight",
      "stardew-valley",
      "super-mario-kart",
      "supermarket-simulator",
      "tcg-card-shop-simulator",
      "terraria",
      "the-mortuary-assistant",
      "tiklive-climb",
      "tiklive-cube-wars",
      "tiklive-stack-tower",
      "unturned"
    ]
  );
  assert.ok(
    Object.values(GAME_INSTALLERS).every(
      (installer) =>
        (installer.setupOnly === true || installer.localArchiveOnly === true || installer.assets.length > 0) &&
        installer.assets.every(
          (asset) => asset.id && asset.fileName && asset.action
        )
    )
  );
  assert.deepEqual(
    GAME_INSTALLERS["pokemon-red-blue"].assets.map((asset) => asset.id),
    ["bizhawk", "bridge", "pack", "rom", "redPatch", "bluePatch"]
  );
  const rom = GAME_INSTALLERS["pokemon-red-blue"].assets.find(
    (asset) => asset.id === "rom"
  );
  assert.equal(rom.action, "copy");
  assert.equal(rom.targetPath, "ROM");
  assert.equal(rom.size, 1048576);
  assert.equal(
    rom.sha256,
    "5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b"
  );
  assert.ok(
    GAME_INSTALLERS["pokemon-red-blue"].assets.every(
      (asset) =>
        asset.size > 0 &&
        asset.sha256.length === 64 &&
        /^https:\/\/f003\.backblazeb2\.com\/file\/shenpulse-media\/installer-assets\/pokemon-red-blue\/(?:1\.0\.1|1\.1\.0)\//.test(
          asset.url
        )
    )
  );
  assert.deepEqual(
    GAME_INSTALLERS["super-mario-kart"].assets.map((asset) => asset.id),
    ["bizhawk", "bridge", "pack", "rom"]
  );
  const superMarioKartRom = GAME_INSTALLERS["super-mario-kart"].assets.find(
    (asset) => asset.id === "rom"
  );
  assert.equal(superMarioKartRom.action, "copy");
  assert.equal(superMarioKartRom.targetPath, "ROM");
  assert.equal(superMarioKartRom.size, 524288);
  assert.equal(
    superMarioKartRom.sha256,
    "2ada8919688087be60a6a48cace8f877add60c45d2e5d09e2442faa55be62a49"
  );
  assert.ok(
    GAME_INSTALLERS["super-mario-kart"].assets.every(
      (asset) =>
        asset.size > 0 &&
        asset.sha256.length === 64 &&
        /^https:\/\/f003\.backblazeb2\.com\/file\/shenpulse-media\/installer-assets\/super-mario-kart\/(?:1\.0\.0|1\.1\.0)\//.test(
          asset.url
        )
    )
  );
});

test("GTA est détecté et installé automatiquement avec une progression novice", () => {
  const gta = GAME_INSTALLERS["gtav-montchiliad"];
  assert.equal(gta.version, "1.0.4");
  const runtime = readMainSource("game-runtime.js");
  const renderer = readRendererSource();

  assert.equal(gta.autoDetect, true);
  assert.equal(gta.unattended, true);
  assert.match(runtime, /async function detectInstalledGame/);
  assert.match(runtime, /libraryfolders\.vdf/);
  assert.match(runtime, /if \(!manifest\.unattended\)/);
  assert.match(
    runtime,
    /Téléchargement des éléments nécessaires|Connexion au téléchargement/
  );
  assert.match(runtime, /new Transform/);
  assert.match(runtime, /bytesReceived:\s*receivedBytes/);
  assert.match(runtime, /speedBps:\s*Math\.round\(speedBps\)/);
  assert.match(runtime, /etaSeconds:/);
  assert.match(runtime, /60_000/);
  assert.match(runtime, /cleanupStaleInstallerRuns/);
  assert.match(renderer, /api\.on\("game-install-progress"/);
  assert.match(renderer, /L’installation n’a pas pu se terminer/);
  assert.match(renderer, /game-progress-stats/);
  assert.match(renderer, /Toujours en attente du serveur/);
});

test("GTA télécharge les bons packs versionnés depuis Backblaze selon l’édition", () => {
  const gta = GAME_INSTALLERS["gtav-montchiliad"];
  const enhanced = gta.assets.filter((asset) =>
    asset.editions?.includes("enhanced")
  );
  const legacy = gta.assets.filter((asset) =>
    asset.editions?.includes("legacy")
  );
  assert.deepEqual(
    enhanced.map((asset) => asset.id),
    ["scripthook-enhanced", "enhancedplugin", "enhancedsave"]
  );
  assert.deepEqual(
    legacy.map((asset) => asset.id),
    ["desolidarisation", "scripthook-legacy", "scripthookvdotnet"]
  );
  for (const asset of gta.assets) {
    assert.equal(asset.sha256.length, 64);
    assert.ok(asset.size > 0);
    assert.match(
      safeInstallerAssetUrl(asset.url),
      /^https:\/\/f003\.backblazeb2\.com\/file\/shenpulse-media\/installer-assets\/gtav-montchiliad\/1\.0\.[0-4]\//
    );
  }
  const enhancedPlugin = enhanced.find(
    (asset) => asset.id === "enhancedplugin"
  );
  assert.match(enhancedPlugin.url, /\/1\.0\.4\//);
  assert.equal(
    enhancedPlugin.sha256,
    "e344fd5c5f6575324b1678447fa126db765b367958f70cdbdd3dfd66412d42f1"
  );
  assert.throws(
    () => safeInstallerAssetUrl("https://example.com/asset.zip"),
    /non autorisé/
  );
});

test("Euro Truck Simulator 2 installe le plugin officiel Crowd Control en un clic", () => {
  const installer = GAME_INSTALLERS["euro-truck-simulator-2"];
  assert.equal(installer.version, "1.0.5");
  assert.equal(installer.autoDetect, true);
  assert.equal(installer.unattended, true);
  assert.deepEqual(installer.steamAppIds, ["227300", "231120"]);
  assert.ok(installer.directoryNames.includes("Euro Truck Simulator 2 Demo"));
  assert.deepEqual(installer.executables, ["bin/win_x64/eurotrucks2.exe"]);
  assert.equal(installer.assets.length, 1);
  assert.equal(installer.assets[0].targetPath, "bin/win_x64/plugins");
  assert.equal(installer.assets[0].size, 181790);
  assert.equal(
    installer.assets[0].sha256,
    "e144ab89e14c538baa72c7219c92dc93688f737f9a8f12f14b9b5cdac8c30795"
  );
  assert.match(
    safeInstallerAssetUrl(installer.assets[0].url),
    /^https:\/\/f003\.backblazeb2\.com\/file\/shenpulse-media\/installer-assets\/euro-truck-simulator-2\/1\.0\.4\/TruckSimulator-CC-1\.0\.4\.zip$/
  );
});

test("Resident Evil 3 installe le mod officiel recommandé et détecte Steam", () => {
  const installer = GAME_INSTALLERS["resident-evil-3"];
  assert.equal(installer.version, "2.1.4");
  assert.equal(installer.autoDetect, true);
  assert.equal(installer.unattended, true);
  assert.deepEqual(installer.steamAppIds, ["952060"]);
  assert.ok(installer.directoryNames.includes("RE3"));
  assert.deepEqual(installer.executables, ["re3.exe"]);
  assert.deepEqual(installer.launchExecutables, ["re3.exe"]);
  assert.equal(installer.assets.length, 2);
  assert.equal(installer.assets[0].action, "dotnet-desktop-runtime");
  assert.equal(installer.assets[0].major, 8);
  assert.equal(installer.assets[0].size, 58715896);
  assert.equal(
    installer.assets[0].sha256,
    "c375dfd80a967405cfeff634912c1fccc56261ce3d9209ea473f60a21184d1cc"
  );
  assert.match(
    safeInstallerAssetUrl(installer.assets[0].url),
    /^https:\/\/builds\.dotnet\.microsoft\.com\/dotnet\/WindowsDesktop\/8\.0\.31\/windowsdesktop-runtime-8\.0\.31-win-x64\.exe$/
  );
  assert.equal(installer.assets[1].action, "extract");
  assert.equal(installer.assets[1].size, 20825046);
  assert.equal(
    installer.assets[1].sha256,
    "34a5b87eeff7b0fddf7e3069a7af4de42c6c3448ce2c0896f4c64db78fd44fba"
  );
  assert.match(
    safeInstallerAssetUrl(installer.assets[1].url),
    /^https:\/\/f003\.backblazeb2\.com\/file\/shenpulse-media\/installer-assets\/resident-evil-3\/2\.1\.3\/RE3net-CC-2\.1\.2\.zip$/
  );
  const runtimeSource = readMainSource("game-runtime.js");
  assert.match(runtimeSource, /satisfiedAssetCount: candidateAssets\.length/);
  assert.match(runtimeSource, /satisfiedAssetIds: candidateAssets/);
});

test("Demonologist détecte Steam et mémorise son dossier sans modifier le jeu", () => {
  const installer = GAME_INSTALLERS.demonologist;
  assert.equal(installer.version, "1.0.0");
  assert.equal(installer.setupOnly, true);
  assert.equal(installer.autoDetect, true);
  assert.equal(installer.unattended, true);
  assert.deepEqual(installer.steamAppIds, ["1929610", "2302560"]);
  assert.deepEqual(installer.executables, ["Demonologist.exe"]);
  assert.equal(
    installer.waitForWindowProcess,
    "Shivers-Win64-Shipping"
  );
  assert.deepEqual(installer.assets, []);
  assert.equal(typeof detectInstalledGame, "function");
});

test("Cult of the Lamb utilise le pack BepInEx versionné publié sur Backblaze", () => {
  const installer = GAME_INSTALLERS["cult-of-the-lamb"];
  const publishedManifest = JSON.parse(
    fs.readFileSync(
      path.join(
        root,
        "resources",
        "installer-assets",
        "cult-of-the-lamb",
        "1.0.2",
        "manifest.json"
      ),
      "utf8"
    )
  );
  assert.equal(installer.version, "1.0.2");
  assert.equal(installer.autoDetect, true);
  assert.equal(installer.unattended, true);
  assert.deepEqual(installer.steamAppIds, ["1313140"]);
  assert.deepEqual(
    installer.executables,
    ["Cult Of The Lamb.exe", "CultOfTheLamb.exe"]
  );
  assert.equal(publishedManifest.gameId, "cult-of-the-lamb");
  assert.equal(publishedManifest.version, installer.version);
  assert.deepEqual(
    publishedManifest.assets.map((asset) => asset.id),
    ["mod"]
  );
  const asset = installer.assets[0];
  assert.equal(asset.size, publishedManifest.assets[0].size);
  assert.equal(asset.sha256, publishedManifest.assets[0].sha256);
  assert.equal(
    asset.sha256,
    "69a0f5a1fec72904d7acfc256de2b51dd562f7a4d9e628052a52eda69da323ea"
  );
  assert.match(
    safeInstallerAssetUrl(asset.url),
    /^https:\/\/f003\.backblazeb2\.com\/file\/shenpulse-media\/installer-assets\/cult-of-the-lamb\/1\.0\.2\//
  );
  const runtime = readMainSource("game-runtime.js");
  assert.match(runtime, /steamGameInstallCandidates/);
  assert.match(runtime, /appmanifest_\$\{appId\}\.acf/);
});

test("Stardew Valley et Terraria utilisent leurs packs versionnés Backblaze", () => {
  const expected = {
    "stardew-valley": {
      effects: 28,
      assets: 3,
      appIds: ["413150"]
    },
    terraria: {
      effects: 25,
      assets: 1,
      appIds: ["1281930"]
    }
  };
  for (const [gameId, contract] of Object.entries(expected)) {
    const installer = GAME_INSTALLERS[gameId];
    const publishedManifest = JSON.parse(
      fs.readFileSync(
        path.join(
          root,
          "resources",
          "installer-assets",
          gameId,
          "1.0.0",
          "manifest.json"
        ),
        "utf8"
      )
    );
    assert.equal(installer.version, "1.0.0");
    assert.equal(installer.autoDetect, true);
    assert.equal(installer.unattended, true);
    assert.deepEqual(installer.steamAppIds, contract.appIds);
    assert.equal(installer.assets.length, contract.assets);
    assert.equal(publishedManifest.assets.length, contract.assets);
    for (const asset of installer.assets) {
      const published = publishedManifest.assets.find(
        (entry) => entry.id === asset.id
      );
      assert.equal(asset.size, published.size);
      assert.equal(asset.sha256, published.sha256);
      assert.match(
        safeInstallerAssetUrl(asset.url),
        new RegExp(
          `^https://f003\\.backblazeb2\\.com/file/shenpulse-media/installer-assets/${gameId}/1\\.0\\.0/`
        )
      );
    }
    const catalog = require(
      path.join(
        root,
        "src",
        "main",
        gameId === "terraria"
          ? "terraria-catalog.js"
          : "stardew-valley-catalog.js"
      )
    );
    const effects =
      catalog.TERRARIA_EFFECTS ||
      catalog.STARDEW_VALLEY_EFFECTS;
    assert.equal(effects.length, contract.effects);
  }
});

test("déploie le mod Terraria dans le dossier tModLoader des documents", async () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-terraria-target-")
  );
  try {
    const gameRoot = path.join(temporaryRoot, "game");
    const documentsRoot = path.join(temporaryRoot, "documents");
    const backupRoot = path.join(temporaryRoot, "backups");
    const source = path.join(
      gameRoot,
      "Mods",
      "CrowdControlMod.tmod"
    );
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "mod-terraria");
    const result = await deployAdditionalInstallTargets({
      manifest: GAME_INSTALLERS.terraria,
      targetPath: gameRoot,
      backupRoot,
      documentsPath: documentsRoot
    });
    const destination = path.join(
      documentsRoot,
      "My Games",
      "Terraria",
      "tModLoader",
      "Mods",
      "CrowdControlMod.tmod"
    );
    assert.equal(result.length, 1);
    assert.equal(result[0].path, destination);
    assert.equal(fs.readFileSync(destination, "utf8"), "mod-terraria");
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("la sauvegarde Enhanced choisit un emplacement libre et ne remplace jamais une sauvegarde existante", async () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-gta-save-")
  );
  const previousProfilePath =
    process.env.SHENPULSE_GTAV_PROFILE_TEST_PATH;
  try {
    const extracted = path.join(temporaryRoot, "extracted", "nested");
    const staging = path.join(temporaryRoot, "staging");
    const profiles = path.join(temporaryRoot, "Profiles");
    const profile = path.join(profiles, "ABC123");
    fs.mkdirSync(extracted, { recursive: true });
    fs.mkdirSync(profile, { recursive: true });
    const save = Buffer.alloc(600 * 1024, 0x5a);
    fs.writeFileSync(path.join(extracted, "SGTA50001"), save);
    fs.writeFileSync(path.join(extracted, "SGTA50015"), save);
    fs.writeFileSync(path.join(extracted, "SGTA50015.bak"), save);
    fs.writeFileSync(path.join(profile, "SGTA50001"), "sauvegarde utilisateur");
    process.env.SHENPULSE_GTAV_PROFILE_TEST_PATH = profiles;

    await stageGtaEnhancedSave(
      path.join(temporaryRoot, "extracted"),
      staging
    );
    const result = await deployGtaEnhancedSave({
      sourceDirectory: staging,
      backupRoot: path.join(temporaryRoot, "backups")
    });
    assert.equal(result.deployed, true);
    assert.equal(result.slot, 15);
    assert.equal(
      fs.readFileSync(path.join(profile, "SGTA50001"), "utf8"),
      "sauvegarde utilisateur"
    );
    assert.deepEqual(
      fs.readFileSync(path.join(profile, "SGTA50015")),
      save
    );
    assert.deepEqual(
      fs.readFileSync(path.join(profile, "SGTA50015.bak")),
      save
    );

    const second = await deployGtaEnhancedSave({
      sourceDirectory: staging,
      backupRoot: path.join(temporaryRoot, "backups-2")
    });
    assert.equal(second.alreadyPresent, true);
    assert.equal(second.slot, 15);
  } finally {
    if (previousProfilePath === undefined) {
      delete process.env.SHENPULSE_GTAV_PROFILE_TEST_PATH;
    } else {
      process.env.SHENPULSE_GTAV_PROFILE_TEST_PATH = previousProfilePath;
    }
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("la sauvegarde Enhanced archive l’emplacement 15 avant remplacement si les 15 emplacements sont occupés", async () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-gta-full-")
  );
  const previousProfilePath =
    process.env.SHENPULSE_GTAV_PROFILE_TEST_PATH;
  try {
    const staging = path.join(temporaryRoot, "staging");
    const profiles = path.join(temporaryRoot, "Profiles");
    const profile = path.join(profiles, "FULL");
    const backupRoot = path.join(temporaryRoot, "backups");
    fs.mkdirSync(staging, { recursive: true });
    fs.mkdirSync(profile, { recursive: true });
    const save = Buffer.alloc(600 * 1024, 0x2a);
    fs.writeFileSync(path.join(staging, "SGTA50015"), save);
    fs.writeFileSync(path.join(staging, "SGTA50015.bak"), save);
    for (let slot = 1; slot <= 15; slot += 1) {
      const name = `SGTA5${String(slot).padStart(4, "0")}`;
      fs.writeFileSync(path.join(profile, name), `utilisateur-${slot}`);
      fs.writeFileSync(path.join(profile, `${name}.bak`), `backup-${slot}`);
    }
    process.env.SHENPULSE_GTAV_PROFILE_TEST_PATH = profiles;

    const result = await deployGtaEnhancedSave({
      sourceDirectory: staging,
      backupRoot
    });
    assert.equal(result.deployed, true);
    assert.equal(result.slot, 15);
    assert.equal(
      fs.readFileSync(path.join(backupRoot, "SGTA50015"), "utf8"),
      "utilisateur-15"
    );
    assert.equal(
      fs.readFileSync(path.join(backupRoot, "SGTA50015.bak"), "utf8"),
      "backup-15"
    );
    assert.deepEqual(
      fs.readFileSync(path.join(profile, "SGTA50015")),
      save
    );
  } finally {
    if (previousProfilePath === undefined) {
      delete process.env.SHENPULSE_GTAV_PROFILE_TEST_PATH;
    } else {
      process.env.SHENPULSE_GTAV_PROFILE_TEST_PATH = previousProfilePath;
    }
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

