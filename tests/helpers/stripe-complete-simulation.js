"use strict";
const { createHmac } = require("node:crypto");
const load = import("../../backend/stripe/service.mjs");
const NOW = Date.parse("2026-10-29T22:00:00Z");
function memoryDb() {
  let root = {}; let writes = 0;
  const get = path => path.split('/').filter(Boolean).reduce((value,key)=>value?.[key],root) ?? null;
  const set = (path,value) => { writes++; const keys=path.split('/').filter(Boolean); if(!keys.length){root=value;return;} let parent=root; for(const key of keys.slice(0,-1)) parent=parent[key] ||= {}; if(value===null)delete parent[keys.at(-1)];else parent[keys.at(-1)]=structuredClone(value); };
  const db = { ref(path='') { return { on(){},off(){},async once(){return this.get();},async get(){return {val:()=>structuredClone(get(path))};},async set(value){set(path,value);},async update(values){for(const [key,value]of Object.entries(values))set(path?path+'/'+key:key,value);},async transaction(fn){const next=fn(structuredClone(get(path)));if(next===undefined)return{committed:false};set(path,next);return{committed:true,snapshot:{val:()=>get(path)}};} }; } };
  return {db,get,set,get writes(){return writes;}};
}
async function fixture(paymentMethod = "card") {
  const {createStripePayments}=await load, mem=memoryDb(), calls=[], sessions={}; let current={};
  const sub={id:'sub_example',livemode:false,customer:'cus_example',metadata:{app:'shenpulse',uid:'user_test'},status:'active',latest_invoice:{id:'in_example',status:'paid'},items:{data:[{id:'si_example',quantity:1,current_period_end:NOW/1000+86400,price:{id:'price_example',unit_amount:1499,currency:'eur',recurring:{interval:'month'},metadata:{app:'shenpulse',tier:'pro'}}}]}};
  const invoice={payments:{data:[]}},dispute={status:'under_review'};
  const charge={id:'ch_example',refunded:false,disputed:false,payment_intent:'pi_example',payment_method_details:paymentMethod==='link'?{type:'link',link:{}}:{type:'card',card:{wallet:['google_pay','apple_pay'].includes(paymentMethod)?{type:paymentMethod}:null}}};
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
  const service=createStripePayments({db:()=>mem.db,authenticate:async()=>({uid:'user_test',email:'test@example.invalid'}),catalog:async()=>({products:{'coin-pusher':{id:'coin-pusher',title:'Jeu',enabled:true,accessMode:'purchase',currency:'EUR'}},subscriptions:{pro:{enabled:true,currency:'EUR',title:'Pro'},premium:{enabled:true,currency:'EUR',title:'Premium'}}}),priceProduct:()=>({amount:'4.99'}),quote:async()=>({quoted:{pro:14.99,premium:20.99},group:'public'}),subscription:async()=>current,returnUrls:()=>({returnUrl:'https://example.test/return?verified=1',cancelUrl:'https://example.test/cancel?verified=1'}),applySubscription:async(value)=>{current={...current,...value,paymentProvider:'stripe',stripeSubscriptionId:value.subscriptionId,stripeCustomerId:value.customerId};},fetchImpl:api,env:{STRIPE_SECRET_KEY:'sk_test_synthetic',STRIPE_WEBHOOK_SECRET:'whsec_synthetic'},now:()=>NOW});
  return {service,mem,calls,sessions,sub,charge,invoice,dispute,setCurrent:v=>{current=v;},get current(){return current;}};
}

module.exports={fixture,NOW};
