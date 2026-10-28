"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os');
const {activationError}=require('../src/shared/game-interaction-validation');
const {loadShenazenGameCatalog}=require('../src/main/game-catalog');
const {defaultGameInteractionRule}=require('../src/main/game-hub/interaction-defaults');
const {initializeDefaultInteractions}=require('../src/main/game-hub/interaction-management');
const {GiftCatalog}=require('../src/main/catalogs'),catalog=loadShenazenGameCatalog(path.resolve('resources')),gifts=new GiftCatalog(path.resolve('resources'));
const rulesFor=pack=>pack.defaultMappings.map(m=>defaultGameInteractionRule(pack,pack.effects.find(e=>e.id===m.effectId),m,pack.interactionCatalogVersion,gifts));
function fixture(){
 const pack=catalog.find(p=>p.id==='gtav-montchiliad'),state={session:{profileId:'p'},settings:{account:{uid:'owner'}},game:{interactionRulesByPack:{[pack.id]:rulesFor(pack)},interactionCatalogVersions:{}}},handlers=new Map(),store={getState:()=>state,mutate:fn=>fn(state)};
 const core={snapshot:()=>structuredClone({state}),notifyRenderer(){},gameHub:{listPacks:()=>[pack]}};
 require('../src/main/ipc/games').registerGamesIpc({handle:(n,fn)=>handlers.set(n,fn),core,store,gameRuntime:{},requireGameAccess:()=>pack});
 return {pack,state,handlers,store,core,save:patch=>handlers.get('game:wins:level')(null,pack.id,{accountUid:'owner',profileId:'p',...patch})};
}
test('un cadeau est obligatoire pour activer une règle cadeau ; les événements gratuits et les tests manuels restent possibles',()=>{
 const rule={enabled:true,trigger:{type:'gift',enabled:true},conditions:[],actions:[]};
 assert.match(activationError(rule),/choisissez obligatoirement un cadeau/);
 for(const trigger of [{type:'follow'},{type:'like'},{type:'subscription'}])assert.equal(activationError({...rule,trigger}),'');
 assert.equal(activationError({...rule,enabled:false}),'');
 rule.conditions=[{field:'data.giftName',operator:'equals',value:'Rose'}];assert.equal(activationError(rule),'');
 rule.trigger.enabled=false;assert.match(activationError(rule),/cadeau/);
});
test('le véritable IPC refuse une activation sans cadeau avant toute écriture, et accepte son cadeau choisi',()=>{
 const f=fixture(),rule=structuredClone(f.state.game.interactionRulesByPack[f.pack.id][0]),writes=[];f.store.upsertGameInteraction=(_id,r)=>writes.push(r);rule.conditions=[];
 assert.throws(()=>f.handlers.get('game:interaction:save')(null,f.pack.id,rule),/Activation impossible/);assert.equal(writes.length,0);
 rule.conditions=[{field:'data.giftName',operator:'equals',value:'Rose'}];f.handlers.get('game:interaction:save')(null,f.pack.id,rule);assert.equal(writes.length,1);
});
test('les wins exigent cadeau et montant valide ; une activation double échouée ne modifie aucune règle',()=>{
 const f=fixture(),rules=f.state.game.interactionRulesByPack[f.pack.id];f.save({operation:'add',amount:1});const added=f.state.game.interactionRulesByPack[f.pack.id].slice(-2),ids=added.map(r=>r.id);
 assert.throws(()=>f.save({operation:'edit',ruleIds:ids,enabled:true}),/cadeau/);
 assert.ok(f.state.game.interactionRulesByPack[f.pack.id].slice(-2).every(r=>r.enabled===false));
 const valid=rules.find(r=>r.actions[0].config.operation==='adjust'&&r.enabled);
 const original=valid.actions[0].config.amount;
 for(const amount of ['',0,-1,1.5,100001,'abc'])assert.throws(()=>f.save({operation:'edit',ruleIds:[valid.id],amount}),/nombre entier/);
 assert.equal(f.state.game.interactionRulesByPack[f.pack.id].find(r=>r.id===valid.id).actions[0].config.amount,original);
 const invalid=structuredClone(valid);invalid.actions[0].config.amount=null;assert.match(activationError(invalid),/nombre entier/);
});
test('les montants et activations sont indépendants ; modifier le positif ne change ni le négatif ni son cadeau',()=>{
 const f=fixture(),rows=f.state.game.interactionRulesByPack[f.pack.id],positive=rows.find(r=>r.actions[0].config.operation==='adjust'&&r.actions[0].config.amount>0),negative=rows.find(r=>r.actions[0].config.operation==='adjust'&&r.actions[0].config.amount<0),before=structuredClone(negative);
 f.save({operation:'edit',ruleIds:[positive.id],amount:7});
 assert.deepEqual(f.state.game.interactionRulesByPack[f.pack.id].find(r=>r.id===negative.id),before);
 f.save({operation:'edit',ruleIds:[positive.id],enabled:false});assert.equal(f.state.game.interactionRulesByPack[f.pack.id].find(r=>r.id===negative.id).enabled,before.enabled);
});
test('le message de validation ouvre une popup avec Compris, sans proposer de forcer l’activation',async()=>{
 const source=fs.readFileSync('src/renderer/app/core/ui-foundations.js','utf8'),calls=[],ctx=vm.createContext({confirmAction:(message,options)=>{calls.push({message,options});return Promise.resolve(true);},toast(){throw Error('Une popup est attendue');}});
 vm.runInContext(source.slice(source.indexOf('async function perform('),source.indexOf('function acceptSnapshot(')),ctx);
 await assert.rejects(ctx.perform(()=>{throw Error("Error invoking remote method: Activation impossible : choisissez obligatoirement un cadeau.");}),/Activation impossible/);
 assert.equal(calls[0].options.acknowledge,true);assert.equal(calls[0].options.confirmLabel,'Compris');assert.match(calls[0].message,/^choisissez/);
});
test('les cinq jeux nettoyés conservent douze cartes, leurs événements gratuits et leurs wins ; sauvegarde et réouverture idempotente',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'shenpulse-cleanup-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 for(const id of ['cult-of-the-lamb','minecraft-bedrock-box','minecraft-survival-plugin','super-mario-kart','terraria']){
  const pack=catalog.find(p=>p.id===id),rules=rulesFor(pack),extra=structuredClone(rules.find(r=>r.gameInteraction.marketColumn));extra.id='old-extra';delete extra.gameInteraction;rules.push(extra);
  const before=structuredClone(rules),state={session:{profileId:'p'},settings:{account:{uid:'owner'}},game:{interactionRulesByPack:{[id]:rules},interactionCatalogVersions:{[id]:2026102603}}},hub={giftCatalog:gifts,assertAccess:()=>pack,store:{directory,getState:()=>state,mutate:fn=>fn(state)}};
  initializeDefaultInteractions(hub,id);assert.equal(rules.filter(r=>r.gameInteraction?.marketColumn==='help').length,6,id);assert.equal(rules.filter(r=>r.gameInteraction?.marketColumn==='trap').length,6,id);assert.equal(rules.find(r=>r.id==='old-extra'),undefined);
  for(const row of before.filter(r=>['follow','like','likes'].includes(r.trigger?.type)||r.actions.some(a=>a.type==='overlay.win-counter')))assert.deepEqual(rules.find(r=>r.id===row.id),row);
  const after=structuredClone(rules);initializeDefaultInteractions(hub,id);assert.deepEqual(rules,after);
 }
 assert.equal(fs.readdirSync(directory,{recursive:true}).filter(f=>String(f).endsWith('.json')).length,5);
});
test('les titres automatiques commencent par une majuscule, les noms saisis par les utilisateurs restent intacts',()=>{
 const titles=require('../src/shared/game-interaction-titles');for(const p of catalog)for(const e of p.effects){const first=e.name.match(/\p{L}/u)?.[0];if(first)assert.equal(first,first.toLocaleUpperCase('fr'),p.id+'/'+e.id);}
 const effect={name:'Soin offert',previousNames:['soin offert']};assert.equal(titles.title({gameInteraction:{title:'soin offert'}},effect),'Soin offert');assert.equal(titles.title({gameInteraction:{title:'mon titre perso'}},effect),'mon titre perso');
});

test('les paliers conservent leur position après une édition indépendante et exposent deux champs et deux activations',t=>{
 const file=path.resolve('tests/external-game-workspace.test.js'),source=fs.readFileSync(file,'utf8'),Module=require('node:module'),m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source.slice(0,source.indexOf("test('les 45"))+'\nmodule.exports={fixture};',file);
 const f=m.exports.fixture();t.after(()=>f.dom.window.close());const pack=catalog.find(p=>p.id==='minecraft-bedrock-box');f.ctx.selectedGameId=pack.id;f.ctx.snapshot.state.game.interactionRulesByPack[pack.id]=rulesFor(pack);
 f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);
 const level=f.ctx.content.querySelector('.game-pack-win-level'),fields=[...level.querySelectorAll('[data-game-win-level]')],ids=fields.map(field=>JSON.parse(field.dataset.gameWinLevel)[0]);assert.equal(fields.length,2);assert.equal(level.querySelectorAll('[data-game-win-enabled]').length,2);assert.notEqual(ids[0],ids[1]);
 const rules=f.ctx.snapshot.state.game.interactionRulesByPack[pack.id];rules.find(r=>r.id===ids[0]).actions[0].config.amount=7;f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);
 const first=[...f.ctx.content.querySelector('.game-pack-win-level').querySelectorAll('[data-game-win-level]')];assert.deepEqual(first.map(field=>JSON.parse(field.dataset.gameWinLevel)[0]),ids);assert.deepEqual(first.map(field=>field.value),['7','1']);
});
