"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {prepareStardewGamePassBootstrap,assertModdedGameReady,findModdedGameProcess,configureTerrariaMod}=require('../src/main/game-runtime/stardew-terraria');
const {commitInstallationDeployment}=require('../src/main/game-runtime/deployments');
const {installAsset}=require('../src/main/game-runtime/asset-deployment');
const {launchExternalGame}=require('../src/main/game-runtime/external-launch');
const manifest=require('../src/main/game-installers/stardew-valley');
const smapi=Buffer.from('fixture apphost StardewModdingAPI.dll'),native=Buffer.from('fixture native Xbox launcher');
async function write(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data);}
async function fixture(t,xbox=true){const base=await fs.mkdtemp(path.join(os.tmpdir(),'shenpulse-stardew-'));t.after(()=>fs.rm(base,{recursive:true,force:true}));const targetPath=path.join(base,'game'),deploymentRoot=path.join(base,'stage'),backupRoot=path.join(base,'backup');await write(path.join(targetPath,'Stardew Valley.exe'),native);await write(path.join(deploymentRoot,'StardewModdingAPI.exe'),smapi);if(xbox)await write(path.join(targetPath,'MicrosoftGame.Config'),'<Game><Identity Name="ConcernedApe.StardewValleyPC" /></Game>');return{base,gameId:'stardew-valley',targetPath,deploymentRoot,backupRoot};}
async function mod(root){await write(path.join(root,'Mods/ShenPulse/manifest.json'),JSON.stringify({EntryDll:'ShenPulse.Stardew.dll'}));await write(path.join(root,'Mods/ShenPulse/ShenPulse.Stardew.dll'),'fixture');}
test('le lanceur Xbox original est conservé et restauré si le déploiement échoue',async t=>{const f=await fixture(t),change=await prepareStardewGamePassBootstrap(f);assert.deepEqual(await fs.readFile(change.original),native);await commitInstallationDeployment({...f,tempRoot:f.base});assert.deepEqual(await fs.readFile(path.join(f.targetPath,'Stardew Valley.exe')),smapi);await change.rollback();assert.deepEqual(await fs.readFile(path.join(f.targetPath,'Stardew Valley.exe')),native);});
test('réinstaller SMAPI ne remplace pas la sauvegarde du lanceur original',async t=>{const f=await fixture(t),change=await prepareStardewGamePassBootstrap(f);await commitInstallationDeployment({...f,tempRoot:f.base});assert.equal(await prepareStardewGamePassBootstrap(f),null);assert.deepEqual(await fs.readFile(change.original),native);});
test('une mise à jour Xbox conserve aussi la sauvegarde précédente et son rollback',async t=>{const f=await fixture(t),old=Buffer.from('previous original');await write(path.join(f.targetPath,'Stardew Valley original.exe'),old);const change=await prepareStardewGamePassBootstrap(f);assert.deepEqual(await fs.readFile(change.previous),old);await change.rollback();assert.deepEqual(await fs.readFile(path.join(f.targetPath,'Stardew Valley.exe')),native);assert.deepEqual(await fs.readFile(path.join(f.targetPath,'Stardew Valley original.exe')),old);});
test('Steam garde son exécutable original et un lanceur SMAPI invalide est refusé avant mutation',async t=>{const f=await fixture(t,false);assert.equal(await prepareStardewGamePassBootstrap(f),null);assert.deepEqual(await fs.readFile(path.join(f.targetPath,'Stardew Valley.exe')),native);await write(path.join(f.targetPath,'MicrosoftGame.Config'),'<Identity Name="ConcernedApe.StardewValleyPC"/>');await write(path.join(f.deploymentRoot,'StardewModdingAPI.exe'),'invalid');await assert.rejects(prepareStardewGamePassBootstrap(f),/invalide/);assert.deepEqual(await fs.readFile(path.join(f.targetPath,'Stardew Valley.exe')),native);});
test('la perte du droit avant le renommage laisse le lanceur Xbox intact',async t=>{const f=await fixture(t);await assert.rejects(prepareStardewGamePassBootstrap({...f,assertAccess(){throw Error('revoked');}}),/revoked/);assert.deepEqual(await fs.readFile(path.join(f.targetPath,'Stardew Valley.exe')),native);});
test('Lancer utilise SMAPI sur Steam et le lanceur Xbox sur Game Pass sans changer d’édition',async t=>{for(const xbox of [false,true]){const f=await fixture(t,xbox);await mod(f.targetPath);await write(path.join(f.targetPath,'StardewModdingAPI.exe'),smapi);if(xbox){await write(path.join(f.targetPath,'Stardew Valley.exe'),smapi);await write(path.join(f.targetPath,'gamelaunchhelper.exe'),'fixture');}const opened=[];const result=await launchExternalGame({gameId:f.gameId,manifest,installation:{path:f.targetPath,...(xbox?{platform:'xbox'}:{})},shell:{openPath:async file=>{opened.push(file);return '';},openExternal:async()=>{throw Error('Wrong Steam launcher');}},assertAccess(){},findModdedProcess:async()=>null});assert.equal(opened.length,1);assert.equal(path.basename(result.path),xbox?'gamelaunchhelper.exe':'StardewModdingAPI.exe');}});
test('une édition Xbox mise à jour sans SMAPI est refusée avec une réparation explicite',async t=>{const f=await fixture(t);await mod(f.targetPath);await assert.rejects(assertModdedGameReady(f.gameId,f.targetPath),/mis à jour dans Xbox/);});
test('le processus de jeu déjà ouvert est vérifié sans lancer une deuxième instance',async t=>{const f=await fixture(t);await write(path.join(f.targetPath,'Stardew Valley.exe'),smapi);const found=await findModdedGameProcess(f.gameId,f.targetPath,{platform:'win32',execute:async()=>JSON.stringify({ProcessId:42,Name:'Stardew Valley.exe',ExecutablePath:path.join(f.targetPath,'Stardew Valley.exe')})});assert.equal(found.ProcessId,42);await assert.rejects(findModdedGameProcess(f.gameId,f.targetPath,{platform:'win32',execute:async()=>JSON.stringify({ProcessId:43,Name:'Stardew Valley.exe',ExecutablePath:path.join(f.base,'other/Stardew Valley.exe')})}),/autre installation/);});
test('SMAPI extrait Windows et copie les dépendances de cette édition depuis le jeu vers le staging',async t=>{const f=await fixture(t,false),bundle=path.join(f.base,'installer'),payload=path.join(f.base,'payload');await write(path.join(payload,'StardewModdingAPI.exe'),smapi);for(const platform of ['linux','windows']){await write(path.join(payload,'StardewModdingAPI.exe'),platform==='linux'?Buffer.from('linux payload'):smapi);const dat=path.join(bundle,'SMAPI/internal',platform,'install.dat');await fs.mkdir(path.dirname(dat),{recursive:true});execFileSync('tar',['-cf',dat,'-C',payload,'.']);}await write(path.join(bundle,'SMAPI/install on Windows.bat'),'fixture');await write(path.join(f.targetPath,'Stardew Valley.deps.json'),'{"runtimeTarget":{"name":"xbox-specific"}}');const archive=path.join(f.base,'smapi.tar');execFileSync('tar',['-cf',archive,'-C',bundle,'.']);await installAsset({}, {gameId:f.gameId,asset:{id:'smapi',action:'smapi'},downloadPath:archive,targetPath:f.deploymentRoot,sourceGamePath:f.targetPath,backupRoot:f.backupRoot,tempRoot:f.base});assert.deepEqual(await fs.readFile(path.join(f.deploymentRoot,'StardewModdingAPI.exe')),smapi);assert.equal(await fs.readFile(path.join(f.deploymentRoot,'StardewModdingAPI.deps.json'),'utf8'),await fs.readFile(path.join(f.targetPath,'Stardew Valley.deps.json'),'utf8'));});
test('Terraria installe un profil isolé, conserve les mods et réutilise les sauvegardes sans écrire dans Documents',async t=>{
 const f=await fixture(t,false),docs=path.join(f.base,'documents'),userDataPath=path.join(f.base,'user-data'),original=path.join(docs,'My Games/Terraria/tModLoader'),enabled=JSON.stringify(['AnotherMod','CrowdControlMod']);
 await write(path.join(original,'Mods/enabled.json'),enabled);await write(path.join(original,'Mods/AnotherMod.tmod'),'another-mod');await write(path.join(original,'Mods/CrowdControlMod.tmod'),'legacy');
 await write(path.join(original,'Players/test.plr'),'player');await write(path.join(original,'Worlds/test.wld'),'world');await write(path.join(original,'config.json'),'{}');
 for(const file of ['tModLoader.dll','start-tModLoader.bat','dotnet/dotnet.exe','Mods/ShenPulseTerraria.tmod'])await write(path.join(f.targetPath,file),'fixture');
 const options={gameId:'terraria',targetPath:f.targetPath,documentsPath:docs,userDataPath,backupRoot:f.backupRoot,tempRoot:f.base};
 const profile=await configureTerrariaMod(options);
 assert.equal(await fs.readFile(path.join(original,'Mods/enabled.json'),'utf8'),enabled);
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(profile,'Mods/enabled.json'),'utf8')),['AnotherMod','ShenPulseTerraria']);
 assert.equal(await fs.readFile(path.join(profile,'Mods/AnotherMod.tmod'),'utf8'),'another-mod');
 assert.equal(await fs.realpath(path.join(profile,'Worlds')),await fs.realpath(path.join(original,'Worlds')));
 assert.equal(await fs.readFile(path.join(profile,'Players/test.plr'),'utf8'),'player');
 assert.equal(await fs.readFile(path.join(profile,'config.json'),'utf8'),'{}');
 const script=await fs.readFile(path.join(profile,'ShenPulse-Terraria.cmd'),'utf8');assert.ok(script.includes('-tmlsavedirectory "'+profile+'"'));assert.match(script,/set SteamClientLaunch=1/);
 await fs.writeFile(path.join(profile,'Mods/enabled.json'),'["AnotherMod"]');await fs.writeFile(path.join(profile,'config.json'),'{"changed":true}');
 await configureTerrariaMod(options);
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(f.backupRoot,'profile/Mods/enabled.json'),'utf8')),['AnotherMod']);
 assert.equal(await fs.readFile(path.join(profile,'config.json'),'utf8'),'{"changed":true}');
});

test('le chemin WindowsApps du processus Xbox est reconnu via son vrai fichier XboxGames',async t=>{const f=await fixture(t);await write(path.join(f.targetPath,'Stardew Valley.exe'),smapi);const alias=path.join(f.base,'WindowsAppsAlias');await fs.symlink(f.targetPath,alias,'junction');const found=await findModdedGameProcess(f.gameId,f.targetPath,{platform:'win32',execute:async()=>JSON.stringify({ProcessId:45,Name:'Stardew Valley.exe',ExecutablePath:path.join(alias,'Stardew Valley.exe')})});assert.equal(found.ProcessId,45);});



test('le lancement autonome Terraria transmet le profil client sans démarrer une deuxième instance',async t=>{
 const f=await fixture(t,false),gameId='terraria',root=f.targetPath,userDataPath=path.join(f.base,'user-data');
 for(const file of ['tModLoader.dll','start-tModLoader.bat','dotnet/dotnet.exe','Mods/ShenPulseTerraria.tmod'])await write(path.join(root,file),'fixture');
 const profile=await configureTerrariaMod({gameId,targetPath:root,documentsPath:path.join(f.base,'documents'),userDataPath,backupRoot:f.backupRoot,tempRoot:f.base});
 const calls=[],options={gameId,manifest:require('../src/main/game-installers/terraria'),installation:{path:root},userDataPath,shell:{openPath:async p=>{calls.push(p);return '';},openExternal:async()=>{throw Error('Steam ne doit pas perdre le profil');}},assertAccess(){},findModdedProcess:async()=>null};
 await launchExternalGame(options);assert.deepEqual(calls,[path.join(profile,'ShenPulse-Terraria.cmd')]);
 const result=await launchExternalGame({...options,findModdedProcess:async()=>({ProcessId:77})});assert.equal(result.alreadyRunning,true);assert.equal(calls.length,1);
 await fs.writeFile(calls[0],'untrusted');await assert.rejects(launchExternalGame(options),/Réinstallez/);
});

test('un Terraria déjà ouvert doit utiliser le profil ShenPulse ; le helper Steam est accepté',async t=>{
 const f=await fixture(t,false),userDataPath=path.join(f.base,'user-data'),profile=require('../src/main/game-runtime/terraria-installation').terrariaProfile(userDataPath);
 const executable=path.join(f.targetPath,'dotnet/dotnet.exe');await write(executable,'fixture');await fs.mkdir(profile,{recursive:true});const base={ProcessId:77,Name:'dotnet.exe',ExecutablePath:executable};
 const query=command=>findModdedGameProcess('terraria',f.targetPath,{platform:'win32',userDataPath,execute:async()=>JSON.stringify({...base,CommandLine:command})});
 await assert.rejects(query('dotnet.exe tModLoader.dll'),/sans le lancement ShenPulse/);
 await assert.rejects(query('dotnet.exe tModLoader.dll -modpath "'+path.join(f.targetPath,'Mods')+'"'),/sans le lancement ShenPulse/);
 assert.equal((await query('dotnet.exe tModLoader.dll -tmlsavedirectory "'+profile+'"')).ProcessId,77);
 assert.equal((await query('dotnet.exe tModLoader.dll -terrariasteamclient 123')).ProcessId,77);
});

test('une liste de mods illisible ou une redirection du profil ne modifie pas les sauvegardes',async t=>{
 const f=await fixture(t,false),userDataPath=path.join(f.base,'user-data'),docs=path.join(f.base,'documents'),original=path.join(docs,'My Games/Terraria/tModLoader');
 for(const file of ['tModLoader.dll','start-tModLoader.bat','dotnet/dotnet.exe','Mods/ShenPulseTerraria.tmod'])await write(path.join(f.targetPath,file),'fixture');
 await write(path.join(original,'Mods/enabled.json'),'broken');await write(path.join(original,'Worlds/test.wld'),'save');
 const options={gameId:'terraria',targetPath:f.targetPath,documentsPath:docs,userDataPath,backupRoot:f.backupRoot,tempRoot:f.base};
 await assert.rejects(configureTerrariaMod(options),/illisible/);assert.equal(await fs.readFile(path.join(original,'Worlds/test.wld'),'utf8'),'save');
 const profile=require('../src/main/game-runtime/terraria-installation').terrariaProfile(userDataPath),other=path.join(f.base,'other');await fs.mkdir(other);await fs.symlink(other,path.join(profile,'Mods'),'junction');
 await assert.rejects(configureTerrariaMod(options),/redirigé/);assert.deepEqual(await fs.readdir(other),[]);
});


test('une première installation sélectionne Terraria et prépare un sous-dossier sans exiger tModLoader',async t=>{
 const f=await fixture(t,false),vanilla=f.targetPath,installer=require('../src/main/game-installers/terraria'),{pickTarget,validateTarget}=require('../src/main/game-runtime/target-selection');await write(path.join(vanilla,'Terraria.exe'),'original');
 const runtime={store:{getState:()=>({game:{installations:{}}})},getWindow:()=>null,validateTarget:(folder,m)=>validateTarget({},folder,m),dialog:{showOpenDialog:async()=>({filePaths:[vanilla]}),showMessageBox:async()=>{throw Error('Pas de prérequis tModLoader');}}};
 const selected=await pickTarget(runtime,'terraria',{...installer,autoDetect:false});assert.equal(selected,path.join(vanilla,'tModLoader'));await validateTarget({},selected,installer);assert.equal(await fs.readFile(path.join(vanilla,'Terraria.exe'),'utf8'),'original');await assert.rejects(fs.stat(selected),{code:'ENOENT'});
 await assert.rejects(validateTarget({},path.join(f.base,'unrelated'),installer),/Terraria original/);
});
