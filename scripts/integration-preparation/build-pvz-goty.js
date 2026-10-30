"use strict";
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),{createHash}=require("node:crypto");
const root=path.resolve(__dirname,"../.."),capture=path.join(root,".artifacts/integration-wave-20261029"),pins=require("./pvz-goty-inputs.json"),client=path.join(process.env.APPDATA,"CrowdControl-Apps/Client",pins.clientVersion),out=path.join(os.tmpdir(),"shenpulse-pvz-goty-build"),runtime="C:/Program Files/dotnet/shared/Microsoft.NETCore.App/8.0.31";
const source=path.join(capture,"sources/WarpWorld-CCPack-PC-PlantsVsZombies.zip.extracted/CCPack-PC-PlantsVsZombies-main/PlantsVsZombies.cs");
const hash=data=>createHash("sha256").update(data).digest("hex");
if(hash(fs.readFileSync(source))!==pins.sourceSha256)throw Error("PVZ engine source changed");
if(hash(fs.readFileSync(path.join(capture,"roslyn-4.14.0.nupkg")))!==pins.compilerSha256)throw Error("Compiler archive changed");
fs.mkdirSync(out,{recursive:true});
for(const [name,expected]of Object.entries(pins.dependencies)){const data=fs.readFileSync(path.join(client,name));if(hash(data)!==expected)throw Error("Dependency changed: "+name);fs.writeFileSync(path.join(out,name),data);}
function managed(file){const b=fs.readFileSync(file);if(b.toString("ascii",0,2)!=="MZ")return false;const pe=b.readUInt32LE(60)+24;return Boolean(b.readUInt32LE(pe+(b.readUInt16LE(pe)===0x20b?112:96)+14*8));}
const refs=[...fs.readdirSync(runtime).filter(n=>n.endsWith(".dll")&&managed(path.join(runtime,n))).map(n=>path.join(runtime,n)),...Object.keys(pins.dependencies).map(n=>path.join(out,n))].map(n=>"/reference:"+n);
const csc=path.join(os.tmpdir(),"shenpulse-roslyn414/csc.exe");
function run(args){try{return cp.execFileSync(csc,["/nologo","/nostdlib+","/langversion:latest","/deterministic+",...args],{encoding:"utf8",windowsHide:true,maxBuffer:2e6});}catch(e){throw Error(String(e.stdout||e.stderr||e.message));}}
const globals=path.join(out,"GlobalUsings.cs");fs.writeFileSync(globals,"global using System; global using System.Linq; global using System.Text; global using System.Collections.Generic;");
run(["/target:library","/out:"+path.join(out,"ShenPulse.Pvz.Engine.dll"),...refs,globals,source]);
run(["/target:exe","/out:"+path.join(out,"ShenPulse.Pvz.Host.dll"),...refs,"/reference:"+path.join(out,"ShenPulse.Pvz.Engine.dll"),path.join(__dirname,"pvz-goty-host.cs")]);
fs.writeFileSync(path.join(out,"ShenPulse.Pvz.Host.runtimeconfig.json"),JSON.stringify({runtimeOptions:{tfm:"net8.0",framework:{name:"Microsoft.NETCore.App",version:"8.0.31"}}}));
const catalog=JSON.parse(cp.execFileSync("dotnet",[path.join(out,"ShenPulse.Pvz.Host.dll"),"--catalog"],{encoding:"utf8",windowsHide:true}));
const expected=require(path.join(capture,"upstream/PlantsVsZombies/pack.json"));for(const code of Object.keys(expected.effects.game))if(!catalog.includes(code))throw Error("Missing effect: "+code);
fs.writeFileSync(path.join(capture,"pvz-goty-build.json"),JSON.stringify({out,runtime,files:[...Object.keys(pins.dependencies),"ShenPulse.Pvz.Engine.dll","ShenPulse.Pvz.Host.dll"],catalog},null,2));
console.log("PVZ source compiled; "+catalog.length+" local effect handlers found. No game started.");
