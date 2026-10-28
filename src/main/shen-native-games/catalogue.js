"use strict";
const {ordered}=require('../../shared/game-interaction-order');
/** Keep native game cards aligned with the same configured gifts as the public overlay. */
function nativeCatalogue(pack,state){
 const actions=[];
 for(const rule of ordered(state.game.interactionRulesByPack?.[pack.id]||[])){
  if(rule.enabled===false||rule.trigger?.enabled===false||rule.trigger?.type!=='gift')continue;
  const gift=rule.conditions?.find(c=>c.field==='data.giftName'&&String(c.value||'').trim());if(!gift)continue;
  for(const action of rule.actions||[]){if(action.enabled===false||action.config?.packId!==pack.id)continue;const effect=pack.effects.find(e=>e.id===action.config.effectId);if(!effect)continue;
   const image=String(gift.giftImageUrl||'').slice(0,2048),title=String(rule.gameInteraction?.title||effect.name).slice(0,120);
   actions.push({action:effect.code,palier:1,niveau:1,titre:title,cadeau:String(gift.value).slice(0,160),image:/^https:\/\//i.test(image)?image:'',pieces:Math.max(0,Math.min(100000,Number(gift.giftCost)||0)),effet:title});
  }
 }
 return {actions,entrees:actions,interactions:{likesPourPluie:0,actionFollow:'',actionPartage:'',chatCamps:false,paliersLikes:[],paliersEnBoucle:false}};
}
module.exports={nativeCatalogue};
