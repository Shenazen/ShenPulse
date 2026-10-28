"use strict";
const { captureSessionGuard } = require("./account/session-guard");
const { readState } = require("./state-projection");
const { readPayload } = require("./account/http-client");
const ROUTES = Object.freeze({save:"/api/agencies/save",join:"/api/agencies/join",leave:"/api/agencies/leave",reviewMember:"/api/agencies/members/review",reviewAgency:"/api/admin/agencies/review",adminReviewMember:"/api/admin/agencies/members/review"});
async function agencyRequest(accountService,command,body={},admin=false){
  const publicList=command==="list";
  const path=publicList?"/api/agencies":command==="dashboard"?(admin?"/api/admin/agencies":"/api/agencies/dashboard"):ROUTES[command];
  if(!path)throw new Error("Commande agence inconnue.");
  if(!admin && ["reviewAgency","adminReviewMember"].includes(command))throw new Error("Accès administrateur requis.");
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
