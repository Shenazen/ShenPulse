"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {JSDOM}=require("jsdom");
const {normalizeGamePackPresentation}=require("../src/shared/game-pack-presentation");
function fixture(t,packId="minecraft-box-cyber"){
 const dom=new JSDOM('<main id="content"></main><dialog><div id="dialog-body"></div></dialog>',{runScripts:"outside-only",url:"https://fixture.test/"});t.after(()=>dom.window.close());
 const w=dom.window,root=w.document.querySelector("main"),pack={id:packId,name:"Minecraft Box Cyber",effects:[]},saved=[],errors=[];
 const state={settings:{account:{uid:"owner"},overlayConfigs:{gameInteractionOverlays:{[packId]:{model:1,motion:"animated"},other:{model:2}}}},session:{profileId:"profile"},game:{interactionRulesByPack:{}}};
 Object.assign(w,{URL,structuredClone,content:root,dialog:w.document.querySelector("dialog"),snapshot:{state,packs:[pack]},selectedGameId:packId,usesSharedGameWorkspace:()=>true,requireGameAccess:()=>true,marketAddMenu:"",STUDIO_PREFERENCE_ACTIONS:new Set(),requireAccountForAction:()=>false,
  ShenPulseGameWorkspacePolicy:require("../src/shared/game-workspace-policy"),ShenPulseGamePackLayout:require("../resources/overlays/game-pack-layout"),acceptSnapshot:value=>{w.snapshot=value;},perform:fn=>fn(),toast(){}});
 w.dialogBody=w.dialog.querySelector('#dialog-body');w.dialogSessionId=0;w.showDialogError=message=>errors.push(new Error(message));w.openEditor=options=>{w.dialogSessionId++;w.editorOptions=options;w.dialog.setAttribute('open','');w.dialogBody.innerHTML=options.body;};
 const load=name=>require("node:vm").runInContext(fs.readFileSync('src/renderer/app/'+name,'utf8'),dom.getInternalVMContext());
 for(const name of ['actions/handlers/contracts.js','features/games/workspace/core.js','features/games/workspace/preview.js','features/games/supermarket-controls.js','features/games/game-presentation-editor.js','actions/dispatcher.js'])load(name);
 let previous='';
 const context=()=>({pack,profileId:w.snapshot.state.session.profileId,accountUid:'owner',bindings:{overlayColor:'market-overlay-color'},actions:{chooseModel:'market-overlay-model',chooseColor:'market-overlay-color',previewMode:'market-preview-mode',copy:'copy'},preview:{models:[{id:1,label:'Modèle 1',supportsMotion:true},{id:2,label:'Modèle 2',supportsBackground:true},{id:3,label:'Modèle 3'}],presentation:normalizeGamePackPresentation(w.snapshot.state.settings.overlayConfigs.gameInteractionOverlays[packId],packId),backgrounds:[['#123456','Bleu'],['#abcdef','Clair']],sourceUrl:'https://overlay.test/game-pack.html?jeu='+packId,winsSourceUrl:'https://overlay.test/game-wins.html?jeu='+packId,camera:{src:'/camera.jpg'},game:{src:'/game.jpg'},guides:[{kind:'camera',title:'Caméra'},{kind:'game',title:'Jeu'},{kind:'gifts',title:'Cadeaux'}]}});
 w.supermarketContext=context;
 w.render=()=>{const next=w.ShenPulseGameWorkspace.renderLivePreview(context());if(!previous||!w.ShenPulseGameWorkspace.patchPreview(root,previous,next))root.innerHTML=next;previous=next;};
 w.api={saveGamePackPresentation:async incoming=>{assert.equal(incoming.packId,packId);assert.equal(incoming.profileId,w.snapshot.state.session.profileId);assert.equal(incoming.accountUid,'owner');saved.push(structuredClone(incoming));const map=w.snapshot.state.settings.overlayConfigs.gameInteractionOverlays;const {profileId,accountUid,packId:id,...patch}=incoming;map[id]=normalizeGamePackPresentation({...map[id],...patch},id);return structuredClone(w.snapshot);}};
 root.addEventListener('click',event=>{const target=event.target.closest('[data-action]');if(target)w.handleAction(target).catch(error=>errors.push(error));});w.render();
 const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));if(errors.length)throw errors.shift();};
 const click=async selector=>{const button=(w.dialog.open?w.dialog:root).querySelector(selector);assert.ok(button,selector);button.click();await flush();return button;};
 return {w,dom,root,saved,flush,click,context,draft:()=>w.eval('gamePackPresentationEditor?.draft'),cancel:()=>{w.dialog.removeAttribute('open');w.dialog.dispatchEvent(new w.Event('close'));},save:async()=>{await w.editorOptions.onSubmit();w.dialog.removeAttribute('open');w.dialog.dispatchEvent(new w.Event('close'));},presentation:()=>w.snapshot.state.settings.overlayConfigs.gameInteractionOverlays[packId]};
}

test('la popup prévisualise les 272 combinaisons sans écrire le profil, puis enregistre une seule fois',async t=>{
 const f=fixture(t),initial=JSON.stringify(f.presentation()),mainFrames=[...f.root.querySelectorAll('iframe')],urls=mainFrames.map(frame=>frame.src),other=JSON.stringify(f.w.snapshot.state.settings.overlayConfigs.gameInteractionOverlays.other);
 assert.equal(f.root.querySelector('.game-pack-preview-settings'),null);assert.equal(f.root.querySelector('.game-pack-preview-caption'),null);
 assert.ok(f.root.querySelector('.game-pack-customize-button svg'));assert.equal(new URL(f.root.querySelector('.game-pack-copy-overlay').dataset.value).searchParams.get('fit'),'cards');assert.ok(mainFrames.every(frame=>!new URL(frame.src).searchParams.has('fit')));await f.click('[data-action="market-overlay-customize"]');
 const dialog=f.w.dialog,frames=[...dialog.querySelectorAll('iframe')],editorUrls=frames.map(frame=>frame.src);assert.ok(editorUrls.every(url=>new URL(url).searchParams.get('editorPreview')==='1'));assert.ok(dialog.querySelector('.game-pack-preview-caption'));assert.equal(dialog.querySelectorAll('.game-pack-layout-choices button').length,6);
 let count=0;
 for(const cardPlacement of ['sides','bottom'])for(const cameraPlacement of ['top','bottom'])for(const rowOrder of ['help-first','trap-first'])for(const size of Array.from({length:17},(_,i)=>80+i*5))for(const motion of ['animated','fixed']){
  for(const [key,value] of Object.entries({cardPlacement,cameraPlacement,rowOrder}))await f.click(`[data-layout-key="${key}"][data-value="${value}"]`);
  const range=dialog.querySelector('[data-market-card-size]');range.value=String(size);range.dispatchEvent(new f.w.Event('input',{bubbles:true}));assert.equal(range.closest('label').querySelector('output').textContent,size+' %');await f.flush();
  await f.click(`[data-game-presentation-command="market-preview-mode"][data-value="${motion}"]`);
  const value=f.draft();assert.deepEqual([value.cardPlacement,value.cameraPlacement,value.rowOrder,value.cardSize,value.motion],[cardPlacement,cameraPlacement,rowOrder,size,motion]);
  for(const [key,id] of Object.entries({cardPlacement,cameraPlacement,rowOrder}))assert.equal(dialog.querySelector(`[data-layout-key="${key}"][aria-pressed="true"]`).dataset.value,id);
  assert.equal(dialog.querySelector('[data-market-card-size]').value,String(size));
  assert.deepEqual([...dialog.querySelectorAll('iframe')].map(frame=>frame.src),editorUrls);assert.ok(frames.every(frame=>frame.isConnected));count++;
 }
 assert.equal(count,272);assert.equal(f.saved.length,0);assert.equal(JSON.stringify(f.presentation()),initial);assert.ok(mainFrames.every(frame=>frame.isConnected));
 for(const model of [2,3,1]){await f.click(`[data-game-presentation-command="market-overlay-model"][data-value="${model}"]`);assert.equal(f.draft().model,model);assert.equal(!!dialog.querySelector('[data-market-card-size]'),model===1);assert.equal(!!dialog.querySelector('.game-pack-preview-mode'),model===1);if(model===2){await f.click('[data-game-presentation-command="market-overlay-color"][data-value="#abcdef"]');assert.equal(f.draft().backgroundColor,'#abcdef');}}
 await f.save();assert.equal(f.saved.length,1);assert.equal(f.presentation().backgroundColor,'#abcdef');assert.equal(f.presentation().cardSize,160);assert.equal(JSON.stringify(f.w.snapshot.state.settings.overlayConfigs.gameInteractionOverlays.other),other);assert.deepEqual([...f.root.querySelectorAll('iframe')].map(frame=>frame.src),urls);
});

test('annuler conserve le profil, les URL et le LIVE, et la réouverture repart du réglage enregistré',async t=>{
 const f=fixture(t),initial=JSON.stringify(f.presentation());await f.click('[data-action="market-overlay-customize"]');await f.click('[data-layout-key="cardPlacement"][data-value="sides"]');assert.equal(f.draft().cardPlacement,'sides');f.cancel();assert.equal(f.saved.length,0);assert.equal(JSON.stringify(f.presentation()),initial);await f.click('[data-action="market-overlay-customize"]');assert.equal(f.draft().cardPlacement,'bottom');f.cancel();
});

test('enregistrer est refusé après un changement de profil ou de compte',async t=>{
 for(const kind of ['profile','account']){const f=fixture(t);await f.click('[data-action="market-overlay-customize"]');if(kind==='profile')f.w.snapshot.state.session.profileId='other';else f.w.snapshot.state.settings.account.uid='other';await assert.rejects(f.save(),/profil a changé/);assert.equal(f.saved.length,0);}
});

test('les autres jeux gardent leur présentation et ne peuvent pas ouvrir la popup Box Cyber',async t=>{
 const f=fixture(t,'cult-of-the-lamb');assert.equal(f.root.querySelector('.game-pack-preview-settings'),null);assert.equal(f.root.querySelector('.game-pack-customize-button'),null);assert.ok(f.root.querySelector('.game-pack-preview-controls'));f.w.openGamePackPresentationEditor(f.context().pack);assert.equal(f.w.dialog.open,false);assert.equal(f.saved.length,0);
});
