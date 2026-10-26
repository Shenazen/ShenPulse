"use strict";
const path = require("node:path"), fs = require("node:fs"), { spawn } = require("node:child_process");
const { discoverInstalled, running } = require("./discovery");
const { stableId, readJson } = require("./layout");
const { installTikTok } = require("./tiktok");
const { installObsOffline, installObsOnline } = require("./obs");
const { installStreamlabs } = require("./streamlabs");
const { readState } = require("../state-projection");
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
function launch(target,args=[]){return new Promise((resolve,reject)=>{const process=spawn(target.executable,args,{cwd:path.dirname(target.executable),windowsHide:false,detached:true,stdio:"ignore"});process.once("error",()=>reject(new Error("Impossible d’ouvrir "+target.name)));process.once("spawn",()=>{process.unref();resolve();});});}
class StudioInstallationService {
  constructor({store,core,requireGameAccess,discoverImpl=discoverInstalled,runningImpl=running,launchImpl=launch,adapters={}}){Object.assign(this,{store,core,requireGameAccess,discover:discoverImpl,running:runningImpl,launch:launchImpl});this.adapters={tiktok:installTikTok,obsOffline:installObsOffline,obsOnline:installObsOnline,streamlabs:installStreamlabs,...adapters};this.busy=new Set();}
  async requestOpening(target,args=[]){
    try{await this.launch(target,args);return {opening:"requested",openingMessage:"Ouverture de "+target.name+" demandée. Si la fenêtre ne s’affiche pas, vous pouvez ouvrir l’application manuellement."};}
    catch{return {opening:"manual",openingMessage:"La scène est installée. Vous pouvez maintenant ouvrir "+target.name+" pour l’utiliser."};}
  }
  async status(){return Promise.all((await this.discover()).map(async target=>({id:target.id,name:target.name,installed:target.installed,running:target.installed?await this.running(target.process):false})));}
  scope(options){const s=readState(this.store,["settings.account.uid","session.profileId"]);if(options.accountUid!==undefined&&options.accountUid!==(s.settings?.account?.uid||""))throw new Error("Le compte a changé. Rouvrez l’installation sur le studio.");if(options.profileId!==s.session.profileId)throw new Error("Le profil a changé. Rouvrez l’installation sur le studio.");this.requireGameAccess("supermarket-simulator");return JSON.stringify([s.settings?.account?.uid||"",s.session.profileId]);}
  async install(options={}){
    if(!["tiktok","obs","streamlabs"].includes(options.studioId))throw new Error("Studio inconnu.");
    const scope=this.scope(options),key=options.studioId;if(this.busy.has(key))throw new Error("Une installation est déjà en cours pour ce studio.");
    this.busy.add(key);
    try{
      const target=(await this.discover()).find(s=>s.id===key);if(!target?.installed)throw new Error("Ce logiciel n’est pas installé sur ce PC.");
      const snapshot=this.core.snapshot(),state=snapshot.state,pack=snapshot.packs.find(s=>s.id==="supermarket-simulator"),profile=state.profiles.find(p=>p.id===options.profileId);
      const base=snapshot.overlayUrls?.gamePack||snapshot.localOverlayUrls?.gamePack;if(!base)throw new Error("La source d’interactions n’est pas encore disponible.");
      const url=new URL(base);url.searchParams.set("jeu","supermarket-simulator");url.searchParams.set("profile",options.profileId);url.searchParams.set("lang","fr");url.searchParams.delete("motion");url.searchParams.delete("model");
      const identity=scope+":supermarket-simulator";
      const plan={identity,packId:"supermarket-simulator",profileId:options.profileId,gameName:pack?.name||"Supermarket Simulator",sceneName:"Supermarket Simulator · ShenPulse · "+String(profile?.name||stableId(identity).slice(0,8)).slice(0,35),executable:"Supermarket Simulator.exe",overlayUrl:url.href,assertScope:()=>{if(this.scope(options)!==scope)throw new Error("Le compte ou le profil a changé. Installation annulée.");}};
      let opened=await this.running(target.process);plan.assertScope();
      if(key==="tiktok"&&opened)return {status:"needs-close",studioId:key,studioName:target.name,message:"Fermez TikTok LIVE Studio, puis cliquez sur Réessayer. ShenPulse ajoutera la scène et rouvrira le studio. Aucun LIVE ne sera arrêté automatiquement."};
      if(key==="obs"&&opened&&!readJson(path.join(target.configRoot,"plugin_config","obs-websocket","config.json"),{}).server_enabled)return {status:"needs-close",studioId:key,studioName:target.name,message:"Fermez OBS, puis cliquez sur Réessayer. La scène sera installée dans sa propre collection, puis OBS sera rouvert. Vos collections existantes sont conservées."};
      if(key==="tiktok"&&!fs.existsSync(path.join(target.configRoot,"TTStore","services.json"))){try{await this.launch(target);}catch{/* The user can initialize the installed app manually. */}return {status:"needs-setup",studioId:key,studioName:target.name,message:"Ouvrez TikTok LIVE Studio et terminez son premier lancement, puis fermez-le et réessayez l’installation de la scène."};}
      let result;
      if(key==="tiktok")result=await this.adapters.tiktok(target,plan);
      if(key==="obs")result=await this.adapters[opened?"obsOnline":"obsOffline"](target,plan);
      if(key==="streamlabs"){
        if(!opened){try{await this.launch(target);opened=true;}catch{return {status:"needs-open",studioId:key,studioName:target.name,message:"Ouvrez Streamlabs Desktop, puis cliquez sur Réessayer pour installer la scène."};}}
        const end=Date.now()+20000;for(;;){try{result=await this.adapters.streamlabs(target,plan);break;}catch(error){if(Date.now()>=end||!/(connexion locale|ne répond pas)/i.test(error.message))throw error;plan.assertScope();await wait(700);}}
      }
      plan.assertScope();const opening=opened?{opening:"already-open",openingMessage:"La scène est prête dans "+target.name+"."}:await this.requestOpening(target,result.launchArgs||[]);plan.assertScope();
      return {status:"installed",studioId:key,studioName:target.name,sceneName:result.sceneName,sources:result.sources,...opening};
    }finally{this.busy.delete(key);}
  }
}
module.exports={StudioInstallationService,launch};
