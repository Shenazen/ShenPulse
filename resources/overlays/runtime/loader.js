"use strict";

/**
 * Charge uniquement le manifeste et le moteur nécessaires à la source active.
 * Les anciennes sources chargeaient tous les widgets, même pour un simple
 * compteur. OBS télécharge et compile ainsi beaucoup moins de JavaScript.
 */
(async function loadActiveOverlayRuntime() {
  const VERSION = "1.0.16-beta1";
  const query = new URLSearchParams(location.search);
  const isMatchRoute = /^\/(?:match|m)\//i.test(location.pathname);
  const view = isMatchRoute ? "match" : query.get("view") || "alerts";
  const leaderboardManifest = query.get("kind") === "tappers"
    ? "top-tappers"
    : "top-donors";
  const manifestByView = {
    "my-actions": "my-actions",
    game: "game",
    "like-goal": "like-goal",
    leaderboard: leaderboardManifest,
    "coin-jar": "coin-jar",
    timer: "timer",
    "multiplier-timer": "multiplier-timer",
    "win-counter": "win-counter",
    wheel: "wheel"
  };

  globalThis.ShenPulseOverlayManifests = [];
  globalThis.shenPulseOverlayPerformance = {
    startedAt: performance.now(),
    view
  };

  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${source}?v=${VERSION}`;
      script.async = false;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error(
        `Impossible de charger ${source}`
      )), { once: true });
      document.body.appendChild(script);
    });
  }

  const scripts = ["catalog/shared.js"];
  if (manifestByView[view]) scripts.push(`catalog/${manifestByView[view]}.js`);
  scripts.push("catalog/matches.js", "overlay-catalog.js", "like-goal-policy.js");

  if (view === "wheel") scripts.push("wheel-layout.js");
  if (view === "coin-jar") scripts.push("coin-jar-physics.js");
  if (view === "match") scripts.push("match-playback-queue.js");

  scripts.push("runtime/configuration.js", "runtime/design.js");
  if (["alerts", "my-actions", "goals", "like-goal", "feed", "leaderboard"].includes(view)) {
    scripts.push("runtime/alerts-feed.js", "runtime/session.js");
  } else if (["game", "coin-jar", "timer", "multiplier-timer", "win-counter"].includes(view)) {
    scripts.push("runtime/widgets.js");
  } else {
    scripts.push("runtime/widgets.js", "runtime/wheel-match.js");
  }
  scripts.push("runtime/transport.js");

  try {
    for (const source of scripts) await loadScript(source);
    globalThis.shenPulseOverlayPerformance.modulesReadyAt = performance.now();
  } catch (error) {
    console.error("[ShenPulse overlay]", error);
    document.documentElement.classList.remove("overlay-booting");
    document.documentElement.dataset.overlayLoadError = "true";
  }
})();
