"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { runProcess } = require("./processes");
const { safeChildPath } = require("./paths");
const { createHash } = require("node:crypto");
const KNOWN_PROXIES = new Set([
  "0d94f31d67437b393b491572204fc3dd952fce92559625afe85a1e5294544b22",
  "8c6cdbc38836dee87e3368f5de1994d7c0ccebf29e4ce7aba3c0981f9375412c",
  "0f39399eba05dea9419781187ae2a6b0555afcdf1859f1319b6213be7729013b"
]);

/** Préparation entièrement isolée ; le déploiement sauvegarde ensuite chaque
 * fichier remplacé. Le .bak original permet les réparations du patch géré. */
async function stageDredgeManagedLoader({ targetPath, deploymentRoot, assertAccess = () => {}, execute = runProcess }) {
  const relative = "DREDGE_Data/Managed";
  const managed = safeChildPath(deploymentRoot, relative);
  const source = safeChildPath(targetPath, relative);
  const tools = safeChildPath(deploymentRoot, ".shenpulse-dredge-patcher");
  assertAccess();
  const retiredFiles = [];
  for (const name of ["winhttp.dll", "version.dll"]) {
    const bytes = await fs.readFile(safeChildPath(targetPath, name)).catch(error => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!bytes) continue;
    if (!KNOWN_PROXIES.has(createHash("sha256").update(bytes).digest("hex"))) {
      throw new Error(`Un chargeur tiers ${name} est présent. Désactivez-le avant d’installer le module DREDGE Xbox. Aucun fichier n’a été remplacé.`);
    }
    retiredFiles.push(name);
  }
  await fs.mkdir(managed, { recursive: true });
  const current = await fs.readFile(path.join(source, "UnityEngine.CoreModule.dll"));
  await fs.writeFile(path.join(managed, "UnityEngine.CoreModule.dll"), current);
  if (current.includes(Buffer.from("BepInEx.Bootstrap"))) {
    // Ne restaurer un .bak que pour notre entrée déjà appliquée, jamais pour
    // effacer un constructeur ajouté par un autre mod.
    await fs.copyFile(path.join(source, "UnityEngine.CoreModule.dll.bak"), path.join(managed, "UnityEngine.CoreModule.dll.bak"));
  }
  await fs.copyFile(path.join(source, "mscorlib.dll"), path.join(managed, "mscorlib.dll"));
  await fs.copyFile(safeChildPath(deploymentRoot, "BepInEx/core/Mono.Cecil.dll"), path.join(tools, "Mono.Cecil.dll"));
  assertAccess();
  await execute(path.join(tools, "BepInEx.Patcher.exe"), [path.join(managed, "UnityEngine.CoreModule.dll")]);
  const patched = await fs.readFile(path.join(managed, "UnityEngine.CoreModule.dll"));
  if (!patched.includes(Buffer.from("BepInEx.Bootstrap"))) {
    throw new Error("L’entrée DREDGE n’a pas pu être préparée. Aucun fichier du jeu n’a été remplacé.");
  }
  assertAccess();
  await fs.copyFile(path.join(tools, "BepInEx.Bootstrap.dll"), path.join(managed, "BepInEx.Bootstrap.dll"));
  await fs.unlink(path.join(managed, "mscorlib.dll"));
  await fs.rm(tools, { recursive: true, force: true });
  // Le chargeur géré remplace le proxy natif, qui gêne le lanceur GDK.
  await fs.unlink(safeChildPath(deploymentRoot, "winhttp.dll"));
  await fs.unlink(safeChildPath(deploymentRoot, "doorstop_config.ini"));
  return { retiredFiles };
}

module.exports = { stageDredgeManagedLoader };
