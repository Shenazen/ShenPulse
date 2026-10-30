
const once = (source, anchor, replacement) => {
  if (source.split(anchor).length !== 2) throw new Error('Ancrage Stripe absent ou ambigu : ' + anchor.slice(0, 90));
  return source.replace(anchor, replacement);
};

/** Prépare une extension du serveur historique, en conservant les routes PayPal. */
export function integrateStripeBackend(payments, index) {
  payments = payments.replace(/\r\n/g, '\n'); index = index.replace(/\r\n/g, '\n');
  if (payments.includes('const stripePayments =')) throw new Error('Stripe est déjà intégré.');
  payments = "import { createStripePayments } from './stripe/service.mjs'\n" + payments;
  payments = once(payments, '    paypalReady: hasPayPalCredentials(),', '    paypalReady: hasPayPalCredentials(),\n    stripe: stripePayments.config(),');
  payments = once(payments, '  const user = await requireAuthenticatedUser(request, uid)\n  const publicEntitlement', '  const user = await requireAuthenticatedUser(request, uid)\n  await stripePayments.refresh(user.uid)\n  const publicEntitlement');
  payments = once(payments, "    beneficiaryEmail: beneficiaryEmails[0] || '',\n    beneficiaryEmails,\n    email: user.email,", "    beneficiaryEmail: beneficiaryEmails[0] || '',\n    beneficiaryEmails,\n    paymentProvider: publicEntitlement.source === 'own' ? subscription.paymentProvider || 'paypal' : '',\n    pendingChange: publicEntitlement.source === 'own' ? subscription.pendingChange || null : null,\n    email: user.email,");
  payments = once(payments, 'export async function createSubscriptionCheckout(request, body = {}) {\n  const user = await requireAuthenticatedUser(request, body.ownerId)', 'export async function createSubscriptionCheckout(request, body = {}) {\n  const user = await requireAuthenticatedUser(request, body.ownerId)\n  await stripePayments.assertPayPalAllowed(user.uid)');
  payments = once(payments, "export async function cancelSubscriptionCheckout(request, body = {}) {\n  const user = await requireAuthenticatedUser(request, body.ownerId)\n  const current = await subscriptionSnapshot(user.uid)", "export async function cancelSubscriptionCheckout(request, body = {}) {\n  const user = await requireAuthenticatedUser(request, body.ownerId)\n  const current = await subscriptionSnapshot(user.uid)\n  if (current.paymentProvider === 'stripe') return stripePayments.cancel(request, body)");
  payments = once(payments, '    if (!pendingChange || Number(pendingChange.effectiveAtMs || 0) > now) continue', "    if (subscription?.paymentProvider === 'stripe') {\n      try { await stripePayments.refresh(uid) } catch { console.warn('[Stripe] Synchronisation différée indisponible.') }\n      continue\n    }\n    if (!pendingChange || Number(pendingChange.effectiveAtMs || 0) > now) continue");
  payments = once(payments, "  const tier = normalizeStoredTier(subscription.tier)\n  if (subscription.status !== 'active')", "  const tier = normalizeStoredTier(subscription.tier)\n  if (subscription.paymentProvider === 'stripe' && (!subscription.renewalDate || Date.parse(subscription.renewalDate) <= Date.now())) return 'free'\n  if (subscription.status !== 'active')");
  payments = once(payments, '  const checkoutRequestId = paymentRequestKey(body.requestId)\n\n  if (current.status', '  const checkoutRequestId = paymentRequestKey(body.requestId)\n  await stripePayments.reservePayPalCheckout(user.uid, checkoutRequestId)\n\n  if (current.status');
  // Un webhook PayPal historique ne doit jamais remplacer l'abonnement Stripe courant.
  payments = once(payments, '  const previousBeneficiaries = subscriptionBeneficiaryEmails(current)', "  if (current.paymentProvider === 'stripe' && current.stripeSubscriptionId) return\n  const previousBeneficiaries = subscriptionBeneficiaryEmails(current)");
  payments = once(payments, "async function deactivateSubscription({ paypalStatus, paypalSubscriptionId, uid }) {\n  const { db } = firebaseAdmin()\n  const current = await subscriptionSnapshot(uid)", "async function deactivateSubscription({ paypalStatus, paypalSubscriptionId, uid }) {\n  const { db } = firebaseAdmin()\n  const current = await subscriptionSnapshot(uid)\n  if (current.paymentProvider === 'stripe') return");
  payments += `

const stripePayments = createStripePayments({
  db: () => firebaseAdmin().db,
  authenticate: requireAuthenticatedUser,
  catalog: commerceCatalogSnapshot,
  priceProduct: effectiveCommerceProduct,
  quote: (uid, current) => agencyService.quote(uid, current),
  subscription: subscriptionSnapshot,
  returnUrls: (request, body, kind, id) => kind === 'game'
    ? desktopGameOrderReturnUrls(request, body, id)
    : desktopSubscriptionReturnUrls(request, body, id),
  applySubscription: applyStripeSubscription,
})

export const createStripeCheckout = (request, body) => stripePayments.checkout(request, body)
export const syncStripeCheckout = (request, body) => stripePayments.sync(request, body)
export const abandonStripeCheckout = (request, body) => stripePayments.abandon(request, body)
export const handleStripeWebhook = (request, rawBody) => stripePayments.webhook(request, rawBody)

async function applyStripeSubscription(value) {
  const { db } = firebaseAdmin()
  const { uid, tier, status, subscriptionId, customerId, stripeStatus, priceMonthly, renewalDate, pendingChange, group, agencyId } = value
  const current = await subscriptionSnapshot(uid)
  if (current.status === 'active' && current.paymentProvider !== 'stripe') throw paymentError('Un abonnement PayPal est déjà actif.', 409)
  if (current.paymentProvider === 'stripe' && current.stripeSubscriptionId && current.stripeSubscriptionId !== subscriptionId && current.status === 'active') throw paymentError('Un autre abonnement Stripe est actif.', 409)
  const previous = subscriptionBeneficiaryEmails(current)
  const kept = tier === 'premium' && status === 'active' ? previous : []
  const updates = {
    [\`users/\${uid}/subscription\`]: {
      ...current, tier, status, paymentProvider: 'stripe', stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId, stripeStatus, priceMonthly, renewalDate,
      currentPeriodEnd: renewalDate, nextBillingTime: renewalDate, pendingChange,
      agencyProgramGroup: group || 'public', agencyProgramAgencyId: agencyId || '',
      paypalSubscriptionId: '', paypalPlanId: '', paypalStatus: '',
      beneficiaryEmail: kept[0] || '', beneficiaryEmails: kept,
      beneficiaryUsername: null, beneficiaryUsernames: null,
      createdAt: current.createdAt || ServerValue.TIMESTAMP, updatedAt: ServerValue.TIMESTAMP,
    },
  }
  if (!kept.length && previous.length) {
    applyLegacyPremiumSeatRemovalUpdates(updates, uid, current)
    applyPremiumSeatRemovalUpdates(updates, uid, previous)
  }
  if (kept.length) applyPremiumSeatGrantUpdates(updates, uid, [], kept, await accountEmailForUid(uid))
  await db.ref().update(updates)
  agencyService.invalidateDirectoryCache()
}
`;
  index = once(index, '  handlePayPalWebhook,', '  handlePayPalWebhook,\n  createStripeCheckout,\n  syncStripeCheckout,\n  abandonStripeCheckout,\n  handleStripeWebhook,');
  index = once(index, "    if (url.pathname === '/api/payments/webhook' && request.method === 'POST') {", `    if (url.pathname === '/api/payments/stripe/webhook' && request.method === 'POST') {
      const rawBody = await readRawBody(request)
      sendJson(response, await handleStripeWebhook(request, rawBody))
      return
    }
    if (url.pathname === '/api/payments/stripe/checkout' && request.method === 'POST') {
      sendJson(response, await createStripeCheckout(request, await readJsonBody(request)))
      return
    }
    if (url.pathname === '/api/payments/stripe/abandon' && request.method === 'POST') {
      sendJson(response, await abandonStripeCheckout(request, await readJsonBody(request)))
      return
    }
    if (url.pathname === '/api/payments/stripe/sync' && request.method === 'POST') {
      sendJson(response, await syncStripeCheckout(request, await readJsonBody(request)))
      return
    }
    if (url.pathname === '/api/payments/webhook' && request.method === 'POST') {`);
  return { payments, index };
}
