const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
function fixture(){
 let finish,uid="a";const pending=new Promise(r=>finish=r),calls=[];
 const context=vm.createContext({render:()=>{},toast:()=>{},registerActionHandler:()=>{},ACTION_NOT_HANDLED:Symbol(),captureCreatorPrivateOperation:()=>({uid}),assertCreatorPrivateOperation:o=>{if(o.uid!==uid)throw Error("Compte modifié");},refreshAgencies:()=>pending,agencyState:()=>({dashboard:{pricing:{quoted:{pro:14.99,premium:20.99}}}}),agencySubscriptionPlans:()=>[{tier:"pro",price:14.99},{tier:"premium",price:20.99}],perform:async fn=>fn(),api:{account:{startSubscriptionCheckout:async p=>{calls.push(p);return {cancelled:true};}}}});
 vm.runInContext('let subscriptionCheckoutBusyTier="";'+fs.readFileSync("src/renderer/app/actions/handlers/content-commerce.js","utf8"),context);
 return {context,calls,finish,setUid:value=>{uid=value;},run:()=>context.handleContentAndCommerceAction({action:"subscription-checkout",target:{dataset:{tier:"pro"}}})};
}
test("deux clics pendant la vérification du tarif ne démarrent qu’un parcours PayPal",async()=>{
 const f=fixture(),first=f.run(),second=f.run();f.finish();await Promise.all([first,second]);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].expectedPrice,14.99);
 assert.equal(vm.runInContext("subscriptionCheckoutBusyTier",f.context),"");
});
test("un changement de compte pendant la lecture du prix annule le clic avant d’ouvrir PayPal",async()=>{
 const f=fixture(),first=f.run();f.setUid("b");f.finish();await assert.rejects(first,/Compte modifié/);
 assert.equal(f.calls.length,0);assert.equal(vm.runInContext("subscriptionCheckoutBusyTier",f.context),"");
});
test("une panne de tarification bloque le paiement et libère le bouton",async()=>{
 const f=fixture();f.context.agencyState=()=>({error:"Serveur inaccessible"});
 const first=f.run();f.finish();await assert.rejects(first,/vérifier votre tarif/);
 assert.equal(f.calls.length,0);assert.equal(vm.runInContext("subscriptionCheckoutBusyTier",f.context),"");
});
