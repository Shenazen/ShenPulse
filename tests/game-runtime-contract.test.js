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
  deployGtaEnhancedSave,
  safeInstallerAssetUrl,
  stageGtaEnhancedSave
} = require("../src/main/game-runtime");

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

test("GTA est détecté et installé automatiquement avec une progression novice", () => {
  const gta = GAME_INSTALLERS["gtav-montchiliad"];
  assert.equal(gta.version, "1.0.3");
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
      /^https:\/\/f003\.backblazeb2\.com\/file\/shenpulse-media\/installer-assets\/gtav-montchiliad\/1\.0\.[0123]\//
    );
  }
  const enhancedPlugin = enhanced.find(
    (asset) => asset.id === "enhancedplugin"
  );
  assert.match(enhancedPlugin.url, /\/1\.0\.3\//);
  assert.equal(
    enhancedPlugin.sha256,
    "9163c6e21a66fbb737b550405229d14d6ea29d4960e12be0b1cdeee7d88ad632"
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
      assetIds: [
        "paper",
        "java",
        "plugin",
        "guard",
        "effectsPatch",
        "config",
        "serverProperties",
        "world",
        "autoClicker"
      ]
    },
    {
      id: "minecraft-sandbox-3",
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
          "1.1.1",
          "manifest.json"
        ),
        "utf8"
      )
    );
    assert.equal(installer.version, "1.1.1");
    assert.equal(installer.managedTarget, true);
    assert.equal(installer.requiresMinecraftEula, true);
    assert.equal(installer.minecraftServer.port, 25565);
    assert.equal(installer.minecraftServer.serverJar, "paper-1.21-130.jar");
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
          `^https://f003\\.backblazeb2\\.com/file/shenpulse-media/installer-assets/(?:minecraft-common/1\\.[01]\\.0|${expected.id}/1\\.1\\.[01])/`
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
    assert.match(runtime, /await existing\.ready/);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
