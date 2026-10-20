"use strict";

/** Audio, raccourcis, synchronisation et démarrage du renderer. */

function stopEditorAudioPreview() {
  if (
    activePreviewAudioScope !== "editor-dialog" ||
    !activePreviewAudio
  ) {
    return;
  }
  const audio = activePreviewAudio;
  activePreviewAudio = null;
  activePreviewAudioScope = "";
  audio.pause();
  try {
    audio.currentTime = 0;
  } catch {
    // Le média peut ne pas encore avoir chargé ses métadonnées.
  }
  audio.remove();
}

document.addEventListener(
  "scroll",
  () => {
    document
      .querySelectorAll("[data-gift-picker-root]")
      .forEach(positionGiftResults);
  },
  true
);

window.addEventListener("resize", () => {
  document
    .querySelectorAll("[data-gift-picker-root]")
    .forEach(positionGiftResults);
});

function keyboardShortcutMatches(event, shortcuts = "") {
  const candidates = String(shortcuts || "")
    .split(",")
    .map((shortcut) => shortcut.trim())
    .filter(Boolean);
  const eventKeys = new Set([
    String(event.key || "").toLowerCase(),
    String(event.code || "").toLowerCase(),
    String(event.code || "").replace(/^Key|^Digit/, "").toLowerCase()
  ]);
  return candidates.some((shortcut) => {
    const parts = shortcut
      .split("+")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    const expects = {
      alt: parts.includes("alt"),
      ctrl: parts.includes("ctrl") || parts.includes("control"),
      shift: parts.includes("shift"),
      meta: parts.includes("meta") || parts.includes("cmd") || parts.includes("command")
    };
    if (
      event.altKey !== expects.alt ||
      event.ctrlKey !== expects.ctrl ||
      event.shiftKey !== expects.shift ||
      event.metaKey !== expects.meta
    ) {
      return false;
    }
    const key = parts.find(
      (part) => !["alt", "ctrl", "control", "shift", "meta", "cmd", "command"].includes(part)
    );
    return Boolean(key && eventKeys.has(key));
  });
}

function handleOverlayKeyboardShortcut(event) {
  if (
    !isAccountAuthenticated() ||
    event.repeat ||
    dialog.open ||
    event.target.closest?.("input, select, textarea, [contenteditable='true']")
  ) {
    return false;
  }
  for (const key of ["timer", "winCounter"]) {
    const config = overlayConfig(key);
    const commands = [
      ["incrementShortcut", "add"],
      ["decrementShortcut", "remove"],
      ["resetShortcut", "reset"]
    ];
    for (const [property, operation] of commands) {
      if (!keyboardShortcutMatches(event, config[property])) continue;
      event.preventDefault();
      const amount = key === "timer" ? 60 : 1;
      performOverlayQuickAction(key, operation, amount).catch((error) =>
        toast("Raccourci overlay impossible", error.message || String(error), true)
      );
      return true;
    }
  }
  return false;
}

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "a") {
    event.preventDefault();
    if (isVerifiedAdminSession()) {
      currentPage = "admin";
      render();
      if (!adminDashboard) {
        refreshAdminDashboard().catch((error) =>
          toast("Administration indisponible", error.message || String(error), true)
        );
      }
    } else if (isAccountAuthenticated()) {
      openAdminLogin();
    } else {
      openAccountLogin();
    }
  }
  if (event.ctrlKey && event.key.toLowerCase() === "l") {
    event.preventDefault();
    if (isAccountAuthenticated()) toggleSession().catch(() => {});
    else openAccountLogin();
  }
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "t") {
    event.preventDefault();
    if (isAccountAuthenticated()) api.testEvent("gift").catch(() => {});
    else openAccountLogin();
  }
  handleOverlayKeyboardShortcut(event);
});

function refreshGameCheatAccess({ renderWhenChanged = true } = {}) {
  if (!isAccountAuthenticated()) {
    const changed = gameCheatAccessAllowed;
    gameCheatAccessAllowed = false;
    if (changed && renderWhenChanged) render();
    return Promise.resolve({ allowed: false, checkedAt: "" });
  }
  if (gameCheatAccessPromise) return gameCheatAccessPromise;
  const expectedUid = accountSession.uid;
  gameCheatAccessPromise = api.account
    .gameCheatAccess()
    .catch(() => ({ allowed: false, checkedAt: "" }))
    .then((result) => {
      if (accountSession.uid !== expectedUid) return result;
      const nextAllowed = result?.allowed === true;
      const changed = nextAllowed !== gameCheatAccessAllowed;
      gameCheatAccessAllowed = nextAllowed;
      if (changed && renderWhenChanged) render();
      return result;
    })
    .finally(() => {
      gameCheatAccessPromise = null;
    });
  return gameCheatAccessPromise;
}

function refreshAccountEntitlements() {
  if (!isAccountAuthenticated() || entitlementSyncPromise) {
    return entitlementSyncPromise;
  }
  entitlementSyncPromise = Promise.all([
    api.account.syncEntitlements(),
    refreshGameCheatAccess()
  ])
    .catch(() => null)
    .finally(() => {
      entitlementSyncPromise = null;
    });
  return entitlementSyncPromise;
}

window.addEventListener("focus", () => {
  refreshAccountEntitlements();
  refreshStoreUpdate();
});

document.addEventListener("visibilitychange", () => {
  synchronizeRendererVisibility();
  if (document.visibilityState === "visible") {
    refreshAccountEntitlements();
  }
});

api.on("renderer-visibility", ({ visible } = {}) => {
  if (typeof visible === "boolean") setRendererWindowVisibility(visible);
});

let persistenceWarningShown = false;
api.on("persistence-status", (status) => {
  if (!status || typeof status.pending !== "boolean") return;
  if (status.pending) {
    if (persistenceWarningShown) return;
    persistenceWarningShown = true;
    toast("Sauvegarde locale en attente", "Les derniers changements ne sont pas encore enregistrés sur ce PC. Gardez ShenPulse ouvert pour ne pas les perdre.", true);
  } else if (persistenceWarningShown) {
    persistenceWarningShown = false;
    toast("Sauvegarde locale rétablie", "Vos réglages ont bien été enregistrés sur ce PC.");
  }
});

api.on("song-requests-changed", acceptCreatorSongRequestsStatus);
api.on("users-changed", () => {
  if (currentPage === "users" && isAccountAuthenticated()) void refreshCreatorUsersDatabase({ force: true });
});

setInterval(() => {
  refreshAccountEntitlements();
}, ENTITLEMENT_SYNC_INTERVAL_MS);

setInterval(() => {
  refreshStoreUpdate();
}, STORE_UPDATE_CHECK_INTERVAL_MS);

storeUpdateButton.addEventListener("click", () => {
  installStoreUpdate().catch(() => {});
});

setInterval(() => {
  if (typeof syncCreatorMatchesVisualStatus === "function") syncCreatorMatchesVisualStatus();
  if (!rendererVisualsActive()) return;
  if (typeof syncCreatorMatchesClock === "function") syncCreatorMatchesClock();
  if (
    (gameInstallBusyId || gameLaunchBusyId) &&
    currentPage === "games" &&
    gamePageMode === "detail" &&
    [gameInstallBusyId, gameLaunchBusyId].includes(selectedGameId)
  ) {
    render();
  }
  if (
    snapshot?.state.session.running ||
    snapshot?.state.session.game?.running
  ) {
    syncChrome();
    updateMinecraftRoundCountdowns();
  }
}, 1000);

if ("speechSynthesis" in window) {
  refreshTtsVoiceSelects();
  window.speechSynthesis.addEventListener(
    "voiceschanged",
    refreshTtsVoiceSelects
  );
}

let rendererStartupNotified = false;
let rendererStartupLoginShown = false;

/** Le main ne reçoit qu'un signal de premier rendu, jamais de décision d'accès. */
function notifyRendererStartupReady() {
  if (rendererStartupNotified) return;
  rendererStartupNotified = true;
  if (typeof api.startupReady === "function") {
    Promise.resolve(api.startupReady()).catch(() => {});
  }
}

function prepareStartupAccountLogin() {
  if (!isAccountAuthenticated() && !dialog.open && !rendererStartupLoginShown) {
    rendererStartupLoginShown = true;
    openAccountLogin();
  }
}

api.getSnapshot()
  .then(async (initialSnapshot) => {
    acceptSnapshot(initialSnapshot);
    const localAccount =
      initialSnapshot?.state?.settings?.account || {};
    accountSession = {
      authenticated: Boolean(localAccount.email && localAccount.uid),
      email: localAccount.email || "",
      uid: localAccount.uid || "",
      displayName: localAccount.displayName || "",
      photoUrl: localAccount.photoUrl || "",
      providerId: localAccount.providerId || "",
      emailVerified: localAccount.emailVerified === true,
      lastAuthenticatedAt: localAccount.lastAuthenticatedAt || "",
      offline: false
    };
    ensureCurrentPageAccess();
    render({ prepareHidden: true });
    prepareStartupAccountLogin();
    notifyRendererStartupReady();
    // Les catalogues distants et la reprise d'installation ne conditionnent
    // ni la saisie du compte invité, ni la sortie du splash de cinq secondes.
    preloadGiftPickerCatalog().catch(() => {});
    restoreActiveGameInstallProgress("", { renderWhenFound: true }).catch(() => {});
    setTimeout(() => {
      refreshStoreUpdate();
    }, 1500);

    let expectedStartupSession = accountSession;
    const startupDialogSession = dialogSessionId;
    const startupSessionCurrent = () => accountSession === expectedStartupSession && !(
      dialog.open && dialog.dataset.variant === "account-auth" && (
        dialogSessionId !== startupDialogSession || dialogForm.getAttribute("aria-busy") === "true" ||
        dialogBody.querySelector('[data-account-command="google"]')?.disabled === true
      )
    );
    const [accountStatus, visibility] = await Promise.all([
      api.account
        .status()
        .catch(() => ({
          authenticated: false,
          email: "",
          uid: "",
          displayName: "",
          photoUrl: "",
          providerId: "",
          emailVerified: false,
          lastAuthenticatedAt: "",
          offline: false
        })),
      api.admin.visibility().catch(() => siteVisibility)
    ]);
    // Le statut initial ne doit pas déconnecter une connexion/inscription
    // commencée entre-temps, ni remplacer son dialogue ou son brouillon.
    if (!startupSessionCurrent()) return;
    accountSession = accountStatus;
    expectedStartupSession = accountStatus;
    siteVisibility = visibility;
    await refreshGameCheatAccess({ renderWhenChanged: false });
    if (!startupSessionCurrent()) return;
    const startupAdminSession = await api.admin
      .status()
      .catch(() => ({
        authorized: false,
        email: "",
        uid: "",
        lastAuthenticatedAt: ""
    }));
    if (!startupSessionCurrent()) return;
    adminSession = startupAdminSession;
    const refreshedSnapshot = await api.getSnapshot();
    if (!startupSessionCurrent()) return;
    acceptSnapshot(refreshedSnapshot);
    ensureCurrentPageAccess();
    await restoreActiveGameInstallProgress("", {
      renderWhenFound: false
    });
    if (!startupSessionCurrent()) return;
    render();
    prepareStartupAccountLogin();
    if (isVerifiedAdminSession()) {
      try {
        adminDashboard = await api.admin.dashboard();
        adminSession = adminDashboard.status || adminSession;
        render();
      } catch (error) {
        console.warn(
          "Synchronisation automatique des accès différée :",
          error?.message || error
        );
      }
    }
  })
  .catch((error) => {
    if (rendererStartupNotified) {
      console.warn("Synchronisation de démarrage différée :", error?.message || error);
      return;
    }
    content.innerHTML = `<div class="empty-state"><div><span class="empty-icon">!</span><h2>ShenPulse n’a pas pu démarrer</h2><p>${escapeHtml(error.message)}</p></div></div>`;
    notifyRendererStartupReady();
  });
