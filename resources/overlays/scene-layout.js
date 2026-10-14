"use strict";

/** Shared, credential-free layout contract for the ShenPulse browser scene. */
(function exposeSceneLayout(root, factory) {
  const catalog = typeof module !== "undefined" && module.exports
    ? require("./overlay-catalog")
    : root.ShenPulseOverlayCatalog;
  const proAccess = typeof module !== "undefined" && module.exports
    ? require("../../src/shared/pro-access")
    : root.ShenPulseProAccess;
  const contract = factory(catalog, proAccess);
  if (typeof module !== "undefined" && module.exports) module.exports = contract;
  else root.ShenPulseSceneLayout = contract;
})(typeof globalThis === "undefined" ? this : globalThis, (catalog, proAccess) => {
  const MAX_WIDGETS = 16;
  const RESERVED_VIEWS = new Set(["scene", "match"]);
  const available = () => catalog.routes.filter((route) => !RESERVED_VIEWS.has(route.view));
  const routeFor = (key) => available().find((route) => route.key === key) || null;
  const clamp = (value, fallback, minimum, maximum) => Number.isFinite(Number(value))
    ? Math.min(maximum, Math.max(minimum, Math.round(Number(value)))) : fallback;

  function createDefaultScene(format = "portrait") {
    const portrait = format !== "landscape";
    return {
      version: 1, name: "Ma scène LIVE", width: portrait ? 1080 : 1920,
      height: portrait ? 1920 : 1080,
      widgets: [
        { id: "scene-alerts", key: "alerts", x: portrait ? 40 : 470,
          y: portrait ? 720 : 260, width: portrait ? 1000 : 980, height: 550,
          visible: true, opacity: 100, screen: 1 },
        { id: "scene-like-goal", key: "likeGoal", x: 40, y: 40,
          width: portrait ? 1000 : 860, height: 160, visible: true, opacity: 100 },
        { id: "scene-donors", key: "topDonors", x: 40, y: portrait ? 1430 : 660,
          width: portrait ? 1000 : 660, height: 400, visible: true, opacity: 100 }
      ]
    };
  }

  function normalizeScene(value) {
    const incoming = value && typeof value === "object" && !Array.isArray(value)
      ? value : createDefaultScene();
    const width = clamp(incoming.width, 1080, 360, 3840);
    const height = clamp(incoming.height, 1920, 360, 3840);
    const ids = new Set();
    const audioScreens = new Set();
    const widgets = [];
    for (const item of (Array.isArray(incoming.widgets) ? incoming.widgets : []).slice(0, MAX_WIDGETS)) {
      if (!item || !routeFor(String(item.key || ""))) continue;
      const id = String(item.id || `widget-${widgets.length + 1}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
      if (!id || ids.has(id)) continue;
      const screen = clamp(item.screen, 1, 1, 8);
      if (item.key === "alerts" && audioScreens.has(screen)) continue;
      if (item.key === "alerts") audioScreens.add(screen);
      ids.add(id);
      widgets.push({
        id, key: String(item.key), visible: item.visible !== false,
        x: clamp(item.x, 0, 0, width - 20), y: clamp(item.y, 0, 0, height - 20),
        width: clamp(item.width, 500, 80, 3840), height: clamp(item.height, 300, 80, 3840),
        opacity: clamp(item.opacity, 100, 0, 100), screen
      });
    }
    return { version: 1, name: String(incoming.name || "Ma scène LIVE").slice(0, 100), width, height, widgets };
  }

  function activeProAccess(state, nowMs = Date.now()) {
    // Les anciens clients OBS n'ont pas besoin de lire les droits : ils
    // reçoivent déjà une scène filtrée. Une dépendance absente échoue fermée.
    return proAccess?.hasProAccess(state, nowMs) === true;
  }

  function sceneForAccess(value, proAccess = false) {
    const scene = normalizeScene(value);
    scene.widgets = scene.widgets.filter((widget) => !routeFor(widget.key)?.requiresPro || proAccess);
    return { ...scene, proAccess: proAccess === true };
  }

  function stateForScene(state) {
    return sceneForAccess(state?.settings?.overlayScene, activeProAccess(state));
  }

  function acceptsSceneChannel(channel, proAccess = false) {
    if (channel === "scene" || channel === "bootstrap") return true;
    return available().some((route) =>
      (!route.requiresPro || proAccess) && catalog.acceptsChannel({
        view: route.view, channel, screen: 1, hasMediaScreen: true,
        leaderboardKind: route.parameters?.kind || ""
      })
    );
  }

  return Object.freeze({ MAX_WIDGETS, createDefaultScene, normalizeScene, sceneForAccess,
    stateForScene, activeProAccess, acceptsSceneChannel, routeFor });
});
