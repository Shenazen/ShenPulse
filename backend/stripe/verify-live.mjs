import '../env.js';
import assert from 'node:assert/strict';
import { createStripePayments } from './service.mjs';
const storage = new Map();
const db={ref(path=''){return {on(){},off(){},async once(){return this.get();},async get(){return {val:()=>storage.get(path)||null};},async set(value){storage.set(path,value);},async transaction(fn){const next=fn(storage.get(path));if(next===undefined)return {committed:false};storage.set(path,next);return {committed:true};}};}};
const service=createStripePayments({db:()=>db,authenticate:async()=>({uid:'stripe_readiness_'+crypto.randomUUID(),email:'stripe-readiness@shenpulse.invalid'}),catalog:async()=>({products:{'coin-pusher':{id:'coin-pusher',title:'Coin Pusher Live',enabled:true,accessMode:'purchase',currency:'EUR'}},subscriptions:{pro:{enabled:true,currency:'EUR',title:'Pro'},premium:{enabled:true,currency:'EUR',title:'Premium'}}}),priceProduct:()=>({amount:'4.99'}),quote:async()=>({quoted:{pro:14.99,premium:20.99},group:'public'}),subscription:async()=>({}),returnUrls:()=>({returnUrl:'https://shenpulse.leuridan.fr/?stripeVerification=1',cancelUrl:'https://shenpulse.leuridan.fr/?stripeVerification=cancelled'}),applySubscription:async()=>{throw Error('Aucune activation autorisée dans ce contrôle.');}});
const sessions=[];let customerId;
try {
 for(const kind of ['game','subscription']) {
  const result=await service.checkout({}, {kind,productId:'coin-pusher',tier:'pro',expectedPrice:14.99,requestId:crypto.randomUUID()});
  sessions.push(result.id);
  const session=await service.api('checkout/sessions/'+result.id);
  customerId=typeof session.customer==='string'?session.customer:session.customer.id;
  assert.deepEqual(session.payment_method_types,['card','link']);
  assert.equal(session.livemode,true);assert.equal(session.status,'open');assert.equal(session.payment_status,'unpaid');assert.equal(session.amount_total,kind==='game'?499:1499);
  console.log(JSON.stringify({mode:session.mode,methods:session.payment_method_types,live:session.livemode,status:session.status,amount:session.amount_total,url:session.url}));
 }
 const prices=await service.api('prices',{body:{active:true,lookup_keys:['shenpulse_pro_eur_1499_v1'],limit:1}});
 const pro=prices.data[0];
 const config=await service.api('billing_portal/configurations',{method:'POST',idempotencyKey:'shenpulse-portal-api-check-v1',body:{business_profile:{headline:'Gérez votre abonnement ShenPulse'},features:{payment_method_update:{enabled:true},invoice_history:{enabled:true},subscription_cancel:{enabled:true,mode:'at_period_end'},subscription_update:{enabled:true,default_allowed_updates:['price'],products:[{product:typeof pro.product==='string'?pro.product:pro.product.id,prices:[pro.id]}],proration_behavior:'always_invoice',schedule_at_period_end:{conditions:[{type:'decreasing_item_amount'}]}}}}});
 assert.equal(config.features.subscription_update.enabled,true);
 const portal=await service.api('billing_portal/sessions',{method:'POST',body:{customer:customerId,configuration:config.id,return_url:'https://shenpulse.leuridan.fr/'}});
 assert.match(portal.url,/^https:\/\/billing.stripe.com\//);
 console.log(JSON.stringify({portal:true,configuration:config.id,scheduledDowngrades:true}));
} finally {
 for(const id of sessions) await service.api('checkout/sessions/'+id+'/expire',{method:'POST'});
 if(customerId) await service.api('customers/'+customerId,{method:'DELETE'});
 console.log(JSON.stringify({sessionsExpired:sessions.length,noPayment:true,syntheticCustomerRemoved:!!customerId}));
}
