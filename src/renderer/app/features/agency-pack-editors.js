"use strict";
function agencyPackCents(value){
 const v=String(value||"").trim().replace(",",".");
 if(!/^\d{1,5}(?:\.\d{1,2})?$/.test(v))throw Error("Renseignez un montant en euros avec deux décimales maximum.");
 const [euros,decimals=""]=v.split("."),cents=Number(euros)*100+Number(decimals.padEnd(2,"0"));
 if(cents<1||cents>1000000)throw Error("Le tarif doit être compris entre 0,01 € et 10 000 €.");
 return cents;
}
function agencyPackTemplatePayload(data,pack){
 return {id:pack.id||"",expectedRevision:pack.revision||0,title:data.get("title"),notes:data.get("notes"),status:data.get("status"),minimumCreators:Number(data.get("minimumCreators")),maximumCreators:data.get("maximumCreators")?Number(data.get("maximumCreators")):null,
 prices:{pro:data.has("offerPro")?agencyPackCents(data.get("proPrice")):null,premium:data.has("offerPremium")?agencyPackCents(data.get("premiumPrice")):null},
 belowMinimum:data.get("belowMinimum"),additions:data.get("additions"),removals:data.get("removals"),validFrom:data.get("validFrom"),validUntil:data.get("validUntil")};
}
function openAgencyPackEditor(pack={}){
 const owner=captureCreatorPrivateOperation();
 const p={title:"",minimumCreators:20,maximumCreators:null,prices:{pro:850,premium:null},status:"draft",belowMinimum:"block",additions:"prorata",removals:"renewal",...pack};
 const input=(name,label,value,type="text",extra="")=>'<label class="field"><span>'+label+'</span><input name="'+name+'" type="'+type+'" value="'+escapeHtml(value??"")+'" '+extra+'></label>';
 const select=(name,label,value,options)=>'<label class="field"><span>'+label+'</span><select name="'+name+'">'+options.map(([key,title])=>'<option value="'+key+'" '+(value===key?"selected":"")+'>'+title+'</option>').join("")+'</select></label>';
 const price=(tier,label)=>'<div class="agency-pack-price-field"><label><input type="checkbox" name="offer'+label+'" '+(p.prices[tier]!=null?"checked":"")+'> Proposer '+label+'</label>'+input(tier+"Price","€ / créateur / mois",p.prices[tier]!=null?(p.prices[tier]/100).toFixed(2):"","text",'inputmode="decimal" placeholder="8,50"')+'</div>';
 openEditor({variant:"agency-pack",title:p.id?"Modifier le pack agence":"Créer un pack agence",kicker:"OFFRE COMMERCIALE PRIVÉE",body:'<div class="agency-pack-editor"><p class="agency-pack-information">Ce modèle prépare une offre négociée. Son enregistrement ne facture personne.</p><div class="agency-pack-form-grid">'+input("title","Nom du pack",p.title,"text",'required minlength="2" maxlength="80" placeholder="20+ créas"')+select("status","Disponibilité",p.status,[["draft","Brouillon"],["enabled","Disponible pour attribution"]])+input("minimumCreators","Créateurs minimum",p.minimumCreators,"number",'min="1" max="1000" required')+input("maximumCreators","Créateurs maximum (facultatif)",p.maximumCreators,"number",'min="1" max="1000"')+price("pro","Pro")+price("premium","Premium")+select("belowMinimum","Si le nombre passe sous le minimum",p.belowMinimum,[["block","Bloquer l’offre groupée"],["standard","Revenir au tarif agence habituel"]])+select("additions","Ajout de créateurs",p.additions,[["prorata","Prorata du temps restant"],["renewal","Au prochain renouvellement"]])+select("removals","Retrait de créateurs",p.removals,[["renewal","Au prochain renouvellement"],["credit","Avoir au prorata du temps restant"]])+input("validFrom","Offre valable à partir du",p.validFrom,"date")+input("validUntil","Offre valable jusqu’au (facultatif)",p.validUntil,"date")+'<label class="field full"><span>Notes de négociation (administration uniquement)</span><textarea name="notes" rows="3" maxlength="1500">'+escapeHtml(p.notes||"")+'</textarea></label></div><p class="muted">Facturation mensuelle en euros. Les créateurs pris en charge seront comptabilisés pour leur agence après confirmation du paiement groupé.</p></div>',
 onSubmit:async data=>{assertCreatorPrivateOperation(owner);return agencyCommand("savePack",agencyPackTemplatePayload(data,p),true);}});
}
function renderAgencyPackMemberPicker(pack,members,seats=[]){
 const chosen=new Map(seats.map(s=>[s.uid,s.tier])),tiers=["pro","premium"].filter(t=>pack.prices[t]!=null);
 return '<p class="muted">'+members.length+' membre(s) validé(s) disponible(s) · minimum '+pack.minimumCreators+'. <strong data-pack-selection-count>'+members.filter(m=>chosen.has(m.uid)).length+' sélectionné(s)</strong></p>'+
 (members.length?'<label class="agency-pack-select-all"><input type="checkbox" data-pack-select-all> Sélectionner tous les créateurs affichés</label><div class="agency-pack-seat-list">'+members.map(m=>'<div class="agency-pack-seat"><label><input type="checkbox" name="seat" value="'+escapeHtml(m.uid)+'" '+(chosen.has(m.uid)?"checked":"")+'><span><strong>'+escapeHtml(m.displayName||m.email||m.uid)+'</strong><small>'+escapeHtml(m.email||"")+(m.countingSource==='agencyPack'?' · pris en charge par l’agence':m.paidSubscription?' · abonnement personnel actif':'')+'</small></span></label><select aria-label="Formule de '+escapeHtml(m.displayName||m.email||m.uid)+'" name="seatTier:'+escapeHtml(m.uid)+'">'+tiers.map(t=>'<option value="'+t+'" '+(chosen.get(m.uid)===t?"selected":"")+'>'+t.toUpperCase()+' · '+agencyMoney(pack.prices[t]/100)+'</option>').join("")+'</select></div>').join("")+'</div>':'<p class="agency-pack-empty">Aucun membre validé. Acceptez d’abord les créateurs dans Demandes et membres.</p>');
}
function renderAgencyPackSeatPicker(pack,agencyId){
 const data=agencyPackData(),assignment=(data.agencyPackAssignments||[]).find(a=>a.agencyId===agencyId);
 const members=(data.members||[]).filter(m=>m.agencyId===agencyId&&m.status==="approved").sort((a,b)=>String(a.displayName||a.email).localeCompare(String(b.displayName||b.email)));
 const replacement=assignment&&assignment.packId!==pack.id?'<p class="agency-pack-information">Cette agence possède déjà une attribution. Enregistrer remplacera sa préparation commerciale, sans toucher aux membres ni aux abonnements.</p>':"";
 return replacement+renderAgencyPackMemberPicker(pack,members,assignment?.seats||[]);
}
function openAgencyPackAssignment(pack,existing=null){
 if(!pack||pack.status==="archived")throw Error("Ce pack n’est plus disponible.");
 const owner=captureCreatorPrivateOperation(),data=agencyPackData(),agencies=(data.allAgencies||[]).filter(a=>a.status==="approved");
 const agencyId=existing?.agencyId||(agencies.length===1?agencies[0].id:"");
 const today=new Date(),start=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),1)),end=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()+1,1));
 openEditor({variant:"agency-pack",title:existing?"Modifier l’attribution":"Attribuer "+pack.title,kicker:"CRÉATEURS PRIS EN CHARGE",body:'<div class="agency-pack-assignment-editor" data-pack-id="'+escapeHtml(pack.id)+'"><p class="agency-pack-information">Choisissez les comptes que le fondateur souhaite prendre en charge. Enregistrer prépare la sélection. Le fondateur confirme lui-même les paiements et les changements de son contrat.</p><label class="field"><span>Agence partenaire validée</span><select name="agencyId" data-pack-agency '+(existing?"disabled":"")+'><option value="">Choisir une agence</option>'+agencies.map(a=>'<option value="'+escapeHtml(a.id)+'" '+(a.id===agencyId?"selected":"")+'>'+escapeHtml(a.name)+'</option>').join("")+'</select></label>'+(existing?'<input name="agencyId" type="hidden" value="'+escapeHtml(agencyId)+'">':"")+'<div data-pack-seats>'+(agencyId?renderAgencyPackSeatPicker(pack,agencyId):'<p class="muted">Sélectionnez une agence pour retrouver ses créateurs.</p>')+'</div><details class="agency-pack-period"><summary>Période pour la simulation du prorata</summary><div class="agency-pack-form-grid"><label class="field"><span>Début de période</span><input type="date" name="periodStart" value="'+start.toISOString().slice(0,10)+'"></label><label class="field"><span>Prochain renouvellement</span><input type="date" name="periodEnd" value="'+end.toISOString().slice(0,10)+'"></label></div><p class="muted">Estimation à la date du test. Aucun paiement ni remboursement n’est effectué.</p></details><div class="agency-tools"><button class="button" type="button" data-action="agency-pack-preview">Simuler le montant et le prorata</button></div><div data-pack-summary role="status" aria-live="polite"></div></div>',
 onSubmit:async form=>{assertCreatorPrivateOperation(owner);const a=(data.agencyPackAssignments||[]).find(row=>row.agencyId===form.get("agencyId"));return agencyCommand("assignPack",{packId:pack.id,expectedPackRevision:pack.revision,agencyId:form.get("agencyId"),expectedRevision:existing?.revision||a?.revision||0,seats:agencyPackSeatsFromForm(form)},true);}});
}
function agencyPackSeatsFromForm(form){return form.getAll("seat").map(uid=>({uid,tier:form.get("seatTier:"+uid)}));}
async function previewAgencyPackAssignment(button){
 const root=button.closest(".agency-pack-assignment-editor"),form=root?.closest("form");
 if(!form||button.disabled)return;
 const owner=captureCreatorPrivateOperation(),view=agencyState(),data=new FormData(form),version=root.dataset.revision||"";
 button.disabled=true;
 try{
   const body={packId:root.dataset.packId,agencyId:data.get("agencyId"),seats:agencyPackSeatsFromForm(data),period:{start:data.get("periodStart")+"T00:00:00Z",end:data.get("periodEnd")+"T00:00:00Z"}};
   const result=await api.admin.agenciesCommand("previewPack",body);
   assertCreatorPrivateOperation(owner);
   if(agencyState()!==view||!root.isConnected||(root.closest("dialog")&&!root.closest("dialog").open)||root.dataset.revision!==version && !(root.dataset.revision==null&&version===""))return;
   const q=result.quote,p=result.proration;
   root.querySelector("[data-pack-summary]").innerHTML='<div class="agency-pack-quote"><span class="badge '+(q.ready?"success":"warning")+'">'+(q.ready?"Offre prête à proposer":"Offre à compléter")+'</span><h3>'+agencyPackMoney(q.effectiveMonthlyCents)+' <small>/ mois</small></h3><p>'+q.proCreators+' Pro · '+q.premiumCreators+' Premium · '+q.eligibleCreators+' créateurs retenus.</p><p>'+(q.usesStandardRate?"Tarif agence habituel appliqué sous le minimum.":"Tarif négocié : "+agencyPackMoney(q.negotiatedMonthlyCents)+" / mois.")+'</p><p>'+escapeHtml(q.reasons.join(" · "))+'</p>'+(p?'<p>Écart simulé sur la période restante : <strong>'+(p.adjustmentCents<0?"avoir de ":"")+agencyPackMoney(Math.abs(p.adjustmentCents))+'</strong>. Prochain mois : '+agencyPackMoney(p.nextMonthlyCents)+'.</p>':'')+'<small>Simulation uniquement · aucun accès ni paiement activé.</small></div>';
 }finally{if(button.isConnected)button.disabled=false;}
}
function updateAgencyPackAssignmentInput(event){
 const root=event.target.closest(".agency-pack-assignment-editor");if(!root)return;
 root.dataset.revision=String(Number(root.dataset.revision||0)+1);root.querySelector("[data-pack-summary]").innerHTML="";
 if(event.target.matches("[data-pack-agency]")){
   const pack=(agencyPackData().agencyPacks||[]).find(p=>p.id===root.dataset.packId);
   root.querySelector("[data-pack-seats]").innerHTML=renderAgencyPackSeatPicker(pack,event.target.value);
 }
 if(event.target.matches("[data-pack-select-all]"))root.querySelectorAll('input[name="seat"]').forEach(input=>{input.checked=event.target.checked;});
 const counter=root.querySelector("[data-pack-selection-count]");if(counter)counter.textContent=root.querySelectorAll('input[name="seat"]:checked').length+" sélectionné(s)";
}
document.addEventListener("change",updateAgencyPackAssignmentInput);
document.addEventListener("input",event=>{if(event.target.matches('[name="periodStart"],[name="periodEnd"]'))updateAgencyPackAssignmentInput(event);});
