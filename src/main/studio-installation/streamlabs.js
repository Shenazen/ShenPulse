"use strict";
const { StreamlabsRpc } = require("./rpc");
const { layout, OVERLAY_RENDER_SIZE } = require("./layout");
const { settings, sourceName } = require("./obs");
async function installStreamlabs(target,plan,client=new StreamlabsRpc()){
  await client.connect();
  try{
    const scenes=await client.call("ScenesService","getScenes"),streaming=await client.call("StreamingService","isStreaming");
    const recording=await client.call("StreamingService","isRecording"),active=streaming===true||recording===true;
    let scene=scenes.find(s=>s.name===plan.sceneName);
    if(scene&&active&&(await client.call("ScenesService","activeSceneId"))===scene.id)throw new Error("Cette scène est en LIVE. Réessayez après la diffusion pour la modifier.");
    plan.assertScope();if(!scene)scene=await client.call("ScenesService","createScene",plan.sceneName);
    if(!scene?.resourceId)throw new Error("Streamlabs n’a pas confirmé la scène.");
    const video=await client.call("VideoSettingsService","baseResolution"),area=layout(Number(video.baseWidth)||1920,Number(video.baseHeight)||1080);
    const sources=await client.call("SourcesService","getSources"),items=await client.call(scene.resourceId,"getItems"),created=[];
    for(const kind of (plan.overlayOnly?["wins"]:[...["game","camera","overlay"],...(plan.winsOverlayUrl?["wins"]:[])])){
      plan.assertScope();const name=sourceName(plan,kind);let source=sources.find(s=>s.name===name);
      if(kind==="camera"&&!source)source=sources.find(s=>s.type==="dshow_input");
      let item=source?items.find(s=>s.sourceId===source.sourceId):null;
      if(!source){item=await client.call(scene.resourceId,"createAndAddSource",name,{game:"game_capture",camera:"dshow_input",overlay:"browser_source",wins:"browser_source"}[kind],settings(plan,kind),{select:false});source={sourceId:item.sourceId,width:kind==="wins"?1080:kind==="overlay"?OVERLAY_RENDER_SIZE.width:1920,height:kind==="wins"?1920:kind==="overlay"?OVERLAY_RENDER_SIZE.height:1080};}
      else {if(kind!=="camera")await client.call(source.resourceId,"updateSettings",settings(plan,kind));if(!item)item=await client.call(scene.resourceId,"addSource",source.sourceId,{select:false});}
      if(!item?.resourceId)throw new Error("Streamlabs n’a pas confirmé une source.");
      const width=kind==="wins"?1080:kind==="overlay"?OVERLAY_RENDER_SIZE.width:Number(source.width)||1920,height=kind==="wins"?1920:kind==="overlay"?OVERLAY_RENDER_SIZE.height:Number(source.height)||1080,box=area[kind],scale=Math.min(box.width/width,box.height/height);
      await client.call(item.resourceId,"setTransform",{position:{x:box.x+(box.width-width*scale)/2,y:box.y+(box.height-height*scale)/2},scale:{x:scale,y:scale},rotation:0});
      await client.call(item.resourceId,"setVisibility",true);created.push(item.sourceId);
    }
    const verified=await client.call(scene.resourceId,"getItems");if(!created.every(id=>verified.some(item=>item.sourceId===id)))throw new Error("Streamlabs n’a pas confirmé toutes les sources.");
    if(!active)await client.call("ScenesService","makeSceneActive",scene.id);
    return {sceneName:scene.name,sources:created};
  }finally{client.close();}
}
module.exports={installStreamlabs};
