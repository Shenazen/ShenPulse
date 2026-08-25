"use strict";

(function exposeManifest(root, factory) {
  const isCommonJs = typeof module !== "undefined" && module.exports;
  const shared = isCommonJs ? require("./shared") : root.ShenPulseOverlayShared;
  const manifest = factory(shared);
  if (isCommonJs) module.exports = manifest;
  else (root.ShenPulseOverlayManifests ||= []).push(manifest);
})(typeof globalThis === "undefined" ? this : globalThis, (shared) => ({
  definition: {
    key: "multiplierTimer",
    name: "Timer multiplicateur",
    description: "Compte à rebours indépendant affichant un multiplicateur X2 à X5.",
    category: "counters",
    icon: "×2",
    route: { view: "multiplier-timer" },
    parameter: "theme",
    options: shared.themes,
    defaultOption: "gta",
    previewView: "multiplier-timer",
    previewKind: "timer",
    sourceSize: [900, 360],
    settingsProfile: "multiplierTimer",
    requiresPro: true
  },
  defaults: {
    title: "BONUS ACTIF",
    theme: "gta",
    seconds: 120,
    multiplier: 2,
    showHours: false,
    showGoal: true,
    timerTitleScale: 100,
    timerValueScale: 100,
    timerAutoStart: false
  },
  settings: [
    "title", "theme", "seconds", "multiplier", "showHours", "showGoal",
    "timerTitleScale", "timerValueScale", "timerAutoStart"
  ],
  parameters: {
    seconds: "seconds",
    multiplier: "multiplier",
    showHours: "showHours",
    timerTitleScale: "timerTitleScale",
    timerValueScale: "timerValueScale",
    timerAutoStart: "timerAutoStart"
  }
}));
