"use strict";
/** Brouillon local au compte, conservé lors des actualisations ou d'une erreur réseau. */
function editAgency() {
  const view=agencyState();
  if(!view.editor)view.editor={...(view.dashboard?.ownAgency || {}),language:view.dashboard?.ownAgency?.language || "fr"};
  view.formError="";
  render();
  queueMicrotask(()=>document.getElementById("agency-profile-form")?.scrollIntoView?.({behavior:"smooth",block:"nearest"}));
}
function renderAgencyEditorSection(view) {
  if(!view.editor) {
    if(view.dashboard?.ownAgency)return "";
    return '<section class="agency-director-cta"><div><h3>'+agencyIcon("building")+' Vous dirigez une agence ?</h3><p>Créez sa fiche : après validation par ShenPulse, vous recevez un code à transmettre à vos créateurs. Votre fiche apparaît dans l’annuaire dès 3 créateurs abonnés.</p></div><button type="button" class="button primary" data-action="agency-edit" '+(view.busy?"disabled":"")+'>+ Créer la fiche de mon agence</button></section>';
  }
  const a=view.editor,locked=view.busy || view.uploading;
  const input=(key,label,type="text",max=1500)=>'<label class="field"><span>'+label+'</span><input name="'+key+'" type="'+type+'" maxlength="'+max+'" value="'+escapeHtml(a[key] || "")+'" '+(key==="name"?'minlength="2" required':type==="url"?'placeholder="https://"':"")+'></label>';
  const media=(key,label,description)=>'<div class="agency-media-field"><div class="agency-media-preview '+(key==="bannerUrl"?"agency-banner-preview":"")+'">'+(a[key]?'<img src="'+escapeHtml(a[key])+'" alt="'+label+'" referrerpolicy="no-referrer">':agencyIcon(key==="bannerUrl"?"diamond":"building"))+'</div><div><strong>'+label+'</strong><small>'+description+'</small><button type="button" class="button small" data-action="agency-upload" data-field="'+key+'" '+(locked?"disabled":"")+'>'+(view.uploading===key?"Import en cours…":a[key]?"Changer l’image":"Choisir une image")+'</button>'+(a[key]?'<button type="button" class="button small" data-action="agency-clear-image" data-field="'+key+'" '+(locked?"disabled":"")+'>Retirer</button>':"")+'</div><input type="hidden" name="'+key+'" value="'+escapeHtml(a[key] || "")+'"></div>';
  return '<section class="agency-panel agency-editor"><h3>'+agencyIcon("building")+' '+(a.id?"Modifier mon agence":"Nouvelle agence")+'</h3><form id="agency-profile-form"><fieldset '+(locked?"disabled":"")+'><div class="agency-form-grid">'+input("name","Nom de l’agence","text",80)+
    '<label class="field"><span>Langue principale</span><select name="language">'+[["fr","Français"],["en","English"],["es","Español"],["de","Deutsch"],["it","Italiano"],["pt","Português"]].map(([code,name])=>'<option value="'+code+'" '+(a.language===code?"selected":"")+'>'+name+'</option>').join("")+'</select></label>'+
    '<label class="field full"><span>Présentation (600 caractères maximum)</span><textarea name="description" rows="3" maxlength="600" minlength="10" required>'+escapeHtml(a.description || "")+'</textarea></label>'+
    input("discord","Discord","url")+input("tiktok","TikTok","url")+input("website","Site internet","url")+input("instagram","Instagram","url")+
    media("logoUrl","Logo","Carré · PNG, JPG ou WebP")+media("bannerUrl","Bannière","Format large conseillé : 2:1")+
    '</div></fieldset><p class="muted">ShenPulse vérifie votre fiche avant son activation. Seuls vos liens et votre présentation sont publics ; vos coordonnées de contact et le code restent privés.</p>'+
    (view.formError?'<p class="agency-notice" role="alert">'+escapeHtml(view.formError)+'</p>':"")+
    '<div class="agency-tools"><button class="button primary" type="submit" '+(locked?"disabled":"")+'>'+(view.busy?"Enregistrement…":"Envoyer ma fiche à ShenPulse")+'</button><button type="button" class="button" data-action="agency-cancel-edit" '+(locked?"disabled":"")+'>Annuler</button></div></form></section>';
}
function rememberAgencyDraft(event) {
  const field=event.target;
  if(field.closest?.("#agency-profile-form") && agencyState().editor && field.name)agencyState().editor[field.name]=field.value;
  if(field.closest?.("#agency-join-form") && field.name==="code")agencyState().joinCode=field.value;
}
async function submitAgencyForm(form) {
  if(!isAccountAuthenticated())return openAccountLogin();
  if(!form.reportValidity())return;
  const view=agencyState();
  if(view.busy || view.uploading)return;
  if(form.id==="agency-join-form")return joinAgency("",new FormData(form).get("code"));
  if(form.id!=="agency-profile-form" || !view.editor)return;
  view.editor={...view.editor,...Object.fromEntries(new FormData(form))};
  view.formError="";
  try {await agencyCommand("save",view.editor);if(agencyState()===view){view.editor=null;render();}}
  catch(error){if(agencyState()===view){view.formError=agencyErrorMessage(error);render();}}
}
function joinAgency(id="",code="") {
  return openEditor({title:"Rejoindre une agence",kicker:"DEMANDE D’ADHÉSION",submitLabel:"Envoyer ma demande",body:'<div class="form-grid">'+(!id?'<label class="field full"><span>Code agence</span><input name="code" required maxlength="30" autocomplete="off" value="'+escapeHtml(code || "")+'"></label>':"")+'<label class="field full"><span>Votre pseudo TikTok</span><input name="displayName" required maxlength="80"></label></div><p>Le directeur vérifiera votre appartenance à l’agence. Votre adresse e-mail lui sera communiquée pour gérer la demande. Aucun abonnement n’est souscrit par cette demande.</p>',onSubmit:async data=>agencyCommand("join",{...Object.fromEntries(data),agencyId:id})});
}
async function uploadAgencyImage(field) {
  if(!["logoUrl","bannerUrl"].includes(field))return;
  const view=agencyState(),draft=view.editor,owner=captureCreatorPrivateOperation();
  if(!draft || view.busy || view.uploading)return;
  view.uploading=field;view.formError="";render();
  try {
    const result=await api.uploadCustomMedia("agency-image");
    assertCreatorPrivateOperation(owner);
    if(agencyState()!==view || view.editor!==draft || result?.canceled)return;
    const item=result?.media;
    if(!item?.url || item.type==="video" || item.kind==="video")throw Error("Choisissez une image PNG, JPG ou WebP.");
    if(new URL(item.url).protocol!=="https:")throw Error("L’image importée doit être hébergée en HTTPS.");
    draft[field]=item.url;
    if(result.snapshot)acceptSnapshot(result.snapshot);
  }catch(error){if(agencyState()===view)view.formError=agencyErrorMessage(error);}
  finally{if(agencyState()===view){view.uploading="";render();}}
}
