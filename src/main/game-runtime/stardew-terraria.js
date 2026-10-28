"use strict";
const fs=require("node:fs/promises"),path=require("node:path");
const {runProcess}=require("./processes");
const {terrariaManualLauncher,configureTerrariaMod,terrariaProfile}=require("./terraria-installation");
const isModdedFarmGame=id=>["stardew-valley","terraria"].includes(id);
async function findModdedGameProcess(gameId,root,{platform=process.platform,execute=runProcess,userDataPath}={}) {
 if(!isModdedFarmGame(gameId)||platform!=="win32")return null;
 const config={names:gameId==="terraria"?["dotnet.exe","tModLoader.exe"]:["StardewModdingAPI.exe","Stardew Valley.exe","StardewValley.exe"],terraria:gameId==="terraria"};
 const encoded=Buffer.from(JSON.stringify(config)).toString("base64");
 const output=await execute("powershell.exe",["-NoProfile","-NonInteractive","-Command",[
  "$taskConfig=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+encoded+"')) | ConvertFrom-Json",
  "Get-CimInstance Win32_Process | Where-Object { $taskConfig.names -contains $_.Name } | Where-Object { -not $taskConfig.terraria -or $_.Name -ieq 'tModLoader.exe' -or $_.CommandLine -match '(?i)tModLoader[.]dll(?:[\\s\"]|$)' } | Select-Object ProcessId,Name,ExecutablePath,CommandLine | ConvertTo-Json -Compress",
  "exit 0"].join("\n")]);
 if(!String(output).trim())return null;
 const parsed=JSON.parse(output),list=Array.isArray(parsed)?parsed:[parsed];
 for(const item of list){if(!Number.isSafeInteger(item.ProcessId)||item.ProcessId<=0)throw Error("Processus de jeu impossible à vérifier.");
  const executable=String(await fs.realpath(item.ExecutablePath||"").catch(()=>item.ExecutablePath||"")).replace(/\\/g,"/").toLowerCase(),prefix=(await fs.realpath(root).catch(()=>path.resolve(root))).replace(/\\/g,"/").toLowerCase()+"/";
  const command=String(item.CommandLine||"").replace(/\\/g,"/").toLowerCase();
  if(!executable.startsWith(prefix)&&!command.includes(prefix+"tmodloader.dll"))throw Error("Ce jeu est déjà ouvert depuis une autre installation ou son emplacement ne peut pas être vérifié. Fermez-le avant de le relancer depuis ShenPulse.");
  if(gameId==="terraria"&&userDataPath&&!/-terrariasteamclient(?:\s|$)/i.test(item.CommandLine||"")) {
   const selected=String(item.CommandLine||"").match(/(?:^|\s)-tmlsavedirectory\s+(?:"([^"]+)"|(\S+))/i);
   const actual=selected&&(await fs.realpath(selected[1]||selected[2]).catch(()=>path.resolve(selected[1]||selected[2]))).replace(/\\/g,"/").toLowerCase();
   const expected=(await fs.realpath(terrariaProfile(userDataPath)).catch(()=>terrariaProfile(userDataPath))).replace(/\\/g,"/").toLowerCase();
   if(actual!==expected)throw Error("Terraria est ouvert sans le lancement ShenPulse. Fermez tModLoader puis utilisez Lancer le jeu dans ShenPulse pour charger les interactions.");
  }
  if(gameId==="stardew-valley"&&!/^StardewModdingAPI[.]exe$/i.test(item.Name)&&!(await fs.readFile(path.join(root,path.basename(item.ExecutablePath))).catch(()=>Buffer.alloc(0))).includes(Buffer.from("StardewModdingAPI.dll")))throw Error("Stardew Valley est ouvert sans SMAPI. Fermez-le puis utilisez Lancer le jeu dans ShenPulse.");
 }
 return list.length?{...list[0],processes:list}:null;
}
async function assertModdedGameReady(gameId,root,userDataPath){
 if(gameId==="stardew-valley") {const metadata=JSON.parse(await fs.readFile(path.join(root,"Mods/ShenPulse/manifest.json"),"utf8").catch(()=>"{}"));if(metadata.EntryDll!=="ShenPulse.Stardew.dll"||!(await fs.stat(path.join(root,"Mods/ShenPulse/ShenPulse.Stardew.dll")).catch(()=>null))?.isFile())throw Error("Réinstallez les interactions Stardew Valley depuis ShenPulse avant de lancer le jeu.");}
 if(gameId==="stardew-valley") {const config=await fs.readFile(path.join(root,"MicrosoftGame.Config"),"utf8").catch(()=>"");if(config.includes('Name="ConcernedApe.StardewValleyPC"')){const exe=await fs.readFile(path.join(root,"Stardew Valley.exe")).catch(()=>Buffer.alloc(0));if(!exe.includes(Buffer.from("StardewModdingAPI.dll")))throw Error("Stardew Valley a été mis à jour dans Xbox. Réinstallez les interactions pour réactiver SMAPI.");}}
 if(gameId==="terraria"){const profile=terrariaProfile(userDataPath);for(const file of [path.join(root,"tModLoader.dll"),path.join(root,"dotnet/dotnet.exe"),path.join(profile,"Mods/ShenPulseTerraria.tmod"),path.join(profile,"ShenPulse-Terraria.cmd")])if(!(await fs.stat(file).catch(()=>null))?.isFile())throw Error("Réinstallez les interactions Terraria dans ShenPulse pour préparer le chargeur, son runtime et les interactions.");
 const enabled=JSON.parse(await fs.readFile(path.join(profile,"Mods/enabled.json"),"utf8"));if(!Array.isArray(enabled)||!enabled.includes("ShenPulseTerraria")||enabled.includes("CrowdControlMod"))throw Error("Réinstallez les interactions Terraria pour activer le module ShenPulse.");}
}
async function prepareStardewGamePassBootstrap({gameId,targetPath,deploymentRoot,backupRoot,assertAccess=()=>{}}) {
 if(gameId!=="stardew-valley")return null;
 const config=await fs.readFile(path.join(targetPath,"MicrosoftGame.Config"),"utf8").catch(()=>"");
 if(!/<Identity\s+Name="ConcernedApe[.]StardewValleyPC"/i.test(config))return null;
 const source=path.join(targetPath,"Stardew Valley.exe"),original=path.join(targetPath,"Stardew Valley original.exe");
 const smapi=await fs.readFile(path.join(deploymentRoot,"StardewModdingAPI.exe"));
 if(!smapi.includes(Buffer.from("StardewModdingAPI.dll")))throw Error("Lanceur SMAPI invalide.");
 await fs.writeFile(path.join(deploymentRoot,"Stardew Valley.exe"),smapi);
 const current=await fs.readFile(source).catch(e=>{if(["EPERM","EACCES"].includes(e.code))return null;throw e;});
 if(current?.includes(Buffer.from("StardewModdingAPI.dll"))){if(!(await fs.stat(original).catch(()=>null))?.isFile())throw Error("Le lanceur Xbox original est introuvable. Réparez le jeu dans Xbox puis réinstallez les interactions.");return null;}
 // Xbox forbids reading its protected launcher. A rename in the game folder
 // preserves it without changing permissions or decrypting the executable.
 const previous=(await fs.stat(original).catch(()=>null))?original+".shenpulse-"+Date.now()+"-"+require("node:crypto").randomBytes(4).toString("hex")+".exe":"";
 assertAccess();if(previous)await fs.rename(original,previous);
 try{assertAccess();await fs.rename(source,original);}catch(e){if(previous)await fs.rename(previous,original);throw e;}
 const rollback=async()=>{const now=await fs.readFile(source).catch(e=>{if(e.code==="ENOENT")return null;throw e;});if(now&&!now.equals(smapi))throw Error("Le lanceur a changé pendant l’installation ; sa sauvegarde reste dans "+original);if(now)await fs.unlink(source);await fs.rename(original,source);if(previous)await fs.rename(previous,original);};
 try{await fs.mkdir(backupRoot,{recursive:true});await fs.writeFile(path.join(backupRoot,"stardew-xbox-bootstrap.json"),JSON.stringify({original,previous:previous||null},null,2));}catch(e){await rollback();throw e;}
 return {original,previous,rollback};
}
module.exports={isModdedFarmGame,terrariaManualLauncher,findModdedGameProcess,assertModdedGameReady,configureTerrariaMod,prepareStardewGamePassBootstrap};
