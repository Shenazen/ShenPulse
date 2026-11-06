const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(t){
 const dom=new JSDOM('<main></main><section id="editor"></section>',{runScripts:'outside-only'});t.after(()=>dom.window.close());
 const w=dom.window,calls=[];let uid='director',generation=1,editor;
 const pack={id:'pack',revision:1,title:'Équipe <20>',minimumCreators:20,maximumCreators:30,prices:{pro:850,premium:1200},belowMinimum:'block',additions:'prorata',removals:'renewal'};
 const data={uid:'director',ownAgency:{id:'a',ownerUid:'director',name:'Agence Alpha',status:'approved',code:'CODE-PRIVE',description:'Notre équipe'},members:Array.from({length:22},(_,i)=>({uid:'c'+i,agencyId:'a',status:'approved',displayName:'@createur_'+i,email:'c'+i+'@example.invalid',paidSubscription:i===0,paying:i===0,tier:'pro'})),directorPacksAvailable:true,packBillingAvailable:false,
 agencyPack:{terms:pack,revision:1,seats:Array.from({length:20},(_,i)=>({uid:'c'+i,tier:'pro'})),quote:{ready:true,effectiveMonthlyCents:17000,eligibleCreators:20,proCreators:20,premiumCreators:0,reasons:[]}}};
 data.members.push({uid:'pending',agencyId:'a',status:'pending'},{uid:'foreign',agencyId:'b',status:'approved'});
 w.escapeHtml=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 w.isAccountAuthenticated=()=>!!uid;w.creatorPrivateOperationUid=()=>uid;Object.defineProperty(w,'creatorPrivateOperationGeneration',{get:()=>generation});w.isVerifiedAdminSession=()=>uid==='admin';
 w.captureCreatorPrivateOperation=()=>({uid,generation});w.assertCreatorPrivateOperation=o=>{assert.equal(o.uid,uid);assert.equal(o.generation,generation);};
 w.renderStudioHero=()=>'<header>Agences</header>';w.confirmAction=async()=>true;w.requireAccountForAction=()=>false;w.canAccessFeature=()=>true;w.handleDashboardChartClick=()=>false;
 w.content=w.document.querySelector('main');w.dialog=w.document.querySelector('#editor');w.dialogBody=w.dialog;w.accountMenu=w.document.createElement('aside');w.accountMenuButton=w.document.createElement('button');
 w.HTMLElement.prototype.scrollIntoView=function(){this.dataset.scrolled='true';};
 w.openEditor=o=>{editor=o;w.dialog.innerHTML='<form>'+o.body+'</form>';};
 w.render=()=>{if(w.renderAgencies)w.content.innerHTML=w.renderAgencies();};
 w.api={agencies:{list:async()=>({agencies:[]}),dashboard:async()=>structuredClone(data),command:async(c,b)=>{calls.push([c,b]);if(c==='selectOwnPack')data.agencyPack.seats=structuredClone(b.seats);return {ok:true,quote:{ready:true,effectiveMonthlyCents:19050,eligibleCreators:22,proCreators:21,premiumCreators:1,reasons:[]}};}},admin:{agenciesCommand:()=>assert.fail('Aucune commande administrateur pour un fondateur')}};
 const files=['actions/handlers/contracts.js','features/agencies-layout.js','features/agencies-director.js','features/agencies-forms.js','features/agencies.js','features/agency-packs.js','features/agency-pack-editors.js','features/agencies-space.js','features/agencies-billing.js','actions/dispatcher.js','core/events/content.js'];
 vm.runInContext('let currentPage="agencies";const STUDIO_PREFERENCE_ACTIONS=new Set();'+files.map(f=>fs.readFileSync(path.join(__dirname,'../src/renderer/app',f),'utf8')).join('\n'),dom.getInternalVMContext());
 return {w,data,calls,get editor(){return editor;},form:()=>w.dialog.querySelector('form'),formData:()=>new w.FormData(w.dialog.querySelector('form')),setUid:v=>{uid=v;},reconnect:()=>generation++,run:s=>vm.runInContext(s,dom.getInternalVMContext())};
}
test('Invitations est le seul panneau par défaut, avec les statistiques et les onglets accessibles',async t=>{
 const f=fixture(t);await f.w.refreshAgencies();const space=f.w.content.querySelector('#agency-owner-space');
 assert.match(space.textContent,/Mon espace agence/);assert.equal(space.querySelector('#agency-invitation-code').value,'CODE-PRIVE');
 assert.equal(space.querySelectorAll('[role="tabpanel"]').length,1);assert.equal(space.querySelectorAll('[role="tab"]').length,4);
 assert.equal(space.querySelector('[aria-selected="true"]').dataset.section,'invitation');
 assert.equal(space.querySelector('#agency-space-pack'),null);assert.equal(space.querySelector('.agency-director-members'),null);assert.equal(space.querySelector('.agency-director-progress'),null);
 assert.equal(space.querySelectorAll('.agency-director-stat').length,3);
 assert.equal(f.calls.length,0);
});
test('seul le fondateur validé voit cet espace et les offres privées',async t=>{
 const f=fixture(t);
 for(const status of ['pending','rejected','suspended']){f.data.ownAgency.status=status;await f.w.refreshAgencies();assert.doesNotMatch(f.w.content.textContent,/Mon espace agence|Équipe <20>|Paliers des agences/);}
 f.data.ownAgency.status='approved';f.setUid('other');await f.w.refreshAgencies();assert.doesNotMatch(f.w.content.innerHTML,/CODE-PRIVE|Équipe &lt;20>/);
 await assert.rejects(f.w.handleAgencySpaceAction({action:'agency-space-pack-edit'}),/réservé/);
});
test('le vrai clic ouvre les comptes acceptés, permet les formules et enregistre une seule sélection privée',async t=>{
 const f=fixture(t);await f.w.refreshAgencies();f.w.content.querySelector('[data-section="pack"]').click();await tick();f.w.content.querySelector('[data-action="agency-space-pack-edit"]').click();await tick();
 assert.equal(f.editor.submitLabel,'Enregistrer la sélection');const form=f.form();assert.equal(form.querySelectorAll('input[name="seat"]').length,22);assert.equal(form.querySelectorAll('input[name="seat"]:checked').length,20);
 assert.equal(form.querySelector('[value="foreign"]'),null);assert.equal(form.querySelector('[value="pending"]'),null);assert.match(form.textContent,/abonnement personnel actif/);
 form.querySelector('[data-pack-select-all]').click();form.elements.namedItem('seatTier:c0').value='premium';form.elements.namedItem('seatTier:c0').dispatchEvent(new f.w.Event('change',{bubbles:true}));
 assert.match(form.querySelector('[data-pack-selection-count]').textContent,/22/);
 form.querySelector('[data-action="agency-space-pack-preview"]').click();await tick();assert.equal(f.calls[0][0],'previewOwnPack');assert.equal(f.calls[0][1].seats.length,22);
 assert.match(form.querySelector('[data-space-pack-summary]').textContent,/190,50/);assert.equal(f.calls.some(([c])=>c==='selectOwnPack'),false);
 await f.editor.onSubmit(f.formData());assert.equal(f.calls.at(-1)[0],'selectOwnPack');assert.equal(f.calls.at(-1)[1].seats[0].tier,'premium');assert.equal(f.calls.at(-1)[1].expectedRevision,1);
 assert.equal(f.calls.at(-1)[1].agencyId,undefined);assert.equal(f.calls.at(-1)[1].prices,undefined);
});
test('les réponses lentes ne rétablissent pas une estimation périmée ou celle d’un autre compte',async t=>{
 const f=fixture(t);await f.w.refreshAgencies();f.w.openAgencySpacePackEditor();let finish;f.w.api.agencies.command=()=>new Promise(r=>finish=r);
 const form=f.form(),button=form.querySelector('[data-action="agency-space-pack-preview"]');const request=f.w.previewAgencySpacePack(button);
 form.querySelector('input[name="seat"]').click();finish({ok:true,quote:{effectiveMonthlyCents:1}});await request;
 assert.match(form.querySelector('[data-space-pack-summary]').textContent,/Sélection modifiée/);assert.equal(button.disabled,false);
 const second=f.w.previewAgencySpacePack(button);f.reconnect();finish({ok:true,quote:{effectiveMonthlyCents:1}});await assert.rejects(second);
 assert.match(form.querySelector('[data-space-pack-summary]').textContent,/Sélection modifiée/);
});
test('annuler ne transmet rien ; une erreur de sauvegarde conserve la sélection',async t=>{
 const f=fixture(t);await f.w.refreshAgencies();f.w.openAgencySpacePackEditor();assert.equal(f.calls.length,0);
 f.w.dialog.innerHTML='';assert.equal(f.calls.length,0);
 f.w.openAgencySpacePackEditor();const form=f.form();form.querySelector('input[name="seat"]').click();
 f.w.api.agencies.command=async()=>{throw Error('Connexion interrompue');};
 await assert.rejects(f.editor.onSubmit(f.formData()),/Connexion interrompue/);assert.equal(form.querySelectorAll('input[name="seat"]:checked').length,19);
});
test('sans pack attribué, aucun onglet ni panneau d’offre groupée n’est accessible',async t=>{
 const f=fixture(t);
 for(const offer of [null,{terms:null}]){
  f.data.agencyPack=offer;await f.w.refreshAgencies();
  assert.equal(f.w.content.querySelector('[data-section="pack"]'),null);
  assert.equal(f.w.content.querySelectorAll('[role="tab"]').length,3);
  assert.equal(f.w.content.querySelector('.agency-space-nav').dataset.sectionCount,'3');
  assert.equal(f.w.selectAgencySpaceSection('pack'),false);
  assert.equal(f.w.content.querySelector('#agency-space-pack'),null);
  assert.equal(f.w.content.querySelector('[data-action="agency-space-pack-edit"]'),null);
  assert.doesNotMatch(f.w.content.textContent,/Mon offre groupée|Lorsqu’un pack négocié/);
  assert.equal(f.w.content.querySelector('[aria-selected="true"]').dataset.section,'invitation');
 }
 f.data.directorPacksAvailable=false;await f.w.refreshAgencies();
 assert.equal(f.w.content.querySelector('[data-section="pack"]'),null);
 assert.equal(f.calls.length,0);
});

test('une attribution affiche l’onglet, son retrait rétablit Invitations après actualisation',async t=>{
 const f=fixture(t),offer=f.data.agencyPack;
 f.data.agencyPack=null;await f.w.refreshAgencies();assert.equal(f.w.content.querySelector('[data-section="pack"]'),null);
 f.data.agencyPack=offer;await f.w.refreshAgencies();
 assert.equal(f.w.content.querySelectorAll('[role="tab"]').length,4);
 f.w.content.querySelector('[data-section="pack"]').click();await tick();
 assert.match(f.w.content.querySelector('[role="tabpanel"]').textContent,/Équipe <20>/);
 f.data.agencyPack=null;await f.w.refreshAgencies();
 assert.equal(f.w.content.querySelector('[data-section="pack"]'),null);
 assert.equal(f.w.content.querySelector('[aria-selected="true"]').dataset.section,'invitation');
 assert.ok(f.w.content.querySelector('.agency-invitation'));
 f.data.agencyPack=offer;await f.w.refreshAgencies();
 assert.equal(f.w.content.querySelector('[aria-selected="true"]').dataset.section,'invitation');
 f.data.directorPacksAvailable=false;await f.w.refreshAgencies();
 assert.equal(f.w.content.querySelector('[data-section="pack"]'),null);
 assert.equal(f.calls.length,0);
});

test('la navigation au clavier saute l’offre groupée lorsqu’aucun pack n’est attribué',async t=>{
 const f=fixture(t);f.data.agencyPack=null;await f.w.refreshAgencies();
 const key=value=>{const button=f.w.content.querySelector('[aria-selected="true"]');button.focus();button.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));};
 key('ArrowRight');assert.equal(f.w.document.activeElement.dataset.section,'members');
 key('ArrowRight');assert.equal(f.w.document.activeElement.dataset.section,'tiers');
 key('ArrowLeft');assert.equal(f.w.document.activeElement.dataset.section,'members');
 key('End');assert.equal(f.w.document.activeElement.dataset.section,'tiers');
 key('ArrowRight');assert.equal(f.w.document.activeElement.dataset.section,'invitation');
 assert.equal(f.w.content.querySelector('[data-section="pack"]'),null);
 assert.equal(f.calls.length,0);
});

test('les vrais clics remplacent le panneau sans afficher les autres rubriques ni redessiner le résumé',async t=>{
 const f=fixture(t);await f.w.refreshAgencies();const stats=f.w.content.querySelector('.agency-director-stats');
 const expected={members:'.agency-director-members',pack:'.agency-space-pack',tiers:'.agency-director-progress',invitation:'.agency-invitation'};
 for(const key of ['members','pack','tiers','invitation']){
  f.w.content.querySelector('[role="tab"][data-section="'+key+'"]').click();await tick();
  const root=f.w.content.querySelector('#agency-owner-space'),panel=root.querySelector('[role="tabpanel"]');
  assert.ok(panel.querySelector(expected[key]),key);assert.equal(panel.getAttribute('aria-labelledby'),'agency-space-tab-'+key);
  for(const [other,selector]of Object.entries(expected))if(other!==key)assert.equal(panel.querySelector(selector),null,key+' masque '+other);
  assert.equal(root.querySelectorAll('[aria-selected="true"]').length,1);assert.equal(root.querySelector('[aria-selected="true"]').dataset.section,key);
  assert.equal(f.w.document.activeElement.id,'agency-space-tab-'+key);assert.equal(root.querySelector('.agency-director-stats'),stats);
 }
 assert.equal(f.calls.length,0);
});
test('le panneau sélectionné survit aux actualisations et se réinitialise pour une autre agence ou session',async t=>{
 const f=fixture(t);await f.w.refreshAgencies();f.w.selectAgencySpaceSection('members');await f.w.refreshAgencies();
 assert.ok(f.w.content.querySelector('.agency-director-members'));assert.equal(f.w.content.querySelector('.agency-invitation'),null);
 f.data.ownAgency.id='replacement';await f.w.refreshAgencies();assert.ok(f.w.content.querySelector('.agency-invitation'));
 f.w.selectAgencySpaceSection('pack');f.reconnect();await f.w.refreshAgencies();assert.ok(f.w.content.querySelector('.agency-invitation'));assert.equal(f.w.content.querySelector('.agency-space-pack'),null);
});
test('flèches, Début et Fin changent le seul panneau actif et le focus, sans déplacer la page',async t=>{
 const f=fixture(t);await f.w.refreshAgencies();const key=value=>{const button=f.w.content.querySelector('[aria-selected="true"]');button.focus();button.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));};
 key('ArrowRight');assert.ok(f.w.content.querySelector('.agency-director-members'));
 key('End');assert.equal(f.w.document.activeElement.dataset.section,'tiers');assert.equal(f.w.content.querySelectorAll('.agency-tier').length,3);
 key('ArrowRight');assert.equal(f.w.document.activeElement.dataset.section,'invitation');
 key('ArrowLeft');assert.equal(f.w.document.activeElement.dataset.section,'tiers');
 key('Home');assert.equal(f.w.document.activeElement.dataset.section,'invitation');
 assert.equal(f.w.selectAgencySpaceSection('inconnu'),false);assert.equal(f.w.content.querySelector('[aria-selected="true"]').dataset.section,'invitation');
 assert.equal(f.calls.length,0);
});
test('le paiement du pack exige une confirmation explicite du fondateur, via les vrais clics',async t=>{
 const f=fixture(t);f.data.packBillingAvailable=true;f.data.agencyPack.billing={available:true,status:'none'};
 const calls=[];f.w.api.agencies.command=async(c,b)=>{calls.push([c,b]);return c==='previewPackBilling'?{ok:true,previewId:'quote-private',kind:'checkout',monthlyCents:17000,nextMonthlyCents:17000,creators:20}:{ok:true,checkoutCompleted:true};};
 await f.w.refreshAgencies();f.w.selectAgencySpaceSection('pack');f.w.content.querySelector('[data-action="agency-billing-preview"]').click();await tick();
 assert.match(f.form().textContent,/170,00/);assert.equal(calls.length,1);assert.equal(calls[0][0],'previewPackBilling');
 await assert.rejects(f.editor.onSubmit(f.formData()),/Confirmez/);assert.equal(calls.length,1);
 f.form().querySelector('[name="billingConsent"]').checked=true;await f.editor.onSubmit(f.formData());assert.equal(calls.at(-1)[0],'checkoutOwnPack');assert.equal(calls.at(-1)[1].previewId,'quote-private');
});
test('la facture et les réglages de paiement ne peuvent ouvrir un domaine usurpé',async t=>{
 const f=fixture(t);assert.equal(f.w.agencyBillingUrl('https://invoice.stripe.com/i/test'),'https://invoice.stripe.com/i/test');
 for(const url of ['https://invoice.stripe.com.attacker.invalid/i/test','http://billing.stripe.com/x','https://user:pass@billing.stripe.com/x'])assert.throws(()=>f.w.agencyBillingUrl(url));
});
test('un changement de compte pendant la simulation financière ne montre pas une confirmation étrangère',async t=>{
 const f=fixture(t);f.data.packBillingAvailable=true;await f.w.refreshAgencies();let finish;f.w.api.agencies.command=()=>new Promise(r=>finish=r);const pending=f.w.openAgencyBillingConfirmation();f.reconnect();finish({previewId:'wrong-account',kind:'checkout',monthlyCents:17000,nextMonthlyCents:17000});await assert.rejects(pending);assert.equal(f.editor,undefined);
});
