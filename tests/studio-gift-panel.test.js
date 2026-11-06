'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const geometry=require('../resources/overlays/game-pack-layout');
const studio=require('../src/main/studio-installation/layout');
const {prepareTikTok}=require('../src/main/studio-installation/tiktok');
const {prepareCollection,installObsOnline}=require('../src/main/studio-installation/obs');
const {prepareSELive}=require('../src/main/studio-installation/selive');
const {installStreamlabs}=require('../src/main/studio-installation/streamlabs');
function plan(packId='clash-of-live',presentation={model:1}){return {identity:'fixture:'+packId,packId,presentation,profileId:'p',gameName:packId,sceneName:packId,executable:'fixture.exe',overlayUrl:'https://overlay.test/game-pack.html?channel=test&jeu='+packId+'&profile=p',winsOverlayUrl:'https://overlay.test/game-wins.html?jeu='+packId+'&profile=p',assertScope(){}};}
const tiktok=()=>({SourceService:{state:{scenes:[],sceneSource:{},layerMap:{}}}});
const B='12345678-1234-4234-a234-123456789abc';
const composition=()=>({id:B,name:'TikTok',isObsNativeComposition:false,view:'custom',videoFrame:{width:1080,height:1920},scenes:[],streamingVideoEncoders:[]});
const near=(x,y)=>assert.ok(Math.abs(x-y)<1e-6,`${x} ≠ ${y}`);

test('tous les jeux personnalisables : source cadeau native, position réelle, wins séparées, 8 dispositions et 17 tailles',()=>{
 let count=0;
 for(const packId of [geometry.PACK_ID,...geometry.GAME_IDS])for(const cardPlacement of ['bottom','sides'])for(const cameraPlacement of ['top','bottom'])for(const rowOrder of ['help-first','trap-first'])for(let cardSize=80;cardSize<=160;cardSize+=5){
  const p=plan(packId,{model:1,cardPlacement,cameraPlacement,rowOrder,cardSize}),g=geometry.geometry(p.presentation),s=studio.sourceViewport(p,'overlay');
  assert.equal(s.width,1080);assert.equal(s.height,Math.ceil(g.gifts.height));assert.ok(s.height<1920);assert.equal(new URL(studio.overlayUrl(p)).searchParams.get('fit'),'panel');
  const tik=prepareTikTok(tiktok(),p),sources=Object.values(tik.document.SourceService.state.sceneSource[tik.sceneId].data),gift=sources.find(x=>x.payload?.url?.includes('game-pack.html')),wins=sources.find(x=>x.payload?.url===p.winsOverlayUrl);
  assert.deepEqual([gift.payload.cx,gift.payload.cy,gift.payload.zoom],[s.width,s.height,1]);assert.deepEqual(gift.transform.size,{cx:s.width,cy:s.height});
  const scale=675/1080;near(gift.transform.translateX+gift.transform.size.cx*gift.transform.scaleX/2,(g.gifts.x+g.gifts.width/2)*scale);near(gift.transform.translateY+gift.transform.size.cy*gift.transform.scaleY/2,(g.gifts.y+g.gifts.height/2)*scale);
  assert.equal(wins.payload.cy,1920);assert.equal(wins.transform.translateY,0);
  const obs=prepareCollection({sources:[],scene_order:[],resolution:{x:1080,y:1920}},p).document,source=obs.sources.find(x=>x.settings?.url?.includes('game-pack.html')),item=obs.sources.find(x=>x.id==='scene').settings.items.find(x=>x.source_uuid===source.uuid);
  assert.deepEqual([source.settings.width,source.settings.height],[s.width,s.height]);assert.deepEqual(item.bounds,{x:g.gifts.width,y:g.gifts.height});assert.deepEqual(item.pos,{x:g.gifts.x,y:g.gifts.y});
  const se=prepareSELive(composition(),p).document.scenes[0].sources.find(x=>x.settings?.url?.includes('game-pack.html'));
  assert.deepEqual([se.settings.width,se.settings.height],[s.width,s.height]);assert.deepEqual(se.composition.position,{x:g.gifts.x,y:g.gifts.y});assert.deepEqual(se.composition.bounds,{x:g.gifts.width,y:g.gifts.height});count++;
 }
 assert.equal(count,2176);
});

test('le vrai runtime remplit exactement le panneau studio sans réduire tout le portrait',t=>{
 for(const cardPlacement of ['bottom','sides'])for(const cameraPlacement of ['top','bottom'])for(const cardSize of [80,100,160]){
  const p=plan('clash-of-live',{model:1,cardPlacement,cameraPlacement,cardSize}),v=studio.sourceViewport(p,'overlay'),g=geometry.geometry(p.presentation),dom=new JSDOM('<main id="pack"><div id="cards"></div><div id="reaction"></div></main>',{runScripts:'outside-only',url:studio.overlayUrl(p).replace("channel=test&", "")});t.after(()=>dom.window.close());
  const w=dom.window;w.innerWidth=v.width;w.innerHeight=v.height;w.eval(fs.readFileSync('resources/overlays/game-pack-layout.js','utf8'));w.eval(fs.readFileSync('resources/overlays/runtime/game-pack.js','utf8'));
  w.ShenPulseGamePack.render({enabled:true,packId:p.packId,profileId:'p',presentation:p.presentation,cards:[{id:'one',column:'neutral',title:'Dragon rouge',triggerType:'gift',giftCost:1}]});
  const root=w.document.getElementById('pack'),factor=Number(root.style.transform.match(/scale\(([^)]+)\)/)[1]);near(factor,1);near(parseFloat(root.style.top)+g.gifts.y,(v.height-g.gifts.height)/2);near(parseFloat(root.style.left),0);assert.ok(w.document.querySelector('.gift-card'));assert.equal(w.document.body.classList.contains('cards-sides'),cardPlacement==='sides');
 }
});

test('réinstaller Clash corrige le grand canevas et les découpes précédentes sans changer les autres sources',()=>{
 const p=plan(),first=prepareTikTok(tiktok(),p),scene=first.document.SourceService.state.sceneSource[first.sceneId],gift=Object.values(scene.data).find(x=>x.payload?.url?.includes('game-pack.html'));
 gift.payload.cy=1920;gift.payload.url=p.overlayUrl;gift.transform.size.cy=1019;gift.transform.translateY=60;gift.stateData={old:true};gift.clip={x:5,y:10,z:20,w:30};
 const fixed=prepareTikTok(first.document,p),next=fixed.document.SourceService.state.sceneSource[fixed.sceneId].data[gift.id];assert.equal(next.payload.cy,600);assert.equal(next.transform.size.cy,600);assert.equal(new URL(next.payload.url).searchParams.get('fit'),'panel');assert.equal(next.stateData,undefined);assert.deepEqual(next.clip,{x:0,y:0,z:0,w:0});assert.deepEqual(prepareTikTok(fixed.document,p),fixed);
 const obs=prepareCollection({sources:[],scene_order:[],resolution:{x:1080,y:1920}},p).document,source=obs.sources.find(x=>x.settings?.url?.includes('game-pack.html')),item=obs.sources.find(x=>x.id==='scene').settings.items.find(x=>x.source_uuid===source.uuid);Object.assign(item,{crop_top:140,crop_bottom:80,bounds_type:0,rot:20,scale:{x:.5,y:.5}});
 const repaired=prepareCollection(obs,p).document.sources.find(x=>x.id==='scene').settings.items.find(x=>x.source_uuid===source.uuid);assert.equal(repaired.crop_top,0);assert.equal(repaired.crop_bottom,0);assert.equal(repaired.rot,0);assert.equal(repaired.bounds_type,2);assert.deepEqual(repaired.scale,{x:1,y:1});
});

test('OBS en ligne et Streamlabs reçoivent le même panneau haute résolution que TikTok et SE.Live',async()=>{
 const p=plan(),calls=[],inputs=[],items=[];
 const obs={connect:async()=>{},close(){},call:async(method,args={})=>{calls.push([method,args]);if(method==='GetSceneList')return {scenes:[]};if(['GetStreamStatus','GetRecordStatus'].includes(method))return {outputActive:false};if(method==='GetVideoSettings')return {baseWidth:1080,baseHeight:1920};if(method==='GetInputList')return {inputs};if(method==='GetSceneItemList')return {sceneItems:items};if(method==='CreateInput'){items.push({sourceName:args.inputName});return {sceneItemId:items.length};}if(method==='GetInputPropertiesListPropertyItems')return {propertyItems:[]};return {};}};
 await installObsOnline({configRoot:'unused'},p,obs);const created=calls.find(([m,a])=>m==='CreateInput'&&a.inputSettings?.url?.includes('game-pack.html'))[1];assert.equal(created.inputSettings.width,1080);assert.equal(created.inputSettings.height,600);assert.equal(new URL(created.inputSettings.url).searchParams.get('fit'),'panel');
 const slCalls=[],slItems=[];const sl={connect:async()=>{},close(){},call:async(service,method,...args)=>{slCalls.push([service,method,args]);if(method==='getScenes')return [];if(['isStreaming','isRecording'].includes(method))return false;if(method==='createScene')return {id:'s',resourceId:'scene',name:p.sceneName};if(method==='baseResolution')return {baseWidth:1080,baseHeight:1920};if(method==='getSources')return [];if(method==='getItems')return slItems;if(method==='createAndAddSource'){const item={sourceId:String(slItems.length),resourceId:'item'+slItems.length};slItems.push(item);return item;}return {};}};
 await installStreamlabs({},p,sl);const [, ,args]=slCalls.find(([,m,a])=>m==='createAndAddSource'&&a[2]?.url?.includes('game-pack.html'));assert.equal(args[2].height,600);assert.equal(args[2].width,1080);assert.equal(new URL(args[2].url).searchParams.get('fit'),'panel');const transform=slCalls.find(([service,m])=>service==='item2'&&m==='setTransform')[2][0];assert.deepEqual(transform.position,{x:0,y:1320});assert.deepEqual(transform.scale,{x:1,y:1});
});
