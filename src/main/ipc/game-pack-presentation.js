"use strict";
const {readState}=require("../state-projection");
const {assertProFeatureAccess}=require("../pro-feature-access");
const {notify}=require("./notifications");
const {PACK_ID,normalizeGamePackPresentation}=require("../../shared/game-pack-presentation");
function registerGamePackPresentationIpc({handle,core,store,requireGameAccess}) {
 handle("overlay:game-pack-presentation",(_event,incoming={})=>{
  assertProFeatureAccess(store,"games");requireGameAccess(PACK_ID);
  const current=readState(store,["session.profileId","settings.account.uid","settings.overlayConfigs"]).settings;
  const profileId=readState(store,["session.profileId"]).session.profileId;
  if(incoming.profileId!==profileId||incoming.accountUid!==(current.account?.uid||""))throw new Error("Le compte ou le profil a changé. Rouvrez les modèles de l’overlay.");
  const previous=current.overlayConfigs?.gameInteractionOverlays?.[PACK_ID]||{};
  const patch={};
  if(Object.hasOwn(incoming,"model")){if(![1,2,3].includes(Number(incoming.model)))throw new Error("Modèle inconnu.");patch.model=Number(incoming.model);}
  if(Object.hasOwn(incoming,"motion")){if(!["animated","fixed"].includes(incoming.motion))throw new Error("Mode invalide.");patch.motion=incoming.motion;}
  if(Object.hasOwn(incoming,"backgroundColor")){if(!/^#[0-9a-f]{6}$/i.test(incoming.backgroundColor))throw new Error("Couleur invalide.");patch.backgroundColor=incoming.backgroundColor;}
  const next=normalizeGamePackPresentation({...previous,...patch});delete next.configured;
  store.set("settings.overlayConfigs",{...current.overlayConfigs,gameInteractionOverlays:{...current.overlayConfigs?.gameInteractionOverlays,[PACK_ID]:{...previous,...next}}});
  notify(core,"state-changed",core.snapshot());return core.snapshot();
 });
}
module.exports={registerGamePackPresentationIpc};
