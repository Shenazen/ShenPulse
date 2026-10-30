"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const {EventEmitter} = require("node:events");
const {randomBytes, timingSafeEqual, createHash} = require("node:crypto");
const {WebSocketServer, WebSocket} = require("ws");
const definitions = require("../../../resources/catalogs/owner-prepared-modules.json");
const instances = new WeakMap();
const scopeFor = store => { const s=store.getState();return String(s.settings?.account?.uid||"")+":"+String(s.session?.profileId||""); };

class PreparedBrowserGame extends EventEmitter {
  constructor({store, gameId, assertAccess = () => {}, spec = definitions[gameId], createWindow}) {
    super();
    if (!spec?.installer?.browserGame) throw new Error("Jeu navigateur non préparé.");
    Object.assign(this,{store,gameId,spec,assertAccess,createWindow});
    this.pending = new Map(); this.requestId = 0; this.ready = false;
  }
  async start() {
    this.assertAccess();
    if (this.server?.listening && this.scope === scopeFor(this.store)) return this.status();
    if (!this.starting) this.starting = this._start().finally(() => {this.starting=null;});
    return this.starting;
  }
  async _start() {
    await this._close(); this.assertAccess();
    this.scope = scopeFor(this.store);
    const root = this.store.getState().game.installations?.[this.gameId]?.path;
    if (!root) throw new Error("Installez d’abord le jeu depuis ShenPulse.");
    const html = await fs.readFile(path.join(root,this.spec.module));
    if (createHash("sha256").update(html).digest("hex") !== this.spec.moduleSha256) throw new Error("Les fichiers du jeu ont changé. Réinstallez le pack.");
    this.ticket = randomBytes(32).toString("hex");
    this.sessionId = randomBytes(12).toString("hex");
    this.sockets = new WebSocketServer({noServer:true,maxPayload:65536,perMessageDeflate:false});
    const server = http.createServer((req,res) => {void this.serve(req,res,html);});
    this.server = server;
    server.on("upgrade",(req,socket,head) => {
      const url = new URL(req.url,"http://127.0.0.1");
      if (req.headers.origin !== this.origin || url.pathname !== "/bridge" || !this.validTicket(url.searchParams.get("ticket"))) {socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");return;}
      this.sockets.handleUpgrade(req,socket,head,client => this.attach(client));
    });
    await new Promise((resolve,reject) => {server.once("error",reject);server.listen({host:"127.0.0.1",port:this.spec.port,exclusive:true},() => {server.off("error",reject);resolve();});});
    this.origin = "http://127.0.0.1:"+server.address().port;
    server.on("error",()=>{this.ready=false;this.failPending("Le serveur local du jeu a été arrêté.");void this.close().catch(()=>{});});
    this.guardTimer = setInterval(() => {try{this.assertCurrentScope();}catch{void this.close();}},3000);this.guardTimer.unref();
    return this.status();
  }
  validTicket(value) {
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) && timingSafeEqual(Buffer.from(value),Buffer.from(this.ticket));
  }
  assertCurrentScope() {
    this.assertAccess();
    if (this.scope !== scopeFor(this.store)) throw new Error("Le compte ou le profil a changé.");
  }
  async serve(req,res,html) {
    try {
      this.assertCurrentScope();
      const url = new URL(req.url,"http://127.0.0.1");
      if (req.method!=="GET" || !this.validTicket(url.searchParams.get("ticket"))) {res.writeHead(403).end();return;}
      res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("X-Frame-Options","DENY");
      if (url.pathname === "/index.html") {
        res.setHeader("Content-Type","text/html; charset=utf-8");
        res.setHeader("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:"+this.server.address().port+"; object-src 'none'; base-uri 'none'");
        const shim='<script src="/shenpulse-bridge.js?ticket='+this.ticket+'"></script>';
        res.end(html.toString("utf8").replace(/<head(?:\s[^>]*)?>/i,match => match+shim));return;
      }
      if (url.pathname === "/shenpulse-bridge.js") {res.setHeader("Content-Type","application/javascript; charset=utf-8");res.end(await fs.readFile(path.join(__dirname,"client.js")));return;}
      res.writeHead(404).end();
    } catch {if(!res.headersSent)res.writeHead(403);res.end();}
  }
  attach(client) {
    this.failPending("Le jeu a été reconnecté ; l’interaction précédente n’est pas rejouée.");this.client?.terminate();this.client=client;this.ready=false;
    const timer=setTimeout(() => {if(!this.ready)client.terminate();},5000);timer.unref();
    client.on("error",()=>{});
    client.on("close",() => {clearTimeout(timer);if(this.client===client){this.client=null;this.ready=false;this.failPending("Le jeu a été fermé ou déconnecté.");this.emit("message",{type:"disconnected"});}});
    client.on("message",bytes => {
      try {
        if(this.client!==client)return;this.assertCurrentScope();const message=JSON.parse(String(bytes));
        if(message.type==="ready"){clearTimeout(timer);this.ready=true;this.emit("message",{type:"connected"});return;}
        if(message.type==="result" && Number.isSafeInteger(message.id)){
          const pending=this.pending.get(message.id);if(!pending)return;clearTimeout(pending.timer);this.pending.delete(message.id);
          if(message.result?.success===true)pending.resolve({status:0,message:String(message.result.message||"Interaction appliquée").slice(0,300)});
          else {const error=new Error(String(message.result?.message||"Le jeu a refusé cette interaction.").slice(0,300));error.status=3;pending.reject(error);}
        }
        if(message.type==="event" && ["win","lose"].includes(message.value?.type))this.emit("game-event",{type:message.value.type,gameId:this.gameId});
      } catch {client.close(1008,"Session invalide");}
    });
  }
  async send(code, options = {}, {assertAccess = () => {}} = {}) {
    assertAccess();await this.start();this.assertCurrentScope();assertAccess();
    if (!this.ready || this.client?.readyState!==WebSocket.OPEN) throw new Error("Le jeu n’est pas encore connecté à ShenPulse. Ouvrez-le depuis sa fiche.");
    const id=++this.requestId;
    const parameters=options.parameters||{};
    const payload={command:String(code),params:parameters,count:Number(parameters.count||options.quantity||1),user:{nickname:String(options.viewer||"Viewer").slice(0,80)},context:{gameSlug:this.gameId},executionId:this.sessionId+":"+id};
    return new Promise((resolve,reject) => {
      const timer=setTimeout(() => {this.pending.delete(id);reject(new Error("Le jeu n’a pas confirmé l’interaction."));},12000);timer.unref();
      this.pending.set(id,{resolve,reject,timer});
      this.client.send(JSON.stringify({type:"effect",id,payload}),error => {if(error){clearTimeout(timer);this.pending.delete(id);reject(error);}});
    });
  }
  status() {return {listening:Boolean(this.server?.listening),connected:this.ready,port:this.server?.address()?.port||this.spec.port};}
  async launch({assertAccess = () => {}} = {}) {
    assertAccess();await this.start();this.assertCurrentScope();
    if(this.window&&!this.window.isDestroyed()){this.window.show();this.window.focus();return {ok:true,alreadyRunning:true};}
    const create=this.createWindow||(options => new(require("electron").BrowserWindow)(options));
    const window=create({width:1366,height:820,minWidth:900,minHeight:600,autoHideMenuBar:true,backgroundColor:"#0b0d17",webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
    this.window=window;window.webContents.setWindowOpenHandler(()=>({action:"deny"}));
    window.webContents.on("will-navigate",(event,url) => {if(!url.startsWith(this.origin+"/index.html?"))event.preventDefault();});
    window.once("closed",() => {if(this.window===window)this.window=null;});
    assertAccess();await window.loadURL(this.origin+"/index.html?ticket="+this.ticket);return {ok:true,gameId:this.gameId};
  }
  failPending(message) {for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(new Error(message));}this.pending.clear();}
  async close(){if(this.starting)await this.starting.catch(()=>{});return this._close();}
  async _close(){
    clearInterval(this.guardTimer);this.ready=false;this.client=null;this.failPending("Session du jeu arrêtée.");
    this.window?.destroy();this.window=null;
    for(const client of this.sockets?.clients||[])client.terminate();this.sockets?.close();this.sockets=null;
    const server=this.server;this.server=null;if(server?.listening)await new Promise(resolve=>server.close(resolve));
  }
}
function bridgeFor(store, gameId, assertAccess) {
  let map=instances.get(store);if(!map){map=new Map();instances.set(store,map);}
  if(!map.has(gameId))map.set(gameId,new PreparedBrowserGame({store,gameId,assertAccess}));
  const bridge=map.get(gameId);bridge.assertAccess=assertAccess;return bridge;
}
module.exports={PreparedBrowserGame,bridgeFor};
