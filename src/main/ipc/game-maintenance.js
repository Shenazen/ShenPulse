"use strict";
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {readState}=require('../state-projection');
const {safeString}=require('../utils');
const {defaultGameInteractionRule}=require('../game-hub/interaction-defaults');
const {notify}=require('./notifications');
function registerGameMaintenanceIpc({handle,core,store,gameRuntime,requireGameAccess}) {
  function scope(packId,options) {
    const id=safeString(packId,160),pack=requireGameAccess(id);
    if(!options?.confirmed)throw Error('Confirmez cette opération depuis la fiche du jeu.');
    const assert=()=>{
      requireGameAccess(id);
      const fresh=readState(store,['settings.account.uid','session.profileId','session.game']);
      if(!options.accountUid || fresh.settings.account?.uid!==options.accountUid || fresh.session.profileId!==options.profileId)throw Error('Le compte ou le profil a changé. Recommencez depuis la fiche du jeu.');
      if(fresh.session.game?.running && fresh.session.game.packId===id)throw Error('Arrêtez la session du jeu avant cette opération.');
    };
    assert();return {id,pack,assert};
  }
  handle('game:interactions:reset',async(_event,packId,options)=>{
    const {id,pack,assert}=scope(packId,options);
    if(gameRuntime.activeInstalls?.has(id) || gameRuntime.launchJobs?.has(id))throw Error('Une opération est déjà en cours pour ce jeu.');
    const mappings=pack.defaultMappings || [];
    if(!mappings.length)throw Error('Ce jeu ne propose pas d’interactions par défaut.');
    const rules=mappings.map(mapping=>{const effect=pack.effects.find(e=>e.id===mapping.effectId);if(!effect)throw Error('Catalogue des interactions incomplet.');return defaultGameInteractionRule(pack,effect,mapping,pack.interactionCatalogVersion,core.giftCatalog);});
    const before=readState(store,['game.interactionRulesByPack.'+id,'game.interactionCatalogVersions.'+id]);
    const owner=crypto.createHash('sha256').update(options.accountUid+'\0'+options.profileId).digest('hex').slice(0,24);
    const directory=path.join(store.directory,'game-interaction-backups',owner,id);await fs.mkdir(directory,{recursive:true});assert();
    const backupPath=path.join(directory,Date.now()+'-'+crypto.randomBytes(4).toString('hex')+'.json');
    await fs.writeFile(backupPath,JSON.stringify({packId:id,profileId:options.profileId,rules:before.game.interactionRulesByPack?.[id] || [],catalogVersion:before.game.interactionCatalogVersions?.[id] || 0},null,2),{flag:'wx'});
    assert();
    store.mutate(state=>{state.game.interactionRulesByPack[id]=rules;state.game.interactionCatalogVersions[id]=pack.interactionCatalogVersion;},true);
    core.ruleEngine?.resetProfileState();
    const snapshot=core.snapshot();notify(core,'state-changed',snapshot);return {ok:true,backupPath,snapshot};
  });
  handle('game:uninstall',async(_event,packId,options)=>{
    const {id,assert}=scope(packId,options);
    const result=await gameRuntime.uninstall(id);assert();
    if(result?.ok!==true)throw Error('La désinstallation n’a pas été confirmée.');
    store.mutate(state=>{delete state.game.installations[id];},true);
    const snapshot=core.snapshot();notify(core,'state-changed',snapshot);return {...result,snapshot};
  });
}
module.exports={registerGameMaintenanceIpc};
