"use strict";

/** Façade IPC stable : sécurité centralisée puis enregistrement par domaine. */
const { clipboard, dialog, ipcMain, net, shell } = require("electron");
const { safeString } = require("./utils");
const { readState } = require("./state-projection");
const { assertIntegrationIpcSender } = require("./integration-ipc-access");
const { assertAdminAccount, assertAuthenticatedAccount } = require("./account-access");
const { assertProFeatureAccess } = require("./pro-feature-access");
const { notify } = require("./ipc/notifications");
const { sanitizeEntity, sanitizeGameConfiguration, sanitizeDealOrNoDealHostState, sanitizeThiercelieuxCommand, sanitizeThiercelieuxHostState, cleanTikTokUsername } = require("./ipc/sanitizers");
const { registerIntegrationsIpc } = require("./ipc/integrations");
const { registerAccountIpc } = require("./ipc/account");
const { registerAdminIpc } = require("./ipc/admin");
const { registerMediaIpc } = require("./ipc/media");
const { registerSessionIpc } = require("./ipc/session");
const { registerSettingsIpc } = require("./ipc/settings");
const { registerWorkspaceIpc } = require("./ipc/workspace");
const { registerGamesIpc } = require("./ipc/games");
const { registerDesktopIpc } = require("./ipc/desktop");
const { registerUsersIpc } = require("./ipc/users");
const { registerMatchesIpc } = require("./ipc/matches");

function localServerSettingsSignature(settings = {}) {
  return JSON.stringify([
    Boolean(settings.startOverlayServer),
    Number(settings.overlayPort || 0),
    Number(settings.apiPort || 0),
    String(settings.overlayToken || ""),
    String(settings.apiToken || "")
  ]);
}

function registerIpc({
  core,
  store,
  backblazeMedia,
  accountService,
  adminService,
  gameRuntime,
  storeUpdateService,
  getWindow
}) {
  const guestAllowedChannels = new Set([
    "account:login",
    "account:login-browser",
    "account:logout",
    "account:password-reset",
    "account:register",
    "account:status",
    "admin:status",
    "admin:visibility-public",
    "catalog:gifts",
    "catalog:media",
    "catalog:sounds",
    "external:open",
    "snapshot:get",
    "updates:check",
    "updates:install",
    "window:close",
    "window:maximize",
    "window:minimize"
  ]);
  const handle = (channel, listener) => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, (...args) => {
      if (["kick:", "controllers:", "live-directory:", "users:", "spotify:", "chatbot:", "irl:", "matches:"].some((prefix) => channel.startsWith(prefix))) {
        assertIntegrationIpcSender(channel, args[0], getWindow());
      }
      if (["entity:upsert", "entity:remove"].includes(channel) && args[1] === "commands") {
        assertIntegrationIpcSender("chatbot:entity", args[0], getWindow());
      }
      if (!guestAllowedChannels.has(channel)) {
        if (channel.startsWith("admin:")) {
          assertAdminAccount(store);
        } else {
          assertAuthenticatedAccount(store);
        }
      }
      if (channel.startsWith("irl:")) assertProFeatureAccess(store, "irl");
      return listener(...args);
    });
  };
  const requireGameAccess = (packId) =>
    core.gameHub.assertAccess(safeString(packId, 160));
  const integrationChange = async (operation) => {
    const result = await operation();
    notify(core, "state-changed", core.snapshot());
    return result;
  };
  const requireGameSessionAvailability = (packId) => {
    const targetId = safeString(packId, 160);
    const active = readState(store, ["session.game"]).session.game || {};
    if (
      active.running === true &&
      active.packId &&
      active.packId !== targetId
    ) {
      const activePack = core.gameHub
        .listPacks()
        .find((entry) => entry.id === active.packId);
      throw new Error(
        `${activePack?.name || "Un autre jeu"} est déjà actif. Arrêtez-le avant d’ouvrir un autre jeu.`
      );
    }
    return targetId;
  };
  const switchAccountWorkspace = async (operation) => {
    await core.suspendAccountWorkspace();
    try {
      const result = await operation();
      await core.resumeAccountWorkspace();
      core.overlayServer?.refreshAccess();
      notify(core, "state-changed", core.snapshot());
      return result;
    } catch (error) {
      await core.resumeAccountWorkspace().catch(() => {});
      throw error;
    }
  };

  registerIntegrationsIpc({ handle, core, store, integrationChange });
  registerAccountIpc({ handle, core, store, accountService, adminService, storeUpdateService, getWindow, switchAccountWorkspace });
  registerAdminIpc({ handle, core, store, adminService });
  registerMediaIpc({ handle, core, store, backblazeMedia, getWindow, dialog, net });
  registerSessionIpc({ handle, core, store });
  registerSettingsIpc({ handle, core, store, localServerSettingsSignature });
  registerWorkspaceIpc({ handle, core, store });
  const { auditGameInteraction } = registerGamesIpc({ handle, core, store, gameRuntime, getWindow, dialog, requireGameAccess, requireGameSessionAvailability });
  registerDesktopIpc({ handle, core, store, getWindow, clipboard, dialog, shell });
  registerUsersIpc({ handle, core, store });
  registerMatchesIpc({ handle, core, store });
  return { auditGameInteraction };
}

module.exports = { registerIpc, sanitizeEntity, sanitizeGameConfiguration, sanitizeDealOrNoDealHostState, sanitizeThiercelieuxCommand, sanitizeThiercelieuxHostState, cleanTikTokUsername };
