"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const load = import("../backend/stripe/service.mjs");
const NOW = Date.parse("2026-10-29T22:00:00Z");
function memoryDb() {
  let root = {}; let writes = 0;
  const get = path => path.split('/').filter(Boolean).reduce((value,key)=>value?.[key],root) ?? null;
  const set = (path,value) => { writes++; const keys=path.split('/').filter(Boolean); if(!keys.length){root=value;return;} let parent=root; for(const key of keys.slice(0,-1)) parent=parent[key] ||= {}; if(value===null)delete parent[keys.at(-1)];else parent[keys.at(-1)]=structuredClone(value); };
  const db = { ref(path='') { return { on(){},off(){},async once(){return this.get();},async get(){return {val:()=>structuredClone(get(path))};},async set(value){set(path,value);},async update(values){for(const [key,value]of Object.entries(values))set(path?path+'/'+key:key,value);},async transaction(fn){const next=fn(structuredClone(get(path)));if(next===undefined)return{committed:false};set(path,next);return{committed:true,snapshot:{val:()=>get(path)}};} }; } };
  return {db,get,set,get writes(){return writes;}};
}
async function fixture() {
  const {createStripePayments}=await load, mem=memoryDb(), calls=[], sessions={}; let current={};
  const sub={id:'sub_example',livemode:false,customer:'cus_example',metadata:{app:'shenpulse',uid:'user_test'},status:'active',latest_invoice:{id:'in_example',status:'paid'},items:{data:[{id:'si_example',quantity:1,current_period_end:NOW/1000+86400,price:{id:'price_example',unit_amount:1499,currency:'eur',recurring:{interval:'month'},metadata:{app:'shenpulse',tier:'pro'}}}]}};
  const invoice={payments:{data:[]}},dispute={status:'under_review'};
  const charge={id:'ch_example',refunded:false,disputed:false,payment_intent:'pi_example'};
  const api=async(input,options={})=>{
    const target=new URL(input),path=target.pathname.replace('/v1/',''),body=new URLSearchParams(options.body||''); calls.push({path,body,options}); let result;
    if(path==='customers')result={id:'cus_example'};
    else if(path==='prices')result={data:[{id:'price_example',product:'shenpulse_pro'}]};
    else if(path==='checkout/sessions') {const id='cs_test_'+(Object.keys(sessions).length+1)+'example';result=sessions[id]={id,livemode:false,url:'https://checkout.stripe.com/c/pay/'+id,status:'open',payment_status:'unpaid',customer:body.get('customer'),client_reference_id:body.get('client_reference_id'),metadata:{app:body.get('metadata[app]'),kind:body.get('metadata[kind]')},amount_total:body.get('mode')==='subscription'?1499:Number(body.get('line_items[0][price_data][unit_amount]')),currency:'eur',payment_intent:'pi_example',subscription:'sub_example'};}
    else if(path.startsWith('checkout/sessions/')){const id=path.split('/')[2];if(path.endsWith('/expire'))sessions[id].status='expired';result=sessions[id];}
    else if(path==='subscriptions/sub_example') {if(body.get('cancel_at_period_end')==='true')sub.cancel_at_period_end=true;result=sub;}
    else if(path==='payment_intents/pi_example')result={id:'pi_example',status:'succeeded',amount_received:499,currency:'eur',latest_charge:'ch_example'};
    else if(path==='charges/ch_example')result=charge;
    else if(path==='invoices/in_example')result=invoice;
    else if(path==='disputes/dp_example')result=dispute;
    else throw Error('API inattendue '+path);
    return new Response(JSON.stringify(result),{status:200});
  };
  const service=createStripePayments({db:()=>mem.db,authenticate:async()=>({uid:'user_test',email:'test@example.invalid'}),catalog:async()=>({products:{'test-game':{id:'test-game',title:'Jeu',enabled:true,accessMode:'purchase',currency:'EUR'}},subscriptions:{pro:{enabled:true,currency:'EUR',title:'Pro'},premium:{enabled:true,currency:'EUR',title:'Premium'}}}),priceProduct:()=>({amount:'4.99'}),quote:async()=>({quoted:{pro:14.99,premium:20.99},group:'public'}),subscription:async()=>current,returnUrls:()=>({returnUrl:'https://example.test/return?verified=1',cancelUrl:'https://example.test/cancel?verified=1'}),applySubscription:async(value)=>{current={...current,...value,paymentProvider:'stripe',stripeSubscriptionId:value.subscriptionId,stripeCustomerId:value.customerId};},fetchImpl:api,env:{STRIPE_SECRET_KEY:'sk_test_synthetic',STRIPE_WEBHOOK_SECRET:'whsec_synthetic'},now:()=>NOW});
  return {service,mem,calls,sessions,sub,charge,invoice,dispute,setCurrent:v=>{current=v;},get current(){return current;}};
}
const request={headers:{}};
const requestId='12345678-1234-1234-1234-123456789abc';
const game={kind:'game',productId:'test-game',requestId};
const subscription={kind:'subscription',tier:'pro',expectedPrice:14.99,requestId};
function signed(event) { const body=JSON.stringify(event),t=NOW/1000;return {body,request:{headers:{'stripe-signature':`t=${t},v1=${createHmac('sha256','whsec_synthetic').update(t+'.'+body).digest('hex')}`}}}; }

test('Stripe impose carte et Link ; Apple Pay et Google Pay passent par carte, sans autres méthodes',async()=>{
 const f=await fixture(),result=await f.service.checkout(request,{...game,amount:1});
 const call=f.calls.find(c=>c.path==='checkout/sessions');
 assert.equal(call.body.get('payment_method_types[0]'),'card');assert.equal(call.body.get('payment_method_types[1]'),'link');assert.equal(call.body.get('line_items[0][price_data][unit_amount]'),'499');assert.equal(result.paymentProvider,'stripe');assert.equal(f.mem.get('users/user_test/entitlements'),null);
});
test('Stripe refuse un tarif périmé et calcule le tarif côté serveur',async()=>{
 const f=await fixture();await assert.rejects(f.service.checkout(request,{...subscription,expectedPrice:0.01}),{statusCode:409});assert.equal(f.calls.length,0);
 const result=await f.service.checkout(request,subscription);assert.equal(f.mem.get('serverOnly/stripeCheckouts/'+result.id).amount,1499);
});
test('un abonnement PayPal actif interdit un second abonnement Stripe',async()=>{
 const f=await fixture();f.setCurrent({status:'active',tier:'pro',paymentProvider:'paypal',paypalSubscriptionId:'I-TEST'});await assert.rejects(f.service.checkout(request,subscription),/PayPal est actif/);assert.equal(f.calls.length,0);
});
test('un abonnement Stripe actif interdit un second abonnement PayPal',async()=>{
 const f=await fixture();f.setCurrent({status:'active',tier:'pro',paymentProvider:'stripe',stripeSubscriptionId:'sub_example'});await assert.rejects(f.service.assertPayPalAllowed('user_test'),{statusCode:409});
});
test('deux checkouts Stripe concurrents ne créent qu’une session d’abonnement',async()=>{
 const f=await fixture();const result=await Promise.allSettled([f.service.checkout(request,subscription),f.service.checkout(request,{...subscription,requestId:'22345678-1234-1234-1234-123456789abc'})]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.calls.filter(c=>c.path==='checkout/sessions').length,1);
});
test('un retour navigateur sans paiement confirmé n’accorde aucun jeu',async()=>{
 const f=await fixture(),result=await f.service.checkout(request,game);assert.equal((await f.service.sync(request,{sessionId:result.id})).pending,true);assert.equal(f.mem.get('users/user_test/entitlements'),null);
});
test('une commande Stripe ne peut pas être attribuée à un autre compte ou modifiée',async()=>{
 const f=await fixture(),result=await f.service.checkout(request,game);await assert.rejects(f.service.complete(result.id,'other_user'),{statusCode:403});f.sessions[result.id].amount_total=1;await assert.rejects(f.service.complete(result.id,'user_test'),{statusCode:409});assert.equal(f.mem.get('users/user_test/entitlements'),null);
});
test('un achat payé est accordé une fois et synchronisé dans les achats historiques',async()=>{
 const f=await fixture(),result=await f.service.checkout(request,game);Object.assign(f.sessions[result.id],{status:'complete',payment_status:'paid'});await f.service.complete(result.id);const before=f.mem.writes;await f.service.complete(result.id);assert.equal(f.mem.writes,before);assert.equal(f.mem.get('users/user_test/entitlements/games/test-game').paymentProvider,'stripe');assert.deepEqual(f.mem.get('users/user_test/configs/interactiveGamePurchases').purchasedGameIds,['test-game']);
});
test('un remboursement reçu avant le retour interdit l’octroi d’un jeu',async()=>{
 const f=await fixture(),result=await f.service.checkout(request,game);Object.assign(f.sessions[result.id],{status:'complete',payment_status:'paid'});f.charge.refunded=true;await assert.rejects(f.service.complete(result.id),{statusCode:409});assert.equal(f.mem.get('users/user_test/entitlements'),null);
});
test('un webhook remboursé révoque le bon achat et ses doublons restent inoffensifs',async()=>{
 const f=await fixture(),result=await f.service.checkout(request,game);Object.assign(f.sessions[result.id],{status:'complete',payment_status:'paid'});await f.service.complete(result.id);f.charge.refunded=true;const event=signed({id:'evt_example',livemode:false,type:'charge.refunded',data:{object:{id:'ch_example'}}});await f.service.webhook(event.request,event.body);assert.equal(f.mem.get('users/user_test/entitlements/games/test-game/status'),'refunded');assert.equal((await f.service.webhook(event.request,event.body)).duplicate,true);await f.service.complete(result.id);assert.equal(f.mem.get('users/user_test/entitlements/games/test-game/status'),'refunded');
});
test('signatures falsifiées, corps modifiés, dates expirées et environnement différent sont refusés',async()=>{
 const {verifyStripeSignature}=await load,f=await fixture(),event=signed({id:'evt_example',livemode:true,type:'checkout.session.completed',data:{object:{id:'cs_unknown'}}});assert.throws(()=>verifyStripeSignature(event.body+' ',event.request.headers['stripe-signature'],'whsec_synthetic',NOW),{statusCode:400});assert.throws(()=>verifyStripeSignature(event.body,event.request.headers['stripe-signature'],'whsec_synthetic',NOW+301000),{statusCode:400});await assert.rejects(f.service.webhook(event.request,event.body),{statusCode:400});assert.equal(f.mem.writes,0);
});
test('un abonnement payé est activé et un impayé ne prolonge pas la période réglée',async()=>{
 const f=await fixture(),result=await f.service.checkout(request,subscription);Object.assign(f.sessions[result.id],{status:'complete',payment_status:'paid'});await f.service.complete(result.id);assert.equal(f.current.tier,'pro');assert.equal(f.current.priceMonthly,14.99);const end=f.current.renewalDate;f.sub.status='past_due';f.sub.latest_invoice.status='open';await f.service.reconcileSubscription('sub_example');assert.equal(f.current.renewalDate,end);f.setCurrent({...f.current,renewalDate:new Date(NOW-1).toISOString()});await f.service.reconcileSubscription('sub_example');assert.equal(f.current.status,'free');
});
test('une résiliation Stripe conserve l’offre payée et programme la fin de période',async()=>{
 const f=await fixture(),result=await f.service.checkout(request,subscription);Object.assign(f.sessions[result.id],{status:'complete',payment_status:'paid'});await f.service.complete(result.id);const cancelled=await f.service.cancel(request);assert.equal(cancelled.scheduled,true);assert.equal(f.current.status,'active');assert.equal(f.current.pendingChange.targetTier,'free');assert.ok(f.calls.some(c=>c.body.get('cancel_at_period_end')==='true'));
});
test('une annulation de checkout expire la session et permet une nouvelle souscription',async()=>{
 const f=await fixture(),result=await f.service.checkout(request,subscription);await f.service.abandon(request,{sessionId:result.id});assert.equal(f.sessions[result.id].status,'expired');assert.equal(f.mem.get('serverOnly/stripePendingSubscriptions/user_test'),null);await f.service.checkout(request,{...subscription,requestId:'22345678-1234-1234-1234-123456789abc'});
});

test('les deux prestataires ne peuvent pas réserver simultanément une nouvelle souscription',async()=>{
 const f=await fixture();await f.service.reservePayPalCheckout('user_test','paypal-request');await assert.rejects(f.service.checkout(request,subscription),/autre moyen de paiement/);assert.equal(f.calls.filter(c=>c.path==='checkout/sessions').length,0);
});
test('une session Stripe expirée libère aussi la réservation du prestataire',async()=>{
 const f=await fixture(),result=await f.service.checkout(request,subscription);await f.service.abandon(request,{sessionId:result.id});await f.service.reservePayPalCheckout('user_test','paypal-request');assert.equal(f.mem.get('serverOnly/paymentProviderReservations/user_test').provider,'paypal');
});
test('un litige gagné rétablit la période Stripe payée même si la charge conserve le marqueur disputed',async()=>{
 const f=await fixture(),result=await f.service.checkout(request,subscription);f.invoice.payments.data=[{payment:{payment_intent:{id:'pi_example',latest_charge:'ch_example'}}}];Object.assign(f.sessions[result.id],{status:'complete',payment_status:'paid'});await f.service.complete(result.id);f.charge.disputed=true;
 const opened=signed({id:'evt_dispute_open',livemode:false,type:'charge.dispute.created',data:{object:{id:'dp_example',charge:'ch_example'}}});await f.service.webhook(opened.request,opened.body);assert.equal(f.current.status,'free');
 f.dispute.status='won';const closed=signed({id:'evt_dispute_closed',livemode:false,type:'charge.dispute.closed',data:{object:{id:'dp_example',charge:'ch_example'}}});await f.service.webhook(closed.request,closed.body);assert.equal(f.current.status,'active');assert.equal(f.current.tier,'pro');
});
