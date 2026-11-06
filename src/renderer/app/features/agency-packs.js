"use strict";
/** Console privée de préparation des offres groupées, distincte des tarifs publics. */
function agencyPackMoney(cents){return agencyMoney(Number(cents)/100);}
function agencyPackLabel(status){return {draft:"Brouillon",enabled:"Disponible",archived:"Archivé"}[status]||"Brouillon";}
function agencyPackData(){return agencyState().admin||{};}
function agencyPackButton(action,text,id="",extra=""){return '<button type="button" class="button small" data-action="agency-pack-'+action+'" data-id="'+escapeHtml(id)+'" '+extra+'>'+text+'</button>';}
function renderAgencyPackCard(pack,data){
 const uses=(data.agencyPackAssignments||[]).filter(a=>a.packId===pack.id);
 const prices=["pro","premium"].filter(t=>pack.prices[t]!=null).map(t=>'<div><span>'+t.toUpperCase()+'</span><strong>'+agencyPackMoney(pack.prices[t])+'</strong><small>/ créateur / mois</small></div>').join("");
 return '<article class="agency-pack-card"><header><div><span class="eyebrow">OFFRE PERSONNALISÉE</span><h3>'+escapeHtml(pack.title)+'</h3></div><span class="badge '+(pack.status==="enabled"?"success":"warning")+'">'+agencyPackLabel(pack.status)+'</span></header><div class="agency-pack-prices">'+prices+'</div><p><strong>'+pack.minimumCreators+' créateurs minimum</strong>'+(pack.maximumCreators!=null?' · '+pack.maximumCreators+' maximum':'')+'</p><dl class="agency-pack-terms"><div><dt>Sous le minimum</dt><dd>'+(pack.belowMinimum==="standard"?"Tarif agence habituel":"Offre bloquée")+'</dd></div><div><dt>Ajouts</dt><dd>'+(pack.additions==="prorata"?"Prorata immédiat":"Au renouvellement")+'</dd></div><div><dt>Retraits</dt><dd>'+(pack.removals==="credit"?"Avoir au prorata":"Au renouvellement")+'</dd></div><div><dt>Attributions</dt><dd>'+uses.length+' agence'+(uses.length>1?'s':'')+'</dd></div></dl>'+(pack.validFrom||pack.validUntil?'<p class="muted">Validité : '+escapeHtml(pack.validFrom||"immédiate")+' → '+escapeHtml(pack.validUntil||"sans date de fin")+'</p>':'')+(pack.notes?'<details class="agency-pack-notes"><summary>Notes privées</summary><p>'+escapeHtml(pack.notes)+'</p></details>':'')+'<footer>'+ (pack.status!=="archived"?agencyPackButton("edit","Modifier",pack.id)+agencyPackButton("assign","Attribuer",pack.id):"")+agencyPackButton("duplicate","Dupliquer",pack.id)+(pack.status!=="archived"?agencyPackButton("archive","Archiver",pack.id):"")+'</footer></article>';
}
function renderAgencyPackAssignments(data){
 const rows=data.agencyPackAssignments||[];
 if(!rows.length)return '<div class="agency-pack-empty"><strong>Aucune attribution pour le moment</strong><p>Créez un pack, puis choisissez une agence et les comptes créateurs qu’elle souhaite prendre en charge.</p></div>';
 return '<div class="agency-pack-assignments">'+rows.map(a=>{
   const agency=(data.allAgencies||[]).find(item=>item.id===a.agencyId),pack=(data.agencyPacks||[]).find(item=>item.id===a.packId),q=a.quote;
   return '<article><div class="agency-pack-assignment-title"><strong>'+escapeHtml(agency?.name||"Agence indisponible")+'</strong><span>'+escapeHtml(pack?.title||"Pack indisponible")+'</span></div><div><strong>'+(q?.eligibleCreators||0)+' créateurs</strong><small>'+(q?.missingCreators? q.missingCreators+' compte(s) encore nécessaire(s)':"Sélection enregistrée")+'</small></div><div><strong>'+agencyPackMoney(q?.effectiveMonthlyCents||0)+'</strong><small>/ mois estimé</small></div><div><span class="badge '+(q?.ready?'success':'warning')+'">'+(a.billing?.status==='active'?'Contrat actif':q?.ready?"Prêt à proposer":"À compléter")+'</span><small>'+escapeHtml(a.billing?.status==='active'?a.billing.paidCreators+' créateurs payés · jusqu’au '+new Date(a.billing.paidThrough).toLocaleDateString('fr-FR')+(a.billing.cancelAtPeriodEnd?' · renouvellement arrêté':''):q?.reasons?.join(" · ")||"Paiement à confirmer par le fondateur")+'</small></div><div class="agency-tools">'+(pack?.status!=="archived"?agencyPackButton("assignment","Modifier",a.agencyId):"")+agencyPackButton("unassign","Retirer",a.agencyId)+'</div></article>';
 }).join("")+'</div>';
}
function renderAdminAgencyPacks(){
 if(!isVerifiedAdminSession())return "";
 const view=ensureAgencyData(true),data=view.admin,available=data?.packsAvailable===true;
 return '<div class="agency-pack-page"><section class="agency-pack-hero"><div><span class="eyebrow">OFFRES GROUPÉES · ADMINISTRATION</span><h2>Packs personnalisés pour les agences</h2><p>Préparez les conditions négociées et sélectionnez les créateurs pris en charge par chaque fondateur.</p></div><div class="agency-tools">'+agencyPackButton("new","+ Créer un pack","",!available||view.busy?"disabled":"")+'<button class="button" data-action="agency-admin-refresh" '+(view.busy?"disabled":"")+'>Actualiser</button></div></section>'+agencyNotice(view)+'<div class="agency-pack-information"><strong>Préparation commerciale</strong><p>Les packs enregistrés ne déclenchent aucun prélèvement et n’activent aucun accès. Le fondateur confirme le paiement et les changements du contrat dans Mon espace agence. Les abonnements personnels restent gérés séparément.</p></div>'+
 (data&&!available?'<div class="agency-notice" role="alert">Le service doit être mis à jour pour enregistrer les packs agences.</div>':available?'<section><header class="agency-heading"><div><h3>Vos modèles de packs</h3><p>Tarifs Pro et Premium, seuil de créateurs et règles de renouvellement.</p></div><span>'+data.agencyPacks.length+' modèle(s)</span></header><div class="agency-pack-grid">'+(data.agencyPacks.length?data.agencyPacks.map(p=>renderAgencyPackCard(p,data)).join(""):'<div class="agency-pack-empty"><strong>Votre première offre sur mesure</strong><p>Par exemple : 20 créateurs minimum, à 8,50 € par mois pour chacun.</p>'+agencyPackButton("new","+ Créer un pack","",view.busy?"disabled":"")+'</div>')+'</div></section><section><header class="agency-heading"><div><h3>Offres attribuées aux agences</h3><p>Les créateurs sélectionnés doivent posséder un compte ShenPulse et être membres validés de leur agence. Un compte est compté une seule fois.</p></div></header>'+renderAgencyPackAssignments(data)+'</section>':"")+'</div>';
}
async function handleAgencyPackAction({action,id,target}){
 if(!action.startsWith("agency-pack-"))return ACTION_NOT_HANDLED;
 if(!isVerifiedAdminSession())throw Error("Accès administrateur requis.");
 const view=agencyState(),data=agencyPackData();
 if(view.busy)return;
 if(!data.packsAvailable)throw Error("Actualisez le service Agences avant de préparer un pack.");
 const pack=(data.agencyPacks||[]).find(p=>p.id===id);
 if(action==="agency-pack-new")return openAgencyPackEditor();
 if(action==="agency-pack-edit"&&pack?.status!=="archived")return openAgencyPackEditor(pack);
 if(action==="agency-pack-duplicate"&&pack)return openAgencyPackEditor({...pack,id:"",revision:0,status:"draft",title:(pack.title+" (copie)").slice(0,80)});
 if(action==="agency-pack-assign"&&pack)return openAgencyPackAssignment(pack);
 if(action==="agency-pack-preview")return previewAgencyPackAssignment(target);
 const assignment=(data.agencyPackAssignments||[]).find(a=>a.agencyId===id);
 if(action==="agency-pack-assignment"&&assignment)return openAgencyPackAssignment(data.agencyPacks.find(p=>p.id===assignment.packId),assignment);
 const owner=captureCreatorPrivateOperation();
 if(action==="agency-pack-archive"&&pack){
   if(!await confirmAction("Archiver ce modèle ? Les attributions seront conservées pour consultation et ne pourront plus être proposées.",{title:"Archiver le pack",confirmLabel:"Archiver"}))return;
   assertCreatorPrivateOperation(owner);
   return agencyCommand("archivePack",{id:pack.id,expectedRevision:pack.revision},true);
 }
 if(action==="agency-pack-unassign"&&assignment){
   if(!await confirmAction("Retirer cette préparation commerciale de l’agence ? Ses membres et leurs abonnements personnels seront conservés.",{title:"Retirer l’attribution",confirmLabel:"Retirer"}))return;
   assertCreatorPrivateOperation(owner);
   return agencyCommand("unassignPack",{agencyId:id,expectedRevision:assignment.revision},true);
 }
 if(!["agency-pack-archive","agency-pack-unassign"].includes(action))throw Error("Le pack n’est plus disponible. Actualisez la liste.");
}
registerActionHandler(new Set(["agency-pack-new","agency-pack-edit","agency-pack-duplicate","agency-pack-assign","agency-pack-assignment","agency-pack-archive","agency-pack-unassign","agency-pack-preview"]),handleAgencyPackAction);
