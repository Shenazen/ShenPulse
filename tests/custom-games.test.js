"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const custom=require('../src/main/custom-games');
const shortcuts=require('../src/shared/custom-game-shortcuts');
const {WindowsInputService,normalizeWindowsInputSequence}=require('../src/main/windows-input-service');
const {GameHub}=require('../src/main/game-hub');
const {StateStore}=require('../src/main/store');
const {createGamePackOverlays,gamePackOverlayTrigger}=require('../src/shared/game-pack-overlay');
const resourcesDirectory=path.resolve(__dirname,'../resources');
function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'shenpulse-custom-'));
 const store=new StateStore(directory,{isEncryptionAvailable:()=>false});store.load();store.activateAccount('custom-user');
 store.set('settings.account',{uid:'custom-user',email:'custom@example.test',emailVerified:true,refreshTokenSecretId:store.setSecret('','fixture-refresh')});
 store.set('commerce.subscription',{tier:'pro',source:'subscription',status:'active'});
 const calls=[],windowsInputService=new WindowsInputService({execute:async(...args)=>{calls.push(args);return {ok:true};}});
 const hub=new GameHub({store,resourcesDirectory,packsDirectory:path.join(resourcesDirectory,'packs'),windowsInputService});hub.loadPacks();
 const handlers=new Map(),core={gameHub:hub,snapshot:()=>({packs:hub.listPacks(),state:store.getState()}),notifyRenderer:()=>{}};
 require('../src/main/ipc/custom-games').registerCustomGamesIpc({handle:(name,handler)=>handlers.set(name,handler),core,store,requireGameAccess:id=>hub.assertAccess(id)});
 const scope=()=>({accountUid:store.state.settings.account.uid,profileId:store.state.session.profileId});
 const save=(data={})=>handlers.get('game:custom:save')({}, {...scope(),name:'Mon jeu',processName:'TestGame',...data});
 t.after(()=>{clearTimeout(store.saveTimer);store.flush?.();fs.rmSync(directory,{recursive:true,force:true});});return {store,hub,calls,handlers,scope,save,core};
}
test('shortcuts compile literal AZERTY, chords, ordered releases and repeated sequences',()=>{
 const result=normalizeWindowsInputSequence(shortcuts.compile({shortcut:'maj+z ; r',holdMs:250,repeat:2,gapMs:100}));
 assert.deepEqual(result.slice(0,4).map(e=>[e.keyCode,e.action,e.delayMs]),[[160,'down',0],[90,'down',0],[90,'up',250],[160,'up',0]]);
 assert.equal(result.length,12);assert.equal(result[4].keyCode,82);
 assert.match(shortcuts.compile({shortcut:'num1 ; f12'}),/,97,0/);
});
test('standard key labels preserve the six initial bindings and accept historical aliases',()=>{
 const pack=custom.packFor(custom.metadata({name:'My game'})),rules=custom.createRules(pack).filter(rule=>rule.enabled);
 assert.deepEqual(rules.map(rule=>rule.actions[0].config.parameters.shortcut),['ESPACE','SHIFT','E','CTRL','A','R']);
 assert.deepEqual(rules.map(rule=>normalizeWindowsInputSequence(shortcuts.compile(rule.actions[0].config.parameters))[0].keyCode),[32,160,69,162,65,82]);
 for(const [alias,label]of [['echap','ESC'],['Escape','ESC'],['esc','ESC'],['space','ESPACE'],['maj','SHIFT'],['control','CTRL'],['enter','ENTRÉE'],['delete','SUPPR'],['r','R'],['num1','NUM1']]){
  assert.equal(shortcuts.format(alias),label);assert.equal(shortcuts.compile({shortcut:alias}),shortcuts.compile({shortcut:label}));
 }
 assert.equal(shortcuts.format('ctrl+e ; espace'),'CTRL + E ; ESPACE');
});
test('builder and personal packs share the default poster while personal artwork is preserved',()=>{
 const builder=custom.builderPack(),definition=custom.metadata({name:'Mon jeu'}),pack=custom.packFor(definition);
 assert.equal(builder.artwork,'personalise-tes-jeux.webp');assert.equal(pack.artwork,builder.artwork);assert.equal(pack.coverArtwork,builder.artwork);
 const image=fs.readFileSync(path.join(__dirname,'../src/renderer/assets/games',builder.artwork));
 assert.equal(image.toString('ascii',0,4),'RIFF');assert.equal(image.toString('ascii',8,12),'WEBP');
 const artworkUrl='data:image/png;base64,aW1hZ2U=',personal=custom.packFor({...definition,artworkUrl});
 assert.equal(personal.artworkUrl,artworkUrl);assert.equal(personal.coverArtwork,'');assert.equal(personal.customGameDefinition.artworkUrl,artworkUrl);
});
test('non-game assistant windows are excluded and legacy targets leave the cards intact',t=>{
 const f=fixture(t),{packId}=f.save(),rules=structuredClone(f.store.state.game.interactionRulesByPack[packId]);
 for(const processName of ['ChatGPT','chatgpt.exe','Codex','Claude','OpenAI'])assert.throws(()=>custom.metadata({name:'Mon jeu',processName}),/fenêtre du jeu/);
 assert.deepEqual(custom.gameWindows([{ProcessName:'ChatGPT',MainWindowTitle:'ChatGPT'},{ProcessName:'brave',MainWindowTitle:'ChatGPT – Brave'},{ProcessName:'ShenPulse',MainWindowTitle:'ShenPulse'},{ProcessName:'TestGame',MainWindowTitle:'Mon jeu'}]),[{processName:'TestGame',title:'Mon jeu'}]);
 f.store.mutate(draft=>{draft.game.customPacks=draft.game.customPacks.map(d=>({...d,processName:'ChatGPT'}));});
 const legacy=f.hub.assertAccess(packId);assert.equal(legacy.connector.processName,'');assert.equal(legacy.customGameDefinition.processName,'');
 assert.equal(legacy.effects.length,custom.packFor(custom.metadata({name:'Mon jeu'})).effects.length);
 assert.deepEqual(f.store.state.game.interactionRulesByPack[packId],rules);
});
test('shortcuts reject malformed, unsupported, dangerous and unbounded input',()=>{
 for(const shortcut of ['', 'win+r','ctrl++z','z+z','ctrl+alt+delete','alt+f4','not-a-key'])assert.throws(()=>shortcuts.compile({shortcut}));
 for(const data of [{repeat:1.5},{repeat:11},{holdMs:0},{holdMs:10001},{gapMs:-1},{repeat:10,holdMs:10000}])assert.throws(()=>shortcuts.compile({shortcut:'z',...data}));
});
test('custom creation is pinned, private to its workspace, and seeds only six active cards',t=>{
 const f=fixture(t),result=f.save(),pack=f.hub.assertAccess(result.packId),rules=f.store.state.game.interactionRulesByPack[pack.id];
 assert.equal(result.snapshot.packs[0].id,custom.BUILDER_ID);assert.equal(pack.customGame,true);
 assert.equal(rules.filter(r=>r.enabled).length,6);assert.equal(rules.filter(r=>r.enabled&&r.gameInteraction.marketColumn==='help').length,3);
 assert.equal(rules.filter(r=>r.enabled&&r.gameInteraction.marketColumn==='trap').length,3);
 const reference=f.hub.packs;assert.equal(f.hub.packs,reference);f.store.mutateRuntime(s=>{s.statistics.lifetimeActions++;});assert.equal(f.hub.packs,reference);
 const next=f.save({id:pack.id,name:'Autre nom'});assert.equal(next.packId,pack.id);assert.deepEqual(f.store.state.game.interactionRulesByPack[pack.id],rules);
 assert.throws(()=>f.handlers.get('game:custom:save')({}, {accountUid:'other',profileId:f.scope().profileId,name:'No'}),/profil/);
});
test('keyboard execution focuses its selected game and keeps its guarded parameters',async t=>{
 const f=fixture(t),{packId}=f.save();await f.hub.trigger('keyboard-jump',{source:'manual'},{packId,parameters:{shortcut:'ctrl+e',holdMs:200,repeat:2,gapMs:80}});
 assert.equal(f.calls.length,1);assert.equal(f.calls[0][0],'play-focus-foreground');assert.equal(f.calls[0][1],'TestGame');assert.equal(f.calls[0][3],'scan-code');assert.equal(f.calls[0][2].length,8);assert.equal(typeof f.calls[0][4].assertAccess,'function');
 await assert.rejects(f.hub.trigger('keyboard-jump',{}, {packId,parameters:{shortcut:'not-a-key'}}));assert.equal(f.calls.length,1);
 await f.hub.trigger('overlay-only',{}, {packId});assert.equal(f.calls.length,1);
});
test('a stopped personal session invalidates the queued input guard',async t=>{
 const f=fixture(t),{packId}=f.save();f.store.mutate(s=>{s.session.game={running:true,packId,startedAt:'test-session'};});
 await f.hub.trigger('keyboard-jump',{source:'gift'},{packId});
 const guard=f.calls[0][4].assertAccess;assert.doesNotThrow(guard);
 f.store.mutate(s=>{s.session.game={running:false};});assert.throws(guard,/session.*arrêtée/i);
});
test('profile switching, disk reload and account switching retain independent custom packs',t=>{
 const f=fixture(t),{packId}=f.save(),profileId=f.scope().profileId;
 f.store.upsert('profiles',{id:'another-profile',name:'Other',enabledRuleIds:[]});f.store.selectProfile('another-profile');
 assert.ok(!f.hub.listPacks().some(p=>p.id===packId));f.store.selectProfile(profileId);assert.equal(f.hub.assertAccess(packId).name,'Mon jeu');
 f.store.flush();const reloaded=new StateStore(f.store.directory,{isEncryptionAvailable:()=>false});reloaded.load();assert.ok(reloaded.state.game.customPacks.some(d=>d.id===packId));clearTimeout(reloaded.saveTimer);
 f.store.activateAccount('someone-else');assert.ok(!f.hub.listPacks().some(p=>p.id===packId));f.store.activateAccount('custom-user');assert.ok(f.hub.listPacks().some(p=>p.id===packId));
});
test('removal cannot touch standard games or active packs and removes only chosen pack',t=>{
 const f=fixture(t),a=f.save(),b=f.save({name:'Second'});
 const remove=id=>f.handlers.get('game:custom:remove')({}, {...f.scope(),id});assert.throws(()=>remove('coin-pusher'));
 f.store.mutate(s=>{s.session.game={running:true,packId:a.packId};});assert.throws(()=>remove(a.packId),/session/);
 f.store.mutate(s=>{s.session.game={running:false};});remove(a.packId);
 assert.ok(!f.hub.listPacks().some(p=>p.id===a.packId));assert.ok(f.hub.listPacks().some(p=>p.id===b.packId));assert.equal(f.store.state.game.interactionRulesByPack[a.packId],undefined);
});
test('custom overlay publishes cards, images and successful animation without target/private definitions',t=>{
 const f=fixture(t),{packId}=f.save(),state=f.store.getState(),overlay=createGamePackOverlays(state).packs[packId];
 assert.equal(overlay.cards.length,6);assert.ok(overlay.cards.every(card=>card.effectImageUrl.startsWith('data:image/svg+xml,')));
 assert.ok(!JSON.stringify(overlay).includes('TestGame'));assert.ok(!JSON.stringify(overlay).includes('refresh'));
 const rule=state.game.interactionRulesByPack[packId][0],action=rule.actions[0];assert.equal(gamePackOverlayTrigger({ok:true,rule,action,event:{user:{displayName:'Viewer'}},profileId:state.session.profileId}).packId,packId);
 assert.equal(gamePackOverlayTrigger({ok:false,rule,action,event:{}}),null);
});
test('reusable cards expose all keyboard parameters, including extra actions, and escape input',()=>{
 const pack=custom.packFor(custom.metadata({name:'My game',processName:'TestGame'})),rule=custom.createRules(pack)[0];rule.actions.push({...structuredClone(rule.actions[0]),id:'extra',config:{...rule.actions[0].config,effectId:'keyboard-reload'}});
 const ctx=vm.createContext({structuredClone,console});for(const file of ['core','interactions'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/renderer/app/features/games/workspace/'+file+'.js'),'utf8'),ctx);
 const C=ctx.ShenPulseGameWorkspace,context=C.createContext({pack,unlocked:true}),html=C.renderInteractionCard(context,{rule,action:rule.actions[0],effect:pack.effects[0],actionIndex:0});
 const dom=new JSDOM(html);assert.equal(dom.window.document.querySelectorAll('.game-pack-shortcut-parameters').length,2);assert.equal(dom.window.document.querySelectorAll('[data-parameter="shortcut"]').length,2);assert.equal(dom.window.document.querySelectorAll('[data-parameter-action="extra"]').length,4);
});
test('metadata validates process names and uploaded images without accepting scripts or URLs',()=>{
 for(const processName of ['powershell','ShenPulse','cmd','abc;whoami'])assert.throws(()=>custom.metadata({name:'Test',processName}));
 assert.throws(()=>custom.metadata({name:'',processName:'Game'}));assert.throws(()=>custom.metadata({name:'Test',artworkUrl:'https://example.test/image.png'}));
 assert.equal(custom.metadata({name:'  Mon   Jeu  ',processName:'Game.exe'}).processName,'Game');
});
