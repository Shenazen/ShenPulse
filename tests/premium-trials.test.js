"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {createDefaultState}=require('../src/main/defaults');
const {applyTrialGrant,applyTrialRevocation,reconcileTrialAccess}=require('../src/main/trial-access');
const {normalizeTrialRequest}=require('../src/main/admin/commerce');
const {hasPremiumAccess}=require('../src/shared/pro-access');
function store(){const state=createDefaultState();state.settings.account.email='viewer@example.invalid';return{state,getState:()=>structuredClone(state),mutate:f=>f(state)};}
const now=Date.parse('2026-10-28T12:00:00Z');
test('le palier Premium est transmis explicitement et les demandes historiques restent Pro',()=>{
 assert.equal(normalizeTrialRequest({email:'viewer@example.invalid',subscription:true,subscriptionTier:'premium'},'owner').subscriptionTier,'premium');
 assert.equal(normalizeTrialRequest({email:'viewer@example.invalid',subscription:true},'owner').subscriptionTier,'pro');
 assert.throws(()=>normalizeTrialRequest({email:'viewer@example.invalid',subscription:true,subscriptionTier:'admin'},'owner'));
});
test('un essai Premium déverrouille les droits Premium et revient au Pro restant à son échéance',()=>{
 const s=store(),grant=(id,tier,expiresAtMs)=>({id,email:'viewer@example.invalid',subscriptionTrial:true,subscriptionTier:tier,expiresAtMs});
 applyTrialGrant(s,grant('pro','pro',now+10000),now);applyTrialGrant(s,grant('premium','premium',now+1000),now);
 assert.equal(hasPremiumAccess(s.state,now),true);assert.equal(s.state.commerce.subscription.expiresAtMs,now+1000);
 reconcileTrialAccess(s.state,s.state.commerce.trial.cachedGrants,now+1001);
 assert.equal(s.state.commerce.subscription.tier,'pro');assert.equal(hasPremiumAccess(s.state,now+1001),false);
});
test('un abonné Pro retrouve son abonnement inchangé après révocation de l’essai Premium',()=>{
 const s=store(),paid={tier:'pro',source:'own',status:'active',priceMonthly:9.99,renewalDate:'2026-11-15'};
 s.state.commerce.subscription=structuredClone(paid);s.state.commerce.gameEntitlements=['permanent'];
 applyTrialGrant(s,{id:'p',email:'viewer@example.invalid',subscriptionTrial:true,subscriptionTier:'premium',expiresAtMs:now+1000},now);
 assert.equal(s.state.commerce.subscription.tier,'premium');
 applyTrialRevocation(s,{trialId:'p'},now);assert.deepEqual(s.state.commerce.subscription,paid);assert.deepEqual(s.state.commerce.gameEntitlements,['permanent']);
});
test('un essai Pro ne remplace jamais Premium payé et le repli payé ne passe pas à un autre compte',()=>{
 const s=store();s.state.commerce.subscription={tier:'premium',source:'own',status:'active',priceMonthly:13.99};
 applyTrialGrant(s,{id:'p',email:'viewer@example.invalid',subscriptionTrial:true,subscriptionTier:'pro',expiresAtMs:now+1000},now);
 assert.equal(s.state.commerce.subscription.source,'own');
 s.state.commerce.subscription={tier:'pro',source:'own',status:'active'};
 applyTrialGrant(s,{id:'p',email:'viewer@example.invalid',subscriptionTrial:true,subscriptionTier:'premium',expiresAtMs:now+1000},now);
 s.state.settings.account.email='other@example.invalid';reconcileTrialAccess(s.state,[],now);
 assert.equal(s.state.commerce.subscription.tier,'free');
});

test('une réponse serveur Premium conserve le Pro payé sous-jacent et le supprime à la déconnexion',()=>{
 const {applyEntitlements,clearCommercialRights}=require('../src/main/account/entitlements');
 const s=store(),paid={tier:'pro',source:'own',status:'active',priceMonthly:9.99,renewalDate:'2026-11-15'};
 s.state.commerce.subscription=structuredClone(paid);
 const payload={tier:'premium',source:'trial',expiresAtMs:Date.now()+60000};
 applyEntitlements({store:s},payload);applyEntitlements({store:s},payload);
 assert.deepEqual(s.state.commerce.trial.baseSubscription,paid);
 reconcileTrialAccess(s.state,[],Date.now());
 assert.deepEqual(s.state.commerce.subscription,paid);
 applyEntitlements({store:s},payload);clearCommercialRights({store:s});
 assert.equal(s.state.commerce.trial.baseSubscription,null);
});

test('le formulaire réel propose Premium et son éditeur conserve le palier lors de l’envoi',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=await import('jsdom');
 const page=fs.readFileSync('src/renderer/app/features/admin/page.js','utf8'),editor=fs.readFileSync('src/renderer/app/features/admin/account.js','utf8');
 const fn=(s,name)=>s.match(new RegExp('^function '+name+'\\([\\s\\S]*?^}$','m'))[0];
 let configuration,sent;
 const context=vm.createContext({
  adminBusy:false,adminDashboard:{trials:{agencyCountingAvailable:true}},adminModuleError:()=>false,adminTrialRows:()=>[{id:'trial',email:'viewer@example.invalid',subscriptionTrial:true,subscriptionTier:'premium',gameTrialIds:[]}],
  adminTrialGameProducts:()=>[],adminTrialGameChoices:()=>'',adminTrialGameIdsFromForm:()=>[],
  escapeHtml:v=>String(v??''),formatAdminDate:()=>'',field:()=>'',openEditor:c=>configuration=c,
  api:{admin:{updateTrial:async v=>sent=v,dashboard:async()=>({})}}
 });
 vm.runInContext(['adminTrialAgencyCountingAvailable','adminTrialSubscriptionField','adminTrialSubscriptionFromForm','renderAdminTrials'].map(n=>fn(page,n)).join('\n')+'\n'+fn(editor,'openAdminTrialEditor'),context);
 let doc=new JSDOM(context.renderAdminTrials()).window.document;
 assert.deepEqual([...doc.querySelector('select[name="subscriptionTier"]').options].map(o=>o.textContent),['Aucun abonnement','Pro','Premium']);
 assert.equal(doc.querySelector('select').value,'pro');
 assert.equal(doc.querySelector('[name="countsForAgency"]').checked,false);
 assert.equal(doc.querySelector('[name="countsForAgency"]').disabled,false);
 assert.equal(doc.querySelector('.admin-trial-entitlements b').textContent,'PREMIUM');
 context.openAdminTrialEditor({id:'trial',subscriptionTrial:true,subscriptionTier:'premium',countsForAgency:true});
 doc=new JSDOM('<form>'+configuration.body+'</form>').window.document;
 assert.equal(doc.querySelector('select').value,'premium');
 assert.equal(doc.querySelector('[name="countsForAgency"]').checked,true);
 const data=new Map([['email','viewer@example.invalid'],['days','7'],['subscriptionTier','premium'],['countsForAgency','on']]);
 await configuration.onSubmit(data);assert.equal(sent.subscription,true);assert.equal(sent.subscriptionTier,'premium');
 assert.equal(sent.countsForAgency,true);
 data.set('subscriptionTier','none');data.set('games','on');
 await configuration.onSubmit(data);assert.equal(sent.subscription,false);assert.equal(sent.games,true);
 assert.equal(sent.countsForAgency,false);
});
