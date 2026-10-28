"use strict";

/**
 * Catalogue d'overlays, URL, configuration et aperçu de source.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

let preparedOverlayDefinitions = null;

function overlayDefinitions() {
  const publicUrls = snapshot?.overlayUrls;
  const localUrls = snapshot?.localOverlayUrls;
  const signature = JSON.stringify([publicUrls || {}, localUrls || {}]);
  if (!preparedOverlayDefinitions || preparedOverlayDefinitions.signature !== signature) {
    preparedOverlayDefinitions = {
      signature,
      items: overlayCatalog.definitionsWithUrls({ publicUrls: publicUrls || {}, localUrls: localUrls || {} })
    };
  }
  return preparedOverlayDefinitions.items;
}

function overlayUnlocked(item) {
  return !item.requiresPro || hasProAccess();
}

function selectedOverlayDesign(item) {
  const config = overlayConfig(item.key);
  const previewSelection = overlayDesignSelections[item.key];
  if (previewSelection) return ["likeGoal", "timer", "multiplierTimer", "winCounter", "topDonors", "topTappers"].includes(item.key)
    ? overlayCatalog.normalizeDesign(item.key, previewSelection)
    : previewSelection;
  if (item.key === "wheel" && Array.isArray(config.wheels)) {
    const selectedWheel = config.wheels.find(
      (wheel) => wheel.id === config.selectedWheelId
    ) || config.wheels[0];
    if (selectedWheel?.design) return selectedWheel.design;
  }
  const configured = item.parameter === "theme"
    ? config.theme
    : item.parameter === "model"
      ? config.model
      : item.parameter === "design"
        ? config.design
        : item.parameter === "variant"
          ? config.variant
          : "";
  return configured || item.defaultOption || item.options?.[0]?.[0] || "";
}

function overlayConfig(key) {
  const saved = snapshot.state.settings.overlayConfigs?.[key] || {};
  const merged = { ...overlayCatalog.defaultConfig(key), ...saved };
  if (["likeGoal", "timer", "multiplierTimer", "winCounter", "topDonors", "topTappers"].includes(key)) merged.theme = overlayCatalog.normalizeDesign(key, merged.theme);
  if (["timer", "multiplierTimer"].includes(key)) {
    merged.timerTitleColor = saved.timerTitleColor || saved.accentColor || saved.textColor || merged.timerTitleColor;
    merged.timerValueColor = saved.timerValueColor || saved.textColor || merged.timerValueColor;
  }
  if (key === "winCounter") {
    merged.winCounterTitleColor = saved.winCounterTitleColor || saved.textColor || merged.winCounterTitleColor;
    merged.winCounterGoalColor = saved.winCounterGoalColor || saved.textColor || merged.winCounterGoalColor;
  }
  if (key === "coinJar") {
    merged.coinJarTitleColor = saved.coinJarTitleColor || saved.textColor || merged.coinJarTitleColor;
  }
  if (["topDonors", "topTappers"].includes(key)) {
    merged.leaderboardTitleColor = saved.leaderboardTitleColor || saved.textColor || merged.leaderboardTitleColor;
    merged.leaderboardUnitColor = saved.leaderboardUnitColor || saved.scoreColor || merged.leaderboardUnitColor;
  }
  return key === "wheel" ? normalizeWheelConfig(merged) : merged;
}

function isPublicRelayOverlayUrl(url) {
  return (
    url?.searchParams?.has("channel") &&
    !url.searchParams.has("token")
  );
}

function overlayUrl(
  item,
  configOverride = null,
  { includePublicConfiguration = false } = {}
) {
  if (!item?.url) return "";
  try {
    const url = new URL(item.url);
    if (
      item.previewKind === "match" &&
      (
        url.searchParams.get("match") === "player" ||
        /^\/m\/\d{12}\/[A-Za-z0-9_-]{24,128}\/?$/i.test(url.pathname)
      )
    ) {
      return url.toString();
    }
    if (
      isPublicRelayOverlayUrl(url) &&
      !includePublicConfiguration
    ) {
      return url.toString();
    }
    const config = configOverride
      ? { ...overlayConfig(item.key), ...configOverride }
      : overlayConfig(item.key);
    if (["likeGoal", "timer", "multiplierTimer", "winCounter", "topDonors", "topTappers"].includes(item.key)) config.theme = overlayCatalog.normalizeDesign(item.key, config.theme);
    const selectedWheel = item.key === "wheel" && Array.isArray(config.wheels)
      ? config.wheels.find((wheel) => wheel.id === config.selectedWheelId) || config.wheels[0]
      : null;
    const effectiveConfig = selectedWheel
      ? {
          ...config,
          ...selectedWheel.settings,
          title: selectedWheel.settings?.wheelTitle ?? selectedWheel.name ?? config.title,
          design: selectedWheel.design,
          choices: selectedWheel.segments?.map((segment) => segment.label) || config.choices,
          colors: selectedWheel.segments?.map((segment) => segment.color) || config.colors
        }
      : config;
    const selectedParameter = item.parameter === "theme"
      ? effectiveConfig.theme
      : item.parameter === "model"
        ? effectiveConfig.model
        : item.parameter === "design"
          ? effectiveConfig.design
          : item.parameter === "variant"
            ? effectiveConfig.variant
            : "";
    if (item.parameter) {
      url.searchParams.set(
        item.parameter,
        selectedParameter || selectedOverlayDesign(item)
      );
    }
    // Le catalogue partagé est l'unique contrat entre l'éditeur, Electron,
    // le relais public et le runtime OBS. Un nouveau champ se câble dans le
    // manifeste de son overlay, sans devoir modifier ce générateur d'URL.
    const mappings = overlayCatalog.configParameterMappings;
    for (const [key, parameter] of Object.entries(mappings)) {
      if (effectiveConfig[key] !== undefined && (effectiveConfig[key] !== "" || ["progressLabel", "leaderboardMetricLabel", "wheelTitle"].includes(key) || (item.key === "coinJar" && key === "title"))) {
        url.searchParams.set(parameter, String(effectiveConfig[key]));
      }
    }
    if (Array.isArray(effectiveConfig.choices)) {
      url.searchParams.set("choices", effectiveConfig.choices.join("|"));
    }
    if (Array.isArray(effectiveConfig.colors)) {
      url.searchParams.set("colors", effectiveConfig.colors.join("|"));
    }
    if (item.key === "wheel") {
      const wheelParameters = [
        "font",
        "fontSize",
        "textOrientation",
        "textColor",
        "textShadowColor",
        "textShadowStrength",
        "textRadius",
        "textSegmentOffset",
        "textBoxWidth",
        "textBoxHeight",
        "textAngleOffset",
        "textAlign",
        "textClamp",
        "textMaxLines",
        "lineSpacing",
        "letterSpacing",
        "soundActive",
        "spinDuration",
        "waitDuration",
        "glow",
        "showWinner",
        "pointerPosition",
        "alwaysVisible",
        "entranceAnimation",
        "exitAnimation",
        "resultDuration"
      ];
      for (const key of wheelParameters) {
        if (effectiveConfig[key] !== undefined && effectiveConfig[key] !== "") {
          url.searchParams.set(key, String(effectiveConfig[key]));
        }
      }
    }
    return url.toString();
  } catch {
    return item.url;
  }
}

function localOverlayUrl(item, configOverride = null) {
  const localUrl = item?.previewKind === "match"
    ? snapshot?.localOverlayUrls?.matchPlayer || ""
    : snapshot?.localOverlayUrls?.[item?.key] || "";
  if (!localUrl) return "";
  return overlayUrl({ ...item, url: localUrl }, configOverride);
}

function overlayCatalogPreviewUrl(item) {
  // Le serveur de développement fournit ses propres sources à jour, même
  // lorsqu'un compte utilise aussi une version installée sur un autre port.
  const previewUrls = {
    ...(isAccountAuthenticated() ? snapshot?.localOverlayUrls : {}),
    ...snapshot?.previewOverlayUrls
  };
  const localUrl = previewUrls?.[item?.key];
  if (localUrl) return localUrl;
  const base = previewUrls?.base;
  const token = snapshot?.state?.settings?.overlayToken;
  if (!base || !token || !item?.previewView) return "";
  try {
    const url = new URL("/overlay/", `${base}/`);
    url.searchParams.set("view", item.previewView);
    url.searchParams.set("token", token);
    if (item.match) url.searchParams.set("match", item.match);
    return url.toString();
  } catch {
    return "";
  }
}

function overlayRuntimePreviewUrl(item, config = null, { context = "card" } = {}) {
  const previewItem = {
    ...item,
    url: overlayCatalogPreviewUrl(item) || item.url
  };
  let runtimeUrl = overlayUrl(previewItem, config);
  try {
    const previewUrl = new URL(runtimeUrl);
    if (item.previewKind === "match") {
      previewUrl.searchParams.set("preview", "animated");
      if (context === "card") {
        previewUrl.searchParams.set("autoplay", "true");
        previewUrl.searchParams.set("loop", "true");
      }
    } else {
      previewUrl.searchParams.set("preview", "static");
    }
    runtimeUrl = previewUrl.toString();
  } catch {
    // Keep the original local URL if it cannot be parsed.
  }
  return runtimeUrl;
}

function overlayRuntimeFrame(
  item,
  config = null,
  {
    context = "card",
    editable = false,
    loading = "lazy",
    placeholder = ""
  } = {}
) {
  const size = overlaySourceSize(item);
  const cardMaxWidth = Math.min(560, Math.max(110, (220 * size.width) / size.height));
  const runtimeUrl = overlayRuntimePreviewUrl(item, config, { context });
  const deferred = context === "card" && loading === "lazy";
  return `<div
    class="overlay-runtime-frame overlay-runtime-frame--${escapeHtml(context)}"
    data-overlay-native-frame
    data-overlay-preview-key="${escapeHtml(item.key)}"
    data-overlay-source-width="${size.width}"
    data-overlay-source-height="${size.height}"
    style="--overlay-preview-ratio:${size.width} / ${size.height};--overlay-card-max-width:${cardMaxWidth.toFixed(2)}px;--overlay-source-max-width:${size.width}px;--overlay-source-width:${size.width}px;--overlay-source-height:${size.height}px"
  >
    <div class="overlay-runtime-placeholder" aria-hidden="true">${placeholder || `
      <span class="overlay-placeholder-icon">${escapeHtml(item.icon)}</span>
      <strong>${escapeHtml(item.name)}</strong>`}
    </div>
    <iframe
      ${editable ? "data-overlay-live-preview" : 'data-overlay-runtime-preview="true"'}
      ${deferred ? `data-overlay-src="${escapeHtml(runtimeUrl)}"` : ""}
      title="Aperçu réel ${escapeHtml(item.name)}"
      src="${deferred ? "about:blank" : escapeHtml(runtimeUrl)}"
      loading="${loading}"
      tabindex="-1"
      sandbox="allow-scripts allow-same-origin"
    ></iframe>
  </div>`;
}

const observedOverlayRuntimeFrames = new Set();
const overlayPreviewLoadQueue = [];
const OVERLAY_PREVIEW_LOAD_CONCURRENCY = 2;
let activeOverlayPreviewLoads = 0;
const overlayRuntimeFrameObserver = typeof ResizeObserver === "undefined"
  ? null
  : new ResizeObserver((entries) => {
    for (const entry of entries) updateOverlayRuntimeFrameScale(entry.target);
  });

function prioritizeOverlayRuntimePreview(key) {
  if (!overlayPreviewsVisible()) return;
  const frame = [...content.querySelectorAll("[data-overlay-native-frame]")]
    .find((item) => item.dataset.overlayPreviewKey === String(key || ""));
  if (!frame) return;
  restoreOverlayRuntimeFrame(frame);
  bindOverlayRuntimeFrames(frame.parentElement);
  queueDeferredOverlayPreview(frame);
}

function revealOverlayPreviewFrame(iframe) {
  const frame = iframe?.closest("[data-overlay-native-frame]");
  if (!frame) return;
  const revision = String(
    (Number(iframe.dataset.overlayPreviewRevealRevision) || 0) + 1
  );
  iframe.dataset.overlayPreviewRevealRevision = revision;
  frame.classList.remove("overlay-runtime-frame--ready");
  const scheduleFrame = typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (callback) => setTimeout(callback, 0);
  scheduleFrame(() => {
    if (
      !iframe.isConnected ||
      iframe.dataset.overlayPreviewRevealRevision !== revision
    ) return;
    // Force la mise en page de l'iframe nouvellement rattachee. Le premier
    // rendu reste masque par l'apercu leger, puis la vraie source est revelee
    // au frame suivant, une fois Chromium capable de la peindre sans flash noir.
    iframe.getBoundingClientRect();
    scheduleFrame(() => {
      if (
        !iframe.isConnected ||
        iframe.dataset.overlayPreviewRevealRevision !== revision
      ) return;
      iframe
        .closest("[data-overlay-native-frame]")
        ?.classList.add("overlay-runtime-frame--ready");
    });
  });
}

function overlayPreviewsVisible() {
  return typeof rendererVisualsActive === "function"
    ? rendererVisualsActive() : document.visibilityState !== "hidden";
}

function overlayRuntimeFrameAllowed(frame) {
  if (!overlayPreviewsVisible()) return false;
  const editor = frame.closest("dialog");
  if (editor) return editor.open;
  return typeof currentPage === "undefined" || currentPage === "overlays" ||
    currentPage === "games" && Boolean(frame.closest(".game-pack-workspace"));
}

function overlayPreviewAttributes(iframe) {
  return [...iframe.attributes]
    .filter(({ name }) => !/^data-overlay-preview-(?:queued|loading|ready|load-bound|reveal-revision)$/.test(name))
    .map(({ name, value }) => [name, value]);
}

function releaseOverlayRuntimeFrame(frame, { suspend = false } = {}) {
  dequeueDeferredOverlayPreview(frame);
  const iframe = frame.querySelector("iframe");
  if (iframe) {
    // Keep only a tiny descriptor, not a detached iframe/document/media runtime.
    if (suspend) frame.shenPulseSuspendedPreview = overlayPreviewAttributes(iframe);
    if (iframe.dataset.overlayPreviewLoading) {
      delete iframe.dataset.overlayPreviewLoading;
      activeOverlayPreviewLoads = Math.max(0, activeOverlayPreviewLoads - 1);
    }
    iframe.remove();
  }
  if (!suspend) delete frame.shenPulseSuspendedPreview;
  frame.classList.remove("overlay-runtime-frame--ready");
}

function restoreOverlayRuntimeFrame(frame) {
  let iframe = frame.querySelector("iframe");
  if (iframe || !frame.shenPulseSuspendedPreview || !overlayRuntimeFrameAllowed(frame)) return iframe;
  iframe = document.createElement("iframe");
  for (const [name, value] of frame.shenPulseSuspendedPreview) {
    if (name !== "src") iframe.setAttribute(name, value);
  }
  const source = frame.shenPulseSuspendedPreview.find(([name]) => name === "src")?.[1];
  iframe.dataset.overlaySrc = source && source !== "about:blank" ? source : iframe.dataset.overlaySrc || "";
  if (!iframe.hasAttribute("data-overlay-live-preview")) {
    const item = overlayDefinitions().find((entry) => entry.key === frame.dataset.overlayPreviewKey);
    if (item) {
      try {
        const url = new URL(overlayRuntimePreviewUrl(item, overlayConfig(item.key)));
        if (item.parameter) url.searchParams.set(item.parameter, selectedOverlayDesign(item));
        iframe.dataset.overlaySrc = url.toString();
      } catch {
        // No local server/source yet: keep the lightweight placeholder until a usable URL is supplied.
      }
    }
  }
  iframe.src = "about:blank";
  frame.appendChild(iframe);
  delete frame.shenPulseSuspendedPreview;
  return iframe;
}

function suspendOverlayRuntimePreviews(root = document) {
  root.querySelectorAll("[data-overlay-native-frame]").forEach((frame) => {
    releaseOverlayRuntimeFrame(frame, { suspend: true });
    overlayPreviewVisibilityObserver?.unobserve(frame);
    delete frame.dataset.overlayPreviewVisible;
  });
  root.querySelectorAll("iframe[data-scene-preview]").forEach((iframe) => {
    const placeholder = document.createElement("span");
    placeholder.dataset.scenePreviewResume = "true";
    placeholder.hidden = true;
    placeholder.shenPulsePreviewAttributes = overlayPreviewAttributes(iframe);
    iframe.replaceWith(placeholder);
  });
}

function resumeOverlayRuntimePreviews(root = document) {
  if (!overlayPreviewsVisible()) return;
  bindOverlayRuntimeFrames(root);
  if (typeof currentPage !== "undefined" && currentPage !== "overlays") return;
  root.querySelectorAll("[data-scene-preview-resume]").forEach((placeholder) => {
    const iframe = document.createElement("iframe");
    for (const [name, value] of placeholder.shenPulsePreviewAttributes || []) iframe.setAttribute(name, value);
    iframe.addEventListener("load", () => {
      if (typeof hydrateSceneComposerPreview === "function") hydrateSceneComposerPreview(iframe);
    });
    placeholder.replaceWith(iframe);
  });
}

function disposeOverlayRuntimePreviews(root = document) {
  root.querySelectorAll("[data-overlay-native-frame]").forEach((frame) => {
    overlayRuntimeFrameObserver?.unobserve(frame);
    overlayPreviewVisibilityObserver?.unobserve(frame);
    observedOverlayRuntimeFrames.delete(frame);
    releaseOverlayRuntimeFrame(frame);
  });
  root.querySelectorAll("iframe[data-scene-preview], [data-scene-preview-resume]")
    .forEach((frame) => frame.remove());
  drainOverlayPreviewLoadQueue();
}
const overlayPreviewVisibilityObserver = typeof IntersectionObserver === "undefined"
  ? null
  : new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const frame = entry.target;
      frame.dataset.overlayPreviewVisible = String(entry.isIntersecting);
      if (entry.isIntersecting && overlayRuntimeFrameAllowed(frame)) {
        restoreOverlayRuntimeFrame(frame);
        bindOverlayRuntimeFrameLoad(frame);
        queueDeferredOverlayPreview(frame);
      } else releaseOverlayRuntimeFrame(frame, { suspend: true });
    }
    drainOverlayPreviewLoadQueue();
  }, {
    root: content,
    rootMargin: "160px 0px",
    threshold: 0.01
  });

function queueDeferredOverlayPreview(frame) {
  if (!overlayRuntimeFrameAllowed(frame)) return;
  const iframe = frame.querySelector("iframe[data-overlay-src]");
  if (
    !iframe ||
    !iframe.dataset.overlaySrc ||
    iframe.dataset.overlayPreviewQueued ||
    iframe.dataset.overlayPreviewLoading ||
    iframe.dataset.overlayPreviewReady
  ) return;
  iframe.dataset.overlayPreviewQueued = "true";
  overlayPreviewLoadQueue.push(frame);
  overlayPreviewLoadQueue.sort(
    (left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top
  );
  drainOverlayPreviewLoadQueue();
}

function dequeueDeferredOverlayPreview(frame) {
  const queueIndex = overlayPreviewLoadQueue.indexOf(frame);
  if (queueIndex < 0) return;
  overlayPreviewLoadQueue.splice(queueIndex, 1);
  const iframe = frame.querySelector("iframe[data-overlay-src]");
  if (iframe) delete iframe.dataset.overlayPreviewQueued;
}

function drainOverlayPreviewLoadQueue() {
  if (!overlayPreviewsVisible()) return;
  while (
    activeOverlayPreviewLoads < OVERLAY_PREVIEW_LOAD_CONCURRENCY &&
    overlayPreviewLoadQueue.length
  ) {
    const frame = overlayPreviewLoadQueue.shift();
    if (!frame?.isConnected) continue;
    loadDeferredOverlayPreview(frame);
  }
}

function loadDeferredOverlayPreview(frame) {
  if (!overlayRuntimeFrameAllowed(frame)) return;
  const iframe = frame.querySelector("iframe[data-overlay-src]");
  if (!iframe || iframe.dataset.overlayPreviewLoading) return;
  delete iframe.dataset.overlayPreviewQueued;
  iframe.dataset.overlayPreviewLoading = "true";
  activeOverlayPreviewLoads += 1;
  iframe.src = iframe.dataset.overlaySrc;
}

function completeDeferredOverlayPreview(iframe) {
  if (!iframe.dataset.overlayPreviewLoading) return;
  delete iframe.dataset.overlayPreviewLoading;
  activeOverlayPreviewLoads = Math.max(0, activeOverlayPreviewLoads - 1);
  drainOverlayPreviewLoadQueue();
}

function updateOverlayRuntimeFrameScale(frame) {
  const sourceWidth = Number(frame.dataset.overlaySourceWidth || 0);
  const sourceHeight = Number(frame.dataset.overlaySourceHeight || 0);
  if (
    !sourceWidth ||
    !sourceHeight ||
    !frame.clientWidth ||
    !frame.clientHeight
  ) return;
  const scale = Math.min(
    frame.clientWidth / sourceWidth,
    frame.clientHeight / sourceHeight
  );
  frame.style.setProperty("--overlay-render-scale", String(scale));
}

function bindOverlayRuntimeFrameLoad(frame) {
  const iframe = frame.querySelector("iframe");
  if (!iframe || iframe.dataset.overlayPreviewLoadBound) return;
  iframe.dataset.overlayPreviewLoadBound = "true";
  iframe.addEventListener("load", () => {
    if (!iframe.isConnected || !overlayRuntimeFrameAllowed(frame) || iframe.src === "about:blank") return;
    completeDeferredOverlayPreview(iframe);
    window.hydrateOverlayPreviewFrame?.(iframe);
    if (iframe.hasAttribute("data-overlay-live-preview") && typeof scheduleOverlayLivePreview === "function") {
      // Configuration edits are sent by postMessage; reapply the still-open draft after a resume.
      scheduleOverlayLivePreview();
    }
  });
  iframe.addEventListener("error", () => completeDeferredOverlayPreview(iframe));
}

function bindOverlayRuntimeFrames(root = document) {
  for (const frame of observedOverlayRuntimeFrames) {
    if (frame.isConnected) continue;
    overlayRuntimeFrameObserver?.unobserve(frame);
    overlayPreviewVisibilityObserver?.unobserve(frame);
    releaseOverlayRuntimeFrame(frame);
    observedOverlayRuntimeFrames.delete(frame);
  }
  root.querySelectorAll("[data-overlay-native-frame]").forEach((frame) => {
    if (!overlayRuntimeFrameAllowed(frame)) {
      releaseOverlayRuntimeFrame(frame, { suspend: true });
      return;
    }
    if (!observedOverlayRuntimeFrames.has(frame)) {
      observedOverlayRuntimeFrames.add(frame);
      overlayRuntimeFrameObserver?.observe(frame);
    }
    const iframe = restoreOverlayRuntimeFrame(frame);
    bindOverlayRuntimeFrameLoad(frame);
    if (iframe?.dataset.overlayPreviewReady === "true") {
      window.hydrateOverlayPreviewFrame?.(iframe);
      revealOverlayPreviewFrame(iframe);
    }
    if (iframe?.dataset.overlaySrc) {
      if (overlayPreviewVisibilityObserver && !iframe.hasAttribute("data-overlay-live-preview")) {
        overlayPreviewVisibilityObserver.observe(frame);
        if (frame.dataset.overlayPreviewVisible === "true") queueDeferredOverlayPreview(frame);
      } else {
        queueDeferredOverlayPreview(frame);
      }
    }
    updateOverlayRuntimeFrameScale(frame);
  });
}

window.addEventListener("message", (event) => {
  if (
    event.data?.source !== "shenpulse-overlay-runtime" ||
    event.data?.type !== "ready"
  ) {
    return;
  }
  const iframe = [...document.querySelectorAll("iframe")].find(
    (candidate) => candidate.contentWindow === event.source
  );
  if (!iframe) return;
  iframe.dataset.overlayPreviewReady = "true";
  revealOverlayPreviewFrame(iframe);
});
