"use strict";
/** Présentation du programme : fragments communs à l'annuaire et à l'accueil. */
function agencyIcon(name) {
  const paths={
    team:'<path d="m11 17-2 2a2 2 0 0 1-3-3l-2-2 5-6 4-2 3 2 4 6-2 3a2 2 0 0 1-3 1l-4-4"/><path d="m9 8 3 3a2 2 0 0 0 3-3l-2-2M2 12l3-5M22 12l-3-5M8 18l2 2a2 2 0 0 0 3-1"/>',
    shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
    bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
    key:'<circle cx="8" cy="8" r="4"/><path d="m11 11 10 10m-3-3 3-3m-6 0 3-3"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    member:'<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3m0-12 2 2 4-5"/>',
    tag:'<path d="M3 3h9l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1"/>',
    building:'<path d="M4 21V3h12v18M16 9h4v12M2 21h20M8 7h1m3 0h1M8 11h1m3 0h1M8 15h1m3 0h1M9 21v-3h3v3"/>',
    crown:'<path d="m3 6 4 4 5-7 5 7 4-4-2 14H5z"/>',
    diamond:'<path d="M6 3h12l4 6-10 13L2 9zM2 9h20M6 3l6 19 6-19"/>',
    refresh:'<path d="M20 10a8 8 0 1 0-2 8M20 3v7h-7"/>'
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(paths[name] || paths.team)+'</svg>';
}
function agencyTierBadge(a) {
  const labels={silver:"Argent",gold:"Or",diamond:"Diamant"};
  return a.level?'<span class="agency-tier-badge agency-level-'+escapeHtml(a.level)+'">'+agencyIcon(a.level==="diamond"?"diamond":a.level==="gold"?"crown":"team")+escapeHtml(labels[a.level] || "")+'</span>':"";
}
function renderAgencyCard(a,active=false) {
  return '<article class="agency-panel agency-card">'+(a.bannerUrl?'<img class="agency-card-banner" src="'+escapeHtml(a.bannerUrl)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':"")+
    '<div class="agency-card-body"><div class="agency-card-title">'+(a.logoUrl?'<img src="'+escapeHtml(a.logoUrl)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'<span class="agency-monogram">'+escapeHtml(a.name.slice(0,2).toUpperCase())+'</span>')+
    '<div><h3>'+escapeHtml(a.name)+'</h3>'+agencyTierBadge(a)+'</div></div><p>'+escapeHtml(a.description)+'</p><div class="agency-tools">'+
    [["website","Site"],["discord","Discord"],["tiktok","TikTok"],["instagram","Instagram"]].filter(([k])=>a[k]).map(([k,label])=>'<button type="button" class="button small" data-action="agency-link" data-value="'+escapeHtml(a[k])+'">'+label+'</button>').join("")+
    '</div><button type="button" class="button primary" data-action="agency-join" data-id="'+escapeHtml(a.id)+'" '+(active?"disabled":"")+'>Rejoindre</button></div></article>';
}
function renderAgencyJoin(view) {
  const member=view.dashboard?.membership,active=member && ["pending","approved"].includes(member.status);
  if(active)return '<div class="agency-current"><div><strong>'+escapeHtml(member.agencyName)+'</strong> '+agencyBadge(member.status)+'</div><p>'+
    (member.status==="pending"?"Votre demande attend la validation du directeur.":view.dashboard.pricing?.eligible?"Votre tarif agence est disponible dans les abonnements.":"Cette agence n’est plus active. Contactez son directeur.")+
    '</p><div class="agency-tools">'+(view.dashboard.pricing?.eligible?'<button type="button" class="button primary small" data-navigate="membership">Voir mon tarif agence</button>':"")+
    '<button type="button" class="button small" data-action="agency-leave">'+(member.status==="pending"?"Annuler la demande":"Quitter l’agence")+'</button></div></div>';
  return '<form id="agency-join-form" class="agency-code-form"><label for="agency-code">'+agencyIcon("key")+' Votre agence vous a donné un code ?</label><input id="agency-code" name="code" required maxlength="30" placeholder="Code de votre agence" autocomplete="off" value="'+escapeHtml(view.joinCode || "")+'"><button class="button primary" type="submit" '+(view.busy?"disabled":"")+'>'+agencyIcon("member")+' Rejoindre</button></form>';
}
function renderAgencyPrices(p) {
  return '<aside class="agency-price-box" aria-label="Tarifs mensuels agence"><span class="agency-discount">−'+Math.round((1-p.agency.pro/p.public.pro)*100)+' %</span><p class="eyebrow">PRIX AGENCE</p>'+
    ["pro","premium"].map(t=>'<div class="agency-price-line"><strong>'+t.toUpperCase()+'</strong><span><b>'+agencyMoney(p.agency[t])+'</b><small>/ mois</small></span><small>au lieu de <s>'+agencyMoney(p.public[t])+'</s></small></div>').join("")+'</aside>';
}
function renderAgencySteps() {
  return '<section class="agency-steps" aria-label="Rejoindre en trois étapes">'+[
    ["search","Trouvez votre agence","Cliquez sur « Rejoindre » sur sa fiche, ou saisissez le code donné par votre agence."],
    ["member","Votre agence valide","Votre directeur confirme que vous faites bien partie de son équipe."],
    ["tag","Le tarif agence est disponible","Choisissez Pro ou Premium au tarif agence. Le paiement reste à confirmer dans PayPal."]
  ].map(([icon,title,detail],i)=>'<article class="agency-step"><span class="agency-step-number" aria-hidden="true">'+(i+1)+'</span><span class="agency-step-icon">'+agencyIcon(icon)+'</span><h3>'+title+'</h3><p>'+detail+'</p></article>').join("")+'</section>';
}
function renderAgencyTiers() {
  return '<section class="agency-tiers-section" aria-labelledby="agency-tiers-title"><h3 id="agency-tiers-title">Paliers des agences</h3><div class="agency-tiers">'+[
    ["silver","team","Argent","3","Fiche visible dans l’annuaire et badge partenaire."],
    ["gold","crown","Or","10","Priorité dans l’annuaire et rotation « Agence du jour »."],
    ["diamond","diamond","Diamant","25","Pro offert au directeur et bannière sur l’accueil de ShenPulse."]
  ].map(([level,icon,title,count,detail])=>'<article class="agency-tier agency-level-'+level+'">'+agencyIcon(icon)+'<h4>'+title+'</h4><small>'+count+'+ créateurs abonnés</small><p>'+detail+'</p></article>').join("")+'</div></section>';
}
function renderAgencyPageContent(view) {
  const agencies=view.directory?.agencies || [],active=["pending","approved"].includes(view.dashboard?.membership?.status);
  const p=view.directory?.prices || {public:{pro:14.99,premium:20.99},agency:{pro:9.99,premium:13.99}};
  const featured=agencies.find(a=>a.id===view.directory?.featuredAgencyId);
  const directoryBody=agencies.length?'<div class="agency-directory">'+agencies.map(a=>renderAgencyCard(a,active)).join("")+'</div>':
    view.error?'<div class="agency-empty agency-unavailable"><p>L’annuaire ne peut pas être chargé pour le moment.</p></div>':view.busy?'<div class="agency-empty" role="status"><span class="pulse-loader"></span><p>Chargement de l’annuaire…</p></div>':
    '<div class="agency-empty">'+agencyIcon("team")+'<h3>Les premières agences partenaires arrivent</h3><p>Une agence apparaît ici dès 3 créateurs Pro ou Premium abonnés. Vous avez un code ? Saisissez-le en haut de la page.</p></div>';
  return '<div class="agency-page"><header class="agency-page-heading"><h2>'+agencyIcon("team")+' Agences</h2><p>Les agences partenaires de ShenPulse : leurs créateurs profitent de Pro et Premium à prix réduit.</p></header>'+
    '<section class="agency-hero"><div class="agency-hero-copy"><p class="eyebrow">PROGRAMME AGENCES</p><h2>ShenPulse au prix agence</h2><p>Votre agence est partenaire ? Rejoignez-la ici : dès qu’elle valide votre demande, le tarif agence devient disponible pour votre abonnement.</p>'+
    '<ul class="agency-benefits"><li>'+agencyIcon("bolt")+'Les avantages de votre formule, au tarif agence</li><li>'+agencyIcon("shield")+'Agences vérifiées par ShenPulse</li><li>'+agencyIcon("refresh")+'Sans engagement, résiliable à tout moment</li></ul>'+renderAgencyJoin(view)+'</div>'+renderAgencyPrices(p)+'</section>'+
    agencyNotice(view)+'<section class="agency-list-section" aria-labelledby="agency-directory-title"><header class="agency-heading"><h3 id="agency-directory-title">Agences partenaires <span class="badge">'+agencies.length+'</span></h3><button type="button" class="button small" data-action="agency-refresh" '+(view.busy?"disabled":"")+'>'+agencyIcon("refresh")+' Actualiser</button></header>'+
    (featured?'<div class="agency-day"><span>'+agencyIcon("crown")+' Agence du jour</span><strong>'+escapeHtml(featured.name)+'</strong><button type="button" class="button small" data-action="agency-join" data-id="'+escapeHtml(featured.id)+'" '+(active?"disabled":"")+'>Rejoindre</button></div>':"")+directoryBody+'</section>'+
    renderAgencySteps()+renderAgencyDirector(view)+renderAgencyEditorSection(view)+renderAgencyTiers()+'<p class="agency-contract-note">Les abonnements existants conservent leur tarif convenu. Toute modification d’un abonnement nécessite votre confirmation dans PayPal.</p></div>';
}
function renderAgencyHomeSpotlight() {
  const view=ensureAgencyData(),a=view.directory?.agencies?.find(a=>a.id===view.directory?.homeAgencyId);
  if(!a)return "";
  return '<section class="agency-home-spotlight">'+(a.bannerUrl?'<img src="'+escapeHtml(a.bannerUrl)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':"")+'<div><span>AGENCE PARTENAIRE · DIAMANT</span><h3>'+escapeHtml(a.name)+'</h3><p>'+escapeHtml(a.description)+'</p><button type="button" class="button primary" data-navigate="agencies">Découvrir les agences</button></div></section>';
}

function renderAgencyDirectorProgress(paid) {
  const tier=paid>=25?"Diamant":paid>=10?"Or":paid>=3?"Argent":"En préparation";
  return '<div class="agency-director-progress"><strong>Palier '+tier+'</strong><p>'+(paid>=25?
    'Pro est offert au directeur tant que votre agence compte au moins 25 créateurs abonnés actifs. Si vous avez déjà un abonnement, ses prélèvements restent inchangés : vous pouvez gérer son arrêt depuis Abonnement.':
    paid>=10?'Votre agence peut apparaître comme Agence du jour. Encore '+(25-paid)+' créateurs abonnés pour le palier Diamant et Pro offert au directeur.':
    paid>=3?'Votre fiche est visible dans l’annuaire. Encore '+(10-paid)+' créateurs abonnés pour le palier Or.':
    'Votre code fonctionne déjà. Encore '+(3-paid)+' créateurs abonnés pour afficher votre fiche dans l’annuaire.')+'</p></div>';
}
