"use strict";

/**
 * Routeur minimal des commandes issues de l'interface.
 * Les implémentations sont isolées par domaine dans actions/handlers/.
 */

async function handleAction(target) {
  const action = target.dataset.action;
  const id = target.dataset.id;
  if (!action) return;
  if (action === "account-login") {
    return openAccountLogin();
  }
  if (action === "account-logout") {
    const visibleSession = visibleAccountSession();
    if (
      !(await confirmAction(
        `Se déconnecter du compte ${visibleSession.email || "ShenPulse"} sur cet appareil ?`,
        { title: "Changer de compte", confirmLabel: "Se déconnecter" }
      ))
    ) {
      return;
    }
    const logoutOperation = (async () => {
      const nextSession = await api.account.logout();
      siteVisibility = await api.admin.visibility();
      acceptSnapshot(await api.getSnapshot());
      return nextSession;
    })();
    pendingAccountLogoutPromise = logoutOperation;
    accountSession = signedOutAccountSession();
    gameCheatAccessAllowed = false;
    liveEvents = [];
    adminSession = {
      authorized: false,
      email: "",
      uid: "",
      lastAuthenticatedAt: ""
    };
    adminDashboard = null;
    ensureCurrentPageAccess();
    accountMenu.hidden = true;
    accountMenuButton.setAttribute("aria-expanded", "false");
    render();
    toast("Compte ShenPulse déconnecté");
    openAccountLogin();
    try {
      accountSession = await logoutOperation;
      render();
    } finally {
      if (pendingAccountLogoutPromise === logoutOperation) {
        pendingAccountLogoutPromise = null;
      }
    }
    return;
  }
  if (requireAccountForAction(action)) return;
  const requiredFeature = {
    "upload-sound": "backblaze.sounds",
    "add-tts": "tts.voices",
    "edit-tts": "tts.voices",
    "preview-tts": "tts.voices",
    "spotify-connect": "spotify.playback",
    "spotify-disconnect": "spotify.playback",
    "spotify-refresh": "spotify.playback",
    "spotify-control": "spotify.playback",
    "test-obs": "obs.websocket",
    "add-connection": "sources.custom",
    "edit-connection": "sources.custom",
    "start-connection": "sources.custom",
    "stop-connection": "sources.custom",
    "export-data": "data.management",
    "import-data": "data.management",
    "clear-data": "data.management",
    "restart-servers": "local.services",
    "irl-toggle": "irl.shelly",
    "irl-scan": "irl.shelly",
    "irl-pair": "irl.shelly",
    "irl-add-manual": "irl.shelly",
    "irl-add-action": "irl.shelly",
    "irl-test": "irl.shelly",
    "irl-rename": "irl.shelly",
    "irl-remove": "irl.shelly"
  }[action];
  if (requiredFeature && !canAccessFeature(requiredFeature)) {
    return toast(
      "Fonction indisponible",
      "Cette fonction est masquée par la configuration ShenPulse.",
      true
    );
  }
  const context = { action, target, id };
  for (const handler of ACTION_HANDLERS) {
    const result = await handler(context);
    if (result !== ACTION_NOT_HANDLED) return result;
  }
}
