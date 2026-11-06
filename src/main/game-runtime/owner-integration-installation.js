"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const {enableSimsScripts} = require("./sims-managed-profile");
const modules = require("../../../resources/catalogs/owner-prepared-modules.json");

async function verifyFile(file, expected) {
  const bytes = await fs.readFile(file).catch(() => null);
  if (!bytes || createHash("sha256").update(bytes).digest("hex") !== expected) {
    throw new Error("Le module local doit être installé ou réparé depuis ShenPulse avant de lancer cette édition du jeu.");
  }
}

async function assertOwnerIntegrationReady(gameId, targetPath, {documentsPath,localAppDataPath,programDataPath=process.env.ProgramData} = {}) {
  let definition = modules[gameId];
  if (!definition) return;
  if(definition.platformModules){
    const {installationPlatform}=require("./installation-platform");
    const platform=await installationPlatform(targetPath,definition.installer||{});
    if(definition.platformModules[platform])definition=definition.platformModules[platform];
  }
  await verifyFile(path.join(targetPath, definition.module), definition.moduleSha256);
  for (const [file,hash] of Object.entries(definition.moduleDependencies || {})) await verifyFile(path.join(targetPath,file),hash);
  if (gameId === "brotato") await require("./brotato-gamepass").assertBrotatoReady(targetPath);
  if (["peggle-deluxe","peggle-nights"].includes(gameId) && documentsPath) {
    if (!programDataPath || !path.isAbsolute(programDataPath)) throw Error("Le dossier du chargeur Peggle est introuvable.");
    const loader=await fs.readFile(path.join(targetPath,"ddraw.dll"));await verifyFile(path.join(programDataPath,"PopCap Games/Peggle/ddraw.dll"),createHash("sha256").update(loader).digest("hex"));
  }
  if (gameId === "farming-simulator-25" && documentsPath) {
    const profile = await require("./farming-managed-profile").farmingRuntimeProfile(targetPath, { documentsPath, localAppDataPath });
    await verifyFile(path.join(profile.modsDirectory, "FS25_ShenPulse.zip"), definition.moduleSha256);
  }
  if (gameId === "the-sims-4" && documentsPath) {
    const profile = await require("./sims-managed-profile").assertSimsRuntimeProfile(targetPath, {documentsPath,localAppDataPath});
    await verifyFile(path.join(profile.modsDirectory, "ShenPulse.ts4script"), definition.moduleSha256);
    const options = await fs.readFile(path.join(profile.directory, "Options.ini"), "utf8").catch(() => "");
    if (!/^scriptmodsenabled\s*=\s*1\s*$/im.test(options) || !/^modsdisabled\s*=\s*0\s*$/im.test(options)) {
      throw new Error("Les scripts de mods sont désactivés dans Les Sims 4. Réinstallez les interactions ou activez-les dans Options du jeu → Autres, puis redémarrez le jeu.");
    }
  }
}

async function configureOwnerIntegration(gameId, {targetPath, documentsPath, localAppDataPath, backupRoot, assertAccess = () => {}}) {
  if (gameId === "farming-simulator-25") {
    const profile = await require("./farming-managed-profile").prepareFarmingRuntimeProfile(targetPath, {
      documentsPath, localAppDataPath, modulePath: path.join(targetPath, modules[gameId].module), moduleSha256: modules[gameId].moduleSha256, assertAccess
    });
    const destination = path.join(profile.modsDirectory, "FS25_ShenPulse.zip");
    if (profile.managed) return [{ root: "farming-managed-profile", path: destination, profileDirectory: profile.directory, importedFrom: profile.sourceDirectory }];
    await require("./deployments").copyWithBackup(path.join(targetPath, modules[gameId].module), destination,
      profile.modsDirectory, path.join(backupRoot, "farming-mods"), { assertAccess });
    return [{ root: "farming-mods", path: destination }];
  }
  if (gameId !== "the-sims-4") return;
  const profile = await require("./sims-managed-profile").prepareSimsRuntimeProfile(targetPath, {
    documentsPath,localAppDataPath,backupRoot,assertAccess,
    modulePath:path.join(targetPath,modules[gameId].module),moduleSha256:modules[gameId].moduleSha256
  });
  return [{root:"sims-managed-profile",path:path.join(profile.modsDirectory,"ShenPulse.ts4script"),profileDirectory:profile.directory}];
}

module.exports = {assertOwnerIntegrationReady, configureOwnerIntegration, enableSimsScripts};
