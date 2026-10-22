"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { runProcess } = require("./processes");
const { safeChildPath } = require("./paths");

const NATIVE_MODULES = Object.freeze({
  "escape-from-duckov": {
    relative: "Mods/CrowdControl.dll", port: 58440, offset: 7277,
    original: "d79d1dfaac4b3a63d936a976fa2827acb58b13aa2404cd62b05122aa3340a00c",
    patched: "c15b9725ebc983c9d809d7acfca48529c48e283102031a0e725fa7dfe6273f9e"
  },
  dredge: {
    relative: "BepInEx/plugins/Crowdcontrol/CrowdControl.dll", port: 58438, offset: 2759,
    original: "bbd11c154494b9e777c007752ee3f30efbba675e888291ddcacb836c9753b2ca",
    patched: "c8bcb789571e346101cb5d6a0e3b296997ab86144677190362a660714e268103"
  },
  "egging-on": {
    relative: "Mods/CrowdControl.dll", port: 58439, offset: 4990,
    original: "930994fcfefa24541d173678dbaeb98fca0c39b2f41fb803c1d7795edbfa323d",
    patched: "6879d5dac66578f0a56a9c504ea5096c7dbc519774c4288e9009a28081508efc"
  }
});
const FALLOUT_DLC = Object.freeze([
  "DLCRobot.esm", "DLCworkshop01.esm", "DLCworkshop02.esm",
  "DLCworkshop03.esm", "DLCCoast.esm", "DLCNukaWorld.esm"
]);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

async function detectDredgeArchitecture(targetPath) {
  const handle = await fs.open(path.join(targetPath, "UnityPlayer.dll"), "r");
  try {
    const header = Buffer.alloc(64), machine = Buffer.alloc(6);
    await handle.read(header, 0, header.length, 0);
    if (header.toString("ascii", 0, 2) !== "MZ") throw new Error("UnityPlayer.dll n’est pas un exécutable Windows valide.");
    await handle.read(machine, 0, machine.length, header.readUInt32LE(0x3c));
    if (machine.toString("ascii", 0, 4) !== "PE\0\0") throw new Error("En-tête UnityPlayer.dll invalide.");
    if (machine.readUInt16LE(4) === 0x8664) return "x64";
    if (machine.readUInt16LE(4) === 0x14c) return "x86";
    throw new Error("L’architecture DREDGE n’est pas prise en charge.");
  } finally { await handle.close(); }
}

async function detectDredgeEdition(targetPath) {
  const architecture = await detectDredgeArchitecture(targetPath);
  const config = await fs.readFile(path.join(targetPath, "MicrosoftGame.config"), "utf8").catch(() => "");
  return /Name="Team17DigitalLimited\.ProjectShoal"/i.test(config) ? "gamepass" : architecture;
}

/** Seule la constante du port IL est adaptée, dans deux modules aux empreintes figées.
 * Les trois jeux Unity peuvent ainsi rester ouverts sans recevoir les effets d’un autre jeu. */
function dedicateModulePort(bytes, spec) {
  if (digest(bytes) !== spec.original || bytes[spec.offset - 1] !== 0x20 || bytes.readInt32LE(spec.offset) !== 51337) {
    throw new Error("La version du module d’interactions a changé. Aucun fichier du jeu n’a été remplacé.");
  }
  const result = Buffer.from(bytes);
  result.writeInt32LE(spec.port, spec.offset);
  if (digest(result) !== spec.patched) throw new Error("La vérification du module adapté a échoué.");
  return result;
}

async function validateFourGamesTarget(targetPath, manifest, { platform = process.platform, execute = runProcess } = {}) {
  if (["DREDGE", "Egging On"].includes(manifest.title)) {
    const actual = await fs.realpath(targetPath);
    if (/[\\/]WindowsApps[\\/]/i.test(actual)) {
      throw new Error("Ce jeu est installé dans WindowsApps, un dossier protégé. Depuis l’application Xbox, déplacez-le vers un dossier XboxGames modifiable puis réessayez.");
    }
  }
  if (manifest.preflight !== "fallout-4") return;
  if (await fs.stat(path.join(targetPath, "MicrosoftGame.config")).catch(() => null)) {
    throw new Error("Fallout 4 Xbox / Game Pass n’est pas compatible avec F4SE. Les interactions officielles nécessitent l’édition Steam 1.11.240 et les six DLC. Aucun fichier n’a été modifié.");
  }
  const missing = [];
  for (const name of FALLOUT_DLC) if (!(await fs.stat(path.join(targetPath, "Data", name)).catch(() => null))?.isFile()) missing.push(name);
  if (missing.length) throw new Error(`Les six DLC de Fallout 4 sont requis. Fichiers manquants : ${missing.join(", ")}.`);
  for (const name of ["steam_api64.dll", "f4se_loader.exe", "f4se_1_11_240.dll"]) {
    if (!(await fs.stat(path.join(targetPath, name)).catch(() => null))?.isFile()) {
      throw new Error("Installez Fallout 4 Steam 1.11.240 et F4SE 0.7.9 depuis https://f4se.silverlock.org/ avant d’installer le module ShenPulse.");
    }
  }
  if (platform === "win32") {
    const encoded = Buffer.from(path.join(targetPath, "Fallout4.exe"), "utf8").toString("base64");
    const version = await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      `$taskExe = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')); [Diagnostics.FileVersionInfo]::GetVersionInfo($taskExe).FileVersion`]);
    if (!/^1[.,]11[.,]240(?:[.,\s]|$)/.test(String(version).trim())) {
      throw new Error("Ce module nécessite Fallout 4 Steam 1.11.240. Mettez le jeu et F4SE à jour avant de réessayer.");
    }
  }
}

async function stageFourGamesInstallation({ gameId, targetPath, deploymentRoot, edition, assertAccess = () => {} }) {
  assertAccess();
  const spec = NATIVE_MODULES[gameId];
  if (spec) {
    const file = safeChildPath(deploymentRoot, spec.relative);
    const bytes = await fs.readFile(file);
    assertAccess();
    await fs.writeFile(file, dedicateModulePort(bytes, spec));
  }
  if (gameId === "dredge" && edition === "gamepass") {
    return require("./dredge-installation").stageDredgeManagedLoader({ targetPath, deploymentRoot, assertAccess });
  }
  if (["egging-on", "escape-from-duckov"].includes(gameId)) {
    // Une réparation conserve les préférences de l’utilisateur et des autres mods.
    for (const relative of ["UserData/MelonPreferences.cfg", "UserData/Loader.cfg"]) {
      const current = await fs.readFile(safeChildPath(targetPath, relative)).catch(() => null);
      if (current) { assertAccess(); await fs.mkdir(path.dirname(safeChildPath(deploymentRoot, relative)), { recursive: true }); await fs.writeFile(safeChildPath(deploymentRoot, relative), current); }
    }
  }
  if (gameId === "fallout-4") {
    assertAccess();
    await fs.rename(safeChildPath(deploymentRoot, "Data/ccver"), safeChildPath(deploymentRoot, "ccver"));
  }
}

/** Le choix du processus est dérivé du dossier préparé, jamais d’un champ libre. */
function deadByDaylightProcess(installation) {
  if (installation?.path && require("node:fs").existsSync(path.join(installation.path, "DeadByDaylight/Binaries/WinGDK/DeadByDaylight-WinGDK-Shipping.exe"))) {
    return "DeadByDaylight-WinGDK-Shipping.exe";
  }
  return "DeadByDaylight-Win64-Shipping.exe";
}

module.exports = { NATIVE_MODULES, FALLOUT_DLC, dedicateModulePort, detectDredgeArchitecture, detectDredgeEdition, validateFourGamesTarget, stageFourGamesInstallation, deadByDaylightProcess };
