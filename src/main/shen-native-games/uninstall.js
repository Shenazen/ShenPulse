"use strict";
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {SPECS}=require('./specs'),{assertModGameClosed}=require('../game-runtime/mod-installation-ready');
const same=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
/** Moves only ShenPulse's managed copy to a recoverable backup; Unity saves live elsewhere. */
async function uninstallNativeGame(runtime,id,{assertAccess,assertClosed=assertModGameClosed}={}){
 assertAccess ||= ()=>runtime.assertAccess(id);assertAccess();
 if(!SPECS[id])throw Error('Jeu inconnu.');
 if(runtime.activeInstalls.has(id)||runtime.launchJobs?.has(id))throw Error('Une opération est déjà en cours pour ce jeu.');
 const installation=runtime.store.getState().game.installations?.[id];
 if(!installation)throw Error('Aucun jeu installé.');
 if(runtime.store.getState().session.game?.running&&runtime.store.getState().session.game.packId===id)throw Error('Arrêtez la session avant de désinstaller ce jeu.');
 const userData=await fs.realpath(runtime.app.getPath('userData')),expected=path.join(userData,'games',id);
 if(!same(installation.path,expected))throw Error('Cette copie n’est pas gérée par ShenPulse ; elle ne peut pas être retirée automatiquement.');
 runtime.activeInstalls.add(id);
 try{
  for(const dir of [path.join(userData,'games'),expected]){
   const stat=await fs.lstat(dir).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
   if(!stat)return {ok:true,gameId:id,alreadyRemoved:true};
   if(!stat.isDirectory()||stat.isSymbolicLink()||!same(await fs.realpath(dir),dir))throw Error('Un lien empêche une désinstallation sûre.');
  }
  const descriptor=JSON.parse(await fs.readFile(path.join(expected,'shenpulse-game.json'),'utf8'));
  if(descriptor.id!==id||descriptor.protocol!=='shen-native-v1')throw Error('L’identité du jeu installé ne correspond pas.');
  await assertClosed(id,expected);assertAccess();
  await require('./runtime').bridgeFor(runtime.store,id,assertAccess).close();
  const backups=path.join(userData,'game-backups',id);
  await fs.mkdir(backups,{recursive:true});
  if(!same(await fs.realpath(backups),backups))throw Error('Le dossier de sauvegarde contient un lien.');
  const backup=path.join(backups,'native-uninstall-'+Date.now()+'-'+crypto.randomBytes(5).toString('hex'));
  if(!backup.startsWith(backups+path.sep))throw Error('Dossier de sauvegarde invalide.');
  await assertClosed(id,expected);assertAccess();await fs.rename(expected,backup);
  try{assertAccess();}catch(e){await fs.rename(backup,expected);throw e;}
  return {ok:true,gameId:id,managedGameRemoved:true,backupPath:backup,removedFiles:0,restoredFiles:0,sharedLoaderRetained:false};
 }finally{runtime.activeInstalls.delete(id);}
}
module.exports={uninstallNativeGame};
