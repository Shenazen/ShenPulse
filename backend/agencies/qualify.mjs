import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {integrateAgencyBackend} from './integrate.mjs';
import {quoteAgencyPrices} from './service.mjs';
const baseline=process.argv[2] || '.artifacts/agencies/baseline';
const stage=process.argv[3] || '.artifacts/agencies/stage';
const result=integrateAgencyBackend(fs.readFileSync(baseline+'/payments.js','utf8'),fs.readFileSync(baseline+'/index.js','utf8'));
for(const text of Object.values(result)){
 const check=spawnSync(process.execPath,['--input-type=module','--check'],{input:text,encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);
}
const checkout=result.payments.match(/^export async function createSubscriptionCheckout\([\s\S]*?^}/m)?.[0].replace(/^export /,'');
assert.ok(checkout);
async function run({state={},current={},expectedPrice,tier='pro'}={}){
 const seen={created:0,revised:0,records:[]};
 const quote=quoteAgencyPrices(state,'creator',current);
 const context={
  agencyService:{quote:async()=>quote,recordCheckout:async(...a)=>seen.records.push(a)},
  requireAuthenticatedUser:async()=>({uid:'creator'}),normalizeTier:t=>t,
  resolveSubscriptionPlan:async(t,price)=>{seen.price=price;return {planId:'PLAN-'+price,priceMonthly:price};},
  subscriptionSnapshot:async()=>current,paymentRequestKey:()=> 'REQUEST',
  paymentError:(m,statusCode)=>Object.assign(new Error(m),{statusCode}),
  reviseSubscriptionCheckout:async args=>{seen.revised++;return {id:current.paypalSubscriptionId,approvalUrl:'https://www.paypal.com/checkout',price:args.plan.priceMonthly};},
  desktopSubscriptionReturnUrls:()=>({cancelUrl:'https://example.invalid/cancel',returnUrl:'https://example.invalid/return'}),
  encodePaymentCustomId:a=>a.join(':'),paypalBrandName:'ShenPulse',paypalIdempotencyKey:()=> 'KEY',
  paypalRequest:async(_path,options)=>{seen.created++;seen.request=options.body;return {id:'I-NEW',links:[]};},
  approvalLink:()=> 'https://www.paypal.com/checkout'
 };
 const fn=vm.runInNewContext('('+checkout+')',context);
 const response=await fn({},{tier,...(expectedPrice!=null?{expectedPrice}:{})});
 return {seen,response};
}
let item=await run({expectedPrice:14.99});
assert.equal(item.seen.price,14.99);assert.equal(item.seen.request.plan_id,'PLAN-14.99');assert.equal(item.seen.records[0][1].group,'public');
await assert.rejects(run({expectedPrice:9.99}),{statusCode:409});
await assert.rejects(run({}),{statusCode:426});
const state={agencies:{a:{id:'a',name:'Agence',status:'approved'}},memberships:{creator:{agencyId:'a',status:'approved'}}};
item=await run({state,expectedPrice:9.99});assert.equal(item.seen.price,9.99);assert.equal(item.seen.records[0][1].agencyId,'a');
const old={status:'active',tier:'pro',priceMonthly:9.99,paymentProvider:'paypal',paypalSubscriptionId:'I-OLD'};
item=await run({current:old,expectedPrice:9.99});assert.equal(item.response.alreadyActive,true);assert.equal(item.seen.created,0);
item=await run({current:old,tier:'premium',expectedPrice:13.99});assert.equal(item.seen.revised,1);assert.equal(item.seen.records[0][1].group,'legacy');
item=await run({state,current:{...old,priceMonthly:14.99,agencyProgramGroup:'public'},expectedPrice:9.99});assert.equal(item.seen.revised,1);assert.equal(item.seen.price,9.99);
assert.throws(()=>integrateAgencyBackend(result.payments,result.index),/déjà intégré/);
fs.mkdirSync(stage,{recursive:true});
fs.writeFileSync(stage+'/payments.js',result.payments);fs.writeFileSync(stage+'/index.js',result.index);
console.log('Pont de paiement qualifié : syntaxe complète, tarif public, agence, ancien abonné, changement confirmé et refus d’un prix périmé. Aucun appel PayPal réel.');
