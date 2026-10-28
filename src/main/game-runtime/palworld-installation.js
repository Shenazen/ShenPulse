"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { randomBytes, createHash } = require("node:crypto");
const { safeChildPath } = require("./paths");

const PALWORLD_VERSION = "1.0.0";
const PALWORLD_PLATFORMS = { steamAppIds: ["1623730"], xboxIdentity: "PocketpairInc.Palworld" };

async function palworldBinaryDirectory(target, platform = "") {
  const candidates = platform === "steam" ? ["Win64"] : platform === "xbox" ? ["WinGDK"] : ["WinGDK", "Win64"];
  for (const edition of candidates) {
    const relative = "Pal/Binaries/" + edition;
    const name = "Palworld-" + edition + "-Shipping.exe";
    if ((await fs.stat(safeChildPath(target, relative + "/" + name)).catch(() => null))?.isFile()) return relative;
  }
  throw new Error("L’exécutable Palworld est introuvable. Sélectionnez la racine Steam ou le dossier Content de Xbox / Game Pass.");
}

async function palworldInstallationPath(target) {
  const platform = await require("./installation-platform").installationPlatform(target, PALWORLD_PLATFORMS);
  return safeChildPath(target, await palworldBinaryDirectory(target, platform));
}

async function stagePalworldInstallation({ gameId, targetPath, deploymentRoot, assertAccess = () => {} }) {
  if (gameId !== "palworld") return null;
  assertAccess();
  const platform = await require("./installation-platform").installationPlatform(targetPath, PALWORLD_PLATFORMS);
  const relative = await palworldBinaryDirectory(targetPath, platform);
  const root = safeChildPath(deploymentRoot, relative);
  await fs.mkdir(root, { recursive: true });
  for (const name of ["dwmapi.dll", "ue4ss", "shenpulse-module.json", "THIRD-PARTY-NOTICES.txt"]) {
    await fs.rename(safeChildPath(deploymentRoot, name), path.join(root, name));
  }
  const mods = path.join(root, "ue4ss/Mods");
  const current = safeChildPath(targetPath, relative + "/ue4ss/Mods");
  const oldText = await fs.readFile(path.join(current, "mods.txt"), "utf8").catch(() => "");
  const preserved = oldText.split(/\r?\n/).filter(line => !/^\s*(ShenPulse|CrowdControl)\s*:/i.test(line));
  await fs.writeFile(path.join(mods, "mods.txt"), preserved.join("\n") + "\nShenPulse : 1\n");
  const oldJson = await fs.readFile(path.join(current, "mods.json"), "utf8").then(JSON.parse).catch(() => []);
  if (!Array.isArray(oldJson)) throw new Error("La liste des modules UE4SS est invalide. Corrigez mods.json avant l’installation.");
  await fs.writeFile(path.join(mods, "mods.json"), JSON.stringify([
    ...oldJson.filter(entry => !/^(ShenPulse|CrowdControl)$/i.test(entry.mod_name || "")),
    { mod_name: "ShenPulse", mod_enabled: true }
  ], null, 2));
  await fs.writeFile(path.join(mods, "ShenPulse/bridge.json"), JSON.stringify({ gameId, token: randomBytes(32).toString("hex") }));
  const manifestPath = path.join(root, "shenpulse-module.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  if (manifest.gameId !== gameId || manifest.version !== PALWORLD_VERSION || !Array.isArray(manifest.files)) throw new Error("Le pack Palworld ne correspond pas au module attendu.");
  for (const file of ["ue4ss/Mods/mods.txt", "ue4ss/Mods/mods.json"]) {
    const bytes = await fs.readFile(safeChildPath(root, file));
    manifest.files = manifest.files.filter(entry => entry.file !== file);
    manifest.files.push({ file, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  assertAccess();
  return { retiredFiles: [
    ...["enabled.txt", "ccver", "Scripts/main.lua", "dlls/main.dll"].map(file => relative + "/ue4ss/Mods/CrowdControl/" + file),
    ...["qa.lua", "request.lua", "result.json", "ready.json", "native-state.json"].map(file => relative + "/ue4ss/Mods/ShenPulse/" + file)
  ] };
}

async function assertPalworldModuleReady(gameId, targetPath) {
  if (gameId !== "palworld") return;
  const root = await palworldInstallationPath(targetPath);
  const manifest = await fs.readFile(path.join(root, "shenpulse-module.json"), "utf8").then(JSON.parse).catch(() => null);
  if (manifest?.gameId !== gameId || manifest.version !== PALWORLD_VERSION || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error("Installez ou mettez à jour les interactions Palworld depuis ShenPulse.");
  for (const entry of manifest.files) {
    const bytes = await fs.readFile(safeChildPath(root, entry.file)).catch(() => null);
    if (!bytes || createHash("sha256").update(bytes).digest("hex") !== entry.sha256) throw new Error("Un fichier du module Palworld est absent ou modifié. Réinstallez les interactions.");
  }
  await new (require("../shop-game-bridge").ShopGameBridge)({ gameId, installationPath: root }).config();
}

module.exports = { PALWORLD_VERSION, PALWORLD_PLATFORMS, palworldBinaryDirectory, palworldInstallationPath, stagePalworldInstallation, assertPalworldModuleReady };
