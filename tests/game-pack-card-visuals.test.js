'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),{RuleEngine}=require('../src/main/rule-engine'),{gamePackOverlayTrigger}=require('../src/shared/game-pack-overlay');
const effects=require('../resources/catalogs/supermarket-simulator-effects.json');
function fixture({fixed=false,publicSource=false}={}){
 const dom=new JSDOM('<main id="pack"><div id="cards"></div><div id="reaction"></div></main>',{runScripts:'outside-only',url:'https://overlay.test/game-pack.html?profile=p'+(publicSource?'&channel=fixture':'')}),w=dom.window,timers=new Map();let now=10000,next=0;
 const listeners=new Map();w.EventSource=class{addEventListener(name,fn){listeners.set(name,fn);}close(){}};
 const publicPut=data=>listeners.get('put')({data:JSON.stringify({path:'/',data})});
 w.Date.now=()=>now;w.requestAnimationFrame=()=>++next;w.cancelAnimationFrame=()=>{};
 w.setTimeout=(fn,ms)=>{const id=++next;timers.set(id,{fn,at:now+ms});return id;};w.clearTimeout=id=>timers.delete(id);
 w.ShenPulseGamePackLayout=require('../resources/overlays/game-pack-layout');w.eval(fs.readFileSync(path.join(__dirname,'../resources/overlays/runtime/game-pack.js'),'utf8'));
 const state={enabled:true,packId:'supermarket-simulator',profileId:'p',presentation:{model:1,motion:fixed?'fixed':'animated',configured:true},cards:Array.from({length:12},(_,i)=>({id:'card-'+i,column:i<6?'help':'trap',title:'Titre '+i,triggerType:'gift'}))};
 w.ShenPulseGamePack.render(state);
 const trigger=(index=0,extra={})=>w.ShenPulseGamePack.trigger({profileId:'p',packId:state.packId,ruleId:'card-'+index,viewer:'Camille',...extra});
 const advance=ms=>{const end=now+ms;for(;;){const found=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!found||found[1].at>end)break;now=found[1].at;timers.delete(found[0]);found[1].fn();}now=end;};
 return {dom,w,doc:w.document,state,trigger,advance,timers,publicPut};
}

test('une réception allume uniquement la bonne carte, avec étincelles et texte sûr',t=>{
 const f=fixture();t.after(()=>f.dom.window.close());f.trigger(2,{viewer:'<img onerror=alert(1)>'});
 assert.equal(f.doc.querySelectorAll('.hit').length,1);const card=f.doc.querySelector('[data-rule="card-2"]');assert.ok(card.classList.contains('hit'));assert.equal(card.querySelectorAll('.card-spark').length,10);assert.equal(card.querySelector('.card-combo').hidden,true);
 assert.match(f.doc.querySelector('#reaction').textContent,/<img onerror/);assert.equal(f.doc.querySelector('#reaction img'),null);
 f.advance(1200);assert.equal(f.doc.querySelectorAll('.card-sparks').length,0);assert.ok(card.classList.contains('hit'));f.advance(1000);assert.equal(f.doc.querySelectorAll('.hit,.card-combo').length,0);
});

test('les répétitions renforcent la carte et sa durée sans que les anciens timers annulent la dernière réception',t=>{
 const f=fixture();t.after(()=>f.dom.window.close());f.trigger();const card=f.doc.querySelector('[data-rule="card-0"]'),first=card.querySelectorAll('.card-spark').length;
 f.advance(1000);for(let i=0;i<4;i++)f.trigger();assert.equal(card.dataset.pendingGifts,'3');f.advance(2400);
 assert.equal(card.querySelector('.card-combo').textContent,'×5');assert.equal(card.style.getPropertyValue('--hit-strength'),'3');assert.ok(card.querySelectorAll('.card-spark').length>first);assert.ok(card.querySelectorAll('.card-spark').length<=64);
 f.advance(1000);assert.ok(card.classList.contains('hit'),'Le timer de la première réception est annulé.');f.advance(1500);assert.equal(f.doc.querySelectorAll('.hit,.card-spark,.card-combo').length,0);
});

test('les gros combos et douze cartes simultanées restent bornés, puis tous les éléments temporaires sont libérés',t=>{
 const f=fixture();t.after(()=>f.dom.window.close());for(let repeat=0;repeat<12;repeat++)for(let i=0;i<12;i++)f.trigger(i,{count:1,comboCount:100});
 assert.equal(f.doc.querySelectorAll('.hit').length,12);assert.ok(f.doc.querySelectorAll('.card-spark').length<=240);
 for(const card of f.doc.querySelectorAll('.gift-card')){assert.ok(card.querySelectorAll('.card-spark').length<=64);assert.ok(Number(card.querySelector('.card-combo').textContent.slice(1))>=100);}
 f.advance(15000);for(const card of f.doc.querySelectorAll('.gift-card'))assert.equal(card.dataset.giftPulses,'12');assert.equal(f.doc.querySelectorAll('.card-sparks,.card-spark,.card-combo,.hit').length,0);assert.equal(f.timers.size,0);
});

test('Fixe conserve un retour visuel sans particules et les changements de profil nettoient la réaction',t=>{
 const f=fixture({fixed:true});t.after(()=>f.dom.window.close());f.trigger(0,{count:5});assert.equal(f.doc.querySelectorAll('.card-spark').length,0);assert.equal(f.doc.querySelector('.card-combo').textContent,'×5');
 f.w.ShenPulseGamePack.render(structuredClone(f.state));assert.equal(f.doc.querySelector('.card-combo').textContent,'×5','Un sondage identique conserve la réaction.');
 f.w.ShenPulseGamePack.render({...f.state,profileId:'other'});assert.equal(f.doc.querySelectorAll('.card-sparks,.card-combo,.hit,.gift-card').length,0);f.trigger();assert.equal(f.doc.querySelectorAll('.hit').length,0);assert.equal(f.timers.size,0);
});

test('les titres restent du texte et une reconstruction ne conserve aucune particule obsolète',t=>{
 const f=fixture();t.after(()=>f.dom.window.close());f.trigger();f.state.cards[0].title='<b>Un très long titre</b>';f.w.ShenPulseGamePack.render(f.state);assert.equal(f.doc.querySelectorAll('.hit,.card-spark,.card-combo').length,0);assert.equal(f.doc.querySelector('h2 b'),null);assert.equal(f.doc.querySelector('h2 .card-title-text').textContent,'<b>Un très long titre</b>');assert.equal(f.timers.size,0);
});

test('dix cadeaux exécutent toujours dix effets : le compteur de combo est strictement visuel',async()=>{
 const packId='supermarket-simulator',action={id:'effect',type:'game.effect',config:{packId,effectId:effects[0].id}},rule={id:'game',enabled:true,chance:1,trigger:{type:'gift',threshold:1,repeatGiftCombos:false},conditions:[],actions:[action]},state={session:{profileId:'p',game:{running:true,profileId:'p',packId}},profiles:[{id:'p',enabledRuleIds:[]}],rules:[],game:{interactionRulesByPack:{[packId]:[rule]}}},triggers=[];
 const engine=new RuleEngine({store:{getState:()=>state},actionRunner:{run:async()=>{}}});engine.on('action-result',result=>{const payload=gamePackOverlayTrigger({...result,profileId:'p'});if(payload)triggers.push(payload);});
 await engine.process({id:'event',type:'gift',source:'source_tiktok',user:{id:'private',displayName:'Camille'},data:{giftId:'rose',giftName:'Rose',count:10,raw:{repeatCount:10,giftComboId:'private-combo'}}});
 assert.equal(triggers.length,10);assert.equal(triggers.reduce((sum,p)=>sum+p.count,0),10);assert.ok(triggers.every(p=>p.comboCount===10));assert.doesNotMatch(JSON.stringify(triggers),/private/);
 assert.equal(gamePackOverlayTrigger({ok:false,rule,action,profileId:'p'}),null);
});


test('un combo annoncé à dix puis livré en dix unités reste affiché ×10, jamais ×19',t=>{
 const f=fixture();t.after(()=>f.dom.window.close());for(let index=0;index<10;index++)f.trigger(0,{count:1,comboCount:10});
 assert.equal(f.doc.querySelector('.card-combo').textContent,'×10');assert.equal(f.doc.querySelector('.gift-card').dataset.pendingGifts,'9');f.advance(7200);assert.equal(f.doc.querySelector('.gift-card').dataset.giftPulses,'10');assert.equal(f.doc.querySelector('.card-combo').textContent,'×10');
});


test('passer en Fixe retire les particules actives sans reconstruire ni réduire les cartes',t=>{
 const f=fixture();t.after(()=>f.dom.window.close());const card=f.doc.querySelector('.gift-card');f.trigger();assert.ok(f.doc.querySelector('.card-spark'));f.state.presentation.motion='fixed';f.w.ShenPulseGamePack.render(f.state);
 assert.equal(f.doc.querySelector('.gift-card'),card);assert.equal(f.doc.querySelectorAll('.card-spark,.card-combo,.hit').length,0);assert.equal(f.timers.size,0);
});


test('vingt roses : vingt impulsions et vingt gerbes distinctes, en livraison groupée ou unitaire',t=>{
 for(const delivery of ['bulk','units','increments']){
  const f=fixture();t.after(()=>f.dom.window.close());const card=f.doc.querySelector('.gift-card');
  if(delivery==='bulk')f.trigger(0,{count:20,comboCount:20});
  else if(delivery==='units')for(let i=0;i<20;i++)f.trigger(0,{count:1,comboCount:20});
  else {let total=0;for(const count of [1,2,4,3,10]){total+=count;f.trigger(0,{count,comboCount:total});}}
  assert.equal(card.dataset.giftPulses,'1');assert.equal(card.dataset.pendingGifts,'19');
  for(let pulse=2;pulse<=20;pulse++){
   f.advance(799);assert.equal(card.dataset.giftPulses,String(pulse-1),delivery);
   f.advance(1);assert.equal(card.dataset.giftPulses,String(pulse),delivery);assert.ok(card.querySelector('.card-spark'),'Chaque impulsion a ses étincelles.');
  }
  f.advance(6000);assert.equal(card.dataset.giftPulses,'20');assert.equal(card.dataset.pendingGifts,undefined);assert.equal(f.doc.querySelectorAll('.hit,.card-spark,.card-combo').length,0);assert.equal(f.timers.size,0);
 }
});

test('deux cartes jouent leurs files simultanément et chaque carte garde son viewer',t=>{
 const f=fixture();t.after(()=>f.dom.window.close());f.trigger(0,{count:20,viewer:'Alice'});f.trigger(1,{count:3,viewer:'Bob'});f.advance(1600);
 assert.equal(f.doc.querySelector('[data-rule="card-0"]').dataset.giftPulses,'3');assert.equal(f.doc.querySelector('[data-rule="card-1"]').dataset.giftPulses,'3');assert.match(f.doc.querySelector('#reaction').textContent,/Bob/);
 f.advance(19000);assert.equal(f.doc.querySelector('[data-rule="card-0"]').dataset.giftPulses,'20');assert.equal(f.doc.querySelector('[data-rule="card-1"]').dataset.giftPulses,'3');assert.equal(f.timers.size,0);
});

test('une livraison publique de vingt messages conserve vingt animations et ne rejoue pas le même lot',t=>{
 const f=fixture({publicSource:true});t.after(()=>f.dom.window.close());f.publicPut({state:{gamePacks:f.state},lastBatch:{id:'initial',messages:[]}});
 const batch={id:'twenty',messages:Array.from({length:20},()=>({channel:'game-pack-trigger',payload:{profileId:'p',packId:'supermarket-simulator',ruleId:'card-0',viewer:'Alice',count:1,comboCount:20}}))};
 f.publicPut({state:{gamePacks:f.state},lastBatch:batch});f.publicPut({state:{gamePacks:f.state},lastBatch:batch});
 const card=f.doc.querySelector('.gift-card');assert.equal(card.dataset.pendingGifts,'19');f.advance(22000);assert.equal(card.dataset.giftPulses,'20');assert.equal(f.timers.size,0);
});


test('moteur du jeu vers overlay : vingt roses exécutent vingt effets et jouent exactement vingt animations',async t=>{
 const f=fixture();t.after(()=>f.dom.window.close());const packId='supermarket-simulator',rule={id:'card-0',enabled:true,chance:1,trigger:{type:'gift',threshold:1,repeatGiftCombos:false},conditions:[],actions:[{id:'effect',type:'game.effect',config:{packId,effectId:effects[0].id}}]},state={session:{profileId:'p',game:{running:true,profileId:'p',packId}},profiles:[{id:'p',enabledRuleIds:[]}],rules:[],game:{interactionRulesByPack:{[packId]:[rule]}}};let executions=0;
 const engine=new RuleEngine({store:{getState:()=>state},actionRunner:{run:async()=>{executions++;}}});engine.on('action-result',result=>{const payload=gamePackOverlayTrigger({...result,profileId:'p'});if(payload)f.w.ShenPulseGamePack.trigger(payload);});
 await engine.process({id:'rose-series',type:'gift',source:'source_tiktok',user:{id:'viewer',displayName:'Alice'},data:{giftId:'rose',giftName:'Rose',count:20,raw:{repeatCount:20,giftComboId:'combo'}}});
 const card=f.doc.querySelector('[data-rule="card-0"]');assert.equal(executions,20);assert.equal(card.dataset.giftPulses,'1');assert.equal(card.dataset.pendingGifts,'19');f.advance(22000);assert.equal(card.dataset.giftPulses,'20');assert.equal(f.timers.size,0);
});
