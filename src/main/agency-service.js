"use strict";
const { captureSessionGuard } = require("./account/session-guard");
const { readState } = require("./state-projection");
const { readPayload } = require("./account/http-client");
const ROUTES = Object.freeze({cancelPackPending:"/api/agencies/pack/billing/pending/cancel",previewPackBilling:"/api/agencies/pack/billing/preview",createPackCheckout:"/api/agencies/pack/billing/checkout",syncPackBilling:"/api/agencies/pack/billing/sync",abandonPackCheckout:"/api/agencies/pack/billing/abandon",applyPackChange:"/api/agencies/pack/billing/change",cancelPackBilling:"/api/agencies/pack/billing/cancel",resumePackBilling:"/api/agencies/pack/billing/resume",packBillingPortal:"/api/agencies/pack/billing/portal",previewOwnPack:"/api/agencies/pack/preview",selectOwnPack:"/api/agencies/pack/selection",save:"/api/agencies/save",join:"/api/agencies/join",leave:"/api/agencies/leave",reviewMember:"/api/agencies/members/review",updateIdentity:"/api/agencies/identity",rotateCode:"/api/agencies/invitation/rotate",reviewAgency:"/api/admin/agencies/review",savePack:"/api/admin/agencies/packs/save",archivePack:"/api/admin/agencies/packs/archive",assignPack:"/api/admin/agencies/packs/assign",unassignPack:"/api/admin/agencies/packs/unassign",previewPack:"/api/admin/agencies/packs/preview"});
async function agencyRequest(accountService,command,body={},admin=false){
  if(command==="checkoutOwnPack"&&!admin)return require("./account/agency-pack-checkout").runAgencyPackCheckout(accountService,body,(c,b)=>agencyRequest(accountService,c,b));
  const publicList=command==="list";
  const path=publicList?"/api/agencies":command==="dashboard"?(admin?"/api/admin/agencies":"/api/agencies/dashboard"):ROUTES[command];
  if(!path)throw new Error("Commande agence inconnue.");
  if(!admin && ["reviewAgency","savePack","archivePack","assignPack","unassignPack","previewPack"].includes(command))throw new Error("Accès administrateur requis.");
  if(admin && !["dashboard","reviewAgency","savePack","archivePack","assignPack","unassignPack","previewPack"].includes(command))throw new Error("La gestion des membres revient au fondateur dans Agences → Mon espace agence.");
  if(["join","updateIdentity"].includes(command)){
    const state=readState(accountService.store,["settings.tiktok"]);
    const username=String(body.tiktokUsername ?? state.settings?.tiktok?.username ?? "").trim().replace(/^@+/,"").toLowerCase();
    if(!/^[a-z0-9._]{1,30}$/.test(username))throw new Error("Renseignez votre @ TikTok dans la barre en haut de ShenPulse.");
    body=command==="join"?{code:String(body.code || ""),agencyId:String(body.agencyId || ""),tiktokUsername:username,displayName:"@"+username}:{tiktokUsername:username};
  }
  if(command==="rotateCode")body={expectedCode:String(body.expectedCode || "")};
  const guard=captureSessionGuard(accountService,()=>readState(accountService.store, ["settings.account"]).settings.account || {});
  const identity=publicList?null:await accountService.identityForInternalUse();
  if(!publicList)guard.assertCurrent();
  const method=["list","dashboard"].includes(command)?"GET":"POST";
  const response=await accountService.fetch(accountService.webOrigin+path,{
    method,headers:{"Content-Type":"application/json",...(identity?{Authorization:"Bearer "+identity.idToken}:{})},
    ...(method==="POST"?{body:JSON.stringify(body)}:{}),cache:"no-store",signal:AbortSignal.timeout(20000)
  });
  const result=await readPayload(response);
  if(!publicList)guard.assertCurrent();
  if(!response.ok)throw new Error(response.status===404?"Le service Agences n’est pas encore disponible sur le serveur. Réessayez après sa mise à jour.":String(result.error || "Impossible de charger les agences."));
  const valid = result?.ok === true && (command !== "list" || Array.isArray(result.agencies)) && (command !== "dashboard" || typeof result.uid === "string" && Array.isArray(result.members));
  if (!valid) throw new Error("Le service Agences n’est pas encore disponible sur le serveur. Réessayez après sa mise à jour.");
  return result;
}
module.exports={agencyRequest};
