"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs/promises"),os=require("node:os"),path=require("node:path"),{createHash}=require("node:crypto"),{once}=require("node:events");
const {WebSocket}=require("ws");
const {PreparedBrowserGame}=require("../src/main/prepared-browser-games");
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),"shenpulse-browser-transport-"));
 const html="<!doctype html><html><head><title>Transport fixture</title></head><body></body></html>";
 await fs.writeFile(path.join(root,"index.html"),html);
 const state={settings:{account:{uid:"owner"}},session:{profileId:"one"},game:{installations:{"fixture-game":{path:root}}}};
 const spec={port:0,module:"index.html",moduleSha256:createHash("sha256").update(html).digest("hex"),installer:{browserGame:true}};
 const bridge=new PreparedBrowserGame({store:{getState:()=>state},gameId:"fixture-game",spec});
 t.after(async()=>{await bridge.close();await fs.rm(root,{recursive:true,force:true});});
 await bridge.start();return {bridge,state,root};
}
async function clientFor(bridge){
 const client=new WebSocket(bridge.origin.replace("http:","ws:")+"/bridge?ticket="+bridge.ticket,{origin:bridge.origin});
 await once(client,"open");const connected=once(bridge,"message");client.send(JSON.stringify({type:"ready"}));await connected;return client;
}
test("le navigateur local ne sert que la page prévue, avec un ticket et sans accès Node",async t=>{
 const {bridge}=await fixture(t);
 assert.equal((await fetch(bridge.origin+"/index.html")).status,403);
 const res=await fetch(bridge.origin+"/index.html?ticket="+bridge.ticket);
 assert.equal(res.status,200);assert.match(res.headers.get("content-security-policy"),/object-src 'none'/);
 assert.match(await res.text(),/shenpulse-bridge\.js\?ticket=/);
 assert.equal((await fetch(bridge.origin+"/../../package.json?ticket="+bridge.ticket)).status,404);
 const script=await fetch(bridge.origin+"/shenpulse-bridge.js?ticket="+bridge.ticket);assert.equal(script.status,200);assert.doesNotMatch(await script.text(),/ipcRenderer|require\(|nodeIntegration/);
});
test("une autre origine ne peut pas accéder au pont, même avec un ticket valide",async t=>{
 const {bridge}=await fixture(t);
 const client=new WebSocket(bridge.origin.replace("http:","ws:")+"/bridge?ticket="+bridge.ticket,{origin:"https://other.example"});
 const status=await new Promise(resolve=>{client.on("unexpected-response",(_req,res)=>{res.resume();client.terminate();resolve(res.statusCode);});client.on("error",()=>{});});
 assert.equal(status,403);assert.equal(bridge.status().connected,false);
});
test("une interaction garde la quantité, le camp et le viewer, puis attend la réponse du jeu",async t=>{
 const {bridge}=await fixture(t),client=await clientFor(bridge);t.after(()=>client.terminate());
 const received=once(client,"message");const result=bridge.send("spawn_archer",{viewer:"Alice",quantity:2,parameters:{count:3,team:"ally",lane:"left"}});
 const message=JSON.parse(String((await received)[0]));assert.equal(message.type,"effect");assert.equal(message.payload.count,3);assert.equal(message.payload.params.team,"ally");assert.equal(message.payload.user.nickname,"Alice");assert.equal(message.payload.context.gameSlug,"fixture-game");assert.ok(message.payload.executionId);
 client.send(JSON.stringify({type:"result",id:message.id,result:{success:true,message:"three queued"}}));assert.deepEqual(await result,{status:0,message:"three queued"});
});
test("un refus est conservé et un changement de profil déconnecte la partie précédente",async t=>{
 const {bridge,state}=await fixture(t),client=await clientFor(bridge);t.after(()=>client.terminate());
 const received=once(client,"message"),result=bridge.send("unknown");const rejected=assert.rejects(result,error=>error.status===3&&error.message==="not available");
 const message=JSON.parse(String((await received)[0]));client.send(JSON.stringify({type:"result",id:message.id,result:{success:false,message:"not available"}}));await rejected;
 state.session.profileId="two";await assert.rejects(bridge.send("spawn_archer"),/pas encore connecté/);assert.equal(bridge.status().connected,false);
});
test("un paquet navigateur modifié est refusé avant toute ouverture",async t=>{
 const {bridge,root}=await fixture(t);await bridge.close();await fs.writeFile(path.join(root,"index.html"),"changed");await assert.rejects(bridge.start(),/fichiers du jeu ont changé/);
});


test("une reconnexion annule les effets de l’ancien client sans les rejouer",async t=>{
 const {bridge}=await fixture(t),first=await clientFor(bridge);t.after(()=>first.terminate());
 const received=once(first,"message"),pending=bridge.send("spawn_archer");
 const rejection=assert.rejects(pending,/reconnecté/);await received;
 const second=await clientFor(bridge);t.after(()=>second.terminate());await rejection;
 assert.equal(bridge.pending.size,0);assert.equal(bridge.status().connected,true);
 const next=once(second,"message"),result=bridge.send("heal");const frame=JSON.parse(String((await next)[0]));
 second.send(JSON.stringify({type:"result",id:frame.id,result:{success:true}}));assert.equal((await result).status,0);
});
