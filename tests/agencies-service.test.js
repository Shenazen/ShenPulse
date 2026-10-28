const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = async () => {
  const { createAgencyService, AGENCY_PATH } = await import('../backend/agencies/service.mjs');
  let state = null;
  const subscriptions = {};
  const users = Object.fromEntries(['director','creator','intruder','admin'].map(uid=>[uid,{uid,email:uid+'@example.invalid',emailVerified:true}]));
  const db = { ref(path) { return {
    async get(){return {val:()=>structuredClone(path===AGENCY_PATH?state:state?.checkouts?.[path.split('/').at(-1)] || null)};},
    on(){},off(){},async once(){return this.get();},
    async transaction(fn){const value=fn(structuredClone(state));if(value===undefined)return {committed:false};state=value;return {committed:true};},
    async set(value){state ||= {agencies:{},memberships:{},checkouts:{},audit:{}};state.checkouts[path.split('/').at(-1)]=structuredClone(value);}
  };}};
  const authenticate=async r=>{if(!users[r.uid])throw Object.assign(new Error('Compte requis'),{statusCode:401});return users[r.uid];};
  const requireAdmin=async r=>{const u=await authenticate(r);if(u.uid!=='admin')throw Object.assign(new Error('Admin requis'),{statusCode:403});return u;};
  const service=createAgencyService({db:()=>db,authenticate,requireAdmin,subscription:async uid=>subscriptions[uid] || {}});
  await service.save({uid:'director'},{name:'Agence Test',description:'Une agence pour les essais.',status:'approved'});
  const agency=Object.values(state.agencies)[0];
  return {service,agency,users,subscriptions,state:()=>state};
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
