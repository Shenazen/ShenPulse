"use strict";
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {normalizeGameRoundSettings}=require('../../shared/minecraft-round-settings');
async function writeGtaRoundSettings(packId,incoming={}, {localAppData=process.env.LOCALAPPDATA,assertAccess=()=>{}}={}){
 if(!['gtav-koth-enhanced','gtav-hiking-enhanced'].includes(packId))return null;if(!localAppData)throw Error('Le dossier local Windows est introuvable.');
 const settings=normalizeGameRoundSettings(packId,incoming),file=path.join(localAppData,'ShenPulse','GtaMode',packId==='gtav-hiking-enhanced'?'hiking-round.ini':'koth-round.ini');
 const temporary=file+'.'+crypto.randomUUID()+'.tmp',revision=Date.now();
 const content=Buffer.from('\ufeff[Round]\r\ndurationSeconds='+settings.durationMinutes*60+'\r\nautoRestart='+(settings.autoRestart?1:0)+'\r\nrevision='+revision+'\r\n','utf16le');
 assertAccess();await fs.mkdir(path.dirname(file),{recursive:true});try{await fs.writeFile(temporary,content,{flag:'wx'});assertAccess();await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true}).catch(()=>{});}return {...settings,revision};
}
module.exports={writeGtaRoundSettings};
