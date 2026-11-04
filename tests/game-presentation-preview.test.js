'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPreviewReceiver,PACK_ID}=require('../resources/overlays/game-pack-layout');
test('le brouillon ne peut affecter qu’une source de popup, du bon jeu et du bon profil',()=>{
 function fixture(query='editorPreview=1',packId=PACK_ID,top=false){let handler,changes=0;const host={parent:{},addEventListener:(_,fn)=>handler=fn,removeEventListener:()=>handler=null};if(top)host.parent=host;const receiver=createPreviewReceiver({query:new URLSearchParams(query),packId,profile:'p',host,onChange:state=>{changes++;receiver.apply(state)}});return {host,receiver,send:(data,source=host.parent)=>handler?.({source,data}),changes:()=>changes};}
 const state={enabled:true,packId:PACK_ID,profileId:'p',presentation:{model:1,cardSize:100}},message={source:'shenpulse-game-presentation',packId:PACK_ID,profileId:'p',presentation:{model:2,cardSize:999,cameraPlacement:'bottom',backgroundColor:'#abcdef'}};
 for(const f of [fixture(''),fixture('editorPreview=1','cult-of-the-lamb'),fixture('editorPreview=1',PACK_ID,true)]){f.receiver.apply(state);f.send(message);assert.equal(f.changes(),0);assert.equal(f.receiver.apply(state),state);}
 const f=fixture();f.receiver.apply(state);f.send({...message,profileId:'other'});f.send({...message,packId:'other'});f.send(message,{});assert.equal(f.changes(),0);f.send(message);assert.equal(f.changes(),1);const draft=f.receiver.apply(state);assert.equal(draft.presentation.model,2);assert.equal(draft.presentation.cardSize,160);assert.equal(draft.presentation.cameraPlacement,'bottom');assert.equal(state.presentation.model,1);assert.equal(state.presentation.cardSize,100);f.receiver.dispose();f.send(message);assert.equal(f.changes(),1);
});
