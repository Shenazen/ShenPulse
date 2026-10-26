"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {discover}=require("../src/main/studio-installation/discovery");
const {prepareTikTok}=require("../src/main/studio-installation/tiktok");
const {prepareCollection,installObsOnline}=require("../src/main/studio-installation/obs");
const {layout,stableId,overlayUrl,OVERLAY_VIEWPORT,OVERLAY_RENDER_SIZE}=require("../src/main/studio-installation/layout");
const {StudioInstallationService}=require("../src/main/studio-installation/service");
const plan={identity:"account:profile:supermarket",packId:"supermarket-simulator",profileId:"profile",gameName:"Supermarket Simulator",sceneName:"Supermarket · ShenPulse",executable:"Supermarket Simulator.exe",overlayUrl:"https://overlay.test/game-pack.html?jeu=supermarket-simulator&profile=profile",assertScope(){}};
function tiktokFixture() {
 return {
  AccountService:{state:{keep:"private-auth"}}, OtherService:{state:{keep:4}},
  SourceService:{version:1,state:{
   scenes:[{id:"other",name:"Ma scène",orientation:"vertical"}],
   sceneSource:{other:{data:{cam:{id:"cam",visualId:"cam",type:"camera",sourceId:"1",name:"Caméra existante",payload:{deviceId:"my-local-device",width:1920,height:1080},transform:{preview_cx:675,preview_cy:1200}}},order:["cam"]}},
   layerMap:{vertical:{"1":["cam"]}},lastScenes:[{id:"other",orientation:"vertical"}]
  }}
 };
}
test("la détection exige un véritable exécutable et distingue un dossier vide d’un logiciel installé",t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"shenpulse-studios-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,"TikTok LIVE Studio","1.2.3"),{recursive:true});fs.writeFileSync(path.join(root,"TikTok LIVE Studio","1.2.3","TikTok LIVE Studio.exe"),"");fs.mkdirSync(path.join(root,"Streamlabs OBS"));
 const rows=discover({ProgramFiles:root,APPDATA:root});assert.equal(rows.find(s=>s.id==="tiktok").installed,true);assert.equal(rows.find(s=>s.id==="streamlabs").installed,false);assert.equal(rows.find(s=>s.id==="obs").installed,false);
});
test("TikTok : scène et trois sources adaptées, caméra locale réutilisée, comptes et autres scènes inchangés",()=>{
 const original=tiktokFixture(),first=prepareTikTok(original,plan),state=first.document.SourceService.state;
 assert.equal(state.scenes.length,2);assert.equal(first.sources.length,3);assert.deepEqual(first.document.AccountService,original.AccountService);assert.deepEqual(first.document.OtherService,original.OtherService);assert.deepEqual(state.sceneSource.other,original.SourceService.state.sceneSource.other);
 const sources=Object.values(state.sceneSource[first.sceneId].data),cam=sources.find(s=>s.type==="camera"),overlay=sources.find(s=>s.type==="browser"),game=sources.find(s=>s.type==="game");
 assert.equal(cam.payload.deviceId,"my-local-device");assert.equal(game.payload.exe,plan.executable);assert.equal(overlay.payload.url,overlayUrl(plan));assert.equal(overlay.payload.enableAudio,false);assert.deepEqual(overlay.transform,require("./fixtures/studio-supermarket-reference.json").transform);
 const second=prepareTikTok(first.document,plan);assert.equal(second.document.SourceService.state.scenes.length,2);assert.deepEqual(second.sources,first.sources);assert.equal(second.document.SourceService.state.layerMap.vertical["1"].length,2);
});
test("TikTok adopte uniquement sa propre scène et ne modifie pas celle d’un autre profil",()=>{
 const original=tiktokFixture(),first=prepareTikTok(original,plan);const second=prepareTikTok(first.document,{...plan,identity:"another-profile",profileId:"another",overlayUrl:plan.overlayUrl.replace("profile=profile","profile=another")});
 assert.equal(second.document.SourceService.state.scenes.length,3);assert.deepEqual(second.document.SourceService.state.sceneSource[first.sceneId],first.document.SourceService.state.sceneSource[first.sceneId]);
});
test("OBS : collection idempotente, trois sources ordonnées et cadre portrait adapté au canevas existant",()=>{
 const first=prepareCollection(null,plan,{video_device_id:"my-camera"});const scene=first.document.sources.find(s=>s.id==="scene");assert.equal(scene.settings.items.length,3);assert.deepEqual(scene.settings.items.map(i=>first.document.sources.find(s=>s.uuid===i.source_uuid).id),["game_capture","dshow_input","browser_source"]);
 assert.equal(first.document.sources.find(s=>s.id==="browser_source").settings.url,overlayUrl(plan));assert.equal(first.document.sources.find(s=>s.id==="dshow_input").settings.video_device_id,"my-camera");
 const second=prepareCollection(first.document,plan);assert.equal(second.document.sources.length,4);assert.equal(second.document.scene_order.length,1);assert.equal(second.document.sources.find(s=>s.id==="scene").settings.items.length,3);
 const a=layout(1920,1080);assert.equal(a.overlay.height,664*0.5077648162841797*(1080/1200));assert.ok(a.game.y+a.game.height<=a.overlay.y);assert.ok(a.overlay.y+a.overlay.height<1080);assert.ok(a.overlay.x>0);assert.ok(a.camera.y+a.camera.height<=a.game.y);assert.equal(stableId("same"),stableId("same"));
});
function serviceFixture(){let profileId="profile",accountId="account",checks=0;const state=()=>({settings:{account:{uid:accountId}},session:{profileId},profiles:[{id:profileId,name:"Mon profil"}]});const target={id:"tiktok",name:"TikTok LIVE Studio",process:"TikTok LIVE Studio.exe",installed:true,configRoot:path.join(os.tmpdir(),"not-a-studio"),executable:"studio.exe"};const core={snapshot:()=>({state:state(),packs:[{id:"supermarket-simulator",name:"Supermarket Simulator"}],overlayUrls:{gamePack:"https://overlay.test/game-pack.html?channel=abc"}})};return {state,target,core,store:{getState:state},requireGameAccess:id=>{assert.equal(id,"supermarket-simulator");checks++;},setProfile:id=>{profileId=id;},setAccount:id=>{accountId=id;},checks:()=>checks};}
test("un studio ouvert ne reçoit aucune écriture hors API et un logiciel absent reste indisponible",async()=>{
 const f=serviceFixture();let writes=0;const service=new StudioInstallationService({...f,discoverImpl:()=>[f.target],runningImpl:async()=>true,adapters:{tiktok:()=>{writes++;}}});
 const result=await service.install({studioId:"tiktok",profileId:"profile"});assert.equal(result.status,"needs-close");assert.equal(writes,0);assert.ok(f.checks()>0);
 f.target.installed=false;await assert.rejects(service.install({studioId:"tiktok",profileId:"profile"}),/pas installé/);await assert.rejects(service.install({studioId:"unknown",profileId:"profile"}),/inconnu/);
});
test("le profil et le compte sont vérifiés avant l’écriture et le studio n’est pas lancé avec un mauvais profil",async()=>{
 const f=serviceFixture();f.target.id="obs";let launch=0,received;
 const service=new StudioInstallationService({...f,discoverImpl:()=>[f.target],runningImpl:async()=>false,launchImpl:async()=>{launch++;},adapters:{obsOffline:(_target,plan)=>{received=plan;plan.assertScope();return {sceneName:plan.sceneName,sources:[1,2,3],launchArgs:[]};}}});
 const result=await service.install({studioId:"obs",profileId:"profile"});assert.equal(result.status,"installed");assert.equal(launch,1);assert.equal(new URL(received.overlayUrl).searchParams.get("profile"),"profile");
 f.setProfile("different");await assert.rejects(service.install({studioId:"obs",profileId:"profile"}),/profil a changé/);assert.equal(launch,1);
 f.setProfile("profile");f.setAccount("different-account");assert.throws(received.assertScope,/compte ou le profil/);
});

test("le profil OBS portrait est isolé et ne modifie ni le profil original ni ses réglages de diffusion",t=>{
 const {prepareObsProfile,value}=require("../src/main/studio-installation/obs-profile");
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"shenpulse-obs-profile-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const base=path.join(root,"basic/profiles/Original");fs.mkdirSync(base,{recursive:true});fs.writeFileSync(path.join(root,"user.ini"),"[Basic]\nProfileDir=Original\n");
 const initial="[General]\nName=Original\n[Video]\nBaseCX=1920\nBaseCY=1080\n[Output]\nMode=Simple\n";fs.writeFileSync(path.join(base,"basic.ini"),initial);fs.writeFileSync(path.join(base,"service.json"),JSON.stringify({settings:{key:"private-original"}}));
 const name=prepareObsProfile(root,"test1234"),target=path.join(root,"basic/profiles/ShenPulse_test1234");const current=fs.readFileSync(path.join(target,"basic.ini"),"utf8");assert.equal(name,"ShenPulse Supermarket test1234");assert.equal(value(current,"Video","BaseCX"),"1080");assert.equal(value(current,"Video","BaseCY"),"1920");assert.equal(value(current,"Output","Mode"),"Simple");assert.equal(fs.readFileSync(path.join(base,"basic.ini"),"utf8"),initial);assert.equal(fs.readFileSync(path.join(target,"service.json"),"utf8"),fs.readFileSync(path.join(base,"service.json"),"utf8"));
});
test("Streamlabs crée et vérifie les trois sources par son API locale, sans doublon ni déclenchement de LIVE",async()=>{
 const {installStreamlabs}=require("../src/main/studio-installation/streamlabs");let scene=null;const sources=[],items=[],calls=[],transforms=[];let id=0;
 const client={connect:async()=>{},close(){},call:async(resource,method,...args)=>{
  calls.push(method);
  if(method==="isStreaming"||method==="isRecording")return false;
  if(method==="getScenes")return scene?[scene]:[];
  if(method==="createScene"){scene={id:"scene",name:args[0],resourceId:"Scene[scene]"};return scene;}
  if(method==="baseResolution")return {baseWidth:1080,baseHeight:1920};
  if(method==="getSources")return sources;
  if(method==="getItems")return items;
  if(method==="createAndAddSource"){const sourceId=String(++id),source={sourceId,name:args[0],type:args[1],resourceId:"Source["+sourceId+"]",width:args[1]==="browser_source"?args[2].width:1920,height:args[1]==="browser_source"?args[2].height:1080};sources.push(source);const item={sourceId,resourceId:"SceneItem["+sourceId+"]"};items.push(item);return item;}
  if(method==="setTransform")transforms.push({item:resource,...args[0]});
  if(["setTransform","setVisibility","makeSceneActive","updateSettings"].includes(method))return;
  throw Error("Unexpected API method "+resource+" "+method);
 }};
 await installStreamlabs({},plan,client);await installStreamlabs({},plan,client);assert.equal(sources.length,3);assert.equal(items.length,3);assert.equal(calls.filter(s=>s==="createScene").length,1);assert.ok(calls.includes("setTransform"));assert.equal(calls.includes("startStreaming"),false);
 const measured=require("./fixtures/studio-supermarket-reference.json").transform,placed=transforms[2];assert.deepEqual(placed.position,{x:measured.translateX*1.6,y:measured.translateY*1.6});assert.deepEqual(placed.scale,{x:measured.scaleX*1.6,y:measured.scaleY*1.6});assert.deepEqual(transforms[5],placed);
});


test("OBS en ligne réutilise la caméra et les trois sources sans démarrer de LIVE ni toucher aux autres scènes",async()=>{
 let sceneExists=false;const inputs=[{inputName:"Ma caméra locale",inputKind:"dshow_input"}],items=[],calls=[];let sequence=0,closed=0;
 const client={connect:async()=>{},close(){closed++;},call:async(method,args={})=>{
  calls.push({method,args});
  if(method==="GetSceneList")return {scenes:sceneExists?[{sceneName:plan.sceneName}]:[],currentProgramSceneName:"Ma scène habituelle"};
  if(method==="GetStreamStatus"||method==="GetRecordStatus")return {outputActive:false};
  if(method==="CreateScene"){sceneExists=true;return {};}
  if(method==="GetVideoSettings")return {baseWidth:1080,baseHeight:1920};
  if(method==="GetInputList")return {inputs:structuredClone(inputs)};
  if(method==="GetSceneItemList")return {sceneItems:structuredClone(items)};
  if(method==="CreateInput"){inputs.push({inputName:args.inputName,inputKind:args.inputKind});const sceneItemId=++sequence;items.push({sceneItemId,sourceName:args.inputName});return {sceneItemId};}
  if(method==="CreateSceneItem"){const sceneItemId=++sequence;items.push({sceneItemId,sourceName:args.sourceName});return {sceneItemId};}
  if(["SetInputSettings","SetSceneItemTransform","SetSceneItemIndex","SetCurrentProgramScene"].includes(method))return {};
  throw Error("Unexpected OBS method "+method);
 }};
 await installObsOnline({configRoot:os.tmpdir()},plan,client);await installObsOnline({configRoot:os.tmpdir()},plan,client);
 assert.equal(items.length,3);assert.equal(inputs.length,3);assert.equal(calls.filter(c=>c.method==="CreateScene").length,1);assert.equal(closed,2);
 assert.ok(items.some(i=>i.sourceName==="Ma caméra locale"));assert.equal(calls.some(c=>c.method==="SetInputSettings"&&c.args.inputName==="Ma caméra locale"),false);
 assert.ok(calls.filter(c=>c.method==="SetSceneItemTransform").every(c=>c.args.sceneName===plan.sceneName));
 assert.equal(calls.some(c=>/StartStream|StartRecord|SetVideoSettings/.test(c.method)),false);
 const measured=require("./fixtures/studio-supermarket-reference.json").transform,browserCall=calls.find(c=>c.method==="CreateInput"&&c.args.inputKind==="browser_source"),browserItem=items.find(i=>i.sourceName===browserCall.args.inputName),placed=calls.filter(c=>c.method==="SetSceneItemTransform"&&c.args.sceneItemId===browserItem.sceneItemId);assert.equal(browserCall.args.inputSettings.width,measured.size.cx);assert.equal(browserCall.args.inputSettings.height,measured.size.cy);assert.ok(placed.every(c=>c.args.sceneItemTransform.positionX===measured.translateX*1.6&&c.args.sceneItemTransform.positionY===measured.translateY*1.6&&c.args.sceneItemTransform.boundsWidth===measured.size.cx*measured.scaleX*1.6&&c.args.sceneItemTransform.boundsHeight===measured.size.cy*measured.scaleY*1.6));
});

test("OBS et Streamlabs refusent de modifier leur scène actuellement diffusée",async()=>{
 const {installStreamlabs}=require("../src/main/studio-installation/streamlabs");
 for(const studio of ["obs","streamlabs"]){const methods=[];let closed=false;const client={connect:async()=>{},close(){closed=true;},call:async(resource,method)=>{
  const name=studio==="obs"?resource:method;methods.push(name);
  if(name==="GetSceneList")return {scenes:[{sceneName:plan.sceneName}],currentProgramSceneName:plan.sceneName};
  if(name==="GetStreamStatus"||name==="GetRecordStatus")return {outputActive:true};
  if(name==="getScenes")return [{name:plan.sceneName,id:"live-scene",resourceId:"Scene[live-scene]"}];
  if(name==="isStreaming"||name==="isRecording")return true;
  if(name==="activeSceneId")return "live-scene";
  throw Error("Unexpected write: "+name);
 }};
 await assert.rejects((studio==="obs"?installObsOnline:installStreamlabs)({configRoot:os.tmpdir()},plan,client),/en LIVE/);
 assert.equal(closed,true);assert.ok(methods.every(name=>/^(Get|get|is|active)/.test(name)));
 }
});


test("TikTok conserve le cadrage, le zoom et les découpes personnalisés lors d’une réinstallation",()=>{
 const first=prepareTikTok(tiktokFixture(),plan),scene=first.document.SourceService.state.sceneSource[first.sceneId];
 for(const source of Object.values(scene.data)){source.lock=true;source.clip={x:3,y:4,z:5,w:6};source.effectiveClip={x:3,y:4,z:5,w:6};}
 const overlay=Object.values(scene.data).find(s=>s.type==="browser");
 overlay.payload.url=plan.overlayUrl;overlay.payload.cx=1080;overlay.payload.cy=1920;overlay.payload.zoom=1.25;
 overlay.transform={translateX:-183.35629272460938,translateY:136.5625,rotateAngle:0,scaleX:0.964548647403717,scaleY:0.964548647403717,flipH:false,flipV:false,size:{cx:1080,cy:1019},preview_cx:675,preview_cy:1200,fixed_edge:1};
 const before=structuredClone(scene),updated={...plan,overlayUrl:plan.overlayUrl+"&channel=new-channel&motion=fixed"};
 const second=prepareTikTok(first.document,updated).document.SourceService.state.sceneSource[first.sceneId];
 for(const source of Object.values(second.data)){assert.deepEqual(source.transform,before.data[source.id].transform);assert.deepEqual(source.clip,before.data[source.id].clip);assert.equal(source.lock,true);}
 const saved=Object.values(second.data).find(s=>s.type==="browser");assert.equal(saved.payload.url,updated.overlayUrl);assert.equal(saved.payload.cx,1080);assert.equal(saved.payload.cy,1920);assert.equal(saved.payload.zoom,1.25);
});

test("les nouvelles scènes partagent les trois zones de référence et un overlay compact sans chevauchement",()=>{
 const tiktok=prepareTikTok(tiktokFixture(),plan),data=tiktok.document.SourceService.state.sceneSource[tiktok.sceneId].data;
 const overlay=Object.values(data).find(s=>s.type==="browser"),camera=Object.values(data).find(s=>s.type==="camera"),game=Object.values(data).find(s=>s.type==="game");
 assert.equal(camera.transform.translateY,0);assert.equal(game.transform.translateY,384);assert.deepEqual(overlay.transform,require("./fixtures/studio-supermarket-reference.json").transform);assert.equal(new URL(overlay.payload.url).searchParams.get("layout"),"compact");
 const obs=prepareCollection({name:"Reference",sources:[],groups:[],scene_order:[],resolution:{x:1080,y:1920}},plan),browser=obs.document.sources.find(s=>s.id==="browser_source"),scene=obs.document.sources.find(s=>s.id==="scene");
 assert.equal(browser.settings.width,OVERLAY_RENDER_SIZE.width);assert.equal(browser.settings.height,OVERLAY_RENDER_SIZE.height);
 const item=scene.settings.items.find(s=>s.source_uuid===browser.uuid);const measured=require("./fixtures/studio-supermarket-reference.json").transform;assert.equal(item.pos.x,measured.translateX*1.6);assert.equal(item.pos.y,measured.translateY*1.6);assert.deepEqual(item.bounds,{x:measured.size.cx*measured.scaleX*1.6,y:measured.size.cy*measured.scaleY*1.6});
 for(const [width,height] of [[1080,1920],[720,1280],[1920,1080]]){const zone=layout(width,height);assert.ok(zone.camera.y+zone.camera.height<=zone.game.y);assert.ok(zone.game.y+zone.game.height<=zone.overlay.y);assert.ok(zone.overlay.y+zone.overlay.height<=height);assert.ok(zone.overlay.x>=0);}
});

test("une scène installée reste confirmée si le studio refuse le lancement automatique",async()=>{
 for(const studioId of ["tiktok","obs"]){
  const f=serviceFixture();f.target.id=studioId;f.target.configRoot=os.tmpdir();let writes=0;
  const adapter=()=>{writes++;return {sceneName:plan.sceneName,sources:["game","camera","overlay"]};};
  const service=new StudioInstallationService({...f,discoverImpl:()=>[f.target],runningImpl:async()=>false,launchImpl:async()=>{throw Error("EACCES: launch refused");},adapters:{tiktok:adapter,obsOffline:adapter}});
  // TikTok requires an initialized local store before installing; use an isolated one.
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),"shenpulse-studio-launch-"));
  try{f.target.configRoot=directory;fs.mkdirSync(path.join(directory,"TTStore"));fs.writeFileSync(path.join(directory,"TTStore/services.json"),"{}");
   const result=await service.install({studioId,profileId:"profile"});assert.equal(writes,1);assert.equal(result.status,"installed");assert.equal(result.opening,"manual");assert.match(result.openingMessage,/scène est installée/);assert.match(result.openingMessage,/ouvrir/);assert.equal(result.openingMessage.includes("EACCES"),false);
  }finally{assert.ok(path.basename(directory).startsWith("shenpulse-studio-launch-"));fs.rmSync(directory,{recursive:true,force:true});}
 }
});

test("un échec d’installation reste une erreur et ne lance pas le studio",async()=>{
 const f=serviceFixture();f.target.id="obs";let launches=0;
 const service=new StudioInstallationService({...f,discoverImpl:()=>[f.target],runningImpl:async()=>false,launchImpl:async()=>{launches++;},adapters:{obsOffline:()=>{throw Error("Écriture impossible");}}});
 await assert.rejects(service.install({studioId:"obs",profileId:"profile"}),/Écriture impossible/);assert.equal(launches,0);
});

test("un studio non initialisé peut être ouvert manuellement sans fausse confirmation d’installation",async()=>{
 const f=serviceFixture();const service=new StudioInstallationService({...f,discoverImpl:()=>[f.target],runningImpl:async()=>false,launchImpl:async()=>{throw Error("Launch denied");}});
 const result=await service.install({studioId:"tiktok",profileId:"profile"});assert.equal(result.status,"needs-setup");assert.match(result.message,/Ouvrez TikTok/);assert.equal(result.sceneName,undefined);
 f.target.id="streamlabs";const other=await service.install({studioId:"streamlabs",profileId:"profile"});assert.equal(other.status,"needs-open");assert.match(other.message,/Ouvrez Streamlabs/);assert.equal(other.sceneName,undefined);
});
