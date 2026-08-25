"use strict";

(function exposeManifest(root, factory) {
  const manifest = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = manifest;
  else (root.ShenPulseOverlayManifests ||= []).push(manifest);
})(typeof globalThis === "undefined" ? this : globalThis, () => ({
  definition: {
    key: "game",
    name: "Interactions en jeu",
    description: "Affiche clairement l’interaction déclenchée et le viewer à son origine.",
    category: "interactions",
    icon: "◇",
    route: { view: "game" },
    previewView: "game",
    previewKind: "game",
    catalogHidden: true,
    requiresPro: true
  },
  defaults: {},
  settings: []
}));
