"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {JSDOM}=require("jsdom");const {StateStore}=require("../src/main/store"),{createEmptyProfileWorkspace}=require("../src/main/defaults"),{registerGamePackPresentationIpc}=require("../src/main/ipc/game-pack-presentation"),{normalizeGamePackPresentation,PACK_ID}=require("../src/shared/game-pack-presentation"),{createGamePackOverlay}=require("../src/shared/game-pack-overlay");
test("les choix d’affichage persistent par profil sans changer les règles ni les autres jeux",t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),"shenpulse-presentation-"));const stores=[];t.after(()=>{for(const store of stores)for(const key of ["writeTimer","runtimeWriteTimer","persistenceRetryTimer"])clearTimeout(store[key]);assert.equal(path.dirname(directory),os.tmpdir());assert.ok(path.basename(directory).startsWith("shenpulse-presentation-"));fs.rmSync(directory,{recursive:true,force:true});});
 const store=new StateStore(directory,{isEncryptionAvailable:()=>false});stores.push(store);store.activateAccount("creator");store.set("settings.account",{uid:"creator",email:"creator@example.test",refreshTokenSecretId:store.setSecret("","test-refresh")});store.state.commerce.subscription={tier:"pro",status:"active",source:"paid"};
 store.state.settings.overlayConfigs.gameInteractionOverlays={other:{backgroundColor:"#123456"}};const initialRules=JSON.stringify(store.state.game.interactionRulesByPack),firstProfile=store.state.session.profileId;
 const handlers=new Map();registerGamePackPresentationIpc({handle:(name,fn)=>handlers.set(name,fn),store,core:{snapshot:()=>({state:store.getState()}),notifyRenderer(){}},requireGameAccess:id=>assert.equal(id,PACK_ID)});
 const save=options=>handlers.get("overlay:game-pack-presentation")(null,{profileId:store.state.session.profileId,accountUid:"creator",...options});
 save({model:2});save({backgroundColor:"#abcdef"});save({motion:"fixed"});assert.deepEqual(createGamePackOverlay(store.getState()).presentation,{model:2,motion:"fixed",backgroundColor:"#abcdef",configured:true});assert.equal(JSON.stringify(store.state.game.interactionRulesByPack),initialRules);assert.equal(store.state.settings.overlayConfigs.gameInteractionOverlays.other.backgroundColor,"#123456");
 const before=JSON.stringify(store.state.settings.overlayConfigs);assert.throws(()=>save({model:9}),/inconnu/);assert.throws(()=>save({profileId:"wrong",model:1}),/profil a changé/);assert.throws(()=>save({accountUid:"wrong",model:1}),/profil a changé/);assert.throws(()=>save({motion:"spin"}),/Mode invalide/);assert.equal(JSON.stringify(store.state.settings.overlayConfigs),before);
 store.mutate(state=>{state.profiles.push({id:"other-profile",name:"Autre profil",workspace:createEmptyProfileWorkspace()});},true);store.selectProfile("other-profile");assert.equal(createGamePackOverlay(store.getState()).presentation.model,1);save({model:3});store.selectProfile(firstProfile);assert.equal(createGamePackOverlay(store.getState()).presentation.model,2);store.mutate(()=>{},true);
 const loaded=new StateStore(directory,{isEncryptionAvailable:()=>false});stores.push(loaded);loaded.load();assert.equal(createGamePackOverlay(loaded.getState()).presentation.model,2);assert.equal(createGamePackOverlay(loaded.getState()).presentation.backgroundColor,"#abcdef");
});
test("la présentation publique ne contient que modèle, mouvement et couleur validés",()=>{
 assert.deepEqual(normalizeGamePackPresentation({model:99,motion:"invalid",backgroundColor:"url(secret)"}),{model:1,motion:"animated",backgroundColor:"#082b63",configured:true});
 assert.equal(normalizeGamePackPresentation().configured,false);
});
test("une source ouverte suit les trois modèles et le mode fixe sans changer d’URL",async()=>{
 const dom=new JSDOM('<main id="pack"><div id="cards"></div><div id="reaction"></div></main>',{runScripts:"outside-only",url:"https://overlay.test/game-pack.html?profile=profile&motion=animated"});const pending=[],calls=[];dom.window.ShenPulseGamePackModels={render:(state,model,compact)=>{calls.push({model,compact});return new Promise(resolve=>pending.push(resolve));}};
 dom.window.eval(fs.readFileSync(path.join(__dirname,"../resources/overlays/runtime/game-pack.js"),"utf8"));
 const state={enabled:true,profileId:"profile",packId:PACK_ID,cards:[{id:"gift",title:"Mon client",column:"help",triggerType:"gift",giftName:"Rose",giftImageUrl:""}],presentation:{model:1,motion:"animated",configured:true,backgroundColor:"#082b63"}};const api=dom.window.ShenPulseGamePack,doc=dom.window.document,url=dom.window.location.href;
 api.render(state);const card=doc.querySelector(".gift-card");state.presentation.motion="fixed";api.render(state);assert.ok(doc.body.classList.contains("fixed"));assert.equal(doc.querySelector(".gift-card"),card);
 state.presentation.model=2;api.render(state);assert.equal(calls[0].model,2);state.presentation.model=3;api.render(state);assert.equal(calls[1].model,3);
 pending[0](doc.createElement("canvas"));await Promise.resolve();assert.equal(doc.querySelectorAll("canvas").length,0,"Le rendu ancien ne doit pas remplacer le modèle suivant");
 pending[1](doc.createElement("canvas"));await Promise.resolve();assert.equal(doc.querySelectorAll("canvas").length,1);assert.ok(doc.body.classList.contains("model-3"));assert.ok(doc.body.classList.contains("fixed"));
 state.presentation.model=1;state.presentation.motion="animated";api.render(state);assert.equal(doc.querySelectorAll("canvas").length,0);assert.ok(doc.querySelector(".gift-card"));assert.ok(doc.body.classList.contains("animated"));assert.equal(dom.window.location.href,url);dom.window.close();
});
test("les modèles 2 et 3 appellent les deux moteurs historiques et cadrent leur panneau dans l’aperçu compact",async()=>{
 const dom=new JSDOM('<body></body>',{runScripts:"outside-only"}),calls=[],draws=[];dom.window.HTMLCanvasElement.prototype.getContext=()=>({drawImage:(...args)=>draws.push(args)});
 dom.window.ShenPulseGameOverlay={renderMinecraftStyledOverlay:async options=>{calls.push(options);const c=dom.window.document.createElement("canvas");c.width=1080;c.height=1920;c.overlayPanelBounds={x:0,y:1520,width:1080,height:400};return c;}};
 dom.window.eval(fs.readFileSync(path.join(__dirname,"../resources/overlays/runtime/game-pack-models.js"),"utf8"));const state={cards:[{id:"one",title:"Un client",actionLabels:["Un client","Rayon rempli"],triggerType:"gift",giftName:"Rose",giftImageUrl:"https://example.test/rose.png",effectImageUrl:"media/game-interactions/supermarket-simulator/supermarket-simulator-spawn-customers.png"}],presentation:{backgroundColor:"#abcdef"}};
 const full=await dom.window.ShenPulseGamePackModels.render(state,2,false),compact=await dom.window.ShenPulseGamePackModels.render(state,3,true);assert.equal(full.height,1920);assert.equal(compact.height,400);assert.equal(calls[0].model,1);assert.equal(calls[1].model,2);assert.equal(calls[0].entries[0].effectImageUrl,"");assert.equal(calls[1].entries[0].effectImageUrl,state.cards[0].effectImageUrl);assert.equal(calls[0].entries[0].giftLabel,"Rose");assert.equal(calls[0].entries[0].actionLabels.length,2);assert.equal(calls[0].backgroundColor,"#abcdef");assert.equal(draws[0][2],1520);state.cards[0].effectImageUrl="file:///private/image.png";await dom.window.ShenPulseGamePackModels.render(state,3,false);assert.equal(calls[2].entries[0].effectImageUrl,"");dom.window.close();
});

test("le modèle 3 actualise son image sur la même URL sans changer le titre ou le cadeau", async () => {
 const dom=new JSDOM('<main id="pack"><div id="cards"></div><div id="reaction"></div></main>',{runScripts:"outside-only",url:"https://overlay.test/game-pack.html?profile=profile"});
 const calls=[];dom.window.ShenPulseGamePackModels={render:async(state,model)=>{calls.push({image:state.cards[0].effectImageUrl,title:state.cards[0].title,gift:state.cards[0].giftImageUrl,model});return dom.window.document.createElement("canvas");}};
 dom.window.eval(fs.readFileSync(path.join(__dirname,"../resources/overlays/runtime/game-pack.js"),"utf8"));
 const state={enabled:true,profileId:"profile",packId:PACK_ID,cards:[{id:"one",title:"Mon client",triggerType:"gift",giftImageUrl:"https://example.test/rose.png",effectImageUrl:"media/game-interactions/supermarket-simulator/supermarket-simulator-spawn-customers.png"}],presentation:{model:3,configured:true}};
 const runtime=dom.window.ShenPulseGamePack,url=dom.window.location.href;
 runtime.render(state);await Promise.resolve();const first=dom.window.document.querySelector("canvas");
 state.cards[0].effectImageUrl="media/game-interactions/supermarket-simulator/supermarket-simulator-fill-shelves.png";runtime.render(state);await Promise.resolve();
 assert.equal(calls.length,2);assert.notEqual(calls[0].image,calls[1].image);assert.equal(calls[0].title,calls[1].title);assert.equal(calls[0].gift,calls[1].gift);assert.equal(calls[1].model,3);
 assert.notEqual(dom.window.document.querySelector("canvas"),first);assert.equal(dom.window.location.href,url);dom.window.close();
});


test("le changement de modèle garde le rendu précédent et indique le calcul dans l’aperçu compact", async () => {
 const dom=new JSDOM('<main id="pack"><div id="cards"></div><div id="reaction"></div></main>',{runScripts:'outside-only',url:'https://overlay.test/game-pack.html?layout=compact'}),pending=[];
 dom.window.ShenPulseGamePackModels={render:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))};
 dom.window.eval(fs.readFileSync(path.join(__dirname,'../resources/overlays/runtime/game-pack.js'),'utf8'));
 const runtime=dom.window.ShenPulseGamePack,doc=dom.window.document,state={enabled:true,profileId:'profile',packId:PACK_ID,cards:[{id:'one',title:'Un client',column:'help',triggerType:'gift'}],presentation:{model:1,motion:'animated',configured:true}};
 runtime.render(state);const first=doc.querySelector('.gift-card');state.presentation.model=2;runtime.render(state);
 assert.equal(doc.querySelector('.gift-card'),first);assert.equal(doc.querySelector('#pack').getAttribute('aria-busy'),'true');assert.equal(doc.querySelector('#render-status').hidden,false);assert.match(doc.querySelector('#render-status').textContent,/Mise à jour/);assert.ok(doc.body.classList.contains('animated'),'Le modèle visible garde sa disposition pendant le calcul.');
 const canvas=doc.createElement('canvas');pending[0].resolve(canvas);await Promise.resolve();
 assert.equal(doc.querySelector('canvas'),canvas);assert.equal(doc.querySelector('#pack').getAttribute('aria-busy'),'false');assert.equal(doc.querySelector('#render-status').hidden,true);assert.ok(doc.body.classList.contains('model-2'));
 state.presentation.backgroundColor='#123456';runtime.render(state);assert.equal(doc.querySelector('canvas'),canvas);assert.equal(doc.querySelector('#render-status').hidden,false);
 pending[1].reject(new Error('Image indisponible'));await Promise.resolve();await Promise.resolve();
 assert.equal(doc.querySelector('canvas'),canvas,'Un échec ne vide pas le dernier rendu.');assert.equal(doc.querySelector('#render-status').dataset.state,'error');assert.equal(doc.querySelector('#pack').getAttribute('aria-busy'),'false');
 runtime.render(state);const replacement=doc.createElement('canvas');pending[2].resolve(replacement);await Promise.resolve();assert.equal(doc.querySelector('canvas'),replacement);assert.equal(doc.querySelector('#render-status').hidden,true);dom.window.close();
});

test("les réponses tardives ne remplacent ni le dernier choix, ni un nouveau profil, ni un overlay masqué", async () => {
 const dom=new JSDOM('<main id="pack"><div id="cards"></div><div id="reaction"></div></main>',{runScripts:'outside-only',url:'https://overlay.test/game-pack.html?layout=compact'}),pending=[];
 dom.window.ShenPulseGamePackModels={render:()=>new Promise(resolve=>pending.push(resolve))};dom.window.eval(fs.readFileSync(path.join(__dirname,'../resources/overlays/runtime/game-pack.js'),'utf8'));
 const runtime=dom.window.ShenPulseGamePack,doc=dom.window.document,state={enabled:true,profileId:'first',packId:PACK_ID,cards:[{id:'one',title:'Profil A',column:'help'}],presentation:{model:2,configured:true}};
 runtime.render(state);const initial=doc.createElement('canvas');pending[0](initial);await Promise.resolve();
 state.presentation.backgroundColor='#123456';runtime.render(state);state.presentation.backgroundColor='#654321';runtime.render(state);
 pending[1](doc.createElement('canvas'));await Promise.resolve();assert.equal(doc.querySelector('canvas'),initial);assert.equal(doc.querySelector('#render-status').hidden,false);
 const last=doc.createElement('canvas');pending[2](last);await Promise.resolve();assert.equal(doc.querySelector('canvas'),last);assert.equal(doc.querySelector('#render-status').hidden,true);
 state.profileId='second';state.cards[0].title='Profil B';runtime.render(state);assert.equal(doc.querySelector('#cards').children.length,0,'Le rendu du profil précédent est retiré immédiatement.');
 runtime.render(null);pending[3](doc.createElement('canvas'));await Promise.resolve();assert.equal(doc.querySelector('#cards').children.length,0);assert.equal(doc.querySelector('#render-status').hidden,true);dom.window.close();
});

test("le chargement ne s’affiche pas dans la source du LIVE et un échec synchrone est signalé dans l’aperçu", async () => {
 for(const compact of [false,true]){
  const dom=new JSDOM('<main id="pack"><div id="cards"></div><div id="reaction"></div></main>',{runScripts:'outside-only',url:'https://overlay.test/game-pack.html'+(compact?'?layout=compact':'')});dom.window.ShenPulseGamePackModels={render:()=>{throw new Error('Canvas indisponible');}};
  dom.window.eval(fs.readFileSync(path.join(__dirname,'../resources/overlays/runtime/game-pack.js'),'utf8'));dom.window.ShenPulseGamePack.render({enabled:true,profileId:'profile',packId:PACK_ID,cards:[{id:'one',title:'Client'}],presentation:{model:3}});
  assert.equal(dom.window.document.querySelector('#render-status').hidden,!compact);await Promise.resolve();await Promise.resolve();assert.equal(dom.window.document.querySelector('#render-status').dataset.state,'error');assert.equal(dom.window.document.querySelector('#render-status').hidden,!compact);dom.window.close();
 }
});
