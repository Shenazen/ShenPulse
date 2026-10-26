"use strict";
/** Explicit file receipts: never remove a game directory, saves or an unrelated mod. */
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const { safeChildPath, sha256File } = require('./paths');
const { collectFiles, commitInstallationDeployment } = require('./deployments');
const { readState } = require('../state-projection');
const { assertModGameClosed } = require('./mod-installation-ready');
const GAME = 'supermarket-simulator';
const ownFile = file => /^BepInEx\/plugins\/ShenPulse\//i.test(file) || file === 'BepInEx/config/ShenPulse.supermarket-simulator.json' || ['shenpulse-module.json','SHENPULSE-MODULE.txt','THIRD-PARTY-NOTICES.txt'].includes(file);
const allowed = file => /^(?:BepInEx\/[^:]+|dotnet\/[^:]+|ShenPulse-Licenses\/[^:]+|winhttp\.dll|doorstop_config\.ini|\.doorstop_version|changelog\.txt|shenpulse-module\.json|SHENPULSE-MODULE\.txt|THIRD-PARTY-NOTICES\.txt)$/i.test(file);
const key = file => process.platform === 'win32' ? path.resolve(file).toLowerCase() : path.resolve(file);
function relativeFile(value) {
  const file = String(value || '').replaceAll('\\','/');
  if (!file || file.includes(':') || file.startsWith('/') || file.split('/').some(p => !p || p === '.' || p === '..')) throw Error('Chemin de désinstallation invalide.');
  return file;
}
async function plainPath(root, relative) {
  const file = relativeFile(relative); let cursor = path.resolve(root);
  for (const segment of file.split('/')) {
    cursor = safeChildPath(cursor, segment);
    const stat = await fs.lstat(cursor).catch(error => { if(error.code === 'ENOENT') return null; throw error; });
    if (stat?.isSymbolicLink()) throw Error('Un lien empêche une restauration sûre du module.');
  }
  return safeChildPath(root, file);
}
async function readReceipt(receiptPath, gameId, targetPath, backupsRoot) {
  const relative = path.relative(backupsRoot, path.resolve(receiptPath));
  await plainPath(backupsRoot, relative);
  const receipt = JSON.parse(await fs.readFile(safeChildPath(backupsRoot, relative), 'utf8'));
  if (receipt.schemaVersion !== 1 || receipt.gameId !== gameId || key(receipt.targetPath) !== key(targetPath) || !Array.isArray(receipt.files)) throw Error('Le suivi des fichiers ne correspond pas à cette installation.');
  for (const entry of receipt.files) {
    const file = relativeFile(entry.file);
    if (!allowed(file) || !/^[a-f0-9]{64}$/.test(entry.installedHash || '')) throw Error('Le suivi des fichiers installés est invalide.');
    if (entry.original) { relativeFile(entry.original.file); if(!/^[a-f0-9]{64}$/.test(entry.original.hash || '')) throw Error('Sauvegarde originale invalide.'); }
  }
  return receipt;
}
async function prepareShopUninstallReceipt({ gameId, targetPath, deploymentRoot, backupRoot, userData, previousInstallation, assertAccess = () => {} }) {
  if (gameId !== GAME) return '';
  const backupsRoot = path.join(userData, 'game-backups', gameId), files = await collectFiles(deploymentRoot);
  let previous = null;
  if (previousInstallation?.uninstallReceiptPath && key(previousInstallation.path) === key(targetPath)) previous = await readReceipt(previousInstallation.uninstallReceiptPath, gameId, targetPath, backupsRoot);
  const legacy = !previous && Boolean(await fs.stat(path.join(targetPath,'shenpulse-module.json')).catch(() => null));
  const entries = [];
  for (const source of files) {
    assertAccess(); const file = relativeFile(path.relative(deploymentRoot, source));
    if (!allowed(file)) throw Error('Fichier du module non reconnu : ' + file);
    const destination = await plainPath(targetPath, file), prior = previous?.files.find(entry => entry.file === file);
    let original = prior?.original || null, retain = prior?.retain === true || legacy && !ownFile(file);
    if (!prior && !legacy) {
      const stat = await fs.lstat(destination).catch(error => { if(error.code === 'ENOENT') return null; throw error; });
      if (stat && !stat.isFile()) throw Error('Un dossier bloque le module : ' + file);
      if (stat) {
        const saved = safeChildPath(backupRoot, 'original/' + file); await fs.mkdir(path.dirname(saved),{recursive:true});
        await fs.copyFile(destination,saved); original = {file:relativeFile(path.relative(backupsRoot,saved)),hash:await sha256File(saved)};
      }
    }
    entries.push({file,installedHash:await sha256File(source),original,retain});
  }
  // Preserve knowledge of a file retired by a subsequent module update.
  for(const entry of previous?.files || []) if(!entries.some(next=>next.file===entry.file))entries.push(entry);
  assertAccess(); await fs.mkdir(backupRoot,{recursive:true});
  const receiptPath = path.join(backupRoot,'shenpulse-installation-receipt.json');
  await fs.writeFile(receiptPath,JSON.stringify({schemaVersion:1,gameId,targetPath:path.resolve(targetPath),legacy:legacy || previous?.legacy === true,files:entries},null,2),{flag:'wx'});
  return receiptPath;
}
async function legacyReceipt(targetPath) {
  const manifest = await fs.readFile(path.join(targetPath,'shenpulse-module.json'),'utf8').then(JSON.parse).catch(()=>null);
  const paths = new Set(['BepInEx/plugins/ShenPulse/ShenPulse.ShopAdapter.dll','BepInEx/plugins/ShenPulse/Newtonsoft.Json.dll','BepInEx/plugins/ShenPulse/ShenPulse.Supermarket.Module.dll','BepInEx/config/ShenPulse.supermarket-simulator.json','shenpulse-module.json','SHENPULSE-MODULE.txt','THIRD-PARTY-NOTICES.txt']);
  if(manifest?.gameId===GAME)for(const entry of manifest.files || [])if(ownFile(relativeFile(entry.file)))paths.add(entry.file);
  const files=[];
  for(const file of paths){const actual=await plainPath(targetPath,file),stat=await fs.lstat(actual).catch(error=>{if(error.code==='ENOENT')return null;throw error;});if(!stat)continue;if(!stat.isFile())throw Error('Un dossier bloque le retrait du module.');files.push({file,installedHash:await sha256File(actual),original:null,retain:false});}
  return {schemaVersion:1,gameId:GAME,targetPath,legacy:true,files};
}
async function uninstallShopGame(runtime,gameId,{assertAccess = () => runtime.assertAccess(gameId),assertClosed = assertModGameClosed,deploy = commitInstallationDeployment}={}) {
  if(gameId!==GAME)throw Error('La désinstallation automatique de ce jeu n’est pas encore disponible.');
  assertAccess();
  if(runtime.activeInstalls.has(gameId) || runtime.launchJobs?.has(gameId))throw Error('Une opération est déjà en cours pour ce jeu.');
  const state=readState(runtime.store,['game.installations','session.game']);
  const installation=state.game.installations?.[gameId];if(!installation)throw Error('Aucun module installé pour ce jeu.');
  if(state.session.game?.running && state.session.game.packId===gameId)throw Error('Arrêtez la session du jeu avant de désinstaller son module.');
  const targetPath=path.resolve(installation.path),userData=runtime.app.getPath('userData');
  if(targetPath===path.parse(targetPath).root)throw Error('Dossier de jeu invalide.');
  runtime.activeInstalls.add(gameId);
  try {
    const targetStat=await fs.stat(targetPath).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
    if(!targetStat)return {ok:true,gameId,alreadyRemoved:true,removedFiles:0,restoredFiles:0,sharedLoaderRetained:false};
    await runtime.validateTarget(targetPath,require('../game-installer-manifest').installerForGame(gameId));
    await assertClosed(gameId,targetPath);assertAccess();
    const backupsRoot=path.join(userData,'game-backups',gameId);
    const receipt=installation.uninstallReceiptPath?await readReceipt(installation.uninstallReceiptPath,gameId,targetPath,backupsRoot):await legacyReceipt(targetPath);
    const pluginRoot=path.join(targetPath,'BepInEx/plugins');
    const pluginFiles=await collectFiles(pluginRoot).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
    const otherMods=pluginFiles.some(file=>!ownFile(relativeFile(path.relative(targetPath,file))));
    const patchers=await collectFiles(path.join(targetPath,'BepInEx/patchers')).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
    const pluginEntries=await fs.readdir(pluginRoot,{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
    const hasOtherMods=otherMods || patchers.length>0 || pluginEntries.some(entry=>entry.name.toLowerCase()!=='shenpulse');
    const run=path.join(backupsRoot,'uninstall-'+Date.now()+'-'+crypto.randomBytes(4).toString('hex'));
    const staged=path.join(run,'restore'),quarantine=path.join(run,'before-uninstall'),rollback=path.join(run,'rollback');
    await fs.mkdir(staged,{recursive:true});await fs.mkdir(rollback,{recursive:true});
    const removed=[],restored=[],operations=[];let sharedLoaderRetained=receipt.legacy===true;
    for(const entry of receipt.files){
      assertAccess();const file=relativeFile(entry.file);if(!allowed(file))throw Error('Fichier de retrait invalide.');
      if(entry.retain || hasOtherMods && !ownFile(file)){sharedLoaderRetained=true;continue;}
      const current=await plainPath(targetPath,file),stat=await fs.lstat(current).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
      if(stat && !stat.isFile())throw Error('Un dossier bloque le retrait : '+file);
      if(stat && !ownFile(file) && await sha256File(current)!==entry.installedHash){sharedLoaderRetained=true;continue;}
      if(entry.original){
        const saved=await plainPath(backupsRoot,entry.original.file);
        if(await sha256File(saved)!==entry.original.hash)throw Error('La sauvegarde originale est absente ou altérée : '+file);
        const output=safeChildPath(staged,file);await fs.mkdir(path.dirname(output),{recursive:true});await fs.copyFile(saved,output);restored.push(file);
      } else removed.push(file);
      if(stat){const output=safeChildPath(rollback,file);await fs.mkdir(path.dirname(output),{recursive:true});await fs.copyFile(current,output);}
      operations.push({file,existed:!!stat});
    }
    assertAccess();await assertClosed(gameId,targetPath);
    try {
      await deploy({deploymentRoot:staged,targetPath,backupRoot:quarantine,tempRoot:path.join(run,'temporary'),retiredFiles:removed,assertAccess});
      assertAccess();
    } catch(error){
      // Rollback only these explicit files, using the same elevated-copy path if needed.
      try{await commitInstallationDeployment({deploymentRoot:rollback,targetPath,backupRoot:path.join(run,'rollback-backup'),tempRoot:path.join(run,'rollback-temporary'),retiredFiles:operations.filter(op=>!op.existed).map(op=>op.file)});}catch(recovery){throw Error('Le retrait a été interrompu. Les sauvegardes sont conservées ; réinstallez le module depuis ShenPulse. '+recovery.message);}
      throw error;
    }
    assertAccess();
    return {ok:true,gameId,removedFiles:removed.length,restoredFiles:restored.length,sharedLoaderRetained,backupPath:run};
  } finally {runtime.activeInstalls.delete(gameId);}
}
module.exports={prepareShopUninstallReceipt,uninstallShopGame,isAllowedModuleFile:allowed};
