"use strict";
const {readState}=require("../state-projection");
const {assertProFeatureAccess}=require("../pro-feature-access");
const {notify}=require("./notifications");
const {PACK_ID,normalizeGamePackPresentation}=require("../../shared/game-pack-presentation");
function registerGamePackPresentationIpc({handle,core,store,requireGameAccess}) {
 handle("overlay:game-pack-presentation",(_event,incoming={})=>{
  assertProFeatureAccess(store,"games");
  const packId=String(incoming.packId||PACK_ID);requireGameAccess(packId);
  const current=readState(store,["session.profileId","settings.account.uid","settings.overlayConfigs"]).settings;
  const profileId=readState(store,["session.profileId"]).session.profileId;
  if(incoming.profileId!==profileId||incoming.accountUid!==(current.account?.uid||""))throw new Error("Le compte ou le profil a changé. Rouvrez les modèles de l’overlay.");
  const previous=current.overlayConfigs?.gameInteractionOverlays?.[packId]||{};
  const patch={};
  if(Object.hasOwn(incoming,"model")){if(![1,2,3].includes(Number(incoming.model)))throw new Error("Modèle inconnu.");patch.model=Number(incoming.model);}
  if(Object.hasOwn(incoming,"motion")){if(!["animated","fixed"].includes(incoming.motion))throw new Error("Mode invalide.");patch.motion=incoming.motion;}
  if(Object.hasOwn(incoming,"backgroundColor")){if(!/^#[0-9a-f]{6}$/i.test(incoming.backgroundColor))throw new Error("Couleur invalide.");patch.backgroundColor=incoming.backgroundColor;}
  if(require('../../../resources/overlays/game-pack-layout').supports(packId)){
   for(const [key,values] of Object.entries({cardPlacement:['sides','bottom'],cameraPlacement:['top','bottom'],rowOrder:['help-first','trap-first']}))if(Object.hasOwn(incoming,key)){if(!values.includes(incoming[key]))throw Error('Disposition invalide.');patch[key]=incoming[key];}
   if(Object.hasOwn(incoming,'cardSize')){if(!Number.isFinite(Number(incoming.cardSize)))throw Error('Taille invalide.');patch.cardSize=Number(incoming.cardSize);}
  }
  if(Object.hasOwn(incoming,'linkedActionsEnabled')){if(typeof incoming.linkedActionsEnabled!=='boolean')throw Error('Activation invalide.');patch.linkedActionsEnabled=incoming.linkedActionsEnabled;}
  if(Object.hasOwn(incoming,'linkedRuleIds')){
   const ids=incoming.linkedRuleIds,rules=readState(store,['rules']).rules||[];
   if(!Array.isArray(ids)||ids.length>100||ids.some(id=>typeof id!=='string'||!rules.some(rule=>rule.id===id)))throw Error('Choisissez des actions existantes dans ce profil.');
   patch.linkedRuleIds=[...new Set(ids)];
  }
  const next=normalizeGamePackPresentation({...previous,...patch},packId);delete next.configured;
  store.set("settings.overlayConfigs",{...current.overlayConfigs,gameInteractionOverlays:{...current.overlayConfigs?.gameInteractionOverlays,[packId]:{...previous,...next}}});
  notify(core,"state-changed",core.snapshot());return core.snapshot();
 });
}
module.exports={registerGamePackPresentationIpc};
