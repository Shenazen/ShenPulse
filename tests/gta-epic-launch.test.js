"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {gtaEpicLaunchUrl,gtaEpicInstallCandidates}=require('../src/main/game-runtime/gta-epic-launch');
const {detectInstalledGames,gtaInstallCandidates}=require('../src/main/game-runtime/discovery');
const {launchExternalGame}=require('../src/main/game-runtime/external-launch');
const {GAME_INSTALLERS}=require('../src/main/game-installer-manifest');
test('Epic est lancé par sa fiche exacte, sans transmettre de mot de passe ni ouvrir directement PlayGTAV',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'shenpulse-epic-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const game=path.join(root,'GTA Enhanced'),manifestDirectory=path.join(root,'Manifests');await fs.mkdir(game);await fs.mkdir(manifestDirectory);
 await fs.writeFile(path.join(game,'GTA5_Enhanced.exe'),'fixture');await fs.writeFile(path.join(game,'PlayGTAV.exe'),'fixture');
 const item={InstallLocation:game,CatalogNamespace:'namespace',CatalogItemId:'catalog',AppName:'enhanced'};
 await fs.writeFile(path.join(manifestDirectory,'other.item'),JSON.stringify({...item,InstallLocation:path.join(root,'legacy'),AppName:'legacy'}));
 await fs.writeFile(path.join(manifestDirectory,'broken.item'),'{');
 await fs.writeFile(path.join(manifestDirectory,'malformed.item'),JSON.stringify({InstallLocation:{path:'unrelated'}}));
 await fs.writeFile(path.join(manifestDirectory,'gta.item'),JSON.stringify(item));
 const url=await gtaEpicLaunchUrl(game,{manifestDirectory});assert.equal(url,'com.epicgames.launcher://apps/namespace%3Acatalog%3Aenhanced?action=launch&silent=true');
 const calls=[];
 await launchExternalGame({gameId:'gtav-koth-enhanced',manifest:GAME_INSTALLERS['gtav-koth-enhanced'],installation:{path:game,edition:'enhanced'},assertAccess(){},findRunning:async()=>null,selectGtaMode:async()=>{},prepareGtaSave:async()=>({pending:false}),findEpicLaunchUrl:folder=>{assert.equal(folder,game);return gtaEpicLaunchUrl(folder,{manifestDirectory});},shell:{openExternal:async value=>calls.push(value),openPath:async()=>{throw Error('Lancement direct interdit pour Epic');}}});
 assert.deepEqual(calls,[url]);
 await fs.writeFile(path.join(manifestDirectory,'gta.item'),JSON.stringify({...item,AppName:'bad\r\nvalue'}));await assert.rejects(gtaEpicLaunchUrl(game,{manifestDirectory}),/incomplète/);
 await fs.rm(path.join(manifestDirectory,'gta.item'));assert.equal(await gtaEpicLaunchUrl(game,{manifestDirectory}),'');
 await fs.rm(manifestDirectory,{recursive:true});assert.equal(await gtaEpicLaunchUrl(game,{manifestDirectory}),'');
});

test('les trois modes retrouvent GTA Epic déplacé et ignorent un ancien dossier Rockstar vide',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'shenpulse-epic-discovery-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const game=path.join(root,'bibliothèque personnalisée','GTAVEnhanced'),old=path.join(root,'ancien Rockstar'),manifestDirectory=path.join(root,'Manifests');
 await fs.mkdir(game,{recursive:true});await fs.mkdir(old);await fs.mkdir(manifestDirectory);
 await fs.writeFile(path.join(game,'GTA5_Enhanced.exe'),'fixture');
 await fs.writeFile(path.join(manifestDirectory,'gta.item'),JSON.stringify({InstallLocation:game}));
 await fs.writeFile(path.join(manifestDirectory,'bad.item'),JSON.stringify({InstallLocation:{path:game}}));
 await fs.writeFile(path.join(manifestDirectory,'relative.item'),JSON.stringify({InstallLocation:'../game'}));
 const epic=()=>gtaEpicInstallCandidates({manifestDirectory});assert.deepEqual(await epic(),[game]);
 for(const gameId of ['gtav-montchiliad','gtav-koth-enhanced','gtav-hiking-enhanced']){
  const found=await detectInstalledGames(gameId,GAME_INSTALLERS[gameId],old,{gta:()=>gtaInstallCandidates({programFiles:[],epic}),steam:async()=>[]});
  assert.deepEqual(found.map(item=>item.path),[game],gameId);
 }
});
