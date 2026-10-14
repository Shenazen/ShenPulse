"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("seven studio heroes are real bounded WebP assets below 1.05 megabytes together",()=>{
  const directory=path.resolve(__dirname,"../src/renderer/assets/studio");
  const names=["actions","dashboard","music","overlays","users","voice","chatbot"];
  let total=0;
  for(const name of names){
    const bytes=fs.readFileSync(path.join(directory,`${name}.webp`));
    assert.equal(bytes.subarray(0,4).toString(),"RIFF");
    assert.equal(bytes.subarray(8,12).toString(),"WEBP");
    assert.ok(bytes.length<220000);
    total+=bytes.length;
  }
  assert.ok(total<1050000);
});

test("welcome hero is a real local WebP and keeps all nine studio illustrations below 1.25 megabytes",()=>{
  const directory=path.resolve(__dirname,"../src/renderer/assets/studio");
  const bytes=fs.readFileSync(path.join(directory,"home.webp"));
  assert.equal(bytes.subarray(0,4).toString(),"RIFF");
  assert.equal(bytes.subarray(8,12).toString(),"WEBP");
  assert.ok(bytes.length<450000);
  // Le budget porte sur les neuf illustrations, pas sur les ornements ajoutés
  // à d'autres pages. Chaque famille garde son propre plafond explicite.
  const illustrations=["actions","dashboard","music","overlays","users","voice","chatbot","home","home-steps"];
  const total=illustrations.reduce((size,name)=>size+fs.statSync(path.join(directory,`${name}.webp`)).size,0);
  assert.ok(total<1250000);
});

test("welcome steps use a small real local WebP without a runtime animation",()=>{
  const bytes=fs.readFileSync(path.resolve(__dirname,"../src/renderer/assets/studio/home-steps.webp"));
  assert.equal(bytes.subarray(0,4).toString(),"RIFF");
  assert.equal(bytes.subarray(8,12).toString(),"WEBP");
  assert.ok(bytes.length<70000);
});

test("les deux ornements de catégorie sont des WebP locaux transparents et bornés ensemble",()=>{
  const directory=path.resolve(__dirname,"../src/renderer/assets/studio");
  const decorations=[["frame",1600,307],["divider",1600,228]];
  let total=0;
  for(const [name,width,height] of decorations){
    const bytes=fs.readFileSync(path.join(directory,`overlay-section-${name}.webp`));
    assert.equal(bytes.subarray(0,4).toString(),"RIFF");
    assert.equal(bytes.subarray(8,12).toString(),"WEBP");
    assert.equal(bytes.subarray(12,16).toString(),"VP8X");
    assert.equal(bytes.readUIntLE(24,3)+1,width);
    assert.equal(bytes.readUIntLE(27,3)+1,height);
    assert.ok(bytes[20]&0x10,"Le canal alpha conserve la transparence autour de l'ornement.");
    assert.equal(bytes[20]&0x02,0,"Aucun WebP animé n'est ajouté au catalogue.");
    total+=bytes.length;
  }
  assert.ok(total<200000,`Les deux ressources doivent rester sous 200 ko : ${total} octets.`);
});
