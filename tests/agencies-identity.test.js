
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
function fixture(t){
 const dom=new JSDOM('<input id="tiktok-username" value="first_name">',{runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window,timers=new Map(),calls=[];let serial=0,view={uid:'user',dashboard:{membership:{status:'pending'}}},refreshes=0,renders=0;
 w.setTimeout=(fn,delay)=>{const id=++serial;timers.set(id,{fn,delay});return id;};w.clearTimeout=id=>timers.delete(id);w.setInterval=()=>0;
 w.agencyState=()=>view;w.isAccountAuthenticated=()=>!!view.uid;w.rendererVisualsActive=()=>true;w.refreshAgencies=async()=>{refreshes++;};w.render=()=>{renders++;};
 w.api={agencies:{dashboard:async()=>{refreshes++;return structuredClone(view.dashboard);},command:async(c,b)=>{calls.push({command:c,body:b});return {ok:true,updated:true};}}};
 vm.runInContext('let currentPage="agencies";'+fs.readFileSync('src/renderer/app/features/agencies-identity.js','utf8'),dom.getInternalVMContext());
 return {w,calls,timers,view:()=>view,setView:v=>view=v,refreshes:()=>refreshes,renders:()=>renders,run:s=>vm.runInContext(s,dom.getInternalVMContext()),tick:async()=>{const [id,entry]=timers.entries().next().value;timers.delete(id);entry.fn();await new Promise(r=>setImmediate(r));}};
}
test('le @ est automatiquement publié pour une demande en attente sans modifier son statut',async t=>{
 const f=fixture(t);await f.w.synchronizeAgencyIdentity();
 assert.equal(f.calls[0].command,'updateIdentity');assert.equal(f.calls[0].body.tiktokUsername,'first_name');
 assert.equal(f.view().dashboard.membership.displayName,'@first_name');assert.equal(f.view().dashboard.membership.status,'pending');
 await f.w.synchronizeAgencyIdentity();assert.equal(f.calls.length,1);
});
test('les rafraîchissements LIVE ne repoussent pas sans fin le même @',async t=>{
 const f=fixture(t);f.w.scheduleAgencyIdentitySync();const first=[...f.timers.keys()][0];
 for(let i=0;i<100;i++)f.w.scheduleAgencyIdentitySync();
 assert.equal(f.timers.size,1);assert.equal([...f.timers.keys()][0],first);
 f.w.document.getElementById('tiktok-username').value='changed';f.w.scheduleAgencyIdentitySync();assert.equal(f.timers.size,1);
 await f.tick();assert.equal(f.calls[0].body.tiktokUsername,'changed');
});
test('effacer puis rétablir le @ annule le brouillon périmé sans perdre la prochaine synchronisation',async t=>{
 const f=fixture(t);f.w.scheduleAgencyIdentitySync();f.w.document.getElementById('tiktok-username').value='';f.w.scheduleAgencyIdentitySync();assert.equal(f.timers.size,0);
 f.w.document.getElementById('tiktok-username').value='first_name';f.w.scheduleAgencyIdentitySync();await f.tick();assert.equal(f.calls.length,1);
});
test('deux changements rapides sont sérialisés et le dernier @ gagne',async t=>{
 const f=fixture(t);let finish;
 f.w.api.agencies.command=async(c,b)=>{f.calls.push({command:c,body:b});if(f.calls.length===1)return new Promise(r=>finish=r);return {ok:true};};
 const pending=f.w.synchronizeAgencyIdentity();f.w.document.getElementById('tiktok-username').value='latest';f.w.scheduleAgencyIdentitySync();
 assert.equal(f.calls.length,1);finish({ok:true});await pending;await f.tick();
 assert.equal(f.calls.length,2);assert.equal(f.view().identityUsername,'latest');
});
test('un changement de compte isole une réponse tardive et ne reprogramme aucun ancien profil',async t=>{
 const f=fixture(t);let finish;f.w.api.agencies.command=async()=>new Promise(r=>finish=r);
 const pending=f.w.synchronizeAgencyIdentity();f.setView({uid:'other',dashboard:{membership:{status:'pending'}}});finish({ok:true});await pending;
 assert.equal(f.view().identityUsername,undefined);assert.equal(f.view().dashboard.membership.displayName,undefined);assert.equal(f.timers.size,0);
});
test('une coupure réseau prévoit une reprise bornée sans boucle de requêtes immédiates',async t=>{
 const f=fixture(t);f.w.api.agencies.command=async()=>{throw Error('Hors ligne');};
 await f.w.synchronizeAgencyIdentity();
 assert.equal(f.timers.size,1);assert.ok([...f.timers.values()][0].delay>=14000);assert.equal(f.view().identityUsername,undefined);
});
test('la liste du directeur s’actualise seulement sur la page visible et hors édition',async t=>{
 const f=fixture(t);f.setView({uid:'director',dashboard:{ownAgency:{id:'a'}}});
 await f.w.pollAgencyUpdates();assert.equal(f.refreshes(),1);
 f.view().editor={};f.w.pollAgencyUpdates();assert.equal(f.refreshes(),1);
 f.view().editor=null;f.run('currentPage="home"');f.w.pollAgencyUpdates();assert.equal(f.refreshes(),1);
 f.run('currentPage="agencies"');const dialog=f.w.document.createElement('dialog');dialog.setAttribute('open','');f.w.document.body.append(dialog);
 f.w.pollAgencyUpdates();assert.equal(f.refreshes(),1);
});
test('les comptes sans adhésion n’émettent aucune mise à jour d’identité',async t=>{
 const f=fixture(t);f.setView({uid:'user',dashboard:{membership:null}});f.w.scheduleAgencyIdentitySync();await f.w.synchronizeAgencyIdentity();
 assert.equal(f.calls.length,0);assert.equal(f.timers.size,0);
});

test('une lecture de fond inchangée n’affiche aucun chargement et ne redessine pas la page',async t=>{
 const f=fixture(t);f.setView({uid:'director',dashboard:{ownAgency:{id:'a'},members:[]},busy:false});
 await f.w.pollAgencyUpdates();
 assert.equal(f.refreshes(),1);assert.equal(f.renders(),0);assert.equal(f.view().busy,false);assert.equal(f.view().pollPending,false);
});

test('un nouveau membre apparaît sans recharger l’annuaire public',async t=>{
 const f=fixture(t);f.setView({uid:'director',dashboard:{ownAgency:{id:'a'},members:[]}});
 f.w.api.agencies.list=()=>{throw Error('L’annuaire public ne doit pas être relu');};
 f.w.api.agencies.dashboard=async()=>({ownAgency:{id:'a'},members:[{displayName:'@updated',status:'pending'}]});
 await f.w.pollAgencyUpdates();
 assert.equal(f.view().dashboard.members[0].displayName,'@updated');assert.equal(f.renders(),1);
});

test('une seule lecture est autorisée et une mutation invalide sa réponse tardive',async t=>{
 const f=fixture(t);f.setView({uid:'director',dashboard:{ownAgency:{id:'a'},members:[]}});
 let finish,reads=0;f.w.api.agencies.dashboard=()=>{reads++;return new Promise(r=>finish=r);};
 const pending=f.w.pollAgencyUpdates();await f.w.pollAgencyUpdates();assert.equal(reads,1);
 f.view().commandRevision=(f.view().commandRevision || 0)+1;
 f.view().dashboard.members=[{displayName:'@recent'}];finish({ownAgency:{id:'a'},members:[]});await pending;
 assert.equal(f.view().dashboard.members[0].displayName,'@recent');assert.equal(f.renders(),0);assert.equal(f.view().pollPending,false);
});

test('une saisie ou un changement de compte protège la page contre une réponse tardive',async t=>{
 const f=fixture(t);f.setView({uid:'director',dashboard:{ownAgency:{id:'a'},members:[]}});
 let finish;f.w.api.agencies.dashboard=()=>new Promise(r=>finish=r);
 const pending=f.w.pollAgencyUpdates();f.w.document.getElementById('tiktok-username').focus();
 finish({ownAgency:{id:'a'},members:[{displayName:'@late'}]});await pending;
 assert.equal(f.view().dashboard.members.length,0);assert.equal(f.renders(),0);
 f.w.document.activeElement.blur();
 const second=f.w.pollAgencyUpdates();f.setView({uid:'other',dashboard:{membership:null}});
 finish({ownAgency:{id:'a'},members:[{displayName:'@private'}]});await second;
 assert.equal(f.view().dashboard.membership,null);assert.equal(f.renders(),0);
});

test('la synchronisation du @ ne peut pas être écrasée par une ancienne lecture',async t=>{
 const f=fixture(t);f.view().identityUsername='old';
 let finish;f.w.api.agencies.dashboard=()=>new Promise(r=>finish=r);
 const pending=f.w.pollAgencyUpdates();await f.w.synchronizeAgencyIdentity();
 finish({membership:{status:'pending',displayName:'@old'}});await pending;
 assert.equal(f.view().dashboard.membership.displayName,'@first_name');assert.equal(f.renders(),0);
});

test('les erreurs de lecture restent silencieuses et une synchronisation en cours bloque les lectures',async t=>{
 const f=fixture(t);f.view().identityPending=Promise.resolve();await f.w.pollAgencyUpdates();assert.equal(f.refreshes(),0);
 f.view().identityPending=null;f.w.api.agencies.dashboard=async()=>{throw Error('Hors ligne');};
 await f.w.pollAgencyUpdates();assert.equal(f.view().error,undefined);assert.equal(f.view().pollPending,false);assert.equal(f.renders(),0);
});
