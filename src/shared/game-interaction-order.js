"use strict";
/** Presentation order is independent of rule priority and dispatch order. */
(function(root,factory){const order=factory();if(typeof module!=='undefined'&&module.exports)module.exports=order;else root.ShenPulseGameInteractionOrder=order;})(globalThis,()=>{
 function rank(rule){const value=rule?.gameInteraction?.displayOrder;return Number.isSafeInteger(value)&&value>=0?value:Infinity;}
 function ordered(rules){return [...rules].map((rule,index)=>({rule,index})).sort((a,b)=>rank(a.rule)-rank(b.rule)||a.index-b.index).map(item=>item.rule);}
 function rows(rows){return [...rows].map((row,index)=>({row,index})).sort((a,b)=>rank(a.row.rule)-rank(b.row.rule)||a.index-b.index).map(item=>item.row);}
 function move(rules,{ruleId,beforeRuleId,afterRuleId}={}){
  const target=beforeRuleId||afterRuleId;
  if(typeof ruleId!=='string'||typeof target!=='string'||!ruleId||!target||ruleId.length>160||target.length>160||!!beforeRuleId===!!afterRuleId||ruleId===target)throw Error('Déplacement d’interaction invalide.');
  if(new Set(rules.map(rule=>rule.id)).size!==rules.length)throw Error('Des identifiants d’interactions sont dupliqués. Rouvrez la fiche.');
  const current=ordered(rules),from=current.findIndex(rule=>rule.id===ruleId);
  if(from<0||!current.some(rule=>rule.id===target))throw Error('Cette interaction n’est plus disponible. Rouvrez la fiche.');
  const next=[...current],removed=next.splice(from,1)[0],index=next.findIndex(rule=>rule.id===target)+(afterRuleId?1:0);next.splice(index,0,removed);
  if(next.every((rule,index)=>rule===current[index]))return rules;
  const positions=new Map(next.map((rule,index)=>[rule.id,index]));
  // Keep array order and every runtime field intact. Only presentation metadata changes.
  return rules.map(rule=>({...rule,gameInteraction:{...rule.gameInteraction,displayOrder:positions.get(rule.id)}}));
 }
 return {ordered,rows,move};
});
