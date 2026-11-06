"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const {RuleEngine}=require('../src/main/rule-engine');
const {GiftComboPolicy}=require('../src/main/gift-combo-policy');
const {TikTokGiftDelivery}=require('../src/main/sources/tiktok-gift-delivery');
const {tiktokConnectorPayload}=require('../src/main/sources/tiktok-protocol');
const {normalizeEvent}=require('../src/main/event-normalizer');
const {LiveEventActionService}=require('../src/main/core/live-event-actions');
function fixture(rules){const state={session:{profileId:'profile',game:{running:true,profileId:'profile',packId:'game'}},profiles:[{id:'profile',enabledRuleIds:rules.map(r=>r.id)}],rules,game:{interactionRulesByPack:{}}},calls=[];const engine=new RuleEngine({store:{getState:()=>state},actionRunner:{run:async(action,context)=>calls.push({action,context})}});return {state,calls,engine};}
function rule(id,repeat){return {id,enabled:true,chance:1,trigger:{type:'gift',threshold:1,...(repeat===undefined?{}:{repeatGiftCombos:repeat})},conditions:[],actions:[{id:'sound',type:'audio.play',config:{volume:.4}},{id:'effect',type:'game.effect',config:{quantity:2}}]};}
function event(count=1,extra={}){return {id:'event',type:'gift',source:'source_tiktok',user:{id:'viewer',displayName:'Alice'},data:{giftId:'rose',giftName:'Rose',count,...extra}};}
test('décoché par défaut : 20 roses exécutent chaque action une seule fois, sans altérer le don',async()=>{for(const flag of [undefined,false]){const f=fixture([rule('one',flag)]),gift=event(20),before=structuredClone(gift);await f.engine.process(gift);assert.equal(f.calls.length,2);assert.deepEqual(f.calls.map(c=>c.context.data.count),[1,1]);assert.deepEqual(gift,before);assert.equal(f.calls[1].action.config.quantity,2);}});
test('coché : 5 roses exécutent les deux actions 5 fois avec leur volume et leurs paramètres',async()=>{const f=fixture([rule('repeat',true)]);await f.engine.process(event(5));assert.equal(f.calls.length,10);assert.equal(f.calls.filter(c=>c.action.type==='audio.play').length,5);assert.ok(f.calls.every(c=>c.context.data.count===1));assert.equal(f.calls[0].action.config.volume,.4);});
test('un combo incrémental 1 → 2 → 5 → fin 5 reste unique par déclencheur, répétition indépendante',async()=>{const delivery=new TikTokGiftDelivery(),f=fixture([rule('once'),rule('every',true)]);let total=0;for(const [count,end] of [[1,false],[2,false],[5,false],[5,true]]){const raw={common:{roomId:'room',msgId:'same'},groupId:'combo',user:{id:'viewer'},giftId:5655,giftDetails:{id:5655,name:'Rose',type:1,diamondCount:1},repeatCount:count,repeatEnd:end};const payload=delivery.accept(raw,tiktokConnectorPayload('gift',raw,'creator'));if(!payload)continue;const normalized=normalizeEvent({event:'gift',data:payload},'source_tiktok');total+=normalized.data.count;await f.engine.process(normalized);}assert.equal(total,5);assert.equal(f.calls.filter(c=>c.context.rule.id==='once').length,2);assert.equal(f.calls.filter(c=>c.context.rule.id==='every').length,10);});

test('un délai configuré ne supprime pas les répétitions autorisées d’un combo progressif',async()=>{const once=rule('once'),every=rule('every',true);for(const r of [once,every])r.cooldown={globalMs:60000,perUserMs:60000};const f=fixture([once,every]);for(const count of [1,1,3])await f.engine.process(event(count,{raw:{giftComboId:'combo'}}));assert.equal(f.calls.filter(c=>c.context.rule.id==='once').length,2);assert.equal(f.calls.filter(c=>c.context.rule.id==='every').length,10);});
test('les séries et spectateurs restent indépendants, sans bloquer deux cadeaux isolés rapprochés',async()=>{const f=fixture([rule('one')]);for(const [viewer,combo]of [['a','one'],['b','one'],['a','two']]){for(const count of [1,2]){const gift=event(count,{raw:{giftComboId:combo}});gift.user.id=viewer;await f.engine.process(gift);}}await f.engine.process(event(1));await f.engine.process(event(1));assert.equal(f.calls.length,10);});
test('les interactions du jeu et les actions globales gardent leurs propres choix de combo',async()=>{const f=fixture([rule('global')]);f.state.game.interactionRulesByPack.game=[rule('game',true)];await f.engine.process(event(5));assert.equal(f.calls.filter(c=>c.context.rule.id==='global').length,2);assert.equal(f.calls.filter(c=>c.context.rule.id==='game').length,10);});
test('le seuil cadeau est consommé sans laisser les répétitions supprimées dans la file',async()=>{const r=rule('threshold');r.trigger.threshold=2;const f=fixture([r]);await f.engine.process(event(20));assert.equal(f.calls.length,2);assert.equal(f.engine.thresholds.size,0);await f.engine.process(event(1));assert.equal(f.calls.length,2);await f.engine.process(event(1));assert.equal(f.calls.length,4);});
test('la réinitialisation de profil libère les séries suivies et ne modifie pas les likes',async()=>{const f=fixture([rule('one')]);const gift=event(1,{raw:{giftComboId:'combo'}});await f.engine.process(gift);await f.engine.process(gift);assert.equal(f.calls.length,2);f.engine.resetProfileState();await f.engine.process(gift);assert.equal(f.calls.length,4);const likes=rule('likes');likes.trigger.type='like';const g=fixture([likes]);await g.engine.process({...event(5),type:'like'});assert.equal(g.calls.length,10);});
test('roues : une seule rotation par combo par défaut, répétition facultative propre à chaque roue',async()=>{const wheels=[{id:'one',enabled:true,trigger:'Rose'},{id:'every',enabled:true,trigger:'Rose',repeatGiftCombos:true}],calls=[],state={session:{profileId:'profile'},settings:{overlayConfigs:{wheel:{wheels}}}},service=Object.create(LiveEventActionService.prototype);Object.assign(service,{store:{getState:()=>state},giftCatalog:{gifts:[]},wheelGiftCombos:new GiftComboPolicy(),actionRunner:{run:async action=>calls.push(action.config.wheelId)}});for(const count of [1,1,3])await service.handleWheelGiftTriggers(event(count,{raw:{giftComboId:'combo'}}));assert.equal(calls.filter(id=>id==='one').length,1);assert.equal(calls.filter(id=>id==='every').length,5);});
test('popup cadeau : option décochée, aide accessible et conservation quand elle est cochée',t=>{const dom=new JSDOM('<form></form>');t.after(()=>dom.window.close());const ctx=vm.createContext({ShenPulseActionAudio: require("../src/shared/action-audio"),escapeHtml:s=>String(s??'').replaceAll('&','&amp;').replaceAll('"','&quot;'),giftValueCondition:()=>null,conditionValue:()=>'',eventIconMarkup:()=>'🎁',giftForSavedReference:()=>null,GIFT_VALUE_OPERATOR_OPTIONS:[],document:dom.window.document});vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/renderer/app/features/media/gift-picker.js'),'utf8'),ctx);const form=dom.window.document.querySelector('form');for(const checked of [false,true]){form.innerHTML=ctx.giftTriggerConditionFields([],{repeatGiftCombos:checked});assert.equal(form.querySelector('[name=repeatGiftCombos]').checked,checked);assert.match(form.textContent,/Répéter avec les combos de cadeaux/);assert.match(form.querySelector('.field-info-button').getAttribute('title'),/20 roses/);assert.ok(form.querySelector('[role=tooltip]'));}});
test('éditeur sonore : enregistrer puis rouvrir conserve le choix, le décocher le retire',async t=>{const dom=new JSDOM('<main></main>');t.after(()=>dom.window.close());let editor,saved;const current=rule('sound',true);current.actions=[current.actions[0]];const ctx=vm.createContext({ShenPulseActionAudio: require("../src/shared/action-audio"),SOUND_LIBRARY:[],snapshot:{state:{settings:{}}},openEditor:value=>{editor=value;},field:()=>'',dialogSection:(_title,_description,body)=>body,soundPickerField:()=>'',triggerTypeOptions:()=>'',giftTriggerConditionFields:(_conditions,options)=>String(options.repeatGiftCombos),buildTriggerConditions:conditions=>conditions,api:{upsert:async(_kind,value)=>{saved=value;},getSnapshot:async()=>({})},ensureRuleInActiveProfile:async()=>{},cryptoId:()=> 'id'});vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/renderer/app/features/action-sounds.js'),'utf8'),ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/renderer/app/editors/media-timer.js'),'utf8'),ctx);ctx.openSoundEditor({rule:current,action:current.actions[0],actionIndex:0});assert.match(editor.body,/true/);const data=new dom.window.FormData();for(const [key,value]of Object.entries({triggerType:'gift',threshold:'1',soundUrl:'file:test',volume:'.4',cooldown:'0',repeatGiftCombos:'true'}))data.set(key,value);await editor.onSubmit(data);assert.equal(saved.trigger.repeatGiftCombos,true);ctx.openSoundEditor({rule:saved,action:saved.actions[0],actionIndex:0});data.delete('repeatGiftCombos');await editor.onSubmit(data);assert.equal(saved.trigger.repeatGiftCombos,false);});

test('jeux : dix roses produisent dix interactions malgré un ancien choix décoché ou absent',async()=>{
 for(const flag of [undefined,false,true]){
  const f=fixture([rule('global-once',false),rule('global-repeat',true)]);
  f.state.game.interactionRulesByPack.game=[rule('game',flag)];const before=structuredClone(f.state);
  await f.engine.process(event(10));
  assert.equal(f.calls.filter(c=>c.context.rule.id==='game'&&c.action.type==='game.effect').length,10);
  assert.equal(f.calls.filter(c=>c.context.rule.id==='global-once'&&c.action.type==='audio.play').length,1);
  assert.equal(f.calls.filter(c=>c.context.rule.id==='global-repeat'&&c.action.type==='audio.play').length,10);
  assert.deepEqual(f.state,before,'La réparation ne remplace pas les réglages enregistrés');
 }
});
test('jeux : les incréments TikTok et la fin répétée conservent exactement dix interactions',async()=>{
 const delivery=new TikTokGiftDelivery(),f=fixture([rule('global')]);f.state.game.interactionRulesByPack.game=[rule('game',false)];
 for(const [count,end]of [[1,false],[3,false],[7,false],[10,false],[10,true],[10,true]]){
  const raw={common:{roomId:'room',msgId:'same'},groupId:'series',user:{id:'viewer'},giftId:5655,giftDetails:{id:5655,name:'Rose',type:1,diamondCount:1},repeatCount:count,repeatEnd:end};
  const payload=delivery.accept(raw,tiktokConnectorPayload('gift',raw,'creator'));
  if(payload)await f.engine.process(normalizeEvent({event:'gift',data:payload},'source_tiktok'));
 }
 const game=f.calls.filter(c=>c.context.rule.id==='game'&&c.action.type==='game.effect');
 assert.equal(game.length,10);assert.equal(f.calls.filter(c=>c.context.rule.id==='global'&&c.action.type==='audio.play').length,1);
 assert.ok(game.every(c=>c.context.data.count===1&&c.action.config.quantity===2));
});
test('jeux : seuils, wins, profil et session restent appliqués avec les combos obligatoires',async()=>{
 const f=fixture([]),r=rule('wins',false);r.trigger.threshold=3;r.actions=[{id:'win',type:'overlay.win-counter',config:{amount:-2}}];f.state.game.interactionRulesByPack.game=[r];
 await f.engine.process(event(10));assert.equal(f.calls.length,3);assert.ok(f.calls.every(c=>c.action.config.amount===-2));
 await f.engine.process(event(2));assert.equal(f.calls.length,4);
 f.state.session.game.running=false;await f.engine.process(event(10));assert.equal(f.calls.length,4);
 f.state.session.game.running=true;f.state.session.game.profileId='other';await f.engine.process(event(10));assert.equal(f.calls.length,4);
});

test('le formulaire des jeux explique les combos obligatoires sans proposer de les désactiver',t=>{
 const dom=new JSDOM('<form></form>');t.after(()=>dom.window.close());
 const ctx=vm.createContext({escapeHtml:s=>String(s??'').replaceAll('&','&amp;').replaceAll('"','&quot;'),giftValueCondition:()=>null,conditionValue:()=>'',eventIconMarkup:()=>'gift',giftForSavedReference:()=>null,GIFT_VALUE_OPERATOR_OPTIONS:[],document:dom.window.document});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/renderer/app/features/media/gift-picker.js'),'utf8'),ctx);
 const form=dom.window.document.querySelector('form');form.innerHTML=ctx.giftTriggerConditionFields([],{giftCombosRequired:true,repeatGiftCombos:false});
 assert.equal(form.querySelector('[name=repeatGiftCombos]'),null);
 assert.match(form.querySelector('[data-game-gift-combos]').textContent,/toujours actifs/);
 form.innerHTML=ctx.giftTriggerConditionFields([]);assert.equal(form.querySelector('[name=repeatGiftCombos]').checked,false,'Les actions globales conservent leur choix décoché');
});
