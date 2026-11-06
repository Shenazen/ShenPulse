import {randomUUID,createHash} from 'node:crypto';
import {packError,packKey} from './pack-policy.mjs';
import {idOf,paidPersonal,ownPack,selectionPlan,billingView} from './billing-policy.mjs';
import {createPackLifecycle} from './billing-lifecycle.mjs';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const copy=v=>structuredClone(v);
export function createAgencyPackBilling({read,mutate,db,authenticate,subscription,stripe,returnUrls,webhookSecret=process.env.STRIPE_WEBHOOK_SECRET,now=Date.now}){
 const api=stripe.api,ready=!!stripe.ready,live=stripe.live;
 const system={uid:'system:agency-packs'},queues=new Map();
 const serial=async(id,fn)=>{const before=queues.get(id)||Promise.resolve(),task=before.catch(()=>{}).then(fn);queues.set(id,task);try{return await task;}finally{if(queues.get(id)===task)queues.delete(id);}};
 const write=async(id,fn)=>mutate(system,'pack.billing',id,s=>fn(s));
 const owner=(s,uid)=>{const a=Object.values(s.agencies||{}).find(a=>a.ownerUid===uid);if(!a)packError('Agence introuvable.',404);return a;};
 const lifecycle=createPackLifecycle({read,write,api,now,live,serial,completeSession,webhookSecret});
 const view=(s,id)=>billingView(s,id,ready);
 function revision(c,b){if(Number(b.expectedRevision)!==Number(c.revision||0))packError('La facturation a changé. Actualisez avant de continuer.',409);}
 async function personalConflicts(seats){
  const conflicts=[];
  for(let i=0;i<seats.length;i+=20)await Promise.all(seats.slice(i,i+20).map(async row=>{if(paidPersonal(await subscription(row.uid),now()))conflicts.push(row.uid);}));
  if(conflicts.length)packError(conflicts.length+' créateur(s) possèdent encore un abonnement personnel actif. Ils doivent arrêter son renouvellement et attendre la fin de leur période payée avant la prise en charge par l’agence. Aucun abonnement personnel ne sera annulé automatiquement.',409);
 }
 async function reserveSeats(seats,agencyId,operationId,expiresAtMs){
  for(const row of seats){
   const ref=db().ref('serverOnly/paymentProviderReservations/'+packKey(row.uid)),hold=()=>{};ref.on('value',hold);
   try{await ref.once('value');const result=await ref.transaction(v=>v&&v.expiresAtMs>now()&&(v.provider!=='agencyPack'||v.agencyId!==agencyId)?undefined:{provider:'agencyPack',agencyId,requestId:operationId,expiresAtMs});if(!result.committed)packError('Un créateur a déjà un paiement ou une prise en charge en cours. Actualisez la sélection.',409);}finally{ref.off('value',hold);}
  }
 }
 async function makePrice(plan,seats,amount,operationId,suffix){
  if(!Number.isSafeInteger(amount)||amount<50||amount>99999999)packError('Le total mensuel doit être compris entre 0,50 € et 999 999,99 €.',409);
  const p=await api('prices',{method:'POST',idempotencyKey:'agency-price-'+operationId+'-'+suffix,body:{currency:'eur',unit_amount:amount,recurring:{interval:'month'},product_data:{name:'ShenPulse · '+plan.terms.title,metadata:{app:'shenpulse',kind:'agency_pack'}},metadata:{app:'shenpulse',kind:'agency_pack',agencyId:plan.agencyId,operationId}}});
  return {id:p.id,seats:copy(seats),amount,terms:copy(plan.terms)};
 }
 async function preview(request,body={}){
  if(!ready)packError('La facturation des packs est indisponible.',503);
  const user=await authenticate(request);await lifecycle.refreshOwner(user.uid);
  const s=await read(),context=ownPack(s,user.uid),existing=context.contract;
  if(existing?.pending)packError('Une opération est déjà en cours. Actualisez son état avant de continuer.',409);
  context.contract=existing?.status==='active'&&Date.parse(existing.paidThrough)>now()?existing:null;
  if(existing?.subscriptionId&&!context.contract&&!['canceled','incomplete_expired'].includes(existing.stripeStatus))packError('Le contrat existant doit être régularisé ou résilié avant une nouvelle souscription.',409);
  const plan=selectionPlan(s,context,now());plan.resumes=!!existing?.cancelAtPeriodEnd;await personalConflicts(plan.targetSeats);
  const id=randomUUID(),at=Math.floor(now()/1000),currentPrice=await makePrice(plan,plan.currentSeats,plan.monthlyCents,id,'current');
  const nextPrice=plan.deferred?await makePrice(plan,plan.targetSeats,plan.nextMonthlyCents,id,'next'):currentPrice;
  let adjustmentCents=0;
  if(context.contract&&plan.monthlyCents!==existing.monthlyCents){
   const sub=await lifecycle.verifiedSubscription(existing),item=sub.items.data[0];
   const invoice=await api('invoices/create_preview',{method:'POST',body:{customer:existing.customerId,subscription:sub.id,subscription_details:{items:[{id:item.id,price:currentPrice.id,quantity:1}],proration_date:at,proration_behavior:'always_invoice'}}});
   if(invoice.lines?.has_more)packError('Le détail de facturation est trop long. Contactez ShenPulse.',409);
   adjustmentCents=(invoice.lines?.data||[]).filter(l=>l.parent?.subscription_item_details?.proration===true||l.proration===true).reduce((v,l)=>v+Number(l.amount||0),0);
  }
  const operation={id,ownerUid:user.uid,agencyId:plan.agencyId,kind:context.contract?'change':'checkout',status:'preview',createdAtMs:now(),expiresAtMs:now()+10*60000,contractRevision:existing?.revision||0,plan,currentPrice,nextPrice,prorationDate:at,adjustmentCents};
  await write(id,state=>{const a=ownPack(state,user.uid);if(a.assignment.revision!==plan.assignmentRevision||a.terms.revision!==plan.packRevision)packError('La sélection ou le tarif a changé. Recalculez le montant.',409);state.agencyPackOperations||={};state.agencyPackOperations[id]=operation;const expired=Object.values(state.agencyPackOperations).filter(o=>o.status==='preview'&&o.expiresAtMs<now()).slice(0,100);for(const o of expired)delete state.agencyPackOperations[o.id];});
  return {ok:true,previewId:id,kind:operation.kind,monthlyCents:plan.monthlyCents,nextMonthlyCents:plan.nextMonthlyCents,adjustmentCents,creators:plan.targetSeats.length,effectiveAt:existing?.paidThrough||'',deferred:plan.deferred,expiresAtMs:operation.expiresAtMs};
 }
 async function claim(user,body,kind){
  const id=packKey(body.previewId),s=await read(),op=s.agencyPackOperations?.[id];
  if(!op||op.ownerUid!==user.uid||op.kind!==kind)packError('Proposition de paiement introuvable.',404);
  if(op.status==='preview'&&op.expiresAtMs<now())packError('Cette proposition a expiré. Recalculez le montant.',409);
  if(op.kind==='checkout'&&op.status!=='preview'&&now()-op.createdAtMs>31*60000)packError('Ce paiement a expiré. Annulez-le puis recalculez le montant.',409);
  await personalConflicts(op.plan.targetSeats);
  await reserveSeats(op.plan.targetSeats,op.agencyId,id,now()+31*60000);
  await write(id,state=>{
   const a=ownPack(state,user.uid),current=state.agencyPackOperations[id],c=state.agencyPackContracts?.[op.agencyId];
   if(!['preview','processing','checkout'].includes(current.status))packError('Cette opération est déjà terminée. Actualisez votre espace.',409);
   if(current.status==='preview'&&(op.expiresAtMs<now()||a.assignment.revision!==op.plan.assignmentRevision||a.terms.revision!==op.plan.packRevision||(c?.revision||0)!==op.contractRevision))packError('Cette proposition a expiré ou changé. Recalculez le montant.',409);
   if(current.status==='preview')selectionPlan(state,{...a,contract:a.contract?.status==='active'?a.contract:null},now());
   if(c?.pending&&c.pending!==id)packError('Une autre opération est en cours.',409);
   state.agencyPackContracts||={};state.agencyPackContracts[op.agencyId]={...(c||{agencyId:op.agencyId,ownerUid:user.uid,revision:0,status:'pending'}),pending:id};
   current.status=current.status==='checkout'?'checkout':'processing';
  });return (await read()).agencyPackOperations[id];
 }
 async function recoverCheckout(op){
  const attempt=op.checkoutAttempt;
  if(now()-(attempt.createdAtMs||op.createdAtMs)<23*3600000)return api('checkout/sessions',{method:'POST',idempotencyKey:'agency-checkout-'+op.id+'-'+attempt.number,body:attempt.body});
  const history=await api('checkout/sessions',{body:{customer:attempt.body.customer,limit:100}});
  const matches=(history.data||[]).filter(session=>session.metadata?.operationId===op.id&&session.success_url===attempt.body.success_url);
  if(matches.length>1||!matches.length&&history.has_more)packError('La reprise de ce paiement nécessite une vérification par ShenPulse.',409);
  return matches[0]||null;
 }
 async function checkout(request,body={}){
  const user=await authenticate(request),op=await claim(user,body,'checkout');
  return serial(op.agencyId,async()=>{
   let current=(await read()).agencyPackOperations[op.id];
   const callbackSignature=digest([body.desktopCallbackPort||'',body.desktopCallbackState||'']);
   const storeSession=async(result,attempt)=>{await write(op.id,state=>{Object.assign(state.agencyPackOperations[op.id],{checkoutId:result.id,approvalUrl:result.url,customerId:attempt.body.customer,callbackSignature:attempt.callbackSignature,status:'checkout'});Object.assign(state.agencyPackContracts[op.agencyId],{customerId:attempt.body.customer,prices:{[op.currentPrice.id]:op.currentPrice,[op.nextPrice.id]:op.nextPrice},nextSeats:op.plan.targetSeats,nextMonthlyCents:op.plan.nextMonthlyCents});});};
   // Une création dont la réponse a été perdue est reprise avec exactement la même clé et le même corps.
   if(current.checkoutAttempt&&!current.checkoutId){
    const recovered=await recoverCheckout(current);
    if(recovered)await storeSession(recovered,current.checkoutAttempt);current=(await read()).agencyPackOperations[op.id];
   }
   if(current.checkoutId){
    const prior=await api('checkout/sessions/'+current.checkoutId);
    if(prior.status==='complete')return {ok:true,id:current.checkoutId,checkoutCompleted:true};
    if(prior.status==='open'&&current.callbackSignature===callbackSignature)return {ok:true,id:current.checkoutId,approvalUrl:current.approvalUrl,paymentProvider:'stripe'};
    if(prior.status==='open')await api('checkout/sessions/'+current.checkoutId+'/expire',{method:'POST',idempotencyKey:'agency-retry-expire-'+current.checkoutId});
   }
   const customer=await api('customers',{method:'POST',idempotencyKey:'agency-customer-'+digest(op.agencyId),body:{email:user.email,metadata:{app:'shenpulse',kind:'agency_pack',agencyId:op.agencyId,uid:user.uid}}});
   const returns=returnUrls(request,body),metadata={app:'shenpulse',kind:'agency_pack',agencyId:op.agencyId,uid:user.uid,operationId:op.id};
   const attempt={createdAtMs:now(),number:(current.checkoutAttempt?.number||0)+1,callbackSignature,body:{mode:'subscription',customer:customer.id,client_reference_id:user.uid,line_items:[{price:op.currentPrice.id,quantity:1}],payment_method_types:['card','link'],success_url:returns.returnUrl+(returns.returnUrl.includes('?')?'&':'?')+'session_id={CHECKOUT_SESSION_ID}',cancel_url:returns.cancelUrl,metadata,subscription_data:{metadata},expires_at:Math.floor(now()/1000)+1800}};
   if(attempt.number>10)packError('Trop de reprises de paiement. Annulez cette préparation puis recommencez.',409);
   await write(op.id,state=>{Object.assign(state.agencyPackOperations[op.id],{checkoutAttempt:attempt,checkoutId:null});});
   const result=await api('checkout/sessions',{method:'POST',idempotencyKey:'agency-checkout-'+op.id+'-'+attempt.number,body:attempt.body});
   await storeSession(result,attempt);return {ok:true,id:result.id,approvalUrl:result.url,paymentProvider:'stripe'};
  });
 }
 async function completeSession(id,uid=''){
  const s=await read(),op=Object.values(s.agencyPackOperations||{}).find(o=>o.checkoutId===id);
  if(!op||uid&&op.ownerUid!==uid)packError('Paiement du pack introuvable.',404);
  const session=await api('checkout/sessions/'+encodeURIComponent(id)),meta=session.metadata||{};
  if(session.livemode!==live||session.customer!==op.customerId||meta.app!=='shenpulse'||meta.kind!=='agency_pack'||meta.uid!==op.ownerUid||meta.agencyId!==op.agencyId||meta.operationId!==op.id||session.mode!=='subscription'||session.amount_total!==op.plan.monthlyCents||session.currency!=='eur')packError('Le paiement reçu ne correspond pas à ce pack.',409);
  if(session.status!=='complete'||!['paid','no_payment_required'].includes(session.payment_status))return {ok:true,pending:session.status!=='expired',cancelled:session.status==='expired'};
  const subscriptionId=idOf(session.subscription);if(!/^sub_[a-zA-Z0-9]+$/.test(subscriptionId))packError('Contrat de paiement invalide.',409);
  await write(op.id,state=>{const c=state.agencyPackContracts[op.agencyId];if(c.pending!==op.id&&c.subscriptionId!==subscriptionId)packError('Cette souscription a été remplacée.',409);c.subscriptionId=subscriptionId;});
  await lifecycle.reconcile(op.agencyId);return {ok:true,checkoutCompleted:true};
 }
 async function sync(request,body={}){
  const user=await authenticate(request);
  if(body.sessionId)return completeSession(String(body.sessionId),user.uid);
  await lifecycle.refreshOwner(user.uid,true);return {ok:true};
 }
 async function abandon(request,body={}){
  const user=await authenticate(request),s=await read(),op=Object.values(s.agencyPackOperations||{}).find(o=>o.checkoutId===body.sessionId&&o.ownerUid===user.uid);
  if(!op)packError('Paiement introuvable.',404);
  const result=await completeSession(op.checkoutId,user.uid);if(result.checkoutCompleted)return result;
  const session=await api('checkout/sessions/'+op.checkoutId);if(session.status==='open')await api('checkout/sessions/'+op.checkoutId+'/expire',{method:'POST',idempotencyKey:'agency-expire-'+op.id});
  await write(op.id,state=>{state.agencyPackOperations[op.id].status='cancelled';const c=state.agencyPackContracts[op.agencyId];if(c.pending===op.id)c.pending=null;});return {ok:true,cancelled:true};
 }
 async function applyChange(request,body={}){
  const user=await authenticate(request),op=await claim(user,body,'change');
  return serial(op.agencyId,async()=>{
   const s=await read(),c=s.agencyPackContracts[op.agencyId],sub=await lifecycle.verifiedSubscription(c);
   if(sub.pending_update)packError('Un paiement de modification est encore en attente.',409);
   if(idOf(sub.schedule))await api('subscription_schedules/'+idOf(sub.schedule)+'/release',{method:'POST',idempotencyKey:'agency-release-'+op.id});
   await write(op.id,state=>{const contract=state.agencyPackContracts[op.agencyId];contract.prices={...contract.prices,[op.currentPrice.id]:op.currentPrice,[op.nextPrice.id]:op.nextPrice};});
   const updated=await api('subscriptions/'+sub.id,{method:'POST',idempotencyKey:'agency-change-'+op.id,body:{items:[{id:sub.items.data[0].id,price:op.currentPrice.id,quantity:1}],payment_behavior:'pending_if_incomplete',proration_behavior:'always_invoice',proration_date:op.prorationDate,expand:['latest_invoice']}});
   return {ok:true,pending:!!updated.pending_update,invoiceUrl:updated.pending_update?updated.latest_invoice?.hosted_invoice_url||'':'',needsRefresh:true};
  }).then(async result=>{await lifecycle.reconcile(op.agencyId);return result;});
 }
 async function cancelPending(request,body={}){
  const user=await authenticate(request),s=await read(),a=owner(s,user.uid),c=s.agencyPackContracts?.[a.id];
  if(!c?.pending)packError('Aucune modification en attente.',409);revision(c,body);
  const op=s.agencyPackOperations?.[c.pending];
  if(op?.kind==='checkout'){
   let sessionId=op.checkoutId;
   if(!sessionId&&op.checkoutAttempt){const result=await recoverCheckout(op);sessionId=result?.id;if(result)await write(a.id,state=>{Object.assign(state.agencyPackOperations[op.id],{checkoutId:sessionId,customerId:op.checkoutAttempt.body.customer});Object.assign(state.agencyPackContracts[a.id],{customerId:op.checkoutAttempt.body.customer,prices:{[op.currentPrice.id]:op.currentPrice,[op.nextPrice.id]:op.nextPrice}});});}
   if(sessionId)return abandon(request,{sessionId});
   await write(a.id,state=>{state.agencyPackContracts[a.id].pending=null;state.agencyPackOperations[op.id].status='cancelled';});return {ok:true,cancelled:true};
  }
  const sub=await lifecycle.verifiedSubscription(c),invoice=typeof sub.latest_invoice==='object'?sub.latest_invoice:await api('invoices/'+sub.latest_invoice);
  if(invoice.status==='paid'&&sub.items.data[0].price.id===op.currentPrice.id){await lifecycle.reconcile(a.id);return {ok:true,alreadyApplied:true};}
  if(sub.pending_update&&invoice.status==='open')await api('invoices/'+invoice.id+'/void',{method:'POST',idempotencyKey:'agency-void-'+op.id});
  await write(a.id,state=>{const current=state.agencyPackContracts[a.id];if(current.pending===op.id){current.pending=null;current.revision++;state.agencyPackOperations[op.id].status='cancelled';}});return {ok:true};
 }
 async function cancel(request,body={},resume=false){
  const user=await authenticate(request),s=await read(),a=owner(s,user.uid),c=s.agencyPackContracts?.[a.id];
  if(!c?.subscriptionId)packError('Aucun contrat à gérer.',404);revision(c,body);
  if(c.pending)packError('Terminez ou annulez la modification en attente avant de changer le renouvellement.',409);
  if(resume&&a.status!=='approved')packError('Une agence suspendue ne peut pas réactiver un contrat.',409);
  await serial(a.id,async()=>{const sub=await lifecycle.verifiedSubscription(c);if(idOf(sub.schedule))await api('subscription_schedules/'+idOf(sub.schedule)+'/release',{method:'POST',idempotencyKey:'agency-cancel-schedule-'+a.id+'-'+c.revision});await api('subscriptions/'+sub.id,{method:'POST',idempotencyKey:'agency-renew-'+a.id+'-'+c.revision+'-'+resume,body:{cancel_at_period_end:!resume}});});
  await lifecycle.reconcile(a.id);return {ok:true};
 }
 async function portal(request){
  const user=await authenticate(request),s=await read(),a=owner(s,user.uid),c=s.agencyPackContracts?.[a.id];
  if(!c?.customerId)packError('Aucune facturation à consulter.',404);
  const config=await api('billing_portal/configurations',{method:'POST',idempotencyKey:'agency-portal-v1',body:{business_profile:{headline:'Facturation de votre agence ShenPulse'},features:{payment_method_update:{enabled:true},invoice_history:{enabled:true}}}});
  const session=await api('billing_portal/sessions',{method:'POST',body:{customer:c.customerId,configuration:config.id,return_url:'https://shenpulse.leuridan.fr'}});return {ok:true,approvalUrl:session.url};
 }
 return {ready,view,preview,checkout,sync,abandon,applyChange,cancelPending,cancel,resume:(r,b)=>cancel(r,b,true),portal,...lifecycle,completeSession,reserveSeats,
  async assertPersonalAllowed(uid){const state=await read(),id=state.memberships?.[uid]?.agencyId,c=state.agencyPackContracts?.[id],planned=c?.status==='active'&&!c.cancelAtPeriodEnd&&Date.parse(c.paidThrough||'')>now()&&c.nextSeats?.some(row=>row.uid===uid);if(planned||await lifecycle.entitlement(uid))packError('Votre accès est pris en charge ou réservé par votre agence. Retirez cette prise en charge avant de souscrire personnellement.',409);}
 };
}
