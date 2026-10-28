"use strict";
const {readState}=require('../state-projection');
const {safeString}=require('../utils');
const {move}=require('../../shared/game-interaction-order');
const {notify}=require('./notifications');
function registerGameInteractionOrderIpc({handle,core,store,requireGameAccess}){
 handle('game:interactions:move',(_event,packId,incoming={})=>{
  const targetId=safeString(packId,160);requireGameAccess(targetId);
  const current=readState(store,['settings.account.uid','session.profileId','game.interactionRulesByPack.'+targetId]);
  if(!incoming.accountUid||incoming.accountUid!==current.settings.account?.uid||incoming.profileId!==current.session.profileId)throw Error('Le compte ou le profil a changé. Rouvrez cette fiche.');
  const rules=current.game.interactionRulesByPack?.[targetId]||[];
  const next=move(rules,{ruleId:incoming.ruleId,beforeRuleId:incoming.beforeRuleId,afterRuleId:incoming.afterRuleId});
  if(next!==rules)store.mutate(state=>{state.game.interactionRulesByPack[targetId]=next;},true);
  const snapshot=core.snapshot();if(next!==rules)notify(core,'state-changed',snapshot);return snapshot;
 });
}
module.exports={registerGameInteractionOrderIpc};
