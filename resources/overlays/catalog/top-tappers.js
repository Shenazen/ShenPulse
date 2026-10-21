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
    description: "Top des viewers par likes, avec 13 designs et mise à jour en direct.",
    category: "rankings",
    icon: "★",
    route: { view: "leaderboard", kind: "tappers" },
    parameter: "theme",
    options: shared.themes.filter(([theme]) => theme !== "classic"),
    defaultOption: "gta",
    previewKind: "leaderboard",
    sourceSize: [520, 640],
    settingsProfile: "leaderboard"
  },
  defaults: {
    title: "CLASSEMENT TAPOTEURS",
    theme: "gta",
    maxRows: 5,
    leaderboardTitleColor: "#ffffff",
    leaderboardTitleScale: 100,
    leaderboardNameScale: 100,
    leaderboardScoreScale: 100,
    leaderboardMetricLabel: "likes",
    leaderboardShowUnit: true,
    leaderboardUnitColor: "#ff8db8",
    leaderboardUnitScale: 100,
    leaderboardAvatarScale: 100,
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
    "scoreColor", "rankColor", "rowOpacity", "leaderboardTitleColor",
    "leaderboardTitleScale", "leaderboardNameScale", "leaderboardScoreScale",
    "leaderboardMetricLabel", "leaderboardShowUnit", "leaderboardUnitColor",
    "leaderboardUnitScale", "leaderboardAvatarScale"
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
    rowOpacity: "rowOpacity",
    leaderboardTitleColor: "leaderboardTitleColor",
    leaderboardTitleScale: "leaderboardTitleScale",
    leaderboardNameScale: "leaderboardNameScale",
    leaderboardScoreScale: "leaderboardScoreScale",
    leaderboardMetricLabel: "leaderboardMetricLabel",
    leaderboardShowUnit: "leaderboardShowUnit",
    leaderboardUnitColor: "leaderboardUnitColor",
    leaderboardUnitScale: "leaderboardUnitScale",
    leaderboardAvatarScale: "leaderboardAvatarScale"
  }
}));
