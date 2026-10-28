"use strict";
const fs=require("node:fs"),path=require("node:path"),{execFileSync}=require("node:child_process");
const root=path.resolve(__dirname,".."),game=path.resolve(process.argv[2]||"C:/Program Files (x86)/Steam/steamapps/common/Stardew Valley");
const out=path.join(root,".artifacts/game-pack-builds/stardew-valley/1.1.0/ShenPulse");fs.mkdirSync(out,{recursive:true});
const refs=["System.Private.CoreLib","mscorlib","System.Runtime","System.Collections","System.Linq","System.Console","System.IO.FileSystem","System.IO","System.Collections.Concurrent","System.Xml.ReaderWriter","System.Private.Xml","System.Net.Sockets","System.Net.Primitives","System.Threading","System.Threading.Tasks","System.Text.Encoding","netstandard","StardewModdingAPI","Stardew Valley","MonoGame.Framework","StardewValley.GameData"].map(n=>path.join(game,n+".dll"));refs.push(path.join(game,"smapi-internal/Newtonsoft.Json.dll"));
const compiler=process.env.SHENPULSE_CSC||path.join(root,".artifacts/cc-audit/super-mario-kart/client/roslyn/csc.exe");
execFileSync(compiler,["/nologo","/noconfig","/target:library","/nostdlib+","/optimize+","/out:"+path.join(out,"ShenPulse.Stardew.dll"),...refs.map(n=>"/r:"+n),path.join(root,"native/farming-games/LocalEffectClient.cs"),path.join(root,"native/stardew-valley/ModEntry.cs")],{windowsHide:true,stdio:"inherit"});
fs.writeFileSync(path.join(out,"manifest.json"),JSON.stringify({Name:"ShenPulse",Author:"ShenPulse",Version:"1.1.0",Description:"Interactions locales ShenPulse pour Stardew Valley.",UniqueID:"ShenPulse.Stardew",EntryDll:"ShenPulse.Stardew.dll",MinimumApiVersion:"4.1.10",UpdateKeys:[]},null,2)+"\n");
console.log("Module Stardew compilé : "+out);

const archive=path.join(path.dirname(out),"stardew-shenpulse-1.1.0.zip");
execFileSync("tar.exe",["-a","-cf",archive,"-C",path.dirname(out),"ShenPulse"],{windowsHide:true});
const data=fs.readFileSync(archive),size=data.length,sha256=require("node:crypto").createHash("sha256").update(data).digest("hex"),key="installer-assets/stardew-valley/1.1.0/"+path.basename(archive);
const installerPath=path.join(root,"src/main/game-installers/stardew-valley.js"),installer=require(installerPath);installer.assets=installer.assets.map(a=>a.id==="mod"?{...a,size,sha256,url:"https://f003.backblazeb2.com/file/shenpulse-media/"+key}:a);
fs.writeFileSync(installerPath,'"use strict";\n\nmodule.exports = '+JSON.stringify(installer,null,2)+';\n');
const metadataPath=path.join(root,"resources/installer-assets/stardew-valley/1.1.0/manifest.json");fs.mkdirSync(path.dirname(metadataPath),{recursive:true});fs.writeFileSync(metadataPath,JSON.stringify({gameId:"stardew-valley",version:"1.1.0",assets:installer.assets},null,2)+"\n");
const registryPath=path.join(__dirname,"manifests/game-packs.json"),registry=JSON.parse(fs.readFileSync(registryPath));let index=registry.assets.findIndex(a=>a.gameId==="stardew-valley"&&a.id==="mod");if(index<0)index=registry.assets.length;registry.assets[index]={gameId:"stardew-valley",id:"mod",version:"1.1.0",key,size,sha256,buildPath:path.relative(root,archive).replace(/\\/g,"/")};fs.writeFileSync(registryPath,JSON.stringify(registry,null,2)+"\n");console.log(JSON.stringify({archive,size,sha256}));
