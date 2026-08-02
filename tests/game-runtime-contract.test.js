"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  GAME_INSTALLERS,
  INTEGRATED_GAME_IDS
} = require("../src/main/game-installer-manifest");
const {
  commitInstallationDeployment,
  configureMinecraftServerCommandFeedback,
  deployAdditionalInstallTargets,
  deployGtaEnhancedSave,
  parseMinecraftWinCounterLine,
  safeInstallerAssetUrl,
  stageGtaEnhancedSave
} = require("../src/main/game-runtime");
const {
  sanitizeDealOrNoDealHostState
} = require("../src/main/ipc");

const root = path.join(__dirname, "..");

test("publie les installateurs privés sans inclure de ROM Pokémon", () => {
  assert.deepEqual(
    Object.keys(GAME_INSTALLERS).sort(),
    [
      "cult-of-the-lamb",
      "gtav-montchiliad",
      "minecraft-bedrock-box",
      "minecraft-sandbox-3",
      "minecraft-survival-plugin",
      "pokemon-red-blue",
      "stardew-valley",
      "terraria"
    ]
  );
  assert.ok(
    Object.values(GAME_INSTALLERS).every(
      (installer) =>
        installer.assets.length > 0 &&
        installer.assets.every(
          (asset) => asset.id && asset.fileName && asset.action
        )
    )
  );
  assert.ok(
    GAME_INSTALLERS["pokemon-red-blue"].assets.every(
      (asset) => asset.id !== "rom"
    )
  );
});

test("l’installation sauvegarde les remplacements et supprime seulement le temporaire", () => {
  const runtime = fs.readFileSync(
    path.join(root, "src", "main", "game-runtime.js"),
    "utf8"
  );
  assert.match(runtime, /game-backups/);
  assert.match(runtime, /installer-downloads/);
  assert.match(runtime, /copyWithBackup/);
  assert.match(runtime, /fs\.promises\.rm\(tempRoot/);
  assert.doesNotMatch(runtime, /fs\.promises\.rm\(targetPath/);
  assert.match(runtime, /Archive refusée : un chemin sort de la destination/);
  assert.match(runtime, /commitInstallationDeployment/);
  assert.match(runtime, /-Verb RunAs/);
  assert.match(runtime, /Confirmez la demande Windows/);
});

test("le déploiement préparé remplace les fichiers seulement après leur sauvegarde", async () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-deployment-")
  );
  try {
    const deploymentRoot = path.join(temporaryRoot, "deployment");
    const targetPath = path.join(temporaryRoot, "game");
    const backupRoot = path.join(temporaryRoot, "backups");
    fs.mkdirSync(path.join(deploymentRoot, "scripts"), {
      recursive: true
    });
    fs.mkdirSync(path.join(targetPath, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(deploymentRoot, "args.txt"), "nouveau");
    fs.writeFileSync(
      path.join(deploymentRoot, "scripts", "bridge.dll"),
      "pont"
    );
    fs.writeFileSync(path.join(targetPath, "args.txt"), "original");

    const result = await commitInstallationDeployment({
      deploymentRoot,
      targetPath,
      backupRoot,
      tempRoot: temporaryRoot
    });
    assert.equal(result.elevated, false);
    assert.equal(result.fileCount, 2);
    assert.equal(
      fs.readFileSync(path.join(backupRoot, "args.txt"), "utf8"),
      "original"
    );
    assert.equal(
      fs.readFileSync(path.join(targetPath, "args.txt"), "utf8"),
      "nouveau"
    );
    assert.equal(
      fs.readFileSync(
        path.join(targetPath, "scripts", "bridge.dll"),
        "utf8"
      ),
      "pont"
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("une réparation ne recopie pas les fichiers déjà identiques", async () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-unchanged-deployment-")
  );
  try {
    const deploymentRoot = path.join(temporaryRoot, "deployment");
    const targetPath = path.join(temporaryRoot, "game");
    const backupRoot = path.join(temporaryRoot, "backups");
    fs.mkdirSync(deploymentRoot, { recursive: true });
    fs.mkdirSync(targetPath, { recursive: true });
    fs.writeFileSync(path.join(deploymentRoot, "paper.jar"), "identique");
    fs.writeFileSync(path.join(targetPath, "paper.jar"), "identique");

    await commitInstallationDeployment({
      deploymentRoot,
      targetPath,
      backupRoot,
      tempRoot: temporaryRoot
    });

    assert.equal(fs.existsSync(path.join(backupRoot, "paper.jar")), false);
    assert.equal(
      fs.readFileSync(path.join(targetPath, "paper.jar"), "utf8"),
      "identique"
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("Minecraft force le mode créatif dans les propriétés du serveur", async () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-minecraft-properties-")
  );
  try {
    fs.writeFileSync(
      path.join(temporaryRoot, "server.properties"),
      [
        "gamemode=survival",
        "force-gamemode=false",
        "allow-flight=false",
        "broadcast-console-to-ops=true",
        ""
      ].join("\n")
    );
    await configureMinecraftServerCommandFeedback(temporaryRoot);
    const properties = fs.readFileSync(
      path.join(temporaryRoot, "server.properties"),
      "utf8"
    );
    assert.match(properties, /^gamemode=creative$/m);
    assert.match(properties, /^force-gamemode=true$/m);
    assert.match(properties, /^allow-flight=true$/m);
    assert.match(properties, /^broadcast-console-to-ops=false$/m);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("les résultats natifs Minecraft sont reconnus sans boucler sur les synchronisations", () => {
  assert.deepEqual(
    parseMinecraftWinCounterLine(
      "SHENPULSE_WIN_COUNTER current=8 target=20 source=auto-win"
    ),
    {
      current: 8,
      outcome: "win",
      source: "auto-win"
    }
  );
  assert.deepEqual(
    parseMinecraftWinCounterLine(
      "SHENPULSE_WIN_COUNTER current=7 target=20 source=timer-penalty"
    ),
    {
      current: 7,
      outcome: "loss",
      source: "timer-penalty"
    }
  );
  assert.equal(
    parseMinecraftWinCounterLine(
      "SHENPULSE_WIN_COUNTER current=7 target=20 source=set"
    ),
    null
  );
});

test("GTA est détecté et installé automatiquement avec une progression novice", () => {
  const gta = GAME_INSTALLERS["gtav-montchiliad"];
  assert.equal(gta.version, "1.0.4");
  const runtime = fs.readFileSync(
    path.join(root, "src", "main", "game-runtime.js"),
    "utf8"
  );
  const renderer = fs.readFileSync(
    path.join(root, "src", "renderer", "app.js"),
    "utf8"
  );

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

test("le chemin du jeu est confirmé puis revérifié avant tout téléchargement", () => {
  const runtime = fs.readFileSync(
    path.join(root, "src", "main", "game-runtime.js"),
    "utf8"
  );
  const pickTargetStart = runtime.indexOf("async #pickTarget");
  const validateTargetStart = runtime.indexOf(
    "async #validateTarget",
    pickTargetStart
  );
  const picker = runtime.slice(pickTargetStart, validateTargetStart);
  const installStart = runtime.indexOf("async install(gameId)");
  const downloadStart = runtime.indexOf(
    "await this.#downloadAsset",
    installStart
  );
  const targetSelection = runtime.indexOf(
    "await this.#pickTarget",
    installStart
  );

  assert.ok(pickTargetStart >= 0);
  assert.match(picker, /Confirmer le dossier de/);
  assert.match(picker, /Oui, installer ici/);
  assert.match(picker, /Non, choisir un autre dossier/);
  assert.match(picker, /Vérifier ce dossier/);
  assert.match(picker, /while \(true\)/);
  assert.match(picker, /await this\.#validateTarget\(selected, manifest\)/);
  assert.match(picker, /Dossier de jeu incorrect/);
  assert.match(picker, /Choisir un autre dossier/);
  assert.ok(targetSelection >= 0 && targetSelection < downloadStart);
});

test("le suivi d'installation reste recuperable pendant toute l'operation", () => {
  const runtime = fs.readFileSync(
    path.join(root, "src", "main", "game-runtime.js"),
    "utf8"
  );
  const renderer = fs.readFileSync(
    path.join(root, "src", "renderer", "app.js"),
    "utf8"
  );
  const installStart = runtime.indexOf("async install(gameId)");
  const pickerStart = runtime.indexOf("await this.#pickTarget", installStart);
  const trackingStart = runtime.indexOf(
    "this.activeInstalls.add(gameId)",
    installStart
  );
  const progressListener = renderer.slice(
    renderer.indexOf('api.on("game-install-progress"'),
    renderer.indexOf('api.on("deal-host-state"')
  );

  assert.match(runtime, /this\.installProgress = new Map\(\)/);
  assert.match(
    runtime,
    /installProgress: this\.installProgress\.get\(gameId\) \|\| null/
  );
  assert.match(runtime, /phase: "error"/);
  assert.match(runtime, /phase: "canceled"/);
  assert.ok(trackingStart > installStart && trackingStart < pickerStart);
  assert.match(renderer, /function restoreActiveGameInstallProgress/);
  assert.match(renderer, /api\.getGameRuntimeStatus\(gameId\)/);
  assert.doesNotMatch(
    progressListener,
    /progress\.gameId !== gameInstallBusyId/
  );
  assert.match(renderer, /\$\{pageMarkup\}\$\{installProgressMarkup\}/);
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
  const runtime = fs.readFileSync(
    path.join(root, "src", "main", "game-runtime.js"),
    "utf8"
  );
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

test("les jeux maison se lancent dans une fenêtre ShenPulse configurable", () => {
  assert.ok(INTEGRATED_GAME_IDS.includes("deal-or-no-deal"));
  const runtime = fs.readFileSync(
    path.join(root, "src", "main", "game-runtime.js"),
    "utf8"
  );
  assert.match(
    runtime,
    /"coin-pusher",[\s\S]*"connect-four",[\s\S]*"deal-or-no-deal"/
  );
  assert.match(runtime, /"original",[\s\S]*"index\.html"/);
  assert.match(runtime, /"host\.html"/);
  const originalGamesDirectory = path.join(
    root,
    "src",
    "renderer",
    "games",
    "original-src",
    "components",
    "games"
  );
  const coinPusher = fs.readFileSync(
    path.join(originalGamesDirectory, "CoinPusherGame.vue"),
    "utf8"
  );
  const connectFour = fs.readFileSync(
    path.join(originalGamesDirectory, "ConnectFourGame.vue"),
    "utf8"
  );
  const dealOrNoDeal = fs.readFileSync(
    path.join(originalGamesDirectory, "DealOrNoDealGame.vue"),
    "utf8"
  );
  assert.match(coinPusher, /createCoinPusher3dRenderer/);
  assert.match(coinPusher, /coin-pusher-webgl/);
  assert.match(connectFour, /arena-stage\.png/);
  assert.match(connectFour, /class="connect-shell"/);
  assert.match(dealOrNoDeal, /live-stage\.png/);
  assert.match(dealOrNoDeal, /class="case-box"/);
  assert.match(dealOrNoDeal, /ref="premiumBasePriceRef"/);
  assert.match(dealOrNoDeal, /ref="premiumEntryPriceRef"/);
  assert.match(
    dealOrNoDeal,
    /font-size:\s*calc\(3\.14rem \* var\(--premium-entry-amount-scale,\s*1\)\)/
  );
  assert.match(
    dealOrNoDeal,
    /targets\.forEach\(\(target\) => \{[\s\S]*refineEntryAmountFit\(target\)/
  );
  const originalHost = fs.readFileSync(
    path.join(root, "src", "renderer", "games", "original-src", "main.ts"),
    "utf8"
  );
  assert.match(
    originalHost,
    /saveCoinPusherSettings\(\{[\s\S]*\.\.\.stored[\s\S]*platformImageUrl:/
  );
  assert.match(
    originalHost,
    /saveDealOrNoDealSettings\(\{[\s\S]*\.\.\.stored[\s\S]*boxValues:/
  );
  assert.match(
    originalHost,
    /api\.on\('state-changed',[\s\S]*migrateDesktopSettings\(gameId, updatedSettings\)/
  );
  assert.match(
    originalHost,
    /subscribeDealOrNoDealHostState\(publishPrivateState\)/
  );
  const preload = fs.readFileSync(
    path.join(root, "src", "main", "preload.js"),
    "utf8"
  );
  const ipc = fs.readFileSync(
    path.join(root, "src", "main", "ipc.js"),
    "utf8"
  );
  assert.match(preload, /publishDealHostState:[\s\S]*game:deal-host-state/);
  assert.match(preload, /"deal-host-state"/);
  assert.match(ipc, /handle\("game:deal-host-state"/);
  const host = fs.readFileSync(
    path.join(root, "src", "renderer", "games", "host.js"),
    "utf8"
  );
  assert.match(host, /Cadeau d’entrée/);
  assert.match(host, /roundPattern/);
  assert.match(host, /cashOfferEnabled/);
  assert.match(host, /musicTrack/);
  assert.match(host, /data-host-gift-image/);
  const musicDirectory = path.join(
    root,
    "src",
    "renderer",
    "assets",
    "games",
    "deal-or-no-deal",
    "music"
  );
  assert.equal(
    fs.readdirSync(musicDirectory).filter((file) => file.endsWith(".mp3"))
      .length,
    7
  );
});

test("le suivi privé DealOrNoDeal conserve seulement les boîtes valides", () => {
  const state = sanitizeDealOrNoDealHostState({
    phase: "opening",
    playerName: "Joueuse test",
    payoutMultiplier: 2.5,
    entryOptionId: "premium",
    boxes: [
      { id: 2, value: 9999999, opened: true },
      { id: 1, value: -9999999, own: true },
      { id: 2, value: 10 },
      { id: 25, value: 20 },
      { id: "invalide", value: 30 }
    ],
    bankerRequestText: "Offre test",
    bonusValue: 123
  });
  assert.equal(state.phase, "opening");
  assert.equal(state.playerName, "Joueuse test");
  assert.equal(state.payoutMultiplier, 2.5);
  assert.equal(state.entryOptionId, "premium");
  assert.deepEqual(state.boxes, [
    { id: 1, value: -999999, opened: false, own: true },
    { id: 2, value: 999999, opened: true, own: false }
  ]);
  assert.equal(state.bankerRequestText, "Offre test");
  assert.equal(state.bonusValue, 123);
});

test("l’identité visuelle Windows utilise les assets ShenPulse transparents", () => {
  const banner = fs.readFileSync(
    path.join(
      root,
      "src",
      "renderer",
      "assets",
      "brand",
      "shenpulse-banner-transparent.png"
    )
  );
  assert.equal(banner[25], 6);
  assert.ok(fs.statSync(path.join(root, "build", "shenpulse.ico")).size > 80000);
  const main = fs.readFileSync(
    path.join(root, "src", "main", "main.js"),
    "utf8"
  );
  const html = fs.readFileSync(
    path.join(root, "src", "renderer", "index.html"),
    "utf8"
  );
  assert.match(main, /build", "shenpulse\.ico/);
  assert.match(html, /shenpulse-banner-transparent\.png/);
});

test("Bedrock Box et SandBox utilisent leurs paquets Backblaze versionnés", () => {
  const games = [
    {
      id: "minecraft-bedrock-box",
      version: "1.1.5",
      assetIds: [
        "paper",
        "java",
        "plugin",
        "guard",
        "nativeWinBridge",
        "effectsPatch",
        "config",
        "serverProperties",
        "world",
        "autoClicker"
      ]
    },
    {
      id: "minecraft-sandbox-3",
      version: "1.1.3",
      assetIds: [
        "paper",
        "java",
        "plugin",
        "guard",
        "winGuard",
        "config",
        "serverProperties",
        "autoClicker"
      ]
    }
  ];

  for (const expected of games) {
    const installer = GAME_INSTALLERS[expected.id];
    const publishedManifest = JSON.parse(
      fs.readFileSync(
        path.join(
          root,
          "resources",
          "installer-assets",
          expected.id,
          expected.version,
          "manifest.json"
        ),
        "utf8"
      )
    );
    assert.equal(installer.version, expected.version);
    assert.equal(installer.managedTarget, true);
    assert.equal(installer.requiresMinecraftEula, true);
    assert.equal(installer.minecraftServer.port, 25565);
    assert.equal(installer.minecraftServer.serverJar, "paper-1.21-130.jar");
    assert.equal(installer.minecraftServer.creativeMode, true);
    assert.deepEqual(installer.autoClicker, {
      executable: "tools/AutoClicker.exe",
      autoStart: true
    });
    assert.equal(publishedManifest.gameId, expected.id);
    assert.equal(publishedManifest.version, installer.version);
    assert.deepEqual(
      installer.assets.map((asset) => asset.id),
      expected.assetIds
    );
    assert.deepEqual(
      publishedManifest.assets.map((asset) => asset.id),
      expected.assetIds
    );

    for (const asset of installer.assets) {
      const published = publishedManifest.assets.find(
        (candidate) => candidate.id === asset.id
      );
      assert.ok(published);
      assert.equal(asset.size, published.size);
      assert.equal(asset.sha256, published.sha256);
      assert.equal(asset.sha256.length, 64);
      assert.ok(asset.size > 0);
      assert.match(
        safeInstallerAssetUrl(asset.url),
        new RegExp(
          `^https://f003\\.backblazeb2\\.com/file/shenpulse-media/installer-assets/(?:minecraft-common/1\\.[01]\\.0|${expected.id}/1\\.1\\.[0-5])/`
        )
      );
    }
  }
  const runtime = fs.readFileSync(
    path.join(root, "src", "main", "game-runtime.js"),
    "utf8"
  );
  assert.match(runtime, /writeMinecraftEula/);
  assert.match(runtime, /J’accepte le CLUF et installer/);
  assert.match(runtime, /#startMinecraftServer/);
  assert.match(runtime, /async stop\(gameId\)/);
  assert.match(runtime, /await stopMinecraftServerRecord\(record\)/);
  assert.match(runtime, /#startMinecraftAutoClicker/);
  assert.match(runtime, /#stopMinecraftAutoClickers/);
  assert.match(runtime, /AutoClicker Minecraft ShenPulse est introuvable/);
  assert.match(runtime, /127\.0\.0\.1/);
  assert.match(runtime, /"nogui"/);
});

test("Minecraft masque les retours de commandes pour les anciens et nouveaux serveurs", async () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-minecraft-feedback-")
  );
  try {
    const propertiesPath = path.join(temporaryRoot, "server.properties");
    fs.writeFileSync(
      propertiesPath,
      [
        "motd=ShenPulse",
        "broadcast-console-to-ops=true",
        "broadcast-rcon-to-ops=true",
        ""
      ].join("\r\n")
    );

    await configureMinecraftServerCommandFeedback(temporaryRoot);
    const properties = fs.readFileSync(propertiesPath, "utf8");
    assert.match(properties, /^broadcast-console-to-ops=false$/m);
    assert.match(properties, /^broadcast-rcon-to-ops=false$/m);
    assert.doesNotMatch(properties, /^broadcast-console-to-ops=true$/m);
    assert.doesNotMatch(properties, /^broadcast-rcon-to-ops=true$/m);

    const runtime = fs.readFileSync(
      path.join(root, "src", "main", "game-runtime.js"),
      "utf8"
    );
    assert.match(runtime, /gamerule sendCommandFeedback false/);
    assert.match(runtime, /gamerule commandBlockOutput false/);
    assert.match(runtime, /gamerule logAdminCommands false/);
    assert.match(runtime, /gamerule announceAdvancements false/);
    assert.match(runtime, /gamerule showDeathMessages false/);
    assert.match(runtime, /await existing\.ready/);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("le patch Bedrock Box laisse les explosions détruire les blocs", () => {
  const effectsPatch = fs.readFileSync(
    path.join(
      root,
      "scripts",
      "minecraft",
      "bedrock-effects-patch",
      "src",
      "fr",
      "shenpulse",
      "minecraft",
      "ShenPulseBedrockEffectsPatch.java"
    ),
    "utf8"
  );

  assert.match(effectsPatch, /getConfig\(\)\.set\("auto-replace", null\)/);
  assert.doesNotMatch(effectsPatch, /scheduleReplacement/);
  assert.doesNotMatch(effectsPatch, /onEntityExplode|onBlockExplode/);
  assert.doesNotMatch(
    effectsPatch,
    /player\.sendMessage|event\.getPlayer\(\)\.sendMessage/
  );
});
