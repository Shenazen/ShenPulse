import {packError,normalizePackSeats,quoteAgencyPack} from './pack-policy.mjs';
export const idOf=v=>typeof v==='string'?v:v?.id||'';
export const paidPersonal=(s,at)=>s?.status==='active'&&['pro','premium'].includes(s.tier)&&!!(s.paypalSubscriptionId||s.stripeSubscriptionId)&&(!s.renewalDate||Date.parse(s.renewalDate)>at);
export const sameSeats=(a=[],b=[])=>JSON.stringify([...a].sort((x,y)=>x.uid.localeCompare(y.uid)))===JSON.stringify([...b].sort((x,y)=>x.uid.localeCompare(y.uid)));
export function ownPack(s,uid){
 const agency=Object.values(s.agencies||{}).find(a=>a.ownerUid===uid&&a.status==='approved');
 if(!agency)packError('Cet espace est réservé au fondateur d’une agence validée.',403);
 const assignment=s.agencyPackAssignments?.[agency.id],terms=assignment&&s.agencyPacks?.[assignment.packId];
 if(!terms||terms.status!=='enabled')packError('Aucun pack disponible pour votre agence.',409);
 return {agency,assignment,terms,contract:s.agencyPackContracts?.[agency.id]||null};
}
export function selectionPlan(s,context,at){
 const {agency,assignment,terms,contract}=context,target=normalizePackSeats(assignment.seats||[]),quote=quoteAgencyPack(terms,target,agency,s,at);
 if(!quote.ready)packError(quote.reasons.join(' · '),409);
 const previous=new Map((contract?.paidSeats||[]).map(row=>[row.uid,row])),desired=new Map(target.map(row=>[row.uid,row])),immediate=[];
 for(const [uid,row] of previous){
  const next=desired.get(uid);
  if(!next){if(terms.removals==='renewal')immediate.push(row);continue;}
  const oldCost=contract?.terms?.prices?.[row.tier]||0,newCost=terms.prices[next.tier];
  immediate.push(newCost>oldCost&&terms.additions==='renewal'||newCost<oldCost&&terms.removals==='renewal'?row:next);
 }
 for(const row of target)if(!previous.has(row.uid)&&(!contract||terms.additions==='prorata'))immediate.push(row);
 const currentSeats=contract?immediate:target;
 const currentQuote=quoteAgencyPack(terms,currentSeats,agency,s,at);
 return {agencyId:agency.id,packId:terms.id,terms:structuredClone(terms),assignmentRevision:assignment.revision,packRevision:terms.revision,targetSeats:target,currentSeats,monthlyCents:currentQuote.effectiveMonthlyCents,nextMonthlyCents:quote.effectiveMonthlyCents,deferred:!sameSeats(currentSeats,target),quote};
}
export function billingView(s,agencyId,ready){
 const c=s.agencyPackContracts?.[agencyId];
 if(!c)return {available:ready,status:'none'};
 return {available:ready,status:c.status||'pending',paidThrough:c.paidThrough||'',periodStart:c.periodStart||'',monthlyCents:c.monthlyCents||0,nextMonthlyCents:c.nextMonthlyCents??c.monthlyCents??0,paidCreators:(c.paidSeats||[]).length,nextCreators:(c.nextSeats||[]).length,cancelAtPeriodEnd:!!c.cancelAtPeriodEnd,revision:c.revision||0,pending:!!c.pending,pendingPreviewId:c.pending||'',pendingKind:s.agencyPackOperations?.[c.pending]?.kind||'',notice:c.notice||'',lastInvoiceUrl:c.lastInvoiceUrl||''};
}
