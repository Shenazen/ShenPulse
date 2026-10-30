
"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path"),fs=require("node:fs"),{createHash}=require("node:crypto");
const {loadShenazenGameCatalog}=require("../src/main/game-catalog");
const visibility=require("../src/shared/visibility-catalog");
const {gameCatalogRenderer}=require("./helpers/game-catalog-renderer");
const modules=require("../resources/catalogs/owner-prepared-modules.json");
const catalog=loadShenazenGameCatalog(path.resolve(__dirname,"../resources"));
const packs=catalog.filter(p=>p.ownerPreparation);
const requested=require("../scripts/integration-preparation/requested-games.json").games;
const records=require("../resources/catalogs/owner-game-preparation.json").games;
const {ownerGameListed}=require("../src/shared/owner-game-catalog-policy");
test("les nouvelles fiches sont privées, sans Roblox et sans déclaration d’essai en partie",()=>{
 const ready=records.filter(game=>ownerGameListed(game)&&modules[game.id]);assert.equal(packs.length,ready.length);assert.equal(packs.length,27);assert.equal(new Set(catalog.map(p=>p.id)).size,catalog.length);
 for(const pack of packs){assert.equal(pack.ownerOnly,true,pack.id);assert.equal(pack.workspaceLayout,"shared");assert.equal(pack.ownerPreparation.inGameValidation,modules[pack.id].inGameValidation||"pending");assert.equal(visibility.canAccessGame({},pack,false,"2.1.1"),false,pack.id);assert.equal(visibility.canAccessGame({},pack,true,"2.1.1"),true,pack.id);assert.doesNotMatch(JSON.stringify([pack.name,pack.description,pack.guide]),/crowd\s*control|synclive|streamtoearn|tik360/i);}
 assert.ok(!packs.some(p=>p.id.startsWith("roblox")));
});
test("les quinze nouveaux packs incomplets sont retirés du catalogue et de leurs entrées d’installation",t=>{
 const {installerForGame}=require("../src/main/game-installer-manifest");
 const retired=requested.filter(game=>!modules[game.id]);assert.equal(retired.length,15);
 const owner=gameCatalogRenderer(catalog,{owner:true});t.after(owner.close());
 for(const game of retired){
  assert.equal(catalog.some(pack=>pack.id===game.id),false,game.id);
  assert.equal(installerForGame(game.id),null,game.id);
  owner.context.gamePageMode="detail";owner.context.selectedGameId=game.id;
  const page=owner.render();assert.equal(owner.context.gamePageMode,"catalog");
  assert.equal(page.querySelector('[data-id="'+game.id+'"]'),null,game.id);
 }
});

test("chaque pack local a son port, son empreinte et au plus six aides et six pièges",()=>{
 const ports=new Set();const registry=require("../scripts/manifests/game-packs.json");
 for(const pack of packs.filter(p=>p.ownerPreparation.stage==="prepared")){const spec=modules[pack.id];assert.equal(pack.connector.type,spec.installer?.minecraftServer?"minecraft-runtime":spec.installer?.browserGame?"websocket-server":"tcp-server");assert.ok(!ports.has(spec.port));ports.add(spec.port);assert.ok(Number.isInteger(spec.port)&&spec.port>1024&&spec.port<=65535);assert.match(spec.moduleSha256,/^[a-f0-9]{64}$/);assert.match(spec.asset.url,/^https:\/\/f003\.backblazeb2\.com\/file\/shenpulse-media\/installer-assets\//);assert.ok(registry.assets.some(a=>a.gameId===pack.id&&a.sha256===spec.asset.sha256&&a.size===spec.asset.size));
  for(const side of ["help","trap"]){const selected=pack.defaultMappings.filter(m=>m.marketColumn===side);const available=pack.effects.filter(e=>e.available&&e.column===side).length;assert.equal(selected.length,Math.min(6,available),pack.id+side);assert.ok(selected.every(m=>m.giftId&&m.triggerEnabled));}
  assert.ok(pack.effects.every(e=>e.name.trim().split(/\s+/).length<=2),pack.id);
 }
});
test("la galerie reste vide pour un non propriétaire qui ne possède que les nouveaux packs",t=>{
 const normal=gameCatalogRenderer(packs);t.after(normal.close);const html=normal.render().innerHTML;for(const pack of packs)assert.ok(!html.includes('data-game-id="'+pack.id+'"'),pack.id);
});
test("les logos explicitement vérifiés gardent Game Pass et les boutiques retenues sans ouvrir les anciennes fiches",t=>{
 const {context,close}=gameCatalogRenderer(packs,{owner:true});t.after(close);
 const ball=packs.find(p=>p.id==="ball-x-pit");assert.deepEqual(Array.from(context.gamePlatformIds(ball)),["game-pass"]);
 const sims=packs.find(p=>p.id==="the-sims-4");assert.deepEqual(Array.from(context.gamePlatformIds(sims)),["steam","ea"]);
 const doom=packs.find(p=>p.id==="doom-2016");assert.deepEqual(Array.from(context.gamePlatformIds(doom)),["gog"]);
 for(const p of [ball,sims,doom])assert.doesNotMatch(context.gamePlatformLogos(p),/undefined/);
});
test("un module absent ou altéré bloque le lancement avant tout démarrage de jeu",async()=>{
 const {assertOwnerIntegrationReady}=require("../src/main/game-runtime/owner-integration-installation");
 const temp=fs.mkdtempSync(path.join(require("node:os").tmpdir(),"shenpulse-module-check-"));try{await assert.rejects(assertOwnerIntegrationReady("ball-x-pit",temp),/installé ou réparé/);const target=path.join(temp,modules["ball-x-pit"].module);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,"incorrect");await assert.rejects(assertOwnerIntegrationReady("ball-x-pit",temp),/installé ou réparé/);}finally{fs.rmSync(temp,{recursive:true,force:true});}
});


test("les scripts Sims sont activés sans modifier les autres options et le réglage est stable", () => {
 const {enableSimsScripts}=require("../src/main/game-runtime/owner-integration-installation");
 const original="[options]\r\nfullscreen = 1\r\nscriptmodsenabled = 0\r\nmodsdisabled = 1\r\n[other]\r\nvolume = 30\r\n";
 const updated=enableSimsScripts(original);
 assert.match(updated,/^fullscreen = 1$/m);assert.match(updated,/^scriptmodsenabled = 1$/m);assert.match(updated,/^modsdisabled = 0$/m);assert.match(updated,/^volume = 30$/m);assert.equal(enableSimsScripts(updated),updated);
 const fresh=enableSimsScripts("");assert.match(fresh,/^\[options\]$/m);assert.match(fresh,/^scriptmodsenabled = 1$/m);assert.match(fresh,/^modsdisabled = 0$/m);
});

test("Les Sims 4 conserve le déploiement de son script dans Documents", () => {
 const {installerForGame}=require("../src/main/game-installer-manifest");
 const sims=installerForGame("the-sims-4");
 assert.equal(sims.additionalInstallTargets[0].root,"documents");assert.equal(sims.additionalInstallTargets[0].targetPath,"Electronic Arts/The Sims 4/Mods/ShenPulse");
});


test("les vingt-sept fiches privées conservées réutilisent la page et leur installation", t => {
 const Module=require("node:module"),file=path.resolve("tests/external-game-workspace.test.js"),source=fs.readFileSync(file,"utf8"),end=source.indexOf("test('les 52");
 assert.ok(end>0);const isolated=new Module(file,module);isolated.filename=file;isolated.paths=Module._nodeModulePaths(path.dirname(file));isolated._compile(source.slice(0,end)+"\nmodule.exports={fixture};",file);
 const fixture=isolated.exports.fixture();t.after(()=>fixture.dom.window.close());fixture.ctx.snapshot.packs=structuredClone(packs);
 for(const pack of packs){fixture.ctx.selectedGameId=pack.id;fixture.ctx.content.innerHTML=fixture.ctx.renderSupermarketWorkspace(pack);const page=fixture.ctx.content;assert.equal(page.querySelector("[data-game-pack]").dataset.gamePack,pack.id);assert.equal(page.querySelectorAll(".game-pack-phone").length,1,pack.id);assert.equal(page.querySelectorAll(".game-pack-column").length,3,pack.id);assert.ok(page.querySelector("[data-game-tour-start]"),pack.id);
  const launch=page.querySelector('[data-action="launch-game"],[data-action="start-game-session"]');assert.ok(launch,pack.id);assert.equal(launch.disabled,true,pack.id+" has no installation yet");
  if(pack.ownerPreparation.stage==="prepared")assert.ok(fixture.ctx.AUTOMATED_GAME_INSTALLERS.has(pack.id),pack.id);
 }
});

test("le runtime partagé de Fusion possède sa propre publication vérifiée",()=>{const defs=require("../resources/catalogs/owner-prepared-modules.json"),registry=require("../scripts/manifests/game-packs.json");const asset=defs["pvz-fusion"].additionalAssets.find(a=>a.id==="dotnet6-runtime");const row=registry.assets.find(a=>a.gameId==="unity-dotnet-runtime"&&a.id===asset.id);assert.equal(asset.sha256,row.sha256);assert.equal(asset.size,row.size);assert.equal(asset.url,"https://f003.backblazeb2.com/file/shenpulse-media/"+row.key);});
