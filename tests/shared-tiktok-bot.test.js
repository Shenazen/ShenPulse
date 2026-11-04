"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {randomUUID}=require("node:crypto");
const {SharedTikTokBotDelivery,usesAutomaticChatBot}=require("../src/main/sources/shared-tiktok-bot-delivery");
const {EulerOAuthChatDelivery}=require("../src/main/sources/euler-oauth-chat-delivery");
const response=(body,status=200)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body)});

async function serverFixture(config={}){
  const {createSharedTikTokBotService}=await import('../backend/chatbot-tiktok/service.mjs');
  let current={...config},clock=Date.now();const calls=[];
  const service=createSharedTikTokBotService({authenticate:async r=>{if(!r?.uid)throw Object.assign(new Error('auth'),{statusCode:401});return r;},entitlements:async uid=>({tier:uid==='free'?'free':'pro'}),DeliveryClass:EulerOAuthChatDelivery,now:()=>clock,
    configuration:{read:()=>current,write:c=>{current=c;}},fetchImpl:async(url,options)=>{
      calls.push({url,options});
      if(url.endsWith('/token'))return response({data:{access_token:'new-private-token',refresh_token:'new-private-refresh',expires_in:3600,scopes:['webcast:chat']}});
      return response({code:200,data:{status_code:0,data:{message_id:'1'}}});
    }});
  return {service,calls,config:()=>current,advance:ms=>{clock+=ms;}};
}
const configured=()=>({apiKey:'server-api-key',accessToken:'server-oauth-token',botUsername:'shenpulse.bot',expiresAt:new Date(Date.now()+3600000).toISOString(),scopes:['webcast:chat']});

test('service commun non configuré : aucun faux droit, aucun envoi et aucun secret exposé',async()=>{
  const f=await serverFixture();
  assert.deepEqual(await f.service.status({uid:'owner'}),{ready:false,reason:'bot-configuration-required'});
  await assert.rejects(f.service.status({}),/auth/);
  await assert.rejects(f.service.status({uid:'free'}),{code:'BOT_ACCESS_FORBIDDEN'});
  assert.equal(f.calls.length,0);
});
test('un bot configuré sert plusieurs comptes ShenPulse sans diffuser ses jetons',async()=>{
  const f=await serverFixture(configured());
  const status=await f.service.status({uid:'alice'});
  assert.equal(status.ready,true);assert.equal(status.botUsername,'shenpulse.bot');
  assert.doesNotMatch(JSON.stringify(status),/server-api-key|server-oauth-token/);
  const requestId=randomUUID(),body={requestId,roomId:'123456',message:'Bonjour'};
  const first=await f.service.send({uid:'alice'},body),duplicate=await f.service.send({uid:'alice'},body);
  assert.deepEqual(first,duplicate);assert.equal(first.acknowledged,true);assert.equal(f.calls.length,1);
  await assert.rejects(f.service.send({uid:'alice'},{...body,requestId:randomUUID()}),{code:'BOT_RATE_LIMIT'});
  f.advance(3001);
  assert.equal((await f.service.send({uid:'bob'},{...body,requestId:randomUUID(),roomId:'234567'})).sent,true);
  assert.equal(f.calls.length,2);
});
test('renouvellement serveur : une seule rotation concurrente, identifiants gardés côté service',async()=>{
  const f=await serverFixture({...configured(),expiresAt:new Date(Date.now()-1000).toISOString(),refreshToken:'old-refresh',clientId:'client',clientSecret:'private-client'});
  const results=await Promise.all([f.service.status({uid:'a'}),f.service.status({uid:'b'})]);
  assert.ok(results.every(item=>item.ready));assert.equal(f.calls.length,1);
  assert.equal(f.config().refreshToken,'new-private-refresh');
  assert.doesNotMatch(JSON.stringify(results),/private|token|refresh/);
});
test('le serveur refuse les messages invalides et garde un refus comme résultat idempotent',async()=>{
  const f=await serverFixture(configured());
  for(const change of [{roomId:'https://bad'},{message:'x'.repeat(501)},{requestId:'bad'}])await assert.rejects(f.service.send({uid:'a'},{requestId:randomUUID(),roomId:'123',message:'test',...change}),{code:'BOT_INVALID_MESSAGE'});
  assert.equal(f.calls.length,0);
});

function clientFixture(){
  const state={settings:{account:{uid:'owner'},tiktok:{}}},calls=[];
  const client=new SharedTikTokBotDelivery({store:{getState:()=>state},identityProvider:async()=>({uid:state.settings.account.uid,idToken:'firebase-session'}),fetchFn:async(url,options)=>{
    calls.push({url,options});if(url.endsWith('/status'))return response({ready:true,botUsername:'shenpulse.bot'});
    const body=JSON.parse(options.body);return response({requestId:body.requestId,sent:true,acknowledged:true});
  }});
  return {state,calls,client};
}
test('mode commun par défaut, sortie personnelle conservée et réception seule respectée',()=>{
  const f=clientFixture(),store={getState:()=>f.state};
  assert.equal(usesAutomaticChatBot(store),true);
  f.state.settings.tiktok.chat={accountUid:'owner',provider:'none',automatic:false};assert.equal(usesAutomaticChatBot(store),false);
  f.state.settings.tiktok.chat={accountUid:'owner',provider:'euler-oauth'};assert.equal(usesAutomaticChatBot(store),false);
  f.state.settings.account.uid='another';assert.equal(usesAutomaticChatBot(store),true);
});
test('client automatique : identité Firebase uniquement, capacité vérifiée puis confirmation corrélée',async()=>{
  const f=clientFixture();await f.client.refresh();
  assert.equal(f.client.status().canSend,true);
  assert.equal((await f.client.send('123',{message:'Bonjour'})).sent,true);
  assert.equal(f.calls.length,2);
  assert.equal(f.calls[1].options.headers.Authorization,'Bearer firebase-session');
  assert.doesNotMatch(JSON.stringify(f.calls),/x-api-key|x-oauth-token|server-api-key/);
  f.state.settings.account.uid='another';assert.equal(f.client.status().canSend,false);
  f.client.reset();
});
test('client : un service absent ne devient jamais une autorisation et aucun POST ne part',async()=>{
  const f=clientFixture();f.client.fetch=async()=>response({},404);
  await f.client.refresh();assert.equal(f.client.status().canSend,false);
  await assert.rejects(f.client.send('123',{message:'test'}),{code:'tiktok-chat-service-unavailable'});
  assert.equal(f.calls.length,0);
});
test('client : changer de compte durant la prise d’identité empêche la requête HTTP',async()=>{
  const f=clientFixture();f.client.identityProvider=async()=>{f.state.settings.account.uid='changed';return {uid:'owner',idToken:'old'};};
  await f.client.refresh();assert.equal(f.calls.length,0);f.client.reset();
});
