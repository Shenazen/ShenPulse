"use strict";
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./gift-identity'):root.ShenPulseGiftIdentity);if(typeof module==='object'&&module.exports)module.exports=api;else root.ShenPulseGameLinkedActions=api;})(globalThis,Identity=>{
 const MAX_RULES=100, TYPES=new Set(['gift','follow','like','likes']);
 const clean=(v,n=120)=>String(v||'').trim().slice(0,n);
 function normalize(value={}){return {linkedActionsEnabled:value.linkedActionsEnabled===true,linkedRuleIds:[...new Set((Array.isArray(value.linkedRuleIds)?value.linkedRuleIds:[]).filter(id=>typeof id==='string'&&id.length>0&&id.length<=160))].slice(0,MAX_RULES)};}
 function candidates(state={}){
  const profile=(state.profiles||[]).find(p=>p.id===state.session?.profileId),enabled=new Set(profile?.enabledRuleIds||(state.rules||[]).map(r=>r.id));
  const byId=new Map((state.rules||[]).flatMap(r=>r.actions||[]).map(a=>[a.id,a]));
  return (state.rules||[]).filter(r=>r.id&&TYPES.has(r.trigger?.type)&&(r.actions?.length||r.actionSelection?.actionIds?.length)).map(rule=>{
   const actions=[...(rule.actions||[]),...(rule.actionSelection?.actionIds||[]).map(id=>byId.get(id)).filter(Boolean)];
   return {rule,id:rule.id,title:clean(rule.name)||'Action sans titre',kind:actions.some(a=>String(a.type).startsWith('irl.'))?'irl':'action',active:rule.enabled!==false&&rule.trigger.enabled!==false&&enabled.has(rule.id)};
  });
 }
 function giftReference(condition={}){return {giftId:clean(condition.giftId,160),giftIds:(Array.isArray(condition.giftIds)?condition.giftIds:[]).filter(v=>typeof v==='string').slice(0,30),giftFamily:clean(condition.giftFamily),giftName:clean(condition.value),giftCost:Math.max(0,Number(condition.giftCost)||0),giftImageUrl:/^https:\/\//i.test(condition.giftImageUrl||'')?String(condition.giftImageUrl).slice(0,2000):''};}
 function triggers(rule){
  const type=rule.trigger.type==='likes'?'like':rule.trigger.type,threshold=Math.max(1,Number(rule.trigger.threshold)||1);
  if(type!=='gift')return [{triggerType:type,threshold,giftName:'',giftImageUrl:'',giftCost:0}];
  const conditions=(rule.conditions||[]).filter(Identity.isGiftSelectionCondition),allowed=conditions.filter(c=>c.operator!=='notEquals');
  if(!allowed.length)return [{triggerType:'gift',threshold,giftName:conditions.length?'Autres cadeaux':'Tous les cadeaux',giftImageUrl:'',giftCost:0,wildcard:true}];
  return allowed.filter(c=>Identity.giftSelectionMatches(conditions,{data:giftReference(c)})).map(c=>({triggerType:'gift',threshold,...giftReference(c)}));
 }
 function sameTrigger(a,b){
  if(a.wildcard||b.wildcard||(a.triggerType==='likes'?'like':a.triggerType)!==(b.triggerType==='likes'?'like':b.triggerType))return false;
  if(a.triggerType!=='gift')return a.triggerType==='follow'||Number(a.threshold||1)===Number(b.threshold||1);
  return Identity.sameGiftIdentity(Identity.giftIdentity(a),Identity.giftIdentity(b));
 }
 function mergeCards(cards,state,packId){
  const config=normalize(state.settings?.overlayConfigs?.gameInteractionOverlays?.[packId]);
  if(!config.linkedActionsEnabled||!config.linkedRuleIds.length)return cards;
  const selected=new Set(config.linkedRuleIds),choices=candidates(state).filter(c=>selected.has(c.id)&&c.active);
  if(!choices.length)return cards;
  const result=[];
  for(const card of cards){
   const entry={...card,ruleIds:[card.id],labels:(card.actionLabels?.length?card.actionLabels:[card.title]).map(text=>({text,kind:'game',column:card.column}))};
   const same=result.find(c=>sameTrigger(c,entry));
   if(same){same.ruleIds.push(card.id);same.labels.push(...entry.labels);}
   else result.push(entry);
  }
  for(const choice of choices)for(const [index,trigger] of triggers(choice.rule).entries()){
   let card=result.find(c=>sameTrigger(c,trigger));
   if(!card){card={...trigger,id:'linked:'+choice.id+':'+index,title:choice.title,column:'neutral',effectImageUrl:'',ruleIds:[],labels:[],linkedOnly:true};result.push(card);}
   if(!card.ruleIds.includes(choice.id))card.ruleIds.push(choice.id);
   if(!card.labels.some(label=>label.kind===choice.kind&&label.text===choice.title))card.labels.push({text:choice.title,kind:choice.kind});
  }
  for(const card of result){card.actionLabels=card.labels.map(l=>l.text);card.title=card.actionLabels.join(' · ');}
  return result;
 }
 return Object.freeze({MAX_RULES,normalize,candidates,mergeCards,sameTrigger});
});
