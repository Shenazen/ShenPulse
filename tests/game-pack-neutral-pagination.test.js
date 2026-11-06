'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const layout=require('../resources/overlays/game-pack-layout');
const {loadShenazenGameCatalog}=require('../src/main/game-catalog');
const runtime=fs.readFileSync(path.join(__dirname,'../resources/overlays/runtime/game-pack.js'),'utf8');
function cards(help,trap,neutral){return [['help',help],['trap',trap],['neutral',neutral]].flatMap(([column,count])=>Array.from({length:count},(_,index)=>({id:column+'-'+index,title:column+' '+index,column,triggerType:'gift'})));}

test('neutres : remplissage équilibré des places libres, dans les deux sens, sans page superflue',()=>{
 const cases=[
  [4,4,4,[[6,6]]], [2,6,4,[[6,6]]], [6,2,4,[[6,6]]],
  [6,0,6,[[6,6]]], [0,6,6,[[6,6]]], [0,0,12,[[6,6]]],
  [0,0,13,[[6,6],[1,0]]], [3,6,5,[[6,6],[1,1]]],
  [7,0,5,[[6,5],[1,0]]], [0,0,0,[]]
 ];
 for(const [help,trap,neutral,expected]of cases){
  const entries=cards(help,trap,neutral),before=structuredClone(entries),pages=layout.paginateCards(entries);
  assert.deepEqual(pages.map(page=>[page.help.length,page.trap.length]),expected,JSON.stringify([help,trap,neutral]));
  assert.deepEqual(entries,before,'La configuration et les catégories ne doivent pas être modifiées.');
 }
});

test('34 295 répartitions : nombre minimal de pages, aucune carte perdue ou dupliquée, couleurs et ordre conservés',()=>{
 let count=0;
 for(let capacity=2;capacity<=6;capacity++)for(let h=0;h<=18;h++)for(let t=0;t<=18;t++)for(let n=0;n<=18;n++){
  const entries=cards(h,t,n),pages=layout.paginateCards(entries,capacity),all=pages.flatMap(page=>[...page.help,...page.trap]);
  assert.equal(pages.length,Math.max(Math.ceil(h/capacity),Math.ceil(t/capacity),Math.ceil((h+t+n)/(capacity*2))));
  assert.equal(all.length,entries.length);assert.equal(new Set(all).size,entries.length);
  for(const page of pages){assert.ok(page.help.length<=capacity);assert.ok(page.trap.length<=capacity);assert.ok(page.help.every(card=>card.column!=='trap'));assert.ok(page.trap.every(card=>card.column!=='help'));}
  for(const column of ['help','trap'])assert.deepEqual(all.filter(card=>card.column===column),entries.filter(card=>card.column===column));
  assert.deepEqual([...all.filter(card=>card.column==='neutral')].sort((a,b)=>a.id.localeCompare(b.id)),entries.filter(card=>card.column==='neutral').sort((a,b)=>a.id.localeCompare(b.id)));
  count++;
 }
 assert.equal(count,34295);
});

function fixture(packId,presentation={model:1},search=''){
 const dom=new JSDOM('<main id="pack"><div id="cards"></div><div id="reaction"></div></main>',{runScripts:'outside-only',url:'https://overlay.test/game-pack.html?jeu='+packId+'&profile=p'+search});
 dom.window.ShenPulseGamePackLayout=layout;dom.window.eval(runtime);
 const state={enabled:true,packId,profileId:'p',cards:cards(4,4,4),presentation:{configured:true,motion:'fixed',...presentation}};
 dom.window.ShenPulseGamePack.render(state);return {dom,state,api:dom.window.ShenPulseGamePack};
}

test('toutes les fiches de jeux utilisent le remplissage commun dans l’aperçu et les URL copiées/studio',()=>{
 const catalog=loadShenazenGameCatalog(path.join(__dirname,'../resources'));
 for(const {id}of catalog)for(const search of ['', '&layout=compact&fit=cards','&layout=compact&fit=panel']){
  const f=fixture(id,{},search);
  try{
   const doc=f.dom.window.document;assert.equal(doc.querySelectorAll('.pack-page').length,1,id+search);
   for(const row of ['help','trap']){assert.equal(doc.querySelector('.pack-row.'+row).children.length,6);assert.equal(doc.querySelectorAll('.pack-row.'+row+' .neutral').length,2);}
   for(const card of doc.querySelectorAll('.neutral'))assert.equal(card.querySelector('.category').textContent,'NEUTRE');
   assert.equal(doc.querySelectorAll('.gift-card').length,12);
  }finally{f.dom.window.close();}
 }
 assert.ok(catalog.length>50);
});

test('dispositions latérales/bandeau, ordre inversé et tailles de cartes gardent leur capacité et toutes les cartes',()=>{
 for(const cardPlacement of ['bottom','sides'])for(const cameraPlacement of ['top','bottom'])for(const rowOrder of ['help-first','trap-first'])for(const cardSize of [80,100,130,160]){
  const presentation={cardPlacement,cameraPlacement,rowOrder,cardSize},f=fixture('minecraft-box-cyber',presentation);
  try{
   const capacity=layout.geometry(presentation).capacity,doc=f.dom.window.document,expected=layout.paginateCards(f.state.cards,capacity);
   assert.equal(doc.querySelectorAll('.pack-page').length,expected.length);
   assert.equal(doc.querySelectorAll('.neutral').length,4);
   for(const row of doc.querySelectorAll('.pack-row'))assert.ok(row.children.length<=capacity);
  }finally{f.dom.window.close();}
 }
});

test('une carte neutre répartie sur une autre page garde sa réaction et sa catégorie jaune',()=>{
 const f=fixture('supermarket-simulator',{motion:'animated'});
 try{
  f.state.cards=cards(0,6,8);f.api.render(f.state);
  f.api.trigger({profileId:'p',packId:'supermarket-simulator',ruleId:'neutral-7',viewer:'Camille'});
  const doc=f.dom.window.document,current=doc.querySelector('.pack-page.is-current');
  assert.equal(current.dataset.pageIndex,'1');assert.ok(current.querySelector('[data-rule="neutral-7"].neutral.hit'));
  assert.match(doc.querySelector('#reaction').textContent,/Camille/);
 }finally{f.dom.window.close();}
});
