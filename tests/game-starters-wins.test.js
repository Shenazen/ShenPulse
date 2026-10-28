"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),Module=require('node:module');
const {JSDOM}=require('jsdom');
const {loadShenazenGameCatalog}=require('../src/main/game-catalog');
const {prepareGamePresentation,GIFTS,STARTER_VERSION}=require('../src/main/game-catalog/presentation');
const {defaultGameInteractionRule}=require('../src/main/game-hub/interaction-defaults');
const {initializeDefaultInteractions}=require('../src/main/game-hub/interaction-management');
const {GiftCatalog}=require('../src/main/catalogs');
const {createGamePackOverlay}=require('../src/shared/game-pack-overlay');
const packs=loadShenazenGameCatalog(path.resolve('resources')),gifts=new GiftCatalog(path.resolve('resources'));
const rulesFor=pack=>pack.defaultMappings.map(m=>defaultGameInteractionRule(pack,pack.effects.find(e=>e.id===m.effectId),m,pack.interactionCatalogVersion,gifts));
function hubFor(pack,rules=[],version=0,directory){
 const state={session:{profileId:'profile'},settings:{account:{uid:'owner'}},game:{interactionRulesByPack:{[pack.id]:rules},interactionCatalogVersions:{[pack.id]:version}}};
 return {state,giftCatalog:gifts,assertAccess:id=>{assert.equal(id,pack.id);return pack;},store:{directory,getState:()=>state,mutate:fn=>fn(state)}};
}
function externalFixture(){
 const file=path.resolve('tests/external-game-workspace.test.js'),source=fs.readFileSync(file,'utf8'),m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));
 m._compile(source.slice(0,source.indexOf("test('les 45"))+'\nmodule.exports={fixture};',file);return m.exports.fixture();
}
test('les 37 modules disponibles proposent six aides et six pièges avec les mêmes douze cadeaux, sans wins mélangées',()=>{
 let available=0;
 for(const pack of packs.filter(p=>require('../src/shared/game-workspace-policy').eligible(p))){
  if(!pack.effects.some(e=>e.available!==false)){assert.equal(pack.defaultMappings.filter(m=>m.marketColumn).length,0,pack.id);continue;}
  available++;
  for(const column of ['help','trap']){
   const maps=pack.defaultMappings.filter(m=>m.marketColumn===column);assert.equal(maps.length,6,pack.id+' '+column);
   assert.deepEqual(maps.map(m=>[m.giftId,m.giftCost]),GIFTS[column].map(g=>[g[1],g[2]]),pack.id);
   for(const m of maps){const effect=pack.effects.find(e=>e.id===m.effectId);assert.ok(effect?.available!==false);assert.ok(!effect.winCounter);assert.ok(m.enabled!==false);}
  }
  const hub=hubFor(pack);initializeDefaultInteractions(hub,pack.id);const projection=createGamePackOverlay({...hub.state,commerce:{subscription:{tier:'pro',status:'active',source:'paid'}}},pack.id);
  for(const column of ['help','trap'])assert.equal(projection.cards.filter(card=>card.column===column&&card.triggerType==='gift').length,6,pack.id);
 }
 assert.equal(available,37);
});
test('tous les noms du catalogue et des presets tiennent en deux mots ; les données techniques sont conservées',()=>{
 for(const pack of packs){for(const effect of pack.effects)assert.ok(effect.name.trim().split(/\s+/).length<=2,pack.id+': '+effect.name);for(const m of pack.defaultMappings||[])assert.ok(m.title.trim().split(/\s+/).length<=2,pack.id+': '+m.title);}
 const raw={id:'own-game',name:'Nom',platforms:['shenpulse'],effects:[{id:'original',code:'technical-code',name:'Afficher une très grande tempête',parameters:[{id:'parameter',default:42}],duration:17,inputSequence:[{key:'Z'}],available:true}],defaultMappings:[]};
 const before=structuredClone(raw),next=prepareGamePresentation(raw);for(const key of ['id','code','parameters','duration','inputSequence','available'])assert.deepEqual(next.effects[0][key],raw.effects[0][key]);assert.deepEqual(raw,before);
});
test('migration : seuls les anciens presets intacts sont remplacés, sauvegarde exacte et associations personnalisées conservées',t=>{
 const pack=packs.find(p=>p.id==='gtav-montchiliad'),version=1;
 const old=pack.previousDefaultMappings.map(m=>defaultGameInteractionRule(pack,pack.effects.find(e=>e.id===m.effectId),m,version,gifts));
 const ordinary=old.filter(r=>r.actions[0].type!=='overlay.win-counter'&&!['follow','like','likes'].includes(r.trigger.type));assert.ok(ordinary.length>=3);
 ordinary[0].gameInteraction.title='Ma règle personnelle';ordinary[0].actions.push({id:'linked-game',type:'game.effect',config:{packId:'balatro',effectId:'another',parameters:{value:2}}});
 ordinary[1].cooldown.perUserMs=12345;
 const custom=structuredClone(ordinary[0]);custom.id='manual-custom';custom.gameInteraction.default=false;old.push(custom);
 const original=structuredClone(old),kept=original.filter(r=>r.actions[0].type==='overlay.win-counter'&&r.actions[0].config.operation!=='multiplier'||['follow','like','likes'].includes(r.trigger.type)||r.id===ordinary[0].id||r.id===ordinary[1].id||r.id==='manual-custom');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'shenpulse-starter-'));t.after(()=>{assert.equal(path.dirname(directory),os.tmpdir());assert.ok(path.basename(directory).startsWith('shenpulse-starter-'));fs.rmSync(directory,{recursive:true,force:true});});
 const hub=hubFor(pack,old,version,directory),result=initializeDefaultInteractions(hub,pack.id),rules=hub.state.game.interactionRulesByPack[pack.id];
 assert.ok(result.removed>0);assert.equal(hub.state.game.interactionCatalogVersions[pack.id],STARTER_VERSION);
 for(const rule of kept)assert.deepEqual(rules.find(r=>r.id===rule.id),rule,rule.id);
 const files=fs.readdirSync(directory,{recursive:true}).filter(p=>String(p).endsWith('.json'));assert.equal(files.length,1);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory,files[0]),'utf8')).rules,original);
 const before=structuredClone(rules),repeat=initializeDefaultInteractions(hub,pack.id);assert.equal(repeat.added,0);assert.equal(repeat.removed,0);assert.deepEqual(rules,before);
 const ownedGifts=new Set();for(const rule of rules.filter(r=>r.trigger.type==='gift'&&r.trigger.enabled!==false)){const gift=rule.conditions.find(c=>c.field==='data.giftName');if(!gift)continue;if(rule.gameInteraction.presetId?.startsWith('starter-'))assert.ok(!ownedGifts.has(gift.giftId),'Pas de cadeau déclenché deux fois');ownedGifts.add(gift.giftId);}
});
test('une suppression volontaire reste supprimée après une seconde ouverture, les nouveaux profils reçoivent les douze cartes',()=>{
 const pack=packs.find(p=>p.id==='balatro'),hub=hubFor(pack);initializeDefaultInteractions(hub,pack.id);const rules=hub.state.game.interactionRulesByPack[pack.id];assert.equal(rules.length,12);rules.shift();initializeDefaultInteractions(hub,pack.id);assert.equal(rules.length,11);
});
test('la page GTA sépare les cadeaux de wins, leur configuration et les effets ; Supermarket reste sans wins',t=>{
 const f=externalFixture();t.after(()=>f.dom.window.close());
 for(const id of ['gtav-montchiliad','minecraft-bedrock-box','minecraft-sandbox-3','supermarket-simulator']){
  const pack=packs.find(p=>p.id===id);f.ctx.selectedGameId=id;f.ctx.snapshot.state.game.interactionRulesByPack[id]=rulesFor(pack);f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);
  const doc=f.ctx.content,wins=pack.effects.some(e=>e.winCounter);
  assert.equal(!!doc.querySelector('#market-wins'),wins);assert.equal(!!doc.querySelector('.game-pack-phone-wins-source'),wins);
  if(wins){assert.ok(doc.querySelector('#market-wins .game-pack-win-level'));assert.ok(doc.querySelector('#market-overlays [data-game-win-config]'));assert.equal(doc.querySelectorAll('#market-wins [data-native-overlay]').length,0);assert.ok(doc.querySelector('#market-overlays [data-native-overlay="winCounter"]'));assert.equal(new URL(doc.querySelector('.game-pack-phone-wins-source').src).pathname,'/overlay/game-wins.html');}
  for(const card of doc.querySelectorAll('.game-pack-column [data-market-card]')){const rule=f.ctx.snapshot.state.game.interactionRulesByPack[id].find(r=>r.id===card.dataset.rule);assert.ok(!rule?.actions.some(a=>a.type==='overlay.win-counter'));}
 }
});
test('IPC wins : montants signés, activation seule, ajout atomique, suppression sans perdre une action liée et portée protégée',()=>{
 const {registerGameWinsIpc}=require('../src/main/ipc/game-wins'),pack=packs.find(p=>p.id==='gtav-montchiliad'),hub=hubFor(pack,rulesFor(pack)),handlers=new Map(),core={snapshot:()=>({state:hub.state}),notifyRenderer(){},giftCatalog:gifts};
 registerGameWinsIpc({handle:(n,fn)=>handlers.set(n,fn),core,store:hub.store,requireGameAccess:id=>hub.assertAccess(id)});
 const run=patch=>handlers.get('game:wins:level')(null,pack.id,{accountUid:'owner',profileId:'profile',...patch}),rules=()=>hub.state.game.interactionRulesByPack[pack.id];
 const positive=rules().find(r=>r.actions[0].config.operation==='adjust'&&r.actions[0].config.amount>0),negative=rules().find(r=>r.actions[0].config.operation==='adjust'&&r.actions[0].config.amount<0),ids=[positive.id,negative.id];
 run({operation:'edit',ruleIds:ids,amount:8});assert.equal(rules().find(r=>r.id===ids[0]).actions[0].config.amount,8);assert.equal(rules().find(r=>r.id===ids[1]).actions[0].config.amount,-8);
 run({operation:'edit',ruleIds:ids,enabled:false});for(const id of ids)assert.equal(rules().find(r=>r.id===id).enabled,false);
 const before=structuredClone(rules());assert.throws(()=>run({operation:'edit',ruleIds:[ids[0],'missing'],amount:5}),/existe plus/);assert.deepEqual(rules(),before);assert.throws(()=>run({operation:'edit',ruleIds:ids,amount:0}),/entier/);assert.throws(()=>run({operation:'add',amount:2,profileId:'other'}),/profil/);
 run({operation:'add',amount:9});assert.equal(rules().length,before.length+2);const added=rules().slice(-2);assert.ok(added.every(r=>!r.enabled&&!r.trigger.enabled));assert.deepEqual(added.map(r=>r.actions[0].config.amount),[9,-9]);
 added[0].actions.push({id:'linked',type:'audio.play',config:{url:'keep'}});assert.throws(()=>run({operation:'remove',ruleIds:added.map(r=>r.id)}),/actions liées/);assert.ok(rules().some(r=>r.id===added[1].id));run({operation:'remove',ruleIds:[added[1].id]});assert.equal(rules().length,before.length+1);
});
test('runtime wins : inversion, multiplicateur cumulable plafonné, durée réinitialisée ou additionnée et arrêt',async()=>{
 const {ActionRunner}=require('../src/main/action-runner'),state={session:{},settings:{},overlaySession:{hasData:true,winCounterCurrent:3}},published=[],runner=new ActionRunner({store:{getState:()=>state,mutateRuntime:fn=>fn(state)},gameHub:{assertAccess(){}},overlayServer:{publish:(channel,payload)=>published.push([channel,payload])},notifyRenderer(){}});
 const run=config=>runner.run({type:'overlay.win-counter',config:{packId:'minecraft-bedrock-box',...config}});
 await run({operation:'invert'});assert.equal(state.overlaySession.winCounterCurrent,-3);await run({operation:'invert'});assert.equal(state.overlaySession.winCounterCurrent,3);
 await run({operation:'multiplier',amount:2,duration:600,stackMode:'increment',maxMultiplier:3});assert.equal(state.overlaySession.winCounterMultiplier,2);const end=state.overlaySession.winCounterMultiplierUntil;
 await run({operation:'multiplier',amount:2,duration:600,stackMode:'increment',maxMultiplier:3,addDuration:true});assert.equal(state.overlaySession.winCounterMultiplier,3);assert.ok(state.overlaySession.winCounterMultiplierUntil>=end+599000);
 await run({operation:'multiplier',amount:2,duration:600,stackMode:'increment',maxMultiplier:3});assert.equal(state.overlaySession.winCounterMultiplier,3);assert.ok(state.overlaySession.winCounterMultiplierUntil<end+1000);
 await run({operation:'adjust',amount:2});assert.equal(state.overlaySession.winCounterCurrent,9);
 await runner.run({type:'overlay.multiplier-timer',config:{operation:'reset'}});assert.equal(state.overlaySession.winCounterMultiplier,1);await run({operation:'reset'});assert.equal(state.overlaySession.winCounterCurrent,0);assert.ok(published.some(([c])=>c==='multiplier-timer'));
});
test('projection et vrai HUD : quatre paliers de chaque côté, reset, compteur, multiplicateur, réaction et isolation profil/jeu',t=>{
 const pack=packs.find(p=>p.id==='gtav-montchiliad'),rules=rulesFor(pack),state={session:{profileId:'profile'},settings:{overlayConfigs:{winCounter:{enabled:true,current:-3,target:15,showGoal:true},multiplierTimer:{enabled:true}}},game:{interactionRulesByPack:{[pack.id]:rules}},commerce:{subscription:{tier:'pro',status:'active',source:'paid'}}};
 const projection=createGamePackOverlay(state,pack.id);assert.equal(projection.cards.filter(c=>c.column==='help'&&c.triggerType==='gift').length,6);assert.equal(projection.wins.positive.length,4);assert.equal(projection.wins.negative.length,4);assert.ok(projection.wins.reset.giftImageUrl);assert.ok(!JSON.stringify(projection).includes('cooldown'));
 const dom=new JSDOM(fs.readFileSync('resources/overlays/game-wins.html','utf8'),{runScripts:'outside-only',url:'https://test/game-wins.html?jeu='+pack.id+'&profile=profile'});t.after(()=>dom.window.close());dom.window.eval(fs.readFileSync('resources/overlays/runtime/game-wins.js','utf8'));
 const hud=dom.window.ShenPulseGameWins,doc=dom.window.document;hud.render(projection);assert.equal(doc.querySelectorAll('.hud-gift-column.positive .hud-gift').length,4);assert.equal(doc.querySelector('.hud-counter').textContent,'WIN : -3 / 15');assert.ok(doc.querySelector('.hud-reset img'));assert.equal(doc.querySelector('.hud-multiplier').hidden,true);
 projection.wins.multiplier=4;projection.wins.multiplierEndsAt=Date.now()+120000;hud.render(projection);assert.equal(doc.querySelector('.hud-multiplier strong').textContent,'×4');assert.equal(doc.querySelector('.hud-multiplier').hidden,false);
 const message={packId:pack.id,profileId:'profile',ruleId:projection.wins.positive[0].id,viewer:'<script>bad()</script>'};hud.reaction(message);assert.equal(doc.querySelectorAll('.is-reacting').length,1);assert.equal(doc.querySelector('.hud-viewer').textContent,message.viewer);assert.equal(doc.querySelector('.hud-viewer script'),null);
 hud.render({...projection,profileId:'other'});assert.equal(doc.querySelector('#wins-hud').childElementCount,0);hud.render({...projection,enabled:false});assert.equal(doc.querySelector('#wins-hud').childElementCount,0);
 const manual=rules.find(r=>r.actions[0].config.operation==='adjust');manual.trigger.enabled=false;assert.equal(createGamePackOverlay(state,pack.id).wins.positive.length+createGamePackOverlay(state,pack.id).wins.negative.length,7);
});
test('TikTok et OBS ajoutent la source de wins distincte à la disposition approuvée sans doublon',()=>{
 const {prepareTikTok}=require('../src/main/studio-installation/tiktok'),{prepareCollection}=require('../src/main/studio-installation/obs');
 const plan={identity:'account:profile:gta',packId:'gtav-montchiliad',profileId:'profile',gameName:'GTA',sceneName:'GTA · ShenPulse',executable:'GTA5.exe',overlayUrl:'https://test/game-pack.html?jeu=gtav-montchiliad&profile=profile',winsOverlayUrl:'https://test/game-wins.html?jeu=gtav-montchiliad&profile=profile',assertScope(){}};
 const original={SourceService:{state:{scenes:[],sceneSource:{},layerMap:{}}}},first=prepareTikTok(original,plan),second=prepareTikTok(first.document,plan),sources=Object.values(second.document.SourceService.state.sceneSource[first.sceneId].data);
 assert.equal(sources.length,4);assert.equal(sources.filter(s=>s.type==='browser').length,2);const wins=sources.find(s=>s.payload.url===plan.winsOverlayUrl);assert.deepEqual(wins.transform.size,{cx:1080,cy:1920});assert.equal(wins.transform.translateX,0);assert.equal(wins.transform.translateY,0);assert.equal(wins.transform.scaleX,.625);
 const obs=prepareCollection(prepareCollection(null,plan).document,plan),scene=obs.document.sources.find(s=>s.id==='scene');assert.equal(scene.settings.items.length,4);assert.equal(obs.document.sources.filter(s=>s.id==='browser_source').length,2);assert.ok(obs.document.sources.some(s=>s.settings?.url===plan.winsOverlayUrl));
});

// Baseline 2.1.0 revue après le module Palworld autonome et le libellé Blue Prince.
// Les codes et paramètres restent couverts par cette empreinte complète et les tests natifs.
test('les codes, paramètres, séquences, durées et autres données des effets correspondent à la référence 2.1.0',()=>{
 const technical=packs.filter(p=>!["gtav-hiking-enhanced","gtav-koth-enhanced","shenfarm","shenpaint","shenkite","splash-bombes"].includes(p.id)).map(p=>({id:p.id,effects:p.effects.filter(e=>!['overlay_win_reset','overlay_win_invert','overlay_win_mute','overlay_win_unmute'].includes(e.code)).map(({name,previousNames,column,...technical})=>technical)}));
 assert.equal(require('node:crypto').createHash('sha256').update(JSON.stringify(technical)).digest('hex'),'c422abca361a23381d7ad1bf030c86e907aa706779e363b05501a3377f651ec5');
});
test('les vrais contrôleurs de la page enregistrent paliers, multiplicateur et options, sans toucher aux autres actions',async t=>{
 const f=externalFixture();t.after(()=>f.dom.window.close());const pack=packs.find(p=>p.id==='gtav-montchiliad'),state=f.ctx.snapshot.state;f.ctx.selectedGameId=pack.id;state.settings.account={uid:'owner'};state.game.interactionRulesByPack[pack.id]=rulesFor(pack);
 const calls=[],handlers=new Map();require('../src/main/ipc/game-wins').registerGameWinsIpc({handle:(n,fn)=>handlers.set(n,fn),core:{snapshot:()=>structuredClone(f.ctx.snapshot),notifyRenderer(){},giftCatalog:gifts},store:{getState:()=>f.ctx.snapshot.state,mutate:fn=>fn(f.ctx.snapshot.state)},requireGameAccess:()=>pack});
 f.ctx.api.saveGameWinsLevel=async(id,patch)=>handlers.get('game:wins:level')(null,id,patch);
 f.ctx.saveOverlayConfig=async(key,value)=>{calls.push({key,value});f.ctx.snapshot.state.settings.overlayConfigs||={};f.ctx.snapshot.state.settings.overlayConfigs[key]=value;};
 f.ctx.overlayConfig=key=>f.ctx.snapshot.state.settings.overlayConfigs?.[key]||{};
 f.ctx.confirmAction=async()=>true;vm.runInContext(fs.readFileSync('src/renderer/app/features/games/wins-controls.js','utf8'),f.ctx);
 f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);
 const amount=f.ctx.content.querySelector('[data-game-win-level]'),ids=JSON.parse(amount.dataset.gameWinLevel);amount.value='7';amount.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));await vm.runInContext('marketWriteQueue',f.ctx);
 assert.deepEqual(ids.map(id=>Math.abs(f.ctx.snapshot.state.game.interactionRulesByPack[pack.id].find(r=>r.id===id).actions[0].config.amount)),[7]);
 const enabled=f.ctx.content.querySelector('[data-game-win-enabled]');enabled.checked=false;enabled.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));await vm.runInContext('marketWriteQueue',f.ctx);assert.ok(ids.every(id=>f.ctx.snapshot.state.game.interactionRulesByPack[pack.id].find(r=>r.id===id).enabled===false));
 const duration=f.ctx.content.querySelector('[data-market-inline="win-duration"]');duration.value='3';await f.ctx.saveSupermarketInline(duration);assert.equal(f.saved.at(-1).actions[0].config.duration,180);
 const color=f.ctx.content.querySelector('[data-game-win-config="winCounterLabelColorPositive"]');color.value='#123abc';color.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));await vm.runInContext('marketWriteQueue',f.ctx);assert.equal(calls.at(-1).value.winCounterLabelColorPositive,'#123abc');
 const timer=f.ctx.content.querySelector('[data-game-win-timer]');timer.checked=false;timer.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));await vm.runInContext('marketWriteQueue',f.ctx);assert.equal(calls.at(-1).key,'multiplierTimer');assert.equal(calls.at(-1).value.enabled,false);
 const before=structuredClone(f.ctx.snapshot.state.game.interactionRulesByPack[pack.id]);f.ctx.confirmAction=async()=>{f.ctx.selectedGameId='balatro';return true;};await assert.rejects(f.handlers.get('game-win-remove')({action:'game-win-remove',target:{dataset:{ruleIds:JSON.stringify(ids)}}}),/jeu.*profil a changé/);assert.deepEqual(f.ctx.snapshot.state.game.interactionRulesByPack[pack.id],before);
});

test('Streamlabs conserve les trois zones et ajoute le HUD de wins en quatrième source, sans doublon',async()=>{
 const {installStreamlabs}=require('../src/main/studio-installation/streamlabs'),plan={identity:'owner:profile:mc',packId:'minecraft-bedrock-box',profileId:'profile',gameName:'Minecraft',sceneName:'Minecraft · ShenPulse',executable:'javaw.exe',overlayUrl:'https://test/game-pack.html?jeu=minecraft-bedrock-box&profile=profile',winsOverlayUrl:'https://test/game-wins.html?jeu=minecraft-bedrock-box&profile=profile',assertScope(){}};
 const sources=[],items=[],transforms=[],settings=[];let scene;
 const client={connect:async()=>{},close(){},call:async(resource,method,...args)=>{
  if(method==='isStreaming'||method==='isRecording')return false;
  if(method==='getScenes')return scene?[scene]:[];
  if(method==='createScene'){scene={id:'scene',name:args[0],resourceId:'Scene[scene]'};return scene;}
  if(method==='baseResolution')return {baseWidth:1080,baseHeight:1920};
  if(method==='getSources')return sources;if(method==='getItems')return items;
  if(method==='createAndAddSource'){const sourceId=String(sources.length+1);sources.push({sourceId,name:args[0],type:args[1],resourceId:'Source['+sourceId+']'});settings.push(args[2]);const item={sourceId,resourceId:'SceneItem['+sourceId+']'};items.push(item);return item;}
  if(method==='setTransform')transforms.push(args[0]);if(['setTransform','setVisibility','makeSceneActive','updateSettings'].includes(method))return;
  throw Error('Unexpected '+method);
 }};
 await installStreamlabs({},plan,client);await installStreamlabs({},plan,client);assert.equal(sources.length,4);assert.equal(items.length,4);assert.equal(settings[3].url,plan.winsOverlayUrl);assert.deepEqual(transforms[3],{position:{x:0,y:0},scale:{x:1,y:1},rotation:0});assert.deepEqual(transforms[7],transforms[3]);
});

test('modifier un palier ne touche jamais le compteur lié à un autre jeu de la même règle',()=>{
 const pack=packs.find(p=>p.id==='gtav-montchiliad'),rule=rulesFor(pack).find(r=>r.actions[0].config.operation==='adjust'),local=structuredClone(rule.actions[0]),foreign={...structuredClone(local),id:'foreign-counter',config:{...local.config,packId:'minecraft-bedrock-box',amount:73}};rule.actions.unshift(foreign);
 const hub=hubFor(pack,[rule]),handlers=new Map();require('../src/main/ipc/game-wins').registerGameWinsIpc({handle:(n,fn)=>handlers.set(n,fn),core:{snapshot:()=>({state:hub.state}),notifyRenderer(){}},store:hub.store,requireGameAccess:()=>pack});
 const edit=()=>handlers.get('game:wins:level')(null,pack.id,{accountUid:'owner',profileId:'profile',operation:'edit',ruleIds:[rule.id],amount:11});edit();const saved=hub.state.game.interactionRulesByPack[pack.id][0];assert.equal(saved.actions[0].config.amount,73);assert.equal(Math.abs(saved.actions[1].config.amount),11);
 saved.actions.push({...structuredClone(local),id:'second-local-counter'});const before=structuredClone(saved);assert.throws(edit,/plusieurs actions de wins/);assert.deepEqual(hub.state.game.interactionRulesByPack[pack.id][0],before);
});

test('TCG remplace les anciennes cartes générées par six aides et six pièges, avec sauvegarde exacte',t=>{
 const pack=packs.find(p=>p.id==='tcg-card-shop-simulator'),version=2026102603;
 const old=pack.previousDefaultMappings.slice(0,12).map((m,i)=>{
  const rule=defaultGameInteractionRule(pack,pack.effects.find(e=>e.id===m.effectId),m,20261022,gifts);
  rule.trigger.enabled=true;rule.conditions=[{field:'data.giftName',operator:'equals',value:i?'Ancien cadeau '+i:'Rose',giftId:i?'old-'+i:'5655'}];return rule;
 });
 const current=rulesFor(pack).filter(r=>r.gameInteraction.presetId!=='starter-help-1'),rules=[...old,...current],before=structuredClone(rules);
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'shenpulse-tcg-cleanup-'));t.after(()=>{assert.equal(path.dirname(directory),os.tmpdir());assert.ok(path.basename(directory).startsWith('shenpulse-tcg-cleanup-'));fs.rmSync(directory,{recursive:true,force:true});});
 const hub=hubFor(pack,rules,version,directory),result=initializeDefaultInteractions(hub,pack.id);
 assert.ok(result.removed>0);assert.equal(rules.length,12);assert.equal(hub.state.game.interactionCatalogVersions[pack.id],pack.interactionCatalogVersion);
 for(const column of ['help','trap']){const rows=rules.filter(r=>r.gameInteraction.marketColumn===column);assert.equal(rows.length,6);assert.deepEqual(rows.map(r=>r.conditions[0].giftId).sort(),GIFTS[column].map(g=>g[1]).sort());}
 const backups=fs.readdirSync(directory,{recursive:true}).filter(f=>String(f).endsWith('.json'));assert.equal(backups.length,1);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory,backups[0]),'utf8')).rules,before);
 const after=structuredClone(rules);initializeDefaultInteractions(hub,pack.id);assert.deepEqual(rules,after);
});

test('le nettoyage TCG conserve les règles personnelles, les événements gratuits et les actions multiples',()=>{
 const pack=packs.find(p=>p.id==='tcg-card-shop-simulator'),rules=rulesFor(pack);
 const custom=structuredClone(rules[0]);custom.id='custom-kept';custom.gameInteraction.default=false;custom.gameInteraction.presetId='manual-personal';custom.conditions=[{field:'data.giftName',operator:'equals',value:'Mon cadeau'}];
 const linked=structuredClone(custom);linked.id='linked-kept';linked.gameInteraction.default=true;linked.actions.push({id:'linked-action',type:'game.effect',config:{packId:'balatro',effectId:'balatro-effect'}});
 const follow=structuredClone(custom);follow.id='follow-kept';follow.gameInteraction.default=true;follow.trigger.type='follow';follow.conditions=[];
 const kept=[custom,linked,follow];rules.push(...structuredClone(kept));const hub=hubFor(pack,rules,2026102603);initializeDefaultInteractions(hub,pack.id);
 for(const rule of kept)assert.deepEqual(rules.find(r=>r.id===rule.id),rule,rule.id);
 assert.equal(rules.filter(r=>String(r.gameInteraction?.presetId).startsWith('starter-')).length,12);
});
