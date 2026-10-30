"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto");
const {commandMap}=require("./fnv-xbox/commands");
const root=path.resolve(__dirname,"../.."),source=path.join(__dirname,"fnv-xbox"),version="1.1.0";
const out=path.join(root,".artifacts/game-pack-builds/fallout-new-vegas",version),stage=path.join(out,"stage/ShenPulseFnv");
const catalog=require("../../resources/catalogs/owner-game-preparation.json").games.find(g=>g.id==="fallout-new-vegas");
const {effects,forms}=commandMap(catalog.effects);
const inputFiles=["module.cpp","bootstrap.cpp","profile.hpp","commands.js","bootstrap.manifest","vendor/json.hpp","vendor/LICENSE.MIT"];
const inputs=Object.fromEntries(inputFiles.map(file=>[file,crypto.createHash("sha256").update(fs.readFileSync(path.join(source,file))).digest("hex")]));
inputs.commands=crypto.createHash("sha256").update(JSON.stringify({effects,forms})).digest("hex");
const published=require("../manifests/game-packs.json").assets.find(a=>a.gameId==="fallout-new-vegas"&&a.id==="xbox-module"&&a.version===version);
if(published){
  const archive=path.join(root,published.buildPath),savedInputs=path.join(out,"build-inputs.json");
  if(!fs.existsSync(archive)||crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex")!==published.sha256)throw Error("Récupérez le pack immuable depuis Backblaze, sans le reconstruire.");
  if(!fs.existsSync(savedInputs)||JSON.stringify(JSON.parse(fs.readFileSync(savedInputs,"utf8")))!==JSON.stringify(inputs))throw Error("Les sources ont changé : choisissez une nouvelle version du pack avant de compiler.");
  console.log("Pack New Vegas Xbox immuable vérifié et réutilisé : "+version);process.exit(0);
}
fs.mkdirSync(stage,{recursive:true});
fs.writeFileSync(path.join(source,"effects.hpp"),"// Generated from the reviewed ShenPulse catalogue.\nstatic const std::map<std::string,std::vector<std::string>> effects={"+Object.entries(effects).map(([k,v])=>"{"+JSON.stringify(k)+",{"+v.map(s=>JSON.stringify(s)).join(",")+"}}").join(",")+"};\nstatic const std::set<std::string> forms={"+forms.map(s=>JSON.stringify(s)).join(",")+"};\n");
const vcRoot=process.env.VCTOOLS_ROOT||"C:/Program Files (x86)/Microsoft Visual Studio/18/BuildTools/VC/Tools/MSVC";
const sdk="C:/Program Files (x86)/Windows Kits/10";
const latest=dir=>fs.readdirSync(dir).filter(n=>/^\d[\d.]+$/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).at(-1);
const vc=path.join(vcRoot,latest(vcRoot)),sv=latest(path.join(sdk,"Include"));
const env={...process.env,INCLUDE:[vc+"/include",...["ucrt","shared","um"].map(x=>sdk+"/Include/"+sv+"/"+x)].join(";"),LIB:[vc+"/lib/x86",...["ucrt","um"].map(x=>sdk+"/Lib/"+sv+"/"+x+"/x86")].join(";"),PATH:sdk+"/bin/"+sv+"/x64;"+process.env.PATH};
function build(file,name,dll){const args=["/nologo","/std:c++17","/O2","/MT","/EHsc","/utf-8",...(dll?["/LD"]:[]),path.join(source,file),"/Fo"+path.join(out,file+".obj"),"/Fe"+path.join(stage,name),"/link","user32.lib",...(dll?["ws2_32.lib"]:["bcrypt.lib","/MANIFEST:EMBED","/MANIFESTUAC:NO","/MANIFESTINPUT:"+path.join(source,"bootstrap.manifest")])];const r=cp.spawnSync(vc+"/bin/Hostx64/x86/cl.exe",args,{env,encoding:"utf8"});process.stdout.write(r.stdout||"");if(r.status)throw Error(r.stderr||"Compilation refusée");}
const hash=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
build("module.cpp","ShenPulse.Fnv.Xbox.dll",true);
const dllHash=hash(path.join(stage,"ShenPulse.Fnv.Xbox.dll"));fs.writeFileSync(path.join(source,"module-hash.hpp"),'static const char* moduleHash="'+dllHash+'";\n');
build("bootstrap.cpp","ShenPulse.Fnv.Bootstrap.exe",false);
fs.copyFileSync(path.join(source,"vendor/LICENSE.MIT"),path.join(stage,"THIRD-PARTY-NOTICES.txt"));
const fileName="fallout-new-vegas-xbox-shenpulse-"+version+".zip",zip=path.join(out,fileName);
const script="import zipfile,sys,pathlib; root=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED); [(z.write(f, str(f.relative_to(root)))) for f in sorted(root.rglob('*')) if f.is_file() and f.suffix.lower() not in ['.lib','.exp']]; z.close()";
const z=cp.spawnSync("python",["-c",script,path.dirname(stage),zip],{encoding:"utf8"});if(z.status)throw Error(z.stderr);
const record={gameId:"fallout-new-vegas",id:"xbox-module",version,key:"installer-assets/fallout-new-vegas/"+version+"/"+fileName,size:fs.statSync(zip).size,sha256:hash(zip),buildPath:path.relative(root,zip).replaceAll("\\","/")};
const files={module:"ShenPulseFnv/ShenPulse.Fnv.Xbox.dll",moduleSha256:dllHash,moduleDependencies:{"ShenPulseFnv/ShenPulse.Fnv.Bootstrap.exe":hash(path.join(stage,"ShenPulse.Fnv.Bootstrap.exe"))}};
fs.writeFileSync(path.join(out,"record.json"),JSON.stringify({record,files},null,2)+"\n");
fs.writeFileSync(path.join(out,"build-inputs.json"),JSON.stringify(inputs,null,2)+"\n");
if(process.argv.includes("--record")) {
  const pubFile=path.join(root,"scripts/manifests/game-packs.json"),pub=JSON.parse(fs.readFileSync(pubFile,"utf8"));
  const old=pub.assets.find(a=>a.key===record.key);if(old&&old.sha256!==record.sha256)throw Error("Version Backblaze immuable : incrémentez celle du pack.");
  if(!old)pub.assets.push(record);fs.writeFileSync(pubFile,JSON.stringify(pub,null,2)+"\n");
  const file=path.join(root,"resources/catalogs/owner-prepared-modules.json"),definitions=JSON.parse(fs.readFileSync(file,"utf8")),d=definitions[record.gameId];
  d.version=version;d.platformModules={...(d.platformModules||{}),xbox:files};d.asset.platforms=["steam",""];
  d.additionalAssets=[{id:record.id,action:"extract",platforms:["xbox"],fileName,size:record.size,sha256:record.sha256,url:"https://f003.backblazeb2.com/file/shenpulse-media/"+record.key}];
  delete d.installer.unsupportedPlatforms;delete d.installer.unsupportedPlatformReasons;
  d.installer.waitForWindowProcess="FalloutNV";d.installer.waitForWindowTimeoutMs=120000;
  fs.writeFileSync(file,JSON.stringify(definitions,null,2)+"\n");
}
console.log(JSON.stringify({record,files},null,2));
