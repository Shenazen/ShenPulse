"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {JSDOM,VirtualConsole}=require('jsdom');
const {createDefaultState}=require('../src/main/defaults');
const custom=require('../src/main/custom-games');
const shortcuts=require('../src/shared/custom-game-shortcuts');
async function waitFor(check,message){const end=Date.now()+7000;while(!check()){if(Date.now()>end)throw Error(message);await new Promise(resolve=>setTimeout(resolve,15));}}
test('real game gallery creates a personal pack, edits shortcuts, keeps extras and returns to its pinned builder',async t=>{
 const state=createDefaultState(),account={authenticated:true,uid:'ui-custom',email:'custom-ui@example.test',displayName:'Créateur',emailVerified:true};
 Object.assign(state.settings.account,account);state.commerce.subscription={tier:'pro',source:'own',status:'active'};
 let definitions=[],snapshot,selected='';const subscriptions=new Map(),errors=[],writes=[],tests=[];
 const refresh=()=>snapshot={appVersion:'2.1.3',state:structuredClone(state),packs:[custom.builderPack(),...definitions.map(custom.packFor)],soundCatalog:[],mediaCatalog:[],catalogCounts:{},timerRuntime:[],overlayUrls:{},localOverlayUrls:{},publicOverlayRelay:{connected:false},liveDirectory:{available:true,connected:true,enabled:false,rows:[]}};refresh();
 const file=path.resolve(__dirname,'../src/renderer/index.html'),vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error));
 const dom=new JSDOM(fs.readFileSync(file,'utf8'),{url:pathToFileURL(file).href,runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.structuredClone=structuredClone;Object.defineProperty(w,'localStorage',{value:{getItem:()=>null,setItem(){},removeItem(){}}});
  const nativeTimeout=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,ms===5000?1:ms,...args);
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};w.HTMLElement.prototype.scrollIntoView=function(){};
  w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},drawImage(){},fillRect(){},getImageData:()=>({data:new Uint8ClampedArray(4)}),putImageData(){}});
  w.shenPulse={getSnapshot:async()=>refresh(),testAction:async action=>{tests.push(action);return {ok:true};},selectGame:async id=>{selected=id;state.session.activeGamePackId=id;return refresh();},getGameRuntimeStatus:async()=>null,initializeGameInteractions:async()=>({snapshot:refresh()}),
   customGameWindows:async()=>[{processName:'FixtureGame',title:'Mon jeu ouvert'}],saveCustomGame:async input=>{const definition=custom.metadata(input,definitions.find(d=>d.id===input.id)),pack=custom.packFor(definition);definitions=[definition];state.game.customPacks=definitions;state.game.interactionRulesByPack[pack.id]||=custom.createRules(pack);state.game.interactionCatalogVersions[pack.id]=1;return {packId:pack.id,snapshot:refresh()};},
   saveGameInteraction:async(id,rule)=>{shortcuts.assertRule(custom.packFor(definitions[0]),rule);writes.push(structuredClone(rule));const list=state.game.interactionRulesByPack[id],index=list.findIndex(r=>r.id===rule.id);if(index<0)list.push(rule);else list[index]=rule;return refresh();},
   searchGifts:async()=>({gifts:[],total:0}),getSpotifyStatus:async()=>({configured:false,connected:false,devices:[]}),controlSpotify:async()=>({settings:{enabled:false},queue:[],history:[]}),users:{snapshot:async()=>({rows:[],total:0,stats:{},streamers:[],blockedUsers:[]})},controllers:{status:async()=>({devices:[],mappings:[]})},updates:{check:async()=>({available:false})},account:{status:async()=>account,gameCheatAccess:async()=>({allowed:false}),syncEntitlements:async()=>null},admin:{status:async()=>({authorized:false}),visibility:async()=>state.settings.siteVisibility},on:(event,fn)=>{subscriptions.set(event,fn);return()=>{};}};
  w.addEventListener('error',e=>errors.push(e.error));
 }});t.after(()=>dom.window.close());const d=dom.window.document;
 await waitFor(()=>d.querySelector('.creator-home-page'),'Home');d.querySelector('[data-navigate="games"]').click();await waitFor(()=>d.querySelector('.games-gallery-page'),'Gallery');
 assert.equal(d.querySelector('.games-tile-grid .game-gallery-tile').dataset.id,custom.BUILDER_ID);
 d.querySelector('.game-gallery-tile [data-action="open-game"]').click();await waitFor(()=>d.querySelector('.custom-games-page'),'Builder');
 assert.equal(selected,'','Opening the builder must not change an active game session.');
 assert.equal(d.querySelector('.custom-games-hero-art').getAttribute('src'),'assets/games/personalise-tes-jeux.webp');
 d.querySelector('[data-action="custom-game-create"]').click();await waitFor(()=>d.querySelector('[name="customName"]'),'Create dialog');
 d.querySelector('[name="customName"]').value='Jeu personnel';d.querySelector('[name="customProcess"]').value='FixtureGame';d.querySelector('#editor-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
 await waitFor(()=>d.querySelector('.game-pack-shortcut-parameters'),'Custom page');
 const packId=definitions[0].id;assert.equal(d.querySelectorAll('.game-pack-columns .game-pack-action-card').length,6);assert.ok(d.querySelector('[data-action="start-game-session"]'));assert.equal(d.querySelector('[data-action="install-game"]'),null);
 assert.ok([...d.querySelectorAll('.game-pack-hero img,.game-pack-phone img')].some(img=>img.getAttribute('src')==='assets/games/personalise-tes-jeux.webp'));
 assert.deepEqual([...d.querySelectorAll('.game-pack-columns [data-shortcut-input]')].map(input=>input.value),['ESPACE','SHIFT','E','CTRL','A','R']);
 const card=d.querySelector('.game-pack-columns .game-pack-action-card'),key=card.querySelector('[data-parameter="shortcut"]');key.value='CTRL + E ; ESPACE';key.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 await waitFor(()=>writes.length===1,'Save shortcut');assert.equal(writes[0].actions[0].config.parameters.shortcut,'CTRL + E ; ESPACE');assert.equal(writes[0].conditions[0].value,'Rose');
 d.querySelector('.game-pack-columns [data-action="test-game-interaction"]').click();await waitFor(()=>tests.length===1,'Manual shortcut test automatically focuses the game without a countdown');assert.equal(tests[0].config.parameters.shortcut,'CTRL + E ; ESPACE');
 const current=d.querySelector('.game-pack-columns .game-pack-action-card');current.querySelector('[data-action="market-extra-add"]').click();await waitFor(()=>d.querySelector('[data-market-inline="new-extra-effect"]'),'Extra action picker');
 const extra=d.querySelector('[data-market-inline="new-extra-effect"]');extra.value='keyboard-reload';extra.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await waitFor(()=>writes.length===2,'Save extra');
 const extraKey=d.querySelector('.game-pack-columns .game-pack-action-card .game-pack-extra-effect [data-parameter="shortcut"]');assert.ok(extraKey);extraKey.value='R ; E';extraKey.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await waitFor(()=>writes.length===3,'Save extra shortcut');assert.equal(writes[2].actions[1].config.parameters.shortcut,'R ; E');assert.equal(writes[2].actions[0].config.parameters.shortcut,'CTRL + E ; ESPACE');
 const recorded=d.querySelector('.game-pack-columns .game-pack-action-card .game-pack-extra-effect [data-shortcut-input]');recorded.click();for(const type of ['keydown','keyup'])recorded.dispatchEvent(new dom.window.KeyboardEvent(type,{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));
 await waitFor(()=>writes.length===4,'Save captured ESC');assert.equal(writes[3].actions[1].config.parameters.shortcut,'ESC');assert.equal(writes[3].actions[0].config.parameters.shortcut,'CTRL + E ; ESPACE');assert.equal(writes[3].conditions[0].value,'Rose');
 d.querySelector('[data-action="custom-game-home"]').click();await waitFor(()=>d.querySelector('.custom-game-card'),'Personal games');assert.match(d.querySelector('.custom-game-card').textContent,/Jeu personnel/);
 assert.equal(d.querySelector('.custom-game-card img').getAttribute('src'),'assets/games/personalise-tes-jeux.webp');
 assert.ok(state.game.interactionRulesByPack[packId]);assert.deepEqual(errors.map(e=>e?.message),[]);
});
