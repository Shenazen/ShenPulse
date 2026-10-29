const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const {JSDOM}=require("jsdom");
function fixture(t){
 const dom=new JSDOM('<input id="tiktok-username" value="demo_creator"><main></main>',{runScripts:"outside-only"});t.after(()=>dom.window.close());
 const w=dom.window,calls=[],confirmations=[];let uid="creator";
 w.escapeHtml=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;");
 w.isAccountAuthenticated=()=>!!uid;w.creatorPrivateOperationUid=()=>uid;w.creatorPrivateOperationGeneration=1;
 w.isVerifiedAdminSession=()=>uid==="admin";w.render=()=>{};w.registerActionHandler=()=>{};w.syncMembershipPopup=()=>{};
 w.captureCreatorPrivateOperation=()=>({uid});w.assertCreatorPrivateOperation=o=>assert.equal(o.uid,uid);
 w.openEditor=o=>calls.push(o);w.confirmAction=async(message,options)=>{confirmations.push({message,...options});return true;};w.openAccountLogin=()=>calls.push("login");
 const prices={public:{pro:14.99,premium:20.99},agency:{pro:9.99,premium:13.99}};
 w.api={agencies:{list:async()=>({agencies:[],prices}),dashboard:async()=>({uid,membership:null,ownAgency:null,members:[],pricing:{quoted:prices.public}}),command:async(...a)=>calls.push(a)},admin:{agenciesDashboard:async()=>({allAgencies:[],members:[]})}};
 vm.runInContext('let currentPage="agencies";const ACTION_NOT_HANDLED=Symbol();const SUBSCRIPTION_PLANS=[{tier:"free",price:0},{tier:"pro",price:14.99},{tier:"premium",price:20.99}];'+["studio-design.js","agencies-layout.js","agencies-director.js","agencies-forms.js","agencies.js","agencies-identity.js"].map(file=>fs.readFileSync(path.join(__dirname,"../src/renderer/app/features",file),"utf8")).join("\n"),dom.getInternalVMContext());
 return {w,calls,confirmations,setUid:v=>{uid=v;},run:s=>vm.runInContext(s,dom.getInternalVMContext())};
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
 w.api.agencies.dashboard=async()=>({ownAgency:{id:"agency",name:"Équipe Test",status:"approved",code:"TESTCODE",description:"Une équipe"},members:[{uid:"m",agencyId:"agency",email:"m@example.invalid",displayName:"Membre",status:"pending"}],pricing:{quoted:{pro:9.99,premium:13.99},eligible:true}});
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

test("le directeur distingue un essai comptabilisé d’un paiement et d’une adhésion en attente",async t=>{
 const {w}=fixture(t);
 const html=w.agencyMemberRows([
  {uid:'trial',displayName:'Essai choisi',status:'approved',paying:true,tier:'premium',paidSubscription:false,countingSource:'trial'},
  {uid:'paid',displayName:'Abonné payé',status:'approved',paying:true,tier:'pro',paidSubscription:true,countingSource:'paypal'},
  {uid:'pending',displayName:'Demande',status:'pending',paying:true,tier:'premium',countingSource:'trial'}
 ]);
 const doc=new JSDOM(html).window.document,rows=[...doc.querySelectorAll('.agency-member')];
 assert.match(rows.find(r=>r.textContent.includes('Essai choisi')).textContent,/PREMIUM · essai comptabilisé/);
 assert.match(rows.find(r=>r.textContent.includes('Abonné payé')).textContent,/PRO · abonnement actif/);
 assert.match(rows.find(r=>r.textContent.includes('Demande')).textContent,/Accès non comptabilisé/);
 assert.doesNotMatch(rows.find(r=>r.textContent.includes('Essai choisi')).textContent,/abonnement actif/);
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
 assert.equal(calls.at(-1)[0],'join');assert.equal(calls.at(-1)[1].code,'CODE-TEST');assert.equal(calls.at(-1)[1].tiktokUsername,'demo_creator');
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

function agencyProfileForm(f) {
 f.w.editAgency();
 const main=f.w.document.querySelector('main');main.innerHTML=f.w.renderAgencies();
 const form=main.querySelector('#agency-profile-form');
 form.elements.name.value='Agence exemple';form.elements.description.value='Une présentation valide de notre agence.';
 return form;
}
test("l’envoi confirmé affiche une popup de réception après la réponse serveur uniquement",async t=>{
 const f=fixture(t);await f.w.refreshAgencies();const form=agencyProfileForm(f);
 let finish;f.w.api.agencies.command=()=>new Promise(resolve=>finish=resolve);
 const pending=f.w.submitAgencyForm(form);
 assert.equal(f.confirmations.length,0);assert.equal(f.w.agencyState().busy,true);
 finish({ok:true});await pending;
 assert.equal(f.confirmations.length,1);
 assert.equal(f.confirmations[0].title,'Demande envoyée');
 assert.match(f.confirmations[0].message,/bien été reçue/);
 assert.match(f.confirmations[0].message,/en attente de validation/);
 assert.equal(f.confirmations[0].acknowledge,true);
 assert.equal(f.confirmations[0].danger,false);
 assert.equal(f.confirmations[0].confirmLabel,'Compris');
 assert.equal(f.w.agencyState().editor,null);
});
test("une modification confirmée ne prétend pas créer une nouvelle demande",async t=>{
 const f=fixture(t);
 f.w.api.agencies.dashboard=async()=>({ownAgency:{id:'existing',status:'approved',name:'Agence existante',description:'Présentation existante.'},members:[]});
 await f.w.refreshAgencies();await f.w.submitAgencyForm(agencyProfileForm(f));
 assert.equal(f.confirmations[0].title,'Fiche mise à jour');
 assert.match(f.confirmations[0].message,/modifications ont bien été enregistrées/);
 assert.doesNotMatch(f.confirmations[0].message,/en attente/);
});
test("échec, formulaire incomplet et annulation ne montrent pas de fausse confirmation",async t=>{
 const f=fixture(t);await f.w.refreshAgencies();const form=agencyProfileForm(f);
 form.elements.name.value='';await f.w.submitAgencyForm(form);
 assert.equal(f.calls.length,0);assert.equal(f.confirmations.length,0);
 form.elements.name.value='Agence exemple';f.w.api.agencies.command=async()=>{throw Error('Panne réseau');};
 await f.w.submitAgencyForm(form);
 assert.match(f.w.agencyState().formError,/Panne réseau/);assert.ok(f.w.agencyState().editor);
 await f.w.handleAgencyAction({action:'agency-cancel-edit',target:{dataset:{}}});
 assert.equal(f.confirmations.length,0);
});
test("un envoi terminé après un changement de compte ne montre pas la popup au compte suivant",async t=>{
 const f=fixture(t);await f.w.refreshAgencies();const form=agencyProfileForm(f);
 let finish;f.w.api.agencies.command=()=>new Promise(resolve=>finish=resolve);
 const pending=f.w.submitAgencyForm(form);f.setUid('another');finish({ok:true});await pending;
 assert.equal(f.confirmations.length,0);assert.equal(f.w.agencyState().editor,undefined);
});
test("un défaut d’actualisation après sauvegarde conserve une confirmation honnête",async t=>{
 const f=fixture(t);await f.w.refreshAgencies();const form=agencyProfileForm(f);
 f.w.api.agencies.command=async()=>{f.w.api.agencies.list=async()=>{throw Error('Annuaire indisponible');};return {ok:true};};
 await f.w.submitAgencyForm(form);
 assert.equal(f.confirmations.length,1);assert.match(f.w.agencyState().error,/Annuaire indisponible/);
});
test("le bloc Mon agence est privé et disparaît pour les autres comptes",async t=>{
 const f=fixture(t);
 f.w.api.agencies.dashboard=async()=>({ownAgency:{id:'private',name:'Fiche privée',status:'pending',description:'Présentation confidentielle.'},members:[]});
 await f.w.refreshAgencies();
 assert.match(f.w.renderAgencies(),/Visible uniquement par vous et l’administration ShenPulse/);
 assert.match(f.w.renderAgencies(),/Fiche privée/);
 f.setUid('another');assert.doesNotMatch(f.w.renderAgencies(),/Fiche privée|MON AGENCE/);
 f.setUid('');assert.doesNotMatch(f.w.renderAgencies(),/Fiche privée|MON AGENCE/);
});
test("la revue administrateur présente logo, bannière et fiche complète sans exposer le code privé",async t=>{
 const f=fixture(t);f.setUid('admin');
 f.w.api.admin.agenciesDashboard=async()=>({allAgencies:[{id:'a',name:'Agence <Test>',status:'pending',description:'Une équipe <script> dangereuse',contactEmail:'director@example.invalid',logoUrl:'https://example.invalid/logo.png',bannerUrl:'https://example.invalid/banner.jpg',language:'fr',website:'https://example.invalid/',code:'CODE-PRIVE'}],members:[]});
 await f.w.refreshAgencies(true);
 const main=f.w.document.querySelector('main');main.innerHTML=f.w.renderAdminAgencies();
 assert.equal(main.querySelector('.agency-profile-cover img').src,'https://example.invalid/banner.jpg');
 assert.equal(main.querySelector('.agency-profile-logo img').src,'https://example.invalid/logo.png');
 assert.equal(main.querySelector('.agency-profile-cover img').alt,'Bannière de Agence <Test>');
 assert.match(main.textContent,/director@example.invalid/);assert.match(main.textContent,/Français/);
 assert.equal(main.querySelectorAll('[data-action="agency-review"]').length,3);
 assert.equal(main.querySelector('script'),null);
 assert.doesNotMatch(main.innerHTML,/CODE-PRIVE/);
 f.setUid('another');assert.equal(f.w.renderAdminAgencies(),'');
});
test("la revue reste lisible sans images et délègue la gestion des membres au fondateur",async t=>{
 const f=fixture(t);f.setUid('admin');
 f.w.api.admin.agenciesDashboard=async()=>({allAgencies:[{id:'a',name:'Sans image',status:'approved',description:'Une agence sans image.'}],members:[{agencyId:'a',uid:'m',email:'m@example.invalid',status:'pending'}]});
 await f.w.refreshAgencies(true);
 const main=f.w.document.querySelector('main');main.innerHTML=f.w.renderAdminAgencies();
 assert.equal(main.querySelectorAll('.agency-profile-header img').length,0);
 assert.match(main.textContent,/Bannière non renseignée/);
 assert.equal(main.querySelector('.agency-profile-logo').textContent,'SA');
 assert.equal(main.querySelector('[data-action="agency-member"]'),null);
 assert.doesNotMatch(main.textContent,/Demandes et membres|m@example.invalid/);
});

test("les cartes publiques et privées gardent une présentation compacte dépliable sans perdre les décisions",async t=>{
 const f=fixture(t),description='Notre présentation détaillée <script> reste du texte. '.repeat(35);
 const agency={id:'a',name:'Une agence avec un nom long',description,status:'pending',level:'silver',payingCount:3,bannerUrl:'https://example.invalid/banner.webp'};
 let main=f.w.document.querySelector('main');main.innerHTML=f.w.renderAgencyCard(agency);
 const details=main.querySelector('details.agency-card-description');assert.ok(details);assert.equal(details.open,false);
 assert.equal(details.querySelector('p').textContent,description);assert.equal(main.querySelector('script'),null);
 details.open=true;assert.equal(details.querySelector('p').textContent,description);
 assert.equal(main.querySelectorAll('[data-action="agency-join"]').length,1);
 f.setUid('admin');f.w.api.admin.agenciesDashboard=async()=>({allAgencies:[agency,{...agency,id:'b',name:'Autre agence',status:'approved'}],members:[]});
 await f.w.refreshAgencies(true);main.innerHTML=f.w.renderAdminAgencies();
 assert.equal(main.querySelectorAll('.agency-review-grid > .agency-review-card').length,2);
 assert.equal(main.querySelectorAll('details.agency-card-description').length,2);
 assert.equal(main.querySelectorAll('[data-action="agency-review"]').length,5);
 assert.equal(main.querySelectorAll('[data-action="agency-member"]').length,0);
});

test("l’en-tête Agences reprend le composant illustré commun et son affiche dédiée",async t=>{
 const {w}=fixture(t);await w.refreshAgencies();
 const main=w.document.querySelector('main');main.innerHTML=w.renderAgencies();
 const hero=main.querySelector('[data-studio-hero="agencies"]');assert.ok(hero);
 assert.equal(hero.querySelector('h2').textContent,'Agences');
 assert.equal(hero.querySelector('.studio-hero-art').getAttribute('src'),'assets/studio/agencies.webp');
 assert.equal(hero.querySelector('.studio-hero-art').getAttribute('fetchpriority'),'high');
});
test("les cadres Argent, Or et Diamant sont identiques entre paliers et fiches de l’annuaire",async t=>{
 const {w}=fixture(t);const agencies=['silver','gold','diamond'].map((level,i)=>({id:level,name:'Agence '+level,description:'Notre agence partenaire.',payingCount:[4,12,30][i],level}));
 w.api.agencies.list=async()=>({agencies});w.api.agencies.dashboard=async()=>({ownAgency:{id:"owned",status:"approved"},members:[]});await w.refreshAgencies();
 const main=w.document.querySelector('main');main.innerHTML=w.renderAgencies();
 for(const level of ['silver','gold','diamond']){
   assert.ok(main.querySelector('.agency-tier.agency-tier-frame.agency-level-'+level),level+' palier');
   assert.ok(main.querySelector('.agency-card.agency-tier-frame.agency-level-'+level),level+' agence');
 }
 assert.equal(main.querySelectorAll('.agency-tier-emblem').length,3);
 assert.equal(main.querySelectorAll('.agency-card-members').length,3);
 assert.doesNotMatch(w.renderAgencyCard({id:'invalid',name:'Test',description:'Test',level:'unknown injected'}),/agency-level-unknown|injected/);
});
test("les agences se classent par créateurs abonnés décroissants sans changer le catalogue reçu",async t=>{
 const {w}=fixture(t);
 const agencies=[{id:'small',name:'Petite',payingCount:3,level:'silver'},{id:'same-z',name:'Zèbre',payingCount:12,level:'gold'},{id:'large',name:'Grande',payingCount:40,level:'diamond'},{id:'same-a',name:'Alpha',payingCount:12,level:'gold'}].map(a=>({...a,description:'Une agence partenaire.'}));
 w.api.agencies.list=async()=>({agencies});await w.refreshAgencies();
 const main=w.document.querySelector('main');main.innerHTML=w.renderAgencies();
 assert.deepEqual(Array.from(main.querySelectorAll('.agency-directory [data-action="agency-join"]'),b=>b.dataset.id),['large','same-a','same-z','small']);
 assert.deepEqual(agencies.map(a=>a.id),['small','same-z','large','same-a']);
 assert.match(main.querySelector('.agency-card-members').textContent,/40 créateurs abonnés/);
});

test("Mon agence regroupe les demandes en attente, les membres et leurs commandes",async t=>{
 const f=fixture(t);
 f.w.api.agencies.dashboard=async()=>({ownAgency:{id:'owned',name:'Mon équipe',status:'approved',description:'Notre équipe.',code:'PRIVATE'},members:[
 {uid:'p',agencyId:'owned',email:'pending@example.invalid',displayName:'En attente',status:'pending'},
 {uid:'a',agencyId:'owned',email:'accepted@example.invalid',displayName:'Accepté',status:'approved',paying:true,tier:'pro'}
 ]});
 await f.w.refreshAgencies();
 const main=f.w.document.querySelector('main');main.innerHTML=f.w.renderAgencies();
 assert.match(main.textContent,/MON AGENCE/);assert.match(main.textContent,/Demandes et membres/);
 assert.match(main.textContent,/1 demande en attente/);
 assert.equal(main.querySelectorAll('[data-action="agency-member"]').length,3);
 assert.equal(main.querySelectorAll('[data-admin]').length,0);
 await f.w.handleAgencyAction({action:'agency-member',id:'p',target:{dataset:{status:'approved',admin:'true'}}});
 assert.equal(f.calls.at(-1)[0],'reviewMember');
});
test("une agence en attente explique où son fondateur gérera les adhésions",async t=>{
 const f=fixture(t);
 f.w.api.agencies.dashboard=async()=>({ownAgency:{id:'owned',name:'Mon agence',status:'pending',description:'Notre équipe.'},members:[]});
 await f.w.refreshAgencies();
 const main=f.w.document.querySelector('main');main.innerHTML=f.w.renderAgencies();
 assert.match(main.textContent,/gérer leurs demandes ici/);
 assert.equal(main.querySelector('[data-action="agency-member"]'),null);
});
test("l’administration garde uniquement les décisions sur les agences et les effectifs agrégés",async t=>{
 const f=fixture(t);f.setUid('admin');
 f.w.api.admin.agenciesDashboard=async()=>({allAgencies:[{id:'a',name:'Agence exemple',status:'approved',description:'Agence à contrôler.'}],members:[
 {agencyId:'a',uid:'paid',email:'private@example.invalid',status:'approved',paying:true,tier:'pro'},
 {agencyId:'a',uid:'request',email:'pending@example.invalid',status:'pending'}
 ]});
 await f.w.refreshAgencies(true);
 const main=f.w.document.querySelector('main');main.innerHTML=f.w.renderAdminAgencies();
 assert.equal(main.querySelectorAll('[data-action="agency-review"]').length,2);
 assert.equal(main.querySelectorAll('[data-action="agency-member"]').length,0);
 assert.doesNotMatch(main.textContent,/Demandes et membres|private@example.invalid|pending@example.invalid/);
 assert.match(main.textContent,/1 abonnement actif/);
});
test("un ancien bouton d’administration ou un tiers ne déclenche aucune gestion d’adhésion",async t=>{
 const f=fixture(t);f.setUid('admin');await f.w.refreshAgencies();
 await assert.rejects(f.w.handleAgencyAction({action:'agency-member',id:'foreign',target:{dataset:{status:'approved',admin:'true'}}}),/Mon agence/);
 assert.equal(f.calls.length,0);assert.equal(f.confirmations.length,0);
});
test("changer de compte pendant la confirmation annule la décision du fondateur",async t=>{
 const f=fixture(t);
 f.w.api.agencies.dashboard=async()=>({ownAgency:{id:'a',status:'approved'},members:[{uid:'m',agencyId:'a',status:'pending'}]});
 await f.w.refreshAgencies();
 f.w.confirmAction=async()=>{f.setUid('another');return true;};
 await assert.rejects(f.w.handleAgencyAction({action:'agency-member',id:'m',target:{dataset:{status:'approved'}}}));
 assert.equal(f.calls.length,0);
});

test("le code envoie la demande directement avec le @ courant sans second formulaire",async t=>{
 const f=fixture(t);await f.w.refreshAgencies();
 f.w.document.getElementById('tiktok-username').value='@New.Handle';
 await f.w.joinAgency('',' AGENCY-CODE ');
 assert.equal(f.calls.length,1);assert.equal(f.calls[0][0],'join');
 assert.equal(f.calls[0][1].code,'AGENCY-CODE');assert.equal(f.calls[0][1].tiktokUsername,'new.handle');
 assert.equal(f.calls.some(c=>c?.onSubmit),false);
 assert.match(f.confirmations.at(-1).message,/@new.handle.*transmise au directeur/);
 assert.equal(f.w.agencyState().joinCode,'');
});
test("sans @ en haut, aucun champ de pseudo séparé ni demande anonyme n’est envoyé",async t=>{
 const f=fixture(t);await f.w.refreshAgencies();f.w.document.getElementById('tiktok-username').value='';
 await f.w.joinAgency('','CODE');
 assert.equal(f.calls.length,0);assert.match(f.confirmations.at(-1).title,/TikTok nécessaire/);
 assert.doesNotMatch(f.w.renderAgencies(),/name="displayName"/);
});
test("un code refusé reste saisi et ne produit aucune fausse confirmation",async t=>{
 const f=fixture(t);await f.w.refreshAgencies();
 f.w.api.agencies.command=async()=>{throw Error('Code introuvable');};
 await f.w.joinAgency('','CODE-ERRONE');
 assert.equal(f.w.agencyState().joinCode,'CODE-ERRONE');assert.match(f.w.renderAgencies(),/Code introuvable/);
 assert.equal(f.confirmations.length,0);
});
test("deux clics n’envoient qu’une demande ; une réponse tardive ne confirme rien au compte suivant",async t=>{
 const f=fixture(t);await f.w.refreshAgencies();let finish,calls=0;
 f.w.api.agencies.command=async()=>{calls++;return new Promise(r=>finish=r);};
 const pending=f.w.joinAgency('','CODE');await f.w.joinAgency('','CODE');assert.equal(calls,1);
 f.setUid('other');finish({ok:true});await pending;
 assert.equal(f.confirmations.length,0);assert.equal(f.w.agencyState().dashboard,null);
});

test('les paliers sont réservés au fondateur connecté dont l’agence est validée',async t=>{
 const f=fixture(t);
 for(const status of ['pending','rejected','suspended','approved']){
  f.w.api.agencies.dashboard=async()=>({ownAgency:{id:'owned',ownerUid:'creator',name:'Mon agence',status,description:'Notre équipe.',code:'PRIVATE'},members:[]});
  await f.w.refreshAgencies();const main=f.w.document.querySelector('main');main.innerHTML=f.w.renderAgencies();
  assert.equal(!!main.querySelector('.agency-tiers-section'),status==='approved',status);
  assert.equal(!!main.querySelector('[data-action="agency-rotate-code"]'),status==='approved',status);
 }
 f.setUid('other');await f.w.refreshAgencies();assert.doesNotMatch(f.w.renderAgencies(),/Paliers des agences|PRIVATE|MON AGENCE/);
 f.setUid('');await f.w.refreshAgencies();assert.doesNotMatch(f.w.renderAgencies(),/Paliers des agences|PRIVATE|MON AGENCE/);
});

test('l’espace fondateur distingue les statistiques, l’invitation et les membres sans champ gris',async t=>{
 const f=fixture(t);f.w.api.agencies.dashboard=async()=>({ownAgency:{id:'a',ownerUid:'creator',name:'Agence <Test>',description:'Notre équipe.',code:'CODE',status:'approved'},members:[
 {uid:'pending',agencyId:'a',status:'pending',displayName:'@attente'},
 {uid:'paid',agencyId:'a',status:'approved',paying:true,tier:'pro',displayName:'@abonne'},
 {uid:'free',agencyId:'a',status:'approved',paying:false,displayName:'@gratuit'},
 {uid:'left',agencyId:'a',status:'left',displayName:'@parti'}
 ]});await f.w.refreshAgencies();
 const main=f.w.document.querySelector('main');main.innerHTML=f.w.renderAgencies();
 assert.ok(main.querySelector('.agency-director'));assert.equal(main.querySelectorAll('.agency-director-stat').length,3);
 assert.match(main.querySelector('.agency-director-stats').textContent,/2.*membres validés.*1.*demandes en attente.*1.*abonnements actifs/s);
 assert.equal(main.querySelector('#agency-invitation-code').readOnly,true);
 assert.ok(main.querySelector('.agency-director-members [data-action="agency-member"]'));
 assert.match(main.querySelector('.agency-invitation').textContent,/ancien code.*inactifs.*membres/s);
 assert.ok(main.querySelector('progress'));assert.equal(main.querySelector("test"),null);
});

test('la régénération demande confirmation, recharge le code et ne gère aucun membre',async t=>{
 const f=fixture(t);let code='OLD';f.w.api.agencies.dashboard=async()=>({ownAgency:{id:'a',status:'approved',code,name:'Agence',description:'Notre équipe.'},members:[]});
 f.w.api.agencies.command=async(c,b)=>{f.calls.push([c,b]);if(c==='rotateCode')code='NEW';};
 await f.w.refreshAgencies();await f.w.handleAgencyAction({action:'agency-rotate-code',target:{dataset:{}}});
 assert.equal(f.calls[0][0],'rotateCode');assert.equal(f.calls[0][1].expectedCode,'OLD');
 assert.equal(f.w.agencyState().dashboard.ownAgency.code,'NEW');
 assert.match(f.confirmations[0].message,/ancien code.*inactifs/s);assert.match(f.confirmations[0].message,/membres.*conservés/s);
 assert.equal(f.confirmations[1].title,'Nouveau code créé');
});

test('annulation, compte changé ou agence non validée ne peuvent régénérer le code',async t=>{
 const f=fixture(t);f.w.api.agencies.dashboard=async()=>({ownAgency:{id:'a',status:'approved',code:'OLD'},members:[]});await f.w.refreshAgencies();
 f.w.confirmAction=async()=>false;await f.w.handleAgencyAction({action:'agency-rotate-code',target:{dataset:{}}});assert.equal(f.calls.length,0);
 f.w.confirmAction=async()=>{f.setUid('other');return true;};
 await assert.rejects(f.w.handleAgencyAction({action:'agency-rotate-code',target:{dataset:{}}}));assert.equal(f.calls.length,0);
 await f.w.refreshAgencies();f.w.agencyState().dashboard.ownAgency.status='pending';
 await assert.rejects(f.w.handleAgencyAction({action:'agency-rotate-code',target:{dataset:{}}}),/validée/);assert.equal(f.calls.length,0);
});

test('deux clics et un échec ne remplacent pas un code qui n’a pas été régénéré',async t=>{
 const f=fixture(t);f.w.api.agencies.dashboard=async()=>({ownAgency:{id:'a',status:'approved',code:'OLD'},members:[]});await f.w.refreshAgencies();
 let finish;f.w.confirmAction=()=>new Promise(r=>finish=r);
 const first=f.w.handleAgencyAction({action:'agency-rotate-code',target:{dataset:{}}});await f.w.handleAgencyAction({action:'agency-rotate-code',target:{dataset:{}}});
 f.w.api.agencies.command=async()=>{throw Error('Panne réseau');};finish(true);await assert.rejects(first,/Panne/);
 assert.equal(f.w.agencyState().dashboard.ownAgency.code,'OLD');assert.equal(f.w.agencyState().rotationPending,false);
});

test('un code renouvelé reste masqué si sa relecture échoue, sans recopier l’ancien',async t=>{
 const f=fixture(t);f.w.api.agencies.dashboard=async()=>({ownAgency:{id:'a',status:'approved',code:'OLD',name:'Agence'},members:[]});await f.w.refreshAgencies();
 f.w.api.agencies.command=async()=>{f.w.api.agencies.list=async()=>{throw Error('Actualisation impossible');};};
 await f.w.handleAgencyAction({action:'agency-rotate-code',target:{dataset:{}}});
 const main=f.w.document.querySelector('main');main.innerHTML=f.w.renderAgencies();
 assert.equal(main.querySelector('#agency-invitation-code').value,'');
 assert.ok(Array.from(main.querySelectorAll('.agency-invitation [data-action="agency-copy"]')).every(b=>b.disabled));
 assert.ok(main.querySelector('.agency-invitation [data-action="agency-refresh"]'));
});

test('une régénération terminée après un changement de compte n’affiche aucune confirmation privée',async t=>{
 const f=fixture(t);f.w.api.agencies.dashboard=async()=>({ownAgency:{id:'a',status:'approved',code:'OLD'},members:[]});await f.w.refreshAgencies();
 let finish;f.w.api.agencies.command=()=>new Promise(r=>finish=r);
 const pending=f.w.handleAgencyAction({action:'agency-rotate-code',target:{dataset:{}}});await new Promise(r=>setImmediate(r));
 f.setUid('other');finish({ok:true});await assert.rejects(pending);
 assert.equal(f.confirmations.length,1);assert.equal(f.w.agencyState().invalidatedCode,undefined);
});
