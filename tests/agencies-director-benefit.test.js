"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const {applyEntitlements}=require("../src/main/account/entitlements");
const {createStore}=require("./helpers/account-service-fixtures");
const access=require("../src/shared/pro-access");
test("Pro Diamant est gratuit, limité au Pro et expire si la vérification serveur ne peut plus être renouvelée",()=>{
 const store=createStore(),now=Date.now(),service={store};
 applyEntitlements(service,{source:"agencyReward",tier:"pro",priceMonthly:999,expiresAtMs:now+600000,checkedAt:new Date(now).toISOString()});
 assert.equal(store.state.commerce.subscription.source,"agencyReward");
 assert.equal(store.state.commerce.subscription.priceMonthly,0);
 assert.equal(access.hasProAccess(store.state,now),true);
 assert.equal(access.hasProAccess(store.state,now+600001),false);
 applyEntitlements(service,{source:"agencyReward",tier:"pro"});
 assert.equal(access.hasProAccess(store.state),false);
 applyEntitlements(service,{source:"agencyReward",tier:"premium",expiresAtMs:now+600000});
 assert.equal(store.state.commerce.subscription.tier,"free");
 applyEntitlements(service,{source:"agencyReward",tier:"pro",expiresAtMs:now-1});
 assert.equal(access.hasProAccess(store.state),false);
 applyEntitlements(service,{source:"agencyReward",tier:"pro",expiresAtMs:now+86400000});
 assert.ok(store.state.commerce.subscription.expiresAtMs<=Date.now()+15*60000);
 applyEntitlements(service,{source:"free",tier:"free"});
 assert.equal(store.state.commerce.subscription.source,"free");
});
test("le backend qualifié privilégie un abonnement personnel et dérive ensuite le droit Diamant du serveur",async()=>{
 const {integrateAgencyBackend}=await import("../backend/agencies/integrate.mjs");
 const baseline=".artifacts/agencies/baseline";
 if(!fs.existsSync(baseline+"/payments.js"))return;
 const source=integrateAgencyBackend(fs.readFileSync(baseline+"/payments.js","utf8"),fs.readFileSync(baseline+"/index.js","utf8")).payments;
 const fn=source.match(/^export async function publicEntitlementPayload\([\s\S]*?^}/m)[0].replace(/^export /,"");
 let own={tier:"premium",status:"active",priceMonthly:20.99},calls=0;
 const context={
  cleanUidForDatabase:v=>v,accountEmailForUid:async()=>"director@example.invalid",applyPendingAdminTrialForUser:async()=>{},
  subscriptionSnapshot:async()=>own,activeSubscriptionTier:s=>s.status==="active"?s.tier:"free",
  publicEntitlementResponse:o=>o,agencyService:{directorReward:async()=>{calls++;return {source:"agencyReward",tier:"pro",priceMonthly:0};}},
  activeSubscriptionTrial:async()=>null,activePremiumSeatGrantForUser:async()=>null
 };
 const get=vm.runInNewContext("("+fn+")",context);
 let result=await get("director");assert.equal(result.source,"own");assert.equal(result.tier,"premium");assert.equal(calls,0);
 own={};result=await get("director");assert.equal(result.source,"agencyReward");assert.equal(calls,1);
 context.agencyService.directorReward=async()=>null;
 result=await get("director");assert.equal(result.tier,undefined);assert.equal(result.source,undefined);
});
