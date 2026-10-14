"use strict";

/** Vérification d’intégrité et lancement masqué des outils de publication. Aucun téléversement au chargement. */
const fs = require("node:fs");
const { createHash } = require("node:crypto");
const { spawn } = require("node:child_process");

async function verifyLocalAsset(filePath, asset) {
  const stat = await fs.promises.stat(filePath).catch(() => null);
  if (!stat?.isFile()) {
    throw new Error(`source introuvable : ${filePath}`);
  }
  if (stat.size !== asset.size) {
    throw new Error(
      `taille inattendue pour ${asset.sourceName} (${stat.size} au lieu de ${asset.size})`
    );
  }
  const actualHash = await sha256File(filePath);
  if (actualHash !== asset.sha256) {
    throw new Error(`empreinte SHA-256 inattendue pour ${asset.sourceName}`);
  }
}

function run(file, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "inherit", "inherit"]
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${file} a échoué avec le code ${code}`));
    });
  });
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

module.exports = { verifyLocalAsset, run, sha256File };

