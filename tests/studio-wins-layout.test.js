"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const {prepareTikTok}=require('../src/main/studio-installation/tiktok');
const {prepareCollection,installObsOnline}=require('../src/main/studio-installation/obs');
const {installStreamlabs}=require('../src/main/studio-installation/streamlabs');
const {layout,WINS_VIEWPORT}=require('../src/main/studio-installation/layout');
const reference=require('./fixtures/studio-hiking-wins-reference.json');
const interactionReference=require('./fixtures/studio-supermarket-reference.json');
const plan={identity:'owner:p:hiking',packId:'gtav-hiking',profileId:'p',gameName:'GTA Hiking',sceneName:'GTA Hiking',executable:'GTA5.exe',overlayUrl:'https://overlay.test/game-pack.html?jeu=gtav-hiking&profile=p',winsOverlayUrl:'https://overlay.test/game-wins.html?jeu=gtav-hiking&profile=p',assertScope(){}};
const emptyTikTok=()=>({SourceService:{state:{scenes:[],sceneSource:{},layerMap:{}}}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} ≠ ${b}`);
function tikTokSources(result){const data=Object.values(result.document.SourceService.state.sceneSource[result.sceneId].data);return {wins:data.find(s=>s.payload?.url===plan.winsOverlayUrl),overlay:data.find(s=>s.payload?.url?.includes('game-pack.html')),game:data.find(s=>s.type==='game'),data};}
function referenceBox(width=675,height=1200){const scale=Math.min(width/reference.preview.width,height/reference.preview.height),t=reference.transform;return {x:(width-reference.preview.width*scale)/2+t.translateX*scale,y:t.translateY*scale,width:t.size.cx*t.scaleX*scale,height:t.size.cy*t.scaleY*scale};}
function checkBox(actual,expected){for(const key of ['x','y','width','height'])near(actual[key],expected[key]);}

test('TikTok reproduit exactement le cadrage Hiking approuvé et conserve les derniers cadeaux visibles',()=>{
 const {wins,overlay}=tikTokSources(prepareTikTok(emptyTikTok(),plan));
 assert.deepEqual(wins.transform,reference.transform);assert.deepEqual(WINS_VIEWPORT,reference.viewport);
 assert.equal(wins.payload.cy,WINS_VIEWPORT.height);
 const lastGiftBottom=1920*(0.324+0.305)+10;
 const hudScale=Math.min(1,WINS_VIEWPORT.height/1280);
 assert.ok(lastGiftBottom*hudScale<WINS_VIEWPORT.height);
 assert.ok(wins.transform.translateY+lastGiftBottom*hudScale*wins.transform.scaleY<overlay.transform.translateY);
 for(const [width,height]of [[675,1200],[378,672],[1080,1920],[1350,2400],[1920,1080]]){
  const boxes=layout(width,height);checkBox(boxes.wins,referenceBox(width,height));
  assert.ok(boxes.wins.y>=0);assert.ok(boxes.wins.y+boxes.wins.height<boxes.overlay.y);assert.ok(boxes.wins.x+boxes.wins.width<=width);
 }
});

test('réinstaller répare seulement le HUD rogné et suit le placement personnalisé des interactions',()=>{
 const first=prepareTikTok(emptyTikTok(),plan),{wins,overlay,game,data}=tikTokSources(first);
 overlay.transform.translateX=41;overlay.transform.scaleX=.45;overlay.transform.scaleY=.45;
 game.transform.translateY=400;
 Object.assign(wins,{stateData:{obsolete:true},clip:{x:100,y:200,z:100,w:200},effectiveClip:{x:100,y:200,z:100,w:200}});
 Object.assign(wins.transform,{translateX:-200,translateY:-111,scaleX:1.1,scaleY:1.1,size:{cx:1080,cy:1019}});wins.payload.zoom=3;
 const others=structuredClone(data.filter(s=>s!==wins));
 const next=prepareTikTok(first.document,{...plan,overlayOnly:true}),fixed=tikTokSources(next);
 const ratio=.45/interactionReference.transform.scaleX;
 near(fixed.wins.transform.translateX,Math.max(0,41-interactionReference.transform.translateX*ratio));
 near(fixed.wins.transform.translateY,400+(reference.transform.translateY-384)*ratio);
 near(fixed.wins.transform.scaleX,reference.transform.scaleX*ratio);
 assert.deepEqual(fixed.wins.clip,{x:0,y:0,z:0,w:0});assert.deepEqual(fixed.wins.effectiveClip,fixed.wins.clip);
 assert.equal(fixed.wins.payload.zoom,1);assert.equal(fixed.wins.stateData,undefined);assert.equal(fixed.wins.transform.size.cy,WINS_VIEWPORT.height);
 for(const source of others)assert.deepEqual(fixed.data.find(s=>s.id===source.id),source);
 assert.deepEqual(prepareTikTok(next.document,{...plan,overlayOnly:true}),next);
});

test('OBS hors ligne reprend le cadrage Hiking et retire l’ancienne découpe à la réinstallation',()=>{
 const first=prepareCollection({name:'Studio',sources:[],groups:[],scene_order:[],resolution:{x:1080,y:1920}},plan);
 const scene=first.document.sources.find(s=>s.id==='scene'),winsSource=first.document.sources.find(s=>s.settings?.url===plan.winsOverlayUrl);
 let wins=scene.settings.items.find(i=>i.source_uuid===winsSource.uuid);wins.crop_bottom=700;wins.crop_left=180;wins.rot=30;
 const next=prepareCollection(first.document,{...plan,overlayOnly:true}),items=next.document.sources.find(s=>s.id==='scene').settings.items;
 wins=items.find(i=>i.source_uuid===winsSource.uuid);
 assert.equal(winsSource.settings.height,WINS_VIEWPORT.height);checkBox({x:wins.pos.x,y:wins.pos.y,width:wins.bounds.x,height:wins.bounds.y},referenceBox(1080,1920));
 assert.equal(wins.crop_bottom,0);assert.equal(wins.crop_left,0);assert.equal(wins.rot,0);
});

test('TikTok normalise les coordonnées lorsque le studio a enregistré deux tailles d’aperçu différentes',()=>{
 const first=prepareTikTok(emptyTikTok(),plan),{wins,overlay}=tikTokSources(first),before=structuredClone(wins.transform),ratio=378/675;
 overlay.transform.preview_cx=378;overlay.transform.preview_cy=672;
 for(const key of ['translateX','translateY','scaleX','scaleY'])overlay.transform[key]*=ratio;
 Object.assign(wins.transform,{translateX:-200,scaleX:1.2});
 const fixed=tikTokSources(prepareTikTok(first.document,{...plan,overlayOnly:true}));
 near(fixed.wins.transform.translateX,before.translateX);
 near(fixed.wins.transform.size.cx*fixed.wins.transform.scaleX,before.size.cx*before.scaleX);
 assert.equal(fixed.wins.transform.preview_cx,675);assert.equal(fixed.overlay.transform.preview_cx,378,'Le cadrage des interactions reste intact');
});

test('OBS en ligne : le navigateur et son cadre se mettent à jour sans démarrer de diffusion',async()=>{
 const calls=[],items=[],inputs=[];let sequence=0;
 const client={connect:async()=>{},close(){},call:async(method,args={})=>{
  calls.push({method,args});
  if(method==='GetSceneList')return {scenes:[],currentProgramSceneName:'Autre scène'};
  if(method==='GetStreamStatus'||method==='GetRecordStatus')return {outputActive:false};
  if(method==='GetVideoSettings')return {baseWidth:1080,baseHeight:1920};
  if(method==='GetInputList')return {inputs};if(method==='GetSceneItemList')return {sceneItems:items};
  if(method==='CreateInput'){const sceneItemId=++sequence;items.push({sceneItemId,sourceName:args.inputName});return {sceneItemId};}
  if(method==='GetInputPropertiesListPropertyItems')return {propertyItems:[]};
  if(['CreateScene','SetSceneItemTransform','SetSceneItemIndex','SetCurrentProgramScene'].includes(method))return {};
  throw Error('Appel inattendu : '+method);
 }};
 await installObsOnline({configRoot:'.'},plan,client);
 const browser=calls.find(c=>c.method==='CreateInput'&&c.args.inputSettings?.url===plan.winsOverlayUrl);assert.equal(browser.args.inputSettings.height,WINS_VIEWPORT.height);
 const transforms=calls.filter(c=>c.method==='SetSceneItemTransform'),wins=transforms.at(-1).args.sceneItemTransform;
 checkBox({x:wins.positionX,y:wins.positionY,width:wins.boundsWidth,height:wins.boundsHeight},referenceBox(1080,1920));assert.equal(wins.cropBottom,0);
 assert.equal(calls.some(c=>/StartStream|StartRecord/.test(c.method)),false);
});

test('Streamlabs reprend les proportions Hiking après deux installations',async()=>{
 const sources=[],items=[],transforms=new Map();let sequence=0;
 const client={connect:async()=>{},close(){},call:async(resource,method,...args)=>{
  if(method==='getScenes')return [{id:'scene',name:plan.sceneName,resourceId:'Scene[1]'}];
  if(method==='isStreaming'||method==='isRecording')return false;
  if(method==='baseResolution')return {baseWidth:1080,baseHeight:1920};
  if(method==='getSources')return sources;if(method==='getItems')return items;
  if(method==='createAndAddSource'){const sourceId=String(++sequence);sources.push({sourceId,name:args[0],type:args[1],resourceId:'Source['+sourceId+']',...args[2]});const item={sourceId,resourceId:'Item['+sourceId+']'};items.push(item);return item;}
  if(method==='setTransform'){transforms.set(resource,args[0]);return;}
  if(['setVisibility','updateSettings','makeSceneActive'].includes(method))return;
  throw Error('Appel inattendu : '+method);
 }};
 await installStreamlabs({},plan,client);await installStreamlabs({},plan,client);
 const win=sources.find(s=>s.url===plan.winsOverlayUrl),w=transforms.get('Item['+win.sourceId+']');
 checkBox({x:w.position.x,y:w.position.y,width:win.width*w.scale.x,height:win.height*w.scale.y},referenceBox(1080,1920));assert.equal(win.height,WINS_VIEWPORT.height);assert.equal(sources.length,4);
});

test('chaque jeu doté de wins utilise la même référence TikTok sans modifier son URL ni les autres sources',()=>{
 const path=require('node:path'),packs=require('../src/main/game-catalog').loadShenazenGameCatalog(path.resolve('resources')).filter(p=>p.effects.some(e=>e.winCounter));
 assert.ok(packs.length>3);
 for(const pack of packs){
  const gamePlan={...plan,identity:'owner:p:'+pack.id,packId:pack.id,gameName:pack.name,sceneName:pack.name,overlayUrl:'https://overlay.test/game-pack.html?jeu='+pack.id+'&profile=p',winsOverlayUrl:'https://overlay.test/game-wins.html?jeu='+pack.id+'&profile=p'};
  const first=prepareTikTok(emptyTikTok(),gamePlan),data=Object.values(first.document.SourceService.state.sceneSource[first.sceneId].data),wins=data.find(s=>s.payload?.url===gamePlan.winsOverlayUrl);
  assert.deepEqual(wins.transform,reference.transform,pack.id);assert.equal(wins.payload.cy,reference.viewport.height,pack.id);
  assert.deepEqual(prepareTikTok(first.document,gamePlan),first,pack.id+' reste idempotent');
 }
});

test('le HUD reste entier même dans un navigateur trop court, après redimensionnement et avec des modèles séparés',t=>{
 const dom=new JSDOM(fs.readFileSync('resources/overlays/game-wins.html','utf8'),{runScripts:'outside-only',url:plan.winsOverlayUrl});t.after(()=>dom.window.close());
 const w=dom.window;w.innerWidth=1080;w.innerHeight=1019;w.eval(fs.readFileSync('resources/overlays/runtime/game-wins.js','utf8'));
 const root=w.document.getElementById('wins-hud'),factor=1019/1280;
 assert.equal(root.style.transform,'scale('+factor+')');near(parseFloat(root.style.left),(1080-1080*factor)/2);
 assert.ok(1280*factor<=1019);
 w.innerWidth=540;w.innerHeight=960;w.dispatchEvent(new w.Event('resize'));assert.equal(root.style.transform,'scale(0.5)');assert.equal(root.style.left,'0px');
 const single=new JSDOM('<main id="wins-hud"></main>',{runScripts:'outside-only',url:plan.winsOverlayUrl+'&mode=counter'});t.after(()=>single.window.close());
 single.window.innerWidth=360;single.window.innerHeight=260;single.window.eval(fs.readFileSync('resources/overlays/runtime/game-wins.js','utf8'));
 assert.equal(single.window.document.getElementById('wins-hud').style.transform,'scale(0.5)');assert.equal(single.window.document.documentElement.dataset.winsMode,'counter');
 const mute=new JSDOM('<main id="wins-hud"></main>',{runScripts:'outside-only',url:plan.winsOverlayUrl+'&mode=mute'});t.after(()=>mute.window.close());
 mute.window.innerWidth=540;mute.window.innerHeight=500;mute.window.eval(fs.readFileSync('resources/overlays/runtime/game-wins.js','utf8'));
 assert.equal(mute.window.document.getElementById('wins-hud').style.transform,'scale(0.5)','La source mute conserve son cadrage existant');
 const phone=new JSDOM('<main id="wins-hud"></main>',{runScripts:'outside-only',url:plan.winsOverlayUrl+'&preview=1'});t.after(()=>phone.window.close());
 phone.window.innerWidth=540;phone.window.innerHeight=608;phone.window.eval(fs.readFileSync('resources/overlays/runtime/game-wins.js','utf8'));
 assert.equal(phone.window.document.getElementById('wins-hud').style.transform,'scale(0.5)','Le téléphone conserve le placement des widgets sur la caméra et le jeu');
});
