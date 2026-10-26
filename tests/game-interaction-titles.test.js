"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {title}=require('../src/shared/game-interaction-titles');
const {createGamePackOverlay}=require('../src/shared/game-pack-overlay');
const effects=require('../resources/catalogs/supermarket-simulator-effects.json');
const {supermarketDefaultMappings}=require('../src/main/game-catalog/shop-game-presets');
const words=value=>value.trim().split(/\s+/).length;

test('les 42 noms et les 12 titres par défaut de Supermarket ont au plus deux mots distincts',()=>{
 assert.equal(effects.length,42);assert.equal(new Set(effects.map(e=>e.name)).size,42);
 for(const effect of effects){assert.ok(words(effect.name)<=2,effect.name);assert.ok(effect.description.length>20);}
 const defaults=supermarketDefaultMappings(effects);assert.equal(defaults.length,12);
 for(const mapping of defaults)assert.ok(words(mapping.title)<=2,mapping.title);
});

test('les anciens noms standards sont raccourcis sans écrire de règles ni tronquer les titres personnalisés',()=>{
 for(const effect of effects){
  assert.equal(title({},effect),effect.name);
  for(const previous of effect.previousNames||[]){const rule={gameInteraction:{title:previous},conditions:[{giftId:'rose'}],actions:[{id:'kept'}]},before=structuredClone(rule);assert.equal(title(rule,effect),effect.name);assert.deepEqual(rule,before);}
  assert.equal(title({gameInteraction:{title:'Mon cadeau très spécial'}},effect),'Mon cadeau très spécial');
 }
 assert.equal(title({gameInteraction:{title:'Nom existant'}},{name:'Autre jeu'}),'Nom existant');
});

test('la projection de l’overlay utilise les mêmes noms courts et garde les cadeaux et les actions',()=>{
 const effect=effects.find(e=>e.code==='FireAllEmployees'),rule={id:'old-default',gameInteraction:{title:'Virer les employés'},trigger:{type:'gift',enabled:true},conditions:[{field:'data.giftName',value:'Hat and Mustache',giftCost:99}],actions:[{id:'fire',type:'game.effect',config:{packId:'supermarket-simulator',effectId:effect.id}}]};
 const state={session:{profileId:'test'},commerce:{subscription:{tier:'pro',status:'active',source:'paid'}},game:{interactionRulesByPack:{'supermarket-simulator':[rule]}}},before=structuredClone(state);
 let card=createGamePackOverlay(state).cards[0];assert.equal(card.title,'Employés virés');assert.equal(card.actionLabels[0],card.title);assert.equal(card.giftName,'Hat and Mustache');assert.deepEqual(state,before);
 rule.gameInteraction.title='Mes employés font une pause';card=createGamePackOverlay(state).cards[0];assert.equal(card.title,rule.gameInteraction.title);
});
