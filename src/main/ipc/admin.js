"use strict";

/** Administration et gestion des essais.
 * Les canaux sont toujours enregistrés par le garde d’accès central injecté.
 */
const { applyTrialDashboard, applyTrialGrant, applyTrialRevocation } = require("../trial-access");
const { safeString } = require("../utils");
const { sanitizeEntity } = require("./sanitizers");
const { notify } = require("./notifications");

function registerAdminIpc({ handle, core, store, adminService, getWindow, dialog }) {
  handle("admin:status", () => adminService.status());
  let storageDownloadBusy=false;
  async function storageOwner(){const status=await adminService.status();if(!status.authorized||!status.uid)throw Error("Accès administrateur requis.");return status.uid;}
  handle("admin:storage-list", async (_event,incoming) => {
    const uid=await storageOwner();const result=await adminService.getStorageFiles(sanitizeEntity(incoming||{}));
    if(await storageOwner()!==uid)throw Error("Le compte a changé. Rouvrez le stockage.");return result;
  });
  handle("admin:storage-preview", async (_event,key) => {
    const uid=await storageOwner();const result=await adminService.getStorageFile(safeString(key,1100),true);
    if(await storageOwner()!==uid)throw Error("Le compte a changé. Rouvrez le stockage.");return result;
  });
  handle("admin:storage-download", async (_event,incoming) => {
    const uid=await storageOwner();if(storageDownloadBusy)throw Error("Un téléchargement est déjà en cours.");storageDownloadBusy=true;
    const key=safeString(incoming?.key,1100),requestId=safeString(incoming?.requestId,80);
    try{return await require("../admin/storage").downloadStorageFile({
      getTicket:()=>adminService.getStorageFile(key),
      choosePath:name=>dialog.showSaveDialog(getWindow(),{title:"Télécharger depuis Backblaze",defaultPath:name,buttonLabel:"Télécharger"}),
      assertOwner:async()=>{if(await storageOwner()!==uid)throw Error("Le compte a changé. Téléchargement annulé.");},
      onProgress:progress=>{if(!getWindow()?.isDestroyed())getWindow()?.webContents.send("admin:storage-progress",{requestId,...progress});}
    });}finally{storageDownloadBusy=false;}
  });
  
  handle("admin:login", (_event, incoming) =>
    adminService.login({
      email: safeString(incoming?.email, 254),
      password: safeString(incoming?.password, 500)
    })
  );
  
  handle("admin:logout", () => adminService.logout());
  
  handle("admin:visibility-public", () => adminService.getPublicVisibility());
  
  handle("admin:dashboard", async () => {
    const dashboard = await adminService.getDashboard();
    if (applyTrialDashboard(store, dashboard)) {
      notify(core, "state-changed", core.snapshot());
    }
    return dashboard;
  });
  
  handle("admin:site-save", async (_event, incoming) => {
    const settings = await adminService.saveSiteSettings(
      sanitizeEntity(incoming || {})
    );
    // La projection des jeux et les droits du profil suivent immédiatement
    // les portées enregistrées, sans attendre un redémarrage de l'application.
    notify(core, "state-changed", core.snapshot());
    return settings;
  });
  
  handle("admin:commerce-save", (_event, incoming) =>
    adminService.saveCommerce(sanitizeEntity(incoming || {}))
  );
  
  handle("admin:trial-grant", async (_event, incoming) => {
    const result = await adminService.grantTrial(
      sanitizeEntity(incoming || {})
    );
    if (applyTrialGrant(store, result)) {
      notify(core, "state-changed", core.snapshot());
    }
    core.overlayServer?.refreshAccess();
    return result;
  });
  
  handle("admin:trial-update", async (_event, incoming) => {
    const request = sanitizeEntity(incoming || {});
    const result = await adminService.updateTrial(request);
    if (request.onlyAgencyCounting === true) return result;
    const removed = applyTrialRevocation(store, {
      trialId: request.trialId
    });
    const applied = applyTrialGrant(store, result);
    if (removed || applied) {
      notify(core, "state-changed", core.snapshot());
    }
    core.overlayServer?.refreshAccess();
    return result;
  });
  
  handle("admin:trial-revoke", async (_event, incoming) => {
    const request = sanitizeEntity(incoming || {});
    const result = await adminService.revokeTrial(request);
    if (
      applyTrialRevocation(store, {
        ...result,
        trialId: request.trialId
      })
    ) {
      notify(core, "state-changed", core.snapshot());
    }
    core.overlayServer?.refreshAccess();
    return result;
  });
}

module.exports = { registerAdminIpc };
