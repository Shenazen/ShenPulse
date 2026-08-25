"use strict";

/**
 * Accès, navigation, chrome et cycle de rendu principal.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function visibilityScope(section, id) {
  const storedId = visibilityTools.storageKey(id);
  const stored = siteVisibility?.[section]?.[storedId]?.scope;
  if (stored) return stored;
  if (
    (section === "navigation" && id === "irl") ||
    (["features", "actionTypes"].includes(section) && id === "irl.shelly")
  ) {
    return "admin";
  }
  return "public";
}

function canAccessCatalogItem(section, id) {
  return visibilityTools.canAccessScope(
    visibilityScope(section, id),
    isVerifiedAdminSession()
  );
}

function canAccessFeature(id) {
  if (id === "irl.shelly") return isVerifiedAdminSession();
  return canAccessCatalogItem("features", id);
}

function canAccessOverlay(item) {
  return Boolean(item?.key && canAccessCatalogItem("overlays", item.key));
}

function canAccessGame(pack) {
  return Boolean(pack?.id && canAccessCatalogItem("games", pack.id));
}

function minecraftLauncherPack(modePacks) {
  return {
    id: MINECRAFT_LAUNCHER_ID,
    name: "Minecraft",
    publisher: "ShenPulse",
    version: "1.0.0",
    description:
      "Choisissez Bedrock Box ou SandBox, puis configurez les interactions TikTok LIVE propres à ce mode.",
    platform: "Windows",
    tags: ["abonnement requis", "inclus", "2 modes"],
    artwork: "minecraft.webp",
    artworkUrl: "",
    accessMode: "included",
    included: true,
    requiresPro: true,
    price: 0,
    currency: "EUR",
    source: "Minecraft",
    connector: { type: "modes" },
    effects: modePacks.flatMap((pack) => pack.effects || []),
    modes: modePacks,
    modeSelector: true
  };
}

function visibleGamePacks() {
  const visible = (snapshot?.packs || []).filter(canAccessGame);
  const minecraftModes = visible.filter((pack) =>
    MINECRAFT_MODE_IDS.includes(pack.id)
  );
  if (!minecraftModes.length) return visible;
  const firstMinecraftIndex = visible.findIndex((pack) =>
    MINECRAFT_MODE_IDS.includes(pack.id)
  );
  return visible.flatMap((pack, index) => {
    if (!MINECRAFT_MODE_IDS.includes(pack.id)) return [pack];
    if (index !== firstMinecraftIndex) return [];
    return [minecraftLauncherPack(minecraftModes)];
  });
}

const ACTION_FEATURE_REQUIREMENTS = Object.freeze({
  "tts.speak": "tts.voices",
  "spotify.queue": "spotify.playback",
  "obs.request": "obs.websocket",
  "websocket.send": "sources.custom",
  "irl.shelly": "irl.shelly"
});

function canAccessActionType(type) {
  const canonicalType = canonicalActionType(type);
  if (canonicalType === "irl.shelly" && !isVerifiedAdminSession()) {
    return false;
  }
  if (canonicalType === "overlay.match" && !hasProAccess()) {
    return false;
  }
  const featureId = ACTION_FEATURE_REQUIREMENTS[canonicalType];
  return (
    canAccessCatalogItem("actionTypes", canonicalType) &&
    (!featureId || canAccessFeature(featureId))
  );
}

function canAccessPage(page) {
  if (!page?.id || page.hidden?.()) return false;
  if (page.id === "admin") return isVerifiedAdminSession();
  if (page.ownerOnly && !isVerifiedAdminSession()) return false;
  if (page.id === "activity" && !isAccountAuthenticated()) {
    return false;
  }
  return canAccessCatalogItem("navigation", page.id);
}

function isAccountAuthenticated() {
  return accountSession.authenticated === true;
}

function canUseDealCheatSettings() {
  return (
    isVerifiedAdminSession() ||
    (
      isAccountAuthenticated() &&
      accountSession.emailVerified === true &&
      gameCheatAccessAllowed === true
    )
  );
}

function isVerifiedAdminSession() {
  return (
    isAccountAuthenticated() &&
    String(accountSession.email || "").trim().toLowerCase() ===
      ADMIN_OWNER_EMAIL &&
    adminSession.authorized === true &&
    String(adminSession.email || "").trim().toLowerCase() ===
      ADMIN_OWNER_EMAIL &&
    Boolean(accountSession.uid) &&
    accountSession.uid === adminSession.uid
  );
}

function visibleNavigationEntries() {
  const entries = [];
  let pendingSection = null;
  for (const page of pages) {
    if (page.section) {
      pendingSection = page;
      continue;
    }
    if (!canAccessPage(page)) continue;
    if (pendingSection) {
      entries.push(pendingSection);
      pendingSection = null;
    }
    entries.push(page);
  }
  return entries;
}

function firstAccessiblePageId() {
  return (
    pages.find((page) => page.id && page.id !== "admin" && canAccessPage(page))
      ?.id || "dashboard"
  );
}

function ensureCurrentPageAccess() {
  const current = pages.find((page) => page.id === currentPage);
  if (!current || !canAccessPage(current)) {
    currentPage = firstAccessiblePageId();
  }
}

function canNavigateTo(pageId) {
  return canAccessPage(pages.find((page) => page.id === pageId));
}

function renderNavigation() {
  const entries = visibleNavigationEntries();
  const nextStructureSignature = JSON.stringify(
    entries.map((page) =>
      page.section
        ? ["section", page.section]
        : ["page", page.id, page.label]
    )
  );
  if (nextStructureSignature !== navigationStructureSignature) {
    navigation.innerHTML = entries
      .map((page) => {
        if (page.section) return `<div class="nav-section">${escapeHtml(page.section)}</div>`;
        return `
          <button class="nav-item" data-navigate="${page.id}">
            <span class="nav-icon">${navigationIcon(page.id)}</span>
            <span>${escapeHtml(page.label)}</span>
          </button>`;
      })
      .join("");
    navigationStructureSignature = nextStructureSignature;
  }

  const navigationItems = new Map(
    Array.from(navigation.querySelectorAll(".nav-item")).map((item) => [
      item.dataset.navigate,
      item
    ])
  );
  for (const page of entries) {
    if (page.section) continue;
    const item = navigationItems.get(page.id);
    if (!item) continue;
    item.classList.toggle("active", currentPage === page.id);
    const count = page.count?.();
    let countNode = item.querySelector(".nav-count");
    if (count == null) {
      countNode?.remove();
      continue;
    }
    if (!countNode) {
      countNode = document.createElement("span");
      countNode.className = "nav-count";
      item.appendChild(countNode);
    }
    const nextCount = String(count);
    if (countNode.textContent !== nextCount) countNode.textContent = nextCount;
  }
}

function tiktokMeta() {
  const tiktok = snapshot?.state.settings.tiktok || {};
  const connection = snapshot?.state.connections.find(
    (item) => item.id === "source_tiktok"
  );
  const status = tiktok.status || "unconfigured";
  const labels = {
    live: "LIVE détecté",
    offline: "Hors ligne",
    checking: "Détection en cours",
    disconnected: "Détection arrêtée",
    error: "LIVE non détecté",
    unconfigured: tiktok.username ? "Relais requis" : "À configurer"
  };
  return {
    ...tiktok,
    connection,
    status,
    label: labels[status] || status,
    live: status === "live",
    connected: ["connected", "connecting", "reconnecting"].includes(
      connection?.status
    )
  };
}

function activeGameSession() {
  const game = snapshot?.state?.session?.game || {};
  if (!game.running || !game.packId) return null;
  const pack = snapshot.packs.find((entry) => entry.id === game.packId);
  if (!pack) return null;
  return { ...game, pack };
}

function minecraftRoundSettingsFor(packId) {
  const saved =
    snapshot?.state?.game?.roundSettingsByPack?.[packId] || {};
  return {
    durationMinutes: Math.max(
      1,
      Math.min(1440, Math.round(Number(saved.durationMinutes || 10)))
    ),
    autoRestart: saved.autoRestart === true
  };
}

function minecraftRoundRemainingSeconds(gameSession = activeGameSession()) {
  if (
    !gameSession ||
    !MINECRAFT_MODE_IDS.includes(gameSession.packId) ||
    !gameSession.roundEndsAt
  ) {
    return 0;
  }
  return Math.max(
    0,
    Math.ceil(
      (new Date(gameSession.roundEndsAt).getTime() - Date.now()) / 1000
    )
  );
}

function formatCountdown(seconds) {
  const value = Math.max(0, Math.round(Number(seconds || 0)));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainingSeconds = value % 60;
  return hours
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0"
      )}:${String(remainingSeconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(
        remainingSeconds
      ).padStart(2, "0")}`;
}

function updateMinecraftRoundCountdowns() {
  const gameSession = activeGameSession();
  const remaining = minecraftRoundRemainingSeconds(gameSession);
  document
    .querySelectorAll("[data-minecraft-round-countdown]")
    .forEach((node) => {
      node.textContent =
        gameSession?.roundStatus === "timeout" && !gameSession.roundEndsAt
          ? "TIME OUT"
          : formatCountdown(remaining);
    });
}

function activeGameConflict(pack) {
  const gameSession = activeGameSession();
  if (!gameSession || !pack) return null;
  if (pack.id === gameSession.packId) return null;
  if (
    pack.modeSelector &&
    (pack.modes || []).some((mode) => mode.id === gameSession.packId)
  ) {
    return null;
  }
  return gameSession;
}

function showActiveGameConflict(pack) {
  const gameSession = activeGameConflict(pack);
  if (!gameSession) return false;
  openEditor({
    title: "Un jeu est déjà actif",
    kicker: "CHANGEMENT DE JEU BLOQUÉ",
    variant: "game-session-blocked",
    body: `<div class="game-session-blocked-dialog">
      <span>■</span>
      <div>
        <strong>${escapeHtml(gameSession.pack.name)} est en cours d’exécution</strong>
        <p>Arrêtez d’abord ce jeu avec le bouton Stop de la barre supérieure. Son serveur et son chrono seront coupés proprement avant que vous puissiez ouvrir ${escapeHtml(pack.name)}.</p>
      </div>
    </div>`,
    onSubmit: null
  });
  return true;
}

function visibleAccountSession() {
  return accountSession;
}

function accountInitials(session = visibleAccountSession()) {
  const source = String(
    session.displayName || session.email?.split("@")[0] || "SP"
  ).trim();
  const words = source
    .split(/[\s._-]+/)
    .map((word) => word.trim())
    .filter(Boolean);
  return (
    (words.length > 1
      ? `${words[0][0]}${words[1][0]}`
      : source.slice(0, 2)) || "SP"
  ).toLocaleUpperCase("fr");
}

function accountDisplayName(session = visibleAccountSession()) {
  if (!session.authenticated) return "Aucun compte";
  return (
    session.displayName ||
    String(session.email || "").split("@")[0] ||
    "Compte ShenPulse"
  );
}

function signedOutAccountSession() {
  return {
    authenticated: false,
    email: "",
    uid: "",
    displayName: "",
    photoUrl: "",
    providerId: "",
    emailVerified: false,
    lastAuthenticatedAt: "",
    offline: false
  };
}

async function waitForPendingAccountLogout() {
  const logoutPromise = pendingAccountLogoutPromise;
  if (logoutPromise) await logoutPromise;
}

function syncAccountChrome() {
  const visibleSession = visibleAccountSession();
  const authenticated = visibleSession.authenticated === true;
  const displayName = accountDisplayName(visibleSession);
  const email = authenticated
    ? visibleSession.email
    : "Se connecter à ShenPulse";
  const initials = accountInitials(visibleSession);
  accountAvatar.textContent = initials;
  accountMenuAvatar.textContent = initials;
  accountName.textContent = displayName;
  accountName.title = authenticated
    ? visibleSession.email
    : "Aucun compte ShenPulse connecté";
  accountEmail.textContent = email;
  accountEmail.title = email;
  accountMenuName.textContent = displayName;
  accountMenuEmail.textContent = authenticated
    ? `${visibleSession.email}${
        visibleSession.offline ? " · Hors ligne" : ""
      }`
    : "Connectez votre compte pour synchroniser vos accès.";
  accountMenu
    .querySelector(".account-login-action")
    ?.toggleAttribute("hidden", authenticated);
  accountMenu
    .querySelector(".account-logout-action")
    ?.toggleAttribute("hidden", !authenticated);
  accountAuthCta.hidden = authenticated;
  profileControl.hidden = !authenticated;
  tiktokControl.hidden = !authenticated;
  sessionButton.hidden = !authenticated;
}

function syncChrome() {
  ensureCurrentPageAccess();
  const page =
    pages.find((item) => item.id === currentPage) ||
    pages.find((item) => item.id === firstAccessiblePageId()) ||
    pages[1];
  pageTitle.textContent = page.title;
  pageKicker.textContent = page.kicker;
  const state = snapshot?.state;
  if (!state) return;
  syncAccountChrome();
  const activeProfile = state.profiles.find(
    (profile) => profile.id === state.session.profileId
  ) || state.profiles[0];
  profileCurrentName.textContent = activeProfile?.name || "Profil actif";
  const nextProfileChromeSignature = JSON.stringify(
    state.profiles.map((profile) => [
      profile.id,
      profile.name,
      profile.description || "",
      profile.workspace?.rules?.length || 0,
      profile.id === state.session.profileId
    ])
  );
  if (nextProfileChromeSignature !== profileChromeSignature) {
    const menuWasOpen = !profileMenu.hidden;
    profileSelect.innerHTML = state.profiles
      .map((profile) => `<option value="${escapeHtml(profile.id)}" ${profile.id === state.session.profileId ? "selected" : ""}>${escapeHtml(profile.name)}</option>`)
      .join("");
    profileMenu.innerHTML = state.profiles.map((profile) => {
      const active = profile.id === state.session.profileId;
      const ruleCount = profile.workspace?.rules?.length || 0;
      return `<button type="button" class="profile-menu-item ${active ? "active" : ""}" data-profile-select="${escapeHtml(profile.id)}" role="option" aria-selected="${active}">
        <span class="profile-menu-avatar">${escapeHtml(profile.name.slice(0, 2).toUpperCase())}</span>
        <span class="profile-menu-copy">
          <strong>${escapeHtml(profile.name)}</strong>
          <small>${escapeHtml(profile.description || `${ruleCount} règle${ruleCount > 1 ? "s" : ""} configurée${ruleCount > 1 ? "s" : ""}`)}</small>
        </span>
        ${active ? '<span class="profile-menu-active">ACTIF</span>' : ""}
      </button>`;
    }).join("");
    profileMenu.hidden = !menuWasOpen;
    profilePickerButton.setAttribute("aria-expanded", String(menuWasOpen));
    profileChromeSignature = nextProfileChromeSignature;
  }
  const gameSession = activeGameSession();
  gameSessionControl.hidden = !gameSession;
  if (gameSession) {
    gameSessionLabel.textContent = MINECRAFT_MODE_IDS.includes(
      gameSession.packId
    )
      ? `${gameSession.pack.name} · ${
          gameSession.roundStatus === "timeout" && !gameSession.roundEndsAt
            ? "TIME OUT"
            : `${formatCountdown(
                minecraftRoundRemainingSeconds(gameSession)
              )} restant`
        }`
      : `${gameSession.pack.name} · ${formatDuration(
          gameSession.startedAt
        )}`;
    gameSessionSummary.title = `Revenir à ${gameSession.pack.name}`;
  }
  sessionButton.classList.toggle("running", state.session.running);
  sessionLabel.textContent = state.session.running ? `LIVE · ${formatDuration(state.session.startedAt)}` : "Démarrer le live";
  const tiktok = tiktokMeta();
  tiktokAccountLabel.textContent = tiktok.username
    ? `@${tiktok.username}`
    : "@ TikTok";
  tiktokStatusLabel.textContent = tiktok.label;
  tiktokStatusDot.className = `tiktok-status-dot status-${tiktok.status}`;
  tiktokConnectionButton.classList.toggle("connected", tiktok.connected);
  tiktokConnectionButton.disabled = !tiktok.username;
  tiktokConnectionButton.textContent = tiktok.connected ? "■" : "↻";
  tiktokConnectionButton.title = tiktok.connected
    ? "Arrêter la détection TikTok LIVE"
    : "Détecter automatiquement si le compte TikTok est en LIVE";
  const serverDot = document.getElementById("server-dot");
  const serverDetail = document.getElementById("server-detail");
  const appVersion = document.getElementById("app-version");
  const urlsReady = Boolean(snapshot.overlayUrls?.base);
  serverDot.classList.toggle("error", !urlsReady);
  serverDetail.textContent = urlsReady ? `API : ${state.settings.apiPort} · Overlay : ${state.settings.overlayPort}` : "Serveurs indisponibles";
  appVersion.textContent = `Version : ${snapshot.appVersion || "—"}`;
}

function render() {
  if (!snapshot) return;
  const adminScrollState = captureAdminScrollState();
  ensureCurrentPageAccess();
  renderNavigation();
  syncChrome();
  const renderers = {
    dashboard: renderDashboard,
    live: renderLive,
    actions: renderActions,
    rules: renderRules,
    overlays: renderOverlaysV2,
    sounds: renderSounds,
    irl: renderIrl,
    games: renderGamesV2,
    goals: renderGoals,
    commands: renderCommands,
    membership: renderMembership,
    connections: renderConnections,
    activity: renderActivity,
    settings: renderSettings,
    admin: renderAdmin
  };
  const pageMarkup = (renderers[currentPage] || renderDashboard)();
  const installPack = (snapshot.packs || []).find(
    (pack) => pack.id === gameInstallProgress?.gameId
  );
  const installProgressMarkup = installPack
    ? renderGameInstallProgressModal(installPack)
    : "";
  const nextContentMarkup = isAccountAuthenticated()
    ? `${pageMarkup}${installProgressMarkup}`
    : `${renderGuestAccessNotice()}${pageMarkup}${installProgressMarkup}`;
  if (
    renderedContentPage === currentPage &&
    renderedContentMarkup === nextContentMarkup
  ) {
    applyGuestReadOnlyMode(content);
    return;
  }
  content.innerHTML = nextContentMarkup;
  renderedContentPage = currentPage;
  renderedContentMarkup = nextContentMarkup;
  bindOverlayRuntimeFrames(content);
  applyGuestReadOnlyMode(content);
  restoreAdminScrollState(adminScrollState);
}

const GUEST_BROWSING_ACTIONS = new Set([
  "account-login",
  "close-game",
  "dismiss-game-message",
  "dismiss-game-progress",
  "filter-enabled-actions",
  "select-simulator-type",
  "set-actions-section",
  "set-game-effect-category",
  "set-game-filter",
  "set-overlay-category",
  "set-sound-category",
  "preview-overlay"
]);

function renderGuestAccessNotice() {
  if (currentPage === "activity") return "";
  return `<aside class="guest-access-notice">
    <span aria-hidden="true">SP</span>
    <div>
      <strong>Mode consultation</strong>
      <p>Connectez-vous pour afficher vos données locales, vos sources et vos URL, puis pour modifier ou lancer une configuration.</p>
    </div>
    <button class="button primary" type="button" data-action="account-login">Se connecter ou s’inscrire</button>
  </aside>`;
}

function applyGuestReadOnlyMode(root) {
  if (!root) return;
  if (isAccountAuthenticated()) {
    root
      .querySelectorAll('[data-guest-locked="true"]')
      .forEach((control) => {
        if ("disabled" in control) {
          control.disabled = control.dataset.guestWasDisabled === "true";
        }
        if (control.dataset.guestHadAriaDisabled === "true") {
          control.setAttribute(
            "aria-disabled",
            control.dataset.guestPreviousAriaDisabled || "false"
          );
        } else {
          control.removeAttribute("aria-disabled");
        }
        if (control.dataset.guestHadTitle === "true") {
          control.title = control.dataset.guestPreviousTitle || "";
        } else {
          control.removeAttribute("title");
        }
        delete control.dataset.guestLocked;
        delete control.dataset.guestWasDisabled;
        delete control.dataset.guestHadAriaDisabled;
        delete control.dataset.guestPreviousAriaDisabled;
        delete control.dataset.guestHadTitle;
        delete control.dataset.guestPreviousTitle;
      });
    return;
  }
  const lockControl = (control, message) => {
    if (control.dataset.guestLocked !== "true") {
      control.dataset.guestWasDisabled = String(
        "disabled" in control && control.disabled
      );
      control.dataset.guestHadAriaDisabled = String(
        control.hasAttribute("aria-disabled")
      );
      control.dataset.guestPreviousAriaDisabled =
        control.getAttribute("aria-disabled") || "";
      control.dataset.guestHadTitle = String(control.hasAttribute("title"));
      control.dataset.guestPreviousTitle = control.getAttribute("title") || "";
    }
    control.dataset.guestLocked = "true";
    control.setAttribute("aria-disabled", "true");
    control.title = message;
    if ("disabled" in control) control.disabled = true;
  };
  root
    .querySelectorAll("input, select, textarea")
    .forEach((control) => {
      const browsingControl =
        control.matches("[data-search]") ||
        control.matches('[data-action="filter-enabled-actions"]') ||
        control.matches("[data-overlay-design]");
      if (!browsingControl) {
        lockControl(
          control,
          "Connectez-vous à ShenPulse pour modifier ce réglage."
        );
      }
    });
  root.querySelectorAll("button, [data-action]").forEach((control) => {
    const action = control.dataset.action || "";
    const browsingControl =
      control.hasAttribute("data-navigate") ||
      GUEST_BROWSING_ACTIONS.has(action);
    if (browsingControl) return;
    lockControl(
      control,
      "Connectez-vous à ShenPulse pour utiliser cette fonction."
    );
  });
}

function requireAccountForAction(action) {
  if (
    isAccountAuthenticated() ||
    GUEST_BROWSING_ACTIONS.has(action)
  ) {
    return false;
  }
  toast(
    "Connexion requise",
    "Connectez-vous à votre compte ShenPulse pour utiliser cette fonction.",
    true
  );
  openAccountLogin();
  return true;
}

function captureAdminScrollState() {
  if (currentPage !== "admin" || !content.querySelector(".admin-page")) {
    return null;
  }
  return {
    contentTop: content.scrollTop,
    regions: Array.from(content.querySelectorAll("[data-admin-scroll]")).map(
      (element) => ({
        key: element.dataset.adminScroll,
        top: element.scrollTop,
        left: element.scrollLeft
      })
    )
  };
}

function restoreAdminScrollState(scrollState) {
  if (!scrollState || currentPage !== "admin") return;
  content.scrollTop = scrollState.contentTop;
  for (const region of scrollState.regions) {
    const element = Array.from(
      content.querySelectorAll("[data-admin-scroll]")
    ).find((candidate) => candidate.dataset.adminScroll === region.key);
    if (!element) continue;
    element.scrollTop = region.top;
    element.scrollLeft = region.left;
  }
}
