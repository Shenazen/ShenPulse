"use strict";
const {readState}=require('../state-projection'),{safeString,id}=require('../utils'),{notify}=require('./notifications'),{defaultGameInteractionRule}=require('../game-hub/interaction-defaults');
function registerGameWinsIpc({handle,core,store,requireGameAccess}){
 handle('game:wins:level',(_event,packId,incoming={})=>{
  const pack=requireGameAccess(safeString(packId,160)),state=readState(store,['session.profileId','settings.account.uid','game.interactionRulesByPack.'+pack.id]);
  if(!incoming.accountUid||incoming.accountUid!==state.settings.account?.uid||incoming.profileId!==state.session.profileId)throw Error('Le compte ou le profil a changé. Rouvrez la fiche.');
  if(!pack.effects.some(effect=>effect.winCounter))throw Error('Ce jeu ne possède pas de compteur de wins.');
  if(incoming.operation==='options')return require('./game-wins-options').saveGameWinsOptions({store,core,pack,patch:incoming.patch});
  let rules=structuredClone(state.game.interactionRulesByPack?.[pack.id]||[]);
  const amount=Number(incoming.amount);if(!['add','remove','edit'].includes(incoming.operation))throw Error('Opération de palier invalide.');
  if((incoming.operation==='add'||incoming.operation==='edit'&&incoming.amount!==undefined)&&(!Number.isSafeInteger(amount)||amount<1||amount>100000))throw Error('Configuration incomplète : saisissez un nombre entier de wins entre 1 et 100 000.');
  if(incoming.operation==='add'){
   for(const sign of [1,-1]){const effect=pack.effects.find(effect=>effect.winCounter?.operation==='adjust'&&Math.sign(effect.winCounter.amount)===sign);if(!effect)throw Error('Effet de wins indisponible.');const mapping={id:'custom-win-'+id('level'),effectId:effect.id,title:(sign>0?'+':'−')+amount+' wins',amount:sign*amount,triggerType:'gift',triggerEnabled:false,enabled:false};const rule=defaultGameInteractionRule(pack,effect,mapping,pack.interactionCatalogVersion,core.giftCatalog);rule.gameInteraction.default=false;rule.gameInteraction.winLevelOrder=100000+rules.length;rules.push(rule);}
  }else{
   const ids=Array.isArray(incoming.ruleIds)?[...new Set(incoming.ruleIds)]:[];if(!ids.length||ids.length>2||ids.some(id=>typeof id!=='string'))throw Error('Palier invalide.');
   for(const ruleId of ids){const rule=rules.find(rule=>rule.id===ruleId),actions=rule?.actions?.filter(action=>action.type==='overlay.win-counter'&&action.config?.packId===pack.id&&(action.config.operation||'adjust')==='adjust')||[],action=actions[0];if(actions.length>1)throw Error('Ce palier contient plusieurs actions de wins. Utilisez ses réglages détaillés.');if(!rule||!action)throw Error('Ce palier n’existe plus. Rouvrez la fiche.');
    if(incoming.operation==='remove'){if(rule.actions.length>1)throw Error('Ce palier contient des actions liées. Utilisez ses réglages détaillés pour les conserver.');rules=rules.filter(rule=>rule.id!==ruleId);}else{const sign=Math.sign(Number(action.config.amount))||1;rule.gameInteraction||={};rule.gameInteraction.winLevelOrder??=Math.abs(Number(action.config.amount));if(incoming.amount!==undefined)action.config.amount=sign*amount;if(typeof incoming.enabled==='boolean')rule.enabled=incoming.enabled;require('../../shared/game-interaction-validation').assertGameInteractionActivation(rule);}
   }
  }
  store.mutate(state=>{state.game.interactionRulesByPack[pack.id]=rules;},true);const snapshot=core.snapshot();notify(core,'state-changed',snapshot);return snapshot;
 });
}
module.exports={registerGameWinsIpc};
