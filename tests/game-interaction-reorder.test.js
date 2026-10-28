"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {JSDOM}=require('jsdom'),order=require('../src/shared/game-interaction-order');
const directory=path.resolve('src/renderer/app/features/games/workspace');
function fixture(t,{onMove,onError}={}){
 const dom=new JSDOM('<main id="content"><div class="game-pack-workspace" data-game-pack="test"><section><div data-game-reorder-list="help"></div><div data-game-reorder-list="trap"></div></section></div></main>',{runScripts:'outside-only',pretendToBeVisual:true}),doc=dom.window.document,root=doc.querySelector('.game-pack-workspace');root.dataset.gameTourScope=JSON.stringify(['owner','profile','test']);
 const rect=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height,width,height});
 const list=root.querySelector('[data-game-reorder-list="help"]'),other=root.querySelector('[data-game-reorder-list="trap"]');list.getBoundingClientRect=()=>rect(0,0,300,300);other.getBoundingClientRect=()=>rect(400,0,300,300);
 for(const [target,ids]of [[list,['a','b','c']],[other,['d']]])for(const id of ids){const card=doc.createElement('article');card.dataset.gameReorderItem='';card.dataset.rule=id;card.innerHTML='<button data-game-drag-handle aria-pressed="false">⠿</button><input value="Texte conservé">';card.getBoundingClientRect=()=>rect(target===list?0:400,[...target.children].indexOf(card)*100,300,100);target.append(card);}
 dom.window.ShenPulseGameWorkspace={};dom.window.eval(fs.readFileSync(path.join(directory,'reorder.js'),'utf8'));
 const calls=[],errors=[];const controller=dom.window.ShenPulseGameWorkspace.createInteractionSorter(doc,{onMove:onMove||(async move=>{calls.push(move);const ids=[...list.children].map(n=>n.dataset.rule),next=order.ordered(order.move(ids.map(id=>({id})),move));for(const rule of next)list.append([...list.children].find(node=>node.dataset.rule===rule.id));}),onError:onError||(error=>errors.push(error))});
 t.after(()=>{controller.destroy();dom.window.close();});
 function pointer(type,node,x,y,extra={}){const e=new dom.window.Event(type,{bubbles:true,cancelable:true});for(const [k,v]of Object.entries({clientX:x,clientY:y,pointerId:1,button:0,isPrimary:true,...extra}))Object.defineProperty(e,k,{value:v});node.dispatchEvent(e);return e;}
 const handle=id=>[...list.children,...other.children].find(n=>n.dataset.rule===id).querySelector('button');
 const key=(id,key)=>handle(id).dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
 return {dom,doc,root,list,other,calls,errors,controller,pointer,handle,key,ids:()=>[...list.children].map(n=>n.dataset.rule)};
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
test('l’ordre visuel est stable et indépendant des priorités et des actions',()=>{
 const rules=['a','b','c'].map((id,index)=>({id,priority:index,actions:[{type:'game.effect',config:{parameters:{count:4}}}],conditions:[{field:'data.giftName',value:'Rose'}],gameInteraction:{marketColumn:'trap'}})),before=structuredClone(rules);
 const moved=order.move(rules,{ruleId:'c',beforeRuleId:'a'});assert.deepEqual(order.ordered(moved).map(r=>r.id),['c','a','b']);assert.deepEqual(moved.map(r=>r.id),['a','b','c']);assert.deepEqual(rules,before);
 for(let i=0;i<moved.length;i++){const {displayOrder,...metadata}=moved[i].gameInteraction;assert.deepEqual({...moved[i],gameInteraction:metadata},before[i]);}
 assert.deepEqual(order.ordered([...moved,{id:'new'}]).map(r=>r.id),['c','a','b','new']);
 assert.equal(order.move(rules,{ruleId:'a',beforeRuleId:'b'}),rules);
 for(const move of [{ruleId:'missing',beforeRuleId:'a'},{ruleId:'a',beforeRuleId:'a'},{ruleId:'a',beforeRuleId:'b',afterRuleId:'c'}])assert.throws(()=>order.move(rules,move));
});
test('la poignée déplace vers le haut et le bas, avec repère et focus conservé',async t=>{
 const f=fixture(t),h=f.handle('a');f.pointer('pointerdown',h,8,35);f.pointer('pointermove',h,8,280);assert.equal(f.doc.querySelector('.game-pack-drop-indicator').hidden,false);assert.equal(h.getAttribute('aria-pressed'),'true');f.pointer('pointerup',h,8,280);await settle();assert.deepEqual(f.ids(),['b','c','a']);assert.equal(f.calls[0].afterRuleId,'c');assert.equal(f.calls[0].scope,f.root.dataset.gameTourScope);assert.equal(f.doc.activeElement,f.handle('a'));
 f.pointer('pointerdown',f.handle('a'),8,235);f.pointer('pointermove',f.handle('a'),8,4);f.pointer('pointerup',f.handle('a'),8,4);await settle();assert.deepEqual(f.ids(),['a','b','c']);assert.equal(f.calls[1].beforeRuleId,'b');
});
test('clic simple, champs de saisie, annulation et autre colonne ne changent rien',async t=>{
 const f=fixture(t);f.pointer('pointerdown',f.handle('a'),8,35);f.pointer('pointermove',f.handle('a'),10,37);f.pointer('pointerup',f.handle('a'),10,37);
 const input=f.list.querySelector('input');f.pointer('pointerdown',input,180,30);f.pointer('pointermove',input,180,280);f.pointer('pointerup',input,180,280);
 f.pointer('pointerdown',f.handle('a'),8,35);f.pointer('pointermove',f.handle('a'),8,280);f.key('a','Escape');f.pointer('pointerup',f.handle('a'),8,280);
 f.pointer('pointerdown',f.handle('a'),8,35);f.pointer('pointermove',f.handle('a'),450,150);f.pointer('pointerup',f.handle('a'),450,150);await settle();assert.equal(f.calls.length,0);assert.deepEqual(f.ids(),['a','b','c']);assert.equal(input.value,'Texte conservé');
});
test('clavier, états verrouillés et sauvegarde en cours respectent les limites',async t=>{
 const f=fixture(t);f.key('b','ArrowUp');await settle();assert.deepEqual(f.ids(),['b','a','c']);f.key('b','ArrowUp');await settle();assert.equal(f.calls.length,1);f.key('b','ArrowDown');await settle();assert.deepEqual(f.ids(),['a','b','c']);
 f.handle('a').disabled=true;f.key('a','ArrowDown');f.pointer('pointerdown',f.handle('a'),8,30);f.pointer('pointermove',f.handle('a'),8,280);f.pointer('pointerup',f.handle('a'),8,280);await settle();assert.equal(f.calls.length,2);
});
test('un profil ou une page remplacée annule le geste sans appel métier',async t=>{
 const f=fixture(t);f.pointer('pointerdown',f.handle('a'),8,30);f.pointer('pointermove',f.handle('a'),8,280);f.root.dataset.gameTourScope='other';f.pointer('pointerup',f.handle('a'),8,280);await settle();assert.equal(f.calls.length,0);assert.equal(f.doc.querySelector('.game-pack-drop-indicator').hidden,true);
 f.pointer('pointerdown',f.handle('a'),8,30);f.pointer('pointermove',f.handle('a'),8,280);f.root.remove();f.pointer('pointerup',f.handle('a'),8,280);await settle();assert.equal(f.calls.length,0);
});
test('un échec de sauvegarde conserve l’ordre et libère la poignée',async t=>{
 let reject;const f=fixture(t,{onMove:()=>new Promise((_resolve,no)=>reject=no)});f.key('a','ArrowDown');assert.ok(f.root.hasAttribute('data-game-order-saving'));f.key('b','ArrowDown');reject(Error('Écriture refusée'));await settle();assert.equal(f.errors.length,1);assert.deepEqual(f.ids(),['a','b','c']);assert.equal(f.root.hasAttribute('data-game-order-saving'),false);
});
test('le vrai IPC sauvegarde l’ordre par jeu/profil sans réécrire les règles métier',t=>{
 const {StateStore}=require('../src/main/store'),{registerGameInteractionOrderIpc}=require('../src/main/ipc/game-interaction-order'),{defaultGameInteractionRule}=require('../src/main/game-hub/interaction-defaults');
 const pack=require('../src/main/game-catalog').loadShenazenGameCatalog(path.resolve('resources')).find(p=>p.id==='supermarket-simulator'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'shenpulse-order-')),stores=[];
 t.after(()=>{for(const store of stores)for(const key of ['writeTimer','runtimeWriteTimer','persistenceRetryTimer'])clearTimeout(store[key]);assert.equal(path.dirname(dir),os.tmpdir());assert.ok(path.basename(dir).startsWith('shenpulse-order-'));fs.rmSync(dir,{recursive:true,force:true});});
 const store=new StateStore(dir,{isEncryptionAvailable:()=>false});stores.push(store);store.activateAccount('owner');store.set('settings.account',{uid:'owner',email:'owner@example.test',refreshTokenSecretId:store.setSecret('','test-refresh')});
 const rules=pack.defaultMappings.slice(0,3).map(mapping=>defaultGameInteractionRule(pack,pack.effects.find(e=>e.id===mapping.effectId),mapping,pack.interactionCatalogVersion));store.mutate(s=>{s.game.interactionRulesByPack[pack.id]=rules;s.game.interactionRulesByPack.other=[{id:'untouched'}];},true);
 const old=structuredClone(store.state.game.interactionRulesByPack),handlers=new Map();registerGameInteractionOrderIpc({handle:(name,fn)=>handlers.set(name,fn),core:{snapshot:()=>({state:store.getState()}),notifyRenderer(){}},store,requireGameAccess:id=>assert.equal(id,pack.id)});
 const move=options=>handlers.get('game:interactions:move')(null,pack.id,{accountUid:'owner',profileId:store.state.session.profileId,ruleId:rules[2].id,beforeRuleId:rules[0].id,...options});
 assert.throws(()=>move({accountUid:'wrong'}),/compte ou le profil/);assert.throws(()=>move({profileId:'wrong'}),/compte ou le profil/);move();
 const next=store.getState().game.interactionRulesByPack;assert.deepEqual(order.ordered(next[pack.id]).map(r=>r.id),[rules[2].id,rules[0].id,rules[1].id]);assert.deepEqual(next.other,old.other);for(let i=0;i<rules.length;i++){assert.deepEqual(next[pack.id][i].actions,rules[i].actions);assert.deepEqual(next[pack.id][i].conditions,rules[i].conditions);assert.equal(next[pack.id][i].priority,rules[i].priority);}
 const loaded=new StateStore(dir,{isEncryptionAvailable:()=>false});stores.push(loaded);loaded.load();assert.deepEqual(order.ordered(loaded.getState().game.interactionRulesByPack[pack.id]).map(r=>r.id),[rules[2].id,rules[0].id,rules[1].id]);
 const {createGamePackOverlay}=require('../src/shared/game-pack-overlay');const state=store.getState();state.commerce.subscription={tier:'pro',status:'active',source:'paid'};assert.deepEqual(createGamePackOverlay(state).cards.map(c=>c.id),[rules[2].id,rules[0].id,rules[1].id]);
});


test('les composants affichent le même ordre que le relais, y compris après une modification de règle',t=>{
 const dom=new JSDOM('',{runScripts:'outside-only'});t.after(()=>dom.window.close());dom.window.eval(fs.readFileSync('src/shared/game-interaction-order.js','utf8'));dom.window.eval(fs.readFileSync(path.join(directory,'core.js'),'utf8'));
 const pack={id:'demo',name:'Demo',effects:[{id:'one'},{id:'two'}]},first={id:'first',gameInteraction:{displayOrder:1}},second={id:'second',gameInteraction:{displayOrder:0}};
 const rows=dom.window.ShenPulseGameWorkspace.collectRows(pack,[{rule:first,action:{type:'game.effect',config:{packId:pack.id,effectId:'one'}}},{rule:second,action:{type:'game.effect',config:{packId:pack.id,effectId:'two'}}}]);assert.deepEqual(Array.from(rows,row=>row.rule.id),['second','first']);assert.equal(rows[0].rule,second);
});
