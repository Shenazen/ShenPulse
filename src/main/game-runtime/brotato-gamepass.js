"use strict";
const fs=require("node:fs/promises"),path=require("node:path"),crypto=require("node:crypto");
const hvp=require("./hvp-archive"),{installationPlatform}=require("./installation-platform");
const PAYLOAD="ShenPulseBrotato/xbox-scripts.json",STATE="ShenPulseBrotato/hvp-state.json",ORIGINAL="ShenPulseBrotato/boot.original.hvp";
const hash=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
const marker="ShenPulse native bridge";
const bootstrap=["", "\t# ShenPulse native bridge",'\tif get_node_or_null("/root/ShenPulseBridge") == null:', '\t\tvar shen_script = load("res://mods-unpacked/shenpulse-bridge/mod_main.gd")', '\t\tif shen_script != null:', '\t\t\tvar shen_bridge = shen_script.new()', '\t\t\tshen_bridge.name = "ShenPulseBridge"', '\t\t\tget_tree().get_root().call_deferred("add_child", shen_bridge)', ""].join("\n");
function once(source,needle,replacement){if(source.split(needle).length!==2)throw Error("Cette version de Brotato a changé. Le module doit être adapté avant de modifier ses fichiers.");return source.replace(needle,replacement);}
function patchArchive(original,payload){
 if(payload?.schemaVersion!==1||!payload.files||typeof payload.version!=="string")throw Error("Pack Brotato invalide.");
 const archive=hvp.readArchive(original),titlePath="ui/menus/title_screen/title_screen.gd";
 let title=hvp.readFile(archive,titlePath).toString("utf8"),main=hvp.readFile(archive,"main.gd").toString("utf8");
 if(title.includes(marker)||main.includes(marker))throw Error("L’archive Brotato contient déjà le module. Sa sauvegarde d’origine est nécessaire.");
 title=once(title,"func _ready() -> void:","func _ready() -> void:"+bootstrap);
 for(const [signature,call]of [
  ["func _on_enemy_died(enemy: Enemy, args: Entity.DieArgs) -> void:",'_shenpulse_notify("enemy_died", {"killed_by_player": 1 if args.enemy_killed_by_player and not args.cleaning_up else 0})'],
  ["func _on_player_died(p_player: Player, _args: Entity.DieArgs) -> void:",'_shenpulse_notify("player_died")'],
  ["func _on_WaveTimer_timeout() -> void:",'_shenpulse_notify("wave_ended")'],
  ["func _change_scene(path: String) -> void:",'_shenpulse_notify("game_leaving")']
 ]) main=once(main,signature,signature+"\n\t"+call);
 main+='\n# '+marker+'\nfunc _shenpulse_notify(event: String, data: Dictionary = {}) -> void:\n\tvar bridge = get_node_or_null("/root/ShenPulseBridge")\n\tif bridge != null:\n\t\tbridge.notify_game_event(event, data)\n';
 hvp.putFile(archive,titlePath,Buffer.from(title));hvp.putFile(archive,"main.gd",Buffer.from(main));
 const allowed=new Set(["mod_main.gd","shenpulse_game.gd","overlay.gd","scaler.gd","blackout.gd","manifest.json"]);
 if(Object.keys(payload.files).length!==allowed.size)throw Error("Fichiers du pack Brotato incomplets.");
 for(const [name,source]of Object.entries(payload.files)){
  if(!allowed.delete(name)||typeof source!=="string"||Buffer.byteLength(source)>512*1024)throw Error("Fichier du pack Brotato invalide.");
  hvp.putFile(archive,"mods-unpacked/shenpulse-bridge/"+name,Buffer.from(source));
 }
 return hvp.writeArchive(archive);
}
async function isXbox(targetPath){return await installationPlatform(targetPath,{detectPlatform:true,xboxIdentity:"19886SeavenStudio.Brotato"})==="xbox";}
function validReceipt(value){return value?.schemaVersion===1&&[value.originalHash,value.patchedHash,value.payloadHash].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v));}
async function stageBrotatoGamePass({gameId,targetPath,deploymentRoot,assertAccess=()=>{}}){
 if(gameId!=="brotato"||!await isXbox(targetPath))return null;
 const payloadBytes=await fs.readFile(path.join(deploymentRoot,PAYLOAD)),payload=JSON.parse(payloadBytes),current=await fs.readFile(path.join(targetPath,"boot.hvp"));
 let original=current;
 const previous=await fs.readFile(path.join(targetPath,STATE),"utf8").then(JSON.parse).catch(e=>{if(e.code==="ENOENT")return null;throw e;});
 if(previous){
  if(!validReceipt(previous))throw Error("Suivi du module Brotato invalide.");
  if(hash(current)===previous.patchedHash){
   original=await fs.readFile(path.join(targetPath,ORIGINAL));
   if(hash(original)!==previous.originalHash)throw Error("La sauvegarde Brotato a été modifiée.");
  }
 }
 const patched=patchArchive(original,payload),receipt={schemaVersion:1,version:payload.version,originalHash:hash(original),patchedHash:hash(patched),payloadHash:hash(payloadBytes)};
 assertAccess();await fs.mkdir(path.join(deploymentRoot,"ShenPulseBrotato"),{recursive:true});
 await fs.writeFile(path.join(deploymentRoot,ORIGINAL),original);
 await fs.writeFile(path.join(deploymentRoot,"boot.hvp"),patched);
 await fs.writeFile(path.join(deploymentRoot,STATE),JSON.stringify(receipt,null,2)+"\n");
 return receipt;
}
async function assertBrotatoReady(targetPath){
 if(!await isXbox(targetPath))return;
 const receipt=JSON.parse(await fs.readFile(path.join(targetPath,STATE),"utf8").catch(()=>"null"));
 if(!validReceipt(receipt)||hash(await fs.readFile(path.join(targetPath,"boot.hvp")))!==receipt.patchedHash||hash(await fs.readFile(path.join(targetPath,PAYLOAD)))!==receipt.payloadHash)throw Error("L’intégration Brotato Game Pass doit être installée ou réparée depuis ShenPulse.");
}
async function restoreBrotatoArchive(targetPath,{assertAccess=()=>{}}={}){
 const receipt=JSON.parse(await fs.readFile(path.join(targetPath,STATE),"utf8"));
 const current=await fs.readFile(path.join(targetPath,"boot.hvp")),original=await fs.readFile(path.join(targetPath,ORIGINAL));
 if(!validReceipt(receipt)||hash(current)!==receipt.patchedHash||hash(original)!==receipt.originalHash)throw Error("Les fichiers Brotato ont changé. La restauration automatique est interrompue pour conserver vos autres modifications.");
 assertAccess();await fs.writeFile(path.join(targetPath,"boot.hvp"),original);return {restored:true};
}
module.exports={patchArchive,stageBrotatoGamePass,assertBrotatoReady,restoreBrotatoArchive,PAYLOAD,STATE,ORIGINAL};
