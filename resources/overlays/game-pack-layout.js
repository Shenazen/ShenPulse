"use strict";
/** Même contrat pour l’aperçu, les URL publiques et les installateurs studio. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShenPulseGamePackLayout=api;})(globalThis,()=>{
 const PACK_ID='minecraft-box-cyber';
 const GAME_IDS=Object.freeze(["thiercelieux","coin-pusher","connect-four","deal-or-no-deal","diamond-bridge","diamond-drop","color-strike","tiklive-climb","tiklive-cube-wars","tiklive-stack-tower","clash-of-live","shenfarm","shenpaint","splash-bombes","shenkite"]);
 const supports=packId=>packId===PACK_ID||GAME_IDS.includes(packId);
 function normalize(value={},packId=''){
  if(!supports(packId))return null;
  const size=Number(value.cardSize);
  return {cardPlacement:value.cardPlacement==='sides'?'sides':'bottom',cameraPlacement:value.cameraPlacement==='bottom'?'bottom':'top',rowOrder:value.rowOrder==='trap-first'?'trap-first':'help-first',cardSize:Number.isFinite(size)?Math.min(160,Math.max(80,Math.round(size))):100};
 }
 function geometry(value={}){
  const p=normalize(value,PACK_ID),s=p.cardSize/100,side=p.cardPlacement==='sides',flipped=p.cameraPlacement==='bottom';
  const giftHeight=Math.min(1120,Math.max(440,484*s+116)),cameraHeight=side?600:(1920-giftHeight)/2;
  const camera={x:0,y:flipped?1920-cameraHeight:0,width:1080,height:cameraHeight};
  const game={x:0,y:side?(flipped?0:600):(flipped?giftHeight:cameraHeight),width:1080,height:side?1320:cameraHeight};
  const gifts={x:0,y:side?game.y:flipped?0:1920-giftHeight,width:1080,height:side?1320:giftHeight};
  return {width:1080,height:1920,camera,game,gifts,side,flipped,scale:s,capacity:side?Math.max(2,Math.min(6,Math.floor(960/(148*s+12)))):Math.max(2,Math.min(6,Math.floor(1044/(162*s+12))))};
 }
 // Follow puis Likes précèdent toujours les cadeaux, sans réécrire les règles.
 const socialRank=card=>card.triggerType==='follow'?0:['like','likes'].includes(card.triggerType)?1:2;
 const prioritizeCards=(cards=[])=>[...cards].sort((a,b)=>socialRank(a)-socialRank(b));
 // Les neutres complètent les deux rangées sans changer leur catégorie ni leur ordre.
 function paginateCards(cards=[],capacity=6,{socialRow='help'}={}){
  capacity=Number.isFinite(capacity)?Math.max(1,Math.floor(capacity)):6;
  const social=prioritizeCards(cards.filter(card=>socialRank(card)<2)),gifts=cards.filter(card=>socialRank(card)===2);
  const help=[...(socialRow==='trap'?[]:social),...gifts.filter(card=>card.column==='help')],trap=[...(socialRow==='trap'?social:[]),...gifts.filter(card=>card.column==='trap')],neutral=gifts.filter(card=>card.column==='neutral');
  const count=Math.max(Math.ceil(help.length/capacity),Math.ceil(trap.length/capacity),Math.ceil((help.length+trap.length+neutral.length)/(capacity*2)));
  let nextNeutral=0;
  return Array.from({length:count},(_,index)=>{
   const rows={help:help.slice(index*capacity,(index+1)*capacity),trap:trap.slice(index*capacity,(index+1)*capacity)};
   while(nextNeutral<neutral.length&&(rows.help.length<capacity||rows.trap.length<capacity)){
    const row=rows.help.length<=rows.trap.length?'help':'trap';
    rows[row].push(neutral[nextNeutral++]);
   }
   return rows;
  });
 }
 function createPreviewReceiver({query,packId,profile,onChange,host=globalThis}){
  let draft=null,last=null;
  const enabled=supports(packId)&&query.get('editorPreview')==='1'&&host.parent!==host;
  const receive=event=>{
   const data=event.data;
   if(!enabled||event.source!==host.parent||data?.source!=='shenpulse-game-presentation'||data.packId!==packId||data.profileId!==profile||!data.presentation||typeof data.presentation!=='object')return;
   const value=data.presentation;
   draft={...normalize(value,packId),model:[1,2,3].includes(Number(value.model))?Number(value.model):1,motion:value.motion==='fixed'?'fixed':'animated',backgroundColor:/^#[0-9a-f]{6}$/i.test(value.backgroundColor||'')?value.backgroundColor:'#082b63',configured:true};
   if(last)onChange(last);
  };
  if(enabled)host.addEventListener('message',receive);
  return {apply(state){last=state;return draft&&state?{...state,presentation:{...state.presentation,...draft}}:state;},dispose(){if(enabled)host.removeEventListener('message',receive);}};
 }
 return Object.freeze({PACK_ID,GAME_IDS,supports,normalize,geometry,prioritizeCards,paginateCards,createPreviewReceiver});
});
