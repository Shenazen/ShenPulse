"use strict";

(function exposeManifest(root, factory) {
  const isCommonJs = typeof module !== "undefined" && module.exports;
  const shared = isCommonJs ? require("./shared") : root.ShenPulseOverlayShared;
  const manifest = factory(shared);
  if (isCommonJs) module.exports = manifest;
  else (root.ShenPulseOverlayManifests ||= []).push(manifest);
})(typeof globalThis === "undefined" ? this : globalThis, (shared) => ({
  definition: {
    key: "coinJar",
    name: "Coin Jar",
    description: "Coin Jar réel de ShenazenOverlay : aucun faux point ni fausse pièce ne s’affiche au repos.",
    category: "gifts",
    icon: "◉",
    route: { view: "coin-jar" },
    parameter: "model",
    options: shared.coinJarModels,
    defaultOption: "fantasy",
    previewKind: "coin-jar",
    sourceSize: [720, 520],
    settingsProfile: "coinJar"
  },
  defaults: {
    title: "COIN JAR",
    model: "fantasy",
    current: 0,
    target: 1000,
    minCoins: 0,
    showGoal: true,
    showBase: true
  },
  settings: ["title", "model", "target", "minCoins", "showGoal", "showBase"],
  parameters: {
    model: "model",
    minCoins: "minCoins",
    showBase: "showBase"
  }
}));
