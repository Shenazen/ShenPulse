// Extension additive du serveur historique ; aucun abonnement PayPal n'est modifié.
function once(source, anchor, replacement) {
  if(source.split(anchor).length!==2)throw new Error('Ancrage comptage des essais absent ou ambigu : '+anchor.slice(0,90));
  return source.replace(anchor,replacement);
}
function edit(source,name,transform) {
  const pattern=new RegExp('^(?:export )?(?:async )?function '+name+'\\([\\s\\S]*?^}$','m'),match=source.match(pattern);
  if(!match)throw new Error('Fonction serveur introuvable : '+name);
  return source.replace(pattern,()=>transform(match[0]));
}
export function integrateTrialAgencyCounting(input) {
  let source=input.replace(/\r\n/g,'\n');
  if(source.includes('function setAdminTrialAgencyCounting('))throw new Error('Comptage des essais déjà intégré.');
  source=edit(source,'grantAdminTrial',s=>{
    s=once(s,'  const subscriptionTier = requestedTrialSubscriptionTier(body)','  const subscriptionTier = requestedTrialSubscriptionTier(body)\n  const countsForAgency = requestedTrialAgencyCounting(body)');
    s=once(s,'  const trialBase = {\n    tier: subscriptionTier,','  const trialBase = {\n    countsForAgency,\n    tier: subscriptionTier,');
    s=once(s,'    subscriptionTier,\n    uid,','    subscriptionTier,\n    countsForAgency,\n    uid,');
    return once(s,'  await db.ref().update(updates)','  await db.ref().update(updates)\n  agencyService.invalidateDirectoryCache()');
  });
  source=edit(source,'updateAdminTrial',s=>{
    s=once(s,"  const email = normalizeAccountEmail(","  if (body.onlyAgencyCounting === true) return setAdminTrialAgencyCounting(request, body)\n\n  const email = normalizeAccountEmail(");
    return once(s,'  requestedTrialSubscriptionTier(body)','  requestedTrialSubscriptionTier(body)\n  requestedTrialAgencyCounting(body)');
  });
  for(const name of ['revokeAdminTrial','applyPendingAdminTrialForUser'])source=edit(source,name,s=>once(s,'  await db.ref().update(updates)','  await db.ref().update(updates)\n  agencyService.invalidateDirectoryCache()'));
  source=edit(source,'normalizeAdminTrialPayload',s=>once(s,'    subscriptionTier: payload.tier',"    countsForAgency: payload.countsForAgency === true,\n    subscriptionTier: payload.tier"));
  source=edit(source,'normalizeTimedTrial',s=>once(s,"    source: 'trial',","    source: 'trial',\n    countsForAgency: payload.countsForAgency === true,"));
  source=edit(source,'adminTrialBaseFromPendingTrial',s=>once(s,"    source: 'trial',","    source: 'trial',\n    countsForAgency: trial.subscriptionTrial === true && trial.countsForAgency === true,"));
  source=edit(source,'createPendingAdminTrialSummary',s=>once(s,'    subscriptionTrial: trial.subscriptionTrial,','    subscriptionTrial: trial.subscriptionTrial,\n    countsForAgency: trial.subscriptionTrial === true && trial.countsForAgency === true,'));
  source=edit(source,'addAdminTrialGroup',s=>once(s,'    group.subscriptionTrial = true','    group.subscriptionTrial = true\n    group.countsForAgency = trial.countsForAgency === true'));
  source=edit(source,'listAdminTrials',s=>once(s,'    trials: trialGroups.slice(0, 100),','    trials: trialGroups.slice(0, 100),\n    agencyCountingAvailable: true,'));
  source=once(source,'requireAdmin: requireReleaseAdmin, subscription: subscriptionSnapshot','requireAdmin: requireReleaseAdmin, subscription: subscriptionSnapshot, trial: activeSubscriptionTrial');
  source+=`
function requestedTrialAgencyCounting(body = {}) {
  if (body.countsForAgency !== undefined && typeof body.countsForAgency !== 'boolean') {
    throw paymentError('Le choix de comptage doit être activé ou désactivé.', 400)
  }
  const enabled = body.countsForAgency === true
  if (enabled && body.subscription !== true && body.subscription !== 'true') {
    throw paymentError('Le comptage agence nécessite un essai Pro ou Premium.', 400)
  }
  return enabled
}

async function setAdminTrialAgencyCounting(request, body = {}) {
  const admin = await requireVerifiedAuthenticatedUser(request, body.ownerId)
  if (!isPremiumSeatUnlimitedAdmin(admin)) throw paymentError('Seul l administrateur peut choisir le comptage agence.', 403)
  const target = parseAdminTrialSummaryId(body.trialId)
  if (!target || typeof body.countsForAgency !== 'boolean') throw paymentError('Essai ou choix de comptage invalide.', 400)
  const { db } = firebaseAdmin()
  const path = target.pending ? \`adminTrialGrants/\${target.pendingKey}\` : \`users/\${target.uid}/trials/subscription\`
  const reference = db.ref(path), hold = () => {}
  reference.on('value', hold)
  try {
    await reference.once('value')
    const result = await reference.transaction(current => {
      const trial = target.pending ? normalizePendingAdminTrialPayload(current) : normalizeAdminTrialPayload(current)
      if (!trial || adminTrialGroupKey(trial) !== target.groupKey) return undefined
      if (target.pending ? !trial.subscriptionTrial : !['pro', 'premium'].includes(current?.tier)) return undefined
      return {...current, countsForAgency: body.countsForAgency, updatedAt: ServerValue.TIMESTAMP}
    })
    if (!result.committed) throw paymentError('Cet essai abonnement a expiré ou a changé. Actualisez la liste.', 409)
    agencyService.invalidateDirectoryCache()
    return {ok: true, trialId: body.trialId, countsForAgency: body.countsForAgency, onlyAgencyCounting: true}
  } finally { reference.off('value', hold) }
}
`;
  return source;
}
