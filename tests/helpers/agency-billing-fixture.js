const {createHmac}=require('node:crypto');
async function fixture(){
 const {createAgencyService}=await import('../../backend/agencies/service.mjs'),{createAgencyPackBilling}=await import('../../backend/agencies/billing.mjs');
 let at=Date.parse('2026-11-05T12:00:00Z'),root={},seq=0;const calls=[],prices={},sessions={},subscriptions={},invoices={},schedules={},personal={};
 const get=p=>p.split('/').filter(Boolean).reduce((a,k)=>a?.[k],root)??null;
 const put=(p,v)=>{const keys=p.split('/').filter(Boolean);if(!keys.length){root=structuredClone(v);return;}let node=root;for(const k of keys.slice(0,-1))node=node[k]||={};if(v===null)delete node[keys.at(-1)];else node[keys.at(-1)]=structuredClone(v);};
 const db={ref(p=''){return {on(){},off(){},async get(){return {val:()=>structuredClone(get(p))};},async once(){return this.get();},async set(v){put(p,v);},async update(values){for(const [k,v]of Object.entries(values))put(p?p+'/'+k:k,v);},async transaction(fn){const next=fn(structuredClone(get(p)));if(next===undefined)return {committed:false};put(p,next);return {committed:true,snapshot:{val:()=>get(p)}};}};}};
 const terms={id:'pack',revision:1,title:'20 créateurs',status:'enabled',prices:{pro:850,premium:1200},minimumCreators:20,maximumCreators:40,additions:'prorata',removals:'renewal',belowMinimum:'block',validFrom:'',validUntil:''};
 const members=Object.fromEntries(Array.from({length:25},(_,i)=>['c'+i,{agencyId:'agency',status:'approved',email:'c'+i+'@example.invalid'}]));
 put('serverOnly/agencyProgram',{agencies:{agency:{id:'agency',name:'Agence test',status:'approved',ownerUid:'director'}},memberships:members,agencyPacks:{pack:terms},agencyPackAssignments:{agency:{agencyId:'agency',packId:'pack',revision:1,seats:Array.from({length:20},(_,i)=>({uid:'c'+i,tier:'pro'})),status:'prepared'}}});
 const invoiceFor=(sub,paid=true)=>{const id='in_'+(++seq),invoice={id,status:paid?'paid':'open',currency:'eur',hosted_invoice_url:'https://invoice.stripe.com/i/'+id,payments:{data:[]},parent:{subscription_details:{subscription:sub.id}},amount_paid:sub.items.data[0].price.unit_amount};invoices[id]=invoice;sub.latest_invoice=invoice;return invoice;};
 let failPayment=false;
 const api=async(path,{method='GET',body={},idempotencyKey}={})=>{
  calls.push({path,method,body:structuredClone(body),idempotencyKey});let value;
  if(path==='customers')value={id:'cus_'+(++seq)};
  else if(path==='prices'){const id='price_'+(++seq);value=prices[id]={id,...structuredClone(body)};}
  else if(path==='checkout/sessions'){const id='cs_test_'+(++seq);value=sessions[id]={id,...structuredClone(body),livemode:false,url:'https://checkout.stripe.com/c/pay/'+id,status:'open',payment_status:'unpaid',amount_total:prices[body.line_items[0].price].unit_amount,currency:'eur'};}
  else if(path.startsWith('checkout/sessions/')){const id=path.split('/')[2];value=sessions[id];if(path.endsWith('/expire'))value.status='expired';}
  else if(path==='invoices/create_preview'){const sub=subscriptions[body.subscription],next=prices[body.subscription_details.items[0].price],ratio=(sub.items.data[0].current_period_end-body.subscription_details.proration_date)/(sub.items.data[0].current_period_end-sub.items.data[0].current_period_start);value={lines:{has_more:false,data:[{amount:Math.round((next.unit_amount-sub.items.data[0].price.unit_amount)*ratio),parent:{subscription_item_details:{proration:true}}}]}};}
  else if(path.startsWith('subscriptions/')){value=subscriptions[path.split('/')[1]];if(method==='POST'){
   if(body.cancel_at_period_end!=null)value.cancel_at_period_end=body.cancel_at_period_end;
   if(body.items){const next=prices[body.items[0].price];if(failPayment){value.pending_update={expires_at:at/1000+86400};value.pendingPrice=next;invoiceFor(value,false);}else{value.items.data[0].price=next;invoiceFor(value);}}
  }}
  else if(path==='subscription_schedules'){const id='sub_sched_'+(++seq),sub=subscriptions[body.from_subscription];value=schedules[id]={id,subscription:sub.id};sub.schedule=id;}
  else if(path.startsWith('subscription_schedules/')){const id=path.split('/')[1];value=schedules[id];if(path.endsWith('/release')){subscriptions[value.subscription].schedule=null;value.status='released';}else if(method==='POST')Object.assign(value,structuredClone(body));}
  else if(path.startsWith('invoices/')){value=invoices[path.split('/')[1]];if(path.endsWith('/void')){value.status='void';const sub=Object.values(subscriptions).find(x=>x.latest_invoice.id===value.id);sub.pending_update=null;}}
  else if(path==='billing_portal/configurations')value={id:'bpc_test'};
  else if(path==='billing_portal/sessions')value={url:'https://billing.stripe.com/p/session/test'};
  else throw Error('API inattendue '+path);
  if(!value)throw Error('Objet absent '+path);return structuredClone(value);
 };
 const authenticate=async r=>{if(!r.uid)throw Object.assign(Error('Non authentifié'),{statusCode:401});return {uid:r.uid,email:r.uid+'@example.invalid'};};
 const service=createAgencyService({db:()=>db,authenticate,requireAdmin:async()=>({uid:'admin'}),subscription:async uid=>personal[uid]||{},now:()=>at});
 const billing=service.configurePackBilling(options=>createAgencyPackBilling({...options,stripe:{ready:true,live:false,api},returnUrls:()=>({returnUrl:'https://example.invalid/return',cancelUrl:'https://example.invalid/cancel'}),webhookSecret:'whsec_agency_test'}));
 const request={uid:'director',headers:{}};
 const pay=id=>{const session=sessions[id],price=prices[session.line_items[0].price],subId='sub'+(++seq);session.status='complete';session.payment_status='paid';session.subscription='sub_'+subId;const sub=subscriptions[session.subscription]={id:session.subscription,livemode:false,customer:session.customer,metadata:session.subscription_data.metadata,status:'active',cancel_at_period_end:false,items:{data:[{id:'si_'+seq,quantity:1,price,current_period_start:at/1000,current_period_end:at/1000+30*86400}]}};invoiceFor(sub);return sub;};
 const start=async()=>{const preview=await billing.preview(request,{}),checkout=await billing.checkout(request,{previewId:preview.previewId}),sub=pay(checkout.id);await billing.sync(request,{sessionId:checkout.id});return {preview,checkout,sub};};
 const edit=fn=>{const program=get('serverOnly/agencyProgram');fn(program.agencyPackAssignments.agency,program.agencyPacks.pack,program);program.agencyPackAssignments.agency.revision++;put('serverOnly/agencyProgram',program);};
 const renew=(sub,paid=true)=>{const schedule=schedules[sub.schedule],next=schedule?.phases?.[1]?.items?.[0]?.price;if(next)sub.items.data[0].price=prices[next];const item=sub.items.data[0];at=item.current_period_end*1000+1000;item.current_period_start=item.current_period_end;item.current_period_end+=30*86400;sub.status=paid?'active':'past_due';invoiceFor(sub,paid);};
 const signed=event=>{const body=JSON.stringify({...event,livemode:false}),t=at/1000;return {request:{headers:{'stripe-signature':'t='+t+',v1='+createHmac('sha256','whsec_agency_test').update(t+'.'+body).digest('hex')}},body};};
 return {service,billing,request,get,put,calls,prices,sessions,subscriptions,invoices,schedules,personal,start,pay,edit,renew,signed,advance:ms=>at+=ms,now:()=>at,failPayment:value=>failPayment=value,get contract(){return get('serverOnly/agencyProgram/agencyPackContracts/agency');},get program(){return get('serverOnly/agencyProgram');}};
}
module.exports={fixture};
