import {randomUUID} from 'node:crypto';
import {packError,packKey,normalizeAgencyPack,normalizePackSeats,quoteAgencyPack,estimatePackProration} from './pack-policy.mjs';
/** Offre commerciale uniquement : aucun appel à un fournisseur de paiement ou aux droits. */
export function createAgencyPackService({read,mutate,authenticate,requireAdmin,now=Date.now}){
 let billing=null;
 const stamp=()=>new Date(now()).toISOString();
 const find=(s,id)=>{const p=s.agencyPacks?.[packKey(id)];if(!p)packError('Pack introuvable.',404);return p;};
 const agency=(s,id)=>{const a=s.agencies[packKey(id)];if(!a)packError('Agence introuvable.',404);return a;};
 const revision=(current,expected)=>{if(!Number.isSafeInteger(expected)||expected!==(current?.revision||0))packError('Cette fiche a changé. Actualisez avant de l’enregistrer.',409);};
 const validateSeats=(s,a,p,seats)=>{
   if(a.status!=='approved')packError('Attribuez les packs uniquement à une agence validée.',409);
   for(const row of seats){
     const m=s.memberships[row.uid];
     if(m?.status!=='approved'||m.agencyId!==a.id)packError('Chaque créateur doit être un membre validé de cette agence.',409);
     if(p.prices[row.tier]==null)packError('Ce pack ne propose pas la formule '+row.tier+'.');
   }
   if(p.maximumCreators!=null&&seats.length>p.maximumCreators)packError('Le nombre maximum de créateurs est dépassé.');
 };
 const ownOffer=(s,uid)=>{
   const a=Object.values(s.agencies).find(item=>item.ownerUid===uid&&item.status==='approved');
   if(!a)packError('Cet espace est réservé au fondateur d’une agence validée.',403);
   const assignment=s.agencyPackAssignments?.[a.id],pack=assignment&&s.agencyPacks?.[assignment.packId];
   if(!pack||pack.status!=='enabled')packError('Aucune offre groupée disponible pour votre agence.',404);
   return {a,assignment,pack};
 };
 const publicTerms=p=>Object.fromEntries(['id','title','revision','minimumCreators','maximumCreators','prices','belowMinimum','additions','removals','validFrom','validUntil','currency','interval'].map(k=>[k,p[k]??null]));
 const ownSnapshot=(s,uid)=>{
   const a=Object.values(s.agencies).find(item=>item.ownerUid===uid&&item.status==='approved');
   if(!a)return {};
   const assignment=s.agencyPackAssignments?.[a.id],proposed=assignment&&s.agencyPacks?.[assignment.packId],contract=s.agencyPackContracts?.[a.id],p=proposed?.status==='enabled'?proposed:contract?.subscriptionId&&contract.terms?contract.terms:null;
   return {directorPacksAvailable:true,packBillingAvailable:!!billing?.ready,agencyPack:p?{
     terms:publicTerms(p),revision:assignment?.revision||0,seats:assignment?.seats||contract?.nextSeats||[],updatedAt:assignment?.updatedAt||'',
     status:'prepared',billing:billing?.view(s,a.id)||null,quote:quoteAgencyPack(p,assignment?.seats||[],a,s,now())
   }:null};
 };
 const checkOwnRevision=(assignment,p,body)=>{revision(assignment,body.expectedRevision);revision(p,body.expectedPackRevision);};
 const snapshot=s=>({
   packsAvailable:true,packBillingAvailable:!!billing?.ready,
   agencyPacks:Object.values(s.agencyPacks||{}).sort((a,b)=>a.title.localeCompare(b.title)||a.id.localeCompare(b.id)),
   agencyPackAssignments:Object.values(s.agencyPackAssignments||{}).map(a=>{
     const pack=s.agencyPacks?.[a.packId],owner=s.agencies[a.agencyId];
     return {...a,billing:billing?.view(s,a.agencyId)||null,quote:pack&&owner?quoteAgencyPack(pack,a.seats,owner,s,now()):null};
   })
 });
 return {
   snapshot,ownSnapshot,
   setBilling(value){billing=value;},
   async previewOwn(request,body){
     const user=await authenticate(request),s=await read(),{a,assignment,pack}=ownOffer(s,user.uid);
     checkOwnRevision(assignment,pack,body);
     const seats=normalizePackSeats(body.seats);validateSeats(s,a,pack,seats);
     return {ok:true,quote:quoteAgencyPack(pack,seats,a,s,now()),simulation:true,proration:null};
   },
   async selectOwn(request,body){
     const user=await authenticate(request),seats=normalizePackSeats(body.seats);
     return mutate(user,'pack.selection',user.uid,s=>{
       const {a,assignment,pack}=ownOffer(s,user.uid);checkOwnRevision(assignment,pack,body);validateSeats(s,a,pack,seats);
       const quote=quoteAgencyPack(pack,seats,a,s,now());
       if(quote.reasons.includes('Hors période de validité'))packError('Cette offre n’est plus dans sa période de validité.',409);
       s.agencyPackAssignments[a.id]={...assignment,seats,termsSnapshot:structuredClone(pack),revision:assignment.revision+1,updatedAt:stamp(),updatedBy:user.uid,status:'prepared'};
     });
   },
   async save(request,body){
     const user=await requireAdmin(request),fields=normalizeAgencyPack(body),id=body.id?packKey(body.id):randomUUID();
     const result=await mutate(user,'pack.save',id,s=>{
       s.agencyPacks||={};const current=s.agencyPacks[id];
       if(body.id&&!current)packError('Pack introuvable.',404);
       revision(current,body.expectedRevision);
       if(!current&&Object.keys(s.agencyPacks).length>=200)packError('Limite de 200 packs atteinte.',409);
       if(current?.status==='archived'&&fields.status!=='archived')packError('Un pack archivé doit être dupliqué pour être réutilisé.',409);
       s.agencyPacks[id]={...fields,id,revision:(current?.revision||0)+1,createdAt:current?.createdAt||stamp(),createdBy:current?.createdBy||user.uid,updatedAt:stamp(),updatedBy:user.uid};
     });
     return {...result,id};
   },
   async archive(request,body){
     const user=await requireAdmin(request);
     return mutate(user,'pack.archive',packKey(body.id),s=>{
       const current=find(s,body.id);revision(current,body.expectedRevision);
       s.agencyPacks[current.id]={...current,status:'archived',revision:current.revision+1,updatedAt:stamp(),updatedBy:user.uid};
     });
   },
   async assign(request,body){
     const user=await requireAdmin(request),seats=normalizePackSeats(body.seats);
     return mutate(user,'pack.assign',packKey(body.agencyId),s=>{
       const a=agency(s,body.agencyId),p=find(s,body.packId);
       revision(p,body.expectedPackRevision);
       if(p.status==='archived')packError('Un pack archivé ne peut plus être attribué.',409);
       s.agencyPackAssignments||={};const current=s.agencyPackAssignments[a.id];
       revision(current,body.expectedRevision);validateSeats(s,a,p,seats);
       s.agencyPackAssignments[a.id]={agencyId:a.id,packId:p.id,seats,termsSnapshot:structuredClone(p),revision:(current?.revision||0)+1,createdAt:current?.createdAt||stamp(),updatedAt:stamp(),updatedBy:user.uid,status:'prepared'};
     });
   },
   async unassign(request,body){
     const user=await requireAdmin(request);
     return mutate(user,'pack.unassign',packKey(body.agencyId),s=>{
       const current=s.agencyPackAssignments?.[body.agencyId];if(!current)packError('Attribution introuvable.',404);
       revision(current,body.expectedRevision);
       const contract=s.agencyPackContracts?.[body.agencyId];
       if(contract?.subscriptionId&&!['canceled','incomplete_expired'].includes(contract.stripeStatus))packError('Arrêtez le renouvellement du contrat et attendez sa fin avant de retirer l’attribution.',409);
       delete s.agencyPackAssignments[body.agencyId];
     });
   },
   async preview(request,body){
     await requireAdmin(request);
     const s=await read(),a=agency(s,body.agencyId),p=body.draft?normalizeAgencyPack(body.draft):find(s,body.packId),seats=normalizePackSeats(body.seats);
     validateSeats(s,a,p,seats);
     const quote=quoteAgencyPack(p,seats,a,s,now());
     const previous=s.agencyPackAssignments?.[a.id],oldPack=previous&&(previous.termsSnapshot||s.agencyPacks?.[previous.packId]);
     const before=oldPack?quoteAgencyPack(oldPack,previous.seats,a,s,now()).effectiveMonthlyCents:0;
     const estimated=estimatePackProration(p,before,quote.effectiveMonthlyCents,body.period,now());
     return {ok:true,quote,proration:previous?estimated:null,simulation:true};
   }
 };
}
