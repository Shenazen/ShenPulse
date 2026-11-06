"use strict";
/** Espace privé du fondateur ; conditions commerciales établies par l’administration. */
const AGENCY_SPACE_SECTIONS=[['invitation','key','Invitations'],['members','member','Demandes et membres'],['pack','tag','Mon offre groupée'],['tiers','crown','Mes paliers']];
function agencySpaceHasPack(view){return !!(view.dashboard?.directorPacksAvailable&&view.dashboard?.agencyPack?.terms);}
function agencySpaceSections(view){return AGENCY_SPACE_SECTIONS.filter(([key])=>key!=='pack'||agencySpaceHasPack(view));}
function agencySpaceSection(view=agencyState()){
 const id=view.dashboard?.ownAgency?.id;
 if(view.directorAgencyId!==id){view.directorAgencyId=id;view.directorSection='invitation';}
 if(!agencySpaceSections(view).some(([key])=>key===view.directorSection))view.directorSection='invitation';
 return view.directorSection;
}
function renderAgencySpaceNavigation(pending,view=agencyState()){
 const selected=agencySpaceSection(view),sections=agencySpaceSections(view);
 return '<nav class="agency-space-nav" data-section-count="'+sections.length+'" role="tablist" aria-label="Rubriques de mon espace agence">'+sections.map(([section,icon,label])=>'<button type="button" role="tab" id="agency-space-tab-'+section+'" aria-controls="agency-space-panel" aria-selected="'+(section===selected)+'" tabindex="'+(section===selected?'0':'-1')+'" class="button '+(section===selected?'is-active':'')+'" data-action="agency-space-section" data-section="'+section+'">'+agencyIcon(icon)+'<span>'+label+'</span>'+(section==='members'&&pending?'<b>'+pending+'</b>':'')+'</button>').join('')+'</nav>';
}
function renderAgencySpacePanel(view){
 if(!agencyIsDirector(view,true))return "";
 const selected=agencySpaceSection(view),a=view.dashboard.ownAgency,members=(view.dashboard.members||[]).filter(m=>!m.agencyId||m.agencyId===a.id);
 const pending=members.filter(m=>m.status==='pending').length,paid=members.filter(m=>m.status==='approved'&&m.paying).length;
 let body;
 if(selected==='invitation')body=renderAgencyInvitation(view,a);
 if(selected==='members')body='<section id="agency-space-members" class="agency-director-members" aria-labelledby="agency-members-title"><header class="agency-heading"><div><h4 id="agency-members-title">Demandes et membres</h4><p>'+pending+' demande'+(pending>1?'s':'')+' en attente · Acceptez les créateurs de votre agence ou retirez un membre si nécessaire.</p></div><span class="agency-team-count">'+members.length+' profil'+(members.length>1?'s':'')+'</span></header>'+agencyMemberRows(members)+'</section>';
 if(selected==='pack')body=renderAgencySpacePack(view);
 if(selected==='tiers')body='<div class="agency-space-tier-content">'+renderAgencyDirectorProgress(paid)+renderAgencyTiers(view)+'</div>';
 return '<div id="agency-space-panel" class="agency-space-tab-panel" role="tabpanel" tabindex="0" aria-labelledby="agency-space-tab-'+selected+'">'+body+'</div>';
}
function selectAgencySpaceSection(section,focus=false){
 const view=agencyState();if(currentPage!=='agencies'||!agencyIsDirector(view,true))return false;
 if(!agencySpaceSections(view).some(([key])=>key===section))return false;
 agencySpaceSection(view);view.directorSection=section;view.commandRevision=(view.commandRevision||0)+1;
 const root=document.getElementById('agency-owner-space'),panel=root?.querySelector('#agency-space-panel');
 if(!root||!panel)return true;
 root.querySelectorAll('[role="tab"]').forEach(button=>{const active=button.dataset.section===section;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;button.classList.toggle('is-active',active);});
 panel.outerHTML=renderAgencySpacePanel(view);
 if(focus)root.querySelector('#agency-space-tab-'+section)?.focus({preventScroll:true});
 return true;
}
function agencySpaceMoney(cents){return agencyMoney(Number(cents||0)/100);}
function agencySpaceQuote(quote){
 const q=quote||{};
 return '<div class="agency-space-estimate"><div><span>Total mensuel estimé</span><strong>'+agencySpaceMoney(q.effectiveMonthlyCents)+'<small> / mois</small></strong><p>'+(q.proCreators||0)+' Pro · '+(q.premiumCreators||0)+' Premium · '+(q.eligibleCreators||0)+' créateurs sélectionnés</p></div><span class="badge '+(q.ready?'success':'warning')+'">'+(q.ready?'Sélection complète':'À compléter')+'</span></div>'+
 (q.missingCreators?'<p class="agency-space-pack-status">Encore '+q.missingCreators+' créateur(s) pour atteindre le minimum.</p>':"")+
 (q.usesStandardRate?'<p class="agency-space-pack-status">Le tarif agence habituel s’applique sous le minimum prévu.</p>':"")+
 (q.reasons?.length?'<p class="agency-space-pack-status">'+escapeHtml(q.reasons.join(" · "))+'</p>':"");
}
function renderAgencySpacePack(view){
 if(!agencyIsDirector(view,true)||!agencySpaceHasPack(view))return "";
 const data=view.dashboard,offer=data.agencyPack,pack=offer?.terms;
 const content=
   '<div class="agency-space-pack-top"><div><p class="eyebrow">VOTRE OFFRE PERSONNALISÉE</p><h4>'+escapeHtml(pack.title)+'</h4><p>'+pack.minimumCreators+' créateurs minimum'+(pack.maximumCreators!=null?' · '+pack.maximumCreators+' maximum':'')+'</p></div><span class="badge">'+(offer.billing?.status==='active'?'Contrat actif':'En préparation')+'</span></div><div class="agency-pack-prices">'+["pro","premium"].filter(t=>pack.prices[t]!=null).map(t=>'<div><span>'+t.toUpperCase()+'</span><strong>'+agencySpaceMoney(pack.prices[t])+'</strong><small>/ créateur / mois</small></div>').join("")+'</div>'+
   agencySpaceQuote(offer.quote)+'<dl class="agency-space-pack-terms"><div><dt>Ajouts de créateurs</dt><dd>'+(pack.additions==="prorata"?'Prorata du temps restant':'Au prochain renouvellement')+'</dd></div><div><dt>Retraits de créateurs</dt><dd>'+(pack.removals==="credit"?'Avoir au prorata':'Au prochain renouvellement')+'</dd></div><div><dt>Sous le minimum</dt><dd>'+(pack.belowMinimum==="standard"?'Tarif agence habituel':'Offre groupée bloquée')+'</dd></div>'+(pack.validFrom||pack.validUntil?'<div><dt>Validité de l’offre</dt><dd>'+escapeHtml(pack.validFrom||'Dès maintenant')+' → '+escapeHtml(pack.validUntil||'Sans date de fin')+'</dd></div>':'')+'</dl>'+
   '<div class="agency-tools"><button type="button" class="button primary" data-action="agency-space-pack-edit" '+(view.busy?'disabled':'')+'>'+agencyIcon("member")+' Choisir les créateurs</button><span class="agency-space-pack-hint">Votre sélection est enregistrée pour cette agence.</span></div><p class="agency-space-payment-note">Enregistrer la sélection prépare le pack. Le paiement ou l’application des changements se confirme séparément ci-dessous. Les créateurs seront comptabilisés après l’activation de leurs accès groupés payés.</p>'+ (typeof renderAgencyPackBilling==='function'?renderAgencyPackBilling(view):'');
 return '<section id="agency-space-pack" class="agency-space-pack" aria-labelledby="agency-space-pack-title"><header class="agency-director-section-title"><span>'+agencyIcon("tag")+'</span><div><h3 id="agency-space-pack-title">Mon offre groupée</h3><p>Préparez la prise en charge de votre équipe.</p></div></header>'+content+'</section>';
}
function agencySpacePackContext(){
 const view=agencyState();
 if(currentPage!=="agencies"||!agencyIsDirector(view,true))throw Error("Ouvrez Mon espace agence avec le compte du fondateur d’une agence validée.");
 const offer=view.dashboard.agencyPack;
 if(!view.dashboard.directorPacksAvailable||!offer?.terms)throw Error("Aucune offre groupée disponible. Actualisez votre espace agence.");
 return {view,offer,pack:offer.terms};
}
function agencySpacePackPayload(offer,pack,data){
 return {expectedRevision:offer.revision,expectedPackRevision:pack.revision,seats:agencyPackSeatsFromForm(data)};
}
function openAgencySpacePackEditor(){
 const {view,offer,pack}=agencySpacePackContext();if(view.busy)return;
 const owner=captureCreatorPrivateOperation(),agencyId=view.dashboard.ownAgency.id;
 const members=(view.dashboard.members||[]).filter(m=>m.agencyId===agencyId&&m.status==="approved").sort((a,b)=>String(a.displayName||a.email).localeCompare(String(b.displayName||b.email),'fr'));
 openEditor({variant:"agency-pack",title:"Les créateurs de mon pack",kicker:pack.title,submitLabel:"Enregistrer la sélection",
 body:'<div class="agency-space-pack-editor"><p class="agency-pack-information">Choisissez les membres de votre agence à prendre en charge et leur formule. Vous pouvez conserver une sélection incomplète pour la terminer ensuite.</p>'+renderAgencyPackMemberPicker(pack,members,offer.seats||[])+'<div class="agency-tools"><button type="button" class="button" data-action="agency-space-pack-preview">Calculer le montant</button></div><div data-space-pack-summary role="status" aria-live="polite">'+agencySpaceQuote(offer.quote)+'</div><p class="muted">Cette sélection prépare votre offre : aucun paiement ni accès n’est activé. Les abonnements personnels restent inchangés.</p></div>',
 onSubmit:async form=>{assertCreatorPrivateOperation(owner);agencySpacePackContext();return agencyCommand("selectOwnPack",agencySpacePackPayload(offer,pack,form));}});
}
async function previewAgencySpacePack(button){
 const {view,offer,pack}=agencySpacePackContext(),root=button.closest(".agency-space-pack-editor"),form=root?.closest("form");
 if(!form||button.disabled)return;
 const owner=captureCreatorPrivateOperation(),version=root.dataset.revision||"",commandRevision=view.commandRevision;
 button.disabled=true;
 try{
   const result=await api.agencies.command("previewOwnPack",agencySpacePackPayload(offer,pack,new FormData(form)));
   assertCreatorPrivateOperation(owner);
   if(agencyState()!==view||currentPage!=="agencies"||view.commandRevision!==commandRevision||!root.isConnected||(root.closest("dialog")&&!root.closest("dialog").open)||(root.dataset.revision||"")!==version)return;
   root.querySelector("[data-space-pack-summary]").innerHTML=agencySpaceQuote(result.quote);
 }finally{if(button.isConnected)button.disabled=false;}
}
function updateAgencySpacePackInput(event){
 const root=event.target.closest(".agency-space-pack-editor");if(!root)return;
 root.dataset.revision=String(Number(root.dataset.revision||0)+1);
 root.querySelector("[data-space-pack-summary]").innerHTML='<p class="muted">Sélection modifiée. Calculez le montant pour actualiser votre estimation.</p>';
 if(event.target.matches("[data-pack-select-all]"))root.querySelectorAll('input[name="seat"]').forEach(input=>{input.checked=event.target.checked;});
 root.querySelector("[data-pack-selection-count]").textContent=root.querySelectorAll('input[name="seat"]:checked').length+" sélectionné(s)";
}
const AGENCY_SPACE_ACTIONS=new Set(["agency-space-section","agency-space-pack-edit","agency-space-pack-preview"]);
async function handleAgencySpaceAction({action,target}){
 if(!AGENCY_SPACE_ACTIONS.has(action))return ACTION_NOT_HANDLED;
 const view=agencyState();if(currentPage!=="agencies"||!agencyIsDirector(view,true))throw Error("Cet espace est réservé au fondateur de l’agence validée.");
 if(action==="agency-space-pack-edit")return openAgencySpacePackEditor();
 if(action==="agency-space-pack-preview")return previewAgencySpacePack(target);
 return selectAgencySpaceSection(target.dataset.section,true);
}
registerActionHandler(AGENCY_SPACE_ACTIONS,handleAgencySpaceAction);
document.addEventListener("change",updateAgencySpacePackInput);
document.addEventListener('keydown',event=>{
 const button=event.target.closest?.('[data-action="agency-space-section"][role="tab"]');if(!button)return;
 const sections=agencySpaceSections(agencyState()),index=sections.findIndex(([key])=>key===button.dataset.section);if(index<0)return;let next;
 if(event.key==='ArrowRight')next=(index+1)%sections.length;
 if(event.key==='ArrowLeft')next=(index+sections.length-1)%sections.length;
 if(event.key==='Home')next=0;if(event.key==='End')next=sections.length-1;
 if(next==null)return;event.preventDefault();selectAgencySpaceSection(sections[next][0],true);
});
