"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {normalizeTrialRequest}=require('../src/main/admin/commerce');
const {AdminService,ADMIN_EMAIL}=require('../src/main/admin-service');
const fn=(source,name)=>source.match(new RegExp('^function '+name+'\\([\\s\\S]*?^}$','m'))?.[0];

test('le comptage nécessite un essai abonnement et reste désactivé par défaut',()=>{
  assert.equal(normalizeTrialRequest({email:'test@example.invalid',subscription:true},'owner').countsForAgency,false);
  assert.equal(normalizeTrialRequest({email:'test@example.invalid',subscription:true,subscriptionTier:'premium',countsForAgency:true},'owner').countsForAgency,true);
  assert.throws(()=>normalizeTrialRequest({email:'test@example.invalid',games:true,countsForAgency:true},'owner'),/Pro ou Premium/);
});

test('modifier uniquement le comptage ne transmet ni durée, ni palier, ni identité bénéficiaire arbitraire',async()=>{
  let sent;
  const service=new AdminService({store:{getState:()=>({settings:{admin:{}}})},accountService:{identityForInternalUse:async()=>({uid:'owner',email:ADMIN_EMAIL,emailVerified:true,idToken:'test-token'})},fetchImpl:async(url,options)=>{sent={url,body:JSON.parse(options.body)};return{ok:true,text:async()=>JSON.stringify({ok:true,onlyAgencyCounting:true})};}});
  await service.status();
  await service.updateTrial({trialId:'viewer:group',countsForAgency:true,onlyAgencyCounting:true,days:365,tier:'premium',email:'other@example.invalid',ownerId:'intruder'});
  assert.deepEqual(sent.body,{ownerId:'owner',trialId:'viewer:group',onlyAgencyCounting:true,countsForAgency:true});
  assert.match(sent.url,/\/api\/admin\/trials\/update$/);
  await assert.rejects(service.updateTrial({trialId:'viewer:group',countsForAgency:'true',onlyAgencyCounting:true}),/invalide/);
});

test('le canal IPC de comptage ne révoque ni ne réapplique les droits du compte local',async()=>{
  const {registerAdminIpc}=require('../src/main/ipc/admin'),handlers=new Map();let received;
  registerAdminIpc({handle:(name,handler)=>handlers.set(name,handler),core:{snapshot(){throw Error('Pas de mutation de droits');},overlayServer:{refreshAccess(){throw Error('Pas de mutation des accès overlay');}}},store:{getState(){throw Error('Pas de lecture des droits locaux');},mutate(){throw Error('Pas de mutation locale');}},adminService:{updateTrial:async data=>{received=data;return{ok:true,onlyAgencyCounting:true};}}});
  await handlers.get('admin:trial-update')({}, {trialId:'viewer:group',onlyAgencyCounting:true,countsForAgency:true});
  assert.equal(received.countsForAgency,true);
});

test('les formulaires bloquent un jeu seul et un ancien serveur, sans effacer les réglages des jeux',async()=>{
  const {JSDOM}=await import('jsdom'),page=fs.readFileSync('src/renderer/app/features/admin/page.js','utf8');
  const c=vm.createContext({adminDashboard:{trials:{agencyCountingAvailable:true}}});
  vm.runInContext(['adminTrialAgencyCountingAvailable','adminTrialSubscriptionField','syncAdminTrialGameSelection'].map(n=>fn(page,n)).join('\n'),c);
  const doc=new JSDOM('<form>'+c.adminTrialSubscriptionField('premium',true)+'<input name="games" type="checkbox" checked><input data-admin-trial-game-option type="checkbox" checked></form>').window.document;
  const select=doc.querySelector('select'),box=doc.querySelector('[name="countsForAgency"]');
  assert.equal(box.checked,true);select.value='none';c.syncAdminTrialGameSelection(select);
  assert.equal(box.disabled,true);assert.equal(box.checked,false);assert.equal(doc.querySelector('[data-admin-trial-game-option]').checked,true);
  select.value='pro';c.syncAdminTrialGameSelection(select);assert.equal(box.disabled,false);assert.equal(box.checked,false);
  c.adminDashboard.trials.agencyCountingAvailable=false;c.syncAdminTrialGameSelection(select);assert.equal(box.disabled,true);
});

test('le bouton de liste ne modifie que le comptage et restaure la page après un échec',async()=>{
  const source=fs.readFileSync('src/renderer/app/actions/handlers/admin-irl.js','utf8');let sent,fail=false,refreshes=0;
  const row={id:'viewer:group',subscriptionTrial:true,countsForAgency:false,expiresAt:'2030-01-01',durationDays:365};
  const c=vm.createContext({registerActionHandler:()=>{},ACTION_NOT_HANDLED:Symbol(),adminBusy:false,adminDashboard:{},adminModuleError:()=>false,adminTrialAgencyCountingAvailable:()=>true,adminTrialRows:()=>[row],render:()=>{},restoreAdminTrialFormInteractivity:()=>{refreshes++;},perform:async work=>work(),api:{admin:{updateTrial:async request=>{sent=request;if(fail)throw Error('Réseau indisponible');},dashboard:async()=>({trials:[]})}}});
  vm.runInContext(source,c);
  await c.handleAdminAndIrlAction({action:'admin-trial-agency-counting',id:row.id});
  assert.deepEqual(JSON.parse(JSON.stringify(sent)),{trialId:row.id,onlyAgencyCounting:true,countsForAgency:true});
  assert.equal(row.durationDays,365);assert.equal(row.expiresAt,'2030-01-01');assert.equal(c.adminBusy,false);
  fail=true;await assert.rejects(c.handleAdminAndIrlAction({action:'admin-trial-agency-counting',id:row.id}),/Réseau/);
  assert.equal(c.adminBusy,false);assert.equal(refreshes,2);assert.equal(row.countsForAgency,false);
});
