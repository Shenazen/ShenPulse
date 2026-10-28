"use strict";
// The two historical models use the exact same renderer as the original PNG exports.
window.ShenPulseGamePackModels={async render(state,model,compact){
 const entries=state.cards.map(card=>({label:card.title,actionLabels:card.actionLabels||[card.title],groupKey:card.id,triggerType:card.triggerType==="like"?"likes":card.triggerType,triggerKey:card.triggerType==="gift"?card.giftName:card.triggerType,giftLabel:card.giftName||card.title,giftImageUrl:card.giftImageUrl,effectImageUrl:model===3&&/^(?:media\/(?:game-interactions|game-art)\/[a-z0-9_-]+\/[a-z0-9_.-]+|https:\/\/|data:image\/svg\+xml,)/i.test(card.effectImageUrl||"")?card.effectImageUrl:"",likeAmount:card.threshold}));
 const canvas=await window.ShenPulseGameOverlay.renderMinecraftStyledOverlay({entries,model:model-1,backgroundColor:state.presentation?.backgroundColor||"#082b63",logoUrl:"brand/game-pack-legacy-logo.png?v=20261025-1",fontUrl:"fonts/game-pack-pixel.ttf?v=20261025-1"});
 if(!compact)return canvas;
 const bounds=canvas.overlayPanelBounds,result=document.createElement("canvas");result.width=1080;result.height=bounds.height;
 const context=result.getContext("2d");if(!context)throw new Error("Canvas indisponible.");context.drawImage(canvas,0,bounds.y,1080,bounds.height,0,0,1080,bounds.height);return result;
}};
