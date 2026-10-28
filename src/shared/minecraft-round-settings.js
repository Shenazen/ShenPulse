"use strict";
/** Shared defaults for the real Minecraft round, the editor and browser projections. */
(function(root,factory){
 if(typeof module!=="undefined"&&module.exports)module.exports=factory();
 else root.ShenPulseMinecraftRoundSettings=factory();
})(globalThis,()=>{
 const DEFAULT_MINECRAFT_ROUND_MINUTES=15;
 function normalizeMinecraftRoundSettings(value={}){
  const parsed=Number(value?.durationMinutes||DEFAULT_MINECRAFT_ROUND_MINUTES);
  return {
   durationMinutes:Math.max(1,Math.min(1440,Math.round(Number.isFinite(parsed)?parsed:DEFAULT_MINECRAFT_ROUND_MINUTES))),
   autoRestart:value?.autoRestart===true
  };
 }
 function normalizeGameRoundSettings(packId,value={}){const settings=normalizeMinecraftRoundSettings(value);if(['gtav-koth-enhanced','gtav-hiking-enhanced'].includes(packId)&&typeof value?.autoRestart!=='boolean')settings.autoRestart=true;if(packId==='gtav-hiking-enhanced'&&value?.durationMinutes==null)settings.durationMinutes=20;return settings;}
 return {DEFAULT_MINECRAFT_ROUND_MINUTES,normalizeMinecraftRoundSettings,normalizeGameRoundSettings};
});
