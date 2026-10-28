"use strict";
const fs = require("node:fs"), path = require("node:path");
const { stableId, layout, overlayUrl, OVERLAY_RENDER_SIZE, readJson, writeJson } = require("./layout");
const { ObsRpc } = require("./rpc");
const { prepareObsProfile } = require("./obs-profile");
function settings(plan, kind) {
  if(kind === "wins") return { url:plan.winsOverlayUrl,width:1080,height:1920,reroute_audio:false,shutdown:false,restart_when_active:false,fps:30 };
  if(kind === "overlay") return { url:overlayUrl(plan),width:OVERLAY_RENDER_SIZE.width,height:OVERLAY_RENDER_SIZE.height,reroute_audio:false,shutdown:false,restart_when_active:false,fps:30 };
  if(kind === "game") return { capture_mode:"window",window:plan.gameName+":"+(plan.windowClass ?? "UnityWndClass")+":"+plan.executable,priority:1,capture_cursor:false,limit_framerate:true };
  return {};
}
function sourceName(plan,kind){return "ShenPulse · "+({camera:"Caméra",game:plan.gameName,overlay:"Interactions",wins:"Wins"}[kind])+" · "+stableId(plan.identity).slice(0,8);}
function prepareCollection(original, plan, camera = {}) {
  const doc = original ? structuredClone(original) : { name:plan.sceneName,sources:[],groups:[],scene_order:[],current_transition:"Fondu",transition_duration:300,transitions:[],quick_transitions:[],resolution:{x:1920,y:1080},version:2 };
  doc.version=1;
  const area = layout(Number(doc.resolution?.x)||1920,Number(doc.resolution?.y)||1080);
  const sceneId = stableId(plan.identity+":scene"); let scene=doc.sources.find(s=>s.uuid===sceneId);
  if(!scene){scene={id:"scene",versioned_id:"scene",uuid:sceneId,name:plan.sceneName,settings:{id_counter:3,custom_size:false,items:[]},mixers:0,enabled:true,private_settings:{}};doc.sources.push(scene);doc.scene_order.push({name:scene.name});}
  const owned=[];
  for(const [index,kind] of (plan.overlayOnly?["wins"]:[...["game","camera","overlay"],...(plan.winsOverlayUrl?["wins"]:[])]).entries()){
    const uuid=stableId(plan.identity+":"+kind),name=sourceName(plan,kind);let input=doc.sources.find(s=>s.uuid===uuid);
    if(!input){const id={game:"game_capture",camera:"dshow_input",overlay:"browser_source",wins:"browser_source"}[kind];input={id,versioned_id:id,uuid,name,settings:kind==="camera"?structuredClone(camera):settings(plan,kind),mixers:0,sync:0,flags:0,volume:1,enabled:true,muted:kind!=="game",private_settings:{}};doc.sources.push(input);}else if(kind!=="camera")input.settings={...input.settings,...settings(plan,kind)};
    let item=scene.settings.items.find(s=>s.source_uuid===uuid);if(!item){item={name:input.name,source_uuid:uuid,id:Math.max(0,...scene.settings.items.map(s=>Number(s.id)||0))+1,visible:true,locked:false,rot:0,align:5,bounds_type:2,bounds_align:0,crop_left:0,crop_top:0,crop_right:0,crop_bottom:0,scale:{x:1,y:1},private_settings:{}};scene.settings.items.push(item);}
    Object.assign(item,{pos:{x:area[kind].x,y:area[kind].y},bounds:{x:area[kind].width,y:area[kind].height},scale_ref:{x:area.width,y:area.height}});owned.push(input.name);
  }
  scene.settings.items=[...scene.settings.items.filter(i=>!owned.includes(i.name)),...owned.map(n=>scene.settings.items.find(i=>i.name===n))];
  scene.settings.id_counter=Math.max(Number(scene.settings.id_counter)||0,...scene.settings.items.map(s=>Number(s.id)||0));
  doc.current_scene=scene.name;doc.current_program_scene=scene.name;return {document:doc,sceneName:scene.name,sceneId,sources:owned};
}
function installObsOffline(target,plan){
  const folder=path.join(target.configRoot,"basic","scenes"),file=path.join(folder,"ShenPulse_"+stableId(plan.identity).slice(0,12)+".json");
  let templates=[];try{templates=fs.readdirSync(folder).filter(n=>n.endsWith(".json")).slice(0,50).map(n=>readJson(path.join(folder,n))).filter(Boolean);}catch(error){if(error.code!=="ENOENT")throw error;}
  const base=templates.find(d=>d.resolution),camera=templates.flatMap(d=>d.sources||[]).find(s=>s.id==="dshow_input")?.settings||{};
  const original=readJson(file)||{name:plan.sceneName,sources:[],groups:[],scene_order:[],current_transition:"Fondu",transition_duration:300,transitions:[],quick_transitions:[],resolution:base?.resolution||{x:1920,y:1080},version:2};
  if(base)for(const key of Object.keys(base).filter(k=>/^(DesktopAudioDevice|AuxAudioDevice)/.test(k)))if(!original[key]&&["wasapi_input_capture","wasapi_output_capture"].includes(base[key]?.id))original[key]=base[key];
  original.name="ShenPulse Supermarket "+stableId(plan.identity).slice(0,8);
  original.resolution={x:1080,y:1920};
  const result=prepareCollection(original,plan,camera);plan.assertScope();
  const profileName=prepareObsProfile(target.configRoot,stableId(plan.identity).slice(0,8));writeJson(file,result.document);
  return {...result,document:undefined,launchArgs:["--profile",profileName,"--collection",result.document.name]};
}
async function installObsOnline(target,plan,client=new ObsRpc()){
  await client.connect(readJson(path.join(target.configRoot,"plugin_config","obs-websocket","config.json"),{}));
  try{
    const scenes=await client.call("GetSceneList"),stream=await client.call("GetStreamStatus");
    const recording=await client.call("GetRecordStatus"); const active=stream.outputActive||recording.outputActive;
    const exists=scenes.scenes.some(s=>s.sceneName===plan.sceneName);
    if(exists&&active&&scenes.currentProgramSceneName===plan.sceneName)throw new Error("Cette scène est en LIVE. Réessayez après la diffusion pour la modifier.");
    plan.assertScope();if(!exists)await client.call("CreateScene",{sceneName:plan.sceneName});
    const video=await client.call("GetVideoSettings"),area=layout(video.baseWidth,video.baseHeight);
    const inputs=(await client.call("GetInputList")).inputs,items=(await client.call("GetSceneItemList",{sceneName:plan.sceneName})).sceneItems;const names=[];
    for(const [index,kind] of (plan.overlayOnly?["wins"]:[...["game","camera","overlay"],...(plan.winsOverlayUrl?["wins"]:[])]).entries()){
      plan.assertScope();let name=sourceName(plan,kind),input=inputs.find(s=>s.inputName===name);
      if(kind==="camera"&&!input){const reusable=inputs.find(s=>s.inputKind==="dshow_input");if(reusable){input=reusable;name=reusable.inputName;}}
      let item=items.find(s=>s.sourceName===name),id=item?.sceneItemId;
      if(!input){const created=await client.call("CreateInput",{sceneName:plan.sceneName,inputName:name,inputKind:{game:"game_capture",camera:"dshow_input",overlay:"browser_source",wins:"browser_source"}[kind],inputSettings:settings(plan,kind),sceneItemEnabled:true});id=created.sceneItemId;
        if(kind==="camera"){const list=await client.call("GetInputPropertiesListPropertyItems",{inputName:name,propertyName:"video_device_id"});const device=list.propertyItems?.find(s=>s.itemEnabled!==false&&s.itemValue);if(device)await client.call("SetInputSettings",{inputName:name,inputSettings:{video_device_id:device.itemValue},overlay:true});}
      }else{if(kind!=="camera")await client.call("SetInputSettings",{inputName:name,inputSettings:settings(plan,kind),overlay:true});if(id===undefined)id=(await client.call("CreateSceneItem",{sceneName:plan.sceneName,sourceName:name,sceneItemEnabled:true})).sceneItemId;}
      await client.call("SetSceneItemTransform",{sceneName:plan.sceneName,sceneItemId:id,sceneItemTransform:{positionX:area[kind].x,positionY:area[kind].y,alignment:5,boundsType:"OBS_BOUNDS_SCALE_INNER",boundsAlignment:0,boundsWidth:area[kind].width,boundsHeight:area[kind].height}});
      await client.call("SetSceneItemIndex",{sceneName:plan.sceneName,sceneItemId:id,sceneItemIndex:plan.overlayOnly?Math.max(0,items.length-(item?1:0)):index});names.push(name);
    }
    if(!active)await client.call("SetCurrentProgramScene",{sceneName:plan.sceneName});
    const verified=(await client.call("GetSceneItemList",{sceneName:plan.sceneName})).sceneItems;
    if(!names.every(name=>verified.some(s=>s.sourceName===name)))throw new Error("OBS n’a pas confirmé toutes les sources.");
    return {sceneName:plan.sceneName,sources:names};
  }finally{client.close();}
}
module.exports={settings,sourceName,prepareCollection,installObsOffline,installObsOnline};
