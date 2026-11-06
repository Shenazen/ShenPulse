"use strict";
function agencyBillingDate(value){const d=new Date(value||'');return Number.isFinite(d.getTime())?d.toLocaleDateString('fr-FR'):'';}
function renderAgencyPackBilling(view){
 if(!view.dashboard?.packBillingAvailable)return '<p class="agency-space-payment-note">La facturation groupée n’est pas disponible actuellement.</p>';
 const b=view.dashboard.agencyPack?.billing||{},busy=view.busy?'disabled':'',active=b.status==='active';
 const button=(action,label)=>'<button type="button" class="button" data-action="agency-billing-'+action+'" '+busy+'>'+label+'</button>';
 return '<section class="agency-billing-panel"><header class="agency-heading"><div><p class="eyebrow">FACTURATION DE VOTRE AGENCE</p><h4>'+(active?'Votre pack est actif':b.status==='payment_required'?'Paiement à régulariser':b.pending?'Paiement en cours':'Activer votre offre')+'</h4></div><span class="badge '+(active?'success':'warning')+'">'+(active?'Payé par l’agence':'À confirmer')+'</span></header>'+
 (b.paidThrough?'<div class="agency-pack-prices"><div><span>Période payée jusqu’au</span><strong>'+agencyBillingDate(b.paidThrough)+'</strong><small>'+b.paidCreators+' créateurs pris en charge</small></div><div><span>Prochain montant mensuel</span><strong>'+agencySpaceMoney(b.nextMonthlyCents)+'</strong><small>'+(b.cancelAtPeriodEnd?'Renouvellement arrêté':b.nextCreators+' créateurs au renouvellement')+'</small></div></div>':'<p>Le fondateur paie un seul abonnement mensuel pour les comptes sélectionnés. Les accès sont activés après confirmation du paiement.</p>')+
 (b.notice?'<p class="agency-pack-information">'+escapeHtml(b.notice)+'</p>':'')+
 '<div class="agency-tools">'+(b.pending?button('refresh','Actualiser le paiement')+(b.pendingKind==='checkout'?button('retry','Reprendre le paiement'):'')+button('pending-cancel','Annuler l’opération en attente'):button('preview',active?'Vérifier et appliquer ma sélection':'Activer et payer le pack'))+
 (b.paidThrough?button('portal','Factures et moyen de paiement')+button(b.cancelAtPeriodEnd?'resume':'cancel',b.cancelAtPeriodEnd?'Réactiver le renouvellement':'Arrêter le renouvellement'):'')+'</div>'+
 (b.lastInvoiceUrl?'<div class="agency-tools">'+button('invoice','Consulter la dernière facture')+'</div>':'')+
 '<p class="muted">Un compte ayant un abonnement personnel actif doit attendre la fin de sa période payée avant d’intégrer le pack. Aucun abonnement personnel n’est annulé automatiquement. Les changements commerciaux doivent être confirmés par le fondateur.</p></section>';
}
async function agencyBillingCommand(command,body={}){
 const {view}=agencySpacePackContext(),owner=captureCreatorPrivateOperation();if(view.busy)return;
 view.busy=true;render();
 try{const result=await api.agencies.command(command,body);assertCreatorPrivateOperation(owner);view.busy=false;await refreshAgencies();return result;}
 finally{if(agencyState()===view){view.busy=false;render();}}
}
function agencyBillingUrl(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||!['checkout.stripe.com','billing.stripe.com','invoice.stripe.com'].includes(u.hostname))throw Error('Le lien de facturation reçu est invalide.');return u.href;}
async function openAgencyBillingConfirmation(){
 const {view}=agencySpacePackContext(),owner=captureCreatorPrivateOperation(),result=await api.agencies.command('previewPackBilling',{});assertCreatorPrivateOperation(owner);if(agencyState()!==view||currentPage!=='agencies')return;
 const first=result.kind==='checkout';
 openEditor({variant:'agency-pack',title:first?'Activer le pack de mon agence':'Confirmer les changements du pack',submitLabel:first?'Continuer vers le paiement':'Appliquer ces changements',kicker:'CONFIRMATION DE FACTURATION',body:'<div class="agency-billing-confirm"><p>'+result.creators+' comptes créateurs sélectionnés.</p><div class="agency-pack-prices"><div><span>'+(first?'Abonnement mensuel':'Ajustement de la période en cours')+'</span><strong>'+agencySpaceMoney(first?result.monthlyCents:Math.abs(result.adjustmentCents))+'</strong><small>'+(first?'Facturé après confirmation sur Stripe':result.adjustmentCents<0?'Avoir appliqué par Stripe':result.adjustmentCents>0?'Prorata à régler':'Aucun supplément immédiat')+'</small></div><div><span>Au prochain renouvellement</span><strong>'+agencySpaceMoney(result.nextMonthlyCents)+'</strong><small>/ mois'+(result.effectiveAt?' · à partir du '+agencyBillingDate(result.effectiveAt):'')+'</small></div></div><p>'+(result.deferred?'Les changements différés prendront effet au renouvellement payé. ':'')+'Les accès supplémentaires ne sont activés qu’après validation du paiement. Vous pourrez arrêter le renouvellement depuis cet espace.</p><label class="checkbox-field"><input type="checkbox" name="billingConsent" required> Je confirme cette sélection, son montant et son renouvellement mensuel.</label></div>',onSubmit:async form=>{
  assertCreatorPrivateOperation(owner);if(!form.has('billingConsent'))throw Error('Confirmez le montant et le renouvellement avant de continuer.');
  const paid=await agencyBillingCommand(first?'checkoutOwnPack':'applyPackChange',{previewId:result.previewId});
  assertCreatorPrivateOperation(owner);if(paid?.invoiceUrl)await api.openExternal(agencyBillingUrl(paid.invoiceUrl));
 }});
}
const AGENCY_BILLING_ACTIONS=new Set(['agency-billing-preview','agency-billing-refresh','agency-billing-retry','agency-billing-portal','agency-billing-invoice','agency-billing-cancel','agency-billing-resume','agency-billing-pending-cancel']);
async function handleAgencyBillingAction({action}){
 if(!AGENCY_BILLING_ACTIONS.has(action))return ACTION_NOT_HANDLED;
 const {view}=agencySpacePackContext(),b=view.dashboard.agencyPack?.billing||{};
 if(action==='agency-billing-preview')return openAgencyBillingConfirmation();
 if(action==='agency-billing-refresh')return agencyBillingCommand('syncPackBilling');
 if(action==='agency-billing-retry')return agencyBillingCommand('checkoutOwnPack',{previewId:b.pendingPreviewId});
 if(action==='agency-billing-portal'){const guard=captureCreatorPrivateOperation(),result=await api.agencies.command('packBillingPortal',{});assertCreatorPrivateOperation(guard);return api.openExternal(agencyBillingUrl(result.approvalUrl));}
 if(action==='agency-billing-invoice')return api.openExternal(agencyBillingUrl(b.lastInvoiceUrl));
 const resume=action==='agency-billing-resume',pending=action==='agency-billing-pending-cancel',owner=captureCreatorPrivateOperation();
 if(!await confirmAction(pending?'Annuler la modification non payée ? La sélection et les accès déjà réglés restent conservés.':resume?'Réactiver le renouvellement mensuel de ce pack ?':'Arrêter le renouvellement ? Les accès restent disponibles jusqu’à la fin de la période payée.',{title:'Facturation du pack',confirmLabel:'Confirmer'}))return;
 assertCreatorPrivateOperation(owner);return agencyBillingCommand(pending?'cancelPackPending':resume?'resumePackBilling':'cancelPackBilling',{expectedRevision:b.revision});
}
registerActionHandler(AGENCY_BILLING_ACTIONS,handleAgencyBillingAction);
