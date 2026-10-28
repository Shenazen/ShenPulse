
"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module');
const {loadShenazenGameCatalog}=require('../src/main/game-catalog'),{GiftCatalog}=require('../src/main/catalogs'),{defaultGameInteractionRule}=require('../src/main/game-hub/interaction-defaults'),{initializeDefaultInteractions}=require('../src/main/game-hub/interaction-management'),{createGamePackOverlay}=require('../src/shared/game-pack-overlay');
const packs=loadShenazenGameCatalog(path.resolve('resources')),sandbox=packs.find(p=>p.id==='minecraft-sandbox-3'),bedrock=packs.find(p=>p.id==='minecraft-bedrock-box'),gifts=new GiftCatalog(path.resolve('resources')),oldVersion=2026102603;
function rulesFor(pack,legacy=false){return pack.defaultMappings.filter(m=>!legacy||!m.fillMissingWinLevel).map(m=>{const mapping=legacy&&m.previousAmount?{...m,amount:m.previousAmount,title:m.previousTitle}:m;return defaultGameInteractionRule(pack,pack.effects.find(e=>e.id===m.effectId),mapping,legacy?oldVersion:pack.interactionCatalogVersion,gifts);});}
function hubFor(pack,rules=[],version=0){const state={session:{profileId:'p'},settings:{account:{uid:'owner'}},commerce:{subscription:{tier:'pro',status:'active',source:'paid'}},game:{interactionRulesByPack:{[pack.id]:rules},interactionCatalogVersions:{[pack.id]:version}}};return {state,giftCatalog:gifts,assertAccess:()=>pack,store:{getState:()=>state,mutate:fn=>fn(state)}};}
const rowAmount=r=>r.actions.find(a=>a.type==='overlay.win-counter')?.config.amount;
const legacyNegative=rules=>rules.find(r=>r.gameInteraction.presetId==='sandbox-voiture-course-win-minus-55');
function projection(hub,pack=sandbox){return createGamePackOverlay(hub.state,pack.id);}

test('les profils neufs Sandbox et Bedrock possèdent les mêmes quatre paliers, cadeaux et fonctions de wins',()=>{
 const signature=pack=>{const h=hubFor(pack);initializeDefaultInteractions(h,pack.id);const wins=projection(h,pack).wins;return {positive:wins.positive.map(r=>[r.amount,r.giftName,r.giftImageUrl]),negative:wins.negative.map(r=>[r.amount,r.giftName,r.giftImageUrl]),reset:wins.reset.giftName,specials:pack.defaultMappings.filter(m=>['wins-mute','wins-unmute','wins-invert'].includes(m.id)).map(m=>[m.id,m.enabled])};};
 assert.deepEqual(signature(sandbox),signature(bedrock));assert.deepEqual(signature(sandbox).positive.map(r=>r[0]),[1,3,20,45]);assert.deepEqual(signature(sandbox).negative.map(r=>r[0]),[-1,-3,-20,-50]);
});

test('la migration Sandbox complète les paliers manquants une seule fois et conserve les identifiants historiques',()=>{
 const rules=rulesFor(sandbox,true),h=hubFor(sandbox,rules,oldVersion),before=structuredClone(rules),oldId=legacyNegative(rules).id,result=initializeDefaultInteractions(h,sandbox.id);
 assert.equal(result.added,2);assert.equal(result.repaired,1);assert.equal(result.removed,0);assert.equal(legacyNegative(rules).id,oldId);assert.equal(rowAmount(legacyNegative(rules)),-50);
 for(const old of before.filter(r=>r.id!==oldId))assert.deepEqual(rules.find(r=>r.id===old.id),old);
 assert.deepEqual(projection(h).wins.positive.map(r=>r.amount),[1,3,20,45]);const once=structuredClone(rules);assert.equal(initializeDefaultInteractions(h,sandbox.id).added,0);assert.deepEqual(rules,once);
 const removed=rules.findIndex(r=>r.gameInteraction.presetId==='sandbox-galaxy-win-plus-3');rules.splice(removed,1);initializeDefaultInteractions(h,sandbox.id);assert.equal(rules.some(r=>r.gameInteraction.presetId==='sandbox-galaxy-win-plus-3'),false);
});

test('la correction des anciens montants préserve toute règle personnalisée ou action liée et ne double pas un palier manuel',()=>{
 const mutations=[r=>r.actions[0].config.amount=-77,r=>r.enabled=false,r=>r.trigger.enabled=false,r=>r.conditions[0].value='Mon cadeau',r=>r.actions.push({id:'linked',type:'audio.play',config:{url:'keep'}}),r=>r.gameInteraction.default=false,r=>r.gameInteraction.winLevelOrder=55,r=>r.gameInteraction.title='Ma pénalité'];
 for(const mutate of mutations){const rules=rulesFor(sandbox,true),r=legacyNegative(rules);mutate(r);const saved=structuredClone(r),h=hubFor(sandbox,rules,oldVersion);initializeDefaultInteractions(h,sandbox.id);assert.deepEqual(rules.find(v=>v.id===r.id),saved);}
 const rules=rulesFor(sandbox,true),custom=structuredClone(rules.find(r=>rowAmount(r)===1));custom.id='manual-three';custom.gameInteraction.default=false;custom.actions[0].config.amount=3;rules.push(custom);const h=hubFor(sandbox,rules,oldVersion);assert.equal(initializeDefaultInteractions(h,sandbox.id).added,1);assert.equal(rules.filter(r=>rowAmount(r)===3).length,1);assert.deepEqual(rules.find(r=>r.id==='manual-three'),custom);
});

test('la vraie page Sandbox affiche quatre lignes complètes et deux valeurs indépendantes sur chaque palier',t=>{
 const file=path.resolve('tests/external-game-workspace.test.js'),source=fs.readFileSync(file,'utf8'),m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source.slice(0,source.indexOf("test('les 45"))+'\nmodule.exports={fixture};',file);const f=m.exports.fixture();t.after(()=>f.dom.window.close());const h=hubFor(sandbox,rulesFor(sandbox,true),oldVersion);initializeDefaultInteractions(h,sandbox.id);f.ctx.selectedGameId=sandbox.id;f.ctx.snapshot.state.game.interactionRulesByPack[sandbox.id]=h.state.game.interactionRulesByPack[sandbox.id];f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(sandbox);
 const rows=[...f.ctx.content.querySelectorAll('#market-wins .game-pack-win-level')];assert.equal(rows.length,4);for(const row of rows){assert.equal(row.querySelectorAll('[data-game-win-level]').length,2);assert.equal(row.querySelector('.game-pack-win-missing'),null);assert.equal(row.querySelectorAll('.game-pack-win-gift').length,2);}
 assert.deepEqual(rows.map(row=>[...row.querySelectorAll('[data-game-win-level]')].map(input=>Number(input.value))),[[1,1],[3,3],[20,20],[45,50]]);
});
