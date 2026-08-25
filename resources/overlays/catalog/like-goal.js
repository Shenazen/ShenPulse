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
    description: "Objectif de likes avec le cadre mystique et les 14 thèmes de ShenazenOverlay.",
    category: "counters",
    icon: "♥",
    route: { view: "like-goal" },
    parameter: "theme",
    options: shared.themes,
    defaultOption: "classic",
    previewKind: "like-goal",
    sourceSize: [1300, 200],
    settingsProfile: "likeGoal"
  },
  defaults: {
    schemaVersion: 2,
    title: "LIKE GOAL",
    theme: "classic",
    scale: 100,
    current: 0,
    target: 50000,
    whenReached: "increase",
    completionActionId: "",
    goalBaseline: 0,
    progressLabel: "Objectif LIVE",
    showHeader: true,
    showGoal: true,
    showPercent: true,
    likeGoalTitleOffsetX: 0,
    likeGoalTitleOffsetY: 0,
    likeGoalTitleScale: 100,
    likeGoalTitleColor: "#ffffff",
    likeGoalContentOffsetX: 0,
    likeGoalContentOffsetY: 0,
    likeGoalContentScale: 100,
    likeGoalContentColor: "#ffffff",
    likeGoalPercentColor: "#ff4f86"
  },
  settings: [
    "title", "theme", "target", "whenReached", "completionActionId",
    "goalBaseline", "progressLabel", "showHeader", "showGoal", "showPercent",
    "likeGoalTitleOffsetX", "likeGoalTitleOffsetY", "likeGoalTitleScale",
    "likeGoalTitleColor", "likeGoalContentOffsetX", "likeGoalContentOffsetY",
    "likeGoalContentScale", "likeGoalContentColor", "likeGoalPercentColor"
  ],
  parameters: {
    showPercent: "showPercent",
    likeGoalTitleOffsetX: "titleX",
    likeGoalTitleOffsetY: "titleY",
    likeGoalTitleScale: "titleScale",
    likeGoalTitleColor: "titleColor",
    likeGoalContentOffsetX: "contentX",
    likeGoalContentOffsetY: "contentY",
    likeGoalContentScale: "contentScale",
    likeGoalContentColor: "contentColor",
    likeGoalPercentColor: "percentColor",
    goalBaseline: "goalBaseline",
    progressLabel: "progressLabel",
    whenReached: "whenReached"
  }
}));
