"use strict";

/**
 * Charge uniquement le manifeste et le moteur nécessaires à la source active.
 * Les anciennes sources chargeaient tous les widgets, même pour un simple
 * compteur. OBS télécharge et compile ainsi beaucoup moins de JavaScript.
 */
(async function loadActiveOverlayRuntime() {
  const VERSION = "2.0.2-overlay1";
  const query = new URLSearchParams(location.search);
  if (globalThis.shenPulseMatchLocalEntry) {
    // Une entrée Studio explicite ne démarre pas un second lecteur Firebase,
    // ni un effet de secours pendant sa navigation ou en cas d'échec.
    await globalThis.shenPulseMatchLocalEntry.ready;
    return;
  }
  const isMatchRoute = /^\/(?:match|match-bridge|m)\//i.test(location.pathname);
  const isPublicWidgetRoute = /^\/m\//i.test(location.pathname) && query.has("widget");
  // Une requête widget inconnue reste un widget vide ; elle ne doit jamais
  // devenir un lecteur d'animations par simple repli du routage.
  const view = isPublicWidgetRoute ? "match-widget"
    : isMatchRoute ? "match" : query.get("view") || "alerts";
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

  function loadScripts(sources) {
    const pendingScripts = sources.map((source) => {
      const script = document.createElement("script");
      script.src = `${source}?v=${VERSION}`;
      script.async = false;
      const completion = new Promise((resolve, reject) => {
        script.addEventListener("load", resolve, { once: true });
        script.addEventListener("error", () => reject(new Error(
          `Impossible de charger ${source}`
        )), { once: true });
      });
      return { completion, script };
    });
    // Les scripts dynamiques avec async=false s'executent dans leur ordre
    // d'insertion, tout en etant telecharges en parallele par Chromium.
    for (const { script } of pendingScripts) {
      document.body.appendChild(script);
    }
    return Promise.all(pendingScripts.map(({ completion }) => completion));
  }

  const scripts = ["catalog/shared.js"];
  if (view === "scene") {
    scripts.push(...["my-actions", "game", "like-goal", "top-donors", "top-tappers",
      "coin-jar", "timer", "multiplier-timer", "win-counter", "wheel"]
      .map((name) => `catalog/${name}.js`));
  }
  if (manifestByView[view]) scripts.push(`catalog/${manifestByView[view]}.js`);
  scripts.push("catalog/matches.js", "overlay-catalog.js", "like-goal-policy.js");
  if (view === "scene") scripts.push("scene-layout.js", "runtime/scene.js");

  if (view === "wheel") scripts.push("wheel-layout.js");
  if (view === "coin-jar") scripts.push("coin-jar-physics.js");
  if (view === "match") scripts.push("match-playback-queue.js");
  if (view === "match") {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = `styles/match-player.css?v=${VERSION}`;
    document.head.appendChild(stylesheet);
  }
  if (view === "match-widget") {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = `styles/match-widgets.css?v=${VERSION}`;
    document.head.appendChild(stylesheet);
  }

  scripts.push("runtime/configuration.js", "runtime/design.js");
  if (["alerts", "my-actions", "goals", "like-goal", "feed", "leaderboard"].includes(view)) {
    scripts.push("runtime/alerts-feed.js");
  }
  const widgetModules = {
    game: ["game"], "coin-jar": ["coin-jar"],
    timer: ["timers"], "multiplier-timer": ["timers"],
    "win-counter": ["win-counter"], wheel: ["wheel-design", "wheel-animation"],
    match: ["match-compatible", "match-audio", "match-reactions", "match-progress", "match-preview", "match"], "match-widget": ["match-widgets"]
  };
  scripts.push(...(widgetModules[view] || []).map((name) => `runtime/widgets/${name}.js`));
  if (view !== "scene") scripts.push("runtime/session.js");
  scripts.push("runtime/transport.js");

  try {
    await loadScripts(scripts);
    globalThis.shenPulseOverlayPerformance.modulesReadyAt = performance.now();
  } catch (error) {
    console.error("[ShenPulse overlay]", error);
    document.documentElement.classList.remove("overlay-booting");
    document.documentElement.dataset.overlayLoadError = "true";
  }
})();
