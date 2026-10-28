// Adaptateur strict et réversible pour le serveur historique maintenu séparément.
const once=(source,anchor,value)=>{
  if(source.split(anchor).length!==2)throw new Error('Ancrage backend absent ou ambigu : '+anchor.slice(0,100));
  return source.replace(anchor,value);
};
export function integrateAgencyBackend(payments,index){
  payments=payments.replace(/\r\n/g,'\n');index=index.replace(/\r\n/g,'\n');
  if(payments.includes('const agencyService ='))throw new Error('Le programme agences est déjà intégré.');
  payments="import { createAgencyService, AGENCY_PRICES } from './agencies/service.mjs'\n"+payments;
  payments+="\nexport const agencyService = createAgencyService({db: () => firebaseAdmin().db, authenticate: requireAuthenticatedUser, requireAdmin: requireReleaseAdmin, subscription: subscriptionSnapshot})\n";
  payments=once(payments,"  const subscriptionTrial = await activeSubscriptionTrial(cleanUid)","  const directorReward = await agencyService.directorReward(cleanUid, subscription)\n  if (directorReward) return publicEntitlementResponse({checkedAt, ...directorReward})\n\n  const subscriptionTrial = await activeSubscriptionTrial(cleanUid)");
  payments=once(payments,"  const catalog = await commerceCatalogSnapshot(options.channel)","  const catalog = await commerceCatalogSnapshot(options.channel)\n  for (const [tier, price] of Object.entries(AGENCY_PRICES.public)) {\n    if (catalog.subscriptions[tier]) catalog.subscriptions[tier] = {...catalog.subscriptions[tier], priceMonthly: price}\n  }");
  payments=once(payments,"  const plan = await resolveSubscriptionPlan(tier)\n  const current = await subscriptionSnapshot(user.uid)","  const current = await subscriptionSnapshot(user.uid)\n  const agencyPricing = await agencyService.quote(user.uid, current)\n  if (agencyPricing.group === 'public' && body.expectedPrice == null) throw paymentError('Cette version du paiement doit être mise à jour pour afficher les nouveaux tarifs ShenPulse.', 426)\n  const plan = await resolveSubscriptionPlan(tier, agencyPricing.quoted[tier])\n  if (body.expectedPrice != null && Math.round(Number(body.expectedPrice) * 100) !== Math.round(Number(plan.priceMonthly) * 100)) throw paymentError('Le tarif a changé. Actualisez les offres avant de continuer.', 409)");
  payments=once(payments,"if (current.status === 'active' && current.tier === tier) {","if (current.status === 'active' && current.tier === tier && Number(current.priceMonthly) === Number(plan.priceMonthly)) {");
  const start=payments.indexOf('export async function createSubscriptionCheckout('),end=payments.indexOf('\nasync function reviseSubscriptionCheckout(',start);
  let checkout=payments.slice(start,end);
  checkout=once(checkout,'    return reviseSubscriptionCheckout({','    const revision = await reviseSubscriptionCheckout({');
  checkout=once(checkout,'      user,\n    })\n  }',"      user,\n    })\n    await agencyService.recordCheckout(revision.id, {uid:user.uid, group:agencyPricing.group, agencyId:agencyPricing.agencyId, planId:plan.planId})\n    return revision\n  }");
  checkout=once(checkout,'  const approvalUrl = approvalLink(subscription)',"  await agencyService.recordCheckout(subscription.id, {uid:user.uid, group:agencyPricing.group, agencyId:agencyPricing.agencyId, planId:plan.planId})\n  const approvalUrl = approvalLink(subscription)");
  payments=payments.slice(0,start)+checkout+payments.slice(end);
  payments=once(payments,'async function resolveSubscriptionPlan(tier) {','async function resolveSubscriptionPlan(tier, agencyPrice = null) {');
  payments=once(payments,'  const offer = catalog.subscriptions[tier]',"  const baseOffer = catalog.subscriptions[tier]\n  const offer = baseOffer && agencyPrice != null ? {...baseOffer, priceMonthly: agencyPrice} : baseOffer");
  const activate=payments.indexOf('async function activateSubscription('),stop=payments.indexOf('\nasync function deactivateSubscription(',activate);
  let segment=payments.slice(activate,stop);
  segment=once(segment,'      ...current,','      ...current,\n      ...await agencyService.activationMetadata(uid, paypalSubscriptionId, current, paypalPlanId),');
  payments=payments.slice(0,activate)+segment+payments.slice(stop);
  index="import { agencyInvitationHtml } from './agencies/invitation.mjs'\nimport { handleAgencyRoute } from './agencies/routes.mjs'\nimport { agencyService } from './payments.js'\n"+index;
  index=once(index,'    const url = requestUrl(request)',"    const url = requestUrl(request)\n    if (url.pathname === '/agences/rejoindre' && request.method === 'GET') {\n      const code = url.searchParams.get('code') || ''\n      const agency = await agencyService.invitation(code)\n      response.writeHead(200, {'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer'})\n      response.end(agencyInvitationHtml(agency,code))\n      return\n    }\n    if (url.pathname === '/api/agencies' || url.pathname.startsWith('/api/agencies/') || url.pathname === '/api/admin/agencies' || url.pathname.startsWith('/api/admin/agencies/')) {\n      sendJson(response, await handleAgencyRoute(agencyService, request, url, readJsonBody))\n      return\n    }");
  return {payments,index};
}
