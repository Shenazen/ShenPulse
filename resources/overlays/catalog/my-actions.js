"use strict";

(function exposeManifest(root, factory) {
  const manifest = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = manifest;
  else (root.ShenPulseOverlayManifests ||= []).push(manifest);
})(typeof globalThis === "undefined" ? this : globalThis, () => ({
  definition: {
    key: "myActions",
    name: "My Actions",
    description: "File visuelle des actions lancées par les déclencheurs, sons, commandes et timers.",
    category: "actions",
    icon: "⚡",
    route: { view: "my-actions" },
    sourceSize: [720, 520],
    settingsProfile: "myActions"
  },
  defaults: {
    title: "MY ACTIONS",
    maxRows: 5,
    showHeader: true
  },
  settings: ["title", "maxRows", "showHeader"]
}));
