"use strict";
const crypto = require("node:crypto"), fs = require("node:fs"), path = require("node:path");
function stableId(value) { const h = crypto.createHash("sha256").update(String(value)).digest("hex").slice(0,32); return [h.slice(0,8),h.slice(8,12),"4"+h.slice(13,16),"a"+h.slice(17,20),h.slice(20)].join("-"); }
// Values captured from the approved TikTok scene. The native rendered size differs
// slightly from the requested browser viewport; keep both instead of fitting to full width.
const REFERENCE_CANVAS = Object.freeze({ width:675, height:1200 });
const OVERLAY_VIEWPORT = Object.freeze({ width:1080, height:665 });
const OVERLAY_RENDER_SIZE = Object.freeze({ width:1077, height:664 });
const OVERLAY_REFERENCE = Object.freeze({ x:64.06863403320312, y:763.6875, scaleX:0.5077648162841797, scaleY:0.5077648162841797 });
// Approved Hiking scene, captured after the user adjusted the source in LIVE Studio.
// The full HUD fits its useful 1280 px design area into this native browser viewport.
const WINS_VIEWPORT = Object.freeze({ width:1080, height:1019 });
const WINS_REFERENCE = Object.freeze({ x:0, y:78.39580535888672, scale:0.6201910376548767 });
function winsArea(overlay, game) {
  const referenceWidth=OVERLAY_RENDER_SIZE.width*OVERLAY_REFERENCE.scaleX,scale=overlay.width/referenceWidth;
  return {
    x:Math.max(0,overlay.x+(WINS_REFERENCE.x-OVERLAY_REFERENCE.x)*scale),
    y:Math.max(0,game.y+(WINS_REFERENCE.y-384)*scale),
    width:WINS_VIEWPORT.width*WINS_REFERENCE.scale*scale,
    height:WINS_VIEWPORT.height*WINS_REFERENCE.scale*scale
  };
}
function overlayUrl(plan) { const url=new URL(plan.overlayUrl);url.searchParams.set("layout","compact");return url.href; }
function referenceScale(width,height) { return Math.min(width/REFERENCE_CANVAS.width,height/REFERENCE_CANVAS.height); }
function tiktokOverlayTransform(width=675,height=1200) {
  const scale=referenceScale(width,height),offset=(width-REFERENCE_CANVAS.width*scale)/2;
  return {translateX:offset+OVERLAY_REFERENCE.x*scale,translateY:OVERLAY_REFERENCE.y*scale,rotateAngle:0,scaleX:OVERLAY_REFERENCE.scaleX*scale,scaleY:OVERLAY_REFERENCE.scaleY*scale,flipH:false,flipV:false,size:{cx:OVERLAY_RENDER_SIZE.width,cy:OVERLAY_RENDER_SIZE.height},preview_cx:width,preview_cy:height,fixed_edge:1};
}
function layout(width = 1080, height = 1920) {
  const scale = referenceScale(width,height), x = (width - REFERENCE_CANVAS.width * scale) / 2;
  const game={x,y:384*scale,width:675*scale,height:379.6875*scale};
  const overlay={x:x+OVERLAY_REFERENCE.x*scale,y:OVERLAY_REFERENCE.y*scale,width:OVERLAY_RENDER_SIZE.width*OVERLAY_REFERENCE.scaleX*scale,height:OVERLAY_RENDER_SIZE.height*OVERLAY_REFERENCE.scaleY*scale};
  return { width, height, wins:winsArea(overlay,game), camera: { x, y:0, width:675*scale, height:379.6875*scale }, game, overlay };
}
function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file,"utf8")); } catch (error) { if (error.code === "ENOENT") return fallback; throw new Error("Configuration du studio illisible : " + path.basename(file)); } }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + ".shenpulse-" + crypto.randomUUID() + ".tmp";
  if (fs.existsSync(file)) fs.copyFileSync(file, file + ".shenpulse-" + Date.now() + ".bak");
  try { fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { mode: 0o600, flag: "wx" }); fs.renameSync(temporary, file); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
module.exports = { stableId, layout, winsArea, overlayUrl, OVERLAY_VIEWPORT, OVERLAY_RENDER_SIZE, WINS_VIEWPORT, tiktokOverlayTransform, readJson, writeJson };
