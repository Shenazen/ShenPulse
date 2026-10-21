"use strict";

(function exposeManifest(root, factory) {
  const isCommonJs = typeof module !== "undefined" && module.exports;
  const shared = isCommonJs ? require("./shared") : root.ShenPulseOverlayShared;
  const manifest = factory(shared);
  if (isCommonJs) module.exports = manifest;
  else (root.ShenPulseOverlayManifests ||= []).push(manifest);
})(typeof globalThis === "undefined" ? this : globalThis, (shared) => ({
  definition: {
    key: "likeGoal",
    name: "Like Goal",
    description: "Objectif de likes personnalisable avec 13 designs illustrés.",
    category: "counters",
    icon: "♥",
    route: { view: "like-goal" },
    parameter: "theme",
    options: shared.themes.filter(([theme]) => theme !== "classic"),
    defaultOption: "gta",
    previewKind: "like-goal",
    sourceSize: [1300, 200],
    settingsProfile: "likeGoal"
  },
  defaults: {
    schemaVersion: 2,
    title: "LIKE GOAL",
    theme: "gta",
    scale: 100,
    current: 0,
    target: 50000,
    whenReached: "increase",
    completionActionId: "",
    goalBaseline: 0,
    progressLabel: "likes",
    showHeader: true,
    showGoal: true,
    showPercent: true,
    likeGoalTitleScale: 100,
    likeGoalTitleColor: "#ffffff",
    likeGoalContentScale: 100,
    likeGoalContentColor: "#ffffff",
    likeGoalPercentColor: "#ff4f86"
  },
  settings: [
    "title", "theme", "target", "whenReached", "completionActionId",
    "goalBaseline", "progressLabel", "showHeader", "showGoal", "showPercent",
    "likeGoalTitleScale",
    "likeGoalTitleColor",
    "likeGoalContentScale", "likeGoalContentColor", "likeGoalPercentColor"
  ],
  parameters: {
    showPercent: "showPercent",
    likeGoalTitleScale: "titleScale",
    likeGoalTitleColor: "titleColor",
    likeGoalContentScale: "contentScale",
    likeGoalContentColor: "contentColor",
    likeGoalPercentColor: "percentColor",
    goalBaseline: "goalBaseline",
    progressLabel: "progressLabel",
    whenReached: "whenReached"
  }
}));
