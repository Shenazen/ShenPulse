"use strict";
/** Shared pointer/keyboard sorting. Persistence belongs to the injected controller. */
(function(C){
 const instances=new WeakMap();
 C.createInteractionSorter=function(document,{onMove,onError=()=>{}}={}){
  if(instances.has(document))return instances.get(document);
  const win=document.defaultView;let drag=null,frame=0,busy=false;
  const indicator=document.createElement('div');indicator.className='game-pack-drop-indicator';indicator.hidden=true;indicator.setAttribute('aria-hidden','true');document.body.append(indicator);
  const live=document.createElement('div');live.className='game-pack-reorder-status';live.setAttribute('role','status');live.setAttribute('aria-live','polite');document.body.append(live);
  const announce=text=>{live.textContent=text;};
  const items=list=>[...list.children].filter(node=>node.matches('[data-game-reorder-item]'));
  const rootFor=scope=>[...document.querySelectorAll('.game-pack-workspace')].find(root=>root.dataset.gameTourScope===scope);
  const valid=state=>state.root.isConnected&&state.card.isConnected&&state.list.isConnected&&state.card.parentElement===state.list&&state.root.dataset.gameTourScope===state.scope;
  function scrollingParent(node){for(let p=node.parentElement;p;p=p.parentElement)if(p.scrollHeight>p.clientHeight&&/(auto|scroll)/.test(win.getComputedStyle(p).overflowY))return p;return document.scrollingElement;}
  function clear(){
   const state=drag;drag=null;if(frame)win.cancelAnimationFrame(frame);frame=0;indicator.hidden=true;
   if(!state)return;state.card.classList.remove('is-reordering');state.handle.classList.remove('is-grabbing');state.handle.setAttribute('aria-pressed','false');
   try{if(state.handle.hasPointerCapture?.(state.pointerId))state.handle.releasePointerCapture(state.pointerId);}catch{/* A removed card no longer owns its pointer. */}
  }
  function cancel(){if(drag?.active)announce('Déplacement annulé.');clear();}
  function position(state){
   state.target=null;indicator.hidden=true;const bounds=state.list.getBoundingClientRect();
   if(state.x<bounds.left-18||state.x>bounds.right+18||state.y<bounds.top-24||state.y>bounds.bottom+24)return;
   let candidate=null,distance=Infinity;
   for(const node of items(state.list)){if(node===state.card)continue;const rect=node.getBoundingClientRect();if(!rect.width||!rect.height)continue;
    const dx=Math.max(rect.left-state.x,0,state.x-rect.right),dy=Math.max(rect.top-state.y,0,state.y-rect.bottom),score=dx*dx+dy*dy;
    if(score<distance){candidate={node,rect};distance=score;}
   }
   if(!candidate)return;
   const before=state.y<candidate.rect.top+candidate.rect.height/2;
   state.target={ruleId:state.card.dataset.rule,[before?'beforeRuleId':'afterRuleId']:candidate.node.dataset.rule};
   indicator.style.left=candidate.rect.left+'px';indicator.style.top=(before?candidate.rect.top:candidate.rect.bottom)-2+'px';indicator.style.width=candidate.rect.width+'px';indicator.hidden=false;
  }
  function tick(){frame=0;if(!drag?.active)return;if(!valid(drag)){cancel();return;}
   const scroll=drag.scroll;if(scroll){const rect=scroll===document.scrollingElement?{top:0,bottom:win.innerHeight}:scroll.getBoundingClientRect();const edge=48;
    const speed=drag.y<rect.top+edge?-Math.min(22,Math.max(0,(rect.top+edge-drag.y)/2)):drag.y>rect.bottom-edge?Math.min(22,Math.max(0,(drag.y-rect.bottom+edge)/2)):0;
    if(speed)scroll.scrollTop+=speed;
   }
   position(drag);frame=win.requestAnimationFrame(tick);
  }
  async function commit(state,move){
   if(busy||!onMove||!valid(state))return;
   const current=items(state.list).map(node=>node.dataset.rule),next=current.filter(id=>id!==move.ruleId),anchor=move.beforeRuleId||move.afterRuleId;
   const index=next.indexOf(anchor);if(index<0)return;next.splice(index+(move.afterRuleId?1:0),0,move.ruleId);
   if(next.every((id,i)=>id===current[i]))return;
   busy=true;announce('Enregistrement de la position…');state.root.setAttribute('data-game-order-saving','');
   try{
    await onMove({packId:state.root.dataset.gamePack,scope:state.scope,...move});
    const root=rootFor(state.scope);if(!root)return;
    announce('Position de l’interaction enregistrée.');
    const card=[...root.querySelectorAll('[data-game-reorder-item]')].find(node=>node.dataset.rule===move.ruleId);
    card?.querySelector('[data-game-drag-handle]')?.focus({preventScroll:true});
    if(state.keyboard)card?.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'instant'});
   }catch(error){if(rootFor(state.scope)){announce('Le déplacement n’a pas été enregistré.');onError(error);}}
   finally{busy=false;state.root.removeAttribute('data-game-order-saving');rootFor(state.scope)?.removeAttribute('data-game-order-saving');}
  }
  function down(event){
   const handle=event.target.closest?.('[data-game-drag-handle]');if(!handle||handle.disabled||busy||event.button!==0||event.isPrimary===false)return;
   const card=handle.closest('[data-game-reorder-item]'),list=card?.parentElement,root=card?.closest('.game-pack-workspace');
   if(!root||!list?.matches('[data-game-reorder-list]')||items(list).length<2||!root.dataset.gameTourScope)return;
   clear();event.preventDefault();handle.focus({preventScroll:true});
   drag={handle,card,list,root,scope:root.dataset.gameTourScope,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,active:false,target:null,scroll:scrollingParent(list)};
   try{handle.setPointerCapture?.(event.pointerId);}catch{/* Pointer support varies in embedded browsers. */}
  }
  function move(event){
   if(!drag||event.pointerId!==drag.pointerId)return;if(!valid(drag)){cancel();return;}
   drag.x=event.clientX;drag.y=event.clientY;
   if(!drag.active&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)<5)return;
   event.preventDefault();if(!drag.active){drag.active=true;drag.card.classList.add('is-reordering');drag.handle.classList.add('is-grabbing');drag.handle.setAttribute('aria-pressed','true');announce('Déplacez l’interaction, puis relâchez. Échap pour annuler.');frame=win.requestAnimationFrame(tick);}
   position(drag);
  }
  function up(event){if(!drag||event.pointerId!==drag.pointerId)return;const state=drag;if(state.active){state.x=event.clientX;state.y=event.clientY;position(state);}const target=state.active&&state.target;clear();if(target)void commit(state,target);}
  function key(event){
   if(event.key==='Escape'&&drag){event.preventDefault();cancel();return;}
   const handle=event.target.closest?.('[data-game-drag-handle]');if(!handle||handle.disabled||busy||!['ArrowUp','ArrowDown'].includes(event.key))return;
   event.preventDefault();const card=handle.closest('[data-game-reorder-item]'),list=card?.parentElement,root=card?.closest('.game-pack-workspace');if(!root||!list?.matches('[data-game-reorder-list]'))return;
   const siblings=items(list),index=siblings.indexOf(card),target=siblings[index+(event.key==='ArrowUp'?-1:1)];if(!target)return;
   void commit({card,list,root,scope:root.dataset.gameTourScope,keyboard:true},{ruleId:card.dataset.rule,[event.key==='ArrowUp'?'beforeRuleId':'afterRuleId']:target.dataset.rule});
  }
  const observer=new win.MutationObserver(()=>{if(drag&&!valid(drag))cancel();});observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-game-tour-scope']});
  document.addEventListener('pointerdown',down);document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',up);document.addEventListener('pointercancel',cancel);document.addEventListener('lostpointercapture',cancel);document.addEventListener('keydown',key);win.addEventListener('blur',cancel);win.addEventListener('pagehide',cancel);
  const controller={cancel,destroy(){clear();observer.disconnect();document.removeEventListener('pointerdown',down);document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);document.removeEventListener('lostpointercapture',cancel);document.removeEventListener('keydown',key);win.removeEventListener('blur',cancel);win.removeEventListener('pagehide',cancel);indicator.remove();live.remove();instances.delete(document);}};
  instances.set(document,controller);return controller;
 };
})(globalThis.ShenPulseGameWorkspace);
