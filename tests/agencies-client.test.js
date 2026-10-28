const test=require("node:test"),assert=require("node:assert/strict");
const {agencyRequest}=require("../src/main/agency-service");
const {createStore,jsonResponse}=require("./helpers/account-service-fixtures");
function setup(fetchImpl){
 const store=createStore();store.state.settings.account={uid:"a",email:"a@example.invalid"};
 return {store,sessionGeneration:1,webOrigin:"https://example.invalid",fetch:fetchImpl,identityForInternalUse:async()=>({uid:"a",idToken:"private-test-token"})};
}
test("le client transmet uniquement le jeton au serveur et ne le renvoie pas au renderer",async()=>{
 let called;const service=setup(async(url,options)=>{called={url,options};return jsonResponse({ok:true,membership:null});});
 const result=await agencyRequest(service,"join",{code:"ABC"});
 assert.equal(called.url,"https://example.invalid/api/agencies/join");
 assert.equal(called.options.headers.Authorization,"Bearer private-test-token");
 assert.deepEqual(JSON.parse(called.options.body),{code:"ABC"});
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
