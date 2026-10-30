import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const objectId = value => typeof value === 'string' ? value : value?.id || '';
const validId = (value, prefix) => typeof value === 'string' && new RegExp('^' + prefix + '[a-zA-Z0-9_]{3,240}$').test(value);
const hash = value => createHash('sha256').update(value).digest('hex');
const iso = seconds => Number(seconds) > 0 ? new Date(Number(seconds) * 1000).toISOString() : '';
const paidProvider = s => ['active', 'paid'].includes(s?.status) && ['pro', 'premium'].includes(s?.tier);
export const STRIPE_API_VERSION = '2025-06-30.basil';
export const STRIPE_EVENTS = ['checkout.session.completed', 'checkout.session.expired', 'invoice.paid', 'invoice.payment_failed', 'customer.subscription.updated', 'customer.subscription.deleted', 'charge.refunded', 'charge.dispute.created', 'charge.dispute.closed'];

/** Vérifie le corps brut et toutes les signatures v1, avec une tolérance de cinq minutes. */
export function verifyStripeSignature(rawBody, signature, secret, nowMs = Date.now()) {
  if (!secret) fail('Signature Stripe non configurée.', 503);
  const parts = String(signature || '').split(',').map(p => p.split('='));
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowMs / 1000 - timestamp) > 300) fail('Signature Stripe expirée ou invalide.', 400);
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const valid = parts.filter(([key]) => key === 'v1').some(([, value]) => /^[a-f0-9]{64}$/i.test(value || '') && timingSafeEqual(Buffer.from(value.toLowerCase()), Buffer.from(expected)));
  if (!valid) fail('Signature Stripe invalide.', 400);
  try { return JSON.parse(rawBody); } catch { fail('Événement Stripe invalide.', 400); }
}

function encodeForm(value, prefix = '', target = new URLSearchParams()) {
  for (const [key, entry] of Object.entries(value || {})) {
    if (entry === undefined || entry === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof entry === 'object') encodeForm(entry, name, target);
    else target.append(name, String(entry));
  }
  return target;
}

/** Aucun secret ou jeton Stripe n'est envoyé au renderer ou enregistré dans les journaux. */
export function createStripePayments({ db, authenticate, catalog, priceProduct, quote, subscription, returnUrls, applySubscription, fetchImpl = globalThis.fetch, env = process.env, now = Date.now }) {
  const key = String(env.STRIPE_SECRET_KEY || '').trim();
  const webhookSecret = String(env.STRIPE_WEBHOOK_SECRET || '').trim();
  const live = key.startsWith('sk_live_') || key.startsWith('rk_live_');
  const ready = /^(sk|rk)_(live|test)_/.test(key) && !!webhookSecret;
  const refreshTimes = new Map();
  const pendingRefreshes = new Map();
  const subscriptionOperations = new Map();
  const read = async path => (await db().ref(path).get()).val();
  const write = (path, value) => db().ref(path).set(value);
  const time = () => new Date(now()).toISOString();
  const url = id => encodeURIComponent(id);

  async function api(path, { method = 'GET', body, idempotencyKey } = {}) {
    if (!key) fail('Paiement Stripe non configuré sur le serveur.', 503);
    const query = method === 'GET' && body ? '?' + encodeForm(body) : '';
    const response = await fetchImpl('https://api.stripe.com/v1/' + path + query, {
      method, headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': STRIPE_API_VERSION,
        ...(body && method !== 'GET' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      ...(body && method !== 'GET' ? { body: encodeForm(body).toString() } : {}), signal: AbortSignal.timeout(20000)
    });
    let payload; try { payload = await response.json(); } catch { fail('Réponse Stripe invalide.', 502); }
    if (!response.ok) {
      const error = Object.assign(new Error('Stripe n’a pas pu traiter cette demande. Réessayez ou contactez le support.'), { statusCode: response.status >= 500 ? 502 : 409, stripeCode: payload.error?.code || '' });
      if (response.status === 404) error.statusCode = 404;
      throw error;
    }
    return payload;
  }

  async function customer(user) {
    const path = `serverOnly/stripeCustomers/${user.uid}`;
    const existing = await read(path);
    if (validId(existing?.id, 'cus_')) return existing.id;
    const created = await api('customers', { method: 'POST', body: { email: user.email, metadata: { app: 'shenpulse', uid: user.uid } }, idempotencyKey: 'shenpulse-customer-' + hash(user.uid) });
    await write(path, { id: created.id, createdAt: time() });
    return created.id;
  }

  async function price(tier, amount, currency) {
    const lookup = `shenpulse_${tier}_${currency}_${amount}_v1`;
    const found = await api('prices', { body: { lookup_keys: [lookup], active: true, limit: 1 } });
    if (found.data?.[0]) return found.data[0];
    const productId = `shenpulse_${tier}`;
    try { await api('products/' + productId); }
    catch (error) { if (error.statusCode !== 404) throw error; await api('products', { method: 'POST', body: { id: productId, name: `ShenPulse ${tier === 'premium' ? 'Premium' : 'Pro'}`, metadata: { app: 'shenpulse', tier } }, idempotencyKey: productId }); }
    return api('prices', { method: 'POST', body: { product: productId, currency, unit_amount: amount, recurring: { interval: 'month' }, lookup_key: lookup, metadata: { app: 'shenpulse', tier } }, idempotencyKey: lookup });
  }

  async function transaction(ref, operation) {
    const hold = () => {};
    ref.on('value', hold);
    try { await ref.once('value'); return await ref.transaction(operation); }
    finally { ref.off('value', hold); }
  }

  async function reserveProvider(uid, provider, requestId) {
    const reference = db().ref('serverOnly/paymentProviderReservations/' + uid);
    const result = await transaction(reference, current => current && current.expiresAtMs > now() && current.provider !== provider ? undefined : { provider, requestId, expiresAtMs: now() + 31 * 60 * 1000 });
    if (!result.committed) fail('Un paiement d’abonnement est déjà ouvert avec un autre moyen de paiement. Terminez-le ou attendez son expiration.', 409);
  }

  async function releaseProvider(uid, provider, requestId) {
    await transaction(db().ref('serverOnly/paymentProviderReservations/' + uid), current => current?.provider === provider && current.requestId === requestId ? null : undefined);
  }

  async function claimSubscription(uid, requestId) {
    const ref = db().ref(`serverOnly/stripePendingSubscriptions/${uid}`);
    const result = await transaction(ref, value => !value || value.expiresAtMs <= now() || value.requestId === requestId ? { requestId, expiresAtMs: now() + 31 * 60 * 1000 } : undefined);
    if (!result.committed) fail('Un paiement d’abonnement est déjà ouvert. Terminez-le ou attendez son expiration avant de recommencer.', 409);
  }

  async function checkout(request, body = {}) {
    if (!ready) fail('Les nouveaux moyens de paiement ne sont pas encore disponibles.', 503);
    const user = await authenticate(request, body.ownerId);
    const kind = body.kind;
    if (!['game', 'subscription'].includes(kind)) fail('Type de paiement invalide.');
    const requestId = String(body.requestId || '');
    if (!/^[a-f0-9-]{36}$/i.test(requestId)) fail('Référence de paiement invalide.');
    const current = await subscription(user.uid);
    const offers = await catalog();
    let amount, currency, title, productId = '', tier = '', pricing = null, line;
    if (kind === 'game') {
      productId = String(body.productId || '');
      if (!/^[a-z0-9][a-z0-9_-]{1,159}$/.test(productId)) fail('Jeu invalide.');
      const product = offers.products[productId];
      if (!product?.enabled || product.accessMode !== 'purchase') fail('Ce jeu n’est pas disponible à l’achat.');
      const owned = await read(`users/${user.uid}/entitlements/games/${productId}`);
      if (owned?.status === 'active' && owned.source === 'purchase') return { ok: true, alreadyPurchased: true, productId };
      const priced = priceProduct(product, offers);
      amount = Math.round(Number(priced.amount) * 100); currency = String(product.currency).toLowerCase(); title = product.title;
      line = { price_data: { currency, unit_amount: amount, product_data: { name: title } }, quantity: 1 };
    } else {
      tier = String(body.tier || '');
      if (!['pro', 'premium'].includes(tier)) fail('Offre invalide.');
      pricing = await quote(user.uid, current);
      const offer = offers.subscriptions[tier];
      if (!offer?.enabled) fail('Cette offre est indisponible.', 409);
      amount = Math.round(Number(pricing.quoted[tier]) * 100); currency = String(offer.currency).toLowerCase(); title = `ShenPulse ${offer.title}`;
      if (!Number.isFinite(Number(body.expectedPrice)) || Math.round(Number(body.expectedPrice) * 100) !== amount) fail('Le tarif a changé. Actualisez les offres avant de continuer.', 409);
      if (paidProvider(current)) {
        if (current.paymentProvider !== 'stripe') fail('Votre abonnement PayPal est actif. Gérez-le avec PayPal pour éviter un second abonnement.', 409);
        if (current.tier === tier && Math.round(Number(current.priceMonthly) * 100) === amount && !current.pendingChange) return { ok: true, alreadyActive: true, tier };
        return changeCheckout(user, current, { tier, amount, currency, pricing, request, body });
      }
      line = { price: (await price(tier, amount, currency)).id, quantity: 1 };
      await reserveProvider(user.uid, 'stripe', requestId);
      await claimSubscription(user.uid, requestId);
    }
    if (!Number.isSafeInteger(amount) || amount < 50 || amount > 99999999 || !/^[a-z]{3}$/.test(currency)) fail('Montant de paiement invalide.');
    const customerId = await customer(user);
    const returns = returnUrls(request, body, kind, kind === 'game' ? productId : tier);
    const metadata = { app: 'shenpulse', uid: user.uid, kind, productId, tier, requestId };
    const session = await api('checkout/sessions', { method: 'POST', idempotencyKey: 'shenpulse-checkout-' + hash(`${user.uid}:${kind}:${requestId}`), body: {
      mode: kind === 'game' ? 'payment' : 'subscription', customer: customerId, client_reference_id: user.uid,
      payment_method_types: ['card', 'link'], line_items: [line], metadata,
      ...(kind === 'subscription' ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
      success_url: returns.returnUrl + '&session_id={CHECKOUT_SESSION_ID}', cancel_url: returns.cancelUrl,
      expires_at: Math.floor(now() / 1000) + 30 * 60, locale: 'fr', adaptive_pricing: { enabled: false }
    } });
    if (!validId(session.id, 'cs_') || session.livemode !== live) fail('Session Stripe invalide.', 502);
    await write(`serverOnly/stripeCheckouts/${session.id}`, { uid: user.uid, kind, amount, currency, productId, tier, customerId, requestId, group: pricing?.group || '', agencyId: pricing?.agencyId || '', createdAt: time(), expiresAtMs: now() + 30 * 60 * 1000 });
    if (kind === 'subscription') await write(`serverOnly/stripePendingSubscriptions/${user.uid}`, { requestId, sessionId: session.id, expiresAtMs: now() + 31 * 60 * 1000 });
    return { ok: true, id: session.id, approvalUrl: session.url, paymentProvider: 'stripe', tier, productId };
  }

  async function verifiedSession(id, expectedUid = '') {
    if (!validId(id, 'cs_')) fail('Référence Stripe invalide.');
    const record = await read(`serverOnly/stripeCheckouts/${id}`);
    if (!record || (expectedUid && record.uid !== expectedUid)) fail('Ce paiement ne correspond pas à votre compte.', 403);
    const session = await api('checkout/sessions/' + url(id));
    if (session.livemode !== live || session.client_reference_id !== record.uid || objectId(session.customer) !== record.customerId || session.metadata?.app !== 'shenpulse' || session.metadata?.kind !== record.kind || session.amount_total !== record.amount || session.currency !== record.currency) fail('Le paiement Stripe ne correspond pas à la commande.', 409);
    return { record, session };
  }

  async function complete(id, expectedUid = '') {
    const { record, session } = await verifiedSession(id, expectedUid);
    if (session.status !== 'complete' || session.payment_status !== 'paid') return { ok: true, pending: true, tier: record.tier, productId: record.productId };
    if (record.kind === 'subscription') {
      const subscriptionId = objectId(session.subscription);
      if (!validId(subscriptionId, 'sub_')) fail('Abonnement Stripe invalide.', 409);
      await write(`serverOnly/stripeSubscriptions/${subscriptionId}`, { ...record, sessionId: id });
      await reconcileSubscription(subscriptionId);
      const pending = await read(`serverOnly/stripePendingSubscriptions/${record.uid}`);
      if (pending?.sessionId === id) { await write(`serverOnly/stripePendingSubscriptions/${record.uid}`, null); await releaseProvider(record.uid, 'stripe', record.requestId); }
    } else await grantGame(record, session);
    return { ok: true, checkoutCompleted: true, tier: record.tier, productId: record.productId, paymentProvider: 'stripe' };
  }

  async function grantGame(record, session) {
    const receiptPath = `payments/stripe/gameOrders/${session.id}`;
    const receipt = await read(receiptPath);
    if (receipt) return;
    const intentId = objectId(session.payment_intent);
    if (!validId(intentId, 'pi_')) fail('Paiement Stripe invalide.', 409);
    const intent = await api('payment_intents/' + intentId);
    const charge = validId(objectId(intent.latest_charge), 'ch_') ? await api('charges/' + objectId(intent.latest_charge)) : null;
    if (intent.status !== 'succeeded' || intent.amount_received !== record.amount || intent.currency !== record.currency || charge?.refunded || charge?.disputed) fail('Le paiement Stripe n’est pas définitivement confirmé.', 409);
    const owned = await read(`users/${record.uid}/entitlements/games/${record.productId}`);
    const receiptValue = { ...record, sessionId: session.id, intentId, chargeId: objectId(intent.latest_charge), processedAt: time(), status: 'paid' };
    const updates = { [receiptPath]: receiptValue, [`serverOnly/stripeIntents/${intentId}`]: { sessionId: session.id } };
    if (!(owned?.status === 'active' && owned.source === 'purchase')) {
      updates[`users/${record.uid}/entitlements/games/${record.productId}`] = { amount: (record.amount / 100).toFixed(2), currency: record.currency.toUpperCase(), paymentProvider: 'stripe', productId: record.productId, orderId: session.id, captureId: intentId, purchasedAt: time(), source: 'purchase', status: 'active' };
      const all = await read(`users/${record.uid}/entitlements/games`) || {};
      updates[`users/${record.uid}/configs/interactiveGamePurchases`] = { purchasedGameIds: [...new Set([...Object.entries(all).filter(([, v]) => v?.status === 'active').map(([key]) => key), record.productId])], updatedAt: time() };
    }
    await db().ref().update(updates);
  }

  async function reconcileSubscription(id) {
    if (!validId(id, 'sub_')) return;
    const previous = subscriptionOperations.get(id) || Promise.resolve();
    const task = previous.catch(() => {}).then(() => reconcileSubscriptionNow(id));
    subscriptionOperations.set(id, task);
    try { return await task; }
    finally { if (subscriptionOperations.get(id) === task) subscriptionOperations.delete(id); }
  }

  async function reconcileSubscriptionNow(id) {
    if (!validId(id, 'sub_')) return;
    const record = await read(`serverOnly/stripeSubscriptions/${id}`);
    if (!record) return;
    const sub = await api('subscriptions/' + id, { body: { expand: ['latest_invoice', 'items.data.price'] } });
    if (sub.livemode !== live || objectId(sub.customer) !== record.customerId || sub.metadata?.uid !== record.uid || sub.metadata?.app !== 'shenpulse') fail('Cet abonnement Stripe ne correspond pas à ShenPulse.', 409);
    const item = sub.items?.data?.[0];
    if (sub.items?.data?.length !== 1 || item?.quantity !== 1) fail('Configuration de l’abonnement Stripe invalide.', 409);
    const priceInfo = item.price;
    const tier = priceInfo?.metadata?.tier;
    if (!['pro', 'premium'].includes(tier) || priceInfo.metadata.app !== 'shenpulse' || priceInfo.recurring?.interval !== 'month' || (priceInfo.recurring.interval_count || 1) !== 1 || priceInfo.currency !== record.currency) fail('Tarif Stripe inconnu.', 409);
    const pricingRecord = record.pendingPricing?.priceId === priceInfo.id ? record.pendingPricing : record;
    const current = await subscription(record.uid);
    if (paidProvider(current) && (current.paymentProvider !== 'stripe' || (current.stripeSubscriptionId && current.stripeSubscriptionId !== id))) fail('Un autre abonnement est déjà actif sur ce compte.', 409);
    const invoice = sub.latest_invoice;
    let paymentReversed = false;
    if (invoice && typeof invoice === 'object' && invoice.status === 'paid' && validId(invoice.id, 'in_')) {
      const fullInvoice = await api('invoices/' + invoice.id, { body: { expand: ['payments.data.payment.payment_intent'] } });
      for (const invoicePayment of fullInvoice.payments?.data || []) {
        const intent = invoicePayment.payment?.payment_intent;
        const intentId = objectId(intent);
        if (!validId(intentId, 'pi_')) continue;
        await write('serverOnly/stripeIntents/' + intentId, { kind: 'subscription', subscriptionId: id, invoiceId: invoice.id });
        const paymentIntent = typeof intent === 'object' ? intent : await api('payment_intents/' + intentId);
        const chargeId = objectId(paymentIntent.latest_charge);
        if (validId(chargeId, 'ch_')) {
          const charge = await api('charges/' + chargeId);
          const resolved = await read('serverOnly/stripeResolvedDisputes/' + chargeId);
          if (charge.refunded || (charge.disputed && resolved?.status !== 'won')) paymentReversed = true;
        }
      }
      if (await read('serverOnly/stripeReversedInvoices/' + invoice.id)) paymentReversed = true;
    }
    const end = Number(item.current_period_end || sub.current_period_end);
    const isPaid = invoice && typeof invoice === 'object' && invoice.status === 'paid';
    const terminal = paymentReversed || ['canceled', 'unpaid', 'incomplete_expired', 'paused'].includes(sub.status);
    let status = !terminal && sub.status === 'active' && isPaid && end * 1000 > now() ? 'active' : 'free';
    // Une échéance impayée ne prolonge pas les accès ; la période déjà réglée reste acquise.
    let renewalDate = iso(end), effectiveTier = tier, priceMonthly = priceInfo.unit_amount / 100;
    if (status === 'free' && !terminal && current.paymentProvider === 'stripe' && current.stripeSubscriptionId === id && Date.parse(current.renewalDate || '') > now()) {
      status = 'active'; renewalDate = current.renewalDate; effectiveTier = current.tier; priceMonthly = current.priceMonthly;
    }
    let pendingChange = sub.cancel_at_period_end && status === 'active' ? { type: 'cancel', targetTier: 'free', fromTier: effectiveTier, effectiveAt: renewalDate, effectiveAtMs: Date.parse(renewalDate) } : null;
    if (!pendingChange && status === 'active' && validId(objectId(sub.schedule), 'sub_sched_')) {
      const schedule = await api('subscription_schedules/' + objectId(sub.schedule));
      const next = schedule.phases?.find(phase => Number(phase.start_date) * 1000 > now());
      if (next?.items?.[0]?.price) {
        const nextPrice = typeof next.items[0].price === 'object' ? next.items[0].price : await api('prices/' + next.items[0].price);
        if (['pro', 'premium'].includes(nextPrice.metadata?.tier)) pendingChange = { type: 'downgrade', targetTier: nextPrice.metadata.tier, fromTier: effectiveTier, effectiveAt: iso(next.start_date), effectiveAtMs: next.start_date * 1000 };
      }
    }
    await applySubscription({ uid: record.uid, subscriptionId: id, customerId: record.customerId, stripeStatus: sub.status, tier: status === 'active' ? effectiveTier : 'free', status, priceMonthly: status === 'active' ? priceMonthly : 0, renewalDate: status === 'active' ? renewalDate : '', pendingChange, group: pricingRecord.group, agencyId: pricingRecord.agencyId });
    refreshTimes.set(record.uid, now());
    return { ok: true, tier: effectiveTier, scheduled: !!pendingChange, effectiveAt: pendingChange?.effectiveAt, subscriptionId: id };
  }

  async function changeCheckout(user, current, details) {
    // Le portail demande la confirmation et gère l'authentification bancaire du changement.
    const sub = await api('subscriptions/' + url(current.stripeSubscriptionId));
    if (objectId(sub.customer) !== current.stripeCustomerId) fail('Abonnement Stripe invalide.', 409);
    const target = await price(details.tier, details.amount, details.currency);
    const offers = await catalog(), choices = [];
    for (const tier of ['pro', 'premium']) {
      if (!offers.subscriptions[tier]?.enabled) continue;
      const p = await price(tier, Math.round(Number(details.pricing.quoted[tier]) * 100), details.currency);
      choices.push({ product: objectId(p.product), prices: [p.id] });
    }
    const config = await api('billing_portal/configurations', { method: 'POST', idempotencyKey: 'shenpulse-portal-' + hash(JSON.stringify(choices)), body: {
      business_profile: { headline: 'Gérez votre abonnement ShenPulse' }, features: {
        payment_method_update: { enabled: true }, invoice_history: { enabled: true },
        subscription_cancel: { enabled: true, mode: 'at_period_end' },
        subscription_update: { enabled: true, default_allowed_updates: ['price'], products: choices, proration_behavior: 'always_invoice', schedule_at_period_end: { conditions: [{ type: 'decreasing_item_amount' }] } }
      }
    } });
    const returns = returnUrls(details.request, details.body, 'subscription', details.tier);
    const result = await api('billing_portal/sessions', { method: 'POST', body: {
      customer: current.stripeCustomerId, configuration: config.id, return_url: returns.returnUrl,
      flow_data: { type: 'subscription_update_confirm', subscription_update_confirm: { subscription: sub.id, items: [{ id: sub.items.data[0].id, price: target.id, quantity: 1 }] }, after_completion: { type: 'redirect', redirect: { return_url: returns.returnUrl } } }
    } });
    await write(`serverOnly/stripeSubscriptions/${sub.id}`, { ...await read(`serverOnly/stripeSubscriptions/${sub.id}`), pendingPricing: { priceId: target.id, group: details.pricing.group, agencyId: details.pricing.agencyId || '' } });
    return { ok: true, id: sub.id, subscriptionId: sub.id, approvalUrl: result.url, paymentProvider: 'stripe', portal: true, tier: details.tier };
  }

  async function sync(request, body) {
    const user = await authenticate(request, body.ownerId);
    if (body.portal === true) {
      const current = await subscription(user.uid);
      if (current.paymentProvider !== 'stripe' || current.stripeSubscriptionId !== body.sessionId) fail('Abonnement invalide.', 403);
      return { ...await reconcileSubscription(current.stripeSubscriptionId), checkoutCompleted: true, paymentProvider: 'stripe' };
    }
    return complete(String(body.sessionId || ''), user.uid);
  }

  async function cancel(request, body = {}) {
    const user = await authenticate(request, body.ownerId), current = await subscription(user.uid);
    if (current.paymentProvider !== 'stripe' || !validId(current.stripeSubscriptionId, 'sub_')) fail('Abonnement Stripe introuvable.', 409);
    await api('subscriptions/' + current.stripeSubscriptionId, { method: 'POST', body: { cancel_at_period_end: true }, idempotencyKey: 'shenpulse-stop-' + current.stripeSubscriptionId });
    const result = await reconcileSubscription(current.stripeSubscriptionId);
    return { ...result, scheduled: true, targetTier: 'free', tier: current.tier };
  }

  async function abandon(request, body = {}) {
    const user = await authenticate(request, body.ownerId);
    const { record, session } = await verifiedSession(String(body.sessionId || ''), user.uid);
    if (session.status === 'complete') return complete(session.id, user.uid);
    if (session.status === 'open') await api('checkout/sessions/' + session.id + '/expire', { method: 'POST' });
    if (record.kind === 'subscription') {
      const pending = await read('serverOnly/stripePendingSubscriptions/' + user.uid);
      if (pending?.sessionId === session.id) { await write('serverOnly/stripePendingSubscriptions/' + user.uid, null); await releaseProvider(user.uid, 'stripe', record.requestId); }
    }
    return { ok: true, cancelled: true };
  }

  async function refresh(uid) {
    if (!ready || now() - (refreshTimes.get(uid) || 0) < 60000) return;
    if (pendingRefreshes.has(uid)) return pendingRefreshes.get(uid);
    const task = (async () => { const current = await subscription(uid); if (current.paymentProvider === 'stripe' && current.stripeSubscriptionId) await reconcileSubscription(current.stripeSubscriptionId); })();
    pendingRefreshes.set(uid, task);
    try { await task; } finally { pendingRefreshes.delete(uid); }
  }

  async function reverseCharge(charge, status) {
    if (validId(charge.id, 'ch_')) await write('serverOnly/stripeResolvedDisputes/' + charge.id, status === 'paid' ? { status: 'won', at: time() } : null);
    const intentId = objectId(charge.payment_intent);
    const pointer = intentId && await read(`serverOnly/stripeIntents/${intentId}`);
    if (pointer?.kind === 'subscription') {
      await write('serverOnly/stripeReversedInvoices/' + pointer.invoiceId, status === 'paid' ? null : { status, at: time() });
      await reconcileSubscription(pointer.subscriptionId);
      return;
    }
    if (!pointer?.sessionId) return;
    const receipt = await read(`payments/stripe/gameOrders/${pointer.sessionId}`);
    if (!receipt) return;
    const entitlement = await read(`users/${receipt.uid}/entitlements/games/${receipt.productId}`);
    const updates = { [`payments/stripe/gameOrders/${pointer.sessionId}/status`]: status };
    if (entitlement?.paymentProvider === 'stripe' && entitlement.orderId === pointer.sessionId) {
      updates[`users/${receipt.uid}/entitlements/games/${receipt.productId}/status`] = status === 'paid' ? 'active' : status;
      const all = await read(`users/${receipt.uid}/entitlements/games`) || {};
      updates[`users/${receipt.uid}/configs/interactiveGamePurchases`] = { purchasedGameIds: Object.entries(all).filter(([id, v]) => id === receipt.productId ? status === 'paid' : v?.status === 'active').map(([id]) => id), updatedAt: time() };
    }
    await db().ref().update(updates);
  }

  async function webhook(request, rawBody) {
    const event = verifyStripeSignature(rawBody, request.headers?.['stripe-signature'], webhookSecret, now());
    if (!validId(event.id, 'evt_') || event.livemode !== live) fail('Événement Stripe incompatible.', 400);
    if (!STRIPE_EVENTS.includes(event.type)) return { ok: true, ignored: true };
    const eventRef = db().ref(`serverOnly/stripeWebhookEvents/${event.id}`);
    const claim = await transaction(eventRef, value => value?.status === 'done' || (value?.status === 'processing' && now() - value.startedAtMs < 60000) ? undefined : { status: 'processing', startedAtMs: now(), type: event.type });
    if (!claim.committed) { const state = await read(`serverOnly/stripeWebhookEvents/${event.id}`); if (state?.status === 'done') return { ok: true, duplicate: true }; fail('Événement Stripe en cours de traitement.', 503); }
    try {
      const item = event.data?.object || {};
      if (event.type === 'checkout.session.completed') { if (await read(`serverOnly/stripeCheckouts/${item.id}`)) await complete(item.id); }
      else if (event.type === 'checkout.session.expired') {
        const record = await read(`serverOnly/stripeCheckouts/${item.id}`);
        if (record?.kind === 'subscription') { const pending = await read(`serverOnly/stripePendingSubscriptions/${record.uid}`); if (pending?.sessionId === item.id) { await write(`serverOnly/stripePendingSubscriptions/${record.uid}`, null); await releaseProvider(record.uid, 'stripe', record.requestId); } }
      } else if (event.type.startsWith('customer.subscription.')) await reconcileSubscription(item.id);
      else if (event.type.startsWith('invoice.')) await reconcileSubscription(objectId(item.parent?.subscription_details?.subscription || item.subscription));
      else if (event.type === 'charge.refunded') { const charge = await api('charges/' + item.id); if (charge.refunded) await reverseCharge(charge, 'refunded'); }
      else if (event.type.startsWith('charge.dispute.')) { const charge = await api('charges/' + objectId(item.charge)); const dispute = await api('disputes/' + item.id); await reverseCharge(charge, dispute.status === 'won' && !charge.refunded ? 'paid' : 'disputed'); }
      await eventRef.set({ status: 'done', type: event.type, processedAt: time() });
      return { ok: true };
    } catch (error) { await eventRef.set({ status: 'failed', type: event.type, failedAt: time() }); throw error; }
  }

  async function assertPayPalAllowed(uid) {
    const current = await subscription(uid);
    if (paidProvider(current) && current.paymentProvider === 'stripe') fail('Votre abonnement Stripe est actif. Gérez-le avec votre moyen de paiement actuel.', 409);
    const pending = await read(`serverOnly/stripePendingSubscriptions/${uid}`);
    if (pending?.expiresAtMs > now()) fail('Un paiement Stripe est déjà ouvert. Terminez-le avant de souscrire avec PayPal.', 409);
  }

  const reservePayPalCheckout = async (uid, requestId) => { await assertPayPalAllowed(uid); await reserveProvider(uid, 'paypal', requestId); };
  return { checkout, sync, cancel, abandon, reservePayPalCheckout, webhook, refresh, assertPayPalAllowed, api, ready, live, complete, reconcileSubscription, config: () => ({ ready, environment: live ? 'live' : 'test', methods: ['card', 'google_pay', 'apple_pay', 'link'] }) };
}
