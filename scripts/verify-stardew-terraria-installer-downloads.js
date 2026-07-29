"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const {
  GAME_INSTALLERS
} = require("../src/main/game-installer-manifest");
const {
  extractArchiveSafe,
  safeInstallerAssetUrl,
  sha256File
} = require("../src/main/game-runtime");

const gameIds = ["stardew-valley", "terraria"];
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "shenpulse-stardew-terraria-check-")
);

main().catch((error) => {
  process.stderr.write(`Échec : ${error.message}\n`);
  process.exitCode = 1;
}).finally(async () => {
  const safePrefix = `${path.resolve(os.tmpdir())}${path.sep}`;
  const resolved = path.resolve(temporaryRoot);
  if (
    resolved.startsWith(safePrefix) &&
    path.basename(resolved).startsWith(
      "shenpulse-stardew-terraria-check-"
    )
  ) {
    await fs.promises.rm(resolved, {
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
  const downloadRoot = path.join(temporaryRoot, gameId);
  await fs.promises.mkdir(downloadRoot, { recursive: true });
  const remoteManifestUrl = new URL(
    "manifest.json",
    safeInstallerAssetUrl(manifest.assets[0].url)
  ).toString();
  const remoteManifestResponse = await fetch(remoteManifestUrl, {
    cache: "no-store"
  });
  assert.equal(
    remoteManifestResponse.ok,
    true,
    `manifest distant indisponible pour ${gameId}`
  );
  const remoteManifest = await remoteManifestResponse.json();
  assert.equal(remoteManifest.gameId, gameId);
  assert.equal(remoteManifest.version, manifest.version);
  assert.deepEqual(
    remoteManifest.assets.map((asset) => asset.id).sort(),
    manifest.assets.map((asset) => asset.id).sort()
  );
  for (let index = 0; index < manifest.assets.length; index += 1) {
    const asset = manifest.assets[index];
    const destination = path.join(downloadRoot, asset.fileName);
    process.stdout.write(
      `[${gameId} ${index + 1}/${manifest.assets.length}] ${asset.fileName}\n`
    );
    const response = await fetch(safeInstallerAssetUrl(asset.url), {
      cache: "no-store"
    });
    assert.equal(
      response.ok,
      true,
      `HTTP ${response.status} pour ${asset.id}`
    );
    assert.ok(response.body, `réponse vide pour ${asset.id}`);
    await pipeline(
      Readable.fromWeb(response.body),
      fs.createWriteStream(destination)
    );
    const stat = await fs.promises.stat(destination);
    assert.equal(
      stat.size,
      asset.size,
      `taille invalide pour ${asset.id}`
    );
    assert.equal(
      await sha256File(destination),
      asset.sha256,
      `SHA-256 invalide pour ${asset.id}`
    );
  }

  if (gameId === "stardew-valley") {
    await verifyStardew(downloadRoot, manifest);
  } else {
    await verifyTerraria(downloadRoot, manifest);
  }
  process.stdout.write(`Téléchargements vérifiés : ${gameId}\n`);
}

async function verifyStardew(downloadRoot, manifest) {
  const mod = manifest.assets.find((asset) => asset.id === "mod");
  const smapi = manifest.assets.find((asset) => asset.id === "smapi");
  const modRoot = path.join(downloadRoot, "mod");
  const smapiRoot = path.join(downloadRoot, "smapi");
  await extractArchiveSafe(
    path.join(downloadRoot, mod.fileName),
    modRoot
  );
  await extractArchiveSafe(
    path.join(downloadRoot, smapi.fileName),
    smapiRoot
  );
  const dllPath = path.join(
    modRoot,
    "CrowdControl",
    "CrowdControl.dll"
  );
  const manifestPath = path.join(
    modRoot,
    "CrowdControl",
    "manifest.json"
  );
  const dll = await fs.promises.readFile(dllPath);
  const metadata = JSON.parse(
    await fs.promises.readFile(manifestPath, "utf8")
  );
  assert.equal(
    containsInt32(dll, 58432),
    true,
    "le mod Stardew n’utilise pas le port 58432"
  );
  assert.equal(
    containsInt32(dll, 51337),
    false,
    "l’ancien port Stardew est encore présent"
  );
  assert.equal(metadata.Name, "ShenPulse");
  assert.ok(
    await findNamedFile(smapiRoot, "install.dat"),
    "le payload Windows SMAPI est absent"
  );
}

async function verifyTerraria(downloadRoot, manifest) {
  const mod = manifest.assets.find((asset) => asset.id === "mod");
  const entries = readTmodEntries(
    await fs.promises.readFile(
      path.join(downloadRoot, mod.fileName)
    )
  );
  const dll = entries.find((entry) =>
    /CrowdControlMod\.dll$/i.test(entry.name)
  )?.data;
  assert.ok(dll, "CrowdControlMod.dll est absent du fichier tmod");
  assert.equal(
    containsInt32(dll, 58433),
    true,
    "le mod Terraria n’utilise pas le port 58433"
  );
  assert.equal(
    containsInt32(dll, 58430),
    false,
    "l’ancien port Terraria est encore présent"
  );
}

function containsInt32(buffer, value) {
  const pattern = Buffer.alloc(4);
  pattern.writeInt32LE(value);
  return buffer.indexOf(pattern) >= 0;
}

function readTmodEntries(file) {
  assert.equal(file.subarray(0, 4).toString("ascii"), "TMOD");
  let offset = 4;
  [, offset] = readString(file, offset);
  offset += 20 + 256;
  const bodyLength = file.readInt32LE(offset);
  offset += 4;
  const body = file.subarray(offset, offset + bodyLength);
  let bodyOffset = 0;
  [, bodyOffset] = readString(body, bodyOffset);
  [, bodyOffset] = readString(body, bodyOffset);
  const count = body.readInt32LE(bodyOffset);
  bodyOffset += 4;
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    let name;
    [name, bodyOffset] = readString(body, bodyOffset);
    const uncompressedLength = body.readInt32LE(bodyOffset);
    const storedLength = body.readInt32LE(bodyOffset + 4);
    bodyOffset += 8;
    entries.push({
      name,
      uncompressedLength,
      storedLength
    });
  }
  for (const entry of entries) {
    const stored = body.subarray(
      bodyOffset,
      bodyOffset + entry.storedLength
    );
    bodyOffset += entry.storedLength;
    entry.data =
      entry.storedLength === entry.uncompressedLength
        ? stored
        : zlib.inflateRawSync(stored);
    assert.equal(entry.data.length, entry.uncompressedLength);
  }
  return entries;
}

function readString(buffer, offset) {
  let length = 0;
  let shift = 0;
  let cursor = offset;
  while (true) {
    const byte = buffer[cursor];
    cursor += 1;
    length |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return [
    buffer.subarray(cursor, cursor + length).toString("utf8"),
    cursor + length
  ];
}

async function findNamedFile(directory, name) {
  const entries = await fs.promises.readdir(directory, {
    withFileTypes: true
  });
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (
      entry.isFile() &&
      entry.name.toLowerCase() === name.toLowerCase()
    ) {
      return candidate;
    }
    if (entry.isDirectory()) {
      const found = await findNamedFile(candidate, name);
      if (found) return found;
    }
  }
  return "";
}
