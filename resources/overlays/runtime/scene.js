"use strict";

/** One transport for a composition, reusing the real widget runtimes. */
const sceneFrames = new Map();
let browserScene = globalThis.ShenPulseSceneLayout.createDefaultScene();
let sceneBootstrap = {};
let sceneConfigurations = {};
let sceneAccess = false;

function sceneChildUrl(widget) {
  const route = globalThis.ShenPulseSceneLayout.routeFor(widget.key);
  const url = new URL(location.href);
  url.search = "";
  const parentQuery = new URLSearchParams(location.search);
  for (const credential of ["token", "channel"]) {
    if (parentQuery.has(credential)) url.searchParams.set(credential, parentQuery.get(credential));
  }
  url.searchParams.set("view", route.view);
  url.searchParams.set("embedded", "scene");
  if (["static", "animated"].includes(parentQuery.get("preview"))) {
    url.searchParams.set("preview", "static");
  }
  for (const [name, value] of Object.entries(route.parameters || {})) {
    url.searchParams.set(name, value);
  }
  if (route.view === "alerts") url.searchParams.set("screen", String(widget.screen));
  const configured = sceneConfigurations[widget.key] || {};
  for (const [name, value] of Object.entries(configured)) {
    const parameter = globalThis.ShenPulseOverlayCatalog.configParameterMappings[name] || name;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      url.searchParams.set(parameter, String(value));
    }
  }
  return url.toString();
}

function hydrateScene(value = {}) {
  if (typeof value.proAccess === "boolean") sceneAccess = value.proAccess;
  browserScene = globalThis.ShenPulseSceneLayout.sceneForAccess(value, sceneAccess);
  const stage = document.getElementById("scene-canvas");
  if (!stage) return;
  stage.style.width = `${browserScene.width}px`;
  stage.style.height = `${browserScene.height}px`;
  resizeSceneCanvas();
  const desired = new Set();
  browserScene.widgets.forEach((widget, index) => {
    if (!widget.visible) return;
    desired.add(widget.id);
    let record = sceneFrames.get(widget.id);
    if (record && (record.key !== widget.key || record.screen !== widget.screen)) {
      record.element.remove();
      sceneFrames.delete(widget.id);
      record = null;
    }
    if (!record) {
      const element = document.createElement("iframe");
      element.title = `Widget ShenPulse ${widget.key}`;
      element.setAttribute("sandbox", "allow-scripts allow-same-origin");
      element.setAttribute("allow", "autoplay");
      element.src = sceneChildUrl(widget);
      record = { element, key: widget.key, screen: widget.screen, ready: false };
      sceneFrames.set(widget.id, record);
      stage.appendChild(element);
    }
    Object.assign(record.element.style, {
      left: `${widget.x}px`, top: `${widget.y}px`, width: `${widget.width}px`,
      height: `${widget.height}px`, opacity: String(widget.opacity / 100), zIndex: String(index)
    });
  });
  for (const [id, record] of sceneFrames) {
    if (desired.has(id)) continue;
    record.element.remove();
    sceneFrames.delete(id);
  }
}

function resizeSceneCanvas() {
  const canvas = document.getElementById("scene-canvas");
  if (!canvas) return;
  const scale = Math.min(window.innerWidth / browserScene.width, window.innerHeight / browserScene.height);
  canvas.style.transform = `scale(${scale})`;
}

function deliverSceneMessage(record, channel, payload) {
  if (!record.ready) return;
  record.element.contentWindow?.postMessage({ source: "shenpulse-scene", channel, payload }, location.origin);
}

function hydrateSceneState(state = {}) {
  sceneBootstrap = { ...sceneBootstrap, ...state };
  if (state.configurations) synchronizeSceneConfigurations(state.configurations);
  if (state.overlayScene) hydrateScene(state.overlayScene);
  dispatchSceneMessage("bootstrap", sceneBootstrap);
}

function synchronizeSceneConfigurations(configurations = {}) {
  // Local state carries config keys; the public relay carries URL parameter keys.
  sceneConfigurations = Object.fromEntries(Object.entries(configurations)
    .map(([key, config]) => [key, sceneWidgetConfiguration(key, config)]));
  for (const record of sceneFrames.values()) {
    deliverSceneMessage(record, "configuration", {
      overlayKey: record.key, config: sceneConfigurations[record.key] || {}
    });
  }
}

function sceneWidgetConfiguration(key, configuration = {}) {
  let effective = configuration;
  if (key === "wheel" && Array.isArray(configuration.wheels)) {
    const selected = configuration.wheels.find((wheel) => wheel.id === configuration.selectedWheelId)
      || configuration.wheels[0];
    if (selected) effective = { ...configuration, ...(selected.settings || {}),
      design: selected.design || configuration.design,
      choices: Array.isArray(selected.segments) ? selected.segments.map((segment) => segment.label) : configuration.choices,
      colors: Array.isArray(selected.segments) ? selected.segments.map((segment) => segment.color) : configuration.colors
    };
  }
  const mapping = globalThis.ShenPulseOverlayCatalog.configParameterMappings;
  const permitted = new Set([...Object.keys(mapping), ...Object.values(mapping), "choices", "colors"]);
  return Object.fromEntries(Object.entries(effective || {})
    .filter(([name, value]) => permitted.has(name) &&
      (["string", "number", "boolean"].includes(typeof value) ||
        (["choices", "colors"].includes(name) && Array.isArray(value))))
    .map(([name, value]) => [mapping[name] || name, Array.isArray(value) ? value.join("|") : value]));
}

function dispatchSceneMessage(channel, payload = {}) {
  if (channel === "configuration") {
    const key = payload.overlayKey;
    if (key) sceneConfigurations[key] = sceneWidgetConfiguration(key, payload.config);
    payload = { ...payload, config: sceneConfigurations[key] || payload.config };
  }
  if (channel === "session-state") sceneBootstrap.overlaySession = payload;
  for (const record of sceneFrames.values()) deliverSceneMessage(record, channel, payload);
}

window.addEventListener("resize", resizeSceneCanvas, { passive: true });
window.addEventListener("message", (event) => {
  if (event.origin === location.origin && event.data?.source === "shenpulse-overlay-runtime" &&
    event.data.type === "ready") {
    const record = [...sceneFrames.values()].find((candidate) => candidate.element.contentWindow === event.source);
    if (!record) return;
    record.ready = true;
    deliverSceneMessage(record, "configuration", { overlayKey: record.key,
      config: sceneConfigurations[record.key] || {} });
    deliverSceneMessage(record, "bootstrap", sceneBootstrap);
    return;
  }
  if (event.source === window.parent && event.data?.source === "shenpulse-overlay-card" &&
    ["static", "animated"].includes(new URLSearchParams(location.search).get("preview"))) {
    if (event.data.channel === "scene") hydrateScene(event.data.payload);
    else dispatchSceneMessage(event.data.channel, event.data.payload);
  }
});
