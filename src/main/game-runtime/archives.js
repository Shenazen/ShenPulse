"use strict";

/** Extraction sécurisée des archives, sans sortie du répertoire cible. Les opérations et garde-fous restent identiques. */
const fs = require("node:fs");
const { runProcess } = require("./processes");

async function extractArchiveSafe(archivePath, destinationPath) {
  const listing = await runProcess("tar.exe", ["-tf", archivePath]);
  const entries = listing.split(/\r?\n/).filter(Boolean);
  if (!entries.length) throw new Error("Archive vide ou illisible.");
  for (const entry of entries) {
    const normalized = entry.replace(/\\/g, "/");
    if (
      normalized.startsWith("/") ||
      /^[a-zA-Z]:/.test(normalized) ||
      normalized.split("/").includes("..")
    ) {
      throw new Error("Archive refusée : un chemin sort de la destination.");
    }
  }
  await fs.promises.mkdir(destinationPath, { recursive: true });
  await runProcess("tar.exe", [
    "-xf",
    archivePath,
    "-C",
    destinationPath
  ]);
}

module.exports = {
  extractArchiveSafe,
};

