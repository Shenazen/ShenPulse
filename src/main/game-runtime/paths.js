"use strict";

/** Validation des chemins, des URL et des empreintes des fichiers. Les opérations et garde-fous restent identiques. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function safeChildPath(root, relativePath) {
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, relativePath || ".");
  const relative = path.relative(absoluteRoot, target);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Chemin d’installation non sûr.");
  }
  return target;
}

function safeInstallerAssetUrl(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  let url;
  try {
    url = new URL(source);
  } catch {
    throw new Error("URL de téléchargement d’installation invalide.");
  }
  if (
    url.protocol !== "https:" ||
    !(
      url.hostname === "backblazeb2.com" ||
      url.hostname.endsWith(".backblazeb2.com") ||
      url.hostname === "one-click.crowdcontrol.live" ||
      url.hostname === "builds.dotnet.microsoft.com"
    )
  ) {
    throw new Error("Hôte de téléchargement d’installation non autorisé.");
  }
  return url.href;
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
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
      const found = await findNamedFile(candidate, name);
      if (found) return found;
    }
  }
  return "";
}

async function findLaunchTarget(directory, names, recursive = true) {
  for (const name of names) {
    const candidate = path.join(directory, name);
    if ((await fs.promises.stat(candidate).catch(() => null))?.isFile()) {
      return candidate;
    }
  }
  if (!recursive) return "";
  const entries = await fs.promises
    .readdir(directory, { withFileTypes: true })
    .catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const found = await findLaunchTarget(path.join(directory, entry.name), names, false);
    if (found) return found;
  }
  return "";
}

async function existingFile(filePath) {
  const stat = await fs.promises.stat(filePath).catch(() => null);
  return stat?.isFile() ? filePath : "";
}

module.exports = {
  safeChildPath,
  safeInstallerAssetUrl,
  sha256File,
  findNamedFile,
  findLaunchTarget,
  existingFile,
};

