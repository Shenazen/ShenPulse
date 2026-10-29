import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createTrialQualificationFixture,qualifyPremiumTrials} from './qualify.mjs';
import {integrateTrialAgencyCounting} from './agency-counting.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export async function qualifyTrialAgencyCounting(source) {
  const {run,data,accounts,get,set}=createTrialQualificationFixture(source),admin={admin:true},checks=[];
  const body={email:'viewer@example.invalid',days:7,subscription:true,subscriptionTier:'premium',countsForAgency:true};
  const paid=structuredClone(data.users.viewer.subscription);
  let grant=await run('grantAdminTrial',admin,body);
  assert.equal(grant.countsForAgency,true);
  assert.equal(get('users/viewer/trials/subscription/countsForAgency'),true);
  let list=await run('listAdminTrials',admin);
  assert.equal(list.agencyCountingAvailable,true);assert.equal(list.trials[0].countsForAgency,true);
  assert.equal((await run('activeSubscriptionTrial','viewer')).countsForAgency,true);
  assert.deepEqual(data.users.viewer.subscription,paid);
  checks.push('Attribution, liste et lecture de l’essai sélectionné, abonnement payé inchangé');

  const before=structuredClone(get('users/viewer/trials/subscription'));
  const toggle=(enabled,who=admin)=>run('updateAdminTrial',who,{trialId:grant.id,onlyAgencyCounting:true,countsForAgency:enabled});
  await toggle(false);
  assert.deepEqual(get('users/viewer/trials/subscription'),{...before,countsForAgency:false});
  await toggle(true);
  assert.deepEqual(get('users/viewer/trials/subscription'),before);
  assert.deepEqual(data.users.viewer.subscription,paid);
  checks.push('Activation et désactivation seules : dates, durée, palier et paiement inchangés');

  const snapshot=structuredClone(data);
  await assert.rejects(toggle(false,{}),{statusCode:403});
  await assert.rejects(run('grantAdminTrial',{},body),{statusCode:403});
  await assert.rejects(toggle('false'),{statusCode:400});
  await assert.rejects(run('grantAdminTrial',admin,{...body,subscription:false,games:true}),{statusCode:400});
  await assert.rejects(run('grantAdminTrial',admin,{...body,countsForAgency:'true'}),{statusCode:400});
  await assert.rejects(run('updateAdminTrial',admin,{...body,trialId:grant.id,subscription:false,games:true}),{statusCode:400});
  assert.deepEqual(data,snapshot);
  checks.push('Compte ordinaire, choix non booléen et offre de jeux seuls refusés avant écriture');

  const priorId=grant.id;
  grant=await run('grantAdminTrial',admin,{...body,days:8});
  await assert.rejects(run('updateAdminTrial',admin,{trialId:priorId,onlyAgencyCounting:true,countsForAgency:false}),{statusCode:409});
  checks.push('Une ancienne ligne ne peut pas modifier une offre remplacée');
  await run('revokeAdminTrial',admin,{trialId:grant.id});
  assert.equal(await run('activeSubscriptionTrial','viewer'),null);
  await assert.rejects(toggle(true),{statusCode:409});
  checks.push('Révocation : retrait du comptage et refus d’une réactivation périmée');

  grant=await run('grantAdminTrial',admin,body);
  get('users/viewer/trials/subscription').expiresAtMs=Date.now()-1;
  get('users/viewer/trials/subscription').expiresAt=new Date(Date.now()-1).toISOString();
  assert.equal(await run('activeSubscriptionTrial','viewer'),null);
  await assert.rejects(toggle(true),{statusCode:409});
  checks.push('Expiration : lecture inactive, aucune prolongation par le bouton de comptage');

  grant=await run('grantAdminTrial',admin,{...body,countsForAgency:undefined});
  assert.equal(grant.countsForAgency,false);
  assert.equal((await run('listAdminTrials',admin)).trials[0].countsForAgency,false);
  checks.push('Les essais historiques et nouvelles offres sans option restent exclus');

  const pending=await run('grantAdminTrial',admin,{...body,email:'future@example.invalid'});
  assert.equal(pending.pending,true);assert.equal(pending.countsForAgency,true);
  let pendingRow=(await run('listAdminTrials',admin)).trials.find(t=>t.pending);
  assert.equal(pendingRow.countsForAgency,true);
  await run('updateAdminTrial',admin,{trialId:pending.id,onlyAgencyCounting:true,countsForAgency:false});
  pendingRow=(await run('listAdminTrials',admin)).trials.find(t=>t.pending);
  assert.equal(pendingRow.expiresAtMs,pending.expiresAtMs);assert.equal(pendingRow.countsForAgency,false);
  await run('updateAdminTrial',admin,{trialId:pending.id,onlyAgencyCounting:true,countsForAgency:true});
  accounts.set('future@example.invalid','future');set('users/future/profile',{email:'future@example.invalid'});
  await run('publicEntitlementPayload','future');
  assert.equal((await run('activeSubscriptionTrial','future')).countsForAgency,true);
  assert.equal((await run('listAdminTrials',admin)).trials.find(t=>t.uid==='future').countsForAgency,true);
  checks.push('Offre avant inscription : option modifiable, durée conservée et transmission au compte créé');
  return {passed:checks.length,checks,premiumRegression:await qualifyPremiumTrials(source)};
}

if(process.argv[2] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=integrateTrialAgencyCounting(fs.readFileSync(process.argv[2],'utf8'));
  const report=await qualifyTrialAgencyCounting(result);
  if(process.argv[3])fs.writeFileSync(process.argv[3],result);
  console.log(JSON.stringify(report,null,2));
}
