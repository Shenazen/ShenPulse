"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), path = require("node:path");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { GiftCatalog } = require("../src/main/catalogs/gifts");
const { initializeDefaultInteractions } = require("../src/main/game-hub/interaction-management");
const { defaultGameInteractionRule } = require("../src/main/game-hub/interaction-defaults");
const { manualShopMapping } = require("../src/main/game-catalog/shop-game-presets");
const { RuleEngine } = require("../src/main/rule-engine");
const { normalizeEvent } = require("../src/main/event-normalizer");
const id = "supermarket-simulator", resources = path.resolve(__dirname, "../resources");
const reference = [
  ["help", "SpawnCustomers", "+1 client", "Rose", "5655", 1],
  ["help", "CustomerRush", "Rush clients", "Finger Heart", "5487", 5],
  ["help", "UpgradeStore", "Agrandir magasin", "Perfume", "5658", 20],
  ["help", "FillShelves", "Rayons pleins", "Doughnut", "5879", 30],
  ["help", "HireEmployees", "+1 employé", "Cap", "6104", 99],
  ["help", "Jackpot", "Jackpot", "Corgi", "6267", 299],
  ["trap", "FlipCamera", "Caméra retournée", "TikTok", "5269", 1],
  ["trap", "SpawnShoplifter", "Voleur", "Tofu", "10604", 5],
  ["trap", "LightsOff", "Coupure courant", "S Flowers", "14115", 20],
  ["trap", "CartChaos", "Chaos total", "Capybara", "14488", 30],
  ["trap", "FireAllEmployees", "Employés virés", "Hat and Mustache", "6427", 99],
  ["trap", "Bankrupt", "Faillite", "Boxing Gloves", "6007", 299]
];
function fixture(legacy = false) {
 const pack = loadShenazenGameCatalog(resources).find(p => p.id === id), giftCatalog = new GiftCatalog(resources);
 const rules = legacy ? pack.effects.map(effect => defaultGameInteractionRule(pack, effect, manualShopMapping(effect), 20261023)) : [];
 const state = { rules: [], profiles: [{id:"profile"}], session:{profileId:"profile",game:{running:true,packId:id,profileId:"profile"}}, game:{interactionRulesByPack:{[id]:rules},interactionCatalogVersions:legacy?{[id]:20261023}:{}} };
 const hub = {assertAccess:()=>pack,giftCatalog,store:{mutate:fn=>fn(state),getState:()=>state}};
 return {pack,state,hub,rules,initialize:()=>initializeDefaultInteractions(hub,id)};
}
function summary(pack,rules) {
 return rules.map(rule => {const gift=rule.conditions[0];return [rule.gameInteraction.marketColumn,pack.effects.find(e=>e.id===rule.actions[0].config.effectId).code,rule.gameInteraction.title,gift.value,gift.giftId,gift.giftCost];});
}

test("Supermarket propose exactement les six aides et six pièges de référence, sans neutre, avec leurs vrais cadeaux",()=>{
 const f=fixture();assert.equal(f.initialize().added,12);assert.deepEqual(summary(f.pack,f.rules),reference);assert.equal(f.pack.effects.length,42);
 assert.ok(f.rules.every(r=>r.enabled&&r.trigger.enabled&&r.trigger.type==="gift"&&r.conditions[0].giftImageUrl));
 assert.equal(f.rules[0].actions[0].config.parameters.count,1);assert.equal(f.rules[4].actions[0].config.parameters.count,1);assert.equal(f.rules[6].actions[0].config.duration,15);assert.equal(f.rules[8].actions[0].config.duration,20);
 assert.equal(f.initialize().added,0);f.rules.splice(1,1);f.rules[0].enabled=false;assert.equal(f.initialize().added,0);assert.equal(f.rules.length,11);assert.equal(f.rules[0].enabled,false);
});

test("la migration remplace les 42 anciennes cartes intactes par 12 et reste propre au profil concerné",()=>{
 const f=fixture(true),other=structuredClone(f.rules);f.state.game.interactionRulesByPack.other=other;
 const result=f.initialize();assert.equal(result.removed,42);assert.equal(result.added,12);assert.deepEqual(summary(f.pack,f.rules),reference);assert.deepEqual(f.state.game.interactionRulesByPack.other,other);assert.equal(f.initialize().removed,0);
});

test("la migration préserve intégralement chaque personnalisation et ne double pas une association existante",()=>{
 const f=fixture(true),codes=["SpawnCustomers","CustomerRush","UpgradeStore","FillShelves","HireEmployees","Jackpot","GameSlowDown","ChangeFOV"];
 const altered=codes.map(code=>f.rules.find(r=>r.actions[0].config.effectId===f.pack.effects.find(e=>e.code===code).id));
 altered[0].conditions=[{field:"data.giftName",operator:"equals",value:"Donut",giftId:"5879"}];altered[0].trigger.enabled=true;
 altered[1].gameInteraction.title="Mon rush";altered[2].enabled=false;altered[3].actions.push({id:"sound",type:"audio.play",config:{url:"https://example.test/sound.mp3"}});
 altered[4].cooldown.perUserMs=1200;altered[5].gameInteraction.marketColumn="neutral";altered[6].actions[0].config.duration=8;altered[7].chance=.5;
 const before=structuredClone(f.rules);const result=f.initialize();assert.equal(result.added,0);assert.equal(result.removed,0);assert.deepEqual(f.rules,before);assert.equal(f.initialize().added,0);
});

test("chaque cadeau ne déclenche que son interaction, y compris les variantes régionales et les rafales de roses",async()=>{
 const f=fixture();f.initialize();const calls=[],engine=new RuleEngine({store:f.hub.store,giftCatalog:f.hub.giftCatalog,actionRunner:{async run(action){calls.push(action);}}});
 async function send(giftId,giftName,count=1){await engine.process(normalizeEvent({event:"gift",data:{giftId,giftName,count,user:{id:"viewer",nickname:"Donateur"}}},"tiktok"));}
 for(const [,code,,name,giftId] of reference){const before=calls.length;await send(giftId,name);assert.equal(calls.length,before+1,name);assert.equal(f.pack.effects.find(e=>e.id===calls.at(-1).config.effectId).code,code);}
 await send("11015","Tofu");assert.equal(calls.at(-1).config.effectId,"supermarket-simulator-spawn-shoplifter");await send("17490","Capybara");assert.equal(calls.at(-1).config.effectId,"supermarket-simulator-cart-chaos");
 const before=calls.length;await send("5655","Rose",3);assert.equal(calls.length,before+3);assert.ok(calls.slice(before).every(a=>a.config.parameters.count===1));
 await send("999999","Autre cadeau");assert.equal(calls.length,before+3);f.state.session.game.running=false;await send("5655","Rose");assert.equal(calls.length,before+3);
});


test("une ancienne carte supprimée reste supprimée lors de la mise à jour des défauts",()=>{
 const f=fixture(true);f.rules.splice(0,1);const before=structuredClone(f.rules);f.initialize();assert.deepEqual(f.rules,before);
});


test('les anciens 42 noms longs intacts restent reconnus par la migration vers les douze cartes',()=>{
 const f=fixture(true);
 for(const effect of f.pack.effects){const previous=effect.previousNames?.[0] || effect.name,rule=f.rules.find(r=>r.actions[0].config.effectId===effect.id);rule.gameInteraction.title=previous;rule.name=f.pack.name+' · '+previous;}
 const result=f.initialize();assert.equal(result.removed,42);assert.equal(result.added,12);assert.deepEqual(summary(f.pack,f.rules),reference);
});
