"use strict";

/** Ancien point d'entrée wheel-match : réutilise les moteurs canoniques.
 * Téléchargements parallèles, exécution ordonnée par async=false. Le transport
 * attend le résultat avant tout abonnement ; un échec reste explicite, borné,
 * sans lecture de secours ni reprise artificielle d'un ancien événement.
 */
(function loadLegacyMatchReactions() {
  if (typeof document === "undefined" || typeof viewName !== "string" ||
    viewName !== "match") return;
  if (globalThis.shenPulseMatchCompatibilityReady) return;
  const current = new URL(document.currentScript?.src || "runtime/wheel-match.js", document.baseURI);
  const modules = [
    ["match-compatible", typeof startMatchCompatiblePlayback === "function" && typeof finishMatchCompatiblePlayback === "function"],
    ["match-progress", typeof globalThis.MatchVideoProgress?.watch === "function"],
    ["match-audio", typeof playMatchVideo === "function" && typeof stopMatchVideoAudio === "function"],
    ["match-reactions", typeof playMatchMedia === "function" && typeof playMatchAudio === "function"],
    ["match-preview", typeof startProtectedMatchPreview === "function"],
    ["match", typeof setupMatch === "function" && typeof enqueueMatchPlayback === "function"]
  ].filter(([, available]) => !available).map(([name]) => name);
  if (!modules.length) return;
  globalThis.shenPulseMatchCompatibilityReady = Promise.all(modules.map((name) => {
    const script = document.createElement("script");
    const target = new URL(`widgets/${name}.js`, current);
    target.search = current.search;
    script.src = target.toString();
    script.async = false;
    const completion = new Promise((resolve) => {
      const deadline = setTimeout(() => resolve(false), 4000);
      script.addEventListener("load", () => { clearTimeout(deadline); resolve(true); }, { once: true });
      script.addEventListener("error", () => { clearTimeout(deadline); resolve(false); }, { once: true });
    });
    document.head.appendChild(script);
    return completion;
  })).then((results) => {
    const ready = results.every(Boolean);
    if (!ready) document.documentElement.dataset.overlayLoadError = "match-runtime-unavailable";
    return ready;
  });
})();

