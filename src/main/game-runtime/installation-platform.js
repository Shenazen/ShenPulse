"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const PLATFORM_LABELS = Object.freeze({ steam: "Steam", xbox: "Xbox / Game Pass" });
const supportsPlatformChoice = manifest => Boolean(manifest.xboxIdentity && manifest.steamAppIds?.length);

async function installationPlatform(directory, manifest) {
  if (!supportsPlatformChoice(manifest)) return "";
  if (/[\\/]steamapps[\\/]common[\\/]/i.test(path.resolve(directory) + path.sep)) return "steam";
  const config = await fs.readFile(path.join(directory, "MicrosoftGame.Config"), "utf8").catch(() => "");
  if (config.match(/<Identity\s+Name="([^"]+)"/i)?.[1] === manifest.xboxIdentity) return "xbox";
  if ((await fs.stat(path.join(directory, "gamelaunchhelper.exe")).catch(() => null))?.isFile()) return "xbox";
  return "";
}

async function canonicalPath(value) {
  const resolved = await fs.realpath(value).catch(() => path.resolve(value));
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/** Une fenêtre de l’autre édition ne doit jamais valider le lancement demandé. */
async function assertRunningInstallation(existing, installation, manifest) {
  if (!existing || !supportsPlatformChoice(manifest)) return;
  const root = await canonicalPath(installation.path);
  for (const running of existing.processes || [existing]) {
    if (!running.ExecutablePath) throw new Error(
      "Impossible de vérifier l’édition du jeu déjà ouverte. Fermez le jeu puis relancez-le depuis ShenPulse."
    );
    const relative = path.relative(root, await canonicalPath(running.ExecutablePath));
    if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
      const label = PLATFORM_LABELS[installation.platform] || "l’installation choisie";
      throw new Error(
        manifest.title + " est déjà ouvert depuis une autre installation. Fermez cette édition puis relancez " + label + " depuis ShenPulse."
      );
    }
  }
}

module.exports = { PLATFORM_LABELS, supportsPlatformChoice, installationPlatform, canonicalPath, assertRunningInstallation };
