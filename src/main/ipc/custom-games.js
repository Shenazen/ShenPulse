"use strict";
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {assertProFeatureAccess}=require('../pro-feature-access');
const {readState}=require('../state-projection');
const {notify}=require('./notifications');
const custom=require('../custom-games');
function registerCustomGamesIpc({handle,core,store,requireGameAccess}){
 const guard=incoming=>{assertProFeatureAccess(store,'games');const state=readState(store,['settings.account.uid','session.profileId','session.game','game.customPacks']);if(incoming.accountUid!==state.settings?.account?.uid||incoming.profileId!==state.session?.profileId)throw Error('Le compte ou le profil a changé. Rouvrez votre pack.');return state;};
 handle('game:custom:save',(_event,incoming={})=>{
  const state=guard(incoming),definitions=state.game?.customPacks||[],previous=definitions.find(d=>d.id===incoming.id);
  if(incoming.id&&!previous)throw Error('Ce pack personnel n’existe plus.');
  if(!previous&&definitions.length>=50)throw Error('Vous avez atteint la limite de 50 packs par profil.');
  if(state.session.game?.running&&state.session.game.packId===previous?.id)throw Error('Arrêtez la session avant de modifier ce pack.');
  const definition=custom.metadata(incoming,previous),pack=custom.packFor(definition);
  store.mutate(draft=>{draft.game.customPacks=[...definitions.filter(d=>d.id!==definition.id),definition];if(!previous){draft.game.interactionRulesByPack[pack.id]=custom.createRules(pack,core.gameHub.giftCatalog);draft.game.interactionCatalogVersions[pack.id]=1;}},true);
  const snapshot=core.snapshot();notify(core,'state-changed',snapshot);return {packId:pack.id,snapshot};
 });
 handle('game:custom:remove',(_event,incoming={})=>{
  const state=guard(incoming);const pack=requireGameAccess(incoming.id);if(!pack?.customGame)throw Error('Ce jeu ne peut pas être supprimé.');
  if(state.session.game?.running&&state.session.game.packId===pack.id)throw Error('Arrêtez la session avant de supprimer ce pack.');
  store.mutate(draft=>{draft.game.customPacks=(draft.game.customPacks||[]).filter(d=>d.id!==pack.id);for(const key of ['interactionRulesByPack','interactionCatalogVersions','connectorOverrides'])delete draft.game[key]?.[pack.id];for(const key of ['gameInteractionOverlays','gameWinsFeatures'])delete draft.settings.overlayConfigs?.[key]?.[pack.id];if(draft.session.activeGamePackId===pack.id)draft.session.activeGamePackId=custom.BUILDER_ID;},true);
  const snapshot=core.snapshot();notify(core,'state-changed',snapshot);return snapshot;
 });
 handle('game:custom:windows',async(_event,incoming={})=>{
  guard(incoming);
  const {stdout}=await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',"[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); @(Get-Process | Where-Object {$_.MainWindowHandle -ne 0 -and $_.ProcessName -notmatch '^(ShenPulse|explorer|powershell|pwsh|cmd|Code|Codex|consent)$'} | Select-Object ProcessName,MainWindowTitle -Unique) | ConvertTo-Json -Compress"],{windowsHide:true,timeout:10000,maxBuffer:262144});
  guard(incoming);const data=JSON.parse(stdout||'[]');return custom.gameWindows(Array.isArray(data)?data:[data]);
 });
}
module.exports={registerCustomGamesIpc};
