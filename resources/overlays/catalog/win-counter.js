"use strict";

(function exposeManifest(root, factory) {
  const isCommonJs = typeof module !== "undefined" && module.exports;
  const shared = isCommonJs ? require("./shared") : root.ShenPulseOverlayShared;
  const manifest = factory(shared);
  if (isCommonJs) module.exports = manifest;
  else (root.ShenPulseOverlayManifests ||= []).push(manifest);
})(typeof globalThis === "undefined" ? this : globalThis, (shared) => ({
  definition: {
    key: "winCounter",
    name: "Compteur de wins",
    description: "Compteur de victoires avec objectif et 13 designs illustrés.",
    category: "counters",
    icon: "W",
    route: { view: "win-counter" },
    parameter: "theme",
    options: shared.themes.filter(([theme]) => theme !== "classic"),
    defaultOption: "gta",
    previewView: "win-counter",
    previewKind: "win-counter",
    sourceSize: [720, 520],
    settingsProfile: "winCounter",
    requiresPro: true
  },
  defaults: {
    title: "WIN",
    theme: "gta",
    current: 0,
    target: 20,
    showGoal: false,
    allowNegative: true,
    winCounterLabelColorNegative: "#ff4f6d",
    winCounterLabelColorNeutral: "#f8fafc",
    winCounterLabelColorPositive: "#31ff74",
    winCounterTitleColor: "#ffffff",
    winCounterGoalColor: "#ffffff",
    winCounterTitleScale: 100,
    winCounterValueScale: 100,
    winCounterGoalScale: 100,
    incrementShortcut: "Alt+W, Alt+ArrowUp",
    decrementShortcut: "Alt+S, Alt+ArrowDown",
    resetShortcut: "Alt+R, Alt+0"
  },
  settings: [
    "title", "theme", "current", "target", "showGoal", "allowNegative",
    "winCounterLabelColorNegative", "winCounterLabelColorNeutral",
    "winCounterLabelColorPositive", "winCounterTitleColor", "winCounterGoalColor",
    "winCounterTitleScale", "winCounterValueScale", "winCounterGoalScale",
    "incrementShortcut", "decrementShortcut",
    "resetShortcut"
  ],
  parameters: {
    allowNegative: "allowNegative",
    winCounterLabelColorNegative: "negativeColor",
    winCounterLabelColorNeutral: "neutralColor",
    winCounterLabelColorPositive: "positiveColor",
    winCounterTitleColor: "winCounterTitleColor",
    winCounterGoalColor: "winCounterGoalColor",
    winCounterTitleScale: "winCounterTitleScale",
    winCounterValueScale: "winCounterValueScale",
    winCounterGoalScale: "winCounterGoalScale"
  }
}));
