"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs/promises"),path=require("node:path"),os=require("node:os");
const {effects,gameId}=require("../scripts/integration-preparation/backrooms-catalog");
const {createEffectPayload}=require("../src/main/game-hub/effect-payload");

test("Backrooms conserve 70 effets uniques, leurs quantités et des durées compatibles avec le jeu",()=>{
 assert.equal(effects.length,70);assert.equal(new Set(effects.map(e=>e.code)).size,70);
 for(const effect of effects){
  assert.equal(effect.id,gameId+"-"+effect.code);assert.ok(effect.name.split(/\s+/).length<=2);
  const duration=effect.parameters?.find(p=>p.id==="durationSeconds");
  if(effect.code.startsWith("monstre_")||effect.code==="horde"){assert.equal(duration.min,10);assert.equal(duration.max,180);}
 }
 const gift=effects.find(e=>e.code==="objet_eau_amande");
 const payload=createEffectPayload(gift,{user:{displayName:"Viewer essai"}},{parameters:{quantity:3}});
 assert.equal(payload.effect.quantity,3);assert.equal(payload.effect.viewer,"Viewer essai");
 const speed=effects.find(e=>e.code==="rapide");
 assert.equal(createEffectPayload(speed,{}, {parameters:{durationSeconds:8}}).effect.duration,8);
});

test("Backrooms cible l’édition Xbox testée et refuse un chargeur absent ou modifié",async t=>{
 const modules=require("../resources/catalogs/owner-prepared-modules.json");
 const definition=modules[gameId];assert.ok(definition);
 const {installerForGame}=require("../src/main/game-installer-manifest");
 const installer=installerForGame(gameId);
 assert.equal(installer.xboxIdentity,"SecretMode.EscapetheBackrooms");
 assert.ok(installer.launchExecutables.includes("gamelaunchhelper.exe"));
 assert.ok(installer.executables.every(file=>file.includes("WinGDK")));
 assert.ok(installer.unsupportedPlatforms.includes("steam"));
 const root=await fs.mkdtemp(path.join(os.tmpdir(),"shenpulse-backrooms-integrity-"));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const main=path.join(root,definition.module);await fs.mkdir(path.dirname(main),{recursive:true});
 await fs.copyFile(path.resolve("scripts/integration-preparation/backrooms-bridge.lua"),main);
 const {assertOwnerIntegrationReady}=require("../src/main/game-runtime/owner-integration-installation");
 await assert.rejects(assertOwnerIntegrationReady(gameId,root),/installé ou réparé/);
 const dependencies=Object.keys(definition.moduleDependencies);assert.ok(dependencies.some(f=>f.endsWith("UE4SS.dll")));assert.ok(dependencies.some(f=>f.endsWith("effects.lua")));
});
