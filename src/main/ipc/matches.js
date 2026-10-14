"use strict";

/** Canaux Matchs : accès Pro et fenêtre principale vérifiés avant le service. */
const { assertProFeatureAccess } = require("../pro-feature-access");
const { sanitizeEntity } = require("./sanitizers");
function registerMatchesIpc({ handle, core, store }) {
  const service = () => { assertProFeatureAccess(store, "matches"); if (!core.matches) throw new Error("Service Matchs indisponible."); return core.matches; };
  handle("matches:status", () => service().status());
  const mutation = (channel, method, hasInput = true) => handle(channel, async (_event, incoming, expected) => {
    const result = await service()[method](...(hasInput ? [sanitizeEntity(incoming), sanitizeEntity(expected)] : [sanitizeEntity(incoming)]));
    return { result, status: service().status(), snapshot: core.snapshot() };
  });
  mutation("matches:config-save", "saveConfig"); mutation("matches:automation-save", "saveAutomation");
  mutation("matches:automation-remove", "removeAutomation"); mutation("matches:automation-test", "testAutomation");
  mutation("matches:widget-test", "testWidget"); mutation("matches:wins-adjust", "adjustWins");
  mutation("matches:wins-reset", "resetWins", false); mutation("matches:contributors-reset", "resetContributors", false);
}
module.exports = { registerMatchesIpc };
