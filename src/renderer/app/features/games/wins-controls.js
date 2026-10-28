"use strict";
function gameWinsScope(){return {packId:supermarketPack()?.id,accountUid:snapshot.state.settings.account?.uid||'',profileId:snapshot.state.session.profileId};}
function gameWinsScopeCurrent(scope){return scope.packId===supermarketPack()?.id&&scope.accountUid===(snapshot.state.settings.account?.uid||'')&&scope.profileId===snapshot.state.session.profileId;}
function saveGameWinsLevel(patch){const scope=gameWinsScope(),operation=marketWriteQueue.catch(()=>{}).then(async()=>{if(!gameWinsScopeCurrent(scope))throw Error('Le jeu, le compte ou le profil a changé.');if(!requireGameAccess(supermarketPack()))return;const next=await api.saveGameWinsLevel(scope.packId,{...scope,...patch});if(gameWinsScopeCurrent(scope)){const scroll=content.scrollTop;acceptSnapshot(next);render();content.scrollTop=scroll;}});marketWriteQueue=operation;return operation;}
content.addEventListener('change',event=>{
 const feature=event.target.closest('[data-game-win-feature]');if(feature){const value=feature.type==='checkbox'?feature.checked:feature.type==='number'||['counterModel','multiplierModel','roundTimerModel'].includes(feature.dataset.gameWinFeature)?Number(feature.value):feature.value;perform(()=>saveGameWinsLevel({operation:'options',patch:{[feature.dataset.gameWinFeature]:value}})).catch(()=>{});return;}
 const amount=event.target.closest('[data-game-win-level]'),enabled=event.target.closest('[data-game-win-enabled]'),config=event.target.closest('[data-game-win-config]'),timer=event.target.closest('[data-game-win-timer]');
 if(amount||enabled){const target=amount||enabled;perform(()=>saveGameWinsLevel({operation:'edit',ruleIds:JSON.parse(target.dataset.gameWinLevel||target.dataset.gameWinEnabled),...(amount?{amount:target.value}:{enabled:target.checked})})).catch(()=>{render();});return;}
 if(timer){const scope=gameWinsScope(),value=timer.checked;const operation=marketWriteQueue.catch(()=>{}).then(async()=>{if(!gameWinsScopeCurrent(scope))throw Error('Le profil a changé.');await saveOverlayConfig('multiplierTimer',{...overlayConfig('multiplierTimer'),enabled:value});});marketWriteQueue=operation;perform(()=>operation).catch(()=>{});return;}
 if(config){const scope=gameWinsScope(),field=config.dataset.gameWinConfig,allowed=['enabled','showGoal','target','winCounterLabelColorPositive','winCounterLabelColorNegative','winCounterLabelColorNeutral'];if(!allowed.includes(field))return;const value=config.type==='checkbox'?config.checked:config.type==='number'?Math.max(0,Number(config.value)||0):config.value;const operation=marketWriteQueue.catch(()=>{}).then(async()=>{if(!gameWinsScopeCurrent(scope))throw Error('Le profil a changé.');await saveOverlayConfig('winCounter',{...overlayConfig('winCounter'),[field]:value});});marketWriteQueue=operation;perform(()=>operation).catch(()=>{});}
});
const GAME_WIN_ACTIONS=new Set(['game-win-add','game-win-remove','game-win-start','game-win-stop','game-win-install-mute','game-win-superfan','game-win-release-mute','game-round-preview','game-round-restart']);
registerActionHandler(GAME_WIN_ACTIONS,async({action,target})=>{
 if(!GAME_WIN_ACTIONS.has(action))return ACTION_NOT_HANDLED;const pack=supermarketPack();if(!pack||!requireGameAccess(pack))return;

 if(action==='game-round-restart')return perform(()=>api.triggerEffect(pack.id==='gtav-hiking-enhanced'?'hike_restart':'koth_start',{packId:pack.id,parameters:{restartRound:1}}));
 if(action==='game-round-preview'){
  if(!ShenPulseGameWorkspacePolicy.hasRoundTimer(pack))throw Error('Ce jeu ne possède pas de chrono avant défaite.');
  const ctx=supermarketContext(pack),url=ShenPulseGameWorkspace.winOverlaySource(ctx.preview.winsSourceUrl,'round-timer',true);
  if(!url)throw Error('La source du chrono est indisponible.');
  return openEditor({title:'Timer avant défaite',body:'<p>Le chrono suit la partie active. À l’arrêt, cet aperçu montre la durée de la prochaine partie.</p><div class="game-pack-round-preview-dialog"><iframe src="'+escapeHtml(url)+'" title="Aperçu du timer avant défaite"></iframe></div>',onSubmit:null});
 }
 if(action==='game-win-install-mute')return openStudioInstallation({overlayOnly:true});
 if(action==='game-win-release-mute')return perform(()=>api.testAction({type:'overlay.win-counter',config:{operation:'unmute',duration:3600,packId:pack.id}}));
 if(action==='game-win-superfan'){const features=snapshot.state.settings.overlayConfigs?.gameWinsFeatures?.[pack.id]||{};if(!features.superFanEnabled)return;return perform(()=>api.testAction({type:'overlay.win-counter',config:{operation:'adjust',amount:(Number(features.superFanAmount)||500)*(target.dataset.sign==='-1'?-1:1),packId:pack.id}}));}
 if(action==='game-win-add')return saveGameWinsLevel({operation:'add',amount:1});
 if(action==='game-win-remove'){const scope=gameWinsScope();if(await confirmAction('Retirer ce palier de wins et ses cadeaux ?',{title:'Retirer le palier',confirmLabel:'Retirer'})) {if(!gameWinsScopeCurrent(scope))throw Error('Le jeu, le compte ou le profil a changé.');return saveGameWinsLevel({operation:'remove',ruleIds:JSON.parse(target.dataset.ruleIds)});}return;}
 if(action==='game-win-stop')return perform(()=>api.testAction({type:'overlay.multiplier-timer',config:{operation:'reset',packId:pack.id}}));
 const reference=supermarketReference(target),row=findGameInteractionRow(pack.id,reference.ruleId,reference.actionId,reference.index);if(row)return perform(()=>api.testAction(structuredClone(row.action)));
});

content.addEventListener('load',event=>{const frame=event.target;if(frame.matches?.('.game-pack-win-model-preview iframe'))frame.closest('.game-pack-win-model-preview').dataset.ready='true';},true);
