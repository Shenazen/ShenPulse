"use strict";
const fs=require("node:fs/promises"),path=require("node:path"),crypto=require("node:crypto");
const {runProcess}=require("./processes");
const IDENTITY="BethesdaSoftworks.FalloutNewVegas";

async function fnvXboxRoot(directory) {
  let root=path.resolve(directory);
  for(let depth=0;depth<2;depth+=1) {
    const config=await fs.readFile(path.join(root,"MicrosoftGame.Config"),"utf8").catch(()=>"");
    if(config.match(/<Identity\s+Name="([^"]+)"/i)?.[1]===IDENTITY)return root;
    root=path.dirname(root);
  }
  throw Error("Le dossier Xbox de Fallout: New Vegas n’a pas pu être vérifié. Réinstallez ses interactions depuis ShenPulse.");
}

function bootstrapScript(executable,root,nonce) {
  if(!path.isAbsolute(executable)||!path.isAbsolute(root)||/["\r\n\0]/.test(root)||!/^\w{32}$/.test(nonce))throw Error("Paramètres de connexion New Vegas invalides.");
  const payload=Buffer.from(JSON.stringify({executable,root,nonce}),"utf8").toString("base64");
  return [
    "$ErrorActionPreference='Stop'",
    "$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+payload+"')) | ConvertFrom-Json",
    "$arguments=@(('\"'+$p.root+'\"'),$p.nonce)",
    "try { $child=Start-Process -FilePath $p.executable -ArgumentList $arguments -Verb RunAs -WindowStyle Hidden -PassThru -Wait; Write-Output $child.ExitCode } catch { throw 'Autorisation Windows annulée ou connexion impossible. Relancez le jeu depuis ShenPulse et acceptez la demande Windows.' }"
  ].join("\n");
}

async function connectFnvXbox(directory,{assertAccess=()=>{},execute=runProcess,platform=process.platform,nonce=crypto.randomBytes(16).toString("hex")}={}) {
  if(platform!=="win32")throw Error("Le module Game Pass de New Vegas nécessite Windows.");
  const root=await fnvXboxRoot(directory),executable=path.join(root,"ShenPulseFnv/ShenPulse.Fnv.Bootstrap.exe");
  assertAccess();
  const output=await execute("powershell.exe",["-NoProfile","-NonInteractive","-EncodedCommand",Buffer.from(bootstrapScript(executable,root,nonce),"utf16le").toString("base64")]);
  assertAccess();
  const result=await fs.readFile(path.join(root,"ShenPulseFnv/launch-result.json"),"utf8").then(JSON.parse).catch(()=>null);
  if(!result||result.requestId!==nonce||!Number.isInteger(result.code)||String(result.code)!==String(output).trim())throw Error("La connexion à New Vegas n’a pas pu être confirmée. Acceptez la demande Windows puis réessayez.");
  if(result.code!==0)throw Error({
    10:"L’installation Xbox sélectionnée ne correspond pas à New Vegas.",
    11:"New Vegas n’est pas ouvert depuis cette installation Xbox, ou plusieurs instances sont ouvertes. Fermez les autres éditions puis relancez le jeu depuis ShenPulse.",
    12:"Cette version de New Vegas Game Pass nécessite une mise à jour du module ShenPulse. Aucun effet n’a été exécuté.",
    13:"Le module New Vegas a été modifié ou est incomplet. Réinstallez les interactions depuis ShenPulse.",
    14:"Le module New Vegas n’a pas démarré. Fermez le jeu, réinstallez les interactions puis relancez-le depuis ShenPulse."
  }[result.code]||"La connexion à New Vegas a échoué.");
  if(!Number.isSafeInteger(result.pid)||result.pid<=0)throw Error("Processus New Vegas non confirmé.");
  return {root,processId:result.pid};
}
module.exports={fnvXboxRoot,bootstrapScript,connectFnvXbox};
