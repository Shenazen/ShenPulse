"use strict";

function markOverlayReady() {
  const reveal = () => document.documentElement.classList.remove("overlay-booting");
  const fontReadiness = document.fonts?.ready;
  if (fontReadiness && typeof fontReadiness.then === "function") {
    fontReadiness.then(reveal, reveal);
    return;
  }
  reveal();
}

/**
 * Routage des canaux, transport local et relais public.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

const overlayChannels = {
  alert: showAlert,
  audio: (payload) => queueLivePlayback("audio", payload),
  tts: (payload) => queueLivePlayback("tts", payload),
  event: (payload, context = {}) => addFeedEvent(payload, {
    skipInteractiveState: context.authoritativeState === true
  }),
  game: addGameEffect,
  goal: (goal) => {
    const index = goals.findIndex((item) => item.id === goal.id);
    if (index >= 0) goals[index] = goal;
    else goals.push(goal);
    renderGoals();
  },
  timer: updateTimer,
  "multiplier-timer": updateMultiplierTimer,
  "like-goal": updateLikeGoal,
  "coin-jar": updateCoinJar,
  "win-counter": updateWinCounter,
  match: enqueueMatchPlayback,
  wheel: spinWheel
};
overlayChannels["session-state"] = hydrateOverlaySession;
overlayChannels.design = updatePreviewDesign;
overlayChannels.configuration = updateOverlayConfiguration;

function currentViewAcceptsChannel(channel, payload = {}) {
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
  if (viewName === "coin-jar" && coinJarDrops.length) startCoinJarPhysics();
});

window.addEventListener("message", (event) => {
  if (forwardNativeOverlayShellMessage(event)) return;
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
  startOverlayRuntimeVersionMonitor();
  if (mountNativeOverlayShell(viewName, overlayCatalog)) return;
  setTimeout(markOverlayReady, 1800);
  setupOverlayDesign();
  renderTimer();
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
    markOverlayReady();
    return;
  }
  if (relayChannel) {
    connectPublicRelay();
  } else {
    try {
      const stateUrl = matchSourceBasePath
        ? `${matchSourceBasePath}/state`
        : `/api/state?token=${encodeURIComponent(token)}`;
      const response = await fetch(stateUrl, { cache: "no-store" });
      if (response.ok) {
        applyRelayState(await response.json());
      }
    } catch {
      // The SSE retry loop keeps the overlay alive if the app restarts.
    } finally {
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
  addMyAction({
    icon: "●",
    title: "Overlay connecté",
    detail: "En attente des événements ShenPulse"
  });
  if (relayChannel) return;
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
  source.addEventListener("access-revoked", () => {
    source.close();
    const video = document.getElementById("match-video");
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    document.documentElement.hidden = true;
  });
  for (const [channel, handler] of Object.entries(overlayChannels)) {
    source.addEventListener(channel, (event) => {
      try {
        const message = JSON.parse(event.data);
        if (!currentViewAcceptsChannel(channel, message.payload)) return;
        handler(message.payload);
      } catch {
        // Ignore malformed local payloads.
      }
    });
  }
}

function applyRelayState(state, options = {}) {
  if (!state || typeof state !== "object") return;
  goals = Array.isArray(state.goals) ? state.goals : goals;
  hydrateOverlaySession(state, options);
  if (viewName === "goals") renderGoals();
}

let relayDocument = {};
let relayInitialized = false;
let lastRelayBatchId = "";
let lastRelayConfigurationSignature = "";
let publicMatchEventSource = null;
let publicMatchEventChannel = "";
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
  const cachedDocument = readPublicRelayCache(channel);
  if (cachedDocument) {
    relayDocument = cachedDocument;
    applyRelayConfiguration(relayDocument.configurations);
    if (relayDocument.state) applyRelayState(relayDocument.state);
    lastRelayBatchId = String(relayDocument.lastBatch?.id || "");
    relayInitialized = true;
    markOverlayReady();
  }
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
  const source = relayEventSource(relayChannel);
  const handleMutation = (event, patch) => {
    try {
      const mutation = JSON.parse(event.data);
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
    source.close();
    publicMatchRelayDocument = {};
    publicMatchRelayReady = false;
    synchronizePublicMatchSource();
  };
  source.addEventListener("put", (event) => handleMutation(event, false));
  source.addEventListener("patch", (event) => handleMutation(event, true));
  source.addEventListener("cancel", revoke);
  source.addEventListener("auth_revoked", revoke);
}

function synchronizePublicMatchSource() {
  const source = publicMatchRelayDocument?.matchSource || {};
  const sourceChannel = String(
    publicMatchRelayDocument?.sourceChannel || ""
  );
  const available =
    publicMatchRelayReady &&
    publicMatchRelayDocument?.presence?.connected === true &&
    source.enabled === true &&
    source.accountNumber === publicMatchAccountNumber &&
    Number.isInteger(Number(source.localPort)) &&
    Number(source.localPort) >= 1 &&
    Number(source.localPort) <= 65_535 &&
    /^[A-Za-z0-9_-]{24,128}$/.test(sourceChannel);
  document.documentElement.hidden = !available;
  if (!available) {
    publicMatchEventSource?.close();
    publicMatchEventSource = null;
    publicMatchEventChannel = "";
    finishMatchPlayback();
    return;
  }
  if (publicMatchEventChannel === sourceChannel) return;
  publicMatchEventSource?.close();
  relayDocument = {};
  relayInitialized = false;
  lastRelayBatchId = "";
  publicMatchEventChannel = sourceChannel;
  publicMatchEventSource = connectPublicRelayChannel(sourceChannel);
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
