"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {prepareShopUninstallReceipt,uninstallShopGame}=require('../src/main/game-runtime/shop-game-uninstall');
const {commitInstallationDeployment}=require('../src/main/game-runtime/deployments');
const {registerGameMaintenanceIpc}=require('../src/main/ipc/game-maintenance');
const {StateStore}=require('../src/main/store');
const {loadShenazenGameCatalog}=require('../src/main/game-catalog');
const GAME='supermarket-simulator',MODULE='BepInEx/plugins/ShenPulse/ShenPulse.Supermarket.Module.dll';
async function put(root,file,value){const full=path.join(root,file);await fs.mkdir(path.dirname(full),{recursive:true});await fs.writeFile(full,value);}
async function exists(root,file){return !!await fs.stat(path.join(root,file)).catch(()=>null);}
async function fixture(t){
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'shenpulse-maintenance-'));
 t.after(async()=>{assert.equal(path.dirname(base),os.tmpdir());assert.ok(path.basename(base).startsWith('shenpulse-maintenance-'));await fs.rm(base,{recursive:true,force:true});});
 const game=path.join(base,'game'),user=path.join(base,'user');await fs.mkdir(game,{recursive:true});await fs.mkdir(user,{recursive:true});await put(game,'Supermarket Simulator.exe','original-game');await put(game,'save.dat','saved-game');
 const store=new StateStore(user);store.touch=()=>{};store.state.settings.account.uid='owner';const profileId=store.state.session.profileId;
 const runtime={store,app:{getPath:name=>{assert.equal(name,'userData');return user;}},activeInstalls:new Set(),launchJobs:new Map(),assertAccess:id=>assert.equal(id,GAME),validateTarget:async target=>assert.equal(target,game)};
 let version=0;
 async function install(){
  const run='run-'+(++version),stage=path.join(base,'stage-'+run),backup=path.join(user,'game-backups',GAME,run);await fs.mkdir(stage,{recursive:true});
  for(const [file,data]of [[MODULE,'module-'+version],['dotnet/coreclr.dll','dotnet-framework'],['ShenPulse-Licenses/BepInEx.txt','license'],['winhttp.dll','loader-'+version],['BepInEx/core/runtime.dll','framework-'+version],['BepInEx/config/BepInEx.cfg','config-'+version],['BepInEx/config/ShenPulse.supermarket-simulator.json','bridge'],['shenpulse-module.json',JSON.stringify({gameId:GAME,files:[{file:MODULE}]})]])await put(stage,file,data);
  const receipt=await prepareShopUninstallReceipt({gameId:GAME,targetPath:game,deploymentRoot:stage,backupRoot:backup,userData:user,previousInstallation:store.state.game.installations[GAME]});
  await commitInstallationDeployment({deploymentRoot:stage,targetPath:game,backupRoot:backup,tempRoot:path.join(base,'temp-'+run)});
  store.state.game.installations[GAME]={path:game,uninstallReceiptPath:receipt};return receipt;
 }
 return {base,game,user,store,runtime,install,profileId,uninstall:options=>uninstallShopGame(runtime,GAME,{assertClosed:async()=>{},...options})};
}

test('désinstaller restaure les fichiers antérieurs et retire seulement les fichiers explicitement ajoutés',async t=>{
 const f=await fixture(t);await put(f.game,'BepInEx/config/BepInEx.cfg','original-config');await f.install();const result=await f.uninstall();
 assert.equal(result.sharedLoaderRetained,false);assert.equal(await exists(f.game,MODULE),false);assert.equal(await exists(f.game,'winhttp.dll'),false);assert.equal(await fs.readFile(path.join(f.game,'BepInEx/config/BepInEx.cfg'),'utf8'),'original-config');
 assert.equal(await fs.readFile(path.join(f.game,'Supermarket Simulator.exe'),'utf8'),'original-game');assert.equal(await fs.readFile(path.join(f.game,'save.dat'),'utf8'),'saved-game');assert.equal(f.runtime.activeInstalls.size,0);
});

test('plusieurs réparations conservent la première sauvegarde et non le précédent module ShenPulse',async t=>{
 const f=await fixture(t);await put(f.game,'winhttp.dll','pre-existing-loader');await f.install();await f.install();await f.uninstall();assert.equal(await fs.readFile(path.join(f.game,'winhttp.dll'),'utf8'),'pre-existing-loader');assert.equal(await exists(f.game,MODULE),false);
});

test('les autres mods et un chargeur modifié après installation sont conservés',async t=>{
 const f=await fixture(t);await f.install();await put(f.game,'BepInEx/plugins/AnotherMod.dll','other-mod');await put(f.game,'winhttp.dll','new-shared-loader');
 const result=await f.uninstall();assert.equal(result.sharedLoaderRetained,true);assert.equal(await fs.readFile(path.join(f.game,'BepInEx/plugins/AnotherMod.dll'),'utf8'),'other-mod');assert.equal(await fs.readFile(path.join(f.game,'winhttp.dll'),'utf8'),'new-shared-loader');assert.equal(await exists(f.game,MODULE),false);
});

test('une ancienne installation sans reçu retire le module ShenPulse et conserve le chargeur partagé',async t=>{
 const f=await fixture(t);await f.install();delete f.store.state.game.installations[GAME].uninstallReceiptPath;
 const result=await f.uninstall();assert.equal(result.sharedLoaderRetained,true);assert.equal(await exists(f.game,MODULE),false);assert.equal(await exists(f.game,'winhttp.dll'),true);assert.equal(await exists(f.game,'BepInEx/config/ShenPulse.supermarket-simulator.json'),false);
});

test('un jeu ouvert ou une opération déjà active empêche toute modification',async t=>{
 const f=await fixture(t);await f.install();await assert.rejects(f.uninstall({assertClosed:async()=>{throw Error('Game open');}}),/Game open/);assert.equal(await exists(f.game,MODULE),true);
 f.runtime.activeInstalls.add(GAME);await assert.rejects(f.uninstall(),/opération/);assert.equal(await exists(f.game,MODULE),true);
});

test('une sauvegarde altérée ou un reçu situé hors des sauvegardes ne provoque aucun retrait',async t=>{
 const f=await fixture(t);await put(f.game,'winhttp.dll','original');const file=await f.install(),receipt=JSON.parse(await fs.readFile(file,'utf8')),entry=receipt.files.find(e=>e.file==='winhttp.dll');await put(path.join(f.user,'game-backups',GAME),entry.original.file,'corrupt');
 await assert.rejects(f.uninstall(),/altérée/);assert.equal(await exists(f.game,MODULE),true);
 f.store.state.game.installations[GAME].uninstallReceiptPath=path.join(f.base,'outside.json');await assert.rejects(f.uninstall(),/Chemin/);assert.equal(await exists(f.game,MODULE),true);
});

test('un chemin de traversée dans un reçu ne peut atteindre un fichier extérieur au jeu',async t=>{
 const f=await fixture(t),file=await f.install(),receipt=JSON.parse(await fs.readFile(file,'utf8'));receipt.files[0].file='../outside.txt';await fs.writeFile(file,JSON.stringify(receipt));await put(f.base,'outside.txt','outside');
 await assert.rejects(f.uninstall(),/Chemin/);assert.equal(await fs.readFile(path.join(f.base,'outside.txt'),'utf8'),'outside');assert.equal(await exists(f.game,MODULE),true);
});

test('un échec au milieu du retrait rétablit les fichiers et conserve la possibilité de réparer',async t=>{
 const f=await fixture(t);await f.install();await assert.rejects(f.uninstall({deploy:async()=>{await fs.unlink(path.join(f.game,MODULE));throw Error('Copy failed');}}),/Copy failed/);
 assert.equal(await fs.readFile(path.join(f.game,MODULE),'utf8'),'module-1');assert.ok(f.store.state.game.installations[GAME]);
});

test('un changement de contexte pendant le retrait déclenche également le retour aux fichiers précédents',async t=>{
 const f=await fixture(t);await f.install();let allowed=true;await assert.rejects(f.uninstall({assertAccess:()=>{if(!allowed)throw Error('Profile changed');},deploy:async options=>{await commitInstallationDeployment(options);allowed=false;}}),/Profile changed/);
 assert.equal(await fs.readFile(path.join(f.game,MODULE),'utf8'),'module-1');
});

test('le reset sauvegarde puis rétablit exactement les douze cartes du profil actif, sans toucher aux autres jeux',async t=>{
 const f=await fixture(t),pack=loadShenazenGameCatalog(path.resolve(__dirname,'../resources')).find(p=>p.id===GAME),handlers=new Map();
 const old=[{id:'custom-rule',gameInteraction:{title:'Personnalisé'},actions:[{type:'audio.play',config:{url:'private-sound'}}],conditions:[{giftId:'custom-gift'}]}];
 f.store.state.game.interactionRulesByPack[GAME]=structuredClone(old);f.store.state.game.interactionRulesByPack.other=[{id:'other'}];f.store.state.game.installations[GAME]={path:f.game};
 const core={snapshot:()=>({state:f.store.getState()}),notifyRenderer(){},ruleEngine:{resetProfileState(){}},giftCatalog:{gifts:[]}};
 registerGameMaintenanceIpc({handle:(id,fn)=>handlers.set(id,fn),core,store:f.store,gameRuntime:f.runtime,requireGameAccess:id=>{assert.equal(id,GAME);return pack;}});
 const options={accountUid:'owner',profileId:f.profileId,confirmed:true};
 await assert.rejects(handlers.get('game:interactions:reset')(null,GAME,{...options,confirmed:false}),/Confirmez/);
 await assert.rejects(handlers.get('game:interactions:reset')(null,GAME,{...options,profileId:'other-profile'}),/profil/);
 const result=await handlers.get('game:interactions:reset')(null,GAME,options),rules=result.snapshot.state.game.interactionRulesByPack[GAME];assert.equal(rules.length,12);assert.deepEqual(JSON.parse(await fs.readFile(result.backupPath,'utf8')).rules,old);assert.deepEqual(f.store.state.game.interactionRulesByPack.other,[{id:'other'}]);assert.equal(f.store.state.game.installations[GAME].path,f.game);assert.ok(rules.every(rule=>rule.trigger.enabled&&rule.actions.length===1));
});


test('la commande IPC ne supprime l’installation qu’après confirmation et conserve les cartes du jeu',async t=>{
 const f=await fixture(t);await f.install();const rules=[{id:'kept-interaction'}];f.store.state.game.interactionRulesByPack[GAME]=rules;const handlers=new Map(),pack={id:GAME};
 registerGameMaintenanceIpc({handle:(id,fn)=>handlers.set(id,fn),core:{snapshot:()=>({state:f.store.getState()}),notifyRenderer(){}},store:f.store,gameRuntime:{uninstall:async()=>({ok:true})},requireGameAccess:()=>pack});
 const result=await handlers.get('game:uninstall')(null,GAME,{accountUid:'owner',profileId:f.profileId,confirmed:true});
 assert.equal(result.snapshot.state.game.installations[GAME],undefined);assert.deepEqual(f.store.state.game.interactionRulesByPack[GAME],rules);
});


test('les deux boutons demandent une confirmation puis transmettent uniquement le compte et le profil affichés',async()=>{
 const vm=require('node:vm'),source=require('node:fs').readFileSync('src/renderer/app/actions/handlers/entities-games.js','utf8'),calls=[],handlers=new Map(),state={session:{profileId:'a'},settings:{account:{uid:'owner'}}};let confirmed=false;
 const ctx=vm.createContext({snapshot:{state,packs:[{id:GAME,name:'Supermarket'}]},registerActionHandler:(actions,handler)=>{for(const action of actions)handlers.set(action,handler);},ACTION_NOT_HANDLED:Symbol(),requireGameAccess:()=>true,showActiveGameConflict:()=>false,activeGameSession:()=>null,toast(){},confirmAction:async()=>confirmed,render(){},acceptSnapshot:value=>{ctx.snapshot=value;},gamePageMessages:new Map(),perform:async work=>work(),api:{uninstallGame:async(id,scope)=>{calls.push(['uninstall',id,scope]);return {ok:true,snapshot:{state,packs:[{id:GAME}]}};},resetGameInteractions:async(id,scope)=>{calls.push(['reset',id,scope]);return {ok:true,snapshot:{state,packs:[{id:GAME}]}};}}});
 vm.runInContext(source,ctx);
 for(const action of ['uninstall-game','reset-game-interactions']){await handlers.get(action)({action,id:GAME});assert.equal(calls.length,0);}
 confirmed=true;
 for(const action of ['uninstall-game','reset-game-interactions'])await handlers.get(action)({action,id:GAME});
 assert.deepEqual(calls.map(call=>call[0]),['uninstall','reset']);for(const [,id,scope]of calls){assert.equal(id,GAME);assert.equal(scope.accountUid,'owner');assert.equal(scope.profileId,'a');assert.equal(scope.confirmed,true);}
 ctx.confirmAction=async()=>{ctx.snapshot.state.session.profileId='b';return true;};await handlers.get('reset-game-interactions')({action:'reset-game-interactions',id:GAME});assert.equal(calls.length,2);
});


test('une ancienne installation dont le jeu a déjà été retiré ne déclenche aucune suppression de fichiers',async t=>{
 const f=await fixture(t);await f.install();const moved=path.join(f.base,'already-removed');assert.equal(path.dirname(f.game),f.base);assert.equal(path.dirname(moved),f.base);await fs.rename(f.game,moved);
 const result=await f.uninstall();assert.equal(result.ok,true);assert.equal(result.alreadyRemoved,true);assert.equal(await exists(moved,MODULE),true);
});
