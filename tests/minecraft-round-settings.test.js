
"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module');
const shared=require('../src/shared/minecraft-round-settings'),{MinecraftRoundTimer,normalizeMinecraftRoundSettings}=require('../src/main/game-round-timer'),{createGamePackOverlay}=require('../src/shared/game-pack-overlay');
const packs=require('../src/main/game-catalog').loadShenazenGameCatalog(path.resolve('resources')),ids=['minecraft-bedrock-box','minecraft-sandbox-3'];
function fixture(){const file=path.resolve('tests/external-game-workspace.test.js'),source=fs.readFileSync(file,'utf8'),m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source.slice(0,source.indexOf("test('les 45"))+'\nmodule.exports={fixture};',file);return m.exports.fixture();}
test('le défaut de quinze minutes est commun au moteur, au formulaire et à la projection, les valeurs enregistrées sont conservées',t=>{
 assert.equal(shared.DEFAULT_MINECRAFT_ROUND_MINUTES,15);assert.deepEqual(normalizeMinecraftRoundSettings(),{durationMinutes:15,autoRestart:false});
 for(const id of ids){const f=fixture();t.after(()=>f.dom.window.close());const pack=packs.find(p=>p.id===id);f.ctx.selectedGameId=id;f.ctx.snapshot.state.game.interactionRulesByPack[id]=[];f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);const state={...f.ctx.snapshot.state,commerce:{subscription:{tier:'pro',status:'active',source:'paid'}}};
 assert.equal(f.ctx.content.querySelector('#market-round [name="durationMinutes"]').value,'15');assert.equal(createGamePackOverlay(state,id).wins.roundTimer.durationSeconds,900);
 for(const minutes of [1,10,25,120]){state.game.roundSettingsByPack={[id]:{durationMinutes:minutes,autoRestart:true}};f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);assert.equal(f.ctx.content.querySelector('[name="durationMinutes"]').value,String(minutes));assert.equal(createGamePackOverlay(state,id).wins.roundTimer.durationSeconds,minutes*60);}
 }
});
test('les deux pages modernes retirent la fiche historique et gardent une seule gestion du temps avant les interactions',t=>{
 for(const id of ids){const f=fixture();t.after(()=>f.dom.window.close());const pack=packs.find(p=>p.id===id);f.ctx.selectedGameId=id;f.ctx.snapshot.state.game.interactionRulesByPack[id]=[];const before=JSON.stringify(f.ctx.snapshot.state);f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);const page=f.ctx.content,root=page.querySelector('.game-pack-workspace');
 assert.equal(page.querySelector('#market-setup,[data-native-setup],[data-native-server]'),null);assert.equal(page.querySelectorAll('[data-minecraft-round-settings]').length,1);assert.equal(page.querySelector('#market-overlays [data-minecraft-round-settings]'),null);
 const order=[...root.children].map(n=>n.id);assert(order.indexOf('market-guide')<order.indexOf('market-round'));assert(order.indexOf('market-round')<order.indexOf('market-interactions'));
 assert.equal(page.querySelector('.game-pack-launch-actions [data-action="install-game"]').dataset.id,id);assert.equal(page.querySelector('.game-pack-launch-actions [data-action="launch-game"]').dataset.id,id);
 const steps=JSON.parse(page.querySelector('[data-game-tour-steps]').dataset.gameTourSteps);assert(steps.some(s=>s.target==='#market-round'));assert.equal(steps.some(s=>s.target==='#market-setup'),false);assert.equal(JSON.stringify(f.ctx.snapshot.state),before);
 }
});
test('le bouton du nouveau bloc enregistre la durée et la relance avec le contrôleur existant',async t=>{
 const f=fixture();t.after(()=>f.dom.window.close());const pack=packs.find(p=>p.id===ids[1]),saved=[];f.ctx.selectedGameId=pack.id;f.ctx.snapshot.state.game.interactionRulesByPack[pack.id]=[];f.ctx.content.innerHTML=f.ctx.renderSupermarketWorkspace(pack);f.ctx.showActiveGameConflict=()=>false;f.ctx.requireGameAccess=()=>true;f.ctx.perform=fn=>fn();f.ctx.acceptSnapshot=()=>{};f.ctx.render=()=>{};f.ctx.api.saveGameRoundSettings=async(id,settings)=>{saved.push({id,settings});return f.ctx.snapshot;};
 vm.runInContext(fs.readFileSync('src/renderer/app/actions/handlers/navigation-games.js','utf8'),f.ctx);const form=f.ctx.content.querySelector('[data-minecraft-round-settings]');form.querySelector('[name="durationMinutes"]').value='25';form.querySelector('[name="autoRestart"]').checked=true;
 await f.ctx.handleNavigationAndGameEditorAction({action:'save-game-round-settings',id:pack.id,target:form.querySelector('button')});assert.deepEqual(JSON.parse(JSON.stringify(saved)),[{id:pack.id,settings:{durationMinutes:25,autoRestart:true}}]);
});
test('sans durée enregistrée le vrai service arme quinze minutes pour les deux serveurs',async()=>{
 for(const id of ids){const state={game:{roundSettingsByPack:{}},session:{game:{running:true,packId:id,profileId:'p'}},overlaySession:{}},actions=[],commands=[],timers=[],timer=new MinecraftRoundTimer({store:{getState:()=>state,mutate:fn=>fn(state)},actionRunner:{run:async a=>{actions.push(a);return {};}},gameHub:{executeMinecraftCommands:async(_id,list)=>commands.push(...list)},setTimeoutFn:(_fn,ms)=>{timers.push(ms);return {unref(){}};},clearTimeoutFn(){}});const result=await timer.start(id);assert.equal(result.durationSeconds,900);assert.equal(timers[0],900000);assert.equal(actions[0].config.seconds,900);assert(commands.includes('shenpulse_win timer 900'));await timer.dispose();}
});
