"use strict";

const overlayCatalog=require('../../resources/overlays/overlay-catalog');
const {normalizeGameRoundSettings}=require('./minecraft-round-settings');
function illustratedAppearance(key,config){
 const next={theme:overlayCatalog.normalizeDesign(key,config.theme),title:String(config.title|| (key==='winCounter'?'WIN':'BONUS ACTIF')).slice(0,80)};
 if(key==='multiplierTimer')next.showHours=config.showHours===true;
 for(const name of ['showHeader','showShadow'])if(typeof config[name]==='boolean')next[name]=config[name];
 for(const name of ['textColor','winCounterTitleColor','winCounterGoalColor','timerTitleColor','timerValueColor','timerMultiplierColor'])if(/^#[a-f0-9]{6}$/i.test(config[name]||''))next[name]=config[name];
 for(const name of ['winCounterTitleScale','winCounterValueScale','winCounterGoalScale','timerTitleScale','timerValueScale'])if(Number.isFinite(Number(config[name])))next[name]=Math.max(50,Math.min(400,Number(config[name])));
 return next;
}


function roundTimerOverlay(state,pack,features){
 if(!require('./game-workspace-policy').hasRoundTimer(pack))return null;
 const saved=normalizeGameRoundSettings(pack.id,state.game?.roundSettingsByPack?.[pack.id]),durationMinutes=saved.durationMinutes;
 const game=state.session?.game||{},active=game.running===true&&game.packId===pack.id&&game.profileId===state.session?.profileId;
 const status=active&&['running','timeout','won','lost'].includes(game.roundStatus)?game.roundStatus:'stopped',end=Date.parse(game.roundEndsAt||''),running=status==='running'&&Number.isFinite(end)&&end>0;
 return {enabled:features.showRoundTimer!==false,status:status==='running'&&!running?'stopped':status,endsAt:running?end:0,durationSeconds:durationMinutes*60,autoRestart:saved.autoRestart===true};
}

function gameWinsOverlay(state,pack,rules){
 if(!pack?.effects.some(effect=>effect.winCounter))return null;
 const config=state.settings?.overlayConfigs?.winCounter||{},timer=state.settings?.overlayConfigs?.multiplierTimer||{},session=state.overlaySession||{},features=state.settings?.overlayConfigs?.gameWinsFeatures?.[pack.id]||{};
 const image=value=>{try{const url=new URL(value);return url.protocol==='https:'?url.href.slice(0,2000):'';}catch{return '';}};
 const rows=rules.flatMap(rule=>{if(rule.enabled===false||rule.trigger?.enabled===false||rule.trigger?.type!=='gift')return [];const action=rule.actions?.find(action=>action.type==='overlay.win-counter'&&action.config?.packId===pack.id);if(!action)return [];const gift=rule.conditions?.find(c=>c.field==='data.giftName');if(!gift)return [];return [{id:String(rule.id).slice(0,160),amount:Number(action.config.amount)||0,operation:action.config.operation||'adjust',seconds:Math.max(1,Math.min(3600,Number(action.config.duration)||60)),giftName:String(gift.value||'').slice(0,120),giftImageUrl:image(gift.giftImageUrl)}];});
 const round=roundTimerOverlay(state,pack,features);
 const color=(value,fallback)=>/^#[a-f0-9]{6}$/i.test(value||'')?value:fallback;
 return {presentation:{counterModel:features.counterModel===2?2:1,multiplierModel:features.multiplierModel===2?2:1,counter:illustratedAppearance('winCounter',config),multiplier:illustratedAppearance('multiplierTimer',timer),...(round?{roundTimerModel:features.roundTimerModel===2?2:1,roundTimer:{...illustratedAppearance('timer',state.settings?.overlayConfigs?.timer||{}),title:'AVANT DÉFAITE',showHours:round.durationSeconds>=3600}}:{})},...(round?{roundTimer:round}:{}),showCounter:config.enabled!==false,showGoal:config.showGoal!==false,current:Number(session.hasData?session.winCounterCurrent:config.current)||0,target:Math.max(0,Number(config.target)||0),positiveColor:color(config.winCounterLabelColorPositive,'#31ff74'),negativeColor:color(config.winCounterLabelColorNegative,'#ff4f6d'),neutralColor:color(config.winCounterLabelColorNeutral,'#ffe624'),showMultiplier:timer.enabled!==false,multiplier:Number(session.winCounterMultiplier)||1,multiplierEndsAt:Number(session.winCounterMultiplierUntil)||0,
 positive:rows.filter(row=>row.operation==='adjust'&&row.amount>=0).sort((a,b)=>a.amount-b.amount),negative:rows.filter(row=>row.operation==='adjust'&&row.amount<0).sort((a,b)=>Math.abs(a.amount)-Math.abs(b.amount)),reset:rows.find(row=>row.operation==='reset')||null,invert:rows.find(row=>row.operation==='invert')||null,mute:rows.find(row=>row.operation==='mute')||null,unmute:rows.find(row=>row.operation==='unmute')||null,superFan:{enabled:features.superFanEnabled===true,amount:Math.max(1,Math.min(100000,Number(features.superFanAmount)||500))},muteTimer:{endsAt:session.gameMute?.packId===pack.id?Math.max(0,Number(session.gameMute.endsAt)||0):0,color:color(features.muteColor,'#ff2aa1'),font:['Orbitron','Inter','Arial','Impact'].includes(features.muteFont)?features.muteFont:'Orbitron'}};
}
module.exports={gameWinsOverlay};
