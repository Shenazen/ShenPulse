import {createHash} from 'node:crypto';
import {verifyStripeSignature} from '../stripe/service.mjs';
import {packError,quoteAgencyPack} from './pack-policy.mjs';
import {idOf,sameSeats} from './billing-policy.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const iso=v=>Number(v)>0?new Date(Number(v)*1000).toISOString():'';
export function createPackLifecycle({read,write,api,now,live,serial,completeSession,webhookSecret=process.env.STRIPE_WEBHOOK_SECRET}){
 const refreshed=new Map();
 async function verifiedSubscription(c){
  const sub=await api('subscriptions/'+encodeURIComponent(c.subscriptionId),{body:{expand:['latest_invoice','items.data.price']}}),m=sub.metadata||{},item=sub.items?.data?.[0],snapshot=c.prices?.[idOf(item?.price)];
  if(sub.livemode!==live||idOf(sub.customer)!==c.customerId||m.app!=='shenpulse'||m.kind!=='agency_pack'||m.uid!==c.ownerUid||m.agencyId!==c.agencyId||sub.items?.data?.length!==1||item.quantity!==1||!snapshot||item.price.unit_amount!==snapshot.amount||item.price.currency!=='eur'||item.price.recurring?.interval!=='month'||(item.price.recurring.interval_count||1)!==1)packError('Le contrat de paiement ne correspond pas à ce pack.',409);
  return sub;
 }
 async function schedule(c,sub,next){
  const end=Number(sub.items.data[0].current_period_end||sub.current_period_end),start=Number(sub.items.data[0].current_period_start||sub.current_period_start);
  if(!start||end<=start||end*1000<=now())packError('La période de renouvellement est invalide.',409);
  const signature=hash([sub.items.data[0].price.id,next.id,end]);
  if(c.scheduleSignature===signature&&idOf(sub.schedule))return {scheduleId:idOf(sub.schedule),scheduleSignature:signature};
  const scheduleId=idOf(sub.schedule)||(await api('subscription_schedules',{method:'POST',idempotencyKey:'agency-schedule-'+sub.id+'-'+signature,body:{from_subscription:sub.id}})).id;
  await api('subscription_schedules/'+scheduleId,{method:'POST',idempotencyKey:'agency-phases-'+sub.id+'-'+signature,body:{end_behavior:'release',proration_behavior:'none',phases:[{start_date:start,end_date:end,items:[{price:sub.items.data[0].price.id,quantity:1}],proration_behavior:'none'},{items:[{price:next.id,quantity:1}],iterations:1,proration_behavior:'none'}]}});
  return {scheduleId,scheduleSignature:signature};
 }
 async function reconcile(agencyId){return serial(agencyId,async()=>{
  let s=await read(),c=s.agencyPackContracts?.[agencyId];if(!c?.subscriptionId)return;
  const sub=await verifiedSubscription(c),item=sub.items.data[0],snapshot=c.prices[item.price.id],invoice=typeof sub.latest_invoice==='object'?sub.latest_invoice:sub.latest_invoice?await api('invoices/'+sub.latest_invoice):null;
  let reversed=!!c.reversedInvoices?.[invoice?.id];
  if(invoice?.status==='paid'){
   const full=await api('invoices/'+invoice.id,{body:{expand:['payments.data.payment.payment_intent']}});
   for(const payment of full.payments?.data||[]){
    const intent=payment.payment?.payment_intent,intentId=idOf(intent);if(!intentId)continue;
    const detail=typeof intent==='object'?intent:await api('payment_intents/'+intentId),chargeId=idOf(detail.latest_charge);if(!chargeId)continue;
    const charge=await api('charges/'+chargeId);if(charge.refunded||charge.disputed&&c.disputeResolutions?.[charge.id]!=='won')reversed=true;
   }
  }
  const terminal=reversed||['canceled','unpaid','incomplete_expired','paused'].includes(sub.status),end=Number(item.current_period_end||sub.current_period_end),paid=!terminal&&sub.status==='active'&&invoice?.status==='paid'&&end*1000>now();
  let next={...c,stripeStatus:sub.status,cancelAtPeriodEnd:!!sub.cancel_at_period_end,lastCheckedAtMs:now(),lastInvoiceUrl:invoice?.hosted_invoice_url||c.lastInvoiceUrl||'',lastInvoiceId:invoice?.id||c.lastInvoiceId||'',scheduleId:idOf(sub.schedule)};
  if(terminal)Object.assign(next,{status:'inactive',paidThrough:iso(now()/1000),pending:null});
  else if(paid)Object.assign(next,{status:'active',paidThrough:iso(end),periodStart:iso(item.current_period_start||sub.current_period_start),paidSeats:snapshot.seats,terms:snapshot.terms,monthlyCents:snapshot.amount});
  else next.status=Date.parse(c.paidThrough||'')>now()?'active':'payment_required';
  const op=c.pending&&s.agencyPackOperations?.[c.pending];let completed=false;
  if(op&&paid&&item.price.id===op.currentPrice.id&&!sub.pending_update){
   if(op.plan.resumes&&next.cancelAtPeriodEnd){await api('subscriptions/'+sub.id,{method:'POST',idempotencyKey:'agency-resume-paid-'+op.id,body:{cancel_at_period_end:false}});next.cancelAtPeriodEnd=false;}
   Object.assign(next,{nextSeats:op.plan.targetSeats,nextMonthlyCents:op.plan.nextMonthlyCents,nextPriceId:op.nextPrice.id,pending:null,notice:''});completed=true;
  }else if(op?.kind==='change'&&!sub.pending_update&&op.expiresAtMs+24*3600000<now()&&item.price.id!==op.currentPrice.id){next.pending=null;next.notice='La modification n’a pas été payée. Préparez une nouvelle proposition.';}
  if(paid&&!next.pending&&!next.cancelAtPeriodEnd){
   const agency=s.agencies[agencyId],selected=(next.nextSeats||next.paidSeats||[]),eligible=selected.filter(row=>s.memberships[row.uid]?.agencyId===agencyId&&s.memberships[row.uid]?.status==='approved');
   const quote=agency&&quoteAgencyPack(next.terms,eligible,agency,s,now());
   if(agency?.status!=='approved'||!eligible.length||!quote?.minimumReached&&next.terms.belowMinimum==='block'){
    if(idOf(sub.schedule))await api('subscription_schedules/'+idOf(sub.schedule)+'/release',{method:'POST',idempotencyKey:'agency-policy-release-'+sub.id+'-'+hash([eligible,agency?.status])});
    await api('subscriptions/'+sub.id,{method:'POST',idempotencyKey:'agency-policy-stop-'+sub.id+'-'+hash([eligible,agency?.status]),body:{cancel_at_period_end:true}});
    next.cancelAtPeriodEnd=true;next.notice='Le renouvellement est arrêté : agence inactive ou minimum de créateurs non atteint. La période payée reste disponible aux membres éligibles.';
   }else{
    if(!sameSeats(selected,eligible)||quote.effectiveMonthlyCents!==next.nextMonthlyCents){
     const p=await api('prices',{method:'POST',idempotencyKey:'agency-members-'+sub.id+'-'+hash([eligible,quote.effectiveMonthlyCents]),body:{currency:'eur',unit_amount:quote.effectiveMonthlyCents,recurring:{interval:'month'},product_data:{name:'ShenPulse · '+next.terms.title},metadata:{app:'shenpulse',kind:'agency_pack',agencyId}}});
     next.prices={...next.prices,[p.id]:{id:p.id,seats:eligible,amount:quote.effectiveMonthlyCents,terms:next.terms}};next.nextPriceId=p.id;next.nextSeats=eligible;next.nextMonthlyCents=quote.effectiveMonthlyCents;next.notice='La sélection du prochain renouvellement a été adaptée aux membres encore présents.';
    }
    const future=next.prices[next.nextPriceId];
    if(future&&(!sameSeats(next.paidSeats,future.seats)||next.monthlyCents!==future.amount))Object.assign(next,await schedule(next,sub,future));
   }
  }
  const keep=new Set([item.price.id,next.nextPriceId,op?.currentPrice?.id,op?.nextPrice?.id].filter(Boolean));next.prices=Object.fromEntries(Object.entries(next.prices||{}).filter(([id])=>keep.has(id)));
  await write(agencyId,state=>{const current=state.agencyPackContracts[agencyId];if(current.subscriptionId!==c.subscriptionId)packError('Le contrat a changé.',409);if(current.revision!==c.revision||current.pending!==c.pending)packError('Le contrat a été modifié pendant sa synchronisation. Actualisez.',409);const comparable=v=>({...v,lastCheckedAtMs:0,revision:0});next.revision=(current.revision||0)+(JSON.stringify(comparable(current))===JSON.stringify(comparable(next))?0:1);state.agencyPackContracts[agencyId]=next;if(completed&&state.agencyPackOperations[op.id])state.agencyPackOperations[op.id].status='applied';});
  refreshed.set(agencyId,now());return next;
 });}
 async function refreshOwner(uid,force=false){
  const s=await read(),c=Object.values(s.agencyPackContracts||{}).find(row=>row.ownerUid===uid);if(!c)return;
  if(!force&&now()-(refreshed.get(c.agencyId)||0)<60000)return;
  const op=c.pending&&s.agencyPackOperations?.[c.pending];
  if(op?.kind==='checkout'&&op.checkoutId&&completeSession){
   const result=await completeSession(op.checkoutId,uid);
   if(result.cancelled)await write(c.agencyId,state=>{state.agencyPackContracts[c.agencyId].pending=null;state.agencyPackOperations[op.id].status='cancelled';});
  }else if(c.subscriptionId)await reconcile(c.agencyId);
 }
 async function refreshMember(uid){const s=await read(),id=s.memberships?.[uid]?.agencyId,c=s.agencyPackContracts?.[id];if(c)await refreshOwner(c.ownerUid);}
 async function entitlement(uid){
  const s=await read(),member=s.memberships?.[uid],agency=s.agencies?.[member?.agencyId],c=s.agencyPackContracts?.[agency?.id];
  if(member?.status!=='approved'||agency?.status!=='approved'||c?.status!=='active'||Date.parse(c.paidThrough||'')<=now())return null;
  const row=c.paidSeats?.find(seat=>seat.uid===uid);if(!row)return null;
  const expiresAtMs=Math.min(Date.parse(c.paidThrough),now()+15*60000);
  return {source:'agencyPack',tier:row.tier,priceMonthly:0,expiresAtMs,expiresAt:new Date(expiresAtMs).toISOString(),renewalDate:c.paidThrough,agencyId:agency.id};
 }
 async function webhook(request,raw){
  const e=verifyStripeSignature(raw,request.headers?.['stripe-signature'],webhookSecret,now());if(e.livemode!==live)packError('Événement de paiement incompatible.',400);
  const object=e.data?.object||{},s=await read();
  if(e.type==='checkout.session.completed'&&Object.values(s.agencyPackOperations||{}).some(op=>op.checkoutId===object.id))return completeSession(object.id);
  const id=e.type.startsWith('customer.subscription.')?object.id:idOf(object.parent?.subscription_details?.subscription||object.subscription);
  const c=Object.values(s.agencyPackContracts||{}).find(row=>row.subscriptionId===id);
  if(c)await reconcile(c.agencyId);
  if(e.type==='charge.refunded'||e.type.startsWith('charge.dispute.')){
   // Toutes les factures récentes sont relues : l’état Stripe courant prime sur l’ordre des événements.
   for(const contract of Object.values(s.agencyPackContracts||{}).filter(row=>row.customerId===idOf(object.customer)))if(contract.subscriptionId)await reconcile(contract.agencyId);
   if(e.type.startsWith('charge.dispute.')&&object.charge){const charge=await api('charges/'+idOf(object.charge)),dispute=await api('disputes/'+object.id);for(const contract of Object.values(s.agencyPackContracts||{}).filter(row=>row.customerId===idOf(charge.customer)))if(contract.subscriptionId){await write(contract.agencyId,state=>{const current=state.agencyPackContracts[contract.agencyId];current.disputeResolutions={...current.disputeResolutions,[charge.id]:dispute.status};});await reconcile(contract.agencyId);}}
  }
  return {ok:true};
 }
 async function sweep(){const s=await read();for(const c of Object.values(s.agencyPackContracts||{}).filter(row=>row.status!=='inactive').slice(0,1000))try{await refreshOwner(c.ownerUid);}catch{ /* La période déjà vérifiée n’est jamais prolongée en cas d’échec réseau. */ }}
 return {verifiedSubscription,reconcile,refreshOwner,refreshMember,entitlement,webhook,sweep};
}
