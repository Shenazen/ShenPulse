"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const {createHash, randomBytes} = require("node:crypto");
const preparing = new Map();
const MARKER = ".shenpulse-profile.json";
const canonical = value => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
const inside = (root, file) => { const rel=path.relative(canonical(root),canonical(file)); return !rel || (!rel.startsWith(".."+path.sep) && rel!==".." && !path.isAbsolute(rel)); };
const missing = error => {if(error.code!=="ENOENT")throw error;return null;};

async function simsRuntimeProfile(targetPath, {documentsPath,localAppDataPath=process.env.LOCALAPPDATA}={}) {
  if(!documentsPath || !localAppDataPath || !path.isAbsolute(documentsPath) || !path.isAbsolute(localAppDataPath)) throw Error("Les dossiers du profil Sims sont introuvables.");
  const acf=await fs.readFile(path.resolve(targetPath,"../../appmanifest_1222670.acf"),"utf8").catch(error=>{if(error.code!=="ENOENT")throw error;return "";});
  const language=acf.match(/"language"\s+"([a-z-]+)"/i)?.[1]?.toLowerCase() || "english";
  const folder={french:"Les\u00a0Sims\u00a04",german:"Die Sims 4",spanish:"Los Sims 4",dutch:"De Sims 4"}[language] || "The Sims 4";
  const directory=path.join(localAppDataPath,"ShenPulse/game-profiles/the-sims-4/steam");
  const sourceDirectory=path.join(documentsPath,"Electronic Arts",folder);
  // Reject redirected local storage, including links hidden in parent folders.
  let parent=directory;
  while(inside(localAppDataPath,parent) && canonical(parent)!==canonical(localAppDataPath)) {
    const stat=await fs.lstat(parent).catch(missing);
    if(stat?.isSymbolicLink())throw Error("Le profil Sims local contient un lien inattendu. Les fichiers ont été conservés.");
    parent=path.dirname(parent);
  }
  return {directory,sourceDirectory,modsDirectory:path.join(directory,"Mods/ShenPulse"),language};
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

async function copyProfile(source,destination,assertAccess) {
  assertAccess(); const stat=await fs.lstat(source);
  if(stat.isSymbolicLink())throw Error("Le profil Sims contient un lien à vérifier avant son import : "+source);
  if(stat.isDirectory()) { await fs.mkdir(destination,{recursive:true}); for(const name of await fs.readdir(source)) await copyProfile(path.join(source,name),path.join(destination,name),assertAccess); }
  else if(stat.isFile()){await fs.copyFile(source,destination,fs.constants.COPYFILE_EXCL);await fs.utimes(destination,stat.atime,stat.mtime);}
}

async function readMarker(profile) {
  const raw=await fs.readFile(path.join(profile.directory,MARKER),"utf8").catch(missing);
  if(!raw)return null;
  const marker=JSON.parse(raw);
  if(marker.version!==1 || marker.game!=="the-sims-4" || typeof marker.documentsPath!=="string" || !path.isAbsolute(marker.documentsPath) || canonical(marker.documentsPath)!==canonical(path.dirname(path.dirname(profile.sourceDirectory))))throw Error("Le reçu du profil Sims ne correspond pas à ce compte Windows.");
  return marker;
}

async function assertSimsRuntimeProfile(targetPath,options) {
  const profile=await simsRuntimeProfile(targetPath,options);
  if(!await readMarker(profile))throw Error("Installez les interactions Sims pour préparer leur profil local.");
  const source=await fs.lstat(profile.sourceDirectory).catch(missing);
  if(!source?.isSymbolicLink() || canonical(await fs.realpath(profile.sourceDirectory))!==canonical(profile.directory))throw Error("Le profil des Sims a changé. Réinstallez les interactions avant de lancer le jeu.");
  return profile;
}

async function configureSimsRuntimeProfile(targetPath,{modulePath,moduleSha256,backupRoot,assertAccess=()=>{},assertClosed,...options}={}) {
  const profile=await simsRuntimeProfile(targetPath,options);
  const bytes=await fs.readFile(modulePath);
  if(!/^[a-f0-9]{64}$/.test(moduleSha256||"") || createHash("sha256").update(bytes).digest("hex")!==moduleSha256)throw Error("Le module Sims doit être réparé depuis ShenPulse.");
  await (assertClosed || (()=>require("./mod-installation-ready").assertModGameClosed("the-sims-4",targetPath)))();
  const original=await fs.lstat(profile.sourceDirectory).catch(missing);
  let marker=await readMarker(profile);
  if(original?.isSymbolicLink() && canonical(await fs.realpath(profile.sourceDirectory))!==canonical(profile.directory))throw Error("Le dossier Sims utilise déjà une redirection personnelle. Ses fichiers ont été conservés.");
  if(!marker){
    if(await fs.lstat(profile.directory).catch(missing))throw Error("Un profil Sims local sans reçu existe déjà. Ses parties ont été conservées.");
    const parent=path.dirname(profile.directory);await fs.mkdir(parent,{recursive:true});
    const staging=await fs.mkdtemp(path.join(parent,"steam-import-"));
    try {
      let importedFrom=profile.sourceDirectory;
      if(original)await copyProfile(profile.sourceDirectory,staging,assertAccess);
      else {
        const legacy=path.join(options.documentsPath,"Electronic Arts/The Sims 4");
        const stat=canonical(legacy)!==canonical(profile.sourceDirectory) && await fs.lstat(legacy).catch(missing);
        if(stat){await copyProfile(legacy,staging,assertAccess);importedFrom=legacy;}
      }
      marker={version:1,game:"the-sims-4",documentsPath:options.documentsPath,importedFrom,importedAt:new Date().toISOString()};
      await fs.writeFile(path.join(staging,MARKER),JSON.stringify(marker,null,2));assertAccess();
      await fs.rename(staging,profile.directory);
    } finally {if(inside(parent,staging)&&path.basename(staging).startsWith("steam-import-"))await fs.rm(staging,{recursive:true,force:true});}
  }
  if(!original?.isSymbolicLink()){
    if(original && canonical(marker.importedFrom)!==canonical(profile.sourceDirectory))throw Error("Un nouveau profil Sims existe dans Documents. Ses parties ont été conservées ; vérifiez leur import avant de continuer.");
    const backup=original ? profile.sourceDirectory+".ShenPulse-backup-"+randomBytes(6).toString("hex") : null;
    assertAccess();if(backup)await fs.rename(profile.sourceDirectory,backup);
    try{await fs.mkdir(path.dirname(profile.sourceDirectory),{recursive:true});assertAccess();await fs.symlink(profile.directory,profile.sourceDirectory,"junction");}
    catch(error){if(backup)await fs.rename(backup,profile.sourceDirectory);throw error;}
    marker={...marker,links:{...marker.links,[profile.sourceDirectory]:backup}};
    await fs.writeFile(path.join(profile.directory,MARKER),JSON.stringify(marker,null,2));
  }
  const script=path.join(profile.modsDirectory,"ShenPulse.ts4script");
  const previous=await fs.readFile(script).catch(missing);
  if(previous&&!previous.equals(bytes)){const backup=path.join(backupRoot,"sims-module");await fs.mkdir(backup,{recursive:true});await fs.writeFile(path.join(backup,createHash("sha256").update(previous).digest("hex")+".ts4script"),previous);}
  await fs.mkdir(profile.modsDirectory,{recursive:true});assertAccess();await fs.writeFile(script,bytes);
  const ini=path.join(profile.directory,"Options.ini"),text=await fs.readFile(ini,"utf8").catch(missing)||"";
  const updated=enableSimsScripts(text);
  if(updated!==text){if(text){await fs.mkdir(path.join(backupRoot,"sims-options"),{recursive:true});await fs.writeFile(path.join(backupRoot,"sims-options/Options.ini"),text);}assertAccess();await fs.writeFile(ini,updated,"utf8");}
  return profile;
}
async function prepareSimsRuntimeProfile(targetPath,options={}) {
  const profile=await simsRuntimeProfile(targetPath,options),key=canonical(profile.directory);
  const operation=(preparing.get(key)||Promise.resolve()).catch(()=>{}).then(()=>configureSimsRuntimeProfile(targetPath,options));
  preparing.set(key,operation);
  try{return await operation;}finally{if(preparing.get(key)===operation)preparing.delete(key);}
}
module.exports={enableSimsScripts,simsRuntimeProfile,assertSimsRuntimeProfile,prepareSimsRuntimeProfile};

