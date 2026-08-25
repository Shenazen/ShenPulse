"use strict";

(function exposeManifest(root, factory) {
  const manifest = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = manifest;
  else (root.ShenPulseOverlayManifests ||= []).push(manifest);
})(typeof globalThis === "undefined" ? this : globalThis, () => ({
  definition: {
    key: "wheel",
    name: "Wheel Actions",
    description: "Roue d’actions configurable avec segments, libellés et designs Classique ou Royale Prestige.",
    category: "interactions",
    icon: "✺",
    route: { view: "wheel" },
    parameter: "design",
    options: [["classic", "Orange classique"], ["royal", "Royale Prestige"]],
    defaultOption: "classic",
    previewKind: "wheel",
    sourceSize: [800, 900],
    settingsProfile: "wheel"
  },
  defaults: {},
  settings: ["design", "wheels", "selectedWheelId"],
  parameters: {
    design: "design",
    textOrientation: "textOrientation",
    textShadowColor: "textShadowColor",
    textShadowStrength: "textShadowStrength",
    textRadius: "textRadius",
    textSegmentOffset: "textSegmentOffset",
    textBoxWidth: "textBoxWidth",
    textBoxHeight: "textBoxHeight",
    textAngleOffset: "textAngleOffset",
    textAlign: "textAlign",
    textClamp: "textClamp",
    textMaxLines: "textMaxLines",
    lineSpacing: "lineSpacing",
    letterSpacing: "letterSpacing",
    soundActive: "soundActive",
    spinDuration: "spinDuration",
    waitDuration: "waitDuration",
    glow: "glow",
    showWinner: "showWinner",
    pointerPosition: "pointerPosition",
    alwaysVisible: "alwaysVisible",
    entranceAnimation: "entranceAnimation",
    exitAnimation: "exitAnimation",
    resultDuration: "resultDuration"
  }
}));
