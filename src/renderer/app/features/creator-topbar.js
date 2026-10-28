"use strict";

let creatorTikTokBusy = false;
let creatorTikTokBusyAction = "";
let creatorTikTokDraftDirty = false;
let creatorTikTokAccountKey = null;
let creatorLiveDirectoryBusy = false;

// Les contrôles existants gardent leurs gestionnaires et leur état après déplacement.
function initializeCreatorTopbar() {
  const bar = document.querySelector(".creator-topbar");
  document.querySelector(".app-shell").prepend(bar);

  const actions = bar.querySelector(".titlebar-actions");
  const center = document.createElement("div");
  center.className = "creator-topbar-center";
  center.append(accountAuthCta, tiktokControl, document.getElementById("topbar-live-status"));
  bar.insertBefore(center, actions);
  const accountControl = accountMenuButton.closest(".account-control");
  const windows = bar.querySelector(".window-buttons");
  // Revenir au jeu actif et l'arrêter restent possibles sans créer une seconde barre.
  actions.append(gameSessionControl, sessionButton, profileControl, accountControl, windows);
  accountEmail.hidden = true;
  const badge = document.createElement("small");
  badge.id = "account-plan";
  badge.className = "creator-account-plan";
  accountName.after(badge);
  const membership = document.createElement("button");
  membership.type = "button";
  membership.id = "account-membership-button";
  membership.setAttribute("role", "menuitem");
  membership.textContent = "Mon abonnement";
  membership.addEventListener("click", () => {
    accountMenu.hidden = true;
    accountMenuButton.setAttribute("aria-expanded", "false");
    openMembershipPopup();
  });
  accountMenu.querySelector(".account-menu-actions").prepend(membership);
  document.getElementById("account-directory-toggle").addEventListener("click", handleCreatorLiveDirectoryToggle);
}

function syncCreatorLiveDirectoryPreference() {
  const authenticated = isAccountAuthenticated();
  const preference = document.getElementById("account-directory-preference");
  const toggle = document.getElementById("account-directory-toggle");
  preference.hidden = !authenticated;
  toggle.disabled = !authenticated || creatorLiveDirectoryBusy;
  toggle.setAttribute("aria-busy", String(creatorLiveDirectoryBusy));
  const enabled = authenticated && (typeof snapshot?.liveDirectory?.enabled === "boolean"
    ? snapshot.liveDirectory.enabled : snapshot?.state?.settings?.liveDirectory?.publishEnabled === true);
  toggle.setAttribute("aria-checked", String(enabled));
}

async function handleCreatorLiveDirectoryToggle() {
  if (!isAccountAuthenticated() || creatorLiveDirectoryBusy) return;
  const uid = accountSession.uid;
  const toggle = document.getElementById("account-directory-toggle");
  const enabled = toggle.getAttribute("aria-checked") === "true";
  creatorLiveDirectoryBusy = true;
  syncCreatorLiveDirectoryPreference();
  try {
    const next = await api.liveDirectoryConfigure({ publishEnabled: !enabled });
    if (isAccountAuthenticated() && accountSession.uid === uid) acceptSnapshot(next);
  } catch (error) {
    if (isAccountAuthenticated() && accountSession.uid === uid) {
      toast("Annuaire public", error.message || "Impossible de modifier la visibilité de votre LIVE.", true);
    }
  } finally {
    creatorLiveDirectoryBusy = false;
    syncCreatorLiveDirectoryPreference();
    applyStudioLanguage(accountMenu);
  }
}

function creatorAccountPhotoUrl(session) {
  if (!session.authenticated || !session.photoUrl) return "";
  try {
    const parsed = new URL(session.photoUrl);
    return parsed.protocol === "https:" ? parsed.href : "";
  } catch { return ""; }
}

function syncCreatorAccountAvatar(avatar, session) {
  const initials = session.authenticated ? accountInitials(session) : "SP";
  const photo = creatorAccountPhotoUrl(session);
  const identity = JSON.stringify([photo, initials]);
  if (avatar.dataset.identity === identity) return;
  avatar.dataset.identity = identity;
  avatar.textContent = initials;
  avatar.classList.toggle("has-photo", Boolean(photo));
  if (!photo) return;
  const image = document.createElement("img");
  image.alt = "";
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => {
    if (avatar.dataset.identity !== identity) return;
    avatar.classList.remove("has-photo");
    avatar.textContent = initials;
  }, { once: true });
  image.src = photo;
  avatar.replaceChildren(image);
}

function syncCreatorAccountChrome() {
  const session = visibleAccountSession();
  syncCreatorAccountAvatar(accountAvatar, session);
  syncCreatorAccountAvatar(accountMenuAvatar, session);
  if (!session.authenticated) {
    accountName.textContent = studioTranslate("Aucun compte");
    accountMenuName.textContent = studioTranslate("Aucun compte");
    accountMenuEmail.textContent = studioTranslate("Connectez votre compte pour synchroniser vos accès.");
  }
  const subscription = currentSubscription();
  const pro = session.authenticated && hasProAccess();
  const tier = pro ? subscription.tier : "free";
  const label = !session.authenticated ? "INVITÉ" : !pro ? "GRATUIT"
    : subscription.source === "trial" ? "PRO · ESSAI"
      : ["premiumSeat", "agencyReward"].includes(subscription.source) ? "PRO · OFFERT"
        : tier === "premium" ? "PREMIUM" : "PRO";
  const badge = document.getElementById("account-plan");
  badge.textContent = label;
  badge.dataset.tier = session.authenticated ? tier : "guest";
  accountMenuButton.title = session.authenticated ? accountDisplayName(session) : "Se connecter à ShenPulse";
  syncCreatorLiveDirectoryPreference();
}

function normalizeCreatorTikTokUsername(value) {
  return String(value ?? "").replace(/\0/g, "").slice(0, 80).trim()
    .replace(/^@+/, "").replace(/\s+/g, "").replace(/[^a-zA-Z0-9._]/g, "").slice(0, 30);
}

function clearCreatorTikTokError() {
  const error = document.getElementById("tiktok-input-error");
  error.hidden = true;
  error.textContent = "";
  tiktokUsernameInput.removeAttribute("aria-invalid");
}

function syncCreatorTikTokControl() {
  const authenticated = isAccountAuthenticated();
  const tiktok = authenticated ? tiktokMeta() : { username: "", status: "unconfigured", connected: false, live: false };
  const accountKey = authenticated ? accountSession.uid : "";
  const watching = authenticated && tiktok.connected;
  if (accountKey !== creatorTikTokAccountKey) {
    creatorTikTokAccountKey = accountKey;
    creatorTikTokDraftDirty = false;
    tiktokUsernameInput.value = tiktok.username || "";
    clearCreatorTikTokError();
  } else if (watching) {
    // Another page can start the saved source while a different @ is being drafted.
    // A locked control must always identify the account actually being monitored.
    creatorTikTokDraftDirty = false;
    if (tiktokUsernameInput.value !== (tiktok.username || "")) tiktokUsernameInput.value = tiktok.username || "";
  } else if (!creatorTikTokDraftDirty && document.activeElement !== tiktokUsernameInput) {
    if (tiktokUsernameInput.value !== (tiktok.username || "")) tiktokUsernameInput.value = tiktok.username || "";
  }
  const mode = creatorTikTokBusy ? "busy" : watching ? tiktok.live ? "live" : "waiting" : "idle";
  const label = creatorTikTokBusy
    ? creatorTikTokBusyAction === "disconnect" ? "Déconnexion…" : "Connexion…"
    : mode === "live" ? "Déconnecter" : mode === "waiting" ? "En attente du live" : "Connecter";
  tiktokControl.dataset.connectionState = mode;
  tiktokUsernameInput.disabled = !authenticated || watching || creatorTikTokBusy;
  tiktokConnectionButton.disabled = creatorTikTokBusy;
  tiktokConnectionButton.setAttribute("aria-busy", String(creatorTikTokBusy));
  tiktokConnectionButton.setAttribute("aria-label", label);
  tiktokConnectionButton.title = watching ? "Annuler la surveillance TikTok LIVE" : "Connecter ce compte TikTok LIVE";
  if (tiktokConnectionLabel.textContent !== label) tiktokConnectionLabel.textContent = label;
  const status = watching && !tiktok.live ? "En attente du live. Cliquez pour annuler la surveillance." : tiktok.live ? "LIVE détecté" : "Saisissez votre @ puis cliquez sur Connecter.";
  if (tiktokStatusLabel.textContent !== status) tiktokStatusLabel.textContent = status;
  tiktokStatusDot.className = `tiktok-status-dot status-${mode}`;
  const icon = document.getElementById("tiktok-connection-icon");
  if (icon.dataset.mode !== mode) {
    icon.dataset.mode = mode;
    icon.innerHTML = mode === "live" ? '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"></rect>'
      : mode === "waiting" || mode === "busy" ? '<path d="M5 5a10 10 0 0 1 14 14M8 8a6 6 0 0 1 8 8M2 2l20 20"></path><circle cx="12" cy="12" r="1"></circle>'
        : '<path d="M8 3v5M16 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"></path>';
  }
}

/** Un essai gratuit n’est pas encore un abonnement ; les accès offerts le sont. */
function creatorHasActiveSubscription() {
  const subscription = currentSubscription();
  return isAccountAuthenticated() && hasProAccess() && subscription.source !== "trial" && subscription.status !== "trial";
}

function syncCreatorTopbar() {
  // Keep the historic command node and handler for integrations, not a second live control.
  sessionButton.hidden = true;
  sessionButton.tabIndex = -1;
  syncCreatorTikTokControl();
  if(typeof scheduleAgencyIdentitySync==="function")scheduleAgencyIdentitySync();
  const authenticated = isAccountAuthenticated();
  const tiktok = tiktokMeta();
  const liveStatus = document.getElementById("topbar-live-status");
  liveStatus.hidden = !authenticated || (!snapshot.state.session.running && !tiktok.live);
  const liveAccount = document.getElementById("topbar-live-account");
  liveAccount.textContent = authenticated && tiktok.live && tiktok.username ? `@${tiktok.username}` : "";
  liveAccount.setAttribute("data-studio-user-content", "");
  const subscribed = creatorHasActiveSubscription();
  // The public upgrade price is always Pro, never the remembered/current account tier.
  const plan = (typeof agencySubscriptionPlans === "function" ? agencySubscriptionPlans() : SUBSCRIPTION_PLANS).find((entry) => entry.tier === "pro");
  const label = `Pro - ${new Intl.NumberFormat(studioLocale(), { style: "currency", currency: "EUR" }).format(plan?.price ?? 0)}`;
  const planLabel = document.getElementById("membership-popup-label");
  if (planLabel.textContent !== label) planLabel.textContent = label;
  const upgradeButton = document.getElementById("membership-popup-button");
  // A trial still offers a subscription; paid or gifted Pro keeps only account status.
  upgradeButton.hidden = subscribed || !canNavigateTo("membership");
  upgradeButton.closest(".creator-topbar-left").hidden = upgradeButton.hidden;
  document.getElementById("account-membership-button").hidden = !canNavigateTo("membership");
  if (typeof syncMembershipPopup === "function") syncMembershipPopup();
}

async function handleCreatorTikTokConnection() {
  if (!isAccountAuthenticated()) return openAccountLogin();
  if (creatorTikTokBusy) return;
  const tiktok = tiktokMeta();
  const uid = accountSession.uid;
  const username = normalizeCreatorTikTokUsername(tiktokUsernameInput.value);
  if (!tiktok.connected && !username) {
    const error = document.getElementById("tiktok-input-error");
    error.textContent = "Saisissez un nom d’utilisateur TikTok valide.";
    error.hidden = false;
    tiktokUsernameInput.setAttribute("aria-invalid", "true");
    tiktokUsernameInput.focus();
    applyStudioLanguage(tiktokControl);
    return;
  }
  clearCreatorTikTokError();
  creatorTikTokBusy = true;
  creatorTikTokBusyAction = tiktok.connected ? "disconnect" : "connect";
  syncCreatorTopbar();
  applyStudioLanguage(document.querySelector(".topbar"));
  try {
    if (tiktok.connected) {
      const next = await api.stopTikTok();
      if (isAccountAuthenticated() && accountSession.uid === uid) acceptSnapshot(next);
    } else {
      tiktokUsernameInput.value = username;
      if (username !== tiktok.username || !tiktok.connection) {
        // Keep the draft until persistence succeeds; a failed request must not restore the old @.
        creatorTikTokDraftDirty = true;
        const saved = await api.saveTikTok({ username });
        if (!isAccountAuthenticated() || accountSession.uid !== uid) return;
        creatorTikTokDraftDirty = false;
        acceptSnapshot(saved);
      } else creatorTikTokDraftDirty = false;
      if (!isAccountAuthenticated() || accountSession.uid !== uid) return;
      const next = await api.startTikTok();
      if (isAccountAuthenticated() && accountSession.uid === uid) acceptSnapshot(next);
    }
  } catch (error) {
    if (isAccountAuthenticated() && accountSession.uid === uid) {
      const errorNode = document.getElementById("tiktok-input-error");
      errorNode.textContent = error.message || "Connexion TikTok impossible.";
      errorNode.hidden = false;
      toast("Connexion TikTok impossible", errorNode.textContent, true);
    }
  } finally {
    creatorTikTokBusy = false;
    creatorTikTokBusyAction = "";
    render();
  }
}

initializeCreatorTopbar();
