"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module');
const {JSDOM}=require('jsdom'),{GameMuteService}=require('../src/main/game-mute-service'),{loadShenazenGameCatalog}=require('../src/main/game-catalog'),{defaultGameInteractionRule}=require('../src/main/game-hub/interaction-defaults'),{GiftCatalog}=require('../src/main/catalogs'),{createGamePackOverlay}=require('../src/shared/game-pack-overlay');
const packs=loadShenazenGameCatalog(path.resolve('resources')),pack=packs.find(p=>p.id==='gtav-montchiliad'),gifts=new GiftCatalog(path.resolve('resources'));
function rulesFor(){const rules=pack.defaultMappings.map(m=>defaultGameInteractionRule(pack,pack.effects.find(e=>e.id===m.effectId),m,pack.interactionCatalogVersion,gifts));for(const [operation,name,cost]of [['mute','Legend Rider',12999],['unmute','LIVE on holiday',5000],['invert','Leon the Kitten',4888]]){const rule=rules.find(r=>r.actions[0].config.operation===operation),gift=gifts.gifts.find(g=>g.name===name&&g.cost===cost)||gifts.gifts.find(g=>g.cost===cost);assert.ok(gift,name);rule.enabled=true;rule.trigger.enabled=true;rule.conditions=[{field:'data.giftName',operator:'equals',value:gift.name,giftId:gift.id,giftImageUrl:gift.imageUrl,giftCost:gift.cost}];}return rules;}
function fixture(){const file=path.resolve('tests/external-game-workspace.test.js'),source=fs.readFileSync(file,'utf8'),m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source.slice(0,source.indexOf("test('les 52"))+'\nmodule.exports={fixture};',file);const f=m.exports.fixture();f.ctx.selectedGameId=pack.id;f.ctx.snapshot.state.settings.account={uid:'owner'};f.ctx.snapshot.state.settings.overlayConfigs={gameWinsFeatures:{[pack.id]:{superFanEnabled:true,superFanAmount:500}}};f.ctx.snapshot.state.game.interactionRulesByPack[pack.id]=rulesFor();return f;}
test('les trois jeux avec wins proposent Mute et Démute, désactivés tant qu’aucun cadeau n’a été choisi',()=>{
 for(const p of packs){const effects=p.effects.filter(e=>['mute','unmute'].includes(e.winCounter?.operation));assert.equal(effects.length,p.effects.some(e=>e.winCounter)?2:0,p.id);for(const effect of effects){assert.equal(effect.duration,60);const mapping=p.defaultMappings.find(m=>m.effectId===effect.id);assert.equal(mapping.enabled,false);assert.equal(mapping.triggerEnabled,false);}}
});
test('bloc complet : Reset, Inversion, Mute, Démute, Super Fan et retrait du dernier palier',t=>{
 const f=fixture();t.after(()=>f.dom.window.close());f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);const doc=f.ctx.content;
 assert.equal(doc.querySelectorAll('#market-wins .game-pack-win-special').length,5);
 for(const field of ['muteColor','muteFont','superFanEnabled','superFanAmount'])assert.ok(doc.querySelector('[data-game-win-feature="'+field+'"]'),field);
 assert.ok(doc.querySelector('[data-action="game-win-install-mute"]'));assert.equal(doc.querySelectorAll('[data-market-inline="win-mute-seconds"]').length,2);assert.equal(doc.querySelector('[data-game-win-feature="superFanEnabled"]').checked,true);
 assert.equal(doc.querySelectorAll('[data-action="game-win-superfan"]').length,2);assert.ok([...doc.querySelectorAll('[data-action="game-win-remove"]')].some(b=>b.textContent.includes('dernier palier')));
 assert.equal(doc.querySelectorAll('.game-pack-column [data-market-inline="win-mute-seconds"]').length,0);
});
test('options : validation stricte, profil/compte et autres jeux conservés',()=>{
 const handlers=new Map(),state={session:{profileId:'p'},settings:{account:{uid:'owner'},overlayConfigs:{gameWinsFeatures:{other:{superFanAmount:9}}}},game:{interactionRulesByPack:{[pack.id]:rulesFor()}}},store={getState:()=>state,mutate:fn=>fn(state)},core={snapshot:()=>({state}),notifyRenderer(){}};
 require('../src/main/ipc/game-wins').registerGameWinsIpc({handle:(n,fn)=>handlers.set(n,fn),store,core,requireGameAccess:()=>pack});
 const save=(patch,scope={})=>handlers.get('game:wins:level')(null,pack.id,{accountUid:'owner',profileId:'p',operation:'options',patch,...scope}),before=structuredClone(state.game);
 save({superFanEnabled:true,superFanAmount:500,muteColor:'#ff22aa',muteFont:'Orbitron'});assert.deepEqual(state.game,before);assert.equal(state.settings.overlayConfigs.gameWinsFeatures.other.superFanAmount,9);
 for(const patch of [{superFanAmount:0},{superFanAmount:Infinity},{superFanEnabled:'true'},{muteColor:'red'},{muteFont:'url(evil)'},{unknown:1}])assert.throws(()=>save(patch));assert.throws(()=>save({superFanAmount:7},{profileId:'other'}),/profil/);
});
test('les contrôleurs sauvegardent le style et les durées, Super Fan passe par le vrai compteur et l’installation cible son HUD',async t=>{
 const f=fixture();t.after(()=>f.dom.window.close());const calls=[];f.ctx.api.saveGameWinsLevel=async(id,patch)=>{calls.push({id,patch});return f.ctx.snapshot;};f.ctx.openStudioInstallation=async options=>calls.push({studio:options});vm.runInContext(fs.readFileSync('src/renderer/app/features/games/wins-controls.js','utf8'),f.ctx);f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);
 const color=f.ctx.content.querySelector('[data-game-win-feature="muteColor"]');color.value='#aa22dd';color.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));await vm.runInContext('marketWriteQueue',f.ctx);assert.equal(calls.at(-1).patch.patch.muteColor,'#aa22dd');
 const duration=f.ctx.content.querySelector('[data-market-inline="win-mute-seconds"]');duration.value='90';await f.ctx.saveSupermarketInline(duration);assert.equal(f.saved.at(-1).actions[0].config.duration,90);
 await f.handlers.get('game-win-superfan')({action:'game-win-superfan',target:{dataset:{sign:'-1'}}});assert.equal(f.previews.at(-1).config.amount,-500);assert.equal(f.previews.at(-1).config.packId,pack.id);
 await f.handlers.get('game-win-install-mute')({action:'game-win-install-mute'});assert.equal(calls.at(-1).studio.overlayOnly,true);
});
function muteFixture(){let now=100000,tick;const state={settings:{account:{uid:'owner'}},session:{profileId:'p'},overlaySession:{}},commands=[];let serverEnd=0;const bridge={onIdle(){},async command(type,seconds){commands.push({type,seconds});serverEnd=type==='MUTE'?now+seconds*1000:type==='REDUCE'?Math.max(0,serverEnd-seconds*1000):0;return {endsAt:serverEnd};},async close(){commands.push({type:'CLOSE'});}},service=new GameMuteService({store:{getState:()=>state,mutateRuntime:fn=>fn(state)},bridge,now:()=>now,setIntervalImpl:fn=>{tick=fn;return {unref(){}};},clearIntervalImpl(){tick=null;}});
 return {service,state,bridge,commands,advance(ms){now+=ms;tick?.();}};
}
test('mute : cadeaux sérialisés, durées additionnées et plafonnées ; Démute retire seulement du temps appartenant à ShenPulse',async()=>{
 const f=muteFixture();await f.service.run({packId:pack.id,operation:'unmute',duration:60});assert.equal(f.commands.length,0);
 await Promise.all([f.service.run({packId:pack.id,operation:'mute',duration:60}),f.service.run({packId:pack.id,operation:'mute',duration:60})]);assert.equal(f.commands.at(-1).seconds,120);
 await f.service.run({packId:pack.id,operation:'unmute',duration:60});assert.equal(f.commands.at(-1).seconds,60);
 await f.service.run({packId:pack.id,operation:'mute',duration:10000});assert.equal(f.commands.at(-1).seconds,3600);
 await f.service.run({packId:pack.id,operation:'unmute',duration:3600});assert.equal(f.commands.at(-1).type,'STOP');assert.equal(f.state.overlaySession.gameMute.endsAt,0);await f.service.dispose();
});
test('mute : expiration, arrêt manuel et changement de profil nettoient le runtime sans écraser le nouveau profil',async()=>{
 const f=muteFixture();await f.service.run({packId:pack.id,operation:'mute',duration:2});f.advance(2200);assert.equal(f.state.overlaySession.gameMute.endsAt,0);
 await f.service.run({packId:pack.id,operation:'mute',duration:60});f.state.session.profileId='other';f.state.overlaySession={gameMute:{packId:'other',endsAt:9}};f.advance(1);await new Promise(r=>setImmediate(r));assert.equal(f.commands.at(-1).type,'STOP');assert.equal(f.state.overlaySession.gameMute.endsAt,9);await f.service.dispose();
});
test('un échec du micro ne démarre pas un faux compteur et ActionRunner conserve la vérification d’accès au jeu',async()=>{
 const f=muteFixture();f.bridge.command=async()=>{throw Error('Micro absent');};await assert.rejects(f.service.run({packId:pack.id,operation:'mute',duration:60}),/Micro absent/);assert.equal(f.state.overlaySession.gameMute,undefined);
 const {ActionRunner}=require('../src/main/action-runner'),calls=[],runner=new ActionRunner({gameHub:{assertAccess:id=>calls.push(id)},gameMuteService:{run:async config=>({ok:true,endsAt:config.duration})}});assert.equal((await runner.run({type:'overlay.win-counter',config:{operation:'mute',packId:pack.id,duration:5}})).endsAt,5);assert.deepEqual(calls,[pack.id]);
});
test('le HUD affiche tous les badges aux bons groupes et le timer uniquement quand le micro est coupé',t=>{
 const state={session:{profileId:'p'},settings:{overlayConfigs:{gameWinsFeatures:{[pack.id]:{superFanEnabled:true,superFanAmount:500,muteFont:'Orbitron',muteColor:'#ff22aa'}}}},game:{interactionRulesByPack:{[pack.id]:rulesFor()}},overlaySession:{gameMute:{packId:pack.id,endsAt:Date.now()+60000}},commerce:{subscription:{tier:'pro',status:'active',source:'paid'}}},projection=createGamePackOverlay(state,pack.id);
 assert.ok(projection.wins.mute);assert.ok(projection.wins.unmute);assert.ok(projection.wins.invert);assert.equal(projection.wins.superFan.amount,500);
 const dom=new JSDOM(fs.readFileSync('resources/overlays/game-wins.html','utf8'),{runScripts:'outside-only',url:'https://overlay.test/game-wins.html?jeu='+pack.id+'&profile=p'});t.after(()=>dom.window.close());dom.window.eval(fs.readFileSync('resources/overlays/runtime/game-wins.js','utf8'));dom.window.ShenPulseGameWins.render(projection);const doc=dom.window.document;
 assert.deepEqual([...doc.querySelectorAll('.hud-special-bar .hud-special')].map(n=>n.textContent),['MUTE 1 MIN','RESET WINS','DÉMUTE 1 MIN']);assert.match(doc.querySelector('.hud-superfan').textContent,/\+500 OU −500/);assert.ok(doc.querySelector('.negative .hud-invert'));assert.equal(doc.querySelector('.hud-mute-timer').hidden,false);
 projection.wins.muteTimer.endsAt=0;dom.window.ShenPulseGameWins.render(projection);assert.equal(doc.querySelector('.hud-mute-timer').hidden,true);
 projection.wins.mute=null;projection.wins.superFan.enabled=false;dom.window.ShenPulseGameWins.render(projection);assert.equal(doc.querySelector('.hud-mute'),null);assert.equal(doc.querySelector('.hud-superfan'),null);
 dom.window.ShenPulseGameWins.render({...projection,profileId:'other'});assert.equal(doc.querySelector('#wins-hud').childElementCount,0);
});
test('installer le compteur réutilise le HUD et préserve intégralement caméra, jeu et cadeaux',()=>{
 const {prepareTikTok}=require('../src/main/studio-installation/tiktok'),{prepareCollection}=require('../src/main/studio-installation/obs'),plan={identity:'owner:p:gta',packId:pack.id,profileId:'p',gameName:'GTA',sceneName:'GTA',executable:'GTA5.exe',overlayUrl:'https://test/game-pack.html?jeu='+pack.id+'&profile=p',winsOverlayUrl:'https://test/game-wins.html?jeu='+pack.id+'&profile=p',assertScope(){}};
 const original={SourceService:{state:{scenes:[],sceneSource:{},layerMap:{}}}},first=prepareTikTok(original,plan),scene=first.document.SourceService.state.sceneSource[first.sceneId],before=Object.values(scene.data).filter(s=>s.type!=='browser'||s.payload.url!==plan.winsOverlayUrl).map(s=>structuredClone(s)),updated=prepareTikTok(first.document,{...plan,overlayOnly:true}),after=updated.document.SourceService.state.sceneSource[first.sceneId];assert.equal(Object.keys(after.data).length,4);for(const item of before)assert.deepEqual(after.data[item.id],item);
 const obs=prepareCollection(null,plan),beforeSources=obs.document.sources.filter(s=>s.id!=='scene'&&s.settings?.url!==plan.winsOverlayUrl),next=prepareCollection(obs.document,{...plan,overlayOnly:true});assert.equal(next.document.sources.find(s=>s.id==='scene').settings.items.length,4);for(const source of beforeSources)assert.deepEqual(next.document.sources.find(s=>s.uuid===source.uuid),source);
});

test('le bouton Tester du catalogue route aussi Mute et les wins vers ActionRunner sans ouvrir de connexion native',async()=>{
 const handlers=new Map(),calls=[],core={gameHub:{trigger:async()=>{throw Error('Aucune connexion native pour les wins');}},actionRunner:{run:async(action,context)=>{calls.push({action,context});return {ok:true};}}},store={getState:()=>({session:{activeGamePackId:pack.id}})};
 require('../src/main/ipc/games').registerGamesIpc({handle:(n,fn)=>handlers.set(n,fn),core,store,gameRuntime:{},requireGameAccess:id=>{assert.equal(id,pack.id);return pack;}});
 const effect=pack.effects.find(e=>e.winCounter?.operation==='mute');assert.equal((await handlers.get('game:effect')(null,effect.id,{})).ok,true);assert.equal(calls[0].action.config.operation,'mute');assert.equal(calls[0].action.config.duration,60);assert.equal(calls[0].action.config.packId,pack.id);
});
