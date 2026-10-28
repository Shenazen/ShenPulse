"use strict";
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{isDeepStrictEqual}=require('node:util');
const {defaultGameInteractionRule}=require('./interaction-defaults');
const {findCatalogGift}=require('../../shared/gift-identity');
function plain(rule,effect,mapping,gifts){
 const value=structuredClone(rule);delete value.name;
 if(value.gameInteraction){delete value.gameInteraction.displayOrder;const known=[mapping.title,effect.name,...(effect.previousNames||[])].map(x=>String(x||'').trim().toLowerCase());if(known.includes(String(value.gameInteraction.title||'').toLowerCase()))delete value.gameInteraction.title;}
 value.conditions=(value.conditions||[]).map(condition=>{if(condition.field!=='data.giftName')return condition;const gift=findCatalogGift(gifts||[],{id:condition.giftId,giftIds:condition.giftIds,name:condition.value,cost:condition.giftCost});return {field:condition.field,operator:condition.operator,gift:gift?.id||condition.giftId||String(condition.value||'').toLowerCase()};});
 return value;
}
function migrateStarterDefaults(hub,pack,rules,currentVersion){
 const cleanup=!!pack.starterCleanupVersion&&currentVersion<pack.starterCleanupVersion;
 if(!pack.starterDefaultsVersion||!cleanup&&currentVersion>=pack.starterDefaultsVersion||!rules.length)return {removed:0};
 const old=new Map((pack.previousDefaultMappings||[]).map(mapping=>[mapping.id,mapping])),remove=new Set();
 for(const rule of rules){
  if(cleanup&&(pack.starterCleanupScope!=='generated'||rule.gameInteraction?.default===true)&&!['follow','like','likes'].includes(rule.trigger?.type)&&rule.actions?.length===1&&rule.actions[0].config?.packId===pack.id&&rule.actions[0].type!=='overlay.win-counter'&&!pack.effects.find(effect=>effect.id===rule.actions[0].config.effectId)?.winCounter){
   const preset=rule.gameInteraction?.presetId;
   if(!String(preset||'').startsWith('starter-'))remove.add(rule.id);
   continue;
  }
  const mapping=old.get(rule.gameInteraction?.presetId),effect=pack.effects.find(e=>e.id===mapping?.effectId);if(!mapping||!effect||['follow','like','likes'].includes(mapping.triggerType)||rule.gameInteraction?.default!==true)continue;
  if((effect.winCounter||effect.actionType==='overlay.win-counter')&&effect.winCounter?.operation!=='multiplier')continue;
  const expected=defaultGameInteractionRule(pack,effect,mapping,rule.gameInteraction.catalogVersion,hub.giftCatalog);
  if(isDeepStrictEqual(plain(rule,effect,mapping,hub.giftCatalog?.gifts),plain(expected,effect,mapping,hub.giftCatalog?.gifts)))remove.add(rule.id);
 }
 if(remove.size&&hub.store.directory){const s=hub.store.getState(),owner=crypto.createHash('sha256').update(String(s.settings?.account?.uid||'')+'\0'+s.session.profileId).digest('hex').slice(0,24),directory=path.join(hub.store.directory,'game-interaction-backups',owner,pack.id);fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'before-starter-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.json'),JSON.stringify({packId:pack.id,profileId:s.session.profileId,catalogVersion:currentVersion,rules},null,2),{flag:'wx'});}
 for(let i=rules.length-1;i>=0;i--)if(remove.has(rules[i].id))rules.splice(i,1);
 return {removed:remove.size};
}
function starterGiftAlreadyUsed(rule,rules){
 const gift=rule.conditions?.find(c=>c.field==='data.giftName');if(!gift)return false;
 const ids=new Set([gift.giftId,...gift.giftIds||[]].filter(Boolean).map(String));
 return rules.some(existing=>existing.trigger?.enabled!==false&&existing.trigger?.type==='gift'&&existing.conditions?.some(c=>c.field==='data.giftName'&&([c.giftId,...c.giftIds||[]].filter(Boolean).some(id=>ids.has(String(id)))||String(c.value||'').trim().toLowerCase()===String(gift.value||'').trim().toLowerCase())));
}
// Only explicit historical defaults are eligible; edited rules remain byte-for-byte intact.
function migrateDefaultWinAmounts(hub,pack,rules,currentVersion){
 if(currentVersion>=pack.interactionCatalogVersion)return {repaired:0};
 const replacements=[];
 for(const mapping of pack.defaultMappings||[]){
  if(!Number.isFinite(mapping.previousAmount))continue;
  const effect=pack.effects.find(e=>e.id===mapping.effectId);
  if(!effect?.winCounter)continue;
  const rule=rules.find(r=>r.gameInteraction?.default===true&&r.gameInteraction.presetId===mapping.id);
  if(!rule||rule.gameInteraction.winLevelOrder!==undefined)continue;
  const previous={...mapping,amount:mapping.previousAmount,title:mapping.previousTitle||mapping.title};
  const expected=defaultGameInteractionRule(pack,effect,previous,rule.gameInteraction.catalogVersion,hub.giftCatalog);
  if(isDeepStrictEqual(plain(rule,effect,previous,hub.giftCatalog?.gifts),plain(expected,effect,previous,hub.giftCatalog?.gifts)))replacements.push({rule,mapping});
 }
 if(replacements.length&&hub.store.directory){
  const state=hub.store.getState(),owner=crypto.createHash('sha256').update(String(state.settings?.account?.uid||'')+'\0'+state.session.profileId).digest('hex').slice(0,24),directory=path.join(hub.store.directory,'game-interaction-backups',owner,pack.id);
  fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,'before-win-defaults-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.json'),JSON.stringify({packId:pack.id,profileId:state.session.profileId,catalogVersion:currentVersion,rules},null,2),{flag:'wx'});
 }
 for(const {rule,mapping} of replacements){
  rule.actions[0].config.amount=mapping.amount;
  if(rule.gameInteraction.title===mapping.previousTitle)rule.gameInteraction.title=mapping.title;
  if(rule.name===pack.name+' · '+mapping.previousTitle)rule.name=pack.name+' · '+mapping.title;
  rule.gameInteraction.catalogVersion=pack.interactionCatalogVersion;
 }
 return {repaired:replacements.length};
}

// Upgrade only the original, empty KOTH win presets. Chosen gifts and custom rules are preserved.
function migrateKothWinGifts(hub,pack,rules,currentVersion){
 if(pack.id!=='gtav-koth-enhanced'||currentVersion>=2026102702)return {repaired:0};
 const changes=[];
 for(const mapping of pack.defaultMappings||[]){
  const effect=pack.effects.find(e=>e.id===mapping.effectId);if(!effect?.winCounter||!mapping.giftName)continue;
  const rule=rules.find(r=>r.gameInteraction?.default===true&&r.gameInteraction.presetId===mapping.id);
  if(!rule||rule.trigger?.type!=='gift'||rule.actions?.length!==1||rule.actions[0].config?.effectId!==effect.id)continue;
  const selected=rule.conditions?.find(c=>c.field==='data.giftName'&&(c.value||c.giftId));
  const unresolvedRace=selected&&mapping.effectId==='overlay_win_remove_50'&&selected.value==='Voiture de course'&&!selected.giftId&&!selected.giftImageUrl&&Number(selected.giftCost)===12000;
  if(selected&&!unresolvedRace)continue;
  const expected=defaultGameInteractionRule(pack,effect,mapping,pack.interactionCatalogVersion,hub.giftCatalog);changes.push({rule,expected});
 }
 if(changes.length&&hub.store.directory){const dir=path.join(hub.store.directory,'game-interaction-backups','koth-win-gifts');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,Date.now()+'-'+crypto.randomBytes(4).toString('hex')+'.json'),JSON.stringify(changes.map(x=>x.rule),null,2),{flag:'wx'});}
 for(const {rule,expected} of changes){rule.conditions=[...(rule.conditions||[]).filter(c=>c.field!=='data.giftName'),...expected.conditions];rule.enabled=true;rule.trigger.enabled=true;rule.gameInteraction.catalogVersion=pack.interactionCatalogVersion;}
 return {repaired:changes.length};
}

module.exports={migrateKothWinGifts,migrateStarterDefaults,starterGiftAlreadyUsed,migrateDefaultWinAmounts};
