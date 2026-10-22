"use strict";

let overlayReadyRevision = 0;
let localMatchContextReloadScheduled = false;

function waitForOverlayMedia(element) {
  if (!element) return Promise.resolve();
  if (element.tagName === "IMG") {
    if (element.complete) {
      return typeof element.decode === "function"
        ? element.decode().catch(() => {})
        : Promise.resolve();
    }
    return new Promise((resolve) => {
      element.addEventListener("load", resolve, { once: true });
      element.addEventListener("error", resolve, { once: true });
    });
  }
  if (element.tagName === "VIDEO") {
    if (element.readyState >= 2) return Promise.resolve();
    return new Promise((resolve) => {
      element.addEventListener("loadeddata", resolve, { once: true });
      element.addEventListener("error", resolve, { once: true });
    });
  }
  return Promise.resolve();
}

async function markOverlayReady() {
  const revision = ++overlayReadyRevision;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const criticalMedia = [
    ...activeView.querySelectorAll(".theme-frame:not([hidden]), .coin-jar-layer:not([hidden])")
  ];
  const matchVideo = viewName === "match" && matchName !== "player"
    ? document.getElementById("match-video")
    : null;
  if (matchVideo?.src) criticalMedia.push(matchVideo);
  const readiness = Promise.allSettled([
    document.fonts?.ready || Promise.resolve(),
    ...criticalMedia.map(waitForOverlayMedia)
  ]);
  await Promise.race([
    readiness,
    new Promise((resolve) => setTimeout(resolve, 2500))
  ]);
  if (revision !== overlayReadyRevision) return;
  document.documentElement.classList.remove("overlay-booting");
  if (window.parent !== window) {
    window.parent.postMessage(
      { source: "shenpulse-overlay-runtime", type: "ready" },
      "*"
    );
  }
}

/**
 * Routage des canaux, transport local et relais public.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

const overlayChannels = {
  // Contrats de routage : audio: (payload) => queueLivePlayback("audio", payload)
  // et tts: (payload) => queueLivePlayback("tts", payload).
  // Les widgets optionnels restent : "like-goal": updateLikeGoal,
  // "coin-jar": updateCoinJar et "win-counter": updateWinCounter.
  alert: typeof showAlert === "function" ? showAlert : null,
  audio: typeof queueLivePlayback === "function"
    ? (payload) => queueLivePlayback("audio", payload)
    : null,
  tts: typeof queueLivePlayback === "function"
    ? (payload) => queueLivePlayback("tts", payload)
    : null,
  event: typeof addFeedEvent === "function"
    ? (payload, context = {}) => addFeedEvent(payload, {
        skipInteractiveState: context.authoritativeState === true
      })
    : typeof receiveCoinJarGift === "function" ? receiveCoinJarGift : null,
  game: typeof addGameEffect === "function" ? addGameEffect : null,
  goal: typeof renderGoals === "function"
    ? (goal) => {
        const index = goals.findIndex((item) => item.id === goal.id);
        if (index >= 0) goals[index] = goal;
        else goals.push(goal);
        renderGoals();
      }
    : null,
  timer: typeof updateTimer === "function" ? updateTimer : null,
  "multiplier-timer": typeof updateMultiplierTimer === "function"
    ? updateMultiplierTimer
    : null,
  "like-goal": typeof updateLikeGoal === "function" ? updateLikeGoal : null,
  "coin-jar": typeof updateCoinJar === "function" ? updateCoinJar : null,
  "win-counter": typeof updateWinCounter === "function" ? updateWinCounter : null,
  // Le chargeur historique fournit le moteur canonique de façon asynchrone.
  // Ne pas capturer une fonction absente avant que sa promesse soit terminée.
  match: (payload) => typeof enqueueMatchPlayback === "function" ? enqueueMatchPlayback(payload) : false,
  "match-media": (payload) => {
    if (typeof playMatchMedia === "function") return playMatchMedia(payload);
    if (typeof setMatchPlaybackDiagnostic === "function") setMatchPlaybackDiagnostic("media-unavailable");
    return false;
  },
  "match-audio": (payload) => {
    if (typeof playMatchAudio === "function") return playMatchAudio(payload);
    if (typeof setMatchPlaybackDiagnostic === "function") setMatchPlaybackDiagnostic("audio-unavailable");
    return false;
  },
  "match-state": typeof hydrateMatchWidget === "function" ? hydrateMatchWidget : null,
  wheel: typeof spinWheel === "function" ? spinWheel : null
};
for (const [channel, handler] of Object.entries(overlayChannels)) {
  if (typeof handler !== "function") delete overlayChannels[channel];
}
if (typeof hydrateOverlaySession === "function") overlayChannels["session-state"] = hydrateOverlaySession;
overlayChannels.bootstrap = applyRelayState;
overlayChannels.design = updatePreviewDesign;
overlayChannels.configuration = updateOverlayConfiguration;
if (viewName === "scene") {
  for (const channel of ["alert", "audio", "tts", "event", "game", "goal", "timer",
    "multiplier-timer", "like-goal", "coin-jar", "win-counter", "wheel",
    "session-state", "configuration", "design"]) {
    overlayChannels[channel] = (payload) => dispatchSceneMessage(channel, payload);
  }
  overlayChannels.scene = hydrateScene;
}

function currentViewAcceptsChannel(channel, payload = {}) {
  if (channel === "bootstrap") return true;
  return overlayCatalog.acceptsChannel({
    view: viewName,
    channel,
    payload,
    screen: mediaScreen,
    matchName,
    leaderboardKind,
    hasMediaScreen
  });
}

window.addEventListener("resize", () => {
  if (
    viewName === "coin-jar" &&
    typeof coinJarDrops !== "undefined" &&
    coinJarDrops.length &&
    typeof startCoinJarPhysics === "function"
  ) {
    startCoinJarPhysics();
  }
});

window.addEventListener("message", (event) => {
  if (isSceneChild && event.source === window.parent && event.origin === location.origin &&
    event.data?.source === "shenpulse-scene") {
    if (!currentViewAcceptsChannel(event.data.channel, event.data.payload)) return;
    overlayChannels[event.data.channel]?.(event.data.payload || {});
    return;
  }
  if (
    !isCatalogPreview ||
    event.source !== window.parent ||
    event.data?.source !== "shenpulse-overlay-card"
  ) {
    return;
  }
  if (!currentViewAcceptsChannel(event.data.channel, event.data.payload)) return;
  const handler = overlayChannels[event.data.channel];
  if (typeof handler !== "function") return;
  handler(event.data.payload || {});
});

async function initialize() {
  // L'ancien bundle charge le même module de réactions, sans recopier le
  // moteur. Aucune souscription ne commence avant ses déclarations globales.
  if (viewName === "match" && globalThis.shenPulseMatchCompatibilityReady) {
    if (await globalThis.shenPulseMatchCompatibilityReady === false) {
      document.documentElement.dataset.overlayLoadError = "match-dependencies";
      document.documentElement.classList.remove("overlay-booting");
      return;
    }
  }
  startOverlayRuntimeVersionMonitor();
  // Les widgets hébergés utilisent exclusivement leur alias Matchs révocable.
  // Une URL générique avec le canal des autres overlays n'accorde aucun accès.
  if (viewName === "match-widget" && relayChannel && !isPublicMatchWidgetSource) {
    document.documentElement.hidden = true;
    if (typeof stopMatchWidget === "function") stopMatchWidget();
    return;
  }
  setTimeout(markOverlayReady, 1800);
  const localBootstrap = !isCatalogPreview && !relayChannel && !matchSourceBasePath
    && !isSceneChild
    ? connectLocalEventSource()
    : Promise.resolve();
  const designReady = setupOverlayDesign();
  if (isSceneChild) {
    await designReady;
    markOverlayReady();
    return;
  }
  if (typeof renderTimer === "function") renderTimer();
  if (
    isCatalogPreview &&
    timerAutoStart &&
    ["timer", "multiplier-timer"].includes(viewName)
  ) {
    timerConfigurationTicker = true;
    updateTimer({
      operation: "set",
      seconds: timerSeconds,
      label: overlayTitle || (viewName === "timer" ? "TEMPS RESTANT" : "BONUS ACTIF")
    });
  }
  if (isCatalogPreview) {
    await designReady;
    markOverlayReady();
    return;
  }
  if (relayChannel) {
    connectPublicRelay();
    await designReady;
    markOverlayReady();
  } else {
    try {
      if (matchSourceBasePath) {
        const response = await fetch(`${matchSourceBasePath}/state`, {
          cache: "no-store"
        });
        if (response.ok) applyRelayState(await response.json());
      } else {
        await localBootstrap;
      }
    } catch {
      // The SSE retry loop keeps the overlay alive if the app restarts.
    } finally {
      await designReady;
      markOverlayReady();
    }
  }
  if (
    timerAutoStart &&
    ["timer", "multiplier-timer"].includes(viewName)
  ) {
    updateTimer({
      operation: "set",
      seconds: timerSeconds,
      label: overlayTitle || (viewName === "timer" ? "TEMPS RESTANT" : "BONUS ACTIF")
    });
  }
  if (viewName === "my-actions" && typeof addMyAction === "function") {
    addMyAction({
      icon: "●",
      title: "Overlay connecté",
      detail: "En attente des événements ShenPulse"
    });
  }
  if (relayChannel || !matchSourceBasePath) return;
  connectAuthenticatedMatchEventSource();
}

/** Source locale authentifiée : seul un changement de LIVE/profil se reprend.
 * L'ancien flux et ses effets sont arrêtés avant un unique rechargement court.
 * La nouvelle navigation relit compte/capacité/droits, sans aucun replay.
 */
function connectAuthenticatedMatchEventSource() {
  const eventParameters = new URLSearchParams({ token, view: viewName });
  if (viewName === "leaderboard") {
    eventParameters.set("kind", leaderboardKind);
  }
  if (hasMediaScreen) {
    eventParameters.set("screen", String(mediaScreen));
  }
  const source = new EventSource(
    matchSourceBasePath
      ? `${matchSourceBasePath}/events`
      : `/events?${eventParameters.toString()}`
  );
  let stopped = false;
  source.addEventListener("access-revoked", (event) => {
    if (stopped) return;
    stopped = true;
    if (typeof stopMatchWidget === "function") stopMatchWidget();
    if (typeof stopMatchSourcePlayback === "function") stopMatchSourcePlayback();
    source.close();
    const video = document.getElementById("match-video");
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    document.documentElement.hidden = true;
    let reason = "";
    try { reason = JSON.parse(event.data || "{}").reason; } catch { /* Révocation malformée : arrêt définitif. */ }
    if (localMatchBridgeRoute && reason === "match-context-changed" && !localMatchContextReloadScheduled) {
      localMatchContextReloadScheduled = true;
      setTimeout(() => location.reload(), 250);
    }
  });
  for (const [channel, handler] of Object.entries(overlayChannels)) {
    source.addEventListener(channel, (event) => {
      try {
        if (stopped) return;
        const message = JSON.parse(event.data);
        if (!currentViewAcceptsChannel(channel, message.payload)) return;
        handler(message.payload);
      } catch {
        // Ignore malformed local payloads.
      }
    });
  }
}

function connectLocalEventSource() {
  const eventParameters = new URLSearchParams({ token, view: viewName });
  if (viewName === "leaderboard") {
    eventParameters.set("kind", leaderboardKind);
  }
  if (hasMediaScreen) {
    eventParameters.set("screen", String(mediaScreen));
  }
  const source = new EventSource(`/events?${eventParameters.toString()}`);
  let settleBootstrap;
  let settled = false;
  const bootstrapReady = new Promise((resolve) => {
    settleBootstrap = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
  });
  const timeout = setTimeout(settleBootstrap, 1200);
  source.addEventListener("access-revoked", () => {
    if (typeof stopMatchWidget === "function") stopMatchWidget();
    clearTimeout(timeout);
    settleBootstrap();
    source.close();
    document.documentElement.hidden = true;
  });
  for (const [channel, handler] of Object.entries(overlayChannels)) {
    source.addEventListener(channel, (event) => {
      try {
        const message = JSON.parse(event.data);
        if (!currentViewAcceptsChannel(channel, message.payload)) return;
        handler(message.payload);
        if (channel === "bootstrap") {
          clearTimeout(timeout);
          settleBootstrap();
        }
      } catch {
        // Ignore malformed local payloads.
      }
    });
  }
  source.addEventListener("error", settleBootstrap, { once: true });
  return bootstrapReady;
}

function applyRelayState(state, options = {}) {
  if (!state || typeof state !== "object") return;
  if (viewName === "match-widget") {
    if (typeof hydrateMatchWidget === "function") hydrateMatchWidget(state.matches || {});
    return;
  }
  if (viewName === "scene") {
    hydrateSceneState(state);
    return;
  }
  goals = Array.isArray(state.goals) ? state.goals : goals;
  if (typeof hydrateOverlaySession === "function") {
    hydrateOverlaySession(state, options);
  }
  if (viewName === "goals" && typeof renderGoals === "function") renderGoals();
}

let relayDocument = {};
let relayInitialized = false;
let lastRelayBatchId = "";
let lastRelayConfigurationSignature = "";
let publicMatchEventSource = null;
let publicMatchEventChannel = "";
let publicMatchWidgetLeaseTimer = null;
let publicMatchWidgetExpiresAtMs = 0;
let publicMatchWidgetSignature = "";
let publicMatchPlaybackInitialized = false;
let publicMatchPlaybackBatchId = "";
let publicMatchPlaybackContextId = "";
const PUBLIC_MATCH_WIDGET_LEASE_MS = 120_000;
const PUBLIC_RELAY_CACHE_PREFIX = "shenpulse-overlay-v2:";
const PUBLIC_RELAY_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function readPublicRelayCache(channel) {
  try {
    const value = JSON.parse(
      localStorage.getItem(`${PUBLIC_RELAY_CACHE_PREFIX}${channel}`) || "null"
    );
    if (
      !value ||
      Date.now() - Number(value.cachedAt || 0) > PUBLIC_RELAY_CACHE_MAX_AGE_MS ||
      !value.document ||
      typeof value.document !== "object"
    ) {
      return null;
    }
    return value.document;
  } catch {
    return null;
  }
}

function writePublicRelayCache(channel, documentValue) {
  try {
    localStorage.setItem(
      `${PUBLIC_RELAY_CACHE_PREFIX}${channel}`,
      JSON.stringify({
        cachedAt: Date.now(),
        document: {
          protocolVersion: documentValue?.protocolVersion || 0,
          configurations: documentValue?.configurations || {},
          state: documentValue?.state || {},
          lastBatch: documentValue?.lastBatch?.id
            ? { id: documentValue.lastBatch.id }
            : null
        }
      })
    );
  } catch {
    // Certains navigateurs OBS désactivent le stockage local : le flux reste direct.
  }
}

function connectPublicRelay() {
  if (isCatalogPreview) return;
  if (viewName === "match-widget" && !isPublicMatchWidgetSource) {
    document.documentElement.hidden = true;
    return;
  }
  if (isPublicMatchSource) {
    document.documentElement.hidden = true;
    connectPublicMatchAlias();
    return;
  }
  connectPublicRelayChannel(relayChannel);
}

function relayEventSource(channel) {
  return new EventSource(
    `${relayDatabaseUrl}/publicOverlayRelay/${encodeURIComponent(
      channel
    )}.json`
  );
}

function connectPublicRelayChannel(channel) {
  const bootstrap = globalThis.shenPulseRelayBootstrap?.channel === channel
    ? globalThis.shenPulseRelayBootstrap
    : null;
  const cachedDocument = bootstrap?.cachedDocument || readPublicRelayCache(channel);
  if (cachedDocument) {
    relayDocument = cachedDocument;
    applyRelayConfiguration(relayDocument.configurations);
    if (relayDocument.state) applyRelayState(relayDocument.state);
    lastRelayBatchId = String(relayDocument.lastBatch?.id || "");
    relayInitialized = true;
    markOverlayReady();
  }
  bootstrap?.request?.then((documentValue) => {
    if (!documentValue || relayInitialized) return;
    relayDocument = documentValue;
    applyRelayConfiguration(relayDocument.configurations);
    if (relayDocument.state) applyRelayState(relayDocument.state);
    lastRelayBatchId = String(relayDocument.lastBatch?.id || "");
    relayInitialized = true;
    writePublicRelayCache(channel, relayDocument);
    markOverlayReady();
  });
  const source = relayEventSource(channel);
  const handleMutation = (event, patch) => {
    try {
      const wasInitialized = relayInitialized;
      const mutation = JSON.parse(event.data);
      const mutationPath = String(mutation.path || "/");
      const mutationData = mutation.data;
      const mutationTouchesRelayState =
        mutationPath === "/state" ||
        mutationPath.startsWith("/state/") ||
        (mutationPath === "/" &&
          (!patch ||
            (mutationData &&
              typeof mutationData === "object" &&
              Object.prototype.hasOwnProperty.call(mutationData, "state"))));
      relayDocument = applyFirebaseMutation(
        relayDocument,
        mutationPath,
        mutationData,
        patch
      );
      applyRelayConfiguration(relayDocument?.configurations);
      const batch = relayDocument?.lastBatch;
      if (!relayInitialized) {
        lastRelayBatchId = String(batch?.id || "");
        relayInitialized = true;
      } else if (batch?.id && batch.id !== lastRelayBatchId) {
        lastRelayBatchId = batch.id;
        const frameState = batch.state || relayDocument?.state;
        if (frameState) applyRelayState(frameState, { animate: true });
        for (const message of Array.isArray(batch.messages)
          ? batch.messages
          : Object.values(batch.messages || {})) {
          if (!currentViewAcceptsChannel(message?.channel, message?.payload)) {
            continue;
          }
          const handler = overlayChannels[message?.channel];
          if (typeof handler === "function") {
            handler(message.payload || {}, {
              source: "public-relay",
              authoritativeState: Boolean(frameState)
            });
          }
        }
        writePublicRelayCache(channel, {
          ...relayDocument,
          state: frameState || relayDocument.state
        });
        markOverlayReady();
        return;
      }
      if (mutationTouchesRelayState && relayDocument?.state) {
        applyRelayState(relayDocument.state, { animate: wasInitialized });
      }
      writePublicRelayCache(channel, relayDocument);
      markOverlayReady();
    } catch {
      // Firebase reconnecte automatiquement le flux après une coupure réseau.
    }
  };
  source.addEventListener("put", (event) => handleMutation(event, false));
  source.addEventListener("patch", (event) => handleMutation(event, true));
  source.addEventListener("cancel", () => source.close());
  source.addEventListener("auth_revoked", () => source.close());
  return source;
}

function connectPublicMatchAlias() {
  const bootstrap = globalThis.shenPulseRelayBootstrap?.channel === relayChannel
    ? globalThis.shenPulseRelayBootstrap
    : null;
  let aliasMutationSeen = false;
  bootstrap?.request?.then((documentValue) => {
    if (!documentValue || publicMatchRelayReady || aliasMutationSeen) return;
    publicMatchRelayDocument = documentValue;
    publicMatchRelayReady = true;
    synchronizePublicMatchSource();
  });
  const source = relayEventSource(relayChannel);
  const handleMutation = (event, patch) => {
    try {
      const mutation = JSON.parse(event.data);
      aliasMutationSeen = true;
      publicMatchRelayDocument = applyFirebaseMutation(
        publicMatchRelayDocument,
        mutation.path || "/",
        mutation.data,
        patch
      );
      publicMatchRelayReady = true;
      synchronizePublicMatchSource();
    } catch {
      // Firebase reconnecte automatiquement le flux après une coupure réseau.
    }
  };
  const revoke = () => {
    aliasMutationSeen = true;
    source.close();
    publicMatchRelayDocument = {};
    publicMatchRelayReady = false;
    synchronizePublicMatchSource();
  };
  source.addEventListener("put", (event) => handleMutation(event, false));
  source.addEventListener("patch", (event) => handleMutation(event, true));
  source.addEventListener("cancel", revoke);
  source.addEventListener("auth_revoked", revoke);
  source.addEventListener("error", () => {
      // EventSource tentera la reconnexion, mais aucune donnée du dernier
      // accès autorisé ne reste affichée pendant la coupure.
      aliasMutationSeen = true;
      publicMatchRelayDocument = {};
      publicMatchRelayReady = false;
      synchronizePublicMatchSource();
  });
  window.addEventListener("pagehide", () => {
      source.close();
      if (isPublicMatchWidgetSource) clearPublicMatchWidget();
      else {
        publicMatchRelayDocument = {};
        publicMatchRelayReady = false;
        synchronizePublicMatchSource();
      }
    }, { once: true });
}

function clearPublicMatchWidget() {
  if (publicMatchWidgetLeaseTimer) clearTimeout(publicMatchWidgetLeaseTimer);
  publicMatchWidgetLeaseTimer = null;
  publicMatchWidgetExpiresAtMs = 0;
  publicMatchWidgetSignature = "";
  document.documentElement.hidden = true;
  if (typeof hydrateMatchWidget === "function") hydrateMatchWidget({});
  if (typeof stopMatchWidget === "function") stopMatchWidget();
}

function synchronizePublicMatchWidget() {
  const source = publicMatchRelayDocument?.matchSource || {};
  const presence = publicMatchRelayDocument?.presence || {};
  const matches = publicMatchRelayDocument?.state?.matches;
  const updatedAtMs = typeof presence.updatedAt === "string"
    ? Date.parse(presence.updatedAt) : NaN;
  const nowMs = Date.now();
  const expiresAtMs = updatedAtMs + PUBLIC_MATCH_WIDGET_LEASE_MS;
  const available = publicMatchRelayReady && presence.connected === true &&
    source.enabled === true && source.widgetsEnabled === true &&
    source.accountNumber === publicMatchAccountNumber &&
    Number.isFinite(updatedAtMs) && updatedAtMs <= nowMs + 15_000 &&
    expiresAtMs > nowMs && matches && typeof matches === "object" &&
    !Array.isArray(matches) && matches.config?.widgets?.[parameters.get("widget")] &&
    matches.session && typeof matches.session === "object";
  if (!available) {
    clearPublicMatchWidget();
    return;
  }
  document.documentElement.hidden = false;
  // Une mise à jour de compteur n'étend pas le bail du heartbeat. Un unique
  // timeout borné masque la source si l'application cesse de publier.
  if (expiresAtMs !== publicMatchWidgetExpiresAtMs) {
    if (publicMatchWidgetLeaseTimer) clearTimeout(publicMatchWidgetLeaseTimer);
    publicMatchWidgetExpiresAtMs = expiresAtMs;
    publicMatchWidgetLeaseTimer = setTimeout(synchronizePublicMatchSource,
      Math.max(1, expiresAtMs - nowMs));
  }
  const signature = JSON.stringify(matches);
  if (signature !== publicMatchWidgetSignature) {
    publicMatchWidgetSignature = signature;
    if (typeof hydrateMatchWidget === "function") hydrateMatchWidget(matches);
    markOverlayReady();
  }
}

function synchronizePublicMatchSource() {
  if (isPublicMatchWidgetSource) {
    synchronizePublicMatchWidget();
    return;
  }
  const source = publicMatchRelayDocument?.matchSource || {};
  const presence = publicMatchRelayDocument?.presence || {};
  const contextId = String(source.contextId || "");
  const updatedAtMs = typeof presence.updatedAt === "string" ? Date.parse(presence.updatedAt) : NaN;
  const expiresAtMs = updatedAtMs + PUBLIC_MATCH_WIDGET_LEASE_MS;
  const nowMs = Date.now();
  const available =
    publicMatchRelayReady &&
    presence.connected === true &&
    source.enabled === true && source.widgetsEnabled === true &&
    source.accountNumber === publicMatchAccountNumber &&
    /^[a-f0-9]{64}$/.test(contextId) &&
    Number.isFinite(updatedAtMs) && updatedAtMs <= nowMs + 15_000 && expiresAtMs > nowMs;
  document.documentElement.hidden = !available;
  if (!available) {
    if (publicMatchWidgetLeaseTimer) clearTimeout(publicMatchWidgetLeaseTimer);
    publicMatchWidgetLeaseTimer = null;
    publicMatchWidgetExpiresAtMs = 0;
    publicMatchPlaybackInitialized = false;
    publicMatchPlaybackBatchId = "";
    publicMatchPlaybackContextId = "";
    publicMatchEventSource?.close();
    publicMatchEventSource = null;
    publicMatchEventChannel = "";
    if (typeof stopMatchSourcePlayback === "function") stopMatchSourcePlayback();
    else finishMatchPlayback();
    return;
  }
  if (expiresAtMs !== publicMatchWidgetExpiresAtMs) {
    if (publicMatchWidgetLeaseTimer) clearTimeout(publicMatchWidgetLeaseTimer);
    publicMatchWidgetExpiresAtMs = expiresAtMs;
    publicMatchWidgetLeaseTimer = setTimeout(synchronizePublicMatchSource,
      Math.max(1, expiresAtMs - nowMs));
  }
  if (publicMatchPlaybackContextId && publicMatchPlaybackContextId !== contextId) {
    // Les droits peuvent rester actifs après un changement de profil ou LIVE.
    // Une animation, un ticket, un média ou une file sonore du contexte quitté
    // ne doit pas rester à l'écran ni reprendre sur la nouvelle session.
    if (typeof stopMatchSourcePlayback === "function") stopMatchSourcePlayback();
    else finishMatchPlayback();
    publicMatchPlaybackBatchId = "";
    matchPlaybackRequestIds.clear();
  }
  publicMatchPlaybackContextId = contextId;
  // Le lecteur utilise exclusivement l'alias Matchs. Un score/heartbeat ne
  // souscrit plus le relais général et ne rejoue jamais une animation passée.
  const batch = publicMatchRelayDocument?.lastBatch;
  const batchId = String(batch?.id || "");
  if (!publicMatchPlaybackInitialized) {
    publicMatchPlaybackInitialized = true;
    publicMatchPlaybackBatchId = batch?.contextId === contextId ? batchId : "";
    return;
  }
  if (batch?.contextId !== contextId) return;
  if (!batchId || batchId === publicMatchPlaybackBatchId) return;
  publicMatchPlaybackBatchId = batchId;
  const messages = Array.isArray(batch.messages) ? batch.messages : Object.values(batch.messages || {});
  for (const message of messages.slice(-64)) {
    if (!["match", "match-media", "match-audio"].includes(message?.channel)) continue;
    const emittedAtMs = Date.parse(String(message.timestamp || batch.timestamp || ""));
    if (!Number.isFinite(emittedAtMs) || nowMs - emittedAtMs > 15000 || emittedAtMs > nowMs + 15000) continue;
    if (!currentViewAcceptsChannel(message.channel, message.payload)) continue;
    overlayChannels[message.channel]?.(message.payload || {});
  }
}

function applyFirebaseMutation(documentValue, path, data, patch) {
  const segments = String(path || "/")
    .split("/")
    .filter(Boolean);
  if (!segments.length) {
    if (
      patch &&
      documentValue &&
      typeof documentValue === "object" &&
      data &&
      typeof data === "object"
    ) {
      return { ...documentValue, ...data };
    }
    return data && typeof data === "object" ? data : {};
  }
  const root =
    documentValue && typeof documentValue === "object"
      ? documentValue
      : {};
  let cursor = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index];
    if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
    cursor = cursor[key];
  }
  const key = segments.at(-1);
  if (data === null) {
    delete cursor[key];
  } else if (
    patch &&
    cursor[key] &&
    typeof cursor[key] === "object" &&
    data &&
    typeof data === "object"
  ) {
    cursor[key] = { ...cursor[key], ...data };
  } else {
    cursor[key] = data;
  }
  return root;
}

initialize();
