"use strict";
let agencyView = { uid: "", generation: -1, directory: null, dashboard: null, admin: null, busy: false, error: "", loadedAt: 0 };
const AGENCY_STATUS_LABELS = {pending:"En attente",approved:"Validé",rejected:"Refusé",suspended:"Suspendu",removed:"Retiré",left:"Quitté"};
function agencyState() {
  const uid=isAccountAuthenticated()?creatorPrivateOperationUid():"", generation=creatorPrivateOperationGeneration;
  if(agencyView.uid!==uid || agencyView.generation!==generation){clearTimeout(agencyView.identityTimer);agencyView={uid,generation,directory:null,dashboard:null,admin:null,busy:false,error:"",loadedAt:0};}
  return agencyView;
}
function agencyErrorMessage(error){
  return String(error?.message || error || "Chargement impossible.").replace(/^Error invoking remote method '[^']+': (?:Error: )?/,"");
}
function agencyMoney(n){return Number(n).toFixed(2).replace(".",",")+" €";}
function refreshAgencies(admin=false) {
  const view=agencyState(); if(view.busy)return view.refreshPromise || Promise.resolve();
  view.commandRevision=(view.commandRevision || 0)+1;
  view.busy=true;view.error="";
  if(["agencies","membership","admin","home"].includes(currentPage))render();
  view.refreshPromise=(async()=>{
  try {
    const directory=await api.agencies.list();
    const dashboard=view.uid?await api.agencies.dashboard():null;
    const administration=admin && isVerifiedAdminSession()?await api.admin.agenciesDashboard():null;
    if(agencyState()!==view)return;
    Object.assign(view,{directory,dashboard,...(administration?{admin:administration}:{}),loadedAt:Date.now()});
    if(typeof scheduleAgencyIdentitySync==="function")scheduleAgencyIdentitySync();
  } catch(error){if(agencyState()===view)view.error=agencyErrorMessage(error);}
  finally {if(agencyState()===view){view.busy=false;if(["agencies","membership","admin","home"].includes(currentPage))render();if(typeof syncMembershipPopup==="function")syncMembershipPopup();}}
  })();
  return view.refreshPromise;
}
function ensureAgencyData(admin=false) {
  const view=agencyState();
  if(!view.busy && !view.error && (!view.directory || admin && !view.admin))queueMicrotask(()=>void refreshAgencies(admin));
  return view;
}
function agencySubscriptionPlans(){
  const view=agencyState(),pricing=view.dashboard?.pricing;
  const base=typeof SUBSCRIPTION_PLANS!=="undefined"?SUBSCRIPTION_PLANS:[];
  return base.map(plan=>({...plan,price:plan.tier==="free"?0:Number(pricing?.quoted?.[plan.tier] ?? view.directory?.prices?.public?.[plan.tier] ?? plan.price)}));
}
function agencyCanApplyTariff(tier, subscription){
  const pricing=agencyState().dashboard?.pricing;
  return pricing?.eligible && subscription?.source==="own" && subscription.tier===tier && Number(subscription.priceMonthly)>Number(pricing.quoted[tier]);
}
function agencyNotice(view){
  return view.error?'<div class="agency-notice" role="alert"><strong>Agences indisponibles</strong><p>'+escapeHtml(view.error)+'</p><button type="button" class="button" data-action="agency-refresh">Réessayer</button></div>':view.busy?'<p class="agency-loading" role="status"><span class="pulse-loader"></span> Actualisation des agences…</p>':"";
}
function agencyBadge(status){return '<span class="badge '+(status==="approved"?"success":"warning")+'">'+escapeHtml(AGENCY_STATUS_LABELS[status] || status)+'</span>';}
function renderAgencies(){return renderAgencyPageContent(ensureAgencyData());}
function renderAdminAgencies(){
  if(!isVerifiedAdminSession())return "";
  const view=ensureAgencyData(true),data=view.admin;
  return '<div class="agency-page"><section class="agency-panel"><header class="agency-heading"><div><h3>Agences partenaires</h3><p>Validez les fiches des agences. Leurs fondateurs gèrent les adhésions dans Agences → Mon agence. Aucune commission n’est versée aux agences.</p></div><button class="button" data-action="agency-admin-refresh">Actualiser</button></header>'+agencyNotice(view)+'</section>'+(data?(data.allAgencies || []).map(a=>renderAgencyReviewCard(a,(data.members || []).filter(m=>m.agencyId===a.id))).join("") || '<p class="agency-panel">Aucune agence n’a encore envoyé de fiche.</p>':"")+'</div>';
}
async function agencyCommand(command,body={},admin=false){
  const owner=captureCreatorPrivateOperation(),view=agencyState();
  if(view.busy)throw new Error("Une actualisation est en cours. Réessayez dans un instant.");
  view.commandRevision=(view.commandRevision || 0)+1;
  view.busy=true;render();
  try{
    await (admin?api.admin.agenciesCommand(command,body):api.agencies.command(command,body));
    assertCreatorPrivateOperation(owner);
    view.busy=false;await refreshAgencies(admin || currentPage==="admin");
  }finally{if(agencyState()===view){view.busy=false;render();}}
}
async function handleAgencyAction({action,target,id}){
  if(!action.startsWith("agency-"))return ACTION_NOT_HANDLED;
  if(action==="agency-refresh" || action==="agency-admin-refresh")return refreshAgencies(action==="agency-admin-refresh" || currentPage==="admin");
  if(action==="agency-link")return api.openExternal(target.dataset.value);
  if(!isAccountAuthenticated())return openAccountLogin();
  if(action==="agency-copy")return api.copy(target.dataset.value);
  if(action==="agency-edit")return editAgency();
  if(action==="agency-join")return joinAgency(id || "");
  if(action==="agency-cancel-edit"){agencyState().editor=null;agencyState().formError="";return render();}
  if(action==="agency-upload")return uploadAgencyImage(target.dataset.field);
  if(action==="agency-clear-image" && ["logoUrl","bannerUrl"].includes(target.dataset.field) && agencyState().editor){agencyState().editor[target.dataset.field]="";return render();}
  if(action==="agency-rotate-code")return rotateAgencyInvitation();
  if(action==="agency-leave" && await confirmAction("Quitter l’agence ou annuler la demande ? Votre abonnement actuel conserve son tarif convenu.",{title:"Adhésion à l’agence",confirmLabel:"Confirmer"}))return agencyCommand("leave");
  if(action==="agency-member"){
    const view=agencyState(),a=view.dashboard?.ownAgency,member=view.dashboard?.members?.find(m=>m.uid===id);
    if(currentPage!=="agencies" || a?.status!=="approved" || !member || member.agencyId!==a.id)throw Error("Gérez les membres de votre agence depuis Agences → Mon agence. Seul son fondateur peut valider les adhésions.");
    const owner=captureCreatorPrivateOperation();
    if(!await confirmAction("Confirmer cette décision pour ce créateur ?",{title:"Gestion des membres",confirmLabel:"Confirmer"}))return;
    assertCreatorPrivateOperation(owner);
    return agencyCommand("reviewMember",{uid:id,status:target.dataset.status});
  }
  if(action==="agency-review")return openEditor({title:"Décision concernant l’agence",submitLabel:"Confirmer",body:'<p>Décision : '+escapeHtml(AGENCY_STATUS_LABELS[target.dataset.status])+'.</p><label class="field full"><span>Motif ou message au directeur</span><textarea name="reason" maxlength="500"></textarea></label>',onSubmit:async data=>agencyCommand("reviewAgency",{agencyId:id,status:target.dataset.status,reason:data.get("reason")},true)});
}
registerActionHandler(new Set(["agency-refresh","agency-admin-refresh","agency-copy","agency-link","agency-edit","agency-join","agency-cancel-edit","agency-upload","agency-clear-image","agency-rotate-code","agency-leave","agency-member","agency-review"]),handleAgencyAction);
