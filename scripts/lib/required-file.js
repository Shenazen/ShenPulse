"use strict";

/** Recherche récursive obligatoire : ignore les sous-répertoires invalides, échoue si le fichier est absent. */
const fs = require("node:fs");
const path = require("node:path");

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

module.exports = { findNamedFile };

