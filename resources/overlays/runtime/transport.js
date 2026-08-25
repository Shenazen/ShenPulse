"use strict";

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
  event: addFeedEvent,
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
    hasMediaScreen
  });
}

window.addEventListener("resize", () => {
  if (viewName === "coin-jar" && coinJarDrops.length) startCoinJarPhysics();
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
  if (isCatalogPreview) return;
  if (relayChannel) {
    connectPublicRelay();
  } else {
    try {
      const response = await fetch(`/api/state?token=${encodeURIComponent(token)}`);
      if (response.ok) {
        applyRelayState(await response.json());
      }
    } catch {
      // The SSE retry loop keeps the overlay alive if the app restarts.
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
  const source = new EventSource(
    `/events?token=${encodeURIComponent(token)}&view=${encodeURIComponent(viewName)}`
  );
  source.addEventListener("access-revoked", () => {
    source.close();
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

function applyRelayState(state) {
  if (!state || typeof state !== "object") return;
  goals = Array.isArray(state.goals) ? state.goals : goals;
  hydrateOverlaySession(state);
  renderGoals();
}

let relayDocument = {};
let relayInitialized = false;
let lastRelayBatchId = "";
let lastRelayConfigurationSignature = "";

function connectPublicRelay() {
  if (isCatalogPreview) return;
  const source = new EventSource(
    `${relayDatabaseUrl}/publicOverlayRelay/${encodeURIComponent(
      relayChannel
    )}.json`
  );
  const handleMutation = (event, patch) => {
    try {
      const mutation = JSON.parse(event.data);
      relayDocument = applyFirebaseMutation(
        relayDocument,
        mutation.path || "/",
        mutation.data,
        patch
      );
      applyRelayConfiguration(relayDocument?.configurations);
      const batch = relayDocument?.lastBatch;
      if (!relayInitialized) {
        lastRelayBatchId = String(batch?.id || "");
        relayInitialized = true;
      } else if (batch?.id && batch.id !== lastRelayBatchId) {
        lastRelayBatchId = batch.id;
        if (relayDocument?.state) applyRelayState(relayDocument.state);
        for (const message of Array.isArray(batch.messages)
          ? batch.messages
          : Object.values(batch.messages || {})) {
          if (!currentViewAcceptsChannel(message?.channel, message?.payload)) {
            continue;
          }
          const handler = overlayChannels[message?.channel];
          if (typeof handler === "function") handler(message.payload || {});
        }
        return;
      }
      if (relayDocument?.state) applyRelayState(relayDocument.state);
    } catch {
      // Firebase reconnecte automatiquement le flux après une coupure réseau.
    }
  };
  source.addEventListener("put", (event) => handleMutation(event, false));
  source.addEventListener("patch", (event) => handleMutation(event, true));
  source.addEventListener("cancel", () => source.close());
  source.addEventListener("auth_revoked", () => source.close());
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
