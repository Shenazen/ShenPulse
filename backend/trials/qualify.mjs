import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { integratePremiumTrials } from './integrate.mjs';

// Les fonctions exercées sont extraites du vrai serveur préparé, jamais réécrites.
export async function qualifyPremiumTrials(source) {
 const names=['grantAdminTrial','updateAdminTrial','revokeAdminTrial','appendAdminTrialApplicationUpdates',
 'applyPendingAdminTrialForUser','listAdminTrials','activeSubscriptionTrial','publicEntitlementPayload',
 'normalizeAdminTrialPayload','normalizePendingAdminTrialPayload','adminTrialBaseFromPendingTrial',
 'createPendingAdminTrialSummary','addAdminTrialGroup','adminTrialGroupKey','parseAdminTrialSummaryId',
 'adminTrialStartMs','normalizeTimedTrial','activeGameEntitlement','permanentGameEntitlement','timedGrantExpired',
 'timedGrantExpiryMs','normalizePayPalTime','normalizeStoredTier','normalizeTrialDays','requestedTrialGameIds',
 'normalizeTrialGameIds','normalizeAccountEmail','validAccountEmail','emailIndexKey','adminTrialGrantPath',
 'cleanUidForDatabase','safeCommerceId','paymentError','requestedTrialSubscriptionTier',
 'activeSubscriptionTier','publicEntitlementResponse'];
 const functions=names.map(name=>{
  const fn=source.match(new RegExp('^(?:export )?(?:async )?function '+name+'\\([\\s\\S]*?^}$', 'm'))?.[0];
  if(!fn)throw Error('Fonction absente '+name);return fn.replace(/^export /,'');
 }).join('\n');
 const data={users:{viewer:{profile:{email:'viewer@example.invalid'},subscription:{tier:'pro',status:'active',priceMonthly:9.99}}}};
 const accounts=new Map([['viewer@example.invalid','viewer']]);
 const get=path=>path.split('/').filter(Boolean).reduce((v,k)=>v?.[k],data);
 const set=(path,val)=>{const parts=path.split('/').filter(Boolean);let o=data;for(const k of parts.slice(0,-1))o=o[k]??={};if(val===null)delete o[parts.at(-1)];else o[parts.at(-1)]=structuredClone(val);};
 const snapshot=(v,key)=>({key,val:()=>structuredClone(v??null),exists:()=>v!=null,forEach:fn=>Object.entries(v??{}).forEach(([k,x])=>fn(snapshot(x,k)))});
 const db={ref(path=''){return{get:async()=>snapshot(get(path)),remove:async()=>set(path,null),update:async patches=>{for(const[k,v]of Object.entries(patches))set(path?path+'/'+k:k,v);}};}};
 const catalog={products:{permanent:{id:'permanent',enabled:true,accessMode:'purchase'},temporary:{id:'temporary',enabled:true,accessMode:'purchase'}}};
 const context=vm.createContext({
  Date,ServerValue:{TIMESTAMP:Date.now()},paypalCurrency:'EUR',gameCatalog:{},
  firebaseAdmin:()=>({db}),
  requireVerifiedAuthenticatedUser:async r=>r.admin?{uid:'owner',email:'owner@example.invalid'}:Promise.reject(Object.assign(Error('Interdit'),{statusCode:403})),
  isPremiumSeatUnlimitedAdmin:a=>a.uid==='owner',
  commerceCatalogSnapshot:async()=>catalog,
  userByAccountEmail:async email=>accounts.has(email)?{uid:accounts.get(email)}:null,
  accountEmailForUid:async uid=>get('users/'+uid+'/profile/email'),
  subscriptionSnapshot:async uid=>get('users/'+uid+'/subscription')??{},
  activeTrialGameEntitlements:async()=>[],
  activePremiumSeatGrantForUser:async()=>null,
  agencyService:{directorReward:async()=>null}
 });
 vm.runInContext(functions,context);
 const run=(name,...args)=>context[name](...args),admin={admin:true},checks=[];
 const plain=v=>JSON.parse(JSON.stringify(v));
 const paid=structuredClone(data.users.viewer.subscription);
 data.users.viewer.entitlements={games:{permanent:{source:'purchase',status:'active'}}};
 const body={email:'viewer@example.invalid',days:7,subscription:true,subscriptionTier:'premium',games:true};
 let grant=await run('grantAdminTrial',admin,body);
 assert.equal(grant.subscriptionTier,'premium');
 assert.equal(get('users/viewer/trials/subscription/tier'),'premium');
 assert.deepEqual(data.users.viewer.subscription,paid);
 assert.equal(get('users/viewer/entitlements/games/permanent/source'),'purchase');
 assert.equal(get('users/viewer/entitlements/games/temporary/source'),'trial');
 checks.push('Accès Premium et jeux offerts sans modifier le Pro payé ni les achats');
 let entitlement=await run('publicEntitlementPayload','viewer');
 assert.equal(entitlement.tier,'premium');assert.equal(entitlement.source,'trial');assert.equal(entitlement.expiresAtMs,grant.expiresAtMs);
 checks.push('Essai Premium prioritaire sur Pro payé et expiration exacte');
 let rows=(await run('listAdminTrials',admin)).trials;
 assert.equal(rows[0].subscriptionTier,'premium');assert.equal(rows[0].subscriptionTrial,true);
 const beforeInvalid=structuredClone(data);
 await assert.rejects(run('updateAdminTrial',admin,{...body,trialId:grant.id,subscriptionTier:'admin'}),{statusCode:400});
 assert.deepEqual(data,beforeInvalid);checks.push('Modification invalide refusée avant toute révocation');
 await assert.rejects(run('grantAdminTrial',{},body),{statusCode:403});
 await assert.rejects(run('listAdminTrials',{}),{statusCode:403});
 await assert.rejects(run('revokeAdminTrial',{}, {trialId:grant.id}),{statusCode:403});
 checks.push('Attribution, liste et révocation réservées à l’administrateur');
 await run('revokeAdminTrial',admin,{trialId:grant.id});
 entitlement=await run('publicEntitlementPayload','viewer');
 assert.equal(entitlement.tier,'pro');assert.equal(entitlement.source,'own');assert.deepEqual(data.users.viewer.subscription,paid);
 assert.equal(get('users/viewer/entitlements/games/permanent/source'),'purchase');
 assert.equal(get('users/viewer/entitlements/games/temporary'),undefined);
 checks.push('Révocation Premium : retour au Pro payé, achat conservé');
 grant=await run('grantAdminTrial',admin,{...body,games:false});
 get('users/viewer/trials/subscription').expiresAtMs=Date.now()-1;
 entitlement=await run('publicEntitlementPayload','viewer');assert.equal(entitlement.tier,'pro');assert.equal(entitlement.source,'own');
 checks.push('Expiration : rétablissement du Pro payé');
 data.users.viewer.subscription={tier:'premium',status:'active',priceMonthly:13.99};
 grant=await run('grantAdminTrial',admin,{...body,games:false,subscriptionTier:'pro'});
 entitlement=await run('publicEntitlementPayload','viewer');assert.equal(entitlement.tier,'premium');assert.equal(entitlement.source,'own');
 checks.push('Un essai Pro ne dégrade pas Premium payé');
 data.users.viewer.subscription={tier:'free',status:'free'};
 grant=await run('updateAdminTrial',admin,{...body,games:false,trialId:grant.id});
 assert.equal(grant.subscriptionTier,'premium');assert.equal((await run('publicEntitlementPayload','viewer')).tier,'premium');
 checks.push('Modification Pro vers Premium sur un compte gratuit');
 await run('revokeAdminTrial',admin,{trialId:grant.id});
 assert.equal((await run('publicEntitlementPayload','viewer')).tier,'free');
 const pending=await run('grantAdminTrial',admin,{email:'future@example.invalid',days:2,subscription:true,subscriptionTier:'premium'});
 assert.equal(pending.pending,true);
 rows=(await run('listAdminTrials',admin)).trials;assert.equal(rows.find(x=>x.pending).subscriptionTier,'premium');
 accounts.set('future@example.invalid','future');set('users/future/profile',{email:'future@example.invalid'});
 entitlement=await run('publicEntitlementPayload','future');assert.equal(entitlement.tier,'premium');
 assert.equal(get('users/future/trials/subscription/tier'),'premium');
 assert.equal((await run('listAdminTrials',admin)).trials.find(x=>x.uid==='future').subscriptionTier,'premium');
 checks.push('Offre avant inscription, activation et liste conservent Premium');
 const old=await run('grantAdminTrial',admin,{email:'viewer@example.invalid',days:1,subscription:true});
 assert.equal(old.subscriptionTier,'pro');assert.equal(get('users/viewer/trials/subscription/tier'),'pro');
 checks.push('Compatibilité des anciennes demandes Pro');
 return {passed:checks.length,checks};
}
if(process.argv[2]){
 const result=integratePremiumTrials(fs.readFileSync(process.argv[2],'utf8'));
 const report=await qualifyPremiumTrials(result);
 if(process.argv[3])fs.writeFileSync(process.argv[3],result);
 console.log(JSON.stringify(report,null,2));
}
