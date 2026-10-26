"use strict";
const net = require("node:net"), crypto = require("node:crypto"), WebSocket = require("ws");
class ObsRpc {
  constructor() { this.pending = new Map(); }
  async connect(config) {
    const digest = value => crypto.createHash("sha256").update(value).digest("base64");
    await new Promise((resolve,reject) => {
      const socket = this.socket = new WebSocket("ws://127.0.0.1:" + (Number(config.server_port) || 4455));
      const timer = setTimeout(()=>{socket.terminate();reject(new Error("OBS ne répond pas à sa connexion locale."));},6000);
      socket.on("error",()=>{clearTimeout(timer);reject(new Error("La connexion locale OBS est indisponible."));});
      socket.on("close",()=>{for(const {reject:fail,timer:wait} of this.pending.values()){clearTimeout(wait);fail(new Error("La connexion OBS est fermée."));}this.pending.clear();});
      socket.on("message",buffer=>{try { const message=JSON.parse(buffer.toString());
        if(message.op===0){const auth=message.d.authentication;socket.send(JSON.stringify({op:1,d:{rpcVersion:1,eventSubscriptions:0,...(auth?{authentication:digest(digest(String(config.server_password||"")+auth.salt)+auth.challenge)}:{})}}));}
        if(message.op===2){clearTimeout(timer);resolve();}
        if(message.op===7){const result=message.d,call=this.pending.get(result.requestId);if(call){this.pending.delete(result.requestId);clearTimeout(call.timer);result.requestStatus?.result?call.resolve(result.responseData||{}):call.reject(new Error(String(result.requestStatus?.comment||"Commande OBS refusée.").slice(0,300)));}}
      }catch{clearTimeout(timer);reject(new Error("Réponse OBS invalide."));}});
    }); return this;
  }
  call(requestType,requestData={}) {return new Promise((resolve,reject)=>{const requestId=crypto.randomUUID();const timer=setTimeout(()=>{this.pending.delete(requestId);reject(new Error("OBS n’a pas confirmé "+requestType));},8000);this.pending.set(requestId,{resolve,reject,timer});this.socket.send(JSON.stringify({op:6,d:{requestId,requestType,requestData}}));});}
  close(){this.socket?.close();}
}
class StreamlabsRpc {
  constructor({pipePath="\\\\.\\pipe\\slobs"}={}){this.pending=new Map();this.sequence=0;this.pipePath=pipePath;}
  async connect(){await new Promise((resolve,reject)=>{const socket=this.socket=net.createConnection(this.pipePath);const timer=setTimeout(()=>{socket.destroy();reject(new Error("Streamlabs ne répond pas à sa connexion locale."));},4000);let buffer="";socket.once("connect",()=>{clearTimeout(timer);resolve();});socket.on("error",()=>{clearTimeout(timer);reject(new Error("La connexion locale Streamlabs est indisponible."));});socket.on("close",()=>{for(const call of this.pending.values()){clearTimeout(call.timer);call.reject(new Error("La connexion Streamlabs est fermée."));}this.pending.clear();});socket.on("data",chunk=>{buffer+=chunk.toString();if(buffer.length>4_000_000){socket.destroy();return;}let end;while((end=buffer.indexOf("\n"))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{this.receive(JSON.parse(line));}catch{/* Ignore malformed unsolicited frames. */}}});});return this;}
  receive(frame){
    let key=frame.id;const event=frame.result;if(event?._type==="EVENT"&&event.emitter==="PROMISE")key=event.resourceId;
    const call=this.pending.get(key);if(!call)return;
    if(event?._type==="SUBSCRIPTION"&&event.emitter==="PROMISE"){this.pending.delete(key);this.pending.set(event.resourceId,call);return;}
    this.pending.delete(key);clearTimeout(call.timer);
    if(frame.error||event?.isRejected)call.reject(new Error(String(frame.error?.message||"Commande Streamlabs refusée.").slice(0,300)));else call.resolve(event?._type==="EVENT"?event.data:frame.result);
  }
  call(resource,method,...args){return new Promise((resolve,reject)=>{const id=++this.sequence;const timer=setTimeout(()=>{for(const [key,call] of this.pending)if(call.timer===timer)this.pending.delete(key);reject(new Error("Streamlabs n’a pas confirmé "+method));},12000);this.pending.set(id,{resolve,reject,timer});this.socket.write(JSON.stringify({jsonrpc:"2.0",id,method,params:{resource,args}})+"\n");});}
  close(){this.socket?.end();}
}
module.exports={ObsRpc,StreamlabsRpc};
