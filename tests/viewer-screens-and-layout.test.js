"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const {ActionRunner}=require('../src/main/action-runner'),{RuleEngine}=require('../src/main/rule-engine');
const {createRelayMessage}=require('../src/shared/public-overlay-protocol');
const {actionAlertDisplay}=require('../src/main/actions/alert-display');
const {actionEditorFixture}=require('./helpers/action-editor-fixture');
const catalog=require('../resources/overlays/overlay-catalog'),layout=require('../resources/overlays/game-pack-layout');
const {normalizeGamePackPresentation}=require('../src/shared/game-pack-presentation');
const {prepareCollection}=require('../src/main/studio-installation/obs'),{prepareTikTok}=require('../src/main/studio-installation/tiktok');
const plan={identity:'test:p:cyber',packId:layout.PACK_ID,profileId:'p',gameName:'Box Cyber',sceneName:'Box Cyber',executable:'java.exe',overlayUrl:'https://overlay.test/game-pack.html?jeu='+layout.PACK_ID,winsOverlayUrl:'https://overlay.test/game-wins.html?jeu='+layout.PACK_ID,assertScope(){}};

test('les huit écrans transportent média, texte séparé, son et TTS au seul écran choisi',async()=>{
 for(let screen=1;screen<=8;screen++){
  const actions=[{id:'media',type:'overlay.media',config:{mediaUrl:'https://example.test/image.png',screen:screen===1?2:1}},{id:'text',type:'overlay.text',config:{alert:{enabled:true,message:'{avatar} Merci {username}',screen}}}];
  const state={rules:[{id:'r',trigger:{type:'gift'},actions}],session:{profileId:'p'},profiles:[]},frames=[];
  const store={getState:()=>state},runner=new ActionRunner({store,overlayServer:{publish:(channel,payload)=>frames.push(createRelayMessage(channel,payload))},notifyRenderer(){}});
  await new RuleEngine({store,actionRunner:runner}).test('r',{type:'gift',user:{name:'alice',avatarUrl:'https://example.test/alice.png'},data:{giftName:'Rose'}});
  const caption=frames.find(frame=>frame.payload.id==='text');assert.ok(caption,`écran ${screen}`);assert.equal(caption.payload.screen,screen);assert.equal(caption.payload.alert.parts[0].url,'https://example.test/alice.png');
  for(const channel of ['alert','audio','tts'])for(let receiver=1;receiver<=8;receiver++)assert.equal(catalog.acceptsChannel({view:'alerts',screen:receiver,hasMediaScreen:true,channel,payload:caption.payload}),receiver===screen,`${channel} ${screen} → ${receiver}`);
 }
});

test('la vraie popup mémorise chacun des huit écrans après sauvegarde et réouverture',async t=>{
 const h=actionEditorFixture(t);
 h.add();h.selectType(1,'overlay.text');
 assert.equal(h.parts()[1].querySelector('[name="alertShowUser"]'),null);
 assert.equal(h.parts()[1].querySelector('[name="alertMessage"]').value,'{avatar} Merci {username} !');
 assert.equal(h.parts()[1].querySelectorAll('.action-variable-info').length,10);
 for(let screen=1;screen<=8;screen++){
  h.parts()[1].querySelector('[name="alertScreen"]').value=String(screen);await h.save();
  const saved=h.calls.at(-1)[1];assert.equal(saved.actions[1].config.alert.screen,screen);
  h.window.openActionEditor({rule:saved,action:saved.actions[0],actionIndex:0});assert.equal(h.parts()[1].querySelector('[name="alertScreen"]').value,String(screen));
 }
});

test('la photo est un paramètre structuré : aucun HTML ni adresse dangereuse injecté',()=>{
 const a=actionAlertDisplay({alert:{enabled:true,showUser:false,message:'{avatar} Merci {username} !'}},{user:{name:'<b>Alice</b>',avatarUrl:'javascript:alert(1)'}});
 assert.equal(a.parts[0].type,'avatar');assert.equal(a.parts[0].url,'');assert.equal(a.parts[1].text,' Merci <b>Alice</b> !');
 const dom=new JSDOM('<main/>',{runScripts:'outside-only'});dom.window.escapeHtml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 const source=fs.readFileSync('resources/overlays/runtime/alerts-feed.js','utf8');dom.window.eval(source.slice(source.indexOf('function actionAlertCaptionMarkup('),source.indexOf('/** Adapter aussi')));
 dom.window.document.querySelector('main').innerHTML=dom.window.actionAlertCaptionMarkup(a);assert.equal(dom.window.document.querySelector('b'),null);assert.equal(dom.window.document.querySelector('img'),null);assert.equal(dom.window.document.querySelectorAll('.action-alert-avatar').length,1);dom.window.close();
});

test('dupliquer un scénario conserve ses effets, remappe les références et supprimer vise le scénario entier',async()=>{
 const rule={id:'original',name:'Med',trigger:{type:'gift'},actions:[{id:'a',type:'audio.play',config:{url:'x'}},{id:'b',type:'overlay.media',config:{soundActionId:'a'}},{id:'c',type:'action.group',config:{actionIds:['a','external']}}]};let saved,removed;
 const context=vm.createContext({structuredClone,Date,Map,cryptoId:(()=>{let i=0;return()=>++i})(),snapshot:{},api:{upsert:async(_,value)=>{saved=value},getSnapshot:async()=>({}),remove:async(_,id)=>{removed=id}},ensureRuleInActiveProfile:async()=>{},render(){},confirmAction:async()=>true});
 vm.runInContext(fs.readFileSync('src/renderer/app/actions/overlays.js','utf8'),context);
 await context.duplicateActionScenario(rule);assert.equal(saved.actions.length,3);assert.equal(saved.actions[1].config.soundActionId,saved.actions[0].id);assert.equal(saved.actions[2].config.actionIds[1],'external');assert.equal(rule.actions[1].config.soundActionId,'a');
 await context.deleteActionScenario(rule);assert.equal(removed,'original');
});

test('Box Cyber : 8 dispositions × 17 tailles × 2 modes, coordonnées et installations complètes',()=>{
 for(const cardPlacement of ['sides','bottom'])for(const cameraPlacement of ['top','bottom'])for(const rowOrder of ['help-first','trap-first'])for(const cardSize of Array.from({length:17},(_,i)=>80+i*5))for(const motion of ['animated','fixed']){
  const presentation=normalizeGamePackPresentation({cardPlacement,cameraPlacement,rowOrder,cardSize,motion},layout.PACK_ID),a=layout.geometry(presentation);
  for(const box of [a.camera,a.game,a.gifts]){assert.ok(box.x>=0&&box.y>=0);assert.ok(box.x+box.width<=1080&&box.y+box.height<=1920.001);}
  assert.ok(a.capacity>=2&&a.capacity<=6);
  const p={...plan,presentation};const obs=prepareCollection({name:'test',sources:[],groups:[],scene_order:[],resolution:{x:1080,y:1920}},p);
  const overlay=obs.document.sources.find(source=>source.settings?.url?.includes('game-pack.html'));assert.equal(overlay.settings.width,1080);assert.equal(overlay.settings.height,1920);
  const tiktok=prepareTikTok({SourceService:{state:{scenes:[],sceneSource:{},layerMap:{}}}},p);const sources=Object.values(tiktok.document.SourceService.state.sceneSource[tiktok.sceneId].data);
  const browser=sources.filter(source=>source.type==='browser');assert.equal(browser.length,2);for(const source of browser){assert.equal(source.payload.cy,1920);assert.equal(source.transform.size.cy,1920);assert.equal(source.transform.translateY,0);}
 }
 for(const packId of ['cult-of-the-lamb','euro-truck-simulator-2','gtav-hiking'])assert.equal(layout.normalize({cardPlacement:'sides'},packId),null);
});
