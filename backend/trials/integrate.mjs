// Mise à niveau des essais du backend historique, sans toucher aux achats ni aux tarifs.
function once(source, anchor, value) {
  if (source.split(anchor).length !== 2) throw new Error('Ancrage essais absent ou ambigu : ' + anchor.slice(0, 90));
  return source.replace(anchor, value);
}
function editFunction(source, name, transform) {
  const pattern = new RegExp('^(?:export )?(?:async )?function ' + name + '\\([\\s\\S]*?^}$', 'm');
  const match = source.match(pattern);
  if (!match) throw new Error('Fonction backend absente : ' + name);
  return source.replace(pattern, () => transform(match[0]));
}
export function integratePremiumTrials(source) {
  source = source.replace(/\r\n/g, '\n');
  if (source.includes('function requestedTrialSubscriptionTier(')) throw new Error('Essais Premium déjà intégrés.');
  source += `
function requestedTrialSubscriptionTier(body = {}) {
  if (body.subscription !== true && body.subscription !== 'true') return ''
  const tier = String(body.subscriptionTier || 'pro')
  if (!['pro', 'premium'].includes(tier)) throw paymentError('Choisissez un accès Pro ou Premium.', 400)
  return tier
}
`;
  source = editFunction(source, 'grantAdminTrial', s => {
    s = once(s, "  const days = normalizeTrialDays(body.days)", "  const days = normalizeTrialDays(body.days)\n  const subscriptionTier = requestedTrialSubscriptionTier(body)");
    s = once(s, '  const trialBase = {\n    days,', '  const trialBase = {\n    tier: subscriptionTier,\n    days,');
    return once(s, '    startsAtMs: nowMs,\n    subscriptionTrial,\n    uid,', '    startsAtMs: nowMs,\n    subscriptionTrial,\n    subscriptionTier,\n    uid,');
  });
  source = editFunction(source, 'updateAdminTrial', s => once(s, '  normalizeTrialDays(body.days)', '  normalizeTrialDays(body.days)\n  requestedTrialSubscriptionTier(body)'));
  source = editFunction(source, 'appendAdminTrialApplicationUpdates', s => once(s, "      tier: 'pro',", "      tier: trialBase.tier === 'premium' ? 'premium' : 'pro',"));
  source = editFunction(source, 'revokeAdminTrial', s => once(s, "normalizeStoredTier(subscriptionTrialPayload?.tier) === 'pro'", "['pro', 'premium'].includes(normalizeStoredTier(subscriptionTrialPayload?.tier))"));
  source = editFunction(source, 'listAdminTrials', s => once(s, "normalizeStoredTier(userPayload.trials?.subscription?.tier) === 'pro'", "['pro', 'premium'].includes(normalizeStoredTier(userPayload.trials?.subscription?.tier))"));
  source = editFunction(source, 'activeSubscriptionTrial', s => once(s, "trial?.tier === 'pro'", "['pro', 'premium'].includes(trial?.tier)"));
  source = editFunction(source, 'normalizeAdminTrialPayload', s => once(s, '    startsAtMs: safeStartsAtMs,', "    startsAtMs: safeStartsAtMs,\n    subscriptionTier: payload.tier === 'premium' ? 'premium' : 'pro',"));
  source = editFunction(source, 'adminTrialBaseFromPendingTrial', s => once(s, "    source: 'trial',", "    source: 'trial',\n    tier: trial.subscriptionTier === 'premium' ? 'premium' : 'pro',"));
  source = editFunction(source, 'createPendingAdminTrialSummary', s => once(s, '    subscriptionTrial: trial.subscriptionTrial,', '    subscriptionTrial: trial.subscriptionTrial,\n    subscriptionTier: trial.subscriptionTrial ? trial.subscriptionTier : \'\','));
  source = editFunction(source, 'addAdminTrialGroup', s => once(s, '    group.subscriptionTrial = true', '    group.subscriptionTrial = true\n    group.subscriptionTier = trial.subscriptionTier'));
  source = editFunction(source, 'publicEntitlementPayload', s => {
    s = once(s, '  const ownTier = activeSubscriptionTier(subscription)', `  const ownTier = activeSubscriptionTier(subscription)
  const subscriptionTrial = await activeSubscriptionTrial(cleanUid)
  if (subscriptionTrial?.tier === 'premium' && ownTier !== 'premium') {
    return publicEntitlementResponse({
      checkedAt, expiresAt: subscriptionTrial.expiresAt, expiresAtMs: subscriptionTrial.expiresAtMs,
      gameEntitlements: await activeTrialGameEntitlements(cleanUid), source: 'trial', tier: 'premium',
    })
  }`);
    // Une seule lecture du droit temporaire ; le Pro payé conserve la priorité sur un essai Pro.
    s = once(s, "  const directorReward = await agencyService.directorReward(cleanUid, subscription)\n  if (directorReward) return publicEntitlementResponse({checkedAt, ...directorReward})\n\n  const subscriptionTrial = await activeSubscriptionTrial(cleanUid)", "  const directorReward = await agencyService.directorReward(cleanUid, subscription)\n  if (directorReward) return publicEntitlementResponse({checkedAt, ...directorReward})");
    return once(s, "      source: 'trial',\n      tier: 'pro',", "      source: 'trial',\n      tier: subscriptionTrial.tier,");
  });
  return source;
}
