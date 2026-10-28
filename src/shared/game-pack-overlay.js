"use strict";
const path = require('node:path');
const {normalizeGamePackPresentation}=require('./game-pack-presentation');
const {title: interactionTitle}=require('./game-interaction-titles');
const policy=require('./game-workspace-policy');
const {gameWinsOverlay}=require('./game-wins-overlay');
const {ordered}=require('./game-interaction-order');
const sceneLayout=require('../../resources/overlays/scene-layout');
const marketEffects=require('../../resources/catalogs/supermarket-simulator-effects.json');
const PACK_ID='supermarket-simulator';
const STATE_PATHS=['session.profileId','session.game','game.roundSettingsByPack','game.interactionRulesByPack','commerce.subscription','settings.overlayConfigs.gameInteractionOverlays','settings.overlayConfigs.winCounter','settings.overlayConfigs.timer','settings.overlayConfigs.multiplierTimer','settings.overlayConfigs.gameWinsFeatures','overlaySession'];
const help=new Set(['SpawnCustomers','CustomerRush','GiveMoney','Jackpot','FillShelves','MaxLevel','AntiChaos','SpeedBoost','OpenStore','DeliverProducts','HireEmployees','UnlockAllLicenses','UpgradeStore','DeliverFurniture','ResetEffects']);
const neutral=new Set(['SpeedUpTime','ThrowItem','DropAllItems','RandomizePrices','Teleport','ChangeFOV','GameSpeedUp','ChangeLanguage','AutoDiscount','FinishDay','ResetGame']);
const text=(value,limit=120)=>String(value||'').slice(0,limit);
let catalog, artworkAssets;
function gamePacks(){return catalog ||= new Map(require('../main/game-catalog').loadShenazenGameCatalog(path.resolve(__dirname,'../../resources')).map(pack=>[pack.id,pack.id===PACK_ID?pack:policy.artworkPack(pack)]));}
function packFor(packId){return packId===PACK_ID?{id:PACK_ID,effects:marketEffects}:gamePacks().get(packId);}
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
 const profileId=text(state?.session?.profileId),pack=packFor(packId),enabled=sceneLayout.activeProAccess(state)&&!!pack&&(packId===PACK_ID||policy.eligible(pack));
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
   triggerType:rule.trigger.type,threshold:Math.max(1,Number(rule.trigger.threshold)||1),effectImageUrl:publicArtwork(effect,packId),giftName:text(gift.value),giftImageUrl,giftCost:Math.max(0,Number(gift.giftCost)||0)}];
 });
 return {profileId,packId,enabled,cards,wins:enabled?gameWinsOverlay(state,pack,ordered(rules)):null,presentation:normalizeGamePackPresentation(state?.settings?.overlayConfigs?.gameInteractionOverlays?.[packId]||{})};
}
function createGamePackOverlays(state){
 // Preserve the previous Supermarket payload for older browser sources.
 const legacy=createGamePackOverlay(state),packs={};
 for(const packId of Object.keys(state?.game?.interactionRulesByPack||{})){
  if(packId===PACK_ID)continue;const pack=packFor(packId);if(pack&&policy.eligible(pack))packs[packId]=createGamePackOverlay(state,packId);
 }
 return {...legacy,packs};
}
function gamePackOverlayTrigger({ok,rule,action,event,profileId}){
 const packId=action?.config?.packId;
 if(!ok||!rule||!['game.effect','overlay.win-counter','audio.play'].includes(action?.type)||!action.config?.effectId)return null;
 const pack=packFor(packId);if(!pack||(packId!==PACK_ID&&!policy.eligible(pack)))return null;
 const first=rule.actions?.find(item=>item.config?.packId===packId&&item.config?.effectId);
 if(first!==action&&(!first?.id||first.id!==action.id))return null;
 return {profileId:text(profileId),packId,ruleId:text(rule.id),viewer:text(event?.user?.displayName||event?.user?.uniqueId||'Viewer',80)};
}
module.exports={PACK_ID,STATE_PATHS,createGamePackOverlay,createGamePackOverlays,gamePackOverlayTrigger,publicGamePackAssets};
