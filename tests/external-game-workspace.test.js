"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module');
const policy=require('../src/shared/game-workspace-policy');
const {defaultGameInteractionRule}=require('../src/main/game-hub/interaction-defaults');
const {createGamePackOverlay,createGamePackOverlays,gamePackOverlayTrigger}=require('../src/shared/game-pack-overlay');
const packs=require('../src/main/game-catalog').loadShenazenGameCatalog(path.resolve('resources'));
const own=['thiercelieux','coin-pusher','connect-four','clash-of-live','color-strike','tiklive-climb','tiklive-cube-wars','tiklive-stack-tower','deal-or-no-deal','diamond-bridge','diamond-drop'];
const bootstrap=fs.readFileSync("src/renderer/app/core/bootstrap.js","utf8");
const automatedInstallers=vm.runInNewContext(bootstrap.slice(bootstrap.indexOf("const AUTOMATED_GAME_INSTALLERS ="),bootstrap.indexOf("const MANAGED_BIZHAWK_GAME_IDS ="))+"\nArray.from(AUTOMATED_GAME_INSTALLERS);");
function fixture(){
 const file=path.resolve(__dirname,'supermarket-workspace.test.js'),source=fs.readFileSync(file,'utf8'),m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source.slice(0,source.indexOf("test('Supermarket"))+'\nmodule.exports={fixture};',file);
 const f=m.exports.fixture(),ctx=f.ctx;
 Object.assign(ctx,{selectedGameId:'',ShenPulseGameWorkspacePolicy:policy,gamePlatformIds:()=>['steam'],AUTOMATED_GAME_INSTALLERS:new Set(automatedInstallers),MANAGED_BIZHAWK_GAME_IDS:new Set(['pokemon-red-blue','super-mario-kart']),MINECRAFT_MODE_IDS:["minecraft-lavarise",'minecraft-bedrock-box','minecraft-sandbox-3','minecraft-survival-plugin'],GAME_OVERLAY_GENERATOR_ONLY_IDS:new Set(['supermarket-simulator','tcg-card-shop-simulator','hogwarts-legacy','shift-at-midnight']),
 overlayConfig:()=>({}),renderGameInstallation:p=>'<div data-native-setup="'+p.id+'"></div>',renderGameLaunch:p=>'<div data-native-server="'+p.id+'"></div>',gameOverlayItemsFor:()=>[{key:'winCounter'},{key:'timer'}],renderOverlayCard:(item,options)=>'<div data-native-overlay="'+item.key+'" data-options="'+String(options.allowed)+'"></div>'});
 ctx.snapshot.packs=structuredClone(packs);ctx.snapshot.overlayUrls={gamePack:'https://example.test/game-pack.html?channel=public'};ctx.snapshot.localOverlayUrls={gamePack:'http://127.0.0.1/overlay/game-pack.html?token=local'};
 vm.runInContext(fs.readFileSync('src/renderer/app/features/games/external-workspace.js','utf8'),ctx);
 return f;
}
function rulesFor(pack){return (pack.defaultMappings||[]).map(mapping=>defaultGameInteractionRule(pack,pack.effects.find(e=>e.id===mapping.effectId),mapping,pack.interactionCatalogVersion));}
test('les 52 jeux externes partagent la page complète ; les 11 jeux ShenPulse sont exclus',t=>{
 const f=fixture();t.after(()=>f.dom.window.close());const before=JSON.stringify(packs),external=packs.filter(p=>policy.eligible(p));assert.equal(external.length,52);
 for(const id of own)assert.equal(policy.eligible(packs.find(p=>p.id===id)),false,id);
 assert.equal(policy.eligible(external[0],['steam','shenpulse']),false);
 for(const pack of external){
  f.ctx.selectedGameId=pack.id;f.ctx.snapshot.state.game.interactionRulesByPack[pack.id]=rulesFor(pack);
  const html=f.ctx.renderSupermarketWorkspace(pack);f.ctx.content.innerHTML=html;const page=f.ctx.content;
  assert.equal(page.querySelector('.game-pack-workspace').dataset.gamePack,pack.id);assert.equal(page.querySelectorAll('.game-pack-phone').length,1,pack.id);assert.equal(page.querySelectorAll('.game-pack-column').length,3,pack.id);assert.equal(page.querySelectorAll('[data-game-reorder-list]').length,3,pack.id);assert.equal(page.querySelectorAll('[data-game-drag-handle]').length,page.querySelectorAll('.game-pack-action-card').length,pack.id);
  assert.ok(page.querySelector('[data-game-tour-start]'),pack.id);assert.ok(page.querySelector('#market-guide'),pack.id);assert.ok(page.querySelector('#market-follow'),pack.id);assert.equal(page.querySelector('#market-catalog').open,false,pack.id);assert.equal(page.querySelectorAll('.game-pack-catalog-grid article').length,0);
  assert.equal(new URL(page.querySelector('iframe').src).searchParams.get('jeu'),pack.id);assert.equal(page.querySelector('[data-action="launch-game"],[data-action="start-game-session"]').dataset.id,pack.id);
  assert.equal(page.querySelectorAll('[data-action="market-overlay-model"]').length,3);assert.ok(page.querySelector('[data-action="market-studio-open"]'));
  if(!pack.effects.some(e=>e.available!==false))assert.equal(page.querySelector('[data-action="install-game"]').disabled,true,pack.id);
  if(['input','emulator'].includes(pack.guide.mode)&&!policy.hasRoundTimer(pack))assert.equal(page.querySelector('[data-native-setup]').dataset.nativeSetup,pack.id);
  if(policy.hasRoundTimer(pack)){assert.equal(page.querySelector('#market-setup'),null);assert.ok(page.querySelector('#market-round [data-minecraft-round-settings]'));}
  const setup=page.querySelector('#market-setup');if(setup)assert.equal(setup.tagName,'DETAILS');
  if(pack.id!=='supermarket-simulator')assert.ok(!page.textContent.includes('votre magasin'),pack.id);
 }
 assert.equal(JSON.stringify(packs),before,'La présentation ne modifie aucun catalogue métier.');
});
test('les écritures et modèles restent sur le bon jeu, même lors de changements rapides',async t=>{
 const f=fixture();t.after(()=>f.dom.window.close());const pack=packs.find(p=>p.id==='tcg-card-shop-simulator');f.ctx.selectedGameId=pack.id;f.ctx.snapshot.state.game.interactionRulesByPack[pack.id]=rulesFor(pack);
 f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);const input=f.ctx.content.querySelector('[data-market-inline="title"]');input.value='Mon client';await f.ctx.saveSupermarketInline(input);assert.equal(f.saved.at(-1).actions[0].config.packId,pack.id);
 input.value='Autre titre';const pending=f.ctx.saveSupermarketInline(input);f.ctx.selectedGameId='hogwarts-legacy';await assert.rejects(pending,/profil a changé/);assert.equal(f.saved.length,1);
 const original=f.ctx.snapshot.state.game.interactionRulesByPack[pack.id].find(rule=>rule.id===f.saved[0].id);assert.equal(original.gameInteraction.title,'Mon client');
});
test('overlay multi-jeux : état, images, titres, modèles et réactions isolés sans données privées',()=>{
 const state={session:{profileId:'profile'},commerce:{subscription:{tier:'pro',status:'active',source:'paid'}},settings:{overlayConfigs:{gameInteractionOverlays:{balatro:{model:3,motion:'fixed',backgroundColor:'#112233'}}}},game:{interactionRulesByPack:{}}};
 for(const id of ['supermarket-simulator','balatro','hogwarts-legacy','minecraft-bedrock-box','thiercelieux'])state.game.interactionRulesByPack[id]=rulesFor(packs.find(p=>p.id===id));
 for(const rules of Object.values(state.game.interactionRulesByPack))for(const rule of rules){rule.trigger.enabled=true;rule.trigger.type='gift';}
 const all=createGamePackOverlays(state);assert.equal(all.packId,'supermarket-simulator');assert.ok(all.packs.balatro.cards.length>0);assert.equal(all.packs.thiercelieux,undefined);assert.equal(all.packs.balatro.presentation.model,3);
 for(const [id,overlay]of Object.entries(all.packs)){assert.equal(overlay.packId,id);const pack=policy.artworkPack(packs.find(p=>p.id===id));for(const card of overlay.cards){assert.ok(card.effectImageUrl);assert.ok(card.title.split(/\s+/).length<=2,card.title);}const rule=state.game.interactionRulesByPack[id][0],action=rule.actions[0];assert.equal(gamePackOverlayTrigger({ok:true,rule,action,event:{user:{displayName:'Viewer'}},profileId:'profile'}).packId,id);assert.equal(new Set(pack.effects.map(e=>e.image)).size,pack.effects.length);}
 assert.ok(!JSON.stringify(all).includes('inputSequence'));assert.equal(createGamePackOverlay(state,'missing-game').enabled,false);
});
test('titres compacts et dessins uniques conservent les noms personnalisés et échappent le contenu',()=>{
 const titles=require('../src/shared/game-interaction-titles');assert.equal(titles.title({gameInteraction:{title:'Mon titre personnel très long'}},{name:'Nom par défaut'},{compact:true}),'Mon titre personnel très long');
 const pack={id:'test',name:'Jeu <script>',effects:[{id:'one',name:'<script>alert(1)</script>',image:'cover.jpg'},{id:'two',name:'Second effet',image:'cover.jpg'}]};const result=policy.artworkPack(pack);assert.notEqual(result.effects[0].image,result.effects[1].image);assert.ok(decodeURIComponent(result.effects[0].image).includes('&lt;script&gt;'));assert.equal(pack.effects[0].image,'cover.jpg');
});

test('le vrai IPC de présentation isole chaque jeu et refuse un ancien compte/profil',t=>{
 const os=require('node:os'),{StateStore}=require('../src/main/store'),{registerGamePackPresentationIpc}=require('../src/main/ipc/game-pack-presentation');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'shenpulse-game-models-')),store=new StateStore(directory,{isEncryptionAvailable:()=>false});
 t.after(()=>{for(const key of ['writeTimer','runtimeWriteTimer','persistenceRetryTimer'])clearTimeout(store[key]);assert.equal(path.dirname(directory),os.tmpdir());assert.ok(path.basename(directory).startsWith('shenpulse-game-models-'));fs.rmSync(directory,{recursive:true,force:true});});
 store.activateAccount('owner');store.set('settings.account',{uid:'owner',email:'owner@example.test',refreshTokenSecretId:store.setSecret('','test-refresh')});store.state.commerce.subscription={tier:'pro',status:'active',source:'paid'};
 const handlers=new Map(),access=[];registerGamePackPresentationIpc({handle:(name,fn)=>handlers.set(name,fn),store,core:{snapshot:()=>({state:store.getState()}),notifyRenderer(){}},requireGameAccess:id=>{access.push(id);assert.ok(['balatro','hogwarts-legacy'].includes(id));}});
 const save=(packId,patch={})=>handlers.get('overlay:game-pack-presentation')(null,{packId,accountUid:'owner',profileId:store.state.session.profileId,...patch});
 const before=JSON.stringify(store.state.game);save('balatro',{model:3,motion:'fixed'});save('hogwarts-legacy',{model:2,backgroundColor:'#123abc'});
 assert.equal(store.state.settings.overlayConfigs.gameInteractionOverlays.balatro.model,3);assert.equal(store.state.settings.overlayConfigs.gameInteractionOverlays['hogwarts-legacy'].model,2);assert.equal(JSON.stringify(store.state.game),before);
 assert.throws(()=>save('balatro',{profileId:'other',model:1}),/profil a changé/);assert.equal(store.state.settings.overlayConfigs.gameInteractionOverlays.balatro.model,3);assert.ok(access.includes('hogwarts-legacy'));
});
test('installation studio : identité, capture et URL suivent le jeu et le profil choisis',async()=>{
 const {StudioInstallationService}=require('../src/main/studio-installation/service'),plans=[],checks=[],state={session:{profileId:'profile'},settings:{account:{uid:'owner'}},profiles:[{id:'profile',name:'Mon profil'}],game:{installations:{}}};
 const service=new StudioInstallationService({store:{getState:()=>state},core:{snapshot:()=>({state,packs,overlayUrls:{gamePack:'https://overlay.test/game-pack.html?channel=public'}})},requireGameAccess:id=>{checks.push(id);assert.ok(packs.some(p=>p.id===id));},discoverImpl:async()=>[{id:'obs',name:'OBS',installed:true,process:'obs64.exe',executable:'obs64.exe'}],runningImpl:async()=>false,launchImpl:async()=>{},adapters:{obsOffline:async(_target,plan)=>{plan.assertScope();plans.push(plan);return {sceneName:plan.sceneName,sources:[]};}}});
 for(const packId of ['hogwarts-legacy','balatro','minecraft-bedrock-box','super-mario-kart']){const result=await service.install({packId,studioId:'obs',profileId:'profile',accountUid:'owner'});assert.equal(result.status,'installed');const plan=plans.at(-1);assert.equal(plan.packId,packId);assert.equal(new URL(plan.overlayUrl).searchParams.get('jeu'),packId);assert.equal(new URL(plan.overlayUrl).searchParams.get('profile'),'profile');assert.ok(plan.sceneName.includes(packs.find(p=>p.id===packId).name));assert.ok(!plan.executable.includes('Supermarket'));}
 assert.equal(new Set(plans.map(p=>p.identity)).size,4);assert.equal(plans[2].executable,'javaw.exe');assert.equal(plans[3].executable,'EmuHawk.exe');assert.throws(()=>service.scope({packId:'balatro',profileId:'other',accountUid:'owner'}),/profil a changé/);
});
test('les paramètres texte et actions liées à un autre jeu restent modifiables sans perte',async t=>{
 const f=fixture();t.after(()=>f.dom.window.close());const pack=packs.find(p=>p.id==='find-the-needle-demo');f.ctx.selectedGameId=pack.id;
 const effect=pack.effects.find(e=>e.parameters?.some(p=>p.type==='text'));assert.ok(effect);const rule=defaultGameInteractionRule(pack,effect,{id:'text',triggerType:'follow'},1);f.ctx.snapshot.state.game.interactionRulesByPack[pack.id]=[rule];
 f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);const input=f.ctx.content.querySelector('[data-market-inline="parameter"]');assert.equal(input.type,'text');input.value='random';await f.ctx.saveSupermarketInline(input);assert.equal(f.saved.at(-1).actions[0].config.parameters.effect,'random');
 const foreign={id:'keep-other-game',type:'game.effect',config:{packId:'balatro',effectId:'another-effect',parameters:{value:3}}};rule.actions.push(foreign);f.ctx.snapshot.state.game.interactionRulesByPack[pack.id]=[rule];
 f.ctx.openSupermarketExtraActions({ruleId:rule.id,actionId:rule.actions[0].id,index:0});await f.editor().onSubmit(new f.dom.window.FormData());assert.deepEqual(f.saved.at(-1).actions.find(a=>a.id===foreign.id),foreign);
});

test('les quatre jeux natifs se téléchargent depuis leur fiche avec les droits réels et la liste du bootstrap',t=>{
 const f=fixture();t.after(()=>f.dom.window.close());
 f.ctx.ShenPulseProAccess=require('../src/shared/pro-access');
 const access=fs.readFileSync('src/renderer/app/features/games/access.js','utf8');
 vm.runInContext(access.slice(0,access.indexOf('function gameArtwork(pack)')),f.ctx);
 const ids=['shenfarm','shenpaint','shenkite','splash-bombes'],state=f.ctx.snapshot.state;
 state.commerce={subscription:{tier:'pro',status:'active',source:'trial',expiresAtMs:Date.now()+60000},gameEntitlements:ids.map(id=>({productId:id,source:'trial',status:'trial',expiresAtMs:Date.now()+60000}))};
 for(const id of ids){
  const pack=packs.find(p=>p.id===id);f.ctx.selectedGameId=id;state.game.interactionRulesByPack[id]=rulesFor(pack);delete state.game.installations[id];
  f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);
  assert.equal(f.ctx.content.querySelector('[data-action="install-game"]').disabled,false,id+' : installation activée');
  assert.equal(f.ctx.content.querySelector('[data-action="launch-game"]').disabled,true,id+' : lancement attend installation');
  state.game.installations[id]={path:'C:/ShenPulse/games/'+id,installerVersion:pack.installerVersion};
  f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);
  assert.equal(f.ctx.content.querySelector('[data-action="launch-game"]').disabled,false,id+' : lancement prêt après installation');
  const before=state.commerce.gameEntitlements;state.commerce.gameEntitlements=[];
  f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);
  assert.equal(f.ctx.content.querySelector('[data-action="install-game"]').disabled,true,id+' : droit produit toujours nécessaire');
  state.commerce.gameEntitlements=before;
 }
 state.commerce.subscription.expiresAtMs=Date.now()-1;
 f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(packs.find(p=>p.id==='shenpaint'));
 assert.equal(f.ctx.content.querySelector('[data-action="install-game"]').disabled,true,'Un essai Pro expiré ne donne pas accès');
});

test('les neuf fiches demandées cachent la section overlays en conservant les autres sections et leurs règles',t=>{
 const f=fixture();t.after(()=>f.dom.window.close());
 const ids=['demonologist','escape-from-duckov','euro-truck-simulator-2','find-the-needle-demo','fortnite','pokemon-red-blue','resident-evil-3','rocket-league','super-mario-kart'];
 for(const id of ids){
  const pack=packs.find(p=>p.id===id);assert.ok(pack,id);f.ctx.selectedGameId=id;
  f.ctx.snapshot.state.game.interactionRulesByPack[id]=rulesFor(pack);
  const before=JSON.stringify(f.ctx.snapshot.state.game);
  f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);
  assert.equal(f.ctx.content.querySelector('#market-overlays'),null,id);
  assert.ok(f.ctx.content.querySelector('#market-interactions'),id);
  assert.ok(f.ctx.content.querySelector('.game-pack-live-preview')||f.ctx.content.querySelector('.game-pack-phone'),id+' : aperçu cadeaux conservé');
  assert.equal(JSON.stringify(f.ctx.snapshot.state.game),before,id+' : règles intactes');
 }
 const gta=packs.find(p=>p.id==='gtav-montchiliad');f.ctx.selectedGameId=gta.id;
 f.ctx.snapshot.state.game.interactionRulesByPack[gta.id]=rulesFor(gta);f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(gta);
 assert.ok(f.ctx.content.querySelector('#market-overlays'),'GTA garde ses overlays de wins');
});

test('Minecraft mode covers are distinct full posters and Survival has no historical server block',t=>{const f=fixture();t.after(()=>f.dom.window.close());const ids=['minecraft-bedrock-box','minecraft-sandbox-3','minecraft-survival-plugin'],covers=new Set();for(const id of ids){const pack=packs.find(p=>p.id===id);assert.ok(pack.coverArtwork.endsWith('.png'));assert.ok(fs.statSync(path.join('src/renderer/assets/games',pack.coverArtwork)).size>10000);covers.add(pack.coverArtwork);f.ctx.selectedGameId=id;f.ctx.snapshot.state.game.interactionRulesByPack[id]=rulesFor(pack);f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);assert.equal(f.ctx.content.querySelector('#market-setup'),null);}assert.equal(covers.size,3);});

test('Palworld propose installation automatique et lancement apres installation',t=>{
 const f=fixture();t.after(()=>f.dom.window.close());
 const pack=packs.find(p=>p.id==='palworld');f.ctx.selectedGameId=pack.id;
 f.ctx.snapshot.state.game.interactionRulesByPack[pack.id]=rulesFor(pack);
 delete f.ctx.snapshot.state.game.installations[pack.id];
 f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);
 assert.equal(f.ctx.content.querySelector('[data-action="install-game"]').disabled,false);
 assert.equal(f.ctx.content.querySelector('[data-action="launch-game"]').disabled,true);
 f.ctx.snapshot.state.game.installations[pack.id]={path:'C:/XboxGames/Palworld/Content',platform:'xbox',installerVersion:pack.installerVersion};
 f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);
 assert.equal(f.ctx.content.querySelector('[data-action="launch-game"]').disabled,false);
});


test('Minecraft garde son nom de mode sur une ligne et annonce la version exacte du serveur', t => {
 const f=fixture();t.after(()=>f.dom.window.close());
 const ids=['minecraft-bedrock-box','minecraft-lavarise','minecraft-sandbox-3','minecraft-survival-plugin'];
 for(const id of ids){
  const pack=packs.find(p=>p.id===id),manifest=require('../src/main/game-installers/'+id);
  assert.ok(manifest.minecraftServer.serverJar.startsWith('paper-'+pack.minecraftVersion+'-'),id);
  assert.deepEqual(Array.from(f.ctx.externalTitleLines(pack.name)),['MINECRAFT',pack.name.replace(/^Minecraft\s+/i,'').toUpperCase()]);
 }
 const access=fs.readFileSync('src/renderer/app/features/games/access.js','utf8');
 vm.runInContext(access.slice(access.indexOf('function openMinecraftModeSelector('),access.indexOf('// Page data is already available')),f.ctx);
 f.ctx.GTA_LAUNCHER_ID='gta-modes';
 f.ctx.openMinecraftModeSelector({id:'minecraft',modes:packs.filter(p=>ids.includes(p.id))});
 const badges=[...f.ctx.dialogBody.querySelectorAll('.minecraft-mode-version')];
 assert.equal(badges.length,4);assert.equal(badges.filter(b=>b.textContent==='Minecraft Java 1.21').length,3);
 assert.ok(badges.some(b=>b.textContent==='Minecraft Java 26.1.2'));
 for(const badge of badges)assert.ok(badge.closest('.minecraft-mode-art').querySelector('img'));
 f.ctx.openMinecraftModeSelector({id:'gta-modes',modes:[packs.find(p=>p.id==='gtav-koth-enhanced')]});
 assert.equal(f.ctx.dialogBody.querySelector('.minecraft-mode-version'),null);
});
