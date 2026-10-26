"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."), effects = require("../resources/catalogs/hogwarts-legacy-effects.json");
const lua54 = process.env.SHENPULSE_LUA54 || ["emulator-zShMbJ", "emulator-m3FQOP", "emulator-mvD1kf", "emulator-mfl88y"].map(folder => path.join(root, ".artifacts/cc-audit", folder, "BizHawk/Bizhawk-2.9.1/dll/lua54.dll")).find(file => fs.existsSync(file));
test("le runtime Lua Hogwarts conserve les états, les échéances et les refus du jeu", { skip: process.platform !== "win32" || !lua54 ? "Lua 5.4 Windows requis (SHENPULSE_LUA54)" : false }, () => {
  const output = execFileSync("python", [path.join(root, "tests/fixtures/lua-runtime-runner.py"), lua54, path.join(root, "tests/fixtures/hogwarts-runtime-harness.lua")], { cwd: root, windowsHide: true, encoding: "utf8", env: { ...process.env, SHENPULSE_HOGWARTS_TEST_CODES: effects.map(effect => effect.code).join(",") } });
  assert.match(output, /Hogwarts behavior checks passed \(\d+\)/);
});


test("les 73 cadeaux Hogwarts traversent les règles et le vrai canal de fichiers sans activer une autre session", async t => {
 const fsp=fs.promises, os=require("node:os");
 const {loadShenazenGameCatalog}=require("../src/main/game-catalog"), {ShopGameBridge}=require("../src/main/shop-game-bridge");
 const {RuleEngine}=require("../src/main/rule-engine"), {ActionRunner}=require("../src/main/action-runner"), {GameHub}=require("../src/main/game-hub");
 const {createDefaultState}=require("../src/main/defaults"), {getRuleEngineState,getStateProjection}=require("../src/main/state/projections");
 const {defaultGameInteractionRule}=require("../src/main/game-hub/interaction-defaults"), {normalizeEvent}=require("../src/main/event-normalizer");
 const {authenticatedFixtureStore}=require("./helpers/authenticated-store");
 const dir=await fsp.mkdtemp(path.join(os.tmpdir(),"shenpulse-hogwarts-")), binary=path.join(dir,"Phoenix/Binaries/WinGDK"), channel=path.join(binary,"ue4ss/Mods/ShenPulse"), token="b".repeat(64), gameId="hogwarts-legacy";
 t.after(async()=>{clearInterval(poll);while(polling)await new Promise(resolve=>setTimeout(resolve,5));await fsp.rm(dir,{recursive:true,force:true});}); await fsp.mkdir(channel,{recursive:true});
 await fsp.writeFile(path.join(channel,"bridge.json"),JSON.stringify({gameId,token}));await fsp.writeFile(path.join(binary,"HogwartsLegacy.exe"),"fixture");await fsp.writeFile(path.join(channel,"ready.json"),JSON.stringify({gameId,token,at:Date.now()/1000,ready:true}));
 const received=[], seen=new Set(); let polling=false, failure;
 const poll=setInterval(async()=>{if(polling)return;polling=true;try{
  await fsp.writeFile(path.join(channel,"ready.json"),JSON.stringify({gameId,token,at:Date.now()/1000,ready:true})); const data=await fsp.readFile(path.join(channel,"request.lua"),"utf8").catch(()=>""); if(!data)return;
  const req={};for(const match of data.matchAll(/(\w+)=("(?:\\\d{3}|[^"\\])*"|-?\d+(?:\.\d+)?)/g))req[match[1]]=match[2][0]==='"'?match[2].slice(1,-1).replace(/\\(\d{3})/g,(_,n)=>String.fromCharCode(+n)):+match[2];
  if(seen.has(req.id))return;seen.add(req.id);assert.equal(req.token,token);received.push(req);
  await fsp.writeFile(path.join(channel,"result.json"),JSON.stringify({id:req.id,gameId,status:0,executionConfirmed:true}));
 }catch(e){failure=e;}finally{polling=false;}},5);t.after(()=>clearInterval(poll));
 const game=loadShenazenGameCatalog(path.join(root,"resources")).find(g=>g.id===gameId),state=createDefaultState();
 state.settings.account={uid:"hogwarts-user",email:"hogwarts@example.test",refreshTokenSecretId:"fixture-account"};state.commerce.subscription={tier:"pro",source:"subscription",status:"active"};state.rules=[];
 state.game.installations[gameId]={path:dir};state.session.game={running:true,packId:gameId,profileId:state.session.profileId};
 const store=authenticatedFixtureStore({getState:()=>structuredClone(state),getStateProjection:paths=>getStateProjection(state,{},paths),getRuleEngineState:type=>getRuleEngineState(state,type)});
 const hub=new GameHub({store,resourcesDirectory:path.join(root,"resources")});hub.packs=[game];t.after(()=>hub.disconnectAll());
 const bridge=new ShopGameBridge({gameId,installationPath:binary});hub.serverBridges.set(gameId+":shop-mod",bridge);
 const engine=new RuleEngine({store,actionRunner:new ActionRunner({store,gameHub:hub})}),errors=[];engine.on("action-result",r=>{if(!r.ok)errors.push(r.error?.message);});
 const viewer='Élodie "cadeau" 🦆';
 for(const effect of game.effects){
  const mapping=game.defaultMappings.find(m=>m.effectId===effect.id),rule=defaultGameInteractionRule(game,effect,{...mapping,triggerEnabled:true},game.interactionCatalogVersion);
  rule.conditions=[{field:"data.giftName",operator:"equals",value:effect.name,giftId:"fixture-"+effect.code}];state.game.interactionRulesByPack[gameId]=[rule];
  await engine.process(normalizeEvent({event:"gift",data:{giftId:"fixture-"+effect.code,giftName:effect.name,count:1,user:{id:"hogwarts-viewer",nickname:viewer}}},"tiktok"));
 }
 assert.ifError(failure);assert.deepEqual(errors,[]);assert.equal(received.length,73);assert.deepEqual(received.map(r=>r.code),game.effects.map(e=>e.code));
 assert.ok(received.every(r=>r.viewer===viewer&&r.quantity===1&&r.expiresAt>Date.now()-12000));assert.equal(received.find(r=>r.code==="invincible_30").duration,30);
 state.session.game.running=false;await engine.process(normalizeEvent({event:"gift",data:{giftId:"fixture-teleportation",giftName:game.effects.at(-1).name,user:{nickname:viewer}}},"tiktok"));assert.equal(received.length,73);
});
