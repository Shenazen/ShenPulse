"use strict";
function saveGameWinsOptions({store,core,pack,patch}){
 const next={};
 for(const [key,value]of Object.entries(patch||{})){
  if(key==='superFanEnabled'){if(typeof value!=='boolean')throw Error('Activation invalide.');next[key]=value;}
  else if(key==='superFanAmount'){if(!Number.isSafeInteger(value)||value<1||value>100000)throw Error('Nombre de wins invalide.');next[key]=value;}
  else if(['counterModel','multiplierModel'].includes(key)){if(![1,2].includes(value))throw Error('Modèle d’overlay invalide.');next[key]=value;}
  else if(key==='roundTimerModel'){if(!require('../../shared/game-workspace-policy').hasRoundTimer(pack)||![1,2].includes(value))throw Error('Modèle du chrono de partie invalide.');next[key]=value;}
  else if(key==='showRoundTimer'){if(!require('../../shared/game-workspace-policy').hasRoundTimer(pack)||typeof value!=='boolean')throw Error('Affichage du chrono de partie invalide.');next[key]=value;}
  else if(key==='muteColor'){if(!/^#[a-f0-9]{6}$/i.test(value))throw Error('Couleur invalide.');next[key]=value;}
  else if(key==='muteFont'){if(!['Orbitron','Inter','Arial','Impact'].includes(value))throw Error('Police invalide.');next[key]=value;}
  else throw Error('Réglage de wins inconnu.');
 }
 store.mutate(state=>{state.settings.overlayConfigs||={};state.settings.overlayConfigs.gameWinsFeatures||={};state.settings.overlayConfigs.gameWinsFeatures[pack.id]={...state.settings.overlayConfigs.gameWinsFeatures[pack.id],...next};},true);
 const snapshot=core.snapshot();require('./notifications').notify(core,'state-changed',snapshot);return snapshot;
}
module.exports={saveGameWinsOptions};
