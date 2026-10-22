"use strict";

/** Kick, contrôleurs, annuaire LIVE, IRL, OBS et Spotify.
 * Les canaux sont toujours enregistrés par le garde d’accès central injecté.
 */
const { snapshotForRenderer } = require("../account-access");
const { id, safeString } = require("../utils");
const { sanitizeEntity } = require("./sanitizers");
const { notify } = require("./notifications");
const { readState } = require("../state-projection");
const { registerChatbotTransportIpc } = require("./chatbot-transport");
const { normalizeLiveDirectoryPreference, LIVE_DIRECTORY_DEFAULTS_VERSION } = require("../../shared/live-directory-protocol");

function registerIntegrationsIpc({ handle, core, store, integrationChange }) {
  registerChatbotTransportIpc({ handle, core, store, integrationChange });
  handle("kick:status", () => core.kickService.status());
  
  handle("kick:configure", (_event, options) => integrationChange(() => core.kickService.configure(options)));
  
  handle("kick:connect", () => integrationChange(() => core.kickService.connect()));
  
  handle("kick:disconnect", () => integrationChange(async () => {
    if (readState(store, ["connections"]).connections.some((entry) => entry.id === "source_kick")) await core.sourceHub.stop("source_kick");
    return core.kickService.disconnect();
  }));
  
  handle("controllers:status", () => core.controllerService.status());
  
  handle("controllers:pair", () => core.controllerService.pairingCode());
  handle("controllers:connect-local", () => integrationChange(() => core.controllerService.connectLocalPlugin()));
  
  handle("controllers:install", () => core.controllerService.installPlugin());
  
  handle("controllers:revoke", (_event, deviceId) => integrationChange(() => core.controllerService.revoke(deviceId)));
  
  handle("controllers:mapping-save", (_event, mapping) => integrationChange(() => core.controllerService.saveMapping(mapping)));
  
  handle("controllers:mapping-remove", (_event, mappingId) => integrationChange(() => core.controllerService.removeMapping(mappingId)));
  
  handle("controllers:execute", (_event, options) => core.controllerService.executeMapping(options));
  
  handle("live-directory:configure", async (_event, incoming) => {
    if (typeof incoming?.publishEnabled !== "boolean") throw new Error("Choisissez la visibilité de vos LIVE.");
    store.set("settings.liveDirectory", normalizeLiveDirectoryPreference({ publishEnabled: incoming.publishEnabled, defaultsVersion: LIVE_DIRECTORY_DEFAULTS_VERSION }));
    if (!incoming.publishEnabled) await core.liveDirectory?.suspendPublication();
    else core.liveDirectory?.resumePublication();
    core.liveDirectory?.sync();
    notify(core, "state-changed", core.snapshot());
    return snapshotForRenderer(core.snapshot(), store);
  });
  
  handle("irl:status", () => core.shellyService.status());
  
  handle("irl:scan", async (_event, incoming) => {
    const result = await core.shellyService.scan(sanitizeEntity(incoming || {}));
    notify(core, "state-changed", core.snapshot());
    return { ...result, snapshot: core.snapshot() };
  });
  
  handle("irl:pair", async (_event, incoming) => {
    const result = await core.shellyService.pair(sanitizeEntity(incoming || {}));
    notify(core, "state-changed", core.snapshot());
    return { ...result, snapshot: core.snapshot() };
  });
  
  handle("irl:add", async (_event, incoming) => {
    const result = await core.shellyService.addDevice(
      sanitizeEntity(incoming || {})
    );
    notify(core, "state-changed", core.snapshot());
    return { ...result, snapshot: core.snapshot() };
  });
  
  handle("irl:remove", (_event, deviceId) => {
    const result = core.shellyService.removeDevice(safeString(deviceId, 160));
    notify(core, "state-changed", core.snapshot());
    return { ...result, snapshot: core.snapshot() };
  });
  
  handle("irl:rename", (_event, deviceId, name) => {
    const result = core.shellyService.renameDevice(
      safeString(deviceId, 160),
      safeString(name, 80)
    );
    notify(core, "state-changed", core.snapshot());
    return { ...result, snapshot: core.snapshot() };
  });
  
  handle("irl:enabled", (_event, enabled) => {
    const result = core.shellyService.setEnabled(enabled === true);
    notify(core, "state-changed", core.snapshot());
    return { ...result, snapshot: core.snapshot() };
  });
  
  handle("irl:test", async (_event, incoming) => {
    const payload = sanitizeEntity(incoming || {});
    const result = await core.shellyService.test(
      safeString(payload.deviceId, 160),
      safeString(payload.operation || "toggle", 40),
      Number(payload.durationMs || 3000)
    );
    notify(core, "state-changed", core.snapshot());
    return { ...result, snapshot: core.snapshot() };
  });
  
  handle("obs:test", () => core.obsClient.request("GetVersion", {}));
  
  handle("spotify:connect", async () => {
    const status = await core.spotifyService.connect();
    notify(core, "state-changed", core.snapshot());
    return { status, snapshot: core.snapshot() };
  });
  
  handle("spotify:disconnect", async () => {
    const status = await core.spotifyService.disconnect();
    notify(core, "state-changed", core.snapshot());
    return { status, snapshot: core.snapshot() };
  });
  
  handle("spotify:status", () => core.spotifyService.status());
  
  handle("spotify:control", (_event, config) =>
    core.spotifyService.control(sanitizeEntity(config || {}))
  );
}

module.exports = { registerIntegrationsIpc };
