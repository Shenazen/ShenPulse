"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const {
  GAME_INSTALLERS
} = require("../src/main/game-installer-manifest");
const {
  extractArchiveSafe,
  safeChildPath,
  safeInstallerAssetUrl,
  sha256File
} = require("../src/main/game-runtime");

const gameIds = [
  "minecraft-bedrock-box",
  "minecraft-sandbox-3"
];
const startServers = process.argv.includes("--start-server");
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "shenpulse-minecraft-install-check-")
);

main().catch((error) => {
  process.stderr.write(`Échec : ${error.message}\n`);
  process.exitCode = 1;
}).finally(async () => {
  const safeTemporaryPrefix = `${path.resolve(os.tmpdir())}${path.sep}`;
  const resolvedTemporaryRoot = path.resolve(temporaryRoot);
  if (
    resolvedTemporaryRoot.startsWith(safeTemporaryPrefix) &&
    path.basename(resolvedTemporaryRoot).startsWith(
      "shenpulse-minecraft-install-check-"
    )
  ) {
    await fs.promises.rm(resolvedTemporaryRoot, {
      recursive: true,
      force: true
    });
  }
});

async function main() {
  for (const gameId of gameIds) {
    await verifyGame(gameId);
  }
}

async function verifyGame(gameId) {
  const manifest = GAME_INSTALLERS[gameId];
  const downloadRoot = path.join(temporaryRoot, gameId, "downloads");
  const installationRoot = path.join(temporaryRoot, gameId, "installation");
  await fs.promises.mkdir(downloadRoot, { recursive: true });
  await fs.promises.mkdir(installationRoot, { recursive: true });

  for (let index = 0; index < manifest.assets.length; index += 1) {
    const asset = manifest.assets[index];
    const destinationPath = path.join(downloadRoot, asset.fileName);
    process.stdout.write(
      `[${gameId} ${index + 1}/${manifest.assets.length}] ${asset.fileName}\n`
    );
    const response = await fetch(safeInstallerAssetUrl(asset.url), {
      cache: "no-store"
    });
    assert.equal(response.ok, true, `HTTP ${response.status} pour ${asset.id}`);
    assert.ok(response.body, `réponse vide pour ${asset.id}`);
    await pipeline(
      Readable.fromWeb(response.body),
      fs.createWriteStream(destinationPath)
    );
    const stat = await fs.promises.stat(destinationPath);
    assert.equal(stat.size, asset.size, `taille invalide pour ${asset.id}`);
    assert.equal(
      await sha256File(destinationPath),
      asset.sha256,
      `SHA-256 invalide pour ${asset.id}`
    );

    const targetRoot = safeChildPath(
      installationRoot,
      asset.targetPath || ""
    );
    await fs.promises.mkdir(targetRoot, { recursive: true });
    if (asset.action === "copy") {
      await fs.promises.copyFile(
        destinationPath,
        path.join(targetRoot, asset.fileName)
      );
    } else if (asset.action === "extract") {
      await extractArchiveSafe(destinationPath, targetRoot);
    } else {
      throw new Error(`action non testée : ${asset.action}`);
    }
  }

  for (const asset of manifest.assets.filter(
    (candidate) => candidate.action === "copy"
  )) {
    const installedPath = path.join(
      installationRoot,
      asset.targetPath || "",
      asset.fileName
    );
    assert.equal(
      await sha256File(installedPath),
      asset.sha256,
      `fichier installé invalide pour ${asset.id}`
    );
  }
  if (gameId === "minecraft-bedrock-box") {
    const levelData = path.join(installationRoot, "world", "level.dat");
    assert.equal(
      (await fs.promises.stat(levelData)).isFile(),
      true,
      "le monde Bedrock Box n'a pas été extrait"
    );
  }
  if (gameId === "minecraft-bedrock-box") {
    assert.equal(
      (
        await fs.promises.stat(
          path.join(
            installationRoot,
            "plugins",
            "shenpulse-bedrock-effects-patch.jar"
          )
        )
      ).isFile(),
      true,
      "le correctif des interactions Bedrock Box n'a pas Ã©tÃ© installÃ©"
    );
  }
  const autoClickerPath = path.join(
    installationRoot,
    "tools",
    "AutoClicker.exe"
  );
  const autoClickerHeader = Buffer.alloc(2);
  const autoClicker = await fs.promises.open(autoClickerPath, "r");
  try {
    await autoClicker.read(autoClickerHeader, 0, 2, 0);
  } finally {
    await autoClicker.close();
  }
  assert.equal(
    autoClickerHeader.toString("ascii"),
    "MZ",
    `l'AutoClicker installÃ© pour ${gameId} n'est pas un exÃ©cutable Windows`
  );
  if (startServers) {
    await smokeTestMinecraftServer(gameId, installationRoot, manifest);
  }
  process.stdout.write(`Installation simulée et vérifiée : ${gameId}\n`);
}

async function smokeTestMinecraftServer(gameId, installationRoot, manifest) {
  const config = manifest.minecraftServer;
  assert.ok(config, `configuration serveur absente pour ${gameId}`);
  assert.equal(
    await tcpPortOpen(config.port),
    false,
    `le port ${config.port} est déjà occupé`
  );
  const javaPath = await findNamedFile(
    path.join(installationRoot, config.javaDirectory),
    "java.exe"
  );
  const serverPath = path.join(installationRoot, config.serverJar);
  await fs.promises.writeFile(
    path.join(installationRoot, "eula.txt"),
    "eula=true\r\n",
    "utf8"
  );

  const child = spawn(
    javaPath,
    [
      `-Xms${config.xms}`,
      `-Xmx${config.xmx}`,
      "-Dfile.encoding=UTF-8",
      "-jar",
      serverPath,
      "nogui"
    ],
    {
      cwd: installationRoot,
      windowsHide: true,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"]
    }
  );
  try {
    await waitForMinecraftReady(child, gameId);
    assert.equal(
      await tcpPortOpen(config.port),
      true,
      `PaperMC n'écoute pas sur ${config.port}`
    );
    process.stdout.write(
      `Serveur réellement prêt : ${gameId} sur 127.0.0.1:${config.port}\n`
    );
  } finally {
    await stopMinecraftProcess(child);
  }
}

function waitForMinecraftReady(child, gameId) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let partial = "";
    let lastLine = "";
    const timer = setTimeout(
      () => fail("délai de premier démarrage dépassé"),
      300_000
    );
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const fail = (message) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new Error(
          `${gameId}: ${message}${lastLine ? ` (${lastLine})` : ""}`
        )
      );
    };
    const read = (chunk) => {
      partial += String(chunk || "");
      const lines = partial.split(/\r?\n/);
      partial = lines.pop() || "";
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        lastLine = line.slice(-800);
        if (
          /Could not load .*plugins|Error occurred while enabling|InvalidPluginException|UnsupportedClassVersionError/i.test(
            line
          )
        ) {
          fail(`échec de chargement d’un plugin : ${line}`);
          return;
        }
        if (
          /\bDone \(.+\)! For help, type/i.test(line) ||
          /For help, type "help"/i.test(line)
        ) {
          done();
        }
      }
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.once("error", (error) => fail(error.message));
    child.once("exit", (code) => {
      if (!settled) fail(`PaperMC s’est fermé avec le code ${code}`);
    });
  });
}

async function stopMinecraftProcess(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.stdin.write("stop\r\n");
  child.stdin.end();
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 20_000))
  ]);
  if (!stopped && child.exitCode === null) child.kill();
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 3_000))
  ]);
}

function tcpPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: "127.0.0.1",
      port,
      timeout: 1000
    });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

async function findNamedFile(directory, name) {
  const entries = await fs.promises.readdir(directory, {
    withFileTypes: true
  });
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) {
      return candidate;
    }
    if (entry.isDirectory()) {
      const found = await findNamedFile(candidate, name).catch(() => "");
      if (found) return found;
    }
  }
  throw new Error(`${name} est introuvable dans ${directory}`);
}
