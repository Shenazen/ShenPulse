"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { commitInstallationDeployment } = require("./deployments");
const LAUNCHER = "ShenPulse-Terraria.cmd";
const fileExists = async file => (await fs.stat(file).catch(error => { if (error.code === "ENOENT") return null; throw error; }))?.isFile();

function terrariaProfile(userDataPath) {
  if (!userDataPath || !path.isAbsolute(userDataPath)) throw new Error("Le profil ShenPulse de Terraria est introuvable. Réinstallez les interactions.");
  return path.join(userDataPath, "game-profiles", "terraria");
}
function batchLiteral(value) {
  if (!path.isAbsolute(value) || /["\r\n\0]/.test(value)) throw new Error("Chemin de lancement Terraria invalide.");
  return value.replace(/%/g, "%%");
}
function launchScript(root, profile) {
  return ["@echo off", "setlocal DisableDelayedExpansion", 'cd /D "' + batchLiteral(root) + '"',
    // Official standalone / family-share launch mode, with unchanged Steam licence checks.
    "set SteamClientLaunch=1", 'start-tModLoader.bat -tmlsavedirectory "' + batchLiteral(profile) + '"', ""].join("\r\n");
}
async function assertProfileDirectory(profile, userDataPath) {
  const actual = await fs.realpath(profile), owner = await fs.realpath(userDataPath);
  const relative = path.relative(owner, actual);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Le profil Terraria sort du dossier ShenPulse.");
  for (const folder of [profile, path.join(profile,"Mods")]) {
    const entry = await fs.lstat(folder).catch(error => { if(error.code === "ENOENT") return null; throw error; });
    if (entry?.isSymbolicLink()) throw new Error("Le dossier des interactions Terraria a été redirigé. Réinstallez dans un profil ShenPulse valide.");
  }
}
async function terrariaManualLauncher(gameId, root, userDataPath) {
  if (gameId !== "terraria") return "";
  const profile = terrariaProfile(userDataPath);
  const wrapper = path.join(profile, LAUNCHER);
  const current = await fs.readFile(wrapper, "utf8").catch(error => { if(error.code === "ENOENT") return ""; throw error; });
  if (current !== launchScript(root, profile)) throw new Error("Réinstallez les interactions Terraria depuis ShenPulse pour préparer le lanceur.");
  await assertProfileDirectory(profile, userDataPath);
  return wrapper;
}
async function preserveSaves(profile, original, assertAccess) {
  for (const name of ["Players", "Worlds"]) {
    const destination = path.join(profile, name), source = path.join(original, name);
    const present = await fs.lstat(destination).catch(error => { if(error.code === "ENOENT") return null; throw error; });
    const existingSource = await fs.stat(source).catch(error => { if(error.code === "ENOENT") return null; throw error; });
    if (present?.isSymbolicLink()) {
      if (!existingSource?.isDirectory() || await fs.realpath(destination) !== await fs.realpath(source)) throw new Error("Le dossier des sauvegardes Terraria a été redirigé vers un autre emplacement. Vos sauvegardes sont conservées ; vérifiez ce profil avant de réinstaller.");
    } else if (present && !present.isDirectory()) throw new Error("Le dossier des sauvegardes Terraria est invalide.");
    else if (!present) {
      assertAccess();
      if (existingSource?.isDirectory()) await fs.symlink(source, destination, "junction");
      else await fs.mkdir(destination, {recursive:true});
    }
    // Never replace an existing profile's saves, even when the old profile appears later.
  }
}
async function configureTerrariaMod({ gameId, targetPath, documentsPath, userDataPath, backupRoot, tempRoot, assertAccess = () => {} }) {
  if (gameId !== "terraria") return;
  const profile = terrariaProfile(userDataPath), original = path.join(documentsPath,"My Games/Terraria/tModLoader");
  for (const file of ["tModLoader.dll","start-tModLoader.bat","dotnet/dotnet.exe","Mods/ShenPulseTerraria.tmod"]) {
    if (!await fileExists(path.join(targetPath,file))) throw new Error("Le pack Terraria est incomplet : " + file);
  }
  assertAccess(); await fs.mkdir(profile, {recursive:true}); await assertProfileDirectory(profile,userDataPath);
  const prepared = path.join(tempRoot,"terraria-profile-"+require("node:crypto").randomBytes(4).toString("hex")), mods = path.join(prepared,"Mods");
  await fs.mkdir(mods,{recursive:true});
  const readEnabled = folder => fs.readFile(path.join(folder,"Mods/enabled.json"),"utf8").catch(error => { if(error.code === "ENOENT") return null; throw error; });
  const previous = await readEnabled(profile) ?? await readEnabled(original) ?? "[]";
  let enabled;
  try { enabled = JSON.parse(previous.replace(/^\uFEFF/,"")); } catch { throw new Error("La liste des mods tModLoader est illisible. Corrigez enabled.json avant de réessayer."); }
  if (!Array.isArray(enabled) || enabled.some(name=>typeof name!=="string")) throw new Error("La liste des mods tModLoader est invalide.");
  for (const name of enabled) {
    if (["CrowdControlMod","ShenPulseTerraria"].includes(name) || !/^[a-z0-9_-]+$/i.test(name)) continue;
    const existing = path.join(profile,"Mods",name+".tmod"), source = path.join(original,"Mods",name+".tmod");
    if (!await fileExists(existing) && await fileExists(source)) { assertAccess(); await fs.copyFile(source,path.join(mods,name+".tmod")); }
  }
  assertAccess(); await fs.copyFile(path.join(targetPath,"Mods/ShenPulseTerraria.tmod"),path.join(mods,"ShenPulseTerraria.tmod"));
  const next = [...new Set([...enabled.filter(name=>name!=="CrowdControlMod"),"ShenPulseTerraria"])];
  await fs.writeFile(path.join(mods,"enabled.json"),JSON.stringify(next,null,2)+"\n");
  await fs.writeFile(path.join(prepared,LAUNCHER),launchScript(targetPath,profile));
  for (const name of ["config.json","input profiles.json","favorites.json","achievements.dat"]) {
    if (!await fileExists(path.join(profile,name)) && await fileExists(path.join(original,name))) { assertAccess(); await fs.copyFile(path.join(original,name),path.join(prepared,name)); }
  }
  if (!(await fs.stat(path.join(profile,"ModConfigs")).catch(()=>null)) && (await fs.stat(path.join(original,"ModConfigs")).catch(()=>null))?.isDirectory()) {
    assertAccess(); await fs.cp(path.join(original,"ModConfigs"),path.join(prepared,"ModConfigs"),{recursive:true,filter:async source=>!(await fs.lstat(source)).isSymbolicLink()});
  }
  // AppData stores the mod list. Only read the protected Documents directory;
  // the game's existing save folders stay in place via directory junctions.
  await preserveSaves(profile,original,assertAccess);
  await commitInstallationDeployment({deploymentRoot:prepared,targetPath:profile,backupRoot:path.join(backupRoot,"profile"),tempRoot,retiredFiles:["Mods/CrowdControlMod.tmod"],assertAccess});
  return profile;
}
module.exports = {terrariaManualLauncher,configureTerrariaMod,terrariaProfile,launchScript,LAUNCHER};
