"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs/promises"),path=require("node:path"),os=require("node:os");
const {loadShenazenGameCatalog}=require("../src/main/game-catalog");
const {GAME_INSTALLERS}=require("../src/main/game-installer-manifest");
const {prepareGtaMode,modeSelectionPath,MARKER}=require("../src/main/game-runtime/gta-mode");
const {readMontChiliadCounterEvent}=require("../src/main/core/game-counter-events");
const {launchExternalGame}=require("../src/main/game-runtime/external-launch");
const packs=loadShenazenGameCatalog(path.resolve("resources"));
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),"shenpulse-koth-"));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const game=path.join(root,"GTA Enhanced"),local=path.join(root,"local");
 await fs.mkdir(game);await fs.writeFile(path.join(game,"GTA5_Enhanced.exe"),"fixture");
 await fs.writeFile(path.join(game,"PlayGTAV.exe"),"fixture");
 await fs.writeFile(path.join(game,"ShenPulseMontChiliadEnhanced.asi"),"fixture-"+MARKER);
 return {root,game,local,installation:{path:game,edition:"enhanced"}};
}
test("KOTH possède sa fiche Enhanced, ses 741 véhicules et douze cadeaux distincts des wins",()=>{
 const pack=packs.find(p=>p.id==="gtav-koth-enhanced");
 assert.ok(pack);assert.equal(pack.connector.port,58469);assert.equal(pack.connector.host,"127.0.0.1");
 const models=require("../src/main/game-catalog/gtav-koth-models.json");
 assert.equal(models.length,741);assert.equal(new Set(models).size,741);
 assert.equal(pack.effects.filter(e=>e.code.startsWith("koth_vehicle_")).length,741);
 for(const col of ["help","trap"]){const maps=pack.defaultMappings.filter(m=>m.marketColumn===col);assert.equal(maps.length,6);for(const m of maps)assert.ok(!pack.effects.find(e=>e.id===m.effectId).winCounter);}
 assert.ok(pack.catalogCategories.includes("gta"));assert.ok(pack.catalogCategories.includes("racing"));
 assert.ok(pack.guide.requirements.some(s=>s.includes("Histoire")));
 assert.ok(require("../src/shared/game-workspace-policy").hasIntegratedWinModels(pack));
 for(const effect of pack.effects)assert.ok(effect.name.trim().split(/\s+/).length<=2,effect.name);
 const installer=GAME_INSTALLERS[pack.id];assert.deepEqual(installer.executables,["GTA5_Enhanced.exe"]);
 assert.ok(installer.assets.every(a=>a.editions.includes("enhanced")&&a.url.startsWith("https://f003.backblazeb2.com/")));
 const save=installer.assets.filter(a=>a.action==="gta-enhanced-save");
 assert.equal(save.length,1);assert.deepEqual(save[0],GAME_INSTALLERS['gtav-montchiliad'].assets.find(a=>a.action==='gta-enhanced-save'));
 assert.ok(!installer.assets.some(a=>a.action==="gta-archive"));
});
test("le choix de mode est atomique, lié au dossier et bloque un changement pendant que GTA tourne",async t=>{
 const f=await fixture(t);
 const args={gameId:"gtav-koth-enhanced",installation:f.installation,localAppData:f.local};
 await prepareGtaMode(args);
 let data=await fs.readFile(modeSelectionPath(f.local));assert.equal(data.readUInt16LE(),0xfeff);
 assert.ok(data.toString("utf16le").includes("mode=koth"));assert.ok(data.toString("utf16le").includes(f.game));
 await prepareGtaMode({...args,existing:{ProcessId:10}});
 await assert.rejects(prepareGtaMode({...args,gameId:"gtav-montchiliad",existing:{ProcessId:10}}),/Fermez GTA/);
 assert.deepEqual(await fs.readFile(modeSelectionPath(f.local)),data);
 await prepareGtaMode({...args,gameId:"gtav-montchiliad"});
 assert.ok((await fs.readFile(modeSelectionPath(f.local),"utf16le")).includes("mode=montchiliad"));
 const before=await fs.readFile(modeSelectionPath(f.local));
 await assert.rejects(prepareGtaMode({...args,assertAccess(){throw new Error("Compte modifié");}}),/Compte modifié/);
 assert.deepEqual(await fs.readFile(modeSelectionPath(f.local)),before);
});
test("KOTH refuse Legacy et un ancien plugin, sans modifier la sélection",async t=>{
 const f=await fixture(t),args={gameId:"gtav-koth-enhanced",installation:f.installation,localAppData:f.local};
 await fs.writeFile(path.join(f.game,"ShenPulseMontChiliadEnhanced.asi"),"old module");
 await assert.rejects(prepareGtaMode(args),/trop ancien/);
 await fs.rm(path.join(f.game,"GTA5_Enhanced.exe"));
 await assert.rejects(prepareGtaMode(args),/Legacy/);
 await assert.rejects(fs.access(modeSelectionPath(f.local)));
});
test("les compteurs KOTH ne peuvent pas être traités comme ceux du Mont Chiliad et ne rejouent pas les événements",()=>{
 const cursors=new Map(),pack={id:"gtav-koth-enhanced"},base={type:"koth:state",sessionId:"test",counterEventId:0,counterDelta:0,counterEvent:""};
 assert.equal(readMontChiliadCounterEvent(pack,base,cursors),null);
 const event={...base,counterEventId:1,counterDelta:1,counterEvent:"win"};
 assert.equal(readMontChiliadCounterEvent(pack,event,cursors).amount,1);
 assert.equal(readMontChiliadCounterEvent(pack,event,cursors),null);
 assert.equal(readMontChiliadCounterEvent({id:"gtav-montchiliad"},event,cursors),null);
 assert.equal(readMontChiliadCounterEvent(pack,{...base,type:"montchiliad:victory",counterEventId:2,counterDelta:-1,counterEvent:"death"},cursors),null);
});

test("le lancement prépare la sauvegarde puis choisit le parcours KOTH sans réinitialiser une partie déjà préparée",async t=>{
 const f=await fixture(t),calls=[];
 const result=await launchExternalGame({gameId:"gtav-koth-enhanced",manifest:GAME_INSTALLERS["gtav-koth-enhanced"],installation:f.installation,assertAccess(){},findRunning:async()=>null,
 selectGtaMode:async args=>{calls.push("selection");await prepareGtaMode({...args,localAppData:f.local});},
 prepareGtaSave:async args=>{calls.push("save");assert.equal(args.gameId,'gtav-koth-enhanced');return {pending:false,alreadyPresent:true};},
 shell:{openPath:async executable=>{calls.push("launch");assert.equal(path.basename(executable),"PlayGTAV.exe");assert.ok((await fs.readFile(modeSelectionPath(f.local),"utf16le")).includes("mode=koth"));return "";}},scheduleGtaSaveDeployment(){throw Error("Must not replace a save");}
 });
 assert.equal(result.ok,true);assert.deepEqual(calls,["selection","save","launch"]);assert.equal(result.saveDeployment.alreadyPresent,true);
});

test("le lancement attend la sauvegarde pour chaque mode Enhanced, mais ne touche pas un jeu ouvert",async t=>{
 const f=await fixture(t);
 for(const gameId of ['gtav-koth-enhanced','gtav-hiking-enhanced','gtav-montchiliad']){
  const calls=[],options={gameId,manifest:GAME_INSTALLERS[gameId],installation:f.installation,assertAccess(){},selectGtaMode:async()=>{},findRunning:async()=>null,
   prepareGtaSave:async()=>{calls.push('save');return {pending:true,reason:'rockstar-profile-not-found'};},
   shell:{openPath:async()=>{calls.push('launch');return '';}},scheduleGtaSaveDeployment(){calls.push('schedule');}};
  await launchExternalGame(options);assert.deepEqual(calls,['save','launch','schedule'],gameId);
  calls.length=0;await launchExternalGame({...options,findRunning:async()=>({ProcessId:42,ExecutablePath:path.join(f.game,'GTA5_Enhanced.exe')})});assert.deepEqual(calls,[],gameId);
  await assert.rejects(launchExternalGame({...options,prepareGtaSave:async()=>{throw Error('Sauvegarde indisponible');}}),/Sauvegarde indisponible/);assert.deepEqual(calls,[],gameId);
 }
});

test("le rattachement valide le mode avant toute lecture d’un ASI déjà verrouillé par GTA",async t=>{
 const f=await fixture(t),args={gameId:"gtav-koth-enhanced",installation:f.installation,localAppData:f.local};
 await prepareGtaMode(args);await fs.rm(path.join(f.game,"ShenPulseMontChiliadEnhanced.asi"));
 await prepareGtaMode({...args,existing:{ProcessId:42}});
 await assert.rejects(prepareGtaMode({...args,existing:null}),/trop ancien/);
 await assert.rejects(prepareGtaMode({...args,existing:{ProcessId:42},assertAccess(){throw Error("Access expired");}}),/Access expired/);
});


test("les vignettes KOTH sont des images de leurs véhicules et chaque win possède un cadeau",async()=>{
 const pack=packs.find(p=>p.id==='gtav-koth-enhanced');
 assert.equal(pack.effects.length,773);
 for(const effect of pack.effects.filter(e=>e.code.startsWith('koth_vehicle_'))){assert.ok(effect.image.endsWith('.webp'));assert.ok((await fs.stat(path.resolve('src/renderer',effect.image))).size>200);}
 for(const mapping of pack.defaultMappings.filter(m=>m.id.startsWith('koth-overlay_win_'))){assert.ok(mapping.giftName);assert.equal(mapping.enabled,true);assert.equal(mapping.triggerEnabled,true);}
});
test("les cadeaux KOTH manquants sont ajoutés sans remplacer une association personnalisée",()=>{
 const pack=packs.find(p=>p.id==='gtav-koth-enhanced'),{defaultGameInteractionRule}=require('../src/main/game-hub/interaction-defaults'),{migrateKothWinGifts}=require('../src/main/game-hub/starter-defaults');
 const mapping=pack.defaultMappings.find(m=>m.effectId==='overlay_win_add_1'),effect=pack.effects.find(e=>e.id===mapping.effectId);
 const blank=defaultGameInteractionRule(pack,effect,{...mapping,giftName:'',enabled:false,triggerEnabled:false},2026102603);
 const custom=structuredClone(blank);custom.conditions=[{field:'data.giftName',operator:'equals',value:'Gift selected by user'}];custom.gameInteraction.presetId='custom';
 const previous=structuredClone(custom);const out=migrateKothWinGifts({store:{},giftCatalog:null},pack,[blank,custom],2026102603);
 assert.equal(out.repaired,1);assert.equal(blank.enabled,true);assert.equal(blank.conditions[0].value,'You’re Amazing');assert.deepEqual(custom,previous);
});
test("la galerie regroupe GTA et Minecraft en conservant uniquement leurs modes visibles",async()=>{
 const vm=require('node:vm');const text=await fs.readFile('src/renderer/app/core/access-navigation.js','utf8');const source=text.slice(text.indexOf('function minecraftLauncherPack'),text.indexOf('const ACTION_FEATURE_REQUIREMENTS'));
 const make=id=>({id,name:id,effects:[],accessMode:'included'});const context={snapshot:{packs:['gtav-montchiliad','gtav-koth-enhanced','minecraft-bedrock-box','minecraft-sandbox-3','balatro'].map(make)},MINECRAFT_LAUNCHER_ID:'minecraft',MINECRAFT_MODE_IDS:['minecraft-bedrock-box','minecraft-sandbox-3'],GTA_LAUNCHER_ID:'gta-enhanced',GTA_MODE_IDS:['gtav-montchiliad','gtav-koth-enhanced'],canAccessGame:p=>p.id!=='gtav-koth-enhanced'};vm.createContext(context);vm.runInContext(source,context);const visible=context.visibleGamePacks();assert.equal(visible.length,3);const gta=visible.find(p=>p.id==='gta-enhanced');assert.equal(gta.name,'GTA Enhanced/Amélioré');assert.equal(gta.modes.length,1);assert.equal(gta.modes[0].id,'gtav-montchiliad');assert.equal(visible.find(p=>p.id==='minecraft').modes.length,2);
});

test("la réparation du cadeau de course ne touche ni un autre cadeau ni les montants choisis",()=>{
 const pack=packs.find(p=>p.id==='gtav-koth-enhanced'),{defaultGameInteractionRule}=require('../src/main/game-hub/interaction-defaults'),{migrateKothWinGifts}=require('../src/main/game-hub/starter-defaults');
 const mapping=pack.defaultMappings.find(m=>m.effectId==='overlay_win_remove_50'),effect=pack.effects.find(e=>e.id===mapping.effectId);
 const gifts=[{id:'10572',name:'Hub Race Car',cost:12000,imageUrl:'https://example.com/race.webp'}];
 const race=defaultGameInteractionRule(pack,effect,{...mapping,giftName:'Voiture de course',giftId:''},2026102701);race.actions[0].config.amount=-77;
 const custom=structuredClone(race);custom.conditions[0].giftId='7063';const before=structuredClone(custom);
 assert.equal(migrateKothWinGifts({store:{},giftCatalog:{gifts}},pack,[race,custom],2026102701).repaired,1);
 assert.equal(race.conditions[0].giftId,'10572');assert.equal(race.conditions[0].giftImageUrl,'https://example.com/race.webp');assert.equal(race.actions[0].config.amount,-77);assert.deepEqual(custom,before);
});


test("Hasard Obstacle reste disponible sans modifier les douze cadeaux du pack",async()=>{
 const pack=packs.find(p=>p.id==='gtav-koth-enhanced'),effect=pack.effects.find(e=>e.id==='koth_random_obstacle');
 assert.equal(effect.name,'Hasard Obstacle');assert.equal(effect.column,'trap');assert.equal(effect.available,true);
 assert.ok(effect.description.includes('sans répétition'));assert.ok(effect.description.includes('chute'));
 const {createEffectPayload}=require('../src/main/game-hub/effect-payload');
 const payload=createEffectPayload(effect,{}, {quantity:100,parameters:{audit:2}});
 assert.equal(payload.effect.code,'koth_random_obstacle');assert.equal(payload.effect.quantity,100);assert.equal(payload.effect.parameters.audit,2);
 assert.ok((await fs.stat(path.resolve('src/renderer',effect.image))).size>1000);
 assert.equal(pack.defaultMappings.filter(m=>m.marketColumn==='help').length,6);assert.equal(pack.defaultMappings.filter(m=>m.marketColumn==='trap').length,6);
});


test("les trois installateurs GTA partagent le meme module Enhanced et leur registre reste coherent",()=>{
 const registry=require("../scripts/manifests/game-packs.json").assets;
 const ids=["gtav-koth-enhanced","gtav-hiking-enhanced","gtav-montchiliad"];
 const modules=ids.map(id=>{
  const manifest=GAME_INSTALLERS[id],asset=manifest.assets.find(a=>a.fileName==="ShenPulseMontChiliadEnhanced.asi");
  assert.ok(asset,id);const published=registry.find(a=>a.gameId===id&&a.id===asset.id);
  assert.ok(published,id);assert.equal(published.version,manifest.version);assert.equal(published.size,asset.size);assert.equal(published.sha256,asset.sha256);assert.ok(asset.url.endsWith(published.key));
  assert.equal(packs.find(p=>p.id===id).installerVersion,manifest.version);
  return asset;
 });
 for(const module of modules){assert.equal(module.sha256,modules[0].sha256);assert.equal(module.size,modules[0].size);}
});
