"use strict";

(function exposeManifest(root, factory) {
  const isCommonJs = typeof module !== "undefined" && module.exports;
  const shared = isCommonJs ? require("./shared") : root.ShenPulseOverlayShared;
  const manifest = factory(shared);
  if (isCommonJs) module.exports = manifest;
  else (root.ShenPulseOverlayManifests ||= []).push(manifest);
})(typeof globalThis === "undefined" ? this : globalThis, (shared) => ({
  definition: {
    key: "timer",
    name: "Timer",
    description: "Compte à rebours personnalisable avec 13 designs illustrés.",
    category: "counters",
    icon: "▷",
    route: { view: "timer" },
    parameter: "theme",
    options: shared.themes.filter(([theme]) => theme !== "classic"),
    defaultOption: "gta",
    previewKind: "timer",
    sourceSize: [900, 360],
    settingsProfile: "timer"
  },
  defaults: {
    title: "TEMPS RESTANT",
    theme: "gta",
    seconds: 300,
    completionActionId: "",
    showHours: true,
    showGoal: true,
    timerTitleScale: 100,
    timerValueScale: 100,
    timerTitleColor: "#ffffff",
    timerValueColor: "#ffffff",
    timerAutoStart: false,
    incrementShortcut: "Alt+W, Alt+ArrowUp",
    decrementShortcut: "Alt+S, Alt+ArrowDown",
    resetShortcut: "Alt+R, Alt+0"
  },
  settings: [
    "title", "theme", "seconds", "completionActionId", "showHours", "showGoal",
    "timerTitleScale", "timerValueScale", "timerTitleColor", "timerValueColor", "timerAutoStart",
    "incrementShortcut", "decrementShortcut", "resetShortcut"
  ],
  parameters: {
    seconds: "seconds",
    showHours: "showHours",
    timerTitleScale: "timerTitleScale",
    timerValueScale: "timerValueScale",
    timerTitleColor: "timerTitleColor",
    timerValueColor: "timerValueColor",
    timerAutoStart: "timerAutoStart"
  }
}));
