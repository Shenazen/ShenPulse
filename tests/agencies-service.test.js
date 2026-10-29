const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = async (now=Date.now) => {
  const { createAgencyService, AGENCY_PATH } = await import('../backend/agencies/service.mjs');
  let state = null;
  const subscriptions = {};
  const trials = {};
  const users = Object.fromEntries(['director','creator','intruder','admin'].map(uid=>[uid,{uid,email:uid+'@example.invalid',emailVerified:true}]));
  const db = { ref(path) { return {
    async get(){return {val:()=>structuredClone(path===AGENCY_PATH?state:state?.checkouts?.[path.split('/').at(-1)] || null)};},
    on(){},off(){},async once(){return this.get();},
    async transaction(fn){const value=fn(structuredClone(state));if(value===undefined)return {committed:false};state=value;return {committed:true};},
    async set(value){state ||= {agencies:{},memberships:{},checkouts:{},audit:{}};state.checkouts[path.split('/').at(-1)]=structuredClone(value);}
  };}};
  const authenticate=async r=>{if(!users[r.uid])throw Object.assign(new Error('Compte requis'),{statusCode:401});return users[r.uid];};
  const requireAdmin=async r=>{const u=await authenticate(r);if(u.uid!=='admin')throw Object.assign(new Error('Admin requis'),{statusCode:403});return u;};
  const service=createAgencyService({db:()=>db,authenticate,requireAdmin,subscription:async uid=>subscriptions[uid] || {},trial:async uid=>trials[uid] || null,now});
  await service.save({uid:'director'},{name:'Agence Test',description:'Une agence pour les essais.',status:'approved'});
  const agency=Object.values(state.agencies)[0];
  return {service,agency,users,subscriptions,trials,state:()=>state};
};
test('création en attente, code privé et validation réservée au propriétaire ShenPulse',async()=>{
  const f=await fixture();
  assert.equal(f.agency.status,'pending');
  assert.deepEqual((await f.service.publicList()).agencies,[]);
  await assert.rejects(f.service.reviewAgency({uid:'intruder'},{agencyId:f.agency.id,status:'approved'}),{statusCode:403});
  await f.service.reviewAgency({uid:'admin'},{agencyId:f.agency.id,status:'approved'});
  const publicData=await f.service.publicList();
  assert.equal(publicData.agencies.length,0);
  const invitation=await f.service.invitation(f.agency.code);
  assert.equal(invitation.code,undefined);
  assert.equal(invitation.contactEmail,undefined);
  assert.equal(publicData.commissionsEnabled,false);
});
test('code puis validation du directeur requis avant le tarif agence',async()=>{
  const f=await fixture();
  await assert.rejects(f.service.join({uid:'creator'},{code:f.agency.code}),{statusCode:404});
  await f.service.reviewAgency({uid:'admin'},{agencyId:f.agency.id,status:'approved'});
  await f.service.join({uid:'creator'},{code:f.agency.code});
  assert.equal((await f.service.quote('creator')).quoted.pro,14.99);
  await assert.rejects(f.service.reviewMember({uid:'intruder'},{uid:'creator',status:'approved'}),{statusCode:403});
  await f.service.reviewMember({uid:'director'},{uid:'creator',status:'approved'});
  assert.deepEqual((await f.service.quote('creator')).quoted,{pro:9.99,premium:13.99});
  await assert.rejects(f.service.join({uid:'creator'},{agencyId:f.agency.id}),{statusCode:409});
});
test('suspension, retrait et départ arrêtent l’éligibilité sans toucher aux paiements existants',async()=>{
  const f=await fixture();
  await f.service.reviewAgency({uid:'admin'},{agencyId:f.agency.id,status:'approved'});
  await f.service.join({uid:'creator'},{agencyId:f.agency.id});
  await f.service.reviewMember({uid:'director'},{uid:'creator',status:'approved'});
  await f.service.reviewAgency({uid:'admin'},{agencyId:f.agency.id,status:'suspended'});
  assert.equal((await f.service.quote('creator')).eligible,false);
  await f.service.reviewAgency({uid:'admin'},{agencyId:f.agency.id,status:'approved'});
  await f.service.leave({uid:'creator'});
  assert.equal((await f.service.quote('creator')).group,'public');
  assert.deepEqual(f.subscriptions,{});
});
test('le directeur ne voit que ses membres ; aucun autre compte ne reçoit leurs coordonnées',async()=>{
  const f=await fixture();
  await f.service.reviewAgency({uid:'admin'},{agencyId:f.agency.id,status:'approved'});
  await f.service.join({uid:'creator'},{agencyId:f.agency.id});
  assert.equal((await f.service.dashboard({uid:'director'})).members.length,1);
  assert.equal((await f.service.dashboard({uid:'intruder'})).members.length,0);
  assert.equal((await f.service.dashboard({uid:'intruder'})).ownAgency,null);
  await assert.rejects(f.service.dashboard({uid:'intruder'},true),{statusCode:403});
});
test('seuls les abonnements PayPal payants actifs sont comptés ; pas les accès offerts',async()=>{
  const f=await fixture();
  await f.service.reviewAgency({uid:'admin'},{agencyId:f.agency.id,status:'approved'});
  await f.service.join({uid:'creator'},{agencyId:f.agency.id});
  f.subscriptions.creator={status:'active',tier:'pro',source:'premiumSeat',priceMonthly:0};
  assert.equal((await f.service.dashboard({uid:'director'})).members[0].paying,false);
  f.subscriptions.creator={status:'active',tier:'pro',paymentProvider:'paypal',paypalSubscriptionId:'I-TEST',priceMonthly:9.99};
  assert.equal((await f.service.dashboard({uid:'director'})).members[0].paying,true);
});

test('essai sélectionné : compte dans son agence sans changer ses droits ni créer de paiement',async()=>{
  const f=await fixture();
  await f.service.reviewAgency({uid:'admin'},{agencyId:f.agency.id,status:'approved'});
  for(const uid of ['director','creator','intruder']){
    await f.service.join({uid},{agencyId:f.agency.id});
    await f.service.reviewMember({uid:'director'},{uid,status:'approved'});
  }
  f.subscriptions.director={tier:'premium',status:'trial',source:'trial',priceMonthly:0};
  for(const uid of ['creator','intruder'])f.subscriptions[uid]={tier:'pro',status:'active',paymentProvider:'paypal',paypalSubscriptionId:'I-'+uid,priceMonthly:9.99};
  const before=structuredClone(f.subscriptions);
  assert.equal((await f.service.publicList()).agencies.length,0);
  f.trials.director={countsForAgency:true,source:'trial',tier:'premium',expiresAtMs:Date.now()+60000};
  f.service.invalidateDirectoryCache();
  const member=(await f.service.dashboard({uid:'director'})).members.find(m=>m.uid==='director');
  assert.equal(member.paying,true);
  assert.equal(member.tier,'premium');
  assert.equal(member.paidSubscription,false);
  assert.equal(member.countingSource,'trial');
  assert.equal((await f.service.publicList()).agencies[0].payingCount,3);
  assert.equal(JSON.stringify(await f.service.publicList()).includes('countsForAgency'),false);
  assert.deepEqual(f.subscriptions,before);
  assert.equal((await f.service.quote('director')).currentPrice,0);
  assert.equal(await f.service.directorReward('director'),null);
  f.subscriptions.director={tier:'premium',status:'active',paymentProvider:'paypal',paypalSubscriptionId:'I-OWNER',priceMonthly:13.99};
  await f.service.updateIdentity({uid:'director'},{tiktokUsername:'owner_paid'});
  assert.equal((await f.service.publicList()).agencies[0].payingCount,3,'Jamais de double comptage');
});

test('les essais ordinaires, expirés et champs client ne sont pas comptés ; révocation et départ retirent le comptage',async()=>{
  const f=await fixture();
  await f.service.reviewAgency({uid:'admin'},{agencyId:f.agency.id,status:'approved'});
  await f.service.join({uid:'creator'},{agencyId:f.agency.id,countsForAgency:true});
  await f.service.reviewMember({uid:'director'},{uid:'creator',status:'approved',paying:true});
  f.subscriptions.creator={tier:'premium',status:'trial',priceMonthly:0,countsForAgency:true};
  const row=async()=> (await f.service.dashboard({uid:'director'})).members.find(m=>m.uid==='creator');
  assert.equal((await row()).paying,false);
  for(const trial of [
    {countsForAgency:false,source:'trial',tier:'premium',expiresAtMs:Date.now()+60000},
    {countsForAgency:true,source:'own',tier:'premium',expiresAtMs:Date.now()+60000},
    {countsForAgency:true,source:'trial',tier:'premium',expiresAtMs:Date.now()-1},
    {countsForAgency:true,source:'trial',tier:'admin',expiresAtMs:Date.now()+60000},
    {countsForAgency:true,source:'trial',tier:'pro'}
  ]){f.trials.creator=trial;assert.equal((await row()).paying,false);}
  f.trials.creator={countsForAgency:true,source:'trial',tier:'pro',expiresAtMs:Date.now()+60000};
  assert.equal((await row()).paying,true,'Un essai sélectionné compte aussi pour un simple membre');
  f.trials.creator=null;assert.equal((await row()).paying,false,'Révocation');
  f.trials.creator={countsForAgency:true,source:'trial',tier:'premium',expiresAtMs:Date.now()+60000};
  await f.service.leave({uid:'creator'});
  assert.equal((await f.service.publicList()).agencies.length,0);
});
test('le cache de l’annuaire expire au plus tard avec un essai comptabilisé',async()=>{
  let at=Date.now();const f=await fixture(()=>at);
  await f.service.reviewAgency({uid:'admin'},{agencyId:f.agency.id,status:'approved'});
  for(const uid of ['director','creator','intruder']){
    await f.service.join({uid},{agencyId:f.agency.id});await f.service.reviewMember({uid:'director'},{uid,status:'approved'});
  }
  for(const uid of ['creator','intruder'])f.subscriptions[uid]={tier:'pro',status:'active',paymentProvider:'paypal',paypalSubscriptionId:'I-'+uid,priceMonthly:9.99};
  f.trials.director={tier:'premium',source:'trial',countsForAgency:true,expiresAtMs:at+100};
  assert.equal((await f.service.publicList()).agencies[0].payingCount,3);
  at+=101;
  assert.equal((await f.service.publicList()).agencies.length,0,'Pas de palier conservé pendant le cache de 30 secondes');
});

test('les anciens abonnés gardent leur tarif ; le prix agence n’est pas confondu avec un ancien contrat',async()=>{
  const {quoteAgencyPrices}=await import('../backend/agencies/service.mjs');
  const old={status:'active',tier:'premium',paymentProvider:'paypal',paypalSubscriptionId:'I-TEST',priceMonthly:13.99};
  assert.equal(quoteAgencyPrices(null,'creator',old).group,'legacy');
  assert.equal(quoteAgencyPrices(null,'creator',{...old,agencyProgramGroup:'agency'}).group,'public');
  assert.equal(quoteAgencyPrices(null,'creator',{...old,status:'cancelled'}).group,'public');
  assert.equal(quoteAgencyPrices(null,'creator',{...old,priceMonthly:0}).group,'public');
});
test('métadonnées de paiement associées à l’identité, jamais au compte envoyé par le client',async()=>{
  const f=await fixture();
  await f.service.recordCheckout('I-TEST',{uid:'creator',group:'agency',agencyId:f.agency.id});
  assert.equal((await f.service.activationMetadata('creator','I-TEST',{})).agencyProgramGroup,'agency');
  assert.equal((await f.service.activationMetadata('intruder','I-TEST',{})).agencyProgramGroup,'public');
  await assert.rejects(f.service.recordCheckout('../evil',{}),{statusCode:400});
});
test('URLs, e-mail vérifié et méthodes invalides sont refusés',async()=>{
  const f=await fixture(),{agencyUrl}=await import('../backend/agencies/service.mjs');
  assert.throws(()=>agencyUrl('javascript:alert(1)'));
  assert.throws(()=>agencyUrl('https://user:secret@example.invalid/'));
  f.users.director.emailVerified=false;
  await assert.rejects(f.service.save({uid:'director'},{name:'Test',description:'Une description correcte'}),{statusCode:403});
  const {handleAgencyRoute}=await import('../backend/agencies/routes.mjs');
  await assert.rejects(handleAgencyRoute(f.service,{method:'DELETE'},new URL('https://example.invalid/api/agencies'),async()=>({})),{statusCode:405});
});


test('annuaire : trois membres acceptés et payants, invitation utilisable avant le seuil',async()=>{
 const f=await fixture();
 await f.service.reviewAgency({uid:'admin'},{agencyId:f.agency.id,status:'approved'});
 const paid={status:'active',tier:'premium',paymentProvider:'paypal',paypalSubscriptionId:'I-TEST',priceMonthly:13.99};
 for(let i=0;i<3;i++){
  const uid='paid'+i;f.users[uid]={uid,email:uid+'@example.invalid',emailVerified:true};f.subscriptions[uid]=paid;
  await f.service.join({uid},{code:f.agency.code});await f.service.reviewMember({uid:'director'},{uid,status:'approved'});
  assert.equal((await f.service.publicList()).agencies.length,i===2?1:0);
 }
 const a=(await f.service.publicList()).agencies[0];
 assert.equal(a.level,'silver');assert.equal(a.payingCount,3);assert.equal(a.code,undefined);assert.equal(a.ownerUid,undefined);assert.equal(a.contactEmail,undefined);
 await f.service.leave({uid:'paid0'});assert.equal((await f.service.publicList()).agencies.length,0);
 assert.equal((await f.service.invitation(f.agency.code)).id,f.agency.id);
});
test('paliers, rotation du jour et bannière se fondent sur des abonnements actifs',async()=>{
 const f=await fixture();
 await f.service.reviewAgency({uid:'admin'},{agencyId:f.agency.id,status:'approved'});
 for(let i=0;i<25;i++){
  const uid='paid'+i;f.users[uid]={uid,email:uid+'@example.invalid',emailVerified:true};
  f.subscriptions[uid]={status:'active',tier:'pro',paymentProvider:'paypal',paypalSubscriptionId:'I-'+i,priceMonthly:9.99};
  await f.service.join({uid},{code:f.agency.code});await f.service.reviewMember({uid:'director'},{uid,status:'approved'});
 }
 let list=await f.service.publicList();
 const reward=await f.service.directorReward('director');assert.equal(reward.source,'agencyReward');assert.equal(reward.priceMonthly,0);assert.equal(reward.tier,'pro');assert.ok(reward.expiresAtMs>Date.now());
 assert.equal(await f.service.directorReward('creator'),null);
 assert.equal(await f.service.directorReward('director',f.subscriptions.paid0),null);
 assert.equal(list.agencies[0].level,'diamond');assert.equal(list.homeAgencyId,f.agency.id);assert.equal(list.featuredAgencyId,f.agency.id);
 await f.service.leave({uid:'paid0'});list=await f.service.publicList();
 assert.equal(await f.service.directorReward('director'),null);
 assert.equal(list.agencies[0].level,'gold');assert.equal(list.homeAgencyId,'');assert.equal(list.featuredAgencyId,f.agency.id);
 f.subscriptions.paid1={status:'active',tier:'pro',priceMonthly:0,source:'trial'};
 f.subscriptions.paid2={status:'active',tier:'pro',priceMonthly:0,source:'premiumSeat'};
 f.subscriptions.paid3={status:'active',tier:'pro',paymentProvider:'paypal',paypalSubscriptionId:'I-expired',priceMonthly:9.99,renewalDate:'2000-01-01'};
 await f.service.reviewMember({uid:'director'},{uid:'paid4',status:'removed'});
 list=await f.service.publicList();assert.equal(list.agencies[0].payingCount,20);
 assert.equal(list.commissionsEnabled,false);
});
test('logo, bannière et réseaux sociaux sont publics, validés et conservés à la modification',async()=>{
 const f=await fixture(),fields={name:'Équipe Image',description:'Une équipe avec sa propre identité.',language:'en',logoUrl:'https://example.invalid/logo.png',bannerUrl:'https://example.invalid/banner.jpg',instagram:'https://instagram.com/example'};
 await f.service.save({uid:'director'},fields);await f.service.reviewAgency({uid:'admin'},{agencyId:f.agency.id,status:'approved'});
 const a=await f.service.invitation(f.agency.code);
 assert.equal(a.bannerUrl,fields.bannerUrl);assert.equal(a.instagram,fields.instagram);assert.equal(a.language,'en');
 await assert.rejects(f.service.save({uid:'director'},{...fields,bannerUrl:'javascript:alert(1)'}));
});

test('RTDB à cache froid : une branche existante est chargée avant la transaction et l’écoute est libérée',async()=>{
 const {createAgencyService}=await import('../backend/agencies/service.mjs');
 let state={agencies:{a:{id:'a',ownerUid:'director',status:'pending'}},memberships:{},audit:{}},listeners=0;
 const db={ref(){let warm=false;return {
   on(){listeners++;},off(){listeners--;},
   async once(){warm=listeners>0;return {val:()=>structuredClone(state)};},
   async get(){return {val:()=>structuredClone(state)};},
   async transaction(fn){const next=fn(warm?structuredClone(state):null);if(next===undefined)return {committed:false};state=next;return {committed:true};}
 };}};
 const service=createAgencyService({db:()=>db,authenticate:async()=>({uid:'director'}),requireAdmin:async()=>({uid:'admin'}),subscription:async()=>({})});
 await service.reviewAgency({},{agencyId:'a',status:'approved'});assert.equal(state.agencies.a.status,'approved');assert.equal(listeners,0);
 await assert.rejects(service.reviewAgency({},{agencyId:'missing',status:'approved'}),{statusCode:404});assert.equal(listeners,0);
});

test('fiche en attente : logo et bannière réservés au directeur et à l’administration',async()=>{
 const f=await fixture();
 await f.service.save({uid:'director'},{name:'Agence privée',description:'Présentation encore en attente.',logoUrl:'https://example.invalid/logo.png',bannerUrl:'https://example.invalid/banner.jpg'});
 const own=(await f.service.dashboard({uid:'director'})).ownAgency;
 assert.equal(own.status,'pending');assert.equal(own.bannerUrl,'https://example.invalid/banner.jpg');
 const admin=await f.service.dashboard({uid:'admin'},true);
 assert.equal(admin.allAgencies[0].logoUrl,'https://example.invalid/logo.png');
 const other=await f.service.dashboard({uid:'intruder'});
 assert.equal(other.ownAgency,null);assert.equal(other.allAgencies,undefined);
 assert.deepEqual((await f.service.publicList()).agencies,[]);
 await assert.rejects(f.service.invitation(own.code),{statusCode:404});
});

test('annuaire serveur : les effectifs abonnés les plus grands arrivent en premier',async()=>{
 const f=await fixture();
 const second='director-two';f.users[second]={uid:second,email:'two@example.invalid',emailVerified:true};
 await f.service.save({uid:second},{name:'Deuxième agence',description:'Une autre agence pour les essais.'});
 const other=Object.values(f.state().agencies).find(a=>a.ownerUid===second);
 for(const a of [f.agency,other])await f.service.reviewAgency({uid:'admin'},{agencyId:a.id,status:'approved'});
 for(const [a,owner,count] of [[f.agency,'director',3],[other,second,11]]){
   for(let i=0;i<count;i++){
     const uid=owner+'-paid-'+i;f.users[uid]={uid,email:uid+'@example.invalid',emailVerified:true};
     f.subscriptions[uid]={status:'active',tier:'pro',paymentProvider:'paypal',paypalSubscriptionId:'I-'+uid,priceMonthly:9.99};
     await f.service.join({uid},{agencyId:a.id});await f.service.reviewMember({uid:owner},{uid,status:'approved'});
   }
 }
 assert.deepEqual((await f.service.publicList()).agencies.map(a=>a.payingCount),[11,3]);
});

test('la gestion normale des adhésions exige le fondateur, même pour le propriétaire ShenPulse',async()=>{
 const f=await fixture();
 await f.service.reviewAgency({uid:'admin'},{agencyId:f.agency.id,status:'approved'});
 await f.service.join({uid:'creator'},{agencyId:f.agency.id});
 for(const uid of ['admin','intruder'])await assert.rejects(f.service.reviewMember({uid},{uid:'creator',status:'approved'}),{statusCode:403});
 assert.equal((await f.service.dashboard({uid:'director'})).members[0].status,'pending');
 await f.service.reviewMember({uid:'director'},{uid:'creator',status:'approved'});
 await f.service.reviewMember({uid:'director'},{uid:'creator',status:'removed'});
 assert.equal((await f.service.dashboard({uid:'director'})).members[0].status,'removed');
});

test('le @ transmis remplace la saisie libre à l’adhésion et reste modifiable sans nouvelle demande',async()=>{
 const f=await fixture();await f.service.reviewAgency({uid:'admin'},{agencyId:f.agency.id,status:'approved'});
 await f.service.join({uid:'creator'},{code:f.agency.code,tiktokUsername:'@First.Name',displayName:'Faux pseudo',uid:'intruder'});
 let member=(await f.service.dashboard({uid:'director'})).members[0];
 assert.equal(member.uid,'creator');assert.equal(member.displayName,'@first.name');assert.equal(member.status,'pending');
 const before=structuredClone(member);
 await f.service.updateIdentity({uid:'creator'},{tiktokUsername:'second_name',uid:'intruder',agencyId:'other',status:'approved'});
 member=(await f.service.dashboard({uid:'director'})).members[0];
 assert.equal(member.displayName,'@second_name');assert.equal(member.agencyId,before.agencyId);assert.equal(member.status,'pending');assert.equal(member.requestedAt,before.requestedAt);
 assert.equal(f.state().memberships.intruder,undefined);
 await f.service.reviewMember({uid:'director'},{uid:'creator',status:'approved'});
 await f.service.updateIdentity({uid:'creator'},{tiktokUsername:'third.name'});
 member=(await f.service.dashboard({uid:'director'})).members[0];
 assert.equal(member.status,'approved');assert.equal(member.displayName,'@third.name');
});
test('identité inchangée ou adhésion quittée : aucune nouvelle écriture de profil',async()=>{
 const f=await fixture();assert.deepEqual(await f.service.updateIdentity({uid:'creator'},{tiktokUsername:'new_name'}),{ok:true,updated:false});
 await f.service.reviewAgency({uid:'admin'},{agencyId:f.agency.id,status:'approved'});
 await f.service.join({uid:'creator'},{agencyId:f.agency.id,tiktokUsername:'name'});
 const before=structuredClone(f.state());await f.service.updateIdentity({uid:'creator'},{tiktokUsername:'name'});assert.deepEqual(f.state(),before);
 await f.service.leave({uid:'creator'});const left=structuredClone(f.state());await f.service.updateIdentity({uid:'creator'},{tiktokUsername:'another'});assert.deepEqual(f.state(),left);
});
test('la route identité exige le compte connecté et un @ valide',async()=>{
 const f=await fixture(),{handleAgencyRoute}=await import('../backend/agencies/routes.mjs');
 for(const tiktokUsername of ['', 'invalid name','https://example.invalid','x'.repeat(31)])await assert.rejects(f.service.updateIdentity({uid:'creator'},{tiktokUsername}),{statusCode:400});
 await assert.rejects(f.service.updateIdentity({uid:'missing'},{tiktokUsername:'name'}),{statusCode:401});
 const result=await handleAgencyRoute(f.service,{uid:'creator',method:'POST'},new URL('https://example.invalid/api/agencies/identity'),async()=>({tiktokUsername:'name'}));
 assert.equal(result.ok,true);
});

test('régénérer invalide le code et son lien sans toucher aux membres ni aux abonnements',async()=>{
 const f=await fixture();await f.service.reviewAgency({uid:'admin'},{agencyId:f.agency.id,status:'approved'});
 await f.service.join({uid:'creator'},{code:f.agency.code,tiktokUsername:'creator'});
 await f.service.reviewMember({uid:'director'},{uid:'creator',status:'approved'});
 await f.service.join({uid:'intruder'},{code:f.agency.code,tiktokUsername:'pending'});
 f.subscriptions.creator={status:'active',tier:'pro',paymentProvider:'paypal',paypalSubscriptionId:'I-KEPT',priceMonthly:9.99};
 const members=structuredClone(f.state().memberships),subscriptions=structuredClone(f.subscriptions),old=f.agency.code;
 assert.equal((await f.service.rotateCode({uid:'director'},{expectedCode:old,agencyId:'another',code:'FORCED'})).ok,true);
 const next=(await f.service.dashboard({uid:'director'})).ownAgency.code;
 assert.match(next,/^[A-F0-9]{18}$/);assert.notEqual(next,old);assert.notEqual(next,'FORCED');
 await assert.rejects(f.service.invitation(old),{statusCode:404});
 await assert.rejects(f.service.join({uid:'admin'},{code:old}),{statusCode:404});
 assert.equal((await f.service.invitation(next)).id,f.agency.id);
 assert.deepEqual(f.state().memberships,members);assert.deepEqual(f.subscriptions,subscriptions);
 assert.deepEqual((await f.service.quote('creator')).quoted,{pro:9.99,premium:13.99});
 await assert.rejects(f.service.rotateCode({uid:'director'},{expectedCode:old}),{statusCode:409});
 assert.equal((await f.service.dashboard({uid:'director'})).ownAgency.code,next);
 await f.service.join({uid:'admin'},{code:next});assert.equal(f.state().memberships.admin.status,'pending');
});

test('le code se régénère uniquement pour le fondateur d’une agence validée, via une route privée',async()=>{
 const f=await fixture(),{handleAgencyRoute}=await import('../backend/agencies/routes.mjs');
 await assert.rejects(f.service.rotateCode({uid:'director'},{expectedCode:f.agency.code}),{statusCode:403});
 await f.service.reviewAgency({uid:'admin'},{agencyId:f.agency.id,status:'approved'});
 for(const uid of ['intruder','admin'])await assert.rejects(f.service.rotateCode({uid},{expectedCode:f.agency.code,agencyId:f.agency.id}),{statusCode:403});
 await assert.rejects(handleAgencyRoute(f.service,{method:'POST'},new URL('https://example.invalid/api/agencies/invitation/rotate'),async()=>({expectedCode:f.agency.code})),{statusCode:401});
 await assert.rejects(f.service.rotateCode({uid:'director'},{}),{statusCode:409});
 const previous=f.agency.code;
 await handleAgencyRoute(f.service,{uid:'director',method:'POST'},new URL('https://example.invalid/api/agencies/invitation/rotate'),async()=>({expectedCode:previous}));
 assert.notEqual(f.state().agencies[f.agency.id].code,previous);
 assert.equal((await f.service.invitation(f.state().agencies[f.agency.id].code)).code,undefined);
});
