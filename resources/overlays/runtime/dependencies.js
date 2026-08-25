"use strict";

/** Charge les bibliothèques lourdes uniquement pour la source qui les utilise. */

(function loadOverlayDependencies() {
  const view = new URLSearchParams(location.search).get("view") || "alerts";
  if (view !== "alerts") return;
  const script = document.createElement("script");
  script.src = "vendor/lottie-player.js";
  script.async = true;
  document.head.append(script);
})();
