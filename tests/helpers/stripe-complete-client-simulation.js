"use strict";
/** Le seul appel réseau permis est le retour HTTP local vers le client de test. */
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture,NOW}=require('./stripe-complete-simulation');
const {AccountService}=require('../../src/main/account-service');
const {createStore,jsonResponse}=require('./account-service-fixtures');
const evidence=[];
async function runSimulatedPurchase(kind,payload,onReady,Client=AccountService){
 const backend=await fixture(payload.paymentMethod),store=createStore(),calls=[];let created,callbackBody,completion;
 const entitlements=()=>({...backend.current,checkedAt:new Date().toISOString(),tier:backend.current.tier||'free',source:backend.current.paymentProvider==='stripe'&&['active','paid'].includes(backend.current.status)?'own':'free',status:backend.current.status||'free',gameEntitlements:Object.entries(backend.mem.get('users/user_test/entitlements/games')||{}).map(([id,value])=>({id,...value}))});
 const client=new Client({store,webOrigin:'https://simulation.shenpulse.invalid',openExternal:async approvalUrl=>{
  assert.equal(new URL(approvalUrl).hostname,'checkout.stripe.com');
  assert.equal(backend.sessions[created.id].livemode,false);
  onReady({resolve:async()=>{
   try{
    Object.assign(backend.sessions[created.id],{status:'complete',payment_status:'paid'});
    const body=JSON.stringify({id:'evt_simulation_'+crypto.randomBytes(12).toString('hex'),livemode:false,type:'checkout.session.completed',data:{object:{id:created.id}}}),t=NOW/1000;
    const request={headers:{'stripe-signature':'t='+t+',v1='+crypto.createHmac('sha256','whsec_synthetic').update(t+'.'+body).digest('hex')}};
    await backend.service.webhook(request,body);
    const writes=backend.mem.writes;
    assert.equal((await backend.service.webhook(request,body)).duplicate,true);assert.equal(backend.mem.writes,writes);
    if(kind==='game')assert.equal(backend.mem.get('users/user_test/entitlements/games/coin-pusher/status'),'active');else assert.equal(backend.current.tier,'pro');
    const url=new URL('http://127.0.0.1:'+callbackBody.desktopCallbackPort+'/payment-callback');url.searchParams.set('state',callbackBody.desktopCallbackState);url.searchParams.set('status','success');url.searchParams.set('session_id',created.id);
    assert.equal(url.hostname,'127.0.0.1');assert.equal((await fetch(url)).status,200);
   }catch(error){completion=error;await client.cancelCheckout({type:kind});}
  }});
 },fetchImpl:async(input,options={})=>{
  const url=new URL(input),route=url.pathname;
  if(route.includes('accounts:lookup'))return jsonResponse({users:[{localId:'user_test',email:'test@example.invalid',emailVerified:true}]});
  if(route.includes('accounts:signInWithPassword'))return jsonResponse({email:'test@example.invalid',localId:'user_test',idToken:'synthetic-token',refreshToken:'synthetic-refresh',expiresIn:'3600'});
  if(route.includes('/entitlements'))return jsonResponse(entitlements());
  assert.equal(url.origin,'https://simulation.shenpulse.invalid');
  const body=JSON.parse(options.body||'{}');calls.push({route,body:{...body,desktopCallbackState:body.desktopCallbackState?'[local state]':undefined}});
  if(route.endsWith('/checkout')){callbackBody=body;created=await backend.service.checkout({},body);assert.equal(body.paymentMethod,payload.paymentMethod);return jsonResponse(created);}
  if(route.endsWith('/sync'))return jsonResponse(await backend.service.sync({},body));
  if(route.endsWith('/abandon'))return jsonResponse(await backend.service.abandon({},body));
  throw Error('Appel refusé hors de la simulation : '+route);
 }});
 await client.login({email:'test@example.invalid',password:'synthetic-password'});
 const result=await(kind==='game'?client.startGameCheckout(payload):client.startSubscriptionCheckout(payload));
 if(completion)throw completion;
 assert.equal(result.checkoutCompleted,true);assert.equal(result.paymentProvider,'stripe');
 if(kind==='game')assert.ok(store.state.commerce.gameEntitlements.some(entry=>entry.id==='coin-pusher'&&entry.status==='active'));
 else {assert.equal(store.state.commerce.subscription.tier,'pro');assert.equal(store.state.commerce.subscription.paymentProvider,'stripe');}
 evidence.push({kind,paymentMethod:payload.paymentMethod,mode:'fully-simulated-no-external-network',paidGatewayResponseSimulated:true,signedWebhookVerified:true,duplicateWebhookIgnored:true,localCallbackVerified:true,entitlementsSynchronized:true,actualStripeWalletAuthorized:false,calls});
 return{result,state:store.state};
}
module.exports={runSimulatedPurchase,evidence};
