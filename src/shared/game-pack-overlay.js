"use strict";
const path = require('node:path');
const {normalizeGamePackPresentation}=require('./game-pack-presentation');
const {title: interactionTitle}=require('./game-interaction-titles');
const policy=require('./game-workspace-policy');
const {gameWinsOverlay}=require('./game-wins-overlay');
const {ordered}=require('./game-interaction-order');
const linked=require('./game-pack-linked-actions');
const sceneLayout=require('../../resources/overlays/scene-layout');
const marketEffects=require('../../resources/catalogs/supermarket-simulator-effects.json');
const PACK_ID='supermarket-simulator';
const STATE_PATHS=['rules','profiles','session.profileId','session.game','game.roundSettingsByPack','game.customPacks','game.interactionRulesByPack','commerce.subscription','settings.overlayConfigs.gameInteractionOverlays','settings.overlayConfigs.winCounter','settings.overlayConfigs.timer','settings.overlayConfigs.multiplierTimer','settings.overlayConfigs.gameWinsFeatures','overlaySession'];
const help=new Set(['SpawnCustomers','CustomerRush','GiveMoney','Jackpot','FillShelves','MaxLevel','AntiChaos','SpeedBoost','OpenStore','DeliverProducts','HireEmployees','UnlockAllLicenses','UpgradeStore','DeliverFurniture','ResetEffects']);
const neutral=new Set(['SpeedUpTime','ThrowItem','DropAllItems','RandomizePrices','Teleport','ChangeFOV','GameSpeedUp','ChangeLanguage','AutoDiscount','FinishDay','ResetGame']);
const text=(value,limit=120)=>String(value||'').slice(0,limit);
let catalog, artworkAssets;
function gamePacks(){return catalog ||= new Map(require('../main/game-catalog').loadShenazenGameCatalog(path.resolve(__dirname,'../../resources')).map(pack=>[pack.id,pack.id===PACK_ID?pack:policy.artworkPack(pack)]));}
function packFor(packId,state){const custom=state?.game?.customPacks?.find(pack=>pack.id===packId);if(custom)return require('../main/custom-games').packFor(custom);return packId===PACK_ID?{id:PACK_ID,effects:marketEffects}:gamePacks().get(packId);}
function publicArtwork(effect,packId){
 const image=String(effect.image||'');
 if(image.startsWith('data:image/svg+xml,'))return image;
 if(image.startsWith('../../resources/overlays/media/game-interactions/'))return image.slice('../../resources/overlays/'.length);
 const extension=path.extname(image).toLowerCase();
 if((image.startsWith('../../resources/')||image.startsWith('assets/'))&&['.png','.jpg','.jpeg','.webp','.svg'].includes(extension))return 'media/game-art/'+packId+'/'+effect.id+extension;
 try{const url=new URL(image);if(url.protocol==='https:')return url.href;}catch{/* no remote artwork */}
 return '';
}
function publicGamePackAssets(){
 if(artworkAssets)return artworkAssets;
 const assets=new Map();
 for(const pack of gamePacks().values()){
  if(!policy.eligible(pack))continue;
  for(const effect of pack.effects){const publicPath=publicArtwork(effect,pack.id);if(!publicPath.startsWith('media/game-art/'))continue;
   const source=String(effect.image).startsWith('assets/')?path.resolve(__dirname,'../renderer',effect.image):path.resolve(__dirname,'../renderer',effect.image);
   assets.set('/'+publicPath,source);
  }
 }
 artworkAssets=assets;return assets;
}
function createGamePackOverlay(state,packId=PACK_ID){
 const profileId=text(state?.session?.profileId),pack=packFor(packId,state),enabled=sceneLayout.activeProAccess(state)&&!!pack&&(packId===PACK_ID||policy.eligible(pack));
 const rules=state?.game?.interactionRulesByPack?.[packId]||[],effects=new Map((pack?.effects||[]).map(effect=>[effect.id,effect]));
 const cards=!enabled?[]:ordered(rules).slice(0,1000).flatMap(rule=>{
  if(rule.actions?.some(action=>action.type==='overlay.win-counter'))return [];
  if(rule.enabled===false||rule.trigger?.enabled===false||!['gift','follow','like','likes'].includes(rule.trigger?.type))return [];
  const action=rule.actions?.find(item=>['game.effect','overlay.win-counter','audio.play'].includes(item.type)&&item.config?.packId===packId&&item.config?.effectId);
  const effect=effects.get(action?.config?.effectId);if(!effect||effect.available===false)return [];
  const gift=rule.conditions?.find(item=>item.field==='data.giftName')||{};
  const stored=rule.gameInteraction?.marketColumn;
  const column=packId===PACK_ID?['help','neutral','trap'].includes(stored)?stored:help.has(effect.code)?'help':neutral.has(effect.code)?'neutral':'trap':policy.column({rule,effect});
  let giftImageUrl='';try{const url=new URL(gift.giftImageUrl);if(url.protocol==='https:')giftImageUrl=url.href.slice(0,2000);}catch{/* optional */}
  const options={compact:packId!==PACK_ID,defaultTitles:([...(pack.defaultMappings||[]),...(pack.previousDefaultMappings||[])]).filter(mapping=>mapping.effectId===effect.id).map(mapping=>mapping.title).filter(Boolean)};
  return [{id:text(rule.id),title:text(interactionTitle(rule,effect,options)),column,
   actionLabels:[text(interactionTitle(rule,effect,options)),...rule.actions.filter(a=>a!==action&&a.config?.packId===packId&&a.config?.effectId).map(a=>effects.get(a.config.effectId)).filter(e=>e&&e.available!==false).map(e=>text(interactionTitle({},e,options)))].slice(0,16),
   giftId:text(gift.giftId,160),giftIds:Array.isArray(gift.giftIds)?gift.giftIds.filter(id=>typeof id==='string').slice(0,30):[],giftFamily:text(gift.giftFamily),triggerType:rule.trigger.type,threshold:Math.max(1,Number(rule.trigger.threshold)||1),effectImageUrl:publicArtwork(effect,packId),giftName:text(gift.value),giftImageUrl,giftCost:Math.max(0,Number(gift.giftCost)||0)}];
 });
 return {profileId,packId,enabled,cards:enabled?require('../../resources/overlays/game-pack-layout').prioritizeCards(linked.mergeCards(cards,state,packId)):cards,wins:enabled?gameWinsOverlay(state,pack,ordered(rules)):null,presentation:normalizeGamePackPresentation(state?.settings?.overlayConfigs?.gameInteractionOverlays?.[packId]||{},packId)};
}
function createGamePackOverlays(state){
 // Preserve the previous Supermarket payload for older browser sources.
 const legacy=createGamePackOverlay(state),packs={};
 for(const packId of new Set([...Object.keys(state?.game?.interactionRulesByPack||{}),...Object.keys(state?.settings?.overlayConfigs?.gameInteractionOverlays||{})])){
  if(packId===PACK_ID)continue;const pack=packFor(packId,state);if(pack&&policy.eligible(pack))packs[packId]=createGamePackOverlay(state,packId);
 }
 return {...legacy,packs};
}
function gamePackOverlayTrigger({ok,started,rule,action,event,profileId}){
 const packId=action?.config?.packId;
 if((!started&&!ok)||!rule||!['game.effect','overlay.win-counter','audio.play'].includes(action?.type)||!action.config?.effectId)return null;
 const pack=packFor(packId)||(/^custom-game-[a-f0-9-]{36}$/.test(String(packId))?{id:packId,workspaceLayout:"shared"}:null);if(!pack||(packId!==PACK_ID&&!policy.eligible(pack)))return null;
 const first=rule.actions?.find(item=>item.config?.packId===packId&&item.config?.effectId);
 if(first!==action&&(!first?.id||first.id!==action.id))return null;
 const count=Math.min(9999,Math.max(1,Math.floor(Number(event?.data?.count)||1)));
 // Chaque démarrage est déjà une unité du moteur : ne jamais rejouer le total du combo.
 // Le total sert uniquement à l'intensité visuelle de la carte.
 const comboCount=Math.min(9999,Math.max(count,Math.floor(Number(event?.data?.raw?.repeatCount)||0),Math.floor(Number(event?.data?.batchCount)||0)));
 return {profileId:text(profileId),packId,ruleId:text(rule.id),viewer:text(event?.user?.displayName||event?.user?.uniqueId||'Viewer',80),count,comboCount};
}
function linkedGamePackOverlayTriggers({ok,started,rule,event,profileId,state}){
 if((!started&&!ok)||!rule||!(state?.rules||[]).some(r=>r.id===rule.id))return [];
 const payloads=[];
 for(const [packId,config] of Object.entries(state.settings?.overlayConfigs?.gameInteractionOverlays||{})){
  if(config.linkedActionsEnabled!==true||!config.linkedRuleIds?.includes(rule.id))continue;
  const overlay=createGamePackOverlay(state,packId);if(!overlay.enabled)continue;
  for(const card of overlay.cards.filter(c=>c.ruleIds?.includes(rule.id))){
   if(card.triggerType==='gift'&&!card.wildcard&&!require('./gift-identity').sameGiftIdentity(require('./gift-identity').giftIdentity(card),require('./gift-identity').giftIdentity(event?.data||{})))continue;
   payloads.push({profileId:text(profileId),packId,ruleId:card.id,viewer:text(event?.user?.displayName||event?.user?.uniqueId||'Viewer',80),count:1,comboCount:Math.max(1,Number(event?.data?.raw?.repeatCount)||1),...(event?.id?{eventKey:text(event.id,220)}:{})});
  }
 }
 return payloads;
}
module.exports={linkedGamePackOverlayTriggers,PACK_ID,STATE_PATHS,createGamePackOverlay,createGamePackOverlays,gamePackOverlayTrigger,publicGamePackAssets};
