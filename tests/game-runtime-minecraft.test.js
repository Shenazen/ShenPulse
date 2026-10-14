"use strict";
const { readMainSource } = require("./helpers/main-source-bundles");
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { GAME_INSTALLERS } = require("../src/main/game-installer-manifest");
const { configureMinecraftServerCommandFeedback, parseMinecraftWinCounterLine, safeInstallerAssetUrl } = require("../src/main/game-runtime");
const root = path.join(__dirname, "..");

/** Modes, paquets et retours de commandes des serveurs Minecraft. */

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

test("Minecraft Survival force le mode survie dans les propriétés du serveur", async () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-minecraft-survival-properties-")
  );
  try {
    fs.writeFileSync(
      path.join(temporaryRoot, "server.properties"),
      [
        "gamemode=creative",
        "force-gamemode=false",
        "allow-flight=true",
        "broadcast-console-to-ops=true",
        ""
      ].join("\n")
    );
    await configureMinecraftServerCommandFeedback(temporaryRoot, {
      creativeMode: false
    });
    const properties = fs.readFileSync(
      path.join(temporaryRoot, "server.properties"),
      "utf8"
    );
    assert.match(properties, /^gamemode=survival$/m);
    assert.match(properties, /^force-gamemode=true$/m);
    assert.match(properties, /^allow-flight=false$/m);
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
  const runtime = readMainSource("game-runtime.js");
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

test("Minecraft Survival devient un serveur ShenPulse géré en mode survie", () => {
  const installer = GAME_INSTALLERS["minecraft-survival-plugin"];
  assert.equal(installer.version, "1.1.1");
  assert.equal(installer.title, "Minecraft Survival");
  assert.equal(installer.managedTarget, true);
  assert.equal(installer.requiresMinecraftEula, true);
  assert.deepEqual(installer.minecraftServer, {
    serverJar: "paper-1.21-130.jar",
    javaDirectory: "runtime/java",
    port: 25565,
    xms: "1024M",
    xmx: "2048M",
    creativeMode: false
  });
  assert.deepEqual(
    installer.assets.map((asset) => asset.id),
    ["paper", "java", "plugin", "config", "serverProperties"]
  );
  assert.match(
    safeInstallerAssetUrl(installer.assets[0].url),
    /^https:\/\/f003\.backblazeb2\.com\/file\/shenpulse-media\/installer-assets\/minecraft-common\//
  );
  assert.match(
    safeInstallerAssetUrl(installer.assets[1].url),
    /^https:\/\/f003\.backblazeb2\.com\/file\/shenpulse-media\/installer-assets\/minecraft-common\//
  );
  assert.equal(installer.autoClicker, undefined);
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

    const runtime = readMainSource("game-runtime.js");
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

