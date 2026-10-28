"use strict";
/** Le @ visible en haut reste la source de l’identité d’adhésion du compte actif. */
function agencyTikTokUsername() {
  const field=document.getElementById("tiktok-username");
  const value=field?field.value:typeof snapshot!=="undefined"?snapshot?.state?.settings?.tiktok?.username:"";
  return String(value || "").trim().replace(/^@+/,"").replace(/\s+/g,"").replace(/[^a-zA-Z0-9._]/g,"").slice(0,30).toLowerCase();
}
function agencyHasMembership(view) {
  return !!view.uid && ["pending","approved"].includes(view.dashboard?.membership?.status);
}
function scheduleAgencyIdentitySync() {
  const view=agencyState(),username=agencyTikTokUsername();
  if(view.identityPending || view.identityTimer && view.identityScheduledUsername===username)return;
  clearTimeout(view.identityTimer);
  view.identityTimer=null;view.identityScheduledUsername="";
  if(!agencyHasMembership(view) || !username || username===view.identityUsername)return;
  view.identityScheduledUsername=username;
  view.identityTimer=setTimeout(()=>{
    view.identityTimer=null;
    if(agencyState()===view)void synchronizeAgencyIdentity(view);
  },Math.max(750,(view.identityRetryAt || 0)-Date.now()));
}
async function synchronizeAgencyIdentity(view=agencyState()) {
  if(agencyState()!==view || !agencyHasMembership(view))return;
  if(view.identityPending)return view.identityPending;
  const username=agencyTikTokUsername();
  if(!username || username===view.identityUsername)return;
  view.commandRevision=(view.commandRevision || 0)+1;
  view.identityPending=(async()=>{
    try {
      await api.agencies.command("updateIdentity",{tiktokUsername:username});
      if(agencyState()!==view)return;
      view.identityUsername=username;view.identityRetryAt=0;view.identityError="";
      Object.assign(view.dashboard.membership,{tiktokUsername:username,displayName:"@"+username});
    } catch(error) {
      if(agencyState()===view){
        view.identityRetryAt=Date.now()+15000;
        view.identityError="La mise à jour de votre @ sera retentée automatiquement.";
      }
    } finally {
      if(agencyState()===view){
        view.identityPending=null;
        scheduleAgencyIdentitySync();
      }
    }
  })();
  return view.identityPending;
}
async function pollAgencyUpdates() {
  if(!isAccountAuthenticated())return;
  scheduleAgencyIdentitySync();
  const view=agencyState();
  const editable=()=>document.querySelector("dialog[open]") || document.activeElement?.matches("input,textarea,select");
  if(currentPage!=="agencies" || (!view.dashboard?.ownAgency && !agencyHasMembership(view)) || view.editor || view.busy || view.identityPending || view.pollPending || document.visibilityState==="hidden" || editable())return;
  if(typeof rendererVisualsActive==="function" && !rendererVisualsActive())return;
  const revision=view.commandRevision || 0;
  view.pollPending=true;
  try {
    const dashboard=await api.agencies.dashboard();
    if(agencyState()!==view || view.busy || view.editor || view.identityPending || editable() || currentPage!=="agencies" || document.visibilityState==="hidden" || revision!==(view.commandRevision || 0))return;
    if(typeof rendererVisualsActive==="function" && !rendererVisualsActive())return;
    if(JSON.stringify(dashboard)!==JSON.stringify(view.dashboard)){view.dashboard=dashboard;render();}
  } catch { /* Une lecture silencieuse sera retentée au prochain passage. */ }
  finally {if(agencyState()===view)view.pollPending=false;}
}
setInterval(pollAgencyUpdates,15000);
