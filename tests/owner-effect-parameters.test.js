"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),net=require('node:net'),{once}=require('node:events');
const {defaultEffectParameters}=require('../src/main/game-hub/commands');
const {createEffectPayload}=require('../src/main/game-hub/effect-payload');
const {SimpleTcpServerBridge}=require('../src/main/simple-tcp-server-bridge');
const {OWNER_INTEGRATIONS}=require('../src/main/game-catalog/owner-integrations');
test('les choix conservent leur valeur et refusent une option non déclarée',()=>{
 const effect={id:'choice',code:'spawn',parameters:[{id:'team',label:'Camp',type:'select',defaultValue:'ally',options:[{value:'ally'},{value:'enemy'}]},{id:'amount',type:'number',defaultValue:3}]};
 assert.deepEqual(defaultEffectParameters(effect),{team:'ally',amount:3});
 assert.equal(createEffectPayload(effect,{}, {parameters:{team:'enemy'}}).effect.parameters.team,'enemy');
 assert.throws(()=>createEffectPayload(effect,{}, {parameters:{team:'unauthorized'}}),/Choix invalide/);
});
test('tous les nouveaux effets produisent des paramètres initiaux sérialisables',()=>{
 for(const pack of OWNER_INTEGRATIONS)for(const effect of pack.effects){const payload=createEffectPayload(effect);assert.doesNotMatch(JSON.stringify(payload),/:null/);for(const param of effect.parameters||[])if(param.type==='select')assert.ok(param.options.some(x=>x.value===payload.effect.parameters[param.id]),pack.id+'/'+effect.id);}
 const sims=OWNER_INTEGRATIONS.find(x=>x.id==='the-sims-4');assert.deepEqual(sims.connector.parameterOrderByCode.addviewer,['age','gender','pronouns']);
});
test('les anciens protocoles reçoivent les choix dans leur ordre propre',async t=>{
 const bridge=new SimpleTcpServerBridge({port:0,timeoutMs:1500});const state=await bridge.start();const client=net.createConnection({host:'127.0.0.1',port:state.port});t.after(async()=>{client.destroy();await bridge.close();});await once(client,'connect');
 client.on('data',chunk=>{const request=JSON.parse(String(chunk).split('\0')[0]);assert.deepEqual(request.parameters,['young','female','theythem']);assert.equal(request.quantity,1);client.write(JSON.stringify({id:request.id,status:0})+'\0');});
 await bridge.send('addviewer',{parameters:{gender:'female',pronouns:'theythem',age:'young',unrelated:5},parameterOrder:['age','gender','pronouns']});
});
