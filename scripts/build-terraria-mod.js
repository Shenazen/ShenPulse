"use strict";
// tModLoader's documented TMOD container and its own game API; no external client.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const {execFileSync} = require("node:child_process");
const root = path.resolve(__dirname,".."), tmlVersion = "2026.8.3.0", version = "1.1.0";
function str(value) {
 const bytes=Buffer.from(value,"utf8"), length=[];let n=bytes.length;
 do {length.push((n & 127) | (n > 127 ? 128 : 0));n >>>= 7;} while(n);
 return Buffer.concat([Buffer.from(length),bytes]);
}
function int(value){const b=Buffer.alloc(4);b.writeInt32LE(value);return b;}
function packMod(name, dll, file, resources={}, references=[]) {
 const info=Buffer.concat(Object.entries({author:"ShenPulse",version,displayName:name==="ShenPulseTerraria"?"ShenPulse":name,description:"Interactions locales ShenPulse pour Terraria.",buildVersion:tmlVersion}).flatMap(([k,v])=>[str(k),str(v)]).concat(references.length?[str("modReferences"),...references.map(str),str(""),str("")]:[str("")]));
 const entries={Info:info,[name+".dll"]:fs.readFileSync(dll),...resources};
 const files=Object.entries(entries).map(([name,data])=>({name,data:Buffer.isBuffer(data)?data:Buffer.from(data)}));
 const body=Buffer.concat([str(name),str(version),int(files.length),...files.flatMap(f=>[str(f.name),int(f.data.length),int(f.data.length)]),...files.map(f=>f.data)]);
 const result=Buffer.concat([Buffer.from("TMOD"),str(tmlVersion),crypto.createHash("sha1").update(body).digest(),Buffer.alloc(256),int(body.length),body]);
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,result);return result;
}
function findFile(dir,name){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isFile()&&e.name===name)return p;if(e.isDirectory()){const found=findFile(p,name);if(found)return found;}}return "";}
function compileMod(game,name,sources,out,extraRefs=[]) {
 const runtime=path.join(game,"dotnet/shared/Microsoft.NETCore.App/8.0.0");
 const refs=fs.readdirSync(runtime).filter(n=>(n.startsWith("System.")&&!n.includes("Native")||["mscorlib.dll","netstandard.dll","Microsoft.CSharp.dll"].includes(n))&&n.endsWith(".dll")).map(n=>path.join(runtime,n));
 refs.push(path.join(game,"tModLoader.dll"),...extraRefs);
 for(const lib of ["FNA.dll","ReLogic.dll","Newtonsoft.Json.dll","log4net.dll"]) {const file=findFile(path.join(game,"Libraries"),lib);if(!file)throw Error("Missing library "+lib);refs.push(file);}
 fs.mkdirSync(out,{recursive:true});const dll=path.join(out,name+".dll"),rsp=path.join(out,name+".rsp");
 fs.writeFileSync(rsp,["/nologo","/target:library","/nostdlib+","/optimize+",'/out:"'+dll+'"',...refs.map(r=>'/r:"'+r+'"'),...sources.map(s=>'"'+s+'"')].join("\n"));
 const compiler=process.env.SHENPULSE_CSC||path.join(root,".artifacts/cc-audit/super-mario-kart/client/roslyn/csc.exe");
 execFileSync(compiler,["/noconfig","@"+rsp],{windowsHide:true,stdio:"inherit"});return dll;
}
if(require.main===module){
 const registered=JSON.parse(fs.readFileSync(path.join(__dirname,"manifests/game-packs.json"),"utf8")).assets;
 if(registered.some(a=>a.gameId==="terraria"&&a.version===version)) throw Error("Cette version du module est figée dans le registre Backblaze. Incrémentez la version du module avant une nouvelle compilation.");
 const game=path.resolve(process.argv[2]||"C:/Program Files (x86)/Steam/steamapps/common/tModLoader"),out=path.join(root,".artifacts/game-pack-builds/terraria",version);
 const dll=compileMod(game,"ShenPulseTerraria",[path.join(root,"native/farming-games/LocalEffectClient.cs"),path.join(root,"native/terraria/ShenPulseTerraria.cs")],out);
 const file=path.join(out,"ShenPulseTerraria.tmod"),data=packMod("ShenPulseTerraria",dll,file,{"Localization/fr-FR.hjson":JSON.stringify({Mods:{ShenPulseTerraria:{NPCs:{GoldenSlime:{DisplayName:"Slime doré"}}}}})});
 console.log(JSON.stringify({file,size:data.length,sha256:crypto.createHash("sha256").update(data).digest("hex")}));
}
module.exports={compileMod,packMod};
