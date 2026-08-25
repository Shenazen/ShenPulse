"use strict";

(function exposeManifest(root, factory) {
  const isCommonJs = typeof module !== "undefined" && module.exports;
  const shared = isCommonJs ? require("./shared") : root.ShenPulseOverlayShared;
  const manifest = factory(shared);
  if (isCommonJs) module.exports = manifest;
  else (root.ShenPulseOverlayManifests ||= []).push(manifest);
})(typeof globalThis === "undefined" ? this : globalThis, (shared) => ({
  definition: {
    key: "topTappers",
    name: "Classement tapoteurs",
    description: "Top des viewers par likes, avec 14 thèmes et mise à jour en direct.",
    category: "rankings",
    icon: "★",
    route: { view: "leaderboard", kind: "tappers" },
    parameter: "theme",
    options: shared.themes,
    defaultOption: "classic",
    previewKind: "leaderboard",
    sourceSize: [520, 640],
    settingsProfile: "leaderboard"
  },
  defaults: {
    title: "CLASSEMENT TAPOTEURS",
    theme: "classic",
    maxRows: 5,
    showHeader: true,
    showRank: true,
    showAvatars: true,
    showCrown: true,
    showRankBadges: true,
    showMetricLabel: true,
    nameColor: "#ffffff",
    scoreColor: "#ff8db8",
    rankColor: "#ffe575",
    rowOpacity: 68
  },
  settings: [
    "title", "theme", "maxRows", "showHeader", "showRank", "showAvatars",
    "showCrown", "showRankBadges", "showMetricLabel", "nameColor",
    "scoreColor", "rankColor", "rowOpacity"
  ],
  parameters: {
    showRank: "showRank",
    showAvatars: "showAvatars",
    showCrown: "showCrown",
    showRankBadges: "showRankBadges",
    showMetricLabel: "showMetricLabel",
    nameColor: "nameColor",
    scoreColor: "scoreColor",
    rankColor: "rankColor",
    rowOpacity: "rowOpacity"
  }
}));
