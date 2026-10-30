"use strict";
const fs=require('node:fs/promises'),path=require('node:path');
const defaultManifestDirectory=()=>path.join(process.env.ProgramData||'C:\\ProgramData','Epic','EpicGamesLauncher','Data','Manifests');

async function gtaEpicInstallCandidates({manifestDirectory=defaultManifestDirectory()}={}){
 const entries=await fs.readdir(manifestDirectory,{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
 const candidates=[];
 for(const entry of entries){
  if(!entry.isFile()||!entry.name.endsWith('.item'))continue;
  const item=await fs.readFile(path.join(manifestDirectory,entry.name),'utf8').then(JSON.parse).catch(()=>null);
  if(typeof item?.InstallLocation==='string'&&path.isAbsolute(item.InstallLocation))candidates.push(item.InstallLocation);
 }
 // Discovery checks GTA5_Enhanced.exe before accepting any manifest directory.
 return [...new Set(candidates)];
}

// Epic must provide its launch ticket. Opening PlayGTAV.exe directly bypasses
// that handoff and can show an error even while another GTA instance starts.
async function gtaEpicLaunchUrl(gamePath,{manifestDirectory=defaultManifestDirectory()}={}){
 const normalize=value=>path.resolve(value).replace(/\\/g,'/').replace(/\/+$/,'').toLowerCase();
 const selected=normalize(await fs.realpath(gamePath));
 const entries=await fs.readdir(manifestDirectory,{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
 const matches=[];
 for(const entry of entries){
  if(!entry.isFile()||!entry.name.endsWith('.item'))continue;
  const item=await fs.readFile(path.join(manifestDirectory,entry.name),'utf8').then(JSON.parse).catch(()=>null);
  if(typeof item?.InstallLocation!=='string'||!item.InstallLocation||normalize(item.InstallLocation)!==selected)continue;
  const ids=[item.CatalogNamespace,item.CatalogItemId,item.AppName];
  if(ids.some(id=>typeof id!=='string'||!/^[a-z0-9_-]{1,128}$/i.test(id)))throw Error('La fiche Epic de GTA est incomplète. Réparez son installation dans Epic Games.');
  matches.push('com.epicgames.launcher://apps/'+ids.map(encodeURIComponent).join('%3A')+'?action=launch&silent=true');
 }
 const urls=[...new Set(matches)];
 if(urls.length>1)throw Error('Plusieurs fiches Epic correspondent à ce dossier GTA. Vérifiez son installation dans Epic Games.');
 return urls[0]||'';
}
module.exports={gtaEpicLaunchUrl,gtaEpicInstallCandidates};
