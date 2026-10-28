"use strict";
/** Composants de l’espace privé du fondateur, indépendants de la revue administrateur. */
function agencyIsDirector(view,approved=false) {
  const a=view.dashboard?.ownAgency;
  return !!view.uid && !!a && (!a.ownerUid || a.ownerUid===view.uid) && (!approved || a.status==="approved");
}
function agencyMemberRows(members) {
  if(!members?.length)return '<div class="agency-members-empty">'+agencyIcon("member")+'<strong>Votre équipe commence ici</strong><p>Partagez votre invitation : les demandes de vos créateurs apparaîtront dans cet espace.</p></div>';
  const order={pending:0,approved:1};
  return '<div class="agency-member-list">'+[...members].sort((a,b)=>(order[a.status] ?? 2)-(order[b.status] ?? 2)).map(m=>
    '<article class="agency-member"><div class="agency-member-person"><span class="agency-member-avatar" aria-hidden="true">'+escapeHtml(String(m.displayName || m.email || "?").replace(/^@/,"").slice(0,2).toUpperCase())+'</span><div><strong>'+escapeHtml(m.displayName || m.email)+'</strong><small>'+escapeHtml(m.email)+'</small></div></div><div>'+agencyBadge(m.status)+'<small>'+(m.paying?escapeHtml(String(m.tier || "").toUpperCase())+' · abonnement actif':"Sans abonnement payant actif")+'</small></div><div class="agency-tools">'+
    (m.status==="pending"?'<button type="button" class="button primary small" data-action="agency-member" data-id="'+escapeHtml(m.uid)+'" data-status="approved">Accepter</button><button type="button" class="button small" data-action="agency-member" data-id="'+escapeHtml(m.uid)+'" data-status="rejected">Refuser</button>':
      m.status==="approved"?'<button type="button" class="button small" data-action="agency-member" data-id="'+escapeHtml(m.uid)+'" data-status="removed">Retirer</button>':"")+'</div></article>').join("")+'</div>';
}
function renderAgencyInvitation(view,a) {
  const available=!!a.code && a.code!==view.invalidatedCode,locked=view.busy || view.rotationPending || !available;
  return '<section class="agency-invitation" aria-labelledby="agency-invitation-title"><div class="agency-director-section-title"><span>'+agencyIcon("key")+'</span><div><h4 id="agency-invitation-title">Invitez vos créateurs</h4><p>Un code ou un lien, à partager avec votre équipe.</p></div></div>'+
    '<label for="agency-invitation-code">Code à transmettre à vos créateurs</label><input id="agency-invitation-code" readonly value="'+escapeHtml(available?a.code:"")+'" placeholder="Actualisez pour charger le nouveau code" autocomplete="off" spellcheck="false">'+
    '<div class="agency-tools"><button type="button" class="button primary" data-action="agency-copy" data-value="'+escapeHtml(available?a.code:"")+'" '+(locked?"disabled":"")+'>'+agencyIcon("copy")+' Copier le code</button>'+
    '<button type="button" class="button" data-action="agency-copy" data-value="https://shenpulse.leuridan.fr/agences/rejoindre?code='+escapeHtml(available?a.code:"")+'" '+(locked?"disabled":"")+'>'+agencyIcon("link")+' Copier le lien</button></div>'+
    '<div class="agency-invitation-renew"><button type="button" class="button small" data-action="agency-rotate-code" '+(locked?"disabled":"")+'>'+agencyIcon("refresh")+' '+(view.rotationPending?"Renouvellement…":"Régénérer le code")+'</button><p>Après régénération, l’ancien code et l’ancien lien deviennent inactifs. Vos membres et leurs demandes restent conservés.</p></div>'+
    (!available?'<button type="button" class="button small" data-action="agency-refresh">Actualiser le nouveau code</button>':"")+'</section>';
}
function renderAgencyDirector(view) {
  if(!agencyIsDirector(view))return "";
  const a=view.dashboard.ownAgency,members=(view.dashboard.members || []).filter(m=>!m.agencyId || m.agencyId===a.id);
  const accepted=members.filter(m=>m.status==="approved").length,pending=members.filter(m=>m.status==="pending").length,paid=members.filter(m=>m.status==="approved" && m.paying).length;
  const stats=[["member",accepted,"membres validés","cyan"],["clock",pending,"demandes en attente","pink"],["crown",paid,"abonnements actifs","gold"]];
  return '<section class="agency-panel agency-profile agency-director" aria-label="Espace fondateur de '+escapeHtml(a.name)+'">'+renderAgencyProfileHeader(a,"MON AGENCE")+
    '<div class="agency-profile-body"><div class="agency-director-toolbar"><p class="agency-private-note">'+agencyIcon("shield")+' Espace privé · Visible uniquement par vous et l’administration ShenPulse.</p><button type="button" class="button small" data-action="agency-edit">'+agencyIcon("edit")+' Modifier ma fiche</button></div>'+
    (a.reason?'<p class="agency-notice">'+escapeHtml(a.reason)+'</p>':"")+'<p class="agency-profile-description">'+escapeHtml(a.description)+'</p>'+
    (a.status==="approved"?'<div class="agency-director-stats" aria-label="Chiffres de votre agence">'+stats.map(([icon,count,label,color])=>'<div class="agency-director-stat agency-stat-'+color+'"><span>'+agencyIcon(icon)+'</span><div><strong>'+count+'</strong><small>'+label+'</small></div></div>').join("")+'</div>'+
      '<div class="agency-director-workspace">'+renderAgencyInvitation(view,a)+renderAgencyDirectorProgress(paid)+'</div>'+
      '<section class="agency-director-members" aria-labelledby="agency-members-title"><header class="agency-heading"><div><h4 id="agency-members-title">Demandes et membres</h4><p>'+pending+' demande'+(pending>1?'s':'')+' en attente · Acceptez les créateurs de votre agence ou retirez un membre si nécessaire.</p></div><span class="agency-team-count">'+members.length+' profil'+(members.length>1?'s':'')+'</span></header>'+agencyMemberRows(members)+'</section>':
      '<div class="agency-director-pending">'+agencyIcon("clock")+'<div><strong>Votre espace se prépare</strong><p>Lorsque ShenPulse aura validé votre agence, vous pourrez inviter vos créateurs et gérer leurs demandes ici.</p></div></div>')+'</div></section>';
}
async function rotateAgencyInvitation() {
  const view=agencyState(),owner=captureCreatorPrivateOperation();
  if(view.busy || view.rotationPending)return;
  if(currentPage!=="agencies" || !agencyIsDirector(view,true))throw Error("Seul le fondateur d’une agence validée peut régénérer son code.");
  const a=view.dashboard.ownAgency,previous=a.code;
  if(!previous || previous===view.invalidatedCode)throw Error("Actualisez pour charger votre code d’invitation.");
  view.rotationPending=true;render();
  try {
    if(!await confirmAction("L’ancien code et l’ancien lien deviendront inactifs immédiatement. Vos membres et leurs demandes seront conservés. Régénérer l’invitation ?",{title:"Régénérer le code d’agence",confirmLabel:"Régénérer le code"}))return;
    assertCreatorPrivateOperation(owner);
    if(agencyState()!==view || !agencyIsDirector(view,true) || view.dashboard.ownAgency.id!==a.id || view.dashboard.ownAgency.code!==previous)throw Error("Votre agence a été actualisée. Vérifiez le code avant de réessayer.");
    await agencyCommand("rotateCode",{expectedCode:previous});
    assertCreatorPrivateOperation(owner);
    if(agencyState()!==view)return;
    view.invalidatedCode=previous;
    await confirmAction("L’ancien code et l’ancien lien sont désormais inactifs. Vos membres et leurs demandes sont conservés. Copiez votre nouvelle invitation dans Mon agence.",{title:"Nouveau code créé",confirmLabel:"Compris",acknowledge:true});
  } finally {if(agencyState()===view){view.rotationPending=false;render();}}
}
