"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),{JSDOM}=require("jsdom");
function fixture(t){
 const dom=new JSDOM('<nav id="navigation"></nav>',{runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;
 Object.assign(w,{
  snapshot:{state:{commerce:{subscription:{tier:'pro',status:'active',source:'own'}}}},
  siteVisibility:{},visibilityTools:require('../src/shared/visibility-catalog'),
  accountSession:{authenticated:true,uid:'user',email:'user@example.invalid'},adminSession:{authorized:false},ADMIN_OWNER_EMAIL:'owner@example.invalid',
  navigation:w.document.querySelector('nav'),navigationStructureSignature:'',currentPage:'home',
  canonicalActionType:v=>v,pages:[{id:'membership',label:'Abonnement'},{id:'games',label:'Jeux vidéo'},{id:'irl',label:'Machines IRL',count:()=>5},{id:'commands',label:'Commandes'}],
  escapeHtml:v=>String(v),navigationIcon:()=>'',toast:()=>{},openMembershipPopup:()=>{},
  hasProAccess:()=>w.ShenPulseProAccess.hasProAccess(w.snapshot.state)
 });
 const context=dom.getInternalVMContext();
 for(const file of ['src/shared/pro-access.js','src/renderer/app/core/access-navigation.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
 return w;
}
test('le badge Premium termine la ligne IRL et seul Premium ouvre sa page et ses actions',t=>{
 const w=fixture(t);w.renderNavigation();const item=w.navigation.querySelector('[data-navigate="irl"]');
 assert.equal(item.querySelector('.nav-meta').lastElementChild.textContent,'PREMIUM');
 assert.equal(item.querySelector('.nav-count').textContent,'5');assert.equal(item.dataset.premiumRequired,'true');
 assert.equal(w.navigation.querySelector('[data-navigate="games"] .nav-pro-badge').textContent,'PRO');
 for(const subscription of [
  {tier:'pro',status:'active',source:'own'},
  {tier:'pro',status:'trial',source:'trial',expiresAtMs:Date.now()+10000},
  {tier:'pro',status:'active',source:'premiumSeat'},
  {tier:'pro',status:'active',source:'agencyReward',expiresAtMs:Date.now()+10000},
  {tier:'premium',status:'active',source:'own'}
 ]){
  w.snapshot.state.commerce.subscription=subscription;const allowed=subscription.tier==='premium';
  assert.equal(w.canNavigateTo('irl'),allowed);assert.equal(w.canAccessFeature('irl.shelly'),allowed);assert.equal(w.canAccessActionType('irl.shelly'),allowed);
  assert.equal(w.canNavigateTo('games'),true);
 }
 w.siteVisibility={navigation:{irl:'hidden'}};assert.equal(w.canNavigateTo('irl'),false);assert.equal(w.canAccessActionType('irl.shelly'),false);
});
test('le clic Pro sur Machines IRL ouvre seulement les offres',t=>{
 const w=fixture(t);let opened=0;w.openMembershipPopup=()=>opened++;
 assert.equal(w.showProNavigationOffers('irl'),true);assert.equal(opened,1);
 w.snapshot.state.commerce.subscription={tier:'premium',status:'active'};assert.equal(w.showProNavigationOffers('irl'),false);assert.equal(opened,1);
});
