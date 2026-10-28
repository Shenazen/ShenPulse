"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto"),{EventEmitter,once}=require("node:events"),{WebSocket}=require("ws");
const {UnityRelay}=require("../src/main/shen-native-games/unity-relay"),{PaintNetwork,validLicence}=require("../src/main/shen-native-games/paint-network"),{issueLicence}=require("../src/main/shen-native-games/licence");
function next(client,predicate){
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>done(Error("Message expiré")),2000),handler=(data,binary)=>{const value=binary?Buffer.from(data):JSON.parse(String(data));if(predicate(value,binary))done(null,value);};function done(e,v){clearTimeout(timer);client.off("message",handler);e?reject(e):resolve(v);}client.on("message",handler);});
}
test("Unity Relay fragmente et recompose les données natives sans perte, en bornant les messages",async()=>{
 const sender=new UnityRelay(),receiver=new UnityRelay();sender.id=Buffer.alloc(16,1);receiver.id=Buffer.alloc(16,2);sender.idHex=sender.id.toString("hex");receiver.idHex=receiver.id.toString("hex");sender.peers.add(receiver.idHex);
 const packets=[];sender.socket={readyState:1,send(packet,done){packets.push(Buffer.from(packet));receiver.receive(packet);done?.();},close(){}};
 const bytes=crypto.randomBytes(512000),received=once(receiver,"payload");await sender.send(receiver.idHex,bytes,true);const [peer,result,binary]=await received;assert.deepEqual(result,bytes);assert.equal(peer,sender.idHex);assert.equal(binary,true);assert.ok(packets.length>300);assert.ok(packets.every(p=>p.length<=1438));assert.equal(receiver.pending.size,0);
 await assert.rejects(sender.send(receiver.idHex,Buffer.alloc(8*1024*1024+1)),/indisponible/);
 let delivered=0;receiver.on("payload",()=>delivered++);const foreign=Buffer.from(packets[0]);foreign.fill(3,20,36);receiver.receive(foreign);assert.equal(delivered,0);sender.close();receiver.close();
});
test("la licence du relais local refuse un autre jeu, une signature invalide ou un jeton expiré",()=>{
 const key=crypto.generateKeyPairSync("ed25519").privateKey,token=issueLicence(key,"shenpaint",Date.now());assert.equal(validLicence(token,key),true);assert.equal(validLicence(issueLicence(key,"shenfarm"),key),false);assert.equal(validLicence(token,crypto.generateKeyPairSync("ed25519").privateKey),false);assert.equal(validLicence(issueLicence(key,"shenpaint",Date.now()-121000),key),false);
});
function fakeRelays(){
 const peers=new Map();let number=0,host;
 class Fake extends EventEmitter{
  constructor(){super();this.idHex=(++number).toString(16).padStart(32,"0");peers.set(this.idHex,this);}
  async open(code){if(code){if(code!=="BCDF67"||!host)throw Error("Code absent");this.host=host.idHex;}else host=this;return "BCDF67";}
  async send(peer,bytes,binary=false){if(!peers.has(peer))throw Error("Invité absent");queueMicrotask(()=>peers.get(peer)?.emit("payload",this.idHex,Buffer.from(bytes),binary));}
  close(){if(!peers.has(this.idHex))return;peers.delete(this.idHex);for(const other of peers.values())queueMicrotask(()=>other.emit("left",this.idHex));}
 }
 return ()=>new Fake();
}
async function fixture(t){
 const key=crypto.generateKeyPairSync("ed25519").privateKey,network=new PaintNetwork({credentials:{privateKey:key},assertAccess(){},port:0,createRelay:fakeRelays()}),clients=[];await network.start();
 t.after(async()=>{for(const c of clients)c.terminate();await network.close();});
 async function connect(action,code="",pseudo="Streamer",version="v14"){
  const c=new WebSocket("ws://127.0.0.1:"+network.port);clients.push(c);await once(c,"open");const response=next(c,m=>m.t==="salle"||m.t==="erreur");c.send(JSON.stringify({t:"bonjour",action,code,pseudo,version,licence:issueLicence(key,"shenpaint")}));return {client:c,message:await response};
 }
 return {key,network,clients,connect};
}
test("le protocole natif crée et rejoint la salle, conserve les noms et route les données de chaque côté",async t=>{
 const f=await fixture(t),host=await f.connect("creer","","Hôte"),arrive=next(host.client,m=>m.t==="arrivee"),guest=await f.connect("rejoindre",host.message.code,"Invité");
 assert.equal(host.message.role,"hote");assert.equal(guest.message.place,1);assert.equal(guest.message.role,"invite");assert.deepEqual((await arrive).joueurs,[{place:0,pseudo:"Hôte"},{place:1,pseudo:"Invité"}]);
 const readHost=next(host.client,(_m,b)=>b),guestBytes=Buffer.from([7,1,2,3]);guest.client.send(guestBytes);assert.deepEqual(await readHost,Buffer.concat([Buffer.from([1]),guestBytes]));
 const readGuest=next(guest.client,(_m,b)=>b),hostBytes=Buffer.from([255,3,4,5]);host.client.send(hostBytes);assert.deepEqual(await readGuest,hostBytes.subarray(1));
 const expel=next(guest.client,m=>m.t==="expulse");host.client.send(JSON.stringify({t:"expulser",place:1}));await expel;
});
test("une salle verrouillée ou une version incompatible est refusée sans changer le jeu de l’hôte",async t=>{
 const f=await fixture(t),host=await f.connect("creer");const wrong=await f.connect("rejoindre",host.message.code,"Autre","old");assert.equal(wrong.message.raison,"version");
 host.client.send(JSON.stringify({t:"verrouiller",oui:true}));await new Promise(r=>setTimeout(r,20));const locked=await f.connect("rejoindre",host.message.code);assert.equal(locked.message.raison,"verrouillee");assert.equal(host.client.readyState,1);
});
test("le navigateur ne peut pas accéder au relais local et le faux bonjour ne crée aucune allocation",async t=>{
 const f=await fixture(t),url="ws://127.0.0.1:"+f.network.port,browser=new WebSocket(url,{origin:"https://example.test"});browser.on("error",()=>{});
 const status=await new Promise(resolve=>browser.once("unexpected-response",(_request,response)=>{response.resume();resolve(response.statusCode);}));assert.equal(status,403);
 const client=new WebSocket(url);f.clients.push(client);await once(client,"open");const closed=once(client,"close");client.send(JSON.stringify({t:"bonjour",action:"creer",licence:"false"}));assert.equal((await closed)[0],1008);
});

test("une coupure locale reprend la même salle et les mêmes places, sans créer de nouveau relais",async t=>{
 const f=await fixture(t),host=await f.connect("creer","","Hôte"),guest=await f.connect("rejoindre",host.message.code,"Invité");
 const closed=once(guest.client,"close");guest.client.close();await closed;await new Promise(r=>setTimeout(r,20));
 const resumed=await f.connect("rejoindre",host.message.code,"Invité");assert.equal(resumed.message.reprise,true);assert.equal(resumed.message.place,1);assert.equal(f.network.clients.size,2);
 const closedHost=once(host.client,"close");host.client.close();await closedHost;await new Promise(r=>setTimeout(r,20));
 const wrong=await f.connect("reprendre",host.message.code,"Usurpation");assert.equal(wrong.message.t,"erreur");
 const again=await f.connect("reprendre",host.message.code,"Hôte");assert.equal(again.message.reprise,true);assert.equal(again.message.place,0);assert.equal(f.network.clients.size,2);
 const received=next(again.client,(_m,b)=>b);resumed.client.send(Buffer.from([7,10,11]));assert.deepEqual(await received,Buffer.from([1,7,10,11]));
});
