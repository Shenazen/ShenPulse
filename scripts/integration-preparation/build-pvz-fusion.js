"use strict";
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto");
const repo=path.resolve(__dirname,"../.."),capture=path.join(repo,".artifacts/integration-wave-20261029"),out=path.join(os.tmpdir(),"shenpulse-pvz-build"),pins=require("./pvz-inputs.json");
for(const [file,hash]of Object.entries(pins))if(crypto.createHash("sha256").update(fs.readFileSync(path.join(repo,file))).digest("hex")!==hash)throw Error("Input changed: "+file);
fs.mkdirSync(out,{recursive:true});
const csc=path.join(repo,".artifacts/cc-audit/super-mario-kart/client/roslyn/csc.exe"),runtime="C:/Program Files/dotnet/shared/Microsoft.NETCore.App/6.0.36",sdk=path.join(capture,"melonloader-073/MelonLoader/net6");
function managed(file){const b=fs.readFileSync(file);try{const pe=b.readUInt32LE(60),optional=pe+24,start=optional+(b.readUInt16LE(optional)===0x20b?112:96);return b.readUInt32LE(start+14*8)!==0;}catch{return false;}}
const refs=fs.readdirSync(runtime).filter(x=>x.endsWith(".dll")&&managed(path.join(runtime,x))).map(x=>"/reference:"+path.join(runtime,x));
function run(exe,args){try{return cp.execFileSync(exe,args,{encoding:"utf8",windowsHide:true,maxBuffer:8*1024*1024});}catch(error){throw Error(String(error.stdout||error.stderr||error.message));}}
run(csc,["/nologo","/target:library","/nostdlib+","/langversion:latest","/deterministic+","/out:"+path.join(out,"ShenPulse.Fusion.Bridge.dll"),...refs,"/reference:"+path.join(sdk,"MelonLoader.dll"),"/reference:"+path.join(sdk,"Newtonsoft.Json.dll"),path.join(__dirname,"pvz-bridge.cs")]);
run(csc,["/nologo","/target:exe","/out:"+path.join(out,"PvzModuleTool.exe"),"/reference:"+path.join(repo,".tmp-cecil/package/lib/net40/Mono.Cecil.dll"),path.join(__dirname,"PvzModuleTool.cs")]);fs.copyFileSync(path.join(repo,".tmp-cecil/package/lib/net40/Mono.Cecil.dll"),path.join(out,"Mono.Cecil.dll"));
run(path.join(out,"PvzModuleTool.exe"),[path.join(capture,"s2e-modules/PvZFusion/module.zip.extracted/Mods/S2EPvZFusionMod.dll"),path.join(out,"ShenPulse.Fusion.Engine.dll")]);
console.log(run("python",["-X","utf8",path.join(__dirname,"package-pvz-fusion.py"),out]));
