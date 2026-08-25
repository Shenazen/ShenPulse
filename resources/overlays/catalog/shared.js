"use strict";

/**
 * Valeurs communes à plusieurs overlays.
 *
 * Une option propre à un seul widget doit rester dans son manifeste dédié.
 */
(function exposeOverlayShared(root, factory) {
  const shared = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = shared;
  else root.ShenPulseOverlayShared = shared;
})(typeof globalThis === "undefined" ? this : globalThis, () => {
  const themes = Object.freeze([
    ["classic", "Classique"],
    ["gta", "GTA"],
    ["minecraft", "Minecraft"],
    ["akatsuki", "Akatsuki"],
    ["assassination-classroom", "Assassination Classroom"],
    ["fairy-tail", "Fairy Tail"],
    ["harry-potter", "Harry Potter"],
    ["cult-of-the-lamb", "Cult of the Lamb"],
    ["stardew-valley", "Stardew Valley"],
    ["terraria", "Terraria"],
    ["one-piece", "One Piece"],
    ["demon-slayer", "Demon Slayer"],
    ["dragon-ball", "Dragon Ball"],
    ["naruto", "Naruto"]
  ]);

  const coinJarModels = Object.freeze([
    ["fantasy", "Fantasy"],
    ["football", "Football"],
    ["gaming-retro", "Gaming rétro"],
    ["gaming-modern", "Gaming moderne"],
    ["magic-alchemy", "Magie / Alchimie"],
    ["cyberpunk", "Cyberpunk"],
    ["kawaii", "Kawaii"],
    ["pirate-treasure", "Pirate / Trésor"],
    ["halloween", "Halloween"],
    ["winter-christmas", "Noël / Hiver"],
    ["luxury-casino", "Luxury / Casino"],
    ["manga-anime", "Manga / Anime"],
    ["enchanted-forest", "Forêt enchantée"],
    ["space", "Spatial"]
  ]);

  const commonDefaults = Object.freeze({
    enabled: true,
    scale: 100,
    xOffset: 0,
    yOffset: 0,
    accentColor: "#22d3ee",
    secondaryColor: "#ff4f86",
    textColor: "#ffffff",
    backgroundColor: "#111315",
    backgroundOpacity: 82,
    shadowColor: "#000000",
    showShadow: true,
    showWhenIdle: true,
    font: "Inter",
    fontSize: 100,
    layout: "wide",
    animation: "pop",
    displayTime: 8,
    pauseTime: 2,
    soundEnabled: true,
    soundVolume: 70,
    saturation: 100,
    hue: 0,
    rtl: false
  });

  const commonParameters = Object.freeze({
    accentColor: "accent",
    secondaryColor: "secondary",
    textColor: "textColor",
    backgroundColor: "background",
    backgroundOpacity: "backgroundOpacity",
    shadowColor: "shadowColor",
    showShadow: "showShadow",
    showWhenIdle: "showWhenIdle",
    font: "font",
    fontSize: "fontSize",
    layout: "layout",
    animation: "animation",
    displayTime: "displayTime",
    pauseTime: "pauseTime",
    soundEnabled: "soundEnabled",
    soundVolume: "soundVolume",
    saturation: "saturation",
    hue: "hue",
    rtl: "rtl",
    scale: "scale",
    xOffset: "x",
    yOffset: "y",
    title: "title",
    current: "current",
    target: "target",
    showHeader: "showHeader",
    showGoal: "showGoal",
    maxRows: "maxRows",
    enabled: "enabled",
    theme: "theme"
  });

  const coreRoutes = Object.freeze([
    { key: "alerts", view: "alerts" },
    { key: "goals", view: "goals" },
    { key: "feed", view: "feed" }
  ]);

  return Object.freeze({
    themes,
    coinJarModels,
    commonDefaults,
    commonParameters,
    coreRoutes
  });
});
