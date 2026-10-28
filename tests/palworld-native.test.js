"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs/promises"), os = require("node:os"), path = require("node:path"), crypto = require("node:crypto");
const { palworldBinaryDirectory, palworldInstallationPath, stagePalworldInstallation, assertPalworldModuleReady } = require("../src/main/game-runtime/palworld-installation");
const { ShopGameBridge } = require("../src/main/shop-game-bridge");
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
async function fixture(t, edition) {
 const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-palworld-"));
 t.after(() => fs.rm(temporary, { recursive: true, force: true }));
 const targetPath = edition === "steam" ? path.join(temporary, "steamapps/common/Palworld") : path.join(temporary, "XboxGames/Palworld/Content");
 const relative = "Pal/Binaries/" + (edition === "steam" ? "Win64" : "WinGDK");
 const binary = path.join(targetPath, relative), deploymentRoot = path.join(temporary, "stage");
 await fs.mkdir(path.join(binary, "ue4ss/Mods"), { recursive: true }); await fs.mkdir(path.join(deploymentRoot, "ue4ss/Mods/ShenPulse/Scripts"), { recursive: true });
 await fs.writeFile(path.join(binary, edition === "steam" ? "Palworld-Win64-Shipping.exe" : "Palworld-WinGDK-Shipping.exe"), "original-game");
 if(edition === "xbox") await fs.writeFile(path.join(targetPath, "MicrosoftGame.Config"), '<Game><Identity Name="PocketpairInc.Palworld" /></Game>');
 await fs.writeFile(path.join(binary, "ue4ss/Mods/mods.txt"), "OtherMod : 1\nCrowdControl : 1\n");
 await fs.writeFile(path.join(binary, "ue4ss/Mods/mods.json"), JSON.stringify([{mod_name:"OtherMod",mod_enabled:true},{mod_name:"CrowdControl",mod_enabled:true}]));
 const files = {"dwmapi.dll":"loader","ue4ss/UE4SS.dll":"runtime","ue4ss/Mods/ShenPulse/Scripts/main.lua":"own-module","THIRD-PARTY-NOTICES.txt":"MIT notice"};
 for(const [file,bytes] of Object.entries(files)) await fs.writeFile(path.join(deploymentRoot,file),bytes);
 await fs.writeFile(path.join(deploymentRoot,"shenpulse-module.json"),JSON.stringify({gameId:"palworld",version:"1.0.0",files:Object.entries(files).map(([file,bytes])=>({file,sha256:digest(bytes)}))}));
 return {temporary,targetPath,relative,binary,deploymentRoot};
}
for(const edition of ["steam","xbox"]) test("Palworld prépare uniquement la bonne édition "+edition+" et vérifie le module",async t=>{
 const f=await fixture(t,edition);
 assert.equal(await palworldBinaryDirectory(f.targetPath,edition),f.relative);
 await assert.rejects(palworldBinaryDirectory(f.targetPath,edition==="steam"?"xbox":"steam"),/exécutable/);
 assert.equal(await palworldInstallationPath(f.targetPath),f.binary);
 const result=await stagePalworldInstallation({gameId:"palworld",...f});
 assert.ok(result.retiredFiles.includes(f.relative+"/ue4ss/Mods/CrowdControl/enabled.txt"));
 const root=path.join(f.deploymentRoot,f.relative), config=JSON.parse(await fs.readFile(path.join(root,"ue4ss/Mods/ShenPulse/bridge.json"),"utf8"));
 assert.equal(config.gameId,"palworld"); assert.match(config.token,/^[a-f0-9]{64}$/);
 assert.match(await fs.readFile(path.join(root,"ue4ss/Mods/mods.txt"),"utf8"),/OtherMod : 1/);
 assert.doesNotMatch(await fs.readFile(path.join(root,"ue4ss/Mods/mods.txt"),"utf8"),/CrowdControl/);
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,"ue4ss/Mods/mods.json"),"utf8")),[{mod_name:"OtherMod",mod_enabled:true},{mod_name:"ShenPulse",mod_enabled:true}]);
 await fs.cp(root,f.binary,{recursive:true}); await assertPalworldModuleReady("palworld",f.targetPath);
 await fs.writeFile(path.join(f.binary,"ue4ss/Mods/ShenPulse/Scripts/main.lua"),"changed");
 await assert.rejects(assertPalworldModuleReady("palworld",f.targetPath),/absent ou modifié/);
 assert.equal(await fs.readFile(path.join(f.binary,edition==="steam"?"Palworld-Win64-Shipping.exe":"Palworld-WinGDK-Shipping.exe"),"utf8"),"original-game");
});
test("Palworld refuse une installation dont l’accès est révoqué avant la préparation",async t=>{
 const f=await fixture(t,"steam");
 await assert.rejects(stagePalworldInstallation({gameId:"palworld",...f,assertAccess(){throw Error("Accès révoqué");}}),/révoqué/);
 assert.equal(await fs.readFile(path.join(f.deploymentRoot,"dwmapi.dll"),"utf8"),"loader");
});
test("Palworld attend un heartbeat frais malgré le remplacement temporaire du fichier",async t=>{
 const f=await fixture(t,"xbox"); const dir=path.join(f.binary,"ue4ss/Mods/ShenPulse");await fs.mkdir(dir,{recursive:true});
 const token="a".repeat(64);await fs.writeFile(path.join(dir,"bridge.json"),JSON.stringify({gameId:"palworld",token}));
 const bridge=new ShopGameBridge({gameId:"palworld",installationPath:f.binary,label:"Palworld"});
 const timer=setTimeout(()=>fs.writeFile(path.join(dir,"ready.json"),JSON.stringify({gameId:"palworld",token,ready:true,at:Date.now()/1000})),80);t.after(()=>clearTimeout(timer));
 assert.equal((await bridge.start()).ready,true);
 await fs.writeFile(path.join(dir,"ready.json"),JSON.stringify({gameId:"palworld",token,ready:true,at:Date.now()/1000-30}));
 assert.equal((await bridge.start()).connected,false);
 await bridge.close();
});

test("Palworld publie un catalogue complet avec six aides et six pièges utilisables", async () => {
 const pack=require("../src/main/game-catalog/palworld");
 const installer=require("../src/main/game-installers/palworld");
 const published=require("../scripts/manifests/game-packs.json").assets.find(a=>a.gameId==="palworld");
 const starter=require("../src/main/game-catalog/starter-effects").palworld;
 assert.equal(pack.effects.length,74);
 assert.ok(pack.effects.every(e=>e.available && e.name.trim().split(/\s+/).length<=2));
 assert.equal(new Set(pack.effects.map(e=>e.image)).size,74);
 for(const e of pack.effects) await fs.access(path.resolve(__dirname,"../src/renderer",e.image));
 for(const column of ["help","trap"]){assert.equal(starter[column].length,6);for(const code of starter[column])assert.ok(pack.effects.some(e=>e.code===code&&e.available));}
 assert.equal(installer.assets[0].sha256,published.sha256);
 assert.equal(installer.assets[0].size,published.size);
 assert.equal(pack.connector.type,"shop-mod");
});
for(const edition of ["steam","xbox"]) test("Palworld lance et attend exclusivement l’édition choisie "+edition,async t=>{
 const f=await fixture(t,edition);
 await fs.writeFile(path.join(f.targetPath,"gamelaunchhelper.exe"),"fixture-launcher");
 await stagePalworldInstallation({gameId:"palworld",...f});
 await fs.cp(path.join(f.deploymentRoot,f.relative),f.binary,{recursive:true});
 const manifest=require("../src/main/game-installers/palworld"), calls=[];
 const {launchExternalGame}=require("../src/main/game-runtime/external-launch");
 const options={gameId:"palworld",manifest,installation:{path:f.targetPath,platform:edition},assertAccess(){},
  shell:{async openPath(p){calls.push(["path",p]);return "";},async openExternal(uri){calls.push(["uri",uri]);}},
  findRunning:async()=>null,waitForWindowsProcessWindow:async name=>calls.push(["wait",name]),
  scheduleGtaSaveDeployment(){},userDataPath:f.temporary};
 const result=await launchExternalGame(options);
 assert.equal(result.platform,edition);
 assert.deepEqual(calls.find(c=>c[0]==="wait"),["wait",edition==="steam"?"Palworld-Win64-Shipping":"Palworld-WinGDK-Shipping"]);
 if(edition==="steam")assert.deepEqual(calls.find(c=>c[0]==="uri"),["uri","steam://rungameid/1623730"]);
 else assert.deepEqual(calls.find(c=>c[0]==="path"),["path",path.join(f.targetPath,"gamelaunchhelper.exe")]);
 const other=path.join(f.temporary,"other-edition","Palworld.exe");
 await assert.rejects(launchExternalGame({...options,findRunning:async()=>({ProcessId:42,ExecutablePath:other})}),/autre installation/);
});

test("Palworld transmet les cadeaux, le viewer et la duree seulement dans la session active",async t=>{
 const f=await fixture(t,"steam");await stagePalworldInstallation({gameId:"palworld",...f});await fs.cp(path.join(f.deploymentRoot,f.relative),f.binary,{recursive:true});
 const {RuleEngine}=require("../src/main/rule-engine"),{ActionRunner}=require("../src/main/action-runner"),{GameHub}=require("../src/main/game-hub");
 const {createDefaultState}=require("../src/main/defaults"),{getRuleEngineState,getStateProjection}=require("../src/main/state/projections");
 const {defaultGameInteractionRule}=require("../src/main/game-hub/interaction-defaults"),{normalizeEvent}=require("../src/main/event-normalizer");
 const {authenticatedFixtureStore}=require("./helpers/authenticated-store");
 const pack=require("../src/main/game-catalog").loadShenazenGameCatalog(path.resolve(__dirname,"../resources")).find(p=>p.id==="palworld"),state=createDefaultState(),requests=[];
 state.settings.account={uid:"pro-fixture",email:"fixture@example.test",refreshTokenSecretId:"fixture-account"};
 state.commerce.subscription={tier:"pro",source:"subscription",status:"active"};state.rules=[];
 state.game.installations.palworld={path:f.targetPath,platform:"steam"};
 const effect=pack.effects.find(e=>e.code==="freeze"),mapping=pack.defaultMappings.find(m=>m.effectId===effect.id);
 const rule=defaultGameInteractionRule(pack,effect,{...mapping,triggerEnabled:true},pack.interactionCatalogVersion);
 rule.conditions=[{field:"data.giftName",operator:"equals",value:"Rose",giftId:"5655"}];
 rule.actions[0].config.parameters.durationSeconds=7;
 state.game.interactionRulesByPack.palworld=[rule];
 const store=authenticatedFixtureStore({getState:()=>structuredClone(state),getStateProjection:paths=>getStateProjection(state,{},paths),getRuleEngineState:type=>getRuleEngineState(state,type)});
 const hub=new GameHub({store,resourcesDirectory:path.resolve(__dirname,"../resources")});hub.packs=[pack];t.after(()=>hub.disconnectAll());
 const bridge=new ShopGameBridge({gameId:"palworld",installationPath:f.binary,timeoutMs:30000});
 bridge.fileRequest=async request=>{if(request.code!=="__status")requests.push(request);return{id:request.id,gameId:"palworld",status:0,ready:true,executionConfirmed:true};};
 hub.serverBridges.set("palworld:shop-mod",bridge);
 const engine=new RuleEngine({store,actionRunner:new ActionRunner({store,gameHub:hub})}),failures=[];
 engine.on("action-result",r=>{if(!r.ok)failures.push(r.error);});
 const gift=()=>normalizeEvent({event:"gift",data:{giftId:"5655",giftName:"Rose",count:1,user:{id:"viewer-fixture",nickname:"Viewer Palworld"}}},"tiktok");
 await engine.process(gift());assert.equal(requests.length,0);
 state.session.game={running:true,packId:"palworld",profileId:state.session.profileId};
 await engine.process(gift());assert.deepEqual(failures,[]);assert.equal(requests.length,1);
 assert.equal(requests[0].code,"freeze");assert.equal(requests[0].viewer,"Viewer Palworld");assert.equal(requests[0].duration,7);
 state.session.game.profileId="other-profile";await engine.process(gift());assert.equal(requests.length,1);
});
