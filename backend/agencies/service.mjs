import { randomBytes, randomUUID } from 'node:crypto';
export const AGENCY_PATH = 'serverOnly/agencyProgram';
export const AGENCY_CHECKOUT_PATH = 'serverOnly/agencyCheckouts';
export const AGENCY_PRICES = { public: { pro: 14.99, premium: 20.99 }, agency: { pro: 9.99, premium: 13.99 } };
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const clean = (v, max = 160) => String(v || '').trim().slice(0, max);
const key = v => { const text = clean(v); if (!text || /[.#$/[\]\\]/.test(text)) fail('Identifiant invalide.'); return text; };
const empty = v => ({ agencies: {}, memberships: {}, checkouts: {}, audit: {}, ...v });
const activePaid = (s,at=Date.now()) => s?.status === 'active' && ((s?.paymentProvider === 'paypal' && !!s?.paypalSubscriptionId) || (s?.paymentProvider === 'stripe' && !!s?.stripeSubscriptionId)) && ['pro','premium'].includes(s?.tier) && Number(s?.priceMonthly) > 0 && (!s.renewalDate || Date.parse(s.renewalDate) > at);
function countingStatus(sub,trial,at) {
  if(activePaid(sub,at))return {counted:true,paid:true,tier:sub.tier,source:sub.paymentProvider};
  // Seul un essai encore actif et explicitement sélectionné par l'administrateur compte.
  const expiresAtMs=Number(trial?.expiresAtMs || Date.parse(trial?.expiresAt || ''));
  const allowed=trial?.countsForAgency===true && trial.source==='trial' && ['pro','premium'].includes(trial.tier) && Number.isFinite(expiresAtMs) && expiresAtMs>at;
  return allowed?{counted:true,paid:false,tier:trial.tier,source:'trial',expiresAtMs}:{counted:false,paid:false,tier:'free',source:'none'};
}
export function agencyUrl(v) {
  if (!v) return '';
  let u; try { u = new URL(String(v)); } catch { fail('Adresse HTTPS invalide.'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.href.length > 1500) fail('Adresse HTTPS invalide.');
  return u.href;
}
function profile(b) {
  const name = clean(b.name,80), description = clean(b.description,600);
  if (name.length < 2 || description.length < 10) fail('Renseignez un nom et une présentation de 10 caractères minimum.');
  return {name,description,logoUrl:agencyUrl(b.logoUrl),bannerUrl:agencyUrl(b.bannerUrl),instagram:agencyUrl(b.instagram),website:agencyUrl(b.website),discord:agencyUrl(b.discord),tiktok:agencyUrl(b.tiktok),language:clean(b.language || 'fr',10)};
}
function memberUsername(body) {
  const username=clean(body.tiktokUsername,80).replace(/^@+/,'').toLowerCase();
  if(username && !/^[a-z0-9._]{1,30}$/.test(username))fail('Pseudo TikTok invalide.');
  return username;
}
const publicAgency = a => Object.fromEntries(['id','name','description','logoUrl','bannerUrl','instagram','website','discord','tiktok','language'].map(k=>[k,a[k] || '']));
export function quoteAgencyPrices(raw, uid, sub = {}) {
  const s=empty(raw), m=s.memberships[uid], a=m?.status==='approved' && s.agencies[m.agencyId];
  const eligible=a?.status==='approved';
  const legacy=activePaid(sub) && (!sub.agencyProgramGroup && Math.round(Number(sub.priceMonthly)*100)===Math.round(AGENCY_PRICES.agency[sub.tier]*100) || sub.agencyProgramGroup==='legacy');
  const group=eligible?'agency':legacy?'legacy':'public';
  return {...AGENCY_PRICES, quoted:{...AGENCY_PRICES[group==='public'?'public':'agency']},group,agencyId:eligible?a.id:'',agencyName:eligible?a.name:'',eligible,commissionsEnabled:false,currentPrice:activePaid(sub)?Number(sub.priceMonthly):0};
}
/** Autorité côté serveur ; une seule transaction protège l'adhésion à une agence unique. */
export function createAgencyService({db,authenticate,requireAdmin,subscription,trial=async()=>null,now=Date.now}) {
  const ref=()=>db().ref(AGENCY_PATH), read=async()=>empty((await ref().get()).val() || {}), stamp=()=>new Date(now()).toISOString();
  const memberCountingStatus=async uid=>{
    const sub=await subscription(uid),at=now();
    return countingStatus(sub,activePaid(sub,at)?null:await trial(uid),at);
  };
  let directoryCache=null,directoryPending=null,revision=0;
  const directoryStats=async()=>{
    if(directoryCache && directoryCache.revision===revision && now()<directoryCache.validUntil)return directoryCache.value;
    if(directoryPending?.revision===revision)return directoryPending.promise;
    const version=revision,promise=(async()=>{
      const s=await read(),entries=Object.entries(s.memberships).filter(([,m])=>m.status==='approved' && s.agencies[m.agencyId]?.status==='approved');
      if(entries.length>20000)fail('Annuaire temporairement indisponible.',503);
      const counts={};let validUntil=now()+30000;
      for(let i=0;i<entries.length;i+=20)await Promise.all(entries.slice(i,i+20).map(async([uid,m])=>{
        const status=await memberCountingStatus(uid);
        if(status.counted){counts[m.agencyId]=(counts[m.agencyId] || 0)+1;if(status.expiresAtMs)validUntil=Math.min(validUntil,status.expiresAtMs);}
      }));
      const agencies=Object.values(s.agencies).filter(a=>a.status==='approved').map(a=>{
        const payingCount=counts[a.id] || 0;
        return {...publicAgency(a),payingCount,level:payingCount>=25?'diamond':payingCount>=10?'gold':payingCount>=3?'silver':''};
      }).filter(a=>a.payingCount>=3).sort((a,b)=>({diamond:3,gold:2,silver:1}[b.level]-{diamond:3,gold:2,silver:1}[a.level]) || b.payingCount-a.payingCount || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      const day=Math.floor(now()/86400000),select=level=>{
        const candidates=agencies.filter(a=>level==='home'?a.level==='diamond':a.level!=='silver').sort((a,b)=>a.id.localeCompare(b.id));
        return candidates.length?candidates[day%candidates.length].id:'';
      };
      const value={ok:true,agencies,featuredAgencyId:select('day'),homeAgencyId:select('home'),prices:AGENCY_PRICES,commissionsEnabled:false};
      if(version===revision)directoryCache={value,revision:version,validUntil};
      return value;
    })();
    directoryPending={revision:version,promise};
    try{return await promise;}finally{if(directoryPending?.promise===promise)directoryPending=null;}
  };
  const mutate=async(user,action,target,operation)=>{
    const reference=ref(),hold=()=>{};
    reference.on('value',hold);
    try {
    // RTDB peut présenter null au premier callback sans écoute active, même si la branche existe.
    await reference.once('value');
    let problem;
    const result=await reference.transaction(raw=>{
      const s=empty(raw || {});
      try {operation(s);s.audit=Object.fromEntries(Object.entries(s.audit || {}).slice(-199));s.audit[randomUUID()]={actor:user.uid,action,target,at:stamp()};return s;}
      catch(e){problem=e;return undefined;}
    });
    if(!result.committed) throw problem || Object.assign(new Error('Modification interrompue. Réessayez.'),{statusCode:409});
    revision++;directoryCache=null;
    return {ok:true};
    } finally { reference.off('value',hold); }
  };
  const service={
    publicList:directoryStats,
    invalidateDirectoryCache(){revision++;directoryCache=null;},
    async directorReward(uid,current={}){
      if(activePaid(current,now()))return null;
      const s=await read(),own=Object.values(s.agencies).find(a=>a.ownerUid===uid && a.status==='approved');
      if(!own)return null;
      const a=(await directoryStats()).agencies.find(a=>a.id===own.id && a.level==='diamond');
      if(!a)return null;
      const expiresAtMs=now()+15*60*1000;
      return {source:'agencyReward',tier:'pro',priceMonthly:0,expiresAtMs,expiresAt:new Date(expiresAtMs).toISOString()};
    },
    async invitation(code){const s=await read(),a=Object.values(s.agencies).find(a=>a.status==='approved' && a.code===clean(code,30).toUpperCase());if(!a)fail('Invitation introuvable.',404);return publicAgency(a);},
    async quote(uid,current){return quoteAgencyPrices(await read(),uid,current || await subscription(uid));},
    async dashboard(request,admin=false){
      const u=admin?await requireAdmin(request):await authenticate(request),s=await read(),own=Object.values(s.agencies).find(a=>a.ownerUid===u.uid);
      const visible=admin?Object.values(s.agencies):own?[own]:[],entries=Object.entries(s.memberships).filter(([,m])=>visible.some(a=>a.id===m.agencyId));
      if(entries.length>2000)fail('Liste trop importante. Contactez ShenPulse.',409);
      const members=[];
      for(let i=0;i<entries.length;i+=20)members.push(...await Promise.all(entries.slice(i,i+20).map(async([uid,m])=>{
        const status=await memberCountingStatus(uid);
        return {uid,...m,paying:status.counted,tier:status.tier,paidSubscription:status.paid,countingSource:status.source};
      })));
      return {ok:true,uid:u.uid,...(admin?{admin:true,allAgencies:visible,audit:Object.values(s.audit || {}).slice(-100)}:{}),ownAgency:own || null,membership:s.memberships[u.uid] || null,members,pricing:await service.quote(u.uid),commissionsEnabled:false};
    },
    async save(request,body){
      const u=await authenticate(request),fields=profile(body);
      if(!u.emailVerified)fail('Vérifiez votre adresse e-mail avant de créer une agence.',403);
      const id=randomUUID(),code=randomBytes(9).toString('hex').toUpperCase();
      return mutate(u,'agency.save',id,s=>{
        const own=Object.values(s.agencies).find(a=>a.ownerUid===u.uid);
        if(!own && Object.keys(s.agencies).length>=1000)fail('Capacité du programme atteinte.',409);
        const agencyId=own?.id || id;
        s.agencies[agencyId]={...(own || {}),...fields,id:agencyId,ownerUid:u.uid,contactEmail:u.email,code:own?.code || code,status:own?.status || 'pending',createdAt:own?.createdAt || stamp(),updatedAt:stamp()};
      });
    },
    async join(request,body){
      const u=await authenticate(request),username=memberUsername(body);
      return mutate(u,'membership.request',u.uid,s=>{
        const code=clean(body.code,30).toUpperCase(),a=Object.values(s.agencies).find(a=>a.status==='approved' && (code?a.code===code:a.id===clean(body.agencyId)));
        if(!a)fail('Agence ou code introuvable. Vérifiez que l’agence est validée.',404);
        if(['pending','approved'].includes(s.memberships[u.uid]?.status))fail('Vous avez déjà une demande ou une adhésion. Quittez-la avant de changer d’agence.',409);
        s.memberships[u.uid]={agencyId:a.id,agencyName:a.name,status:'pending',displayName:username?'@'+username:clean(body.displayName || u.email.split('@')[0],80),...(username?{tiktokUsername:username}:{}),email:u.email,requestedAt:stamp(),updatedAt:stamp()};
      });
    },
    async rotateCode(request,body){
      const u=await authenticate(request);
      return mutate(u,'agency.invitation.rotate',u.uid,s=>{
        const a=Object.values(s.agencies).find(a=>a.ownerUid===u.uid);
        if(!a || a.status!=='approved')fail('Seul le fondateur d’une agence validée peut régénérer son code.',403);
        if(!body.expectedCode || clean(body.expectedCode,30).toUpperCase()!==a.code)fail('Le code a déjà changé. Actualisez votre agence avant de réessayer.',409);
        let code;
        do {code=randomBytes(9).toString('hex').toUpperCase();} while(Object.values(s.agencies).some(other=>other.code===code));
        s.agencies[a.id]={...a,code,updatedAt:stamp()};
      });
    },
    async updateIdentity(request,body){
      const u=await authenticate(request),username=memberUsername(body);
      if(!username)fail('Renseignez votre @ TikTok.');
      const prior=(await read()).memberships[u.uid];
      if(!prior || !['pending','approved'].includes(prior.status) || prior.tiktokUsername===username)return {ok:true,updated:false};
      let updated=false;
      const result=await mutate(u,'membership.identity',u.uid,s=>{
        updated=false;
        const member=s.memberships[u.uid];
        if(!member || !['pending','approved'].includes(member.status))return;
        s.memberships[u.uid]={...member,tiktokUsername:username,displayName:'@'+username,updatedAt:stamp()};
        updated=true;
      });
      return {...result,updated};
    },
    async leave(request){const u=await authenticate(request);return mutate(u,'membership.leave',u.uid,s=>{if(s.memberships[u.uid])s.memberships[u.uid]={...s.memberships[u.uid],status:'left',updatedAt:stamp()};});},
    async reviewMember(request,body,admin=false){
      const u=admin?await requireAdmin(request):await authenticate(request),uid=key(body.uid),status=clean(body.status);
      if(!['approved','rejected','removed'].includes(status))fail('Décision invalide.');
      return mutate(u,'membership.'+status,uid,s=>{
        const m=s.memberships[uid],a=m && s.agencies[m.agencyId];
        if(!a || (!admin && a.ownerUid!==u.uid))fail('Vous ne gérez pas cette demande.',403);
        if(a.status!=='approved' || !['pending','approved'].includes(m.status))fail('Cette demande ou agence n’est plus active.',409);
        s.memberships[uid]={...m,status,reviewedBy:u.uid,updatedAt:stamp()};
      });
    },
    async reviewAgency(request,body){
      const u=await requireAdmin(request),id=key(body.agencyId),status=clean(body.status);
      if(!['approved','rejected','suspended'].includes(status))fail('Décision invalide.');
      return mutate(u,'agency.'+status,id,s=>{const a=s.agencies[id];if(!a)fail('Agence introuvable.',404);s.agencies[id]={...a,status,reason:clean(body.reason,500),reviewedBy:u.uid,updatedAt:stamp()};});
    },
    async recordCheckout(id,data){await db().ref(AGENCY_CHECKOUT_PATH+'/'+key(id)).set({...data,at:stamp()});},
    async activationMetadata(uid,id,current,planId){
      const data=(await db().ref(AGENCY_CHECKOUT_PATH+'/'+key(id)).get()).val();
      if(data?.uid===uid && (!planId || data.planId===planId))return {agencyProgramGroup:data.group,agencyProgramAgencyId:data.agencyId || ''};
      if(current?.agencyProgramGroup)return {agencyProgramGroup:current.agencyProgramGroup,agencyProgramAgencyId:current.agencyProgramAgencyId || ''};
      return {agencyProgramGroup:(await service.quote(uid,current)).group,agencyProgramAgencyId:''};
    }
  };
  return service;
}
