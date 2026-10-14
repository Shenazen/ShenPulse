"use strict";

/** Recherche des fichiers des émulateurs ; valide les racines et applique le prédicat facultatif. */
const fs = require("node:fs");
const path = require("node:path");

async function assertFile(filePath, message) {
  const stat = filePath
    ? await fs.promises.stat(filePath).catch(() => null)
    : null;
  if (!stat?.isFile()) throw new Error(message);
}

async function findNamedFile(directory, fileName, predicate = null) {
  const root = path.resolve(String(directory || ""));
  const stat = await fs.promises.stat(root).catch(() => null);
  if (!stat?.isDirectory()) return "";
  const entries = await fs.promises.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const candidate = path.join(root, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
      if (!predicate || predicate(candidate)) return candidate;
    }
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = await findNamedFile(path.join(root, entry.name), fileName, predicate);
    if (match) return match;
  }
  return "";
}

module.exports = { assertFile, findNamedFile };

