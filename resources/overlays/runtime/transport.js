"use strict";

let overlayReadyRevision = 0;

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
    : null,
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
  match: typeof enqueueMatchPlayback === "function" ? enqueueMatchPlayback : null,
  wheel: typeof spinWheel === "function" ? spinWheel : null
};
for (const [channel, handler] of Object.entries(overlayChannels)) {
  if (typeof handler !== "function") delete overlayChannels[channel];
}
if (typeof hydrateOverlaySession === "function") overlayChannels["session-state"] = hydrateOverlaySession;
overlayChannels.bootstrap = applyRelayState;
overlayChannels.design = updatePreviewDesign;
overlayChannels.configuration = updateOverlayConfiguration;

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
  setTimeout(markOverlayReady, 1800);
  const localBootstrap = !isCatalogPreview && !relayChannel && !matchSourceBasePath
    ? connectLocalEventSource()
    : Promise.resolve();
  const designReady = setupOverlayDesign();
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
  bootstrap?.request?.then((documentValue) => {
    if (!documentValue || publicMatchRelayReady) return;
    publicMatchRelayDocument = documentValue;
    publicMatchRelayReady = true;
    synchronizePublicMatchSource();
  });
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
