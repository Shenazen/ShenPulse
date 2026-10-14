"use strict";

/** Administration et gestion des essais.
 * Les canaux sont toujours enregistrés par le garde d’accès central injecté.
 */
const { applyTrialDashboard, applyTrialGrant, applyTrialRevocation } = require("../trial-access");
const { safeString } = require("../utils");
const { sanitizeEntity } = require("./sanitizers");
const { notify } = require("./notifications");

function registerAdminIpc({ handle, core, store, adminService }) {
  handle("admin:status", () => adminService.status());
  
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
  
  handle("admin:site-save", (_event, incoming) =>
    adminService.saveSiteSettings(sanitizeEntity(incoming || {}))
  );
  
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
