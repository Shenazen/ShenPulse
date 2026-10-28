const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const {JSDOM}=require("jsdom");
function fixture(t){
 const dom=new JSDOM("<main></main>",{runScripts:"outside-only"});t.after(()=>dom.window.close());
 const w=dom.window,calls=[];let uid="creator";
 w.escapeHtml=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;");
 w.isAccountAuthenticated=()=>!!uid;w.creatorPrivateOperationUid=()=>uid;w.creatorPrivateOperationGeneration=1;
 w.isVerifiedAdminSession=()=>uid==="admin";w.render=()=>{};w.registerActionHandler=()=>{};w.syncMembershipPopup=()=>{};
 w.captureCreatorPrivateOperation=()=>({uid});w.assertCreatorPrivateOperation=o=>assert.equal(o.uid,uid);
 w.openEditor=o=>calls.push(o);w.confirmAction=async()=>true;w.openAccountLogin=()=>calls.push("login");
 const prices={public:{pro:14.99,premium:20.99},agency:{pro:9.99,premium:13.99}};
 w.api={agencies:{list:async()=>({agencies:[],prices}),dashboard:async()=>({uid,membership:null,ownAgency:null,members:[],pricing:{quoted:prices.public}}),command:async(...a)=>calls.push(a)},admin:{agenciesDashboard:async()=>({allAgencies:[],members:[]})}};
 vm.runInContext('let currentPage="agencies";const ACTION_NOT_HANDLED=Symbol();const SUBSCRIPTION_PLANS=[{tier:"free",price:0},{tier:"pro",price:14.99},{tier:"premium",price:20.99}];'+["agencies-layout.js","agencies-forms.js","agencies.js"].map(file=>fs.readFileSync(path.join(__dirname,"../src/renderer/app/features",file),"utf8")).join("\n"),dom.getInternalVMContext());
 return {w,calls,setUid:v=>{uid=v;},run:s=>vm.runInContext(s,dom.getInternalVMContext())};
}
test("l’annuaire affiche les tarifs du programme et un vrai état vide",async t=>{
 const {w}=fixture(t);await w.refreshAgencies();const html=w.renderAgencies();
 assert.match(html,/9,99 €/);assert.match(html,/13,99 €/);assert.match(html,/14,99 €/);assert.match(html,/20,99 €/);
 assert.match(html,/premières agences/);assert.match(html,/Créer la fiche/);assert.doesNotMatch(html,/commission par/i);
});
test("un membre en attente ne reçoit ni confirmation d’accès ni bouton pour une seconde agence",async t=>{
 const {w}=fixture(t);
 w.api.agencies.dashboard=async()=>({membership:{agencyName:"<script>evil</script>",status:"pending"},pricing:{quoted:{pro:14.99,premium:20.99}}});
 await w.refreshAgencies();const html=w.renderAgencies();
 assert.match(html,/attend la validation/);assert.match(html,/Annuler la demande/);assert.doesNotMatch(html,/<script>evil/);
});
test("l’espace directeur affiche les membres, le code et les boutons fonctionnels",async t=>{
 const {w,calls}=fixture(t);
 w.api.agencies.dashboard=async()=>({ownAgency:{id:"agency",name:"Équipe Test",status:"approved",code:"TESTCODE",description:"Une équipe"},members:[{uid:"m",email:"m@example.invalid",displayName:"Membre",status:"pending"}],pricing:{quoted:{pro:9.99,premium:13.99},eligible:true}});
 await w.refreshAgencies();const html=w.renderAgencies();
 assert.match(html,/TESTCODE/);assert.match(html,/Accepter/);assert.match(html,/Refuser/);
 await w.handleAgencyAction({action:"agency-member",id:"m",target:{dataset:{status:"approved",admin:"false"}}});
 assert.equal(calls[0][0],"reviewMember");assert.equal(calls[0][1].uid,"m");
 w.editAgency();assert.match(w.renderAgencies(),/Envoyer ma fiche à ShenPulse/);
});
test("la console propriétaire est distincte ; les autres comptes ne peuvent pas la rendre",async t=>{
 const f=fixture(t);assert.equal(f.w.renderAdminAgencies(),"");
 f.setUid("admin");await f.w.refreshAgencies(true);assert.match(f.w.renderAdminAgencies(),/Aucune commission/);
});
test("changement de compte ou reconnexion : aucun cache privé du directeur ne reste visible",async t=>{
 const f=fixture(t);await f.w.refreshAgencies();
 f.run('agencyView.dashboard.ownAgency={name:"Secret agence",status:"approved",code:"SECRET"}');
 f.setUid("another");assert.equal(f.w.agencyState().dashboard,null);
 f.run('agencyView.dashboard={ownAgency:{name:"Autre secret"}}');
 f.w.creatorPrivateOperationGeneration++;assert.equal(f.w.agencyState().dashboard,null);
});
test("l’application du tarif agence est proposée uniquement pour réduire un abonnement personnel",async t=>{
 const {w}=fixture(t);w.api.agencies.dashboard=async()=>({pricing:{eligible:true,quoted:{pro:9.99,premium:13.99}}});
 await w.refreshAgencies();
 assert.equal(w.agencyCanApplyTariff("pro",{tier:"pro",source:"own",priceMonthly:14.99}),true);
 assert.equal(w.agencyCanApplyTariff("pro",{tier:"pro",source:"premiumSeat",priceMonthly:14.99}),false);
 assert.equal(w.agencyCanApplyTariff("pro",{tier:"pro",source:"own",priceMonthly:9.99}),false);
});


test("code intégré, création dans la page et champs publics complets",async t=>{
 const {w,calls}=fixture(t);await w.refreshAgencies();
 let main=w.document.querySelector('main');main.innerHTML=w.renderAgencies();
 const code=main.querySelector('#agency-code');code.value='CODE-TEST';w.rememberAgencyDraft({target:code});
 assert.equal(w.agencyState().joinCode,'CODE-TEST');
 await w.submitAgencyForm(main.querySelector('#agency-join-form'));
 assert.match(calls.at(-1).body,/CODE-TEST/);
 w.editAgency();main.innerHTML=w.renderAgencies();
 const form=main.querySelector('#agency-profile-form');
 for(const name of ['name','language','description','discord','tiktok','website','instagram','logoUrl','bannerUrl'])assert.ok(form.elements.namedItem(name),name);
 form.elements.name.value='Agence exemple';form.elements.description.value='Une description valide de notre équipe.';
 form.elements.language.value='en';
 await w.submitAgencyForm(form);
 assert.equal(calls.at(-1)[0],'save');assert.equal(calls.at(-1)[1].language,'en');assert.equal(w.agencyState().editor,null);
});
test("un échec d’enregistrement conserve la saisie, et Annuler ne transmet rien",async t=>{
 const {w,calls}=fixture(t);await w.refreshAgencies();w.editAgency();
 const main=w.document.querySelector('main');main.innerHTML=w.renderAgencies();
 const form=main.querySelector('#agency-profile-form');form.elements.name.value='Mon agence';form.elements.description.value='Présentation à conserver après panne.';
 w.api.agencies.command=async()=>{throw Error('Connexion interrompue');};
 await w.submitAgencyForm(form);
 assert.equal(w.agencyState().editor.name,'Mon agence');assert.match(w.renderAgencies(),/Connexion interrompue/);
 await w.handleAgencyAction({action:'agency-cancel-edit',target:{dataset:{}}});
 assert.equal(w.agencyState().editor,null);assert.equal(calls.length,0);
});
test("les changements de compte invalident aussi les imports d’images en cours",async t=>{
 const f=fixture(t);await f.w.refreshAgencies();f.w.editAgency();
 let finish,entered;const ready=new Promise(r=>entered=r);f.w.api.uploadCustomMedia=async kind=>{assert.equal(kind,'agency-image');entered();return new Promise(r=>finish=r);};
 const pending=f.w.uploadAgencyImage('logoUrl');await ready;f.setUid('another');finish({media:{url:'https://example.invalid/private.png'}});
 await pending;assert.equal(f.w.agencyState().editor,undefined);assert.doesNotMatch(f.w.renderAgencies(),/private.png/);
});
test("panne de service : aucun faux état vide ni avantage gratuit annoncé",async t=>{
 const {w}=fixture(t);w.api.agencies.list=async()=>{throw Error('Service non activé');};await w.refreshAgencies();
 const html=w.renderAgencies();assert.match(html,/Agences indisponibles/);assert.doesNotMatch(html,/premières agences partenaires arrivent/);
});

test("les erreurs natives sont expliquées sans jargon IPC et sans inventer un annuaire vide",async t=>{
 const {w}=fixture(t);w.api.agencies.list=async()=>{throw Error("Error invoking remote method 'agencies:list': Error: Service temporairement indisponible.");};
 await w.refreshAgencies();const html=w.renderAgencies();assert.match(html,/Service temporairement indisponible/);assert.doesNotMatch(html,/Error invoking remote method|premières agences partenaires arrivent/);
});
