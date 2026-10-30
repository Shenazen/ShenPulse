"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const modules = require("../../../resources/catalogs/owner-prepared-modules.json");

async function verifyFile(file, expected) {
  const bytes = await fs.readFile(file).catch(() => null);
  if (!bytes || createHash("sha256").update(bytes).digest("hex") !== expected) {
    throw new Error("Le module local doit être installé ou réparé depuis ShenPulse avant de lancer cette édition du jeu.");
  }
}

async function assertOwnerIntegrationReady(gameId, targetPath, {documentsPath,programDataPath=process.env.ProgramData} = {}) {
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
    const profile = await require("./farming-profile").farmingProfile(targetPath, { documentsPath });
    await verifyFile(path.join(profile.modsDirectory, "FS25_ShenPulse.zip"), definition.moduleSha256);
  }
  if (gameId === "the-sims-4" && documentsPath) {
    await verifyFile(path.join(documentsPath, "Electronic Arts/The Sims 4/Mods/ShenPulse/ShenPulse.ts4script"), definition.moduleSha256);
    const options = await fs.readFile(path.join(documentsPath, "Electronic Arts/The Sims 4/Options.ini"), "utf8").catch(() => "");
    if (!/^scriptmodsenabled\s*=\s*1\s*$/im.test(options) || !/^modsdisabled\s*=\s*0\s*$/im.test(options)) {
      throw new Error("Les scripts de mods sont désactivés dans Les Sims 4. Réinstallez les interactions ou activez-les dans Options du jeu → Autres, puis redémarrez le jeu.");
    }
  }
}

function enableSimsScripts(source) {
  let text = source || "[options]\r\n";
  if (!/^\[options\]\s*$/im.test(text)) text += "\r\n[options]\r\n";
  for (const [key, value] of [["scriptmodsenabled", "1"], ["modsdisabled", "0"]]) {
    const expression = new RegExp("^" + key + "\\s*=.*$", "gim");
    if (expression.test(text)) text = text.replace(expression, key + " = " + value);
    else text = text.replace(/^(\[options\]\s*)$/im, "$1\r\n" + key + " = " + value);
  }
  return text;
}

async function configureOwnerIntegration(gameId, {targetPath, documentsPath, backupRoot, assertAccess = () => {}}) {
  if (gameId === "farming-simulator-25") {
    const profile = await require("./farming-profile").farmingProfile(targetPath, { documentsPath });
    const destination = path.join(profile.modsDirectory, "FS25_ShenPulse.zip");
    await require("./deployments").copyWithBackup(path.join(targetPath, modules[gameId].module), destination,
      profile.modsDirectory, path.join(backupRoot, "farming-mods"), { assertAccess });
    return [{ root: "farming-mods", path: destination }];
  }
  if (gameId !== "the-sims-4") return;
  const optionsPath = path.join(documentsPath, "Electronic Arts/The Sims 4/Options.ini");
  const original = await fs.readFile(optionsPath, "utf8").catch(error => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  const updated = enableSimsScripts(original);
  if (updated === original) return;
  assertAccess();
  if (original) {
    const backup = path.join(backupRoot, "sims-options/Options.ini");
    await fs.mkdir(path.dirname(backup), {recursive: true});
    await fs.copyFile(optionsPath, backup);
  }
  assertAccess();
  await fs.mkdir(path.dirname(optionsPath), {recursive: true});
  await fs.writeFile(optionsPath, updated, "utf8");
}

module.exports = {assertOwnerIntegrationReady, configureOwnerIntegration, enableSimsScripts};
