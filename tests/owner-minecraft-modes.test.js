"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const {loadShenazenGameCatalog}=require("../src/main/game-catalog");
const {GAME_INSTALLERS}=require("../src/main/game-installer-manifest");
const {createEffectPayload}=require("../src/main/game-hub/effect-payload");
const {ActionRunner}=require("../src/main/action-runner");
const {GameSessionService}=require("../src/main/core/game-sessions");
const {nativeMinecraftWinCommand}=require("../src/main/game-runtime/minecraft-native-wins");
const registry=require("../scripts/manifests/game-packs.json");
const packs=loadShenazenGameCatalog(path.resolve("resources")).filter(p=>["minecraft-diamond-rush","minecraft-box-cyber"].includes(p.id));

test("private Minecraft modes use the managed server and the same pinned runtime",()=>{
 assert.equal(packs.length,2);
 for(const pack of packs){
  const spec=GAME_INSTALLERS[pack.id];assert.equal(pack.ownerOnly,true);assert.equal(pack.connector.type,"minecraft-runtime");assert.equal(spec.requiresMinecraftEula,true);assert.equal(spec.managedTarget,true);assert.equal(pack.minecraftVersion,"1.20.4");assert.equal(pack.serverAddress,"127.0.0.1:"+spec.minecraftServer.port);
  const asset=spec.assets.find(a=>a.id==="minecraft-paper");const published=registry.assets.find(a=>a.gameId==="minecraft-owner-runtime");assert.equal(asset.sha256,published.sha256);assert.equal(asset.size,published.size);assert.equal(asset.url,"https://f003.backblazeb2.com/file/shenpulse-media/"+published.key);
  assert.ok(spec.assets.some(a=>a.id==="java"));assert.match(nativeMinecraftWinCommand(pack.id),/^shenpulse_(?:dr|box)$/);
  for(const effect of pack.effects.filter(e=>e.service==="native")){const payload=createEffectPayload(effect,{user:{displayName:"Tester; op @a"}});for(const command of payload.effect.commands){assert.match(command,new RegExp("^/"+nativeMinecraftWinCommand(pack.id)+" "));assert.doesNotMatch(command,/\{\{|[\r\n;]/);}}
 }
 assert.equal(nativeMinecraftWinCommand("untrusted-game"),"");
});

test("both modes synchronize wins and multipliers to their own console endpoint",async()=>{
 for(const pack of packs){const state={session:{},settings:{overlayConfigs:{winCounter:{target:15}}},overlaySession:{winCounterCurrent:7}};const commands=[];
  const runner=new ActionRunner({store:{getState:()=>state,mutateRuntime:fn=>fn(state)},gameHub:{assertAccess(){},executeMinecraftCommands:async(id,list)=>{assert.equal(id,pack.id);commands.push(...list);}},overlayServer:{publish(){}},notifyRenderer(){}});
  await runner.run({type:"overlay.win-counter",config:{packId:pack.id,operation:"adjust",amount:-2}});assert.equal(commands.at(-1),nativeMinecraftWinCommand(pack.id)+" sync 5 1 0 15");
  await runner.run({type:"overlay.win-counter",config:{packId:pack.id,operation:"multiplier",amount:3,duration:20}});assert.match(commands.at(-1),new RegExp("^"+nativeMinecraftWinCommand(pack.id)+" sync 5 3 (?:19|20) 15$"));
 }
});

test("native results affect only the current Minecraft session without a feedback loop",async()=>{
 for(const pack of packs){const state={session:{game:{running:true,packId:pack.id}},overlaySession:{winCounterCurrent:2}};const actions=[];
 const service=new GameSessionService({store:{getState:()=>state},gameHub:{listPacks:()=>[pack]},minecraftRoundTimer:{resolveNativeOutcome:async()=>({resolved:false})},actionRunner:{run:async action=>{actions.push(action);return{current:action.config.amount};}},notifyRenderer(){},onActivity(){},onChanged(){}});
 assert.equal((await service.handleMinecraftWinCounter({gameId:pack.id,current:3,source:"auto-win"})).synchronized,true);assert.equal(actions[0].config.packId,undefined);
 state.session.game.running=false;assert.equal((await service.handleMinecraftWinCounter({gameId:pack.id,current:4})).synchronized,false);assert.equal(actions.length,1);
 }
});
