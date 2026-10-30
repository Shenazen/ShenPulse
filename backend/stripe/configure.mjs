import '../env.js';
import fs from 'node:fs';
import { createStripePayments, STRIPE_EVENTS, STRIPE_API_VERSION } from './service.mjs';
const stripe = createStripePayments({env: process.env});
const endpointUrl = 'https://shenpulse.leuridan.fr/api/payments/stripe/webhook';
const all = await stripe.api('webhook_endpoints', {body: {limit: 100}});
let endpoint = all.data?.find(value => value.url === endpointUrl);
let secret = process.env.STRIPE_WEBHOOK_SECRET;
if (endpoint && !secret) throw new Error('Un webhook ShenPulse existe déjà mais sa signature manque. Récupérez sa signature dans Stripe.');
if (!endpoint) {
  endpoint = await stripe.api('webhook_endpoints', {method:'POST',body:{url:endpointUrl,description:'ShenPulse — achats et abonnements',api_version:STRIPE_API_VERSION,enabled_events:STRIPE_EVENTS},idempotencyKey:'shenpulse-webhook-v1'});
  secret = endpoint.secret;
}
if (!/^whsec_[A-Za-z0-9]+$/.test(secret || '')) throw new Error('Signature Stripe absente.');
const envPath = new URL('../../.env', import.meta.url);
const current = fs.readFileSync(envPath,'utf8');
fs.writeFileSync(envPath,current.replace(/^STRIPE_WEBHOOK_(SECRET|ID)=.*(?:\r?\n|$)/gm,'').trimEnd()+'\nSTRIPE_WEBHOOK_SECRET='+secret+'\nSTRIPE_WEBHOOK_ID='+endpoint.id+'\n',{mode:0o600});
fs.chmodSync(envPath,0o600);
console.log(JSON.stringify({webhookId:endpoint.id,url:endpointUrl,events:endpoint.enabled_events,live:endpoint.livemode,configured:true}));
