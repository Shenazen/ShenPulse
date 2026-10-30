"use strict";
// Protocol-only probe. An empty temporary installation prevents attachment to any game.
const fs=require("node:fs/promises"),net=require("node:net"),os=require("node:os"),path=require("node:path"),assert=require("node:assert/strict"),{spawn}=require("node:child_process"),{once}=require("node:events");
(async()=>{const {out}=require("../../.artifacts/integration-wave-20261029/pvz-goty-build.json"),root=await fs.mkdtemp(path.join(os.tmpdir(),"shenpulse-pvz-protocol-"));let child,socket;const server=net.createServer();try{server.listen(58836,"127.0.0.1");await once(server,"listening");const connection=once(server,"connection");child=spawn("dotnet",[path.join(out,"ShenPulse.Pvz.Host.dll"),root],{windowsHide:true,stdio:["pipe","pipe","pipe"],shell:false});const failure=once(child,"exit").then(([code])=>{throw Error("Helper exited early: "+code);});socket=(await Promise.race([connection,failure,new Promise((_,reject)=>setTimeout(()=>reject(Error("No local handshake")),10000).unref())]))[0];let buffer="",next=[];socket.on("data",chunk=>{buffer+=String(chunk);while(buffer.includes("\0")){const at=buffer.indexOf("\0"),frame=JSON.parse(buffer.slice(0,at));buffer=buffer.slice(at+1);next.shift()?.(frame);}});
 const send=frame=>new Promise(resolve=>{next.push(resolve);socket.write(JSON.stringify(frame)+"\0");});
 assert.equal((await send({id:1,type:1,code:"unknown"})).status,2);
 assert.equal((await send({id:2,type:1,code:"sun_up",quantity:100})).status,3);
 assert.equal((await send({id:3,type:1,code:"fastbullets"})).status,2);
 child.stdin.end("stop\n");const [code]=await Promise.race([once(child,"exit"),new Promise((_,reject)=>setTimeout(()=>reject(Error("Helper did not stop")),10000).unref())]);assert.equal(code,0);child=null;
 console.log("PVZ local handshake, unknown/disabled effect rejection, no-game refusal and graceful stop verified. No game attached.");
 }finally{socket?.destroy();child?.kill();server.close();await fs.rm(root,{recursive:true,force:true});}})().catch(error=>{console.error(error.message);process.exitCode=1;});
