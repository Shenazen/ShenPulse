"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {AccountService}=require("../src/main/account-service");
const {stripeApprovalUrl}=require("../src/main/account/stripe-checkout");
const {createStore,jsonResponse}=require("./helpers/account-service-fixtures");
async function clientFixture({kind='subscription',cancel=false,badUrl=false,changeAccount=false,abandonPaid=false,wrongState=false,wrongSession=false,pendingSync=0}={}) {
 const store=createStore(),calls=[],opened=[];let createBody,paid=false,service;
 service=new AccountService({store,openExternal:async url=>{
  opened.push(url);
  if(changeAccount){service.logout();return;}
  const target=new URL(`http://127.0.0.1:${createBody.desktopCallbackPort}/payment-callback`);target.searchParams.set('state',createBody.desktopCallbackState);target.searchParams.set('status',cancel?'cancelled':'success');target.searchParams.set('session_id',wrongSession?'cs_test_wrong':'cs_test_example');if(wrongState){const wrong=new URL(target);wrong.searchParams.set('state','invalid-state');assert.equal((await fetch(wrong)).status,400);return;}await fetch(target);
 },fetchImpl:async(url,options={})=>{
  const path=new URL(url).pathname;
  if(path.includes('accounts:lookup'))return jsonResponse({users:[{localId:'stripe_user',email:'stripe@example.invalid',emailVerified:true}]});
  if(path.includes('accounts:signInWithPassword'))return jsonResponse({email:'stripe@example.invalid',localId:'stripe_user',idToken:'synthetic-token',refreshToken:'synthetic-refresh',expiresIn:'3600'});
  if(path.includes('/api/payments/stripe/')){
   const body=JSON.parse(options.body);calls.push({path,body,authorization:options.headers.Authorization});
   if(path.endsWith('/checkout')){createBody=body;return jsonResponse({id:'cs_test_example',approvalUrl:badUrl?'https://checkout.stripe.com.attacker.test/pay':'https://checkout.stripe.com/c/pay/cs_test_example',paymentProvider:'stripe',tier:kind==='subscription'?'pro':'',productId:kind==='game'?'test-game':''});}
   if(path.endsWith('/abandon')){if(abandonPaid){paid=true;return jsonResponse({ok:true,checkoutCompleted:true,paymentProvider:'stripe',tier:'pro',productId:'test-game'});}return jsonResponse({ok:true,cancelled:true});}
   if(path.endsWith('/sync')){if(pendingSync-->0)return jsonResponse({ok:true,pending:true});paid=true;return jsonResponse({ok:true,checkoutCompleted:true,tier:'pro',productId:'test-game'});}
  }
  if(path.includes('/entitlements'))return jsonResponse({checkedAt:new Date().toISOString(),tier:paid?'pro':'free',source:paid?'own':'free',paymentProvider:paid?'stripe':'',priceMonthly:paid?14.99:0,renewalDate:'2027-01-01T00:00:00Z',gameEntitlements:paid&&kind==='game'?[{id:'test-game',status:'active',source:'purchase'}]:[]});
  throw Error('Route inattendue '+path);
 }});
 await service.login({email:'stripe@example.invalid',password:'synthetic-password'});
 return {store,service,calls,opened};
}
test('le checkout Stripe revient dans l’application et synchronise le fournisseur de l’abonnement',async()=>{
 const f=await clientFixture(),result=await f.service.startSubscriptionCheckout({tier:'pro',expectedPrice:14.99,paymentProvider:'stripe',paymentMethod:'google_pay'});
 assert.equal(result.checkoutCompleted,true);assert.equal(result.approvalUrl,undefined);assert.equal(f.calls[0].body.expectedPrice,14.99);assert.equal(f.calls[0].body.paymentMethod,'google_pay');assert.equal(f.calls[0].body.ownerId,'stripe_user');assert.equal(f.calls[1].body.sessionId,'cs_test_example');assert.equal(f.store.state.commerce.subscription.paymentProvider,'stripe');assert.ok(f.calls.every(c=>c.authorization==='Bearer synthetic-token'));
});
test('un achat Stripe est accessible seulement après vérification serveur',async()=>{
 const f=await clientFixture({kind:'game'}),result=await f.service.startGameCheckout({productId:'test-game',paymentProvider:'stripe'});assert.equal(result.checkoutCompleted,true);assert.equal(f.store.state.commerce.gameEntitlements[0].id,'test-game');
});
test('annuler Stripe expire la session et libère le checkout sans synchronisation payante',async()=>{
 const f=await clientFixture({cancel:true}),result=await f.service.startSubscriptionCheckout({tier:'pro',expectedPrice:14.99,paymentProvider:'stripe'});assert.equal(result.cancelled,true);assert.equal(f.calls.at(-1).path,'/api/payments/stripe/abandon');assert.equal(f.service.subscriptionCheckoutCancel,null);assert.equal(f.store.state.commerce.subscription.tier,'free');
});
test('un lien Stripe usurpé est refusé avant l’ouverture du navigateur',async()=>{
 for(const url of ['http://checkout.stripe.com/pay','https://checkout.stripe.com.attacker.test/pay','https://stripe.com/pay','https://user:pass@checkout.stripe.com/pay'])assert.throws(()=>stripeApprovalUrl(url),/ne pointe pas vers Stripe/);
 const f=await clientFixture({badUrl:true});await assert.rejects(f.service.startSubscriptionCheckout({tier:'pro',paymentProvider:'stripe'}),/ne pointe pas vers Stripe/);assert.deepEqual(f.opened,[]);
});
test('changer de compte pendant Stripe ne synchronise pas le nouveau compte avec un ancien paiement',async()=>{
 const f=await clientFixture({changeAccount:true});await assert.rejects(f.service.startSubscriptionCheckout({tier:'pro',paymentProvider:'stripe'}),/compte ShenPulse a changé/);assert.equal(f.calls.filter(c=>c.path.endsWith('/sync')).length,0);
});

for(const kind of ['game','subscription'])test('un paiement '+kind+' déjà confirmé au moment de l’annulation reste payé et synchronisé',async()=>{
 const f=await clientFixture({kind,cancel:true,abandonPaid:true});
 const incoming=kind==='game'?{productId:'test-game',paymentProvider:'stripe'}:{tier:'pro',expectedPrice:14.99,paymentProvider:'stripe'};
 const result=await(kind==='game'?f.service.startGameCheckout(incoming):f.service.startSubscriptionCheckout(incoming));
 assert.equal(result.checkoutCompleted,true);assert.notEqual(result.cancelled,true);
 if(kind==='game')assert.equal(f.store.state.commerce.gameEntitlements[0].id,'test-game');else assert.equal(f.store.state.commerce.subscription.paymentProvider,'stripe');
});

test('un retour avec un état incorrect interdit toute activation',async()=>{
 const f=await clientFixture({wrongState:true});await assert.rejects(f.service.startSubscriptionCheckout({tier:'pro',expectedPrice:14.99,paymentProvider:'stripe'}),/retour du paiement n’a pas pu être vérifié/);assert.equal(f.calls.filter(c=>c.path.endsWith('/sync')).length,0);assert.equal(f.store.state.commerce.subscription.tier,'free');
});

test('une session différente au retour ne déclenche aucune synchronisation de paiement',async()=>{
 const f=await clientFixture({wrongSession:true});await assert.rejects(f.service.startSubscriptionCheckout({tier:'pro',expectedPrice:14.99,paymentProvider:'stripe'}),/retour Stripe ne correspond pas/);assert.equal(f.calls.filter(c=>c.path.endsWith('/sync')).length,0);assert.equal(f.store.state.commerce.subscription.tier,'free');
});

test('une confirmation serveur retardée est attendue avant l’activation',async()=>{
 const f=await clientFixture({pendingSync:2});const result=await f.service.startSubscriptionCheckout({tier:'pro',expectedPrice:14.99,paymentProvider:'stripe'});assert.equal(result.checkoutCompleted,true);assert.equal(f.calls.filter(c=>c.path.endsWith('/sync')).length,3);assert.equal(f.store.state.commerce.subscription.tier,'pro');
});
