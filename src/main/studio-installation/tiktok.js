"use strict";
const fs = require("node:fs"), path = require("node:path");
const { stableId, layout, overlayUrl, OVERLAY_VIEWPORT, tiktokOverlayTransform, readJson, writeJson } = require("./layout");
function ownsOverlay(source, plan) {
  try { const url = new URL(source.payload?.url); return source.type === "browser" && url.hostname === new URL(plan.overlayUrl).hostname && url.searchParams.get("jeu") === plan.packId && url.searchParams.get("profile") === plan.profileId; } catch { return false; }
}
function prepareTikTok(document, plan) {
  const doc = structuredClone(document), state = doc.SourceService?.state;
  if (!state || !Array.isArray(state.scenes) || !state.sceneSource || !state.layerMap) throw new Error("Ouvrez TikTok LIVE Studio une première fois pour initialiser les scènes.");
  const identity = stableId(plan.identity);
  let scene = state.scenes.find(s => s.id === identity) || state.scenes.find(s => s.orientation === "vertical" && Object.values(state.sceneSource[s.id]?.data || {}).some(source => ownsOverlay(source,plan)));
  if (!scene) { scene = { id: identity, name: plan.sceneName, orientation: "vertical", schemaVersion: 1, canvasInfo: { ratio: 0.6 }, isLocked: false, templateKey: "general", templateType: "general", theme: "Default" }; state.scenes.push(scene); }
  const existing = state.sceneSource[scene.id] || { data: {}, order: [], theme: "Default" };
  state.sceneSource[scene.id] = existing;
  const prior = Object.values(existing.data), all = Object.values(state.sceneSource).flatMap(entry => Object.values(entry.data || {}));
  const preview = prior.find(s => s.transform?.preview_cx)?.transform || { preview_cx: 675, preview_cy: 1200 };
  const areas = layout(preview.preview_cx, preview.preview_cy);
  const created = [];
  for (const [kind, type, title] of [["game","game",plan.gameName],["camera","camera","Caméra"],["overlay","browser","ShenPulse · Interactions"]]) {
    let source = prior.find(s => kind === "overlay" ? ownsOverlay(s, plan) : s.type === type);
    const fresh = !source;
    if (!source) {
      const template = kind === "camera" ? all.find(s => s.type === "camera" && s.payload?.deviceId) : null;
      source = template ? structuredClone(template) : {};
      source.id = stableId(plan.identity + ":" + kind); source.visualId = source.id; source.name = title; source.type = type;
      source.sourceId = template?.sourceId || String(BigInt("0x" + source.id.replaceAll("-", "").slice(0,16)) & ((1n << 63n) - 1n));
      Object.assign(source, { track: 0, lock: false, visible: true, clip: { x:0,y:0,z:0,w:0 }, effectiveClip:{x:0,y:0,z:0,w:0}, advancedFilters:[], alwaysTop:false, schemaVersion:1 });
      delete source.stateData;
    }
    if (kind === "overlay") {
      const placed = !fresh && source.transform?.size?.cx > 0 && source.transform?.size?.cy > 0;
      const url = new URL(placed ? plan.overlayUrl : overlayUrl(plan));
      if (placed) { const previous=new URL(source.payload.url);if(previous.searchParams.has("layout"))url.searchParams.set("layout",previous.searchParams.get("layout")); }
      source.payload = { ...(source.payload || {}), url:url.href, cx:placed ? source.payload.cx || 1080 : OVERLAY_VIEWPORT.width, cy:placed ? source.payload.cy || 1920 : OVERLAY_VIEWPORT.height, enableCustomResolution:true, enableAudio:false, zoom:source.payload?.zoom || 1 };
    }
    else if (kind === "game") source.payload = { ...(source.payload || {}), captureMethod:"custom", captureType:"None", exe:plan.executable, windowClass:"UnityWndClass", handle:0, pid:0, cursor:false, fpsLimit:true, gamecaptureImplVersion:2 };
    else source.payload ||= { deviceId:"", name:"Caméra", width:1920, height:1080, rate:30, audioDeviceID:"", audioDeviceName:"" };
    if (kind === "overlay" && (fresh || !source.transform?.size?.cx || !source.transform?.size?.cy)) source.transform = tiktokOverlayTransform(preview.preview_cx,preview.preview_cy);
    else if (fresh || !source.transform?.size?.cx || !source.transform?.size?.cy) {
      const size = kind === "game" ? {cx:1920,cy:1080} : {cx:Number(source.payload.width)||1920,cy:Number(source.payload.height)||1080};
      const area = areas[kind], scale = Math.min(area.width / size.cx, area.height / size.cy);
      source.transform = { translateX:area.x+(area.width-size.cx*scale)/2,translateY:area.y+(area.height-size.cy*scale)/2,rotateAngle:0,scaleX:scale,scaleY:scale,flipH:false,flipV:false,size,preview_cx:preview.preview_cx,preview_cy:preview.preview_cy,fixed_edge:1 };
    }
    existing.data[source.id] = source; created.push(source);
    state.layerMap.vertical ||= {}; const layers = state.layerMap.vertical[source.sourceId] ||= [];
    if (!layers.includes(source.id)) layers.push(source.id);
  }
  existing.order = [...existing.order.filter(id => !created.some(s => s.id === id)), ...created.map(s => s.id)];
  state.currentOrientation = "vertical"; state.currentOrientationNew = "vertical";
  state.currentScene = scene.id; state.currentSceneNew = scene.id; state.currentPreviewScene = scene.id;
  if (Array.isArray(state.lastScenes)) { const last=state.lastScenes.find(s=>s.orientation === "vertical"); if(last) last.id=scene.id; }
  return { document:doc, sceneId:scene.id, sceneName:scene.name, sources:created.map(s=>({id:s.id,name:s.name,type:s.type})) };
}
function installTikTok(target, plan) {
  const file = path.join(target.configRoot,"TTStore","services.json"), original = fs.readFileSync(file,"utf8");
  const result = prepareTikTok(readJson(file), plan);
  plan.assertScope();
  if (fs.readFileSync(file,"utf8") !== original) throw new Error("La configuration TikTok a changé. Fermez le studio et réessayez.");
  writeJson(file,result.document);
  return { sceneId:result.sceneId,sceneName:result.sceneName,sources:result.sources };
}
module.exports = { prepareTikTok, installTikTok };
