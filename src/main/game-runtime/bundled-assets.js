"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { safeChildPath, sha256File } = require("./paths");
const { installationSlotPercent } = require("./housekeeping");

/** Même contrôle d'intégrité que les téléchargements, depuis les ressources de l'app. */
async function stageBundledAsset(runtime, gameId, asset, destination, { index = 0, total = 1 } = {}) {
  if (!runtime.resourcesDirectory || !Number.isSafeInteger(asset.size) || asset.size <= 0 ||
      !/^[a-f0-9]{64}$/i.test(asset.sha256 || "")) {
    throw new Error("Le fichier d’installation intégré est mal configuré.");
  }
  const source = safeChildPath(runtime.resourcesDirectory, asset.bundledPath);
  const partial = `${destination}.partial`;
  let created = false;
  try {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    // copyFile n'est pas pris en charge dans une archive Electron ASAR.
    const data = await fs.readFile(source);
    if (data.length !== asset.size) throw new Error("La taille du fichier d’installation intégré est incorrecte.");
    await fs.writeFile(partial, data, { flag: "wx" });
    created = true;
    if ((await sha256File(partial)).toLowerCase() !== asset.sha256.toLowerCase()) {
      throw new Error("Le contrôle d’intégrité du fichier d’installation intégré a échoué.");
    }
    await fs.rename(partial, destination);
    runtime.progress(gameId, {
      phase: "download", current: index + 1, total,
      percent: installationSlotPercent(index, total, 0.82), downloadPercent: 100,
      bytesReceived: asset.size, totalBytes: asset.size, indeterminate: false,
      message: `Préparation des fichiers intégrés (${index + 1}/${total})`
    });
  } finally {
    if (created) await fs.rm(partial, { force: true });
  }
}

module.exports = { stageBundledAsset };
