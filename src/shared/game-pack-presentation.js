"use strict";
const PACK_ID="supermarket-simulator";
const layout=require('../../resources/overlays/game-pack-layout');
function normalizeGamePackPresentation(value={},packId='') {
 const model=[1,2,3].includes(Number(value.model))?Number(value.model):1;
 return {model,motion:value.motion==="fixed"?"fixed":"animated",backgroundColor:/^#[0-9a-f]{6}$/i.test(String(value.backgroundColor||""))?value.backgroundColor:"#082b63",configured:["model","motion"].some(key=>Object.hasOwn(value,key)),...(layout.normalize(value,packId)||{})};
}
module.exports={PACK_ID,normalizeGamePackPresentation};
