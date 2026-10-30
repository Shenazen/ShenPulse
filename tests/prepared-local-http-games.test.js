"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{createHash}=require('node:crypto');const {PreparedLocalHttpGame}=require('../src/main/prepared-local-http-games');
async function fixture(t,handler){const root=await fs.mkdtemp(path.join(os.tmpdir(),'shenpulse-http-test-')),bytes=Buffer.from('fixture');await fs.writeFile(path.join(root,'mod.dll'),bytes);const calls=[];const server=http.createServer(async(req,res)=>{if(req.method==='OPTIONS'){res.end();return;}let body='';for await(const chunk of req)body+=chunk;calls.push({url:req.url,body:JSON.parse(body),headers:req.headers});if(handler)return handler(req,res);res.end('OK');});await new Promise(r=>server.listen(0,'127.0.0.1',r));const state={settings:{account:{uid:'one'}},session:{profileId:'one'},game:{installations:{fixture:{path:root}}}};const spec={module:'mod.dll',moduleSha256:createHash('sha256').update(bytes).digest('hex'),port:server.address().port,installer:{localHttpGame:true}};const bridge=new PreparedLocalHttpGame({store:{getState:()=>state},gameId:'fixture',spec,pollMs:10000,timeoutMs:200});t.after(async()=>{await bridge.close();server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});});await bridge.start();return {bridge,state,calls,spec,root};}
test('le choix réel, le nom UTF8 et la quantité sont envoyés au module local',async t=>{const {bridge,calls}=await fixture(t);assert.equal(bridge.status().connected,true);await bridge.send('spawn_red_unit',{parameters:{effectValue:'UNIT_MEDIEVAL_ARCHER'},viewer:'Élodie',quantity:2});assert.equal(calls.length,2);assert.equal(calls[0].url,'/spawn_red_unit');assert.deepEqual(calls[0].body,{name:'Élodie',effect:'UNIT_MEDIEVAL_ARCHER'});assert.equal(calls[0].headers.superdupertoken,'shenpulse.leuridan.fr');await assert.rejects(bridge.send('https://other.test/'),/invalide/);});
test('un refus HTTP et une expiration ne deviennent pas une réussite',async t=>{const {bridge}=await fixture(t,(req,res)=>{if(req.url==='/refuse'){res.statusCode=400;res.end('refused');}});await assert.rejects(bridge.send('refuse'),/refusé/);await assert.rejects(bridge.send('wait'),/abort|aborted/i);});
test('le changement de profil annule les demandes et rend la présence inactive',async t=>{const {bridge,state}=await fixture(t,(_req,res)=>setTimeout(()=>res.end('OK'),60));const pending=bridge.send('heal_all');setTimeout(()=>{state.session.profileId='two';},20);await assert.rejects(pending,/profil a changé/);assert.equal(bridge.status().connected,false);});
test('le module installé est vérifié avant tout contact au jeu',async t=>{const {bridge,spec,root}=await fixture(t);await bridge.close();await fs.writeFile(path.join(root,spec.module),'changed');await assert.rejects(bridge.start(),/réparé/);});
test('Backrooms confirme le résultat du jeu et transmet quantité et durée une seule fois',async t=>{
 const {bridge,calls,spec}=await fixture(t,(req,res)=>res.end(JSON.stringify({status:req.url==='/refuse'?3:0,message:req.url==='/refuse'?'Inventaire plein':'Exécutée'})));
 spec.installer.localHttpGame='backrooms';
 const result=await bridge.send('objet_eau_amande',{viewer:'Élodie',quantity:3,duration:8000});
 assert.equal(result.accepted,true);assert.equal(calls.length,1);
 assert.deepEqual(calls[0].body,{viewer:'Élodie',quantity:3,duration:8000});
 assert.equal(calls[0].headers.superdupertoken,undefined);
 await assert.rejects(bridge.send('refuse'),error=>error.status===3&&error.message==='Inventaire plein');
});
test('Backrooms refuse une réponse incomplète au lieu de confirmer un effet',async t=>{
 const {bridge,spec}=await fixture(t,(_req,res)=>res.end('{}'));spec.installer.localHttpGame='backrooms';
 await assert.rejects(bridge.send('heal'),/conditions de jeu/);
});
