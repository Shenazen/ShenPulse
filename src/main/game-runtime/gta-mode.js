"use strict";
const fs=require("node:fs/promises");
const path=require("node:path");
const {detectGtaEdition}=require("./gta-save");
const GTA_IDS=new Set(["gtav-montchiliad","gtav-koth-enhanced","gtav-hiking-enhanced"]);
const MARKER="SHENPULSE_GTA_KOTH_1";
function modeSelectionPath(local=process.env.LOCALAPPDATA){
 if(!local)throw new Error("Le dossier local Windows est introuvable.");
 return path.join(local,"ShenPulse","GtaMode","selection.ini");
}
function encodeSelection(mode,installation){
 if(!["koth","montchiliad","hiking"].includes(mode)||/[\r\n\u0000]/.test(installation))throw new Error("Sélection du mode GTA invalide.");
 return Buffer.from("\ufeff[ShenPulse]\r\nmode="+mode+"\r\ninstallation="+path.resolve(installation).replace(/[\\/]+$/,"")+"\r\n","utf16le");
}
async function prepareGtaMode({gameId,installation,existing,assertAccess=()=>{},localAppData=process.env.LOCALAPPDATA}){
 if(!GTA_IDS.has(gameId))return;
 const edition=await detectGtaEdition(installation.path);
 if(edition!=="enhanced"){
  if(gameId!=="gtav-montchiliad")throw new Error("Ce mode nécessite GTA V Enhanced. Le dossier choisi est celui de GTA V Legacy.");
  return;
 }
 const mode=gameId==="gtav-koth-enhanced"?"koth":gameId==="gtav-hiking-enhanced"?"hiking":"montchiliad";
 const selection=modeSelectionPath(localAppData),data=encodeSelection(mode,installation.path);
 const previous=await fs.readFile(selection).catch(()=>null);
 assertAccess();
 if(existing){
  if(!previous?.equals(data))throw new Error("Fermez GTA V avant de changer de mode, puis relancez-le depuis la page "+(mode==="koth"?"KOTH Enhanced.":mode==="hiking"?"Hiking Enhanced.":"Mont Chiliad."));
  // The ASI loader can exclusively lock its image after startup on Windows.
  // The caller still requires the fixed KOTH/Mont bridge to connect before activating the session.
  return;
 }
 const plugin=await fs.readFile(path.join(installation.path,"ShenPulseMontChiliadEnhanced.asi")).catch(()=>null);
 const marker=mode==="hiking"?"SHENPULSE_GTA_HIKING_1":MARKER;
 if(mode!=="montchiliad"&&!plugin?.includes(Buffer.from(marker)))throw new Error("Le module GTA demandé n’est pas installé ou est trop ancien. Cliquez sur Installer automatiquement ou Mettre à jour le pack.");
 assertAccess();
 if(previous?.equals(data))return;
 await fs.mkdir(path.dirname(selection),{recursive:true});
 assertAccess();
 // Rename atomically: a crash during the write must not select the other mode.
 const temporary=selection+"."+process.pid+".tmp";
 try{await fs.writeFile(temporary,data);assertAccess();await fs.rename(temporary,selection);}
 finally{await fs.rm(temporary,{force:true}).catch(()=>{});}
}
module.exports={GTA_IDS,MARKER,modeSelectionPath,encodeSelection,prepareGtaMode};
