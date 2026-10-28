const test=require("node:test"),assert=require("node:assert/strict");
const {agencyRequest}=require("../src/main/agency-service");
const {createStore,jsonResponse}=require("./helpers/account-service-fixtures");
function setup(fetchImpl){
 const store=createStore();store.state.settings.account={uid:"a",email:"a@example.invalid"};store.state.settings.tiktok={username:"creator_test"};
 return {store,sessionGeneration:1,webOrigin:"https://example.invalid",fetch:fetchImpl,identityForInternalUse:async()=>({uid:"a",idToken:"private-test-token"})};
}
test("le client transmet uniquement le jeton au serveur et ne le renvoie pas au renderer",async()=>{
 let called;const service=setup(async(url,options)=>{called={url,options};return jsonResponse({ok:true,membership:null});});
 const result=await agencyRequest(service,"join",{code:"ABC"});
 assert.equal(called.url,"https://example.invalid/api/agencies/join");
 assert.equal(called.options.headers.Authorization,"Bearer private-test-token");
 assert.deepEqual(JSON.parse(called.options.body),{code:"ABC",agencyId:"",tiktokUsername:"creator_test",displayName:"@creator_test"});
 assert.equal(JSON.stringify(result).includes("private-test-token"),false);
});
test("une réponse du compte A ne peut pas être affichée après un changement de session",async()=>{
 let finish,entered;const ready=new Promise(r=>entered=r),response=new Promise(r=>finish=r);
 const service=setup(async()=>{entered();return response;});
 const request=agencyRequest(service,"dashboard");await ready;
 service.sessionGeneration++;service.store.state.settings.account.uid="b";finish(jsonResponse({members:[{email:"private@example.invalid"}]}));
 await assert.rejects(request,{code:"ACCOUNT_SESSION_CHANGED"});
});
test("les commandes arbitraires et administrateur sont bloquées par le client courant",async()=>{
 const service=setup(()=>assert.fail("aucune requête"));
 await assert.rejects(agencyRequest(service,"../admin"));
 await assert.rejects(agencyRequest(service,"reviewAgency"));
});
test("un annuaire public ne joint pas de jeton ; les pannes ne créent pas de faux membres",async()=>{
 const service=setup(async(_u,o)=>{assert.equal(o.headers.Authorization,undefined);return jsonResponse({ok:true,agencies:[]});});
 assert.deepEqual(await agencyRequest(service,"list"),{ok:true,agencies:[]});
 service.fetch=async()=>jsonResponse({},404);
 await assert.rejects(agencyRequest(service,"dashboard"),/pas encore disponible/);
});


test("une page HTML ou une réponse incomplète ne simule pas un annuaire vide",async()=>{
 const service=setup(async()=>({ok:true,status:200,text:async()=>"<html>Application</html>"}));
 await assert.rejects(agencyRequest(service,"list"),/pas encore disponible/);
 service.fetch=async()=>jsonResponse({ok:true});
 await assert.rejects(agencyRequest(service,"list"),/pas encore disponible/);
 await assert.rejects(agencyRequest(service,"dashboard"),/pas encore disponible/);
});

test("le canal administration refuse toute commande de gestion de membres avant le réseau",async()=>{
 const service=setup(()=>assert.fail('Aucune requête admin de gestion de membres'));
 await assert.rejects(agencyRequest(service,'adminReviewMember',{uid:'member',status:'approved'},true),/inconnue|fondateur/);
 await assert.rejects(agencyRequest(service,'reviewMember',{uid:'member',status:'approved'},true),/fondateur/);
});

test("l’identité automatique suit le @ courant et n’accepte aucun UID ou statut fourni",async()=>{
 let sent;const service=setup(async(url,options)=>{sent={url,body:JSON.parse(options.body)};return jsonResponse({ok:true,updated:true});});
 await agencyRequest(service,'updateIdentity',{tiktokUsername:' @Changed.Name ',uid:'other',status:'approved'});
 assert.equal(sent.url,'https://example.invalid/api/agencies/identity');assert.deepEqual(sent.body,{tiktokUsername:'changed.name'});
 service.store.state.settings.tiktok.username='saved_name';
 await agencyRequest(service,'join',{code:'CODE',displayName:'Autre'});
 assert.equal(sent.body.tiktokUsername,'saved_name');assert.equal(sent.body.displayName,'@saved_name');
});
test("une adhésion sans @ configuré est refusée avant tout envoi réseau",async()=>{
 const service=setup(()=>assert.fail('aucune requête'));service.store.state.settings.tiktok.username='';
 await assert.rejects(agencyRequest(service,'join',{code:'CODE'}),/TikTok/);
 await assert.rejects(agencyRequest(service,'updateIdentity',{tiktokUsername:'invalid @ name'}),/TikTok/);
});

test('le renouvellement d’invitation transmet seulement le code attendu et garde les gardes de compte',async()=>{
 let sent;const service=setup(async(url,options)=>{sent={url,body:JSON.parse(options.body),headers:options.headers};return jsonResponse({ok:true});});
 await agencyRequest(service,'rotateCode',{expectedCode:'OLD',code:'FORCED',uid:'other',agencyId:'other'});
 assert.equal(sent.url,'https://example.invalid/api/agencies/invitation/rotate');assert.deepEqual(sent.body,{expectedCode:'OLD'});
 assert.equal(sent.headers.Authorization,'Bearer private-test-token');
 await assert.rejects(agencyRequest(service,'rotateCode',{expectedCode:'OLD'},true),/fondateur/);
});
