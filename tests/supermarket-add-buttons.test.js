"use strict";
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), fsp = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const { JSDOM, VirtualConsole, requestInterceptor } = require('jsdom');
const { StateStore } = require('../src/main/store');
const { loadShenazenGameCatalog } = require('../src/main/game-catalog');
const { GiftCatalog } = require('../src/main/catalogs/gifts');
const { defaultGameInteractionRule } = require('../src/main/game-hub/interaction-defaults');
const {registerGamePackPresentationIpc}=require("../src/main/ipc/game-pack-presentation");
const { registerGamesIpc } = require('../src/main/ipc/games');
const { version: appVersion } = require('../package.json');
const root = path.resolve(__dirname, '..'), id = 'supermarket-simulator';
async function waitFor(predicate, message) {
 const end = Date.now() + 7000;
 while (!predicate()) { if(Date.now()>end)throw new Error(message);await new Promise(resolve=>setTimeout(resolve,15)); }
}

test('les vrais boutons Supermarket créent et conservent leurs règles via l’IPC et le stockage disque',async t=>{
 const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'shenpulse-market-buttons-'));
 t.after(async()=>{assert.equal(path.dirname(directory),os.tmpdir());assert.ok(path.basename(directory).startsWith('shenpulse-market-buttons-'));await fsp.rm(directory,{recursive:true,force:true});});
 const pack=loadShenazenGameCatalog(path.join(root,'resources')).find(p=>p.id===id),giftCatalog=new GiftCatalog(path.join(root,'resources'));
 const store=new StateStore(directory,{isEncryptionAvailable:()=>false});
 const account={authenticated:true,uid:'button-fixture',email:'buttons@example.test',displayName:'Test',emailVerified:true};
 store.activateAccount(account.uid);account.refreshTokenSecretId=store.setSecret("","test-buttons-refresh");Object.assign(store.state.settings.account,account);store.state.commerce.subscription={tier:'pro',status:'active',source:'own'};
 store.state.game.interactionRulesByPack[id]=pack.defaultMappings.map(m=>defaultGameInteractionRule(pack,pack.effects.find(e=>e.id===m.effectId),m,pack.interactionCatalogVersion,giftCatalog));
 store.state.game.interactionCatalogVersions[id]=pack.interactionCatalogVersion;store.mutate(()=>{},true);
 const rules=()=>store.state.game.interactionRulesByPack[id],original=structuredClone(rules());
 const subscriptions=new Map(),ipc=new Map(),errors=[],studioCalls=[];
 const snapshot=()=>({appVersion,state:store.getState(),packs:[pack],soundCatalog:[],mediaCatalog:[],catalogCounts:{},timerRuntime:[],overlayUrls:{gamePack:"https://overlay.test/game-pack.html?channel=fixture"},localOverlayUrls:{gamePack:"https://overlay.test/game-pack.html?token=fixture"},publicOverlayRelay:{connected:false},liveDirectory:{available:true,connected:true,enabled:false,rows:[]}});
 const core={snapshot,notifyRenderer:(event,value)=>subscriptions.get(event)?.(value),gameHub:{listPacks:()=>[pack],initializeDefaultInteractions:()=>({added:0,version:pack.interactionCatalogVersion})}};
 registerGamesIpc({handle:(name,fn)=>ipc.set(name,fn),core,store,gameRuntime:{},getWindow:()=>null,dialog:{},requireGameAccess:packId=>assert.equal(packId,id),requireGameSessionAvailability:packId=>packId});
 registerGamePackPresentationIpc({handle:(name,fn)=>ipc.set(name,fn),core,store,requireGameAccess:packId=>assert.equal(packId,id)});
 const html=path.join(root,'src/renderer/index.html'),virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',error=>errors.push(error));
 const dom=new JSDOM(fs.readFileSync(html,'utf8'),{url:pathToFileURL(html).toString(),runScripts:'dangerously',resources:{interceptors:[requestInterceptor(request=>{if(request.url.startsWith('https://overlay.test/game-pack.html'))return new Response('<!doctype html><p>Aperçu chargé</p>',{headers:{'Content-Type':'text/html'}});})]},pretendToBeVisual:true,virtualConsole,beforeParse(window){
  window.structuredClone=structuredClone;
  Object.defineProperty(window,'localStorage',{value:{getItem:()=>null,setItem(){},removeItem(){}}});
  window.shenPulse={saveGamePackPresentation:async options=>ipc.get("overlay:game-pack-presentation")(null,structuredClone(options)),studios:{status:async()=>[{id:"tiktok",name:"TikTok LIVE Studio",installed:true,running:true},{id:"obs",name:"OBS Studio",installed:true,running:false},{id:"streamlabs",name:"Streamlabs Desktop",installed:false,running:false}],install:async options=>{studioCalls.push(options);return studioCalls.length===1?{status:"needs-close",studioName:"TikTok LIVE Studio",message:"Fermez le studio puis réessayez."}:{status:"installed",studioName:"TikTok LIVE Studio",sceneName:"Supermarket Simulator",opening:"manual",openingMessage:"La scène est installée. Vous pouvez maintenant ouvrir TikTok LIVE Studio pour l’utiliser."};}},getSnapshot:async()=>snapshot(),selectGame:async packId=>ipc.get('game:select')(null,packId),initializeGameInteractions:async packId=>ipc.get('game:initialize-interactions')(null,packId),saveGameInteraction:async(packId,rule)=>ipc.get('game:interaction:save')(null,packId,structuredClone(rule)),
   searchGifts:async()=>({gifts:giftCatalog.gifts,total:giftCatalog.gifts.length}),getGameRuntimeStatus:async()=>null,getSpotifyStatus:async()=>({configured:false,connected:false,devices:[]}),controlSpotify:async()=>({settings:{enabled:false},queue:[],history:[]}),
   users:{snapshot:async()=>({rows:[],total:0,filteredTotal:0,stats:{},streamers:[],blockedUsers:[]})},controllers:{status:async()=>({devices:[],mappings:[]})},updates:{check:async()=>({available:false})},account:{status:async()=>account,gameCheatAccess:async()=>({allowed:false}),syncEntitlements:async()=>null},admin:{status:async()=>({authorized:false}),visibility:async()=>store.state.settings.siteVisibility},on:(event,fn)=>{subscriptions.set(event,fn);return()=>{};},
   ...Object.fromEntries(['startSession','startGameSession','launchGame','triggerEffect','testAction','startTikTok','startConnection'].map(name=>[name,async()=>{throw new Error('L’ajout ne doit pas lancer '+name);}]))};
  window.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},drawImage(){},fillRect(){},getImageData:()=>({data:new Uint8ClampedArray(4)}),putImageData(){}});
  window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new window.Event('close'));};
  window.HTMLElement.prototype.scrollIntoView=function(){};
  window.addEventListener('error',event=>errors.push(event.error||new Error(event.message)));window.addEventListener('unhandledrejection',event=>errors.push(event.reason));
 }});
 t.after(()=>dom.window.close());
 const document=dom.window.document;
 await waitFor(()=>document.querySelector('.creator-home-page'),'Le renderer ne démarre pas.');
 dom.window.eval('currentPage="games";');await dom.window.eval('enterGameWorkspace(snapshot.packs[0])');
 assert.ok(document.querySelector('.market-workspace'));
 const click=selector=>{const button=document.querySelector(selector);assert.ok(button,selector);button.click();};
 const launchRow=document.querySelector('.market-launch-actions');assert.ok(launchRow.querySelector('[data-action="market-studio-open"]'));assert.equal(launchRow.querySelector('[data-action="test-game"]'),null);
 assert.ok(launchRow.querySelector('[data-action="market-studio-open"]').compareDocumentPosition(launchRow.querySelector('.market-launch-button'))&dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
 click('[data-action="market-studio-open"]');await waitFor(()=>document.querySelector('#studio-install-dialog .studio-install-choice'),'Le choix du studio ne s’ouvre pas.');assert.equal(document.querySelector('[data-action="market-studio-install"][data-id="streamlabs"]').disabled,true);
 click('[data-action="market-studio-install"][data-id="tiktok"]');await waitFor(()=>document.querySelector('#studio-install-dialog').textContent.includes('Fermez le studio'),'Le besoin de fermeture n’est pas expliqué.');
 click('#studio-install-dialog [data-action="market-studio-install"]');await waitFor(()=>document.querySelector('#studio-install-dialog').textContent.includes('Scène installée'),'L’installation n’est pas confirmée.');assert.match(document.querySelector('#studio-install-dialog .studio-opening-message').textContent,/Vous pouvez maintenant ouvrir TikTok LIVE Studio/);assert.equal(document.querySelector('#studio-install-dialog .error'),null);assert.equal(studioCalls.length,2);assert.equal(studioCalls[0].profileId,store.state.session.profileId);assert.equal(studioCalls[0].studioId,'tiktok');
 click('#studio-install-dialog [data-action="market-studio-close"]');await waitFor(()=>!document.querySelector('#studio-install-dialog').open,'La popup ne se ferme pas.');
 const presentation=()=>store.state.settings.overlayConfigs.gameInteractionOverlays?.[id];
 const previewFrame=document.querySelector(".market-phone-source iframe"),previewWindow=previewFrame.contentWindow;
 for(const model of [2,3,1]){click('[data-action="market-overlay-model"][data-value="'+model+'"]');await waitFor(()=>presentation()?.model===model&&document.querySelector('[data-action="market-overlay-model"][data-value="'+model+'"]').getAttribute('aria-pressed')==='true','Le modèle ne se sauvegarde pas.');assert.equal(!!document.querySelector('.market-preview-mode'),model===1);assert.equal(document.querySelector('.market-phone-source iframe'),previewFrame);assert.equal(previewFrame.contentWindow,previewWindow);if(model===2){click('[data-action="market-overlay-color"][data-value="#312e81"]');await waitFor(()=>presentation()?.backgroundColor==='#312e81','La couleur ne se sauvegarde pas.');assert.equal(document.querySelector('.market-phone-source iframe'),previewFrame);}}
 click('[data-action="market-preview-mode"][data-value="static"]');await waitFor(()=>presentation()?.motion==='fixed','Le mode fixe ne se sauvegarde pas.');click('[data-action="market-preview-mode"][data-value="animated"]');await waitFor(()=>presentation()?.motion==='animated','Le mode animé ne se sauvegarde pas.');assert.equal(document.querySelector('.game-interaction-overlay-card'),null);
 async function addGift(selector,column,effectId){
  const count=rules().length;
  click(selector);await waitFor(()=>document.querySelector('.market-add-menu'),'Le menu Ajouter ne s’ouvre pas.');
  await new Promise(resolve=>setTimeout(resolve,25));assert.ok(document.querySelector('.market-add-menu'),'Le menu ne doit pas se refermer tout seul.');
  click('.market-add-menu [data-type="gift"]');await waitFor(()=>document.querySelector('#editor-dialog[open] [data-market-gift-choice="5655"]'),'Les cadeaux ne s’affichent pas.');
  click('[data-market-gift-choice="5655"]');await waitFor(()=>rules().length===count+1&&!document.querySelector('#editor-dialog[open]'),'Le cadeau choisi ne crée pas sa carte.').catch(error=>{throw new Error(error.message+' '+document.querySelector('#toast-region')?.textContent+' '+errors.map(e=>e.message).join(' | '));});
  const rule=rules().at(-1);assert.equal(rule.gameInteraction.marketColumn,column);assert.equal(rule.conditions[0].giftId,'5655');if(effectId)assert.equal(rule.actions[0].config.effectId,effectId);return rule.id;
 }
 for(const type of ['follow','like']){const count=rules().length;click('[data-market-free-placeholder="'+type+'"] [data-market-inline="enabled"]');await waitFor(()=>rules().length===count+1,'La ligne gratuite '+type+' ne s’active pas.');assert.equal(rules().at(-1).trigger.type,type);assert.equal(rules().at(-1).enabled,true);assert.equal(rules().at(-1).actions[0].config.parameters.count,100);}
 const newIds=[];
 for(const [selector,column] of [['.market-section-heading [data-menu="all"]','neutral'],['.market-column.help [data-action="market-add"]','help'],['.market-column.neutral [data-action="market-add"]','neutral'],['.market-column.trap [data-action="market-add"]','trap']])newIds.push(await addGift(selector,column));
 for(const type of ['follow','like']){
  const count=rules().length;click('.market-section-heading [data-menu="all"]');await waitFor(()=>document.querySelector('.market-add-menu'),'Menu principal absent.');click('.market-add-menu [data-type="'+type+'"]');await waitFor(()=>rules().length===count+1,'L’ajout '+type+' échoue.');assert.equal(rules().at(-1).trigger.type,type);
  await waitFor(()=>document.querySelector('.market-follow-grid [data-rule="'+rules().at(-1).id+'"]'),'La carte gratuite n’apparaît pas.');
 }
 const catalog=document.querySelector('.market-catalog');assert.equal(catalog.querySelectorAll('article').length,0);catalog.open=true;catalog.dispatchEvent(new dom.window.Event('toggle'));await waitFor(()=>catalog.querySelectorAll('article').length===42,'Le catalogue ne se prépare pas à son ouverture.');
 const count=rules().length,effect=pack.effects.find(e=>e.code==='ResetEffects');click('[data-action="market-add-effect"][data-id="'+effect.id+'"]');await waitFor(()=>document.querySelector('#editor-dialog[open] [data-market-gift-choice="5655"]'),'L’ajout depuis le catalogue échoue.');click('[data-market-gift-choice="5655"]');await waitFor(()=>rules().length===count+1,'Le catalogue n’enregistre pas la carte.');assert.equal(rules().at(-1).actions[0].config.effectId,effect.id);
 const cardSelector='[data-market-card][data-rule="'+newIds[1]+'"]';
 click(cardSelector+' [data-action="market-extra-add"]');await waitFor(()=>document.querySelector(cardSelector+' [data-market-inline="new-extra-effect"]'),'Le bouton + action ne propose pas de choix.');
 const select=document.querySelector(cardSelector+' [data-market-inline="new-extra-effect"]');select.value=pack.effects.find(e=>e.code==='FillShelves').id;select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await waitFor(()=>rules().find(r=>r.id===newIds[1]).actions.length===2,'L’action supplémentaire ne se sauvegarde pas.');
 assert.equal(document.querySelectorAll(cardSelector).length,1,'Un effet supplémentaire reste dans la même carte.');
 assert.equal(document.querySelector('.market-phone-source iframe'),previewFrame,'Les ajouts et modifications ne doivent pas recharger l’aperçu.');assert.equal(previewFrame.contentWindow,previewWindow);
 const loaded=JSON.parse(fs.readFileSync(store.filePath,'utf8'));assert.equal(loaded.game.interactionRulesByPack[id].length,21);assert.equal(loaded.profiles.find(p=>p.id===loaded.session.profileId).workspace.game.interactionRulesByPack[id].length,21);
 assert.deepEqual(rules().filter(r=>original.some(o=>o.id===r.id)),original,'Les douze défauts sont préservés.');
 click('#navigation [data-navigate="home"]');await waitFor(()=>document.querySelector('.creator-home-page'),'Le retour Accueil échoue.');dom.window.eval('currentPage="games";');await dom.window.eval('enterGameWorkspace(snapshot.packs[0])');assert.equal(document.querySelectorAll('[data-market-card]').length,21);
 assert.equal(errors.length,0,errors.map(error=>error.stack||error.message).join('\n'));
});
