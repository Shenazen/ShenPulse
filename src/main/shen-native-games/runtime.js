"use strict";
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process'),{EventEmitter}=require('node:events'),{WebSocketServer}=require('ws');
const {SPECS}=require('./specs'),{localCredentials,issueLicence,validToken,scopeKey}=require('./licence');
const instances=new WeakMap();
class ShenNativeGameBridge extends EventEmitter{
 constructor({store,gameId,assertAccess=()=>{},port,networkPort}){super();this.store=store;this.id=gameId;this.spec=SPECS[gameId];if(!this.spec)throw Error('Jeu inconnu.');this.port=port??this.spec.port;this.networkPort=networkPort;this.assertAccess=assertAccess;this.server=null;this.client=null;this.credentials=null;this.confirmed=false;this.scope='';this.startPromise=null;}
 async start(){
  this.assertAccess();const scope=scopeKey(this.store);
  if(this.server&&this.scope===scope)return this.status();
  if(this.startPromise)return this.startPromise;
  this.startPromise=this._start(scope).finally(()=>{this.startPromise=null;});return this.startPromise;
 }
 async _start(scope){
  await this._close();this.assertAccess();this.scope=scope;
  const directory=this.store.getState().game.installations?.[this.id]?.path;if(!directory)throw Error('Installez d’abord '+this.spec.title+' depuis ShenPulse.');
  this.credentials=await localCredentials(this.store,this.id,directory);this.assertAccess();if(scopeKey(this.store)!==scope)throw Error('Le compte ou le profil a changé.');
  const networkPort=this.networkPort??(this.port===0?0:58534);
  const server=http.createServer((_req,res)=>res.writeHead(404).end()),sockets=new WebSocketServer({noServer:true,maxPayload:65536,perMessageDeflate:false});
  this.server=server;this.sockets=sockets;
  server.on('upgrade',(request,socket,head)=>{
   if(request.headers.origin||request.url!=='/'){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
   sockets.handleUpgrade(request,socket,head,client=>this.attach(client));
  });
  await new Promise((resolve,reject)=>{const fail=error=>reject(error.code==='EADDRINUSE'?Error('Le port local de '+this.spec.title+' est occupé. Fermez l’ancienne session et réessayez.'):error);server.once('error',fail);server.listen({host:'127.0.0.1',port:this.port,exclusive:true},()=>{server.off('error',fail);server.on('error',error=>this.emit('error',error));this.port=server.address().port;resolve();});});
  if(this.id==='shenpaint'){
   this.paintNetwork=new(require('./paint-network').PaintNetwork)({credentials:this.credentials,port:networkPort,assertAccess:()=>{this.assertAccess();if(scopeKey(this.store)!==this.scope)throw Error('Le compte ou le profil a changé.');}});
   try{await this.paintNetwork.start();}catch(error){await this._close();throw error.code==='EADDRINUSE'?Error('Le port multijoueur de ShenPaint est occupé. Fermez l’ancienne session et réessayez.'):error;}
  }
  this.renewTimer=setInterval(()=>{try{this.assertAccess();if(scopeKey(this.store)!==this.scope){void this.close();return;}this.renew();}catch{void this.close();}},30000);this.renewTimer.unref();return this.status();
 }
 attach(client){
  let authenticated=false;const timeout=setTimeout(()=>{if(!authenticated)client.terminate();},5000);timeout.unref();
  client.on('error',()=>{});client.on('close',()=>{clearTimeout(timeout);if(this.client===client){this.client=null;this.confirmed=false;this.emit('message',{type:'disconnected'});}});
  client.on('message',bytes=>{
   try{const m=JSON.parse(String(bytes));if(!authenticated){
    this.assertAccess();if(scopeKey(this.store)!==this.scope||m.type!=='bonjour'||!validToken(m.jeton,this.credentials.token)){client.close(1008,'Session invalide');return;}
    authenticated=true;clearTimeout(timeout);this.client?.terminate();this.client=client;this.confirmed=false;this.lastCatalogue='';this.renew();this.confirmed=true;this.syncCatalogue();this.emit('message',{type:'connected'});
   }}catch{client.close(1008,'Message invalide');}
  });
 }
 renew(){if(this.client?.readyState===1)this.client.send(JSON.stringify({type:'ok',licence:issueLicence(this.credentials.privateKey,this.spec.gameId)}));}
 status(){
  const open=this.client?.readyState===1&&this.scope===scopeKey(this.store);
  // Unity release builds can disable logs. The authenticated native handshake confirms the local transport.

  return {ok:!!this.server?.listening,listening:!!this.server?.listening,connected:!!(open&&this.confirmed),host:'127.0.0.1',port:this.port};
 }
 syncCatalogue(){if(!this.pack||this.client?.readyState!==1)return;const catalogue=JSON.stringify(require('./catalogue').nativeCatalogue(this.pack,this.store.getState()));if(catalogue!==this.lastCatalogue){this.client.send(JSON.stringify({type:'catalogue',catalogue}));this.lastCatalogue=catalogue;}}
 async send(code,options={}, {assertAccess=()=>{}}={}){
  assertAccess();await this.start();assertAccess();if(!this.status().connected)throw Error(this.spec.title+' n’est pas encore connecté à ShenPulse. Lancez-le depuis sa fiche et attendez son menu.');
  this.syncCatalogue();
  const avatar=String(options.avatarUrl||'').slice(0,2048),payload={type:'action',texte:String(code||'').slice(0,120),id:String(options.viewerId||'anonymous').slice(0,120),pseudo:String(options.viewer||'Viewer').slice(0,120),avatar:/^https:\/\//i.test(avatar)?avatar:'',combo:Math.max(1,Math.min(100,Math.round(Number(options.quantity)||1))),palier:Math.max(0,Math.min(100000,Math.round(Number(options.parameters?.wins)||0)))};
  if(!payload.texte)throw Error('Aucune interaction n’a été choisie.');
  await new Promise((resolve,reject)=>this.client.send(JSON.stringify(payload),error=>error?reject(error):resolve()));
  return {status:'success',sent:true,message:'Interaction envoyée à '+this.spec.title+'.'};
 }
 async launch({assertAccess=()=>{},findRunning}={}){
  assertAccess();await this.start();assertAccess();const {runningGameProcess}=require('../game-runtime/external-launch'),running=await(findRunning||runningGameProcess)([this.spec.executable]);
  assertAccess();const executable=path.join(this.credentials.root,this.spec.executable);
  if(running){if(running.processes?.some(p=>path.resolve(p.ExecutablePath||'').toLowerCase()!==path.resolve(executable).toLowerCase()))throw Error('Une autre copie de '+this.spec.title+' est ouverte. Fermez-la pour utiliser celle de ShenPulse.');return {ok:true,alreadyRunning:true,path:executable};}
  await fs.promises.writeFile(this.credentials.log,'');assertAccess();
  const child=spawn(executable,['-logFile',this.credentials.log,'--ws','ws://127.0.0.1:'+this.port,'--jeton',this.credentials.token],{cwd:this.credentials.root,windowsHide:false,stdio:'ignore'});
  await new Promise((resolve,reject)=>{child.once('error',reject);child.once('spawn',resolve);});return {ok:true,path:executable,processId:child.pid};
 }
 async close(){if(this.startPromise)await this.startPromise.catch(()=>{});return this._close();}
 async _close(){
  await this.paintNetwork?.close();this.paintNetwork=null;
  clearInterval(this.renewTimer);this.renewTimer=null;this.client=null;this.confirmed=false;
  for(const client of this.sockets?.clients||[])client.terminate();this.sockets?.close();this.sockets=null;
  const server=this.server;this.server=null;if(server?.listening)await new Promise(resolve=>server.close(resolve));
 }
}
function bridgeFor(store,id,assertAccess){let map=instances.get(store);if(!map){map=new Map();instances.set(store,map);}if(!map.has(id))map.set(id,new ShenNativeGameBridge({store,gameId:id,assertAccess}));const bridge=map.get(id);if(assertAccess)bridge.assertAccess=assertAccess;return bridge;}
module.exports={ShenNativeGameBridge,bridgeFor};
