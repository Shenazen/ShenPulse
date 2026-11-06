/** Politique des offres groupées. Montants en centimes, sans effet de paiement. */
export const PACK_STATUSES = ['draft','enabled','archived'];
export const PACK_LIMIT = 1000;
export function packError(message,statusCode=400){throw Object.assign(new Error(message),{statusCode});}
export function packKey(value){
  if(typeof value!=='string'||!value||value.length>128||/[.#$/[\]\\]/.test(value)||['__proto__','constructor','prototype'].includes(value))packError('Identifiant de pack ou d’agence invalide.');
  return value;
}
function integer(value,min,max,label){
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)packError(label+' invalide.');
  return value;
}
function date(value,label){
  if(value===''||value==null)return '';
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)packError(label+' invalide.');
  return value;
}
export function normalizeAgencyPack(body={}){
  const title=String(body.title||'').trim(),notes=String(body.notes||'').trim();
  if(title.length<2||title.length>80||notes.length>1500)packError('Renseignez un nom de 2 à 80 caractères et des notes de 1 500 caractères maximum.');
  const minimumCreators=integer(body.minimumCreators,1,PACK_LIMIT,'Nombre minimum');
  const maximumCreators=body.maximumCreators==null?null:integer(body.maximumCreators,minimumCreators,PACK_LIMIT,'Nombre maximum');
  const prices={};
  for(const tier of ['pro','premium'])prices[tier]=body.prices?.[tier]==null?null:integer(body.prices[tier],1,1000000,'Tarif '+tier);
  if(prices.pro==null&&prices.premium==null)packError('Renseignez au moins un tarif Pro ou Premium.');
  const status=body.status||'draft',belowMinimum=body.belowMinimum||'block',additions=body.additions||'prorata',removals=body.removals||'renewal';
  if(!PACK_STATUSES.includes(status)||!['block','standard'].includes(belowMinimum)||!['prorata','renewal'].includes(additions)||!['renewal','credit'].includes(removals))packError('Règles commerciales invalides.');
  const validFrom=date(body.validFrom,'Date de début'),validUntil=date(body.validUntil,'Date de fin');
  if(validFrom&&validUntil&&validFrom>validUntil)packError('La date de fin doit suivre la date de début.');
  return {title,notes,minimumCreators,maximumCreators,prices,status,belowMinimum,additions,removals,validFrom,validUntil,currency:'EUR',interval:'month',countsAfterPayment:true};
}
export function normalizePackSeats(value){
  if(!Array.isArray(value)||value.length>PACK_LIMIT)packError('Sélectionnez au maximum '+PACK_LIMIT+' créateurs.');
  const seen=new Set();
  return value.map(row=>{
    const uid=packKey(row?.uid);
    if(seen.has(uid))packError('Un créateur ne peut être sélectionné qu’une seule fois.');
    seen.add(uid);
    if(!['pro','premium'].includes(row.tier))packError('Formule créateur invalide.');
    return {uid,tier:row.tier};
  });
}
export function quoteAgencyPack(pack,seats,agency,program,at=Date.now()){
  const excluded=[],eligible=(Array.isArray(seats)?seats:[]).filter(seat=>{
    const member=program.memberships?.[seat.uid];
    const allowed=member?.status==='approved'&&member.agencyId===agency.id&&pack.prices[seat.tier]!=null;
    if(!allowed)excluded.push(seat.uid);
    return allowed;
  });
  const minimumReached=eligible.length>=pack.minimumCreators;
  const inDate=(!pack.validFrom||at>=Date.parse(pack.validFrom+'T00:00:00Z'))&&(!pack.validUntil||at<Date.parse(pack.validUntil+'T00:00:00Z')+86400000);
  const standardPrices={pro:999,premium:1399};
  const standardMonthlyCents=eligible.reduce((sum,row)=>sum+standardPrices[row.tier],0);
  const negotiatedMonthlyCents=eligible.reduce((sum,row)=>sum+pack.prices[row.tier],0);
  const reasons=[];
  if(!eligible.length)reasons.push('Aucun créateur sélectionné');
  if(pack.status!=='enabled')reasons.push(pack.status==='archived'?'Pack archivé':'Pack en brouillon');
  if(agency.status!=='approved')reasons.push('Agence non validée');
  if(!inDate)reasons.push('Hors période de validité');
  if(excluded.length)reasons.push(excluded.length+' compte(s) absent(s), retiré(s) ou formule indisponible');
  if(pack.maximumCreators!=null&&eligible.length>pack.maximumCreators)reasons.push('Nombre maximum dépassé');
  if(!minimumReached&&pack.belowMinimum==='block')reasons.push('Minimum de créateurs non atteint');
  const standard=!minimumReached&&pack.belowMinimum==='standard';
  return {eligibleCreators:eligible.length,excludedUids:excluded,missingCreators:Math.max(0,pack.minimumCreators-eligible.length),minimumReached,ready:reasons.length===0,reasons,
    proCreators:eligible.filter(s=>s.tier==='pro').length,premiumCreators:eligible.filter(s=>s.tier==='premium').length,
    negotiatedMonthlyCents,standardMonthlyCents,effectiveMonthlyCents:standard?standardMonthlyCents:negotiatedMonthlyCents,usesStandardRate:standard,
    savingsMonthlyCents:standard?0:standardMonthlyCents-negotiatedMonthlyCents,paymentActive:false,countsAsActive:false};
}
/** Estimation par seconde de la période restante ; jamais une facture ni un remboursement. */
export function estimatePackProration(pack,previousCents,nextCents,period,at=Date.now()){
  if(!period)return null;
  const start=Date.parse(period.start),end=Date.parse(period.end);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>366*86400000||at<start||at>end)packError('La date de simulation doit être comprise dans une période de facturation valide.');
  integer(previousCents,0,1000000000,'Montant précédent');integer(nextCents,0,1000000000,'Nouveau montant');
  const ratio=(end-at)/(end-start),delta=nextCents-previousCents;
  const immediate=delta>0?pack.additions==='prorata':pack.removals==='credit';
  return {remainingRatio:ratio,adjustmentCents:immediate?Math.round(delta*ratio):0,nextMonthlyCents:nextCents,previousMonthlyCents:previousCents,kind:delta<0?'credit':'charge',simulation:true};
}
