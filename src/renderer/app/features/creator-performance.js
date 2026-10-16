"use strict";

/** Regroupe les rafales d'événements et ne reconstruit que la page concernée. */
let creatorRenderScheduled = false;
let creatorRenderNeedsContent = false;
let creatorRenderNeedsDashboard = false;
let creatorRenderNeedsUsers = false;
let creatorRenderNeedsMatches = false;
let creatorWindowVisible = true;
let creatorRenderHandle = null;
let creatorRenderUsesAnimationFrame = false;
let creatorDeferredSnapshot = null;

function rendererVisualsActive() {
  return creatorWindowVisible && document.visibilityState !== "hidden";
}

function synchronizeRendererVisibility() {
  if (typeof synchronizeOverlayAssetWarmup === "function") synchronizeOverlayAssetWarmup();
  if (typeof synchronizeCreatorMusicPolling === "function") synchronizeCreatorMusicPolling();
  if (!rendererVisualsActive()) {
    if (creatorRenderHandle !== null) {
      if (creatorRenderUsesAnimationFrame) window.cancelAnimationFrame?.(creatorRenderHandle);
      else clearTimeout(creatorRenderHandle);
    }
    creatorRenderHandle = null;
    creatorRenderScheduled = false;
    // These are visual previews only, never the LIVE transport or playback stage.
    suspendOverlayRuntimePreviews();
    return;
  }
  const previous = creatorDeferredSnapshot;
  creatorDeferredSnapshot = null;
  if (typeof updateAllGiftPickerSelections === "function") updateAllGiftPickerSelections();
  if (typeof refreshGiftVisuals === "function") refreshGiftVisuals();
  if (previous && snapshot) refreshRendererStateComparison(previous, snapshot);
  resumeOverlayRuntimePreviews();
  scheduleRendererRefresh({ dashboard: currentPage === "dashboard", users: currentPage === "users", matches: currentPage === "matches" });
}

function setRendererWindowVisibility(visible) {
  if (creatorWindowVisible === visible) return;
  creatorWindowVisible = visible;
  synchronizeRendererVisibility();
}

function scheduleRendererRefresh({ redraw = false, dashboard = false, users = false, matches = false } = {}) {
  creatorRenderNeedsContent ||= redraw;
  creatorRenderNeedsDashboard ||= dashboard;
  creatorRenderNeedsUsers ||= users;
  creatorRenderNeedsMatches ||= matches;
  if (creatorRenderScheduled || !rendererVisualsActive()) return;
  creatorRenderScheduled = true;
  const lightMode = typeof studioLightMode !== "undefined" && studioLightMode;
  creatorRenderUsesAnimationFrame = !lightMode && typeof window.requestAnimationFrame === "function";
  const schedule = lightMode || typeof window.requestAnimationFrame !== "function"
    ? (callback) => setTimeout(callback, lightMode ? 100 : 120)
    : (callback) => window.requestAnimationFrame(callback);
  creatorRenderHandle = schedule(() => {
    creatorRenderHandle = null;
    creatorRenderScheduled = false;
    // A queued frame may race with a native minimize/hide notification.
    if (!rendererVisualsActive()) return;
    const redraw = creatorRenderNeedsContent;
    const dashboard = creatorRenderNeedsDashboard;
    const users = creatorRenderNeedsUsers;
    const matches = creatorRenderNeedsMatches;
    creatorRenderNeedsContent = false;
    creatorRenderNeedsDashboard = false;
    creatorRenderNeedsUsers = false;
    creatorRenderNeedsMatches = false;
    if (!snapshot) return;
    if (redraw) render();
    else {
      if (dashboard && !syncDashboardRuntime() && currentPage === "dashboard") render();
      if (users && !syncCreatorUsersRuntime() && currentPage === "users") render();
      if (matches && currentPage === "matches" && (typeof syncCreatorMatchesRuntime !== "function" || !syncCreatorMatchesRuntime())) render();
      renderNavigation();
      syncChrome();
      if (currentPage === "overlays") syncPublicOverlayRelayStatus();
      if (typeof applyStudioLanguage === "function") {
        applyStudioLanguage(navigation);
        applyStudioLanguage(document.querySelector(".topbar"));
        if (dashboard || users || matches) applyStudioLanguage(content);
      }
    }
  });
}

function creatorPageStateSignature(value, page = currentPage) {
  return JSON.stringify(creatorPageStateParts(value, page));
}

function creatorPageDataChanged(previous, next, page = currentPage) {
  const before = creatorPageStateParts(previous, page);
  const after = creatorPageStateParts(next, page);
  if (before.length === after.length && before.every((part, index) => part === after[index])) return false;
  return JSON.stringify(before) !== JSON.stringify(after);
}

function creatorPageStateParts(value, page = currentPage) {
  const state = value?.state || {};
  const urls = [value?.overlayUrls, value?.localOverlayUrls, value?.publicOverlayRelay, value?.timerRuntime];
  const access = [state.commerce, state.settings?.account?.uid, state.settings?.siteVisibility];
  switch (page) {
    case "home":
      // L’annuaire se met à jour seul ; sans galerie, les changements du catalogue
      // ne doivent plus reconstruire les illustrations fixes de l’accueil.
      return access;
    case "dashboard":
      return [state.session, state.statistics?.liveSession, state.statistics?.sessionEvents, state.statistics?.sessionActions, state.statistics?.sessionLikes, ShenPulseLiveStatistics.uniqueViewerCount(state.statistics), state.connections, state.overlaySession?.leaderboards?.donors, (state.overlaySession?.recentEvents || []).slice(0, 6), (state.activity || []).slice(0, 6)];
    case "users":
      return [state.session?.startedAt, ShenPulseLiveStatistics.uniqueViewerCount(state.statistics), state.statistics?.sessionEvents, state.overlaySession?.startedAt, state.overlaySession?.updatedAt, state.overlaySession?.leaderboards];
    case "actions":
    case "rules":
      return [state.rules, state.profiles, state.session?.profileId, state.timers, ...access, ...urls];
    case "sounds":
    case "voice":
    case "music":
      return [state.rules, state.session?.profileId, state.settings?.tts, state.settings?.spotify, state.customSounds, ...access, ...urls];
    case "studio":
      return [state.session?.game, value?.packs, ...access];
    case "connections":
      // Les audiences/lastCheckedAt ne modifient pas la configuration des
      // connecteurs : éviter de remonter la bannière à chaque mise à jour LIVE.
      return [(state.connections || []).map(({ id, name, type, enabled, status, liveStatus, config }) => ({ id, name, type, enabled, status, liveStatus, config })),
        state.settings?.tiktok?.username, state.settings?.tiktok?.chat,
        state.settings?.kick?.clientId, state.settings?.kick?.webhookUrl,
        state.settings?.kick?.account, state.settings?.kick?.error, ...access];
    case "activity":
      return [state.activity];
    case "membership":
      return [state.settings?.account, state.commerce];
    case "commands":
      // Le journal est rafraîchi séparément : un message ne remonte pas la bannière.
      // Les commandes n'affichent plus les capacités d'envoi de messages :
      // seuls leurs effets et les références disponibles modifient les cartes.
      return [state.commands, state.session?.profileId,
        state.rules, state.settings?.overlayConfigs?.wheel?.wheels,
        (state.profiles || []).find((profile) => profile.id === state.session?.profileId)?.enabledRuleIds,
        ...access];
    case "matches":
      // Les scores sont rafraîchis séparément, sans remonter les formulaires.
      return [state.matchSession, state.settings?.matches, state.session?.profileId, state.rules, ...access, ...urls];
    case "goals":
      return [state.goals, ...access];
    case "controllers":
      return [state.settings?.controllers, state.rules, state.profiles, ...access];
    case "settings":
      return [state.settings, ...access];
    case "games":
      return [state.game, state.session?.game, value?.packs, ...access, ...urls];
    case "overlays":
      return [state.settings?.overlayConfigs, state.settings?.overlayScene, ...access, ...urls];
    case "irl":
      return [state.settings?.irl, state.rules, ...access];
    default:
      return [];
  }
}
