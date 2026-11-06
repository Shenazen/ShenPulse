const test=require("node:test"),assert=require("node:assert/strict");
const at=Date.UTC(2026,10,16);
async function fixture(){
 const {createAgencyService,AGENCY_PATH}=await import("../backend/agencies/service.mjs");
 let state={agencies:{a:{id:"a",name:"Agence Alpha",ownerUid:"director",status:"approved"},b:{id:"b",name:"Agence Beta",ownerUid:"other",status:"approved"}},memberships:{},audit:{}};
 for(let i=0;i<25;i++)state.memberships["c"+i]={agencyId:"a",status:"approved",email:"c"+i+"@example.invalid",displayName:"Créateur "+i};
 state.memberships.foreign={agencyId:"b",status:"approved"};state.memberships.pending={agencyId:"a",status:"pending"};
 const subscriptions={c0:{status:"active",tier:"pro",paymentProvider:"stripe",stripeSubscriptionId:"sub_test",priceMonthly:9.99}};
 const db={ref(path){assert.equal(path,AGENCY_PATH);return {async get(){return {val:()=>structuredClone(state)};},on(){},off(){},async once(){return this.get();},async transaction(fn){const next=fn(structuredClone(state));if(next===undefined)return {committed:false};state=next;return {committed:true};}};}};
 const service=createAgencyService({db:()=>db,authenticate:async r=>({uid:r.uid,email:r.uid+"@example.invalid"}),requireAdmin:async r=>{if(r.uid!=="admin")throw Object.assign(Error("Admin requis"),{statusCode:403});return {uid:"admin"};},subscription:async uid=>subscriptions[uid]||{},now:()=>at});
 return {service,state:()=>state,subscriptions};
}
const admin={uid:"admin"};
const definition=(extra={})=>({title:"20+ créas",minimumCreators:20,maximumCreators:null,prices:{pro:850,premium:1200},status:"enabled",belowMinimum:"block",additions:"prorata",removals:"renewal",validFrom:"",validUntil:"",expectedRevision:0,...extra});
const seats=(n=20)=>Array.from({length:n},(_,i)=>({uid:"c"+i,tier:"pro"}));
async function saved(f,extra={}){return (await f.service.packs.save(admin,definition(extra))).id;}
async function assign(f,id,rows=seats(),extra={}){return f.service.packs.assign(admin,{packId:id,agencyId:"a",expectedRevision:0,expectedPackRevision:1,seats:rows,...extra});}
test("modèles et attributions privés, sans modification d’abonnement ou de tarif personnel",async()=>{
 const f=await fixture(),before=structuredClone(f.subscriptions),id=await saved(f);await assign(f,id);
 const data=await f.service.dashboard(admin,true);
 assert.equal(data.packsAvailable,true);assert.equal(data.packBillingAvailable,false);
 assert.equal(data.agencyPacks[0].prices.pro,850);assert.equal(data.agencyPackAssignments[0].quote.ready,true);
 assert.equal(data.agencyPackAssignments[0].quote.effectiveMonthlyCents,17000);
 assert.equal(data.agencyPackAssignments[0].quote.paymentActive,false);
 assert.equal(data.agencyPackAssignments[0].quote.countsAsActive,false);
 assert.deepEqual(f.subscriptions,before);assert.equal((await f.service.quote("c1")).quoted.pro,9.99);
 assert.equal((await f.service.publicList()).agencies.length,0);
 for(const user of [{uid:"director"},{uid:"c1"}]){const r=await f.service.dashboard(user);assert.equal(r.agencyPacks,undefined);assert.equal(r.agencyPackAssignments,undefined);}
});
test("aucune commande pack n’est accessible au directeur ou à un membre",async()=>{
 const f=await fixture();
 for(const uid of ["director","c1","intruder"])for(const command of ["save","archive","assign","unassign","preview"])await assert.rejects(f.service.packs[command]({uid},definition()),{statusCode:403});
 assert.equal(f.state().agencyPacks,undefined);
});
test("simulation mixte, seuil exact, économie et aucun effet secondaire",async()=>{
 const f=await fixture(),id=await saved(f),rows=seats();rows[19].tier="premium";
 const before=structuredClone(f.state()),result=await f.service.packs.preview(admin,{packId:id,agencyId:"a",seats:rows});
 assert.equal(result.quote.ready,true);assert.equal(result.quote.proCreators,19);assert.equal(result.quote.premiumCreators,1);
 assert.equal(result.quote.negotiatedMonthlyCents,17350);assert.equal(result.quote.standardMonthlyCents,20380);assert.equal(result.quote.savingsMonthlyCents,3030);
 assert.deepEqual(f.state(),before);
});
test("préparation partielle autorisée ; avantage bloqué sous le minimum",async()=>{
 const f=await fixture(),id=await saved(f);await assign(f,id,seats(19));
 const q=(await f.service.dashboard(admin,true)).agencyPackAssignments[0].quote;
 assert.equal(q.ready,false);assert.equal(q.missingCreators,1);assert.equal(q.minimumReached,false);
 assert.match(q.reasons.join(" "),/Minimum/);assert.equal(q.countsAsActive,false);
});
test("seuil non atteint : retour au tarif agence seulement si choisi explicitement",async()=>{
 const f=await fixture(),id=await saved(f,{belowMinimum:"standard"});
 const q=(await f.service.packs.preview(admin,{packId:id,agencyId:"a",seats:seats(19)})).quote;
 assert.equal(q.ready,true);assert.equal(q.usesStandardRate,true);assert.equal(q.effectiveMonthlyCents,19*999);assert.equal(q.savingsMonthlyCents,0);
});
test("les comptes étrangers, non membres, en attente, doublons et formules absentes sont refusés",async()=>{
 const f=await fixture(),id=await saved(f,{prices:{pro:850,premium:null}});
 for(const rows of [[{uid:"foreign",tier:"pro"}],[{uid:"pending",tier:"pro"}],[{uid:"missing",tier:"pro"}],[{uid:"c1",tier:"pro"},{uid:"c1",tier:"premium"}],[{uid:"c1",tier:"premium"}]])await assert.rejects(assign(f,id,rows));
 assert.equal(f.state().agencyPackAssignments,undefined);
});
test("une agence suspendue ou un membre retiré rendent l’attribution non éligible",async()=>{
 const f=await fixture(),id=await saved(f);await assign(f,id);
 f.state().memberships.c1.status="left";
 let q=(await f.service.dashboard(admin,true)).agencyPackAssignments[0].quote;assert.equal(q.eligibleCreators,19);assert.equal(q.ready,false);
 f.state().agencies.a.status="suspended";
 q=(await f.service.dashboard(admin,true)).agencyPackAssignments[0].quote;assert.match(q.reasons.join(" "),/non validée/);
 await assert.rejects(assign(f,id,seats(),{expectedRevision:1}),{statusCode:409});
});
test("révisions périmées : aucun écrasement de modèle ou d’attribution",async()=>{
 const f=await fixture(),id=await saved(f);await assign(f,id);
 await f.service.packs.save(admin,definition({id,expectedRevision:1,title:"Révision 2"}));
 await assert.rejects(f.service.packs.save(admin,definition({id,expectedRevision:1})),{statusCode:409});
 await assert.rejects(assign(f,id,seats(21),{expectedRevision:1}),{statusCode:409});
 await assert.rejects(assign(f,id,seats(21),{expectedRevision:0,expectedPackRevision:2}),{statusCode:409});
 assert.equal(f.state().agencyPacks[id].title,"Révision 2");assert.equal(f.state().agencyPackAssignments.a.seats.length,20);
});
test("archivage réversible par duplication, conservation des attributions et de l’audit",async()=>{
 const f=await fixture(),id=await saved(f);await assign(f,id);
 await f.service.packs.archive(admin,{id,expectedRevision:1});
 assert.equal(f.state().agencyPackAssignments.a.seats.length,20);
 assert.equal((await f.service.dashboard(admin,true)).agencyPackAssignments[0].quote.ready,false);
 await assert.rejects(assign(f,id,seats(),{expectedRevision:1,expectedPackRevision:2}),{statusCode:409});
 await assert.rejects(f.service.packs.save(admin,definition({id,expectedRevision:2})),{statusCode:409});
 assert.notEqual(await saved(f,{title:"Copie du pack"}),id);
 assert.ok(Object.values(f.state().audit).some(a=>a.action==="pack.archive"));
});
test("retirer une attribution préserve tous les membres et contrats",async()=>{
 const f=await fixture(),id=await saved(f);await assign(f,id);
 const before=structuredClone(f.state().memberships);
 await assert.rejects(f.service.packs.unassign(admin,{agencyId:"a",expectedRevision:0}),{statusCode:409});
 await f.service.packs.unassign(admin,{agencyId:"a",expectedRevision:1});
 assert.deepEqual(f.state().memberships,before);assert.equal(f.state().agencyPackAssignments.a,undefined);assert.equal(f.state().agencyPacks[id].status,"enabled");
});
test("seuils, centimes, dates et statuts incohérents sont refusés",async()=>{
 const f=await fixture();
 for(const extra of [{minimumCreators:0},{minimumCreators:1.2},{minimumCreators:1001},{maximumCreators:19},{prices:{pro:8.5}},{prices:{pro:null,premium:null}},{prices:{pro:0}},{status:"active"},{additions:"refund"},{validFrom:"2026-02-30"},{validUntil:"2026-99-99"},{validFrom:"2026-11-20",validUntil:"2026-11-01"}])await assert.rejects(saved(f,extra),{statusCode:400});
});
test("dates, maximum et brouillon empêchent une offre prête",async()=>{
 const f=await fixture(),id=await saved(f,{status:"draft",validUntil:"2026-11-15",maximumCreators:20});
 await assert.rejects(assign(f,id,seats(21)),{statusCode:400});
 const q=(await f.service.packs.preview(admin,{packId:id,agencyId:"a",seats:seats()})).quote;
 assert.equal(q.ready,false);assert.match(q.reasons.join(" "),/brouillon/);assert.match(q.reasons.join(" "),/validité/);
});
test("prorata : ajout immédiat, retrait différé ou avoir explicite ; aucune facture",async()=>{
 const {estimatePackProration}=await import("../backend/agencies/pack-policy.mjs");
 const period={start:"2026-11-01T00:00:00Z",end:"2026-12-01T00:00:00Z"},pack=definition();
 assert.equal(estimatePackProration(pack,17000,18700,period,at).adjustmentCents,850);
 assert.equal(estimatePackProration(pack,17000,15300,period,at).adjustmentCents,0);
 assert.equal(estimatePackProration({...pack,removals:"credit"},17000,15300,period,at).adjustmentCents,-850);
 assert.equal(estimatePackProration({...pack,additions:"renewal"},17000,18700,period,at).adjustmentCents,0);
 assert.equal(estimatePackProration(pack,0,17000,period,Date.parse(period.end)).adjustmentCents,0);
 assert.throws(()=>estimatePackProration(pack,0,17000,{start:period.end,end:period.start},at));
});
test("la simulation compare les anciennes conditions enregistrées, pas un tarif modifié entre-temps",async()=>{
 const f=await fixture(),id=await saved(f);await assign(f,id);
 await f.service.packs.save(admin,definition({id,expectedRevision:1,prices:{pro:900,premium:1200}}));
 const p=await f.service.packs.preview(admin,{packId:id,agencyId:"a",seats:seats(),period:{start:"2026-11-01T00:00:00Z",end:"2026-12-01T00:00:00Z"}});
 assert.equal(p.proration.previousMonthlyCents,17000);assert.equal(p.proration.nextMonthlyCents,18000);assert.equal(p.proration.adjustmentCents,500);
});
test("un modèle s’attribue à plusieurs agences avec leurs propres sélections",async()=>{
 const f=await fixture(),id=await saved(f);await assign(f,id);
 await f.service.packs.assign(admin,{packId:id,agencyId:"b",seats:[{uid:"foreign",tier:"premium"}],expectedRevision:0,expectedPackRevision:1});
 assert.equal(Object.keys(f.state().agencyPackAssignments).length,2);assert.equal(f.state().agencyPackAssignments.a.seats.length,20);assert.equal(f.state().agencyPackAssignments.b.seats.length,1);
});
test("les routes privées utilisent les commandes dédiées et refusent les méthodes arbitraires",async()=>{
 const f=await fixture(),{handleAgencyRoute}=await import("../backend/agencies/routes.mjs");
 const r=await handleAgencyRoute(f.service,{uid:"admin",method:"POST"},new URL("https://example.invalid/api/admin/agencies/packs/save"),async()=>definition());
 assert.ok(r.id);
 await assert.rejects(handleAgencyRoute(f.service,{uid:"director",method:"POST"},new URL("https://example.invalid/api/admin/agencies/packs/save"),async()=>definition()),{statusCode:403});
 await assert.rejects(handleAgencyRoute(f.service,{uid:"admin",method:"DELETE"},new URL("https://example.invalid/api/admin/agencies/packs/save"),async()=>definition()),{statusCode:405});
});

test("une attribution sans sélection relue depuis Firebase ne casse pas le tableau et reste non éligible",async()=>{
 const f=await fixture(),id=await saved(f,{belowMinimum:"standard"});await assign(f,id,[]);
 delete f.state().agencyPackAssignments.a.seats; // RTDB supprime les tableaux vides.
 const dashboard=await f.service.dashboard(admin,true),q=dashboard.agencyPackAssignments[0].quote;
 assert.equal(q.eligibleCreators,0);assert.equal(q.ready,false);assert.equal(q.effectiveMonthlyCents,0);
 assert.match(q.reasons.join(" "),/Aucun créateur/);
});
test("la première attribution ne simule pas un prorata de contrat existant",async()=>{
 const f=await fixture(),id=await saved(f);
 const r=await f.service.packs.preview(admin,{packId:id,agencyId:"a",seats:seats(),period:{start:"2026-11-01T00:00:00Z",end:"2026-12-01T00:00:00Z"}});
 assert.equal(r.quote.effectiveMonthlyCents,17000);assert.equal(r.proration,null);assert.equal(r.simulation,true);
});

test("le fondateur reçoit uniquement son offre publiable et aucune note de négociation",async()=>{
 const f=await fixture(),id=await saved(f,{notes:'SECRET négociation administrateur'});await assign(f,id);
 const r=await f.service.dashboard({uid:'director'});
 assert.equal(r.directorPacksAvailable,true);assert.equal(r.packBillingAvailable,false);
 assert.equal(r.agencyPack.terms.title,'20+ créas');assert.equal(r.agencyPack.quote.effectiveMonthlyCents,17000);
 assert.equal(r.agencyPack.terms.notes,undefined);assert.equal(r.agencyPack.terms.createdBy,undefined);
 assert.doesNotMatch(JSON.stringify(r),/SECRET négociation/);assert.equal(r.agencyPacks,undefined);
 for(const uid of ['c1','intruder'])assert.equal((await f.service.dashboard({uid})).agencyPack,undefined);
 assert.equal((await f.service.dashboard({uid:'other'})).agencyPack,null);
});

test("brouillons et archives ne sont pas proposés au fondateur, ni les offres d’une agence suspendue",async()=>{
 const f=await fixture(),id=await saved(f,{status:'draft'});await assign(f,id);
 assert.equal((await f.service.dashboard({uid:'director'})).agencyPack,null);
 await f.service.packs.save(admin,definition({id,expectedRevision:1,status:'enabled'}));
 assert.ok((await f.service.dashboard({uid:'director'})).agencyPack);
 await f.service.packs.archive(admin,{id,expectedRevision:2});
 assert.equal((await f.service.dashboard({uid:'director'})).agencyPack,null);
 f.state().agencies.a.status='suspended';
 assert.equal((await f.service.dashboard({uid:'director'})).directorPacksAvailable,undefined);
});

const ownBody=(extra={})=>({expectedRevision:1,expectedPackRevision:1,seats:seats(),...extra});
test("le fondateur simule puis enregistre ses comptes sans changer les membres, les paiements ni les conditions",async()=>{
 const f=await fixture(),id=await saved(f);await assign(f,id);
 const before=structuredClone(f.state()),subs=structuredClone(f.subscriptions),chosen=seats(21);chosen[0].tier='premium';
 const preview=await f.service.packs.previewOwn({uid:'director'},ownBody({seats:chosen}));
 assert.equal(preview.quote.effectiveMonthlyCents,18200);assert.equal(preview.proration,null);assert.equal(preview.simulation,true);
 assert.deepEqual(f.state(),before);
 await f.service.packs.selectOwn({uid:'director'},ownBody({seats:chosen,agencyId:'b',packId:'another',prices:{pro:1},status:'active',paymentActive:true}));
 assert.deepEqual(f.state().memberships,before.memberships);assert.deepEqual(f.subscriptions,subs);assert.deepEqual(f.state().agencyPacks,before.agencyPacks);
 assert.equal(f.state().agencyPackAssignments.a.revision,2);assert.equal(f.state().agencyPackAssignments.a.status,'prepared');
 assert.equal(f.state().agencyPackAssignments.a.updatedBy,'director');assert.equal(f.state().agencyPackAssignments.a.packId,id);
 assert.equal(f.state().agencyPackAssignments.b,undefined);assert.equal((await f.service.dashboard({uid:'director'})).agencyPack.quote.countsAsActive,false);
 await assert.rejects(f.service.packs.selectOwn({uid:'director'},ownBody()),{statusCode:409});
});

test("la sélection privée exige le fondateur, des membres acceptés et la révision exacte des conditions",async()=>{
 const f=await fixture(),id=await saved(f);await assign(f,id);
 for(const uid of ['c1','intruder','admin'])for(const name of ['previewOwn','selectOwn'])await assert.rejects(f.service.packs[name]({uid},ownBody()),{statusCode:403});
 for(const chosen of [[{uid:'foreign',tier:'pro'}],[{uid:'pending',tier:'pro'}],[{uid:'c1',tier:'pro'},{uid:'c1',tier:'pro'}]])await assert.rejects(f.service.packs.selectOwn({uid:'director'},ownBody({seats:chosen})));
 await f.service.packs.save(admin,definition({id,expectedRevision:1,prices:{pro:900,premium:null}}));
 await assert.rejects(f.service.packs.selectOwn({uid:'director'},ownBody()),{statusCode:409});
 await assert.rejects(f.service.packs.selectOwn({uid:'director'},ownBody({expectedPackRevision:2,seats:[{uid:'c0',tier:'premium'}]})),/ne propose pas/);
});

test("le fondateur peut préparer une sélection incomplète ou vide, mais pas dépassée ni périmée",async()=>{
 const f=await fixture(),id=await saved(f,{maximumCreators:20});await assign(f,id);
 await assert.rejects(f.service.packs.selectOwn({uid:'director'},ownBody({seats:seats(21)})),/maximum/);
 await f.service.packs.selectOwn({uid:'director'},ownBody({seats:seats(10)}));
 let r=await f.service.dashboard({uid:'director'});assert.equal(r.agencyPack.quote.ready,false);assert.equal(r.agencyPack.quote.missingCreators,10);
 await f.service.packs.selectOwn({uid:'director'},ownBody({expectedRevision:2,seats:[]}));
 delete f.state().agencyPackAssignments.a.seats;
 r=await f.service.dashboard({uid:'director'});assert.deepEqual(r.agencyPack.seats,[]);assert.equal(r.agencyPack.quote.effectiveMonthlyCents,0);
 await f.service.packs.save(admin,definition({id,expectedRevision:1,validUntil:'2026-11-15'}));
 await assert.rejects(f.service.packs.selectOwn({uid:'director'},ownBody({expectedRevision:3,expectedPackRevision:2})),/période de validité/);
});

test("les routes de l’espace agence sont authentifiées et la suspension invalide une popup ouverte",async()=>{
 const f=await fixture(),id=await saved(f),{handleAgencyRoute}=await import('../backend/agencies/routes.mjs');await assign(f,id);
 const url=new URL('https://example.invalid/api/agencies/pack/preview');
 const p=await handleAgencyRoute(f.service,{uid:'director',method:'POST'},url,async()=>ownBody());assert.equal(p.quote.effectiveMonthlyCents,17000);
 await handleAgencyRoute(f.service,{uid:'director',method:'POST'},new URL('https://example.invalid/api/agencies/pack/selection'),async()=>ownBody());
 f.state().agencies.a.status='suspended';
 await assert.rejects(f.service.packs.selectOwn({uid:'director'},ownBody({expectedRevision:2})),{statusCode:403});
});