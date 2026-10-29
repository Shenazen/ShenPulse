"use strict";
(()=>{
 const query=new URLSearchParams(location.search),packId=query.get('jeu')||'',profile=query.get('profile')||'',preview=query.get('preview')==='1',root=document.getElementById('wins-hud');let source,poll,retry,documentValue={},current=null,signature='',reactionTimer,lastBatch='',initialized=false;const demoEnds=Date.now()+300000;
 const mode=['counter','multiplier','round-timer','mute'].includes(query.get('mode'))?query.get('mode'):'full';document.documentElement.dataset.winsMode=mode;
 const scale=()=>{
  const single=['counter','multiplier','round-timer'].includes(mode),width=mode==='counter'?720:single?900:1080,height=mode==='counter'?520:single?360:1920;
  root.style.width=width+'px';root.style.height=height+'px';
  // Full HUD content ends before y=1280; the remaining portrait area is transparent.
  // Fit both axes when a studio supplies a shorter browser viewport.
  const factor=mode==='mute'||preview&&!single?innerWidth/width:Math.min(innerWidth/width,innerHeight/(single?height:1280));
  root.style.transform='scale('+factor+')';
  if(!single){root.style.left=Math.max(0,(innerWidth-width*factor)/2)+'px';root.style.top='0px';}
 };
 function image(url,alt){const img=document.createElement('img');img.alt=alt||'';img.src=url||'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke="#ffe678" stroke-width="5" stroke-linejoin="round"><path d="M10 28h44v28H10zM6 18h52v12H6zM32 18v38"/><path d="M32 18C8 18 16-6 32 18c16-24 24 0 0 0z"/></g></svg>');return img;}
 function badge(item,kind,title){const node=document.createElement('div');node.className='hud-special hud-'+kind;node.dataset.rule=item.id;node.append(image(item.giftImageUrl,item.giftName));const text=document.createElement('span');text.textContent=title;node.append(text);return node;}
 function column(items,kind,footer){const list=document.createElement('div');list.className='hud-gift-column '+kind;const title=document.createElement('small');title.className='hud-column-title';title.textContent=kind==='positive'?'+ WINS':'− WINS';list.append(title);for(const item of items||[]){const card=document.createElement('div');card.className='hud-gift';card.dataset.rule=item.id;card.title=item.giftName;card.append(image(item.giftImageUrl,item.giftName));const value=document.createElement('strong');value.textContent=(item.amount>0?'+':'−')+Math.abs(item.amount);card.append(value);list.append(card);}if(footer)list.append(badge(footer,'invert','INVERSER'));return list;}

 function multiplierState(){const active=current.multiplierEndsAt>Date.now()&&current.multiplier>1,demo=preview&&!active;return {visible:current.showMultiplier&&(active||demo),active,demo,factor:active?current.multiplier:2,endsAt:active?current.multiplierEndsAt:demoEnds};}

 function roundState(){
  const round=current.roundTimer;if(!round)return {visible:false,remaining:0,endsAt:0,active:false,status:'stopped',label:'AVANT DÉFAITE'};
  const active=round.status==='running'&&round.endsAt>0,finished=['timeout','won','lost'].includes(round.status),remaining=active?Math.max(0,Math.ceil((round.endsAt-Date.now())/1000)):finished?0:Math.max(0,round.durationSeconds||0);
  return {visible:round.enabled!==false&&(active||finished||preview),remaining,endsAt:active?round.endsAt:0,active,status:round.status,label:round.status==='timeout'?'TIME OUT':round.status==='won'?'VICTOIRE':round.status==='lost'?'DÉFAITE':'AVANT DÉFAITE',hint:!active&&!finished&&preview?'Prochaine partie':''};
 }
 function formatRoundTime(seconds){const value=Math.max(0,Math.round(seconds)),hours=Math.floor(value/3600),minutes=Math.floor(value%3600/60),rest=String(value%60).padStart(2,'0');return (hours?String(hours).padStart(2,'0')+':':'')+String(minutes).padStart(2,'0')+':'+rest;}

 function illustrated(kind){
  const node=document.createElement('div');node.className='hud-illustrated hud-illustrated-'+kind;node.dataset.widget=kind;node.setAttribute('aria-label',kind==='counter'?'Compteur de wins illustré':kind==='roundTimer'?'Timer avant défaite illustré':'Multiplicateur illustré');
  const loading=document.createElement('span');loading.className='hud-loading';loading.textContent='Chargement…';node.append(loading);
  const frame=document.createElement('iframe'),url=new URL('index.html',location.href);url.searchParams.set('view',kind==='counter'?'win-counter':kind==='roundTimer'?'timer':'multiplier-timer');url.searchParams.set('preview','static');for(const credential of ['channel','token'])if(query.get(credential))url.searchParams.set(credential,query.get(credential));url.searchParams.set('theme',(current.presentation?.[kind]?.theme)||'gta');frame.src=url.href;frame.title=node.getAttribute('aria-label');frame.tabIndex=-1;frame.setAttribute('sandbox','allow-scripts allow-same-origin');node.append(frame);
  frame.addEventListener('load',()=>{node.dataset.ready='true';synchronizeIllustrated(node,true);});return node;
 }
 function synchronizeIllustrated(node,configure=false){
  const kind=node.dataset.widget,frame=node.querySelector('iframe');if(!current||!frame?.contentWindow)return;
  const send=(channel,payload)=>frame.contentWindow.postMessage({source:'shenpulse-overlay-card',channel,payload},new URL(frame.src).origin);
  const timer=kind==='roundTimer'?roundState():kind==='multiplier'?multiplierState():null;
  if(configure)send('configuration',{...(current.presentation?.[kind]||{}),enabled:true,showWhenIdle:true,showGoal:current.showGoal,...(kind==='roundTimer'?{title:timer.label}:{}),x:0,y:0,scale:100,positiveColor:current.positiveColor,negativeColor:current.negativeColor,neutralColor:current.neutralColor,multiplier:timer?.factor||2});
  if(kind==='counter')send('win-counter',{operation:'set',current:current.current,target:current.target});
  else if(kind==='roundTimer'){node.hidden=!timer.visible;send('timer',{operation:'set',remainingSeconds:timer.remaining,endsAt:timer.endsAt,paused:!timer.active});}
  else {node.hidden=!timer.visible;if(node.dataset.factor!==String(timer.factor)){send('configuration',{multiplier:timer.factor});node.dataset.factor=String(timer.factor);}send('multiplier-timer',{operation:'set',remainingSeconds:Math.max(0,Math.ceil((timer.endsAt-Date.now())/1000)),endsAt:timer.endsAt,multiplier:timer.factor});}
 }

 function render(frame){const state=frame?.packs?.[packId]||frame;if(!state||!state.enabled||state.packId!==packId||profile&&state.profileId!==profile||!state.wins){current=null;signature='';root.replaceChildren();return;}current=state.wins;
  const next=JSON.stringify({...current,current:undefined,multiplier:undefined,multiplierEndsAt:undefined,muteTimer:{...current.muteTimer,endsAt:undefined},roundTimer:current.roundTimer?{...current.roundTimer,endsAt:undefined}:undefined});
  if(next===signature){tick();return;}signature=next;const nodes=[],muteOnly=mode==='mute',single=['counter','multiplier','round-timer'].includes(mode);root.dataset.roundTimer=String(current.roundTimer?.enabled!==false&&!!current.roundTimer);
  if(!muteOnly){
   if((!single||mode==='counter')&&current.showCounter){if(current.presentation?.counterModel===2)nodes.push(illustrated('counter'));else{const counter=document.createElement('div');counter.className='hud-counter';nodes.push(counter);}}
   if(!single){
    nodes.push(column(current.positive,'positive'),column(current.negative,'negative',current.invert));
    const bar=document.createElement('div');bar.className='hud-special-bar';const minutes=item=>item.seconds%60===0?item.seconds/60+' MIN':item.seconds+' S';if(current.mute)bar.append(badge(current.mute,'mute','MUTE '+minutes(current.mute)));if(current.reset)bar.append(badge(current.reset,'reset','RESET WINS'));if(current.unmute)bar.append(badge(current.unmute,'unmute','DÉMUTE '+minutes(current.unmute)));nodes.push(bar);
    if(current.superFan?.enabled){const fan=document.createElement('div');fan.className='hud-superfan';fan.textContent='★ SUPER FAN : +'+current.superFan.amount+' OU −'+current.superFan.amount+' WINS';nodes.push(fan);}
   }
   if(!single||mode==='multiplier'){if(current.presentation?.multiplierModel===2)nodes.push(illustrated('multiplier'));else{const multiplier=document.createElement('div');multiplier.className='hud-multiplier';nodes.push(multiplier);}}
  }
  if(!muteOnly&&(!single||mode==='round-timer')&&current.roundTimer){if(current.presentation?.roundTimerModel===2)nodes.push(illustrated('roundTimer'));else{const round=document.createElement('div');round.className='hud-round-timer';nodes.push(round);}}
  if(!single){
   const timer=document.createElement('div');timer.className='hud-mute-timer';timer.style.color=current.muteTimer?.color||'#ff2aa1';timer.style.fontFamily=current.muteTimer?.font==='Orbitron'?'GameWinsOrbitron,Arial,sans-serif':current.muteTimer?.font||'Arial';nodes.push(timer);
   const viewer=document.createElement('div');viewer.className='hud-viewer';viewer.hidden=true;nodes.push(viewer);
  }
  root.replaceChildren(...nodes);scale();tick();
 }

 function tick(){if(!current)return;
 const counter=root.querySelector('.hud-counter');if(counter){counter.style.color=current.current>0?current.positiveColor:current.current<0?current.negativeColor:current.neutralColor;counter.textContent='WIN : '+current.current+(current.showGoal&&current.target>0?' / '+current.target:'');counter.style.fontSize=mode==='counter'?'120px':'60px';if(counter.clientWidth&&counter.scrollWidth>counter.clientWidth)counter.style.fontSize=(parseFloat(counter.style.fontSize)*counter.clientWidth/counter.scrollWidth)+'px';}
 root.querySelectorAll('.hud-illustrated').forEach(node=>synchronizeIllustrated(node));
 const roundNode=root.querySelector('.hud-round-timer');if(roundNode){const value=roundState();roundNode.hidden=!value.visible;roundNode.classList.toggle('is-timeout',value.status==='timeout'||value.active&&value.remaining<=10);roundNode.replaceChildren();const title=document.createElement('small');title.textContent=value.label;const time=document.createElement('time');time.textContent=formatRoundTime(value.remaining);time.style.color=current.presentation?.roundTimer?.timerValueColor||'';title.style.color=current.presentation?.roundTimer?.timerTitleColor||'';roundNode.append(title,time);if(value.hint){const hint=document.createElement('em');hint.textContent=value.hint;roundNode.append(hint);}}
const node=root.querySelector('.hud-multiplier');if(node){const active=current.multiplierEndsAt>Date.now()&&current.multiplier>1,demo=preview&&!active,ends=active?current.multiplierEndsAt:demoEnds,remaining=Math.max(0,Math.ceil((ends-Date.now())/1000));node.hidden=!current.showMultiplier||!active&&!demo;node.style.display=node.hidden?'none':'flex';if(!node.hidden){const factor=active?current.multiplier:2;node.replaceChildren();const value=document.createElement('strong');value.textContent='×'+factor;const time=document.createElement('time');time.textContent=Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');node.append(value,time);if(demo){const hint=document.createElement('small');hint.textContent='Exemple';node.append(hint);}}}
  const timer=root.querySelector('.hud-mute-timer');if(timer){const remaining=Math.max(0,Math.ceil(((current.muteTimer?.endsAt||0)-Date.now())/1000));timer.hidden=remaining<=0;timer.textContent='MICRO COUPÉ · '+Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');}
 }
 function reaction(payload){if(payload.packId!==packId||profile&&payload.profileId!==profile)return;const target=[...root.querySelectorAll('[data-rule]')].find(node=>node.dataset.rule===payload.ruleId);if(!target)return;clearTimeout(reactionTimer);root.querySelectorAll('.is-reacting').forEach(node=>node.classList.remove('is-reacting'));target.classList.add('is-reacting');const viewer=root.querySelector('.hud-viewer');viewer.textContent=String(payload.viewer||'Viewer');viewer.hidden=false;reactionTimer=setTimeout(()=>{target.classList.remove('is-reacting');viewer.hidden=true;},2400);}
 function mutate(path,data,patch){const parts=String(path||'/').split('/').filter(Boolean);if(!parts.length){documentValue=patch?{...documentValue,...data}:data||{};return;}let cursor=documentValue;for(const key of parts.slice(0,-1)){cursor[key]||={};cursor=cursor[key];}const key=parts.at(-1);if(data===null)delete cursor[key];else cursor[key]=patch?{...cursor[key],...data}:data;}
 function publicConnect(){source=new EventSource('https://shenazenoverlay-default-rtdb.firebaseio.com/publicOverlayRelay/'+encodeURIComponent(query.get('channel'))+'.json');const receive=(event,patch)=>{try{const change=JSON.parse(event.data);mutate(change.path,change.data,patch);if(documentValue.presence?.connected===false){render(null);return;}render(documentValue.state?.gamePacks);const batch=documentValue.lastBatch;if(initialized&&batch?.id&&batch.id!==lastBatch)for(const frame of Object.values(batch.messages||{}))if(frame.channel==='game-pack-trigger')reaction(frame.payload||{});lastBatch=batch?.id||'';initialized=true;}catch{/* Partial updates retain the last valid state. */}};source.addEventListener('put',event=>receive(event,false));source.addEventListener('patch',event=>receive(event,true));source.addEventListener('error',()=>{source.close();initialized=false;retry=setTimeout(publicConnect,3000);});}
 function localConnect(){const params=new URLSearchParams({token:query.get('token')||'',view:'game-pack'}),refresh=async()=>{try{const response=await fetch('/api/game-pack?'+params,{cache:'no-store'});render(response.ok?await response.json():null);}catch{render(null);}};refresh();poll=setInterval(refresh,1000);source=new EventSource('/events?'+params);source.addEventListener('bootstrap',event=>{try{render(JSON.parse(event.data).payload?.gamePacks);}catch{}});source.addEventListener('game-pack-trigger',event=>{try{reaction(JSON.parse(event.data).payload||{});}catch{}});}
 const clock=setInterval(tick,1000);addEventListener('resize',scale);addEventListener('pagehide',()=>{source?.close();clearInterval(poll);clearInterval(clock);clearTimeout(retry);clearTimeout(reactionTimer);});window.ShenPulseGameWins={render,reaction};scale();if(query.get('channel'))publicConnect();else if(query.get('token'))localConnect();
})();
