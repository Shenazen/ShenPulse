"use strict";
const {randomBytes}=require('node:crypto');
const {setTimeout:delay}=require('node:timers/promises');
const {createPaymentLoopbackCallback}=require('./payment-loopback');
const {stripeApprovalUrl}=require('./stripe-checkout');
const {captureSessionGuard}=require('./session-guard');
const {readState}=require('../state-projection');
async function runAgencyPackCheckout(service,incoming,command){
 if(service.agencyPackCheckoutBusy||service.subscriptionCheckoutCancel)throw Error('Un paiement d’agence est déjà ouvert.');
 const guard=captureSessionGuard(service,()=>readState(service.store,['settings.account']).settings.account||{});
 if(typeof service.openExternal!=='function')throw Error('L’ouverture du paiement est indisponible.');
 service.agencyPackCheckoutBusy=true;const state=randomBytes(32).toString('base64url');let callback,payload,cancel;
 try{
  callback=await createPaymentLoopbackCallback({state,timeoutMs:10*60000});guard.assertCurrent();cancel=()=>callback.cancel();service.subscriptionCheckoutCancel=cancel;
  payload=await command('createPackCheckout',{previewId:incoming.previewId,desktopCallbackPort:callback.port,desktopCallbackState:state});guard.assertCurrent();
  if(payload.checkoutCompleted)return await command('syncPackBilling',{sessionId:payload.id});
  await service.openExternal(stripeApprovalUrl(payload.approvalUrl));
  const result=await callback.result;guard.assertCurrent();
  if(result.sessionId&&result.sessionId!==payload.id)throw Error('Le retour reçu ne correspond pas au paiement de ce pack.');
  if(result.cancelled)return await command('abandonPackCheckout',{sessionId:payload.id});
  let confirmed;for(let i=0;i<6;i++){confirmed=await command('syncPackBilling',{sessionId:payload.id});guard.assertCurrent();if(!confirmed.pending)break;await delay(500);}
  return confirmed;
 }finally{if(service.subscriptionCheckoutCancel===cancel)service.subscriptionCheckoutCancel=null;callback?.close();service.agencyPackCheckoutBusy=false;}
}
module.exports={runAgencyPackCheckout};
