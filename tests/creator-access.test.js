"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { assertCreatorCapacity, creatorActionCount } = require("../src/main/creator-access");
const { hasGameAccess } = require("../src/main/game-access");

function state(rules = []) {
  return { rules, profiles: [{id:"p"}], commerce:{subscription:{tier:"free", status:"free"},gameEntitlements:[]} };
}
function rule(id, count) { return {id, actions:Array.from({length:count},(_,index)=>({id:`${id}_${index}`,type:"overlay.media"}))}; }

test("Free permits three actions, reference reuse, and editing historical workspaces without data loss",()=>{
  const existing = state([rule("one",3)]);
  assert.doesNotThrow(()=>assertCreatorCapacity(existing,"rules",{id:"trigger",actions:[{type:"action.group"}]}));
  assert.throws(()=>assertCreatorCapacity(existing,"rules",rule("fourth",1)),/3 actions/);
  assert.doesNotThrow(()=>assertCreatorCapacity(existing,"rules",rule("one",2)));
  const legacy = state([rule("old",9)]);
  assert.doesNotThrow(()=>assertCreatorCapacity(legacy,"rules",rule("old",9)));
  assert.throws(()=>assertCreatorCapacity(legacy,"rules",rule("extra",1)),/3 actions/);
  assert.equal(creatorActionCount([{actions:[{type:"action.group"},{type:"tts.speak"}]}]),1);
});

test("Free profile limit is additive only and active Pro removes creator limits",()=>{
  const existing = state();
  assert.doesNotThrow(()=>assertCreatorCapacity(existing,"profiles",{id:"p",name:"Edited"}));
  assert.throws(()=>assertCreatorCapacity(existing,"profiles",{id:"new"}),/1 profil/);
  existing.commerce.subscription={tier:"pro", status:"active"};
  assert.doesNotThrow(()=>assertCreatorCapacity(existing,"profiles",{id:"new"}));
  assert.doesNotThrow(()=>assertCreatorCapacity(existing,"rules",rule("new",30)));
});

test("Games require active Pro, keep purchases, and never bypass refund or expired trials",()=>{
  const existing=state();
  const video={id:"video",requiresPro:false,accessMode:"included"};
  const purchased={id:"purchased",requiresPro:false,accessMode:"purchase"};
  assert.equal(hasGameAccess(existing,video),false);
  assert.equal(hasGameAccess(existing,purchased),false);
  existing.commerce.gameEntitlements=[{gameId:"purchased",status:"refunded"}];
  assert.equal(hasGameAccess(existing,purchased),false);
  existing.commerce.gameEntitlements=[{gameId:"purchased",status:"paid"}];
  assert.equal(hasGameAccess(existing,purchased),false);
  assert.deepEqual(existing.commerce.gameEntitlements,[{gameId:"purchased",status:"paid"}],"Free conserve l'achat sans ouvrir le jeu");
  existing.commerce.subscription={tier:"pro",status:"active"};
  assert.equal(hasGameAccess(existing,video),true);
  assert.equal(hasGameAccess(existing,purchased),true);
  existing.commerce.gameEntitlements=[{gameId:"purchased",status:"refunded"}];
  assert.equal(hasGameAccess(existing,purchased),false);
  existing.commerce.gameEntitlements=[{gameId:"purchased",source:"trial",status:"active",expiresAtMs:10}];
  assert.equal(hasGameAccess(existing,purchased,9),true);
  assert.equal(hasGameAccess(existing,purchased,11),false);
});
