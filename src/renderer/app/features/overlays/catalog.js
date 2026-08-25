"use strict";

/**
 * Catalogue d'overlays, URL, configuration et aperçu de source.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function overlayDefinitions() {
  return overlayCatalog.definitionsWithUrls({
    publicUrls: snapshot.overlayUrls || {},
    localUrls: snapshot.localOverlayUrls || {}
  });
}

function overlayUnlocked(item) {
  return !item.requiresPro || hasProAccess();
}

function selectedOverlayDesign(item) {
  const config = overlayConfig(item.key);
  const previewSelection = overlayDesignSelections[item.key];
  if (previewSelection) return previewSelection;
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
      url.searchParams.get("match") === "player"
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
    const selectedWheel = item.key === "wheel" && Array.isArray(config.wheels)
      ? config.wheels.find((wheel) => wheel.id === config.selectedWheelId) || config.wheels[0]
      : null;
    const effectiveConfig = selectedWheel
      ? {
          ...config,
          ...selectedWheel.settings,
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
      if (effectiveConfig[key] !== undefined && effectiveConfig[key] !== "") {
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
  const previewUrls = isAccountAuthenticated()
    ? snapshot?.localOverlayUrls
    : snapshot?.previewOverlayUrls;
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
  const deferred = context === "card" && loading === "lazy";
  return `<div
    class="overlay-runtime-frame overlay-runtime-frame--${escapeHtml(context)}"
    data-overlay-native-frame
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
const overlayPreviewVisibilityObserver = typeof IntersectionObserver === "undefined"
  ? null
  : new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) queueDeferredOverlayPreview(entry.target);
      else dequeueDeferredOverlayPreview(entry.target);
    }
  }, {
    root: content,
    rootMargin: "160px 0px",
    threshold: 0.01
  });

function queueDeferredOverlayPreview(frame) {
  const iframe = frame.querySelector("iframe[data-overlay-src]");
  if (
    !iframe ||
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
  const iframe = frame.querySelector("iframe[data-overlay-src]");
  if (!iframe || iframe.dataset.overlayPreviewLoading) return;
  delete iframe.dataset.overlayPreviewQueued;
  iframe.dataset.overlayPreviewLoading = "true";
  activeOverlayPreviewLoads += 1;
  overlayPreviewVisibilityObserver?.unobserve(frame);
  iframe.src = iframe.dataset.overlaySrc;
}

function completeDeferredOverlayPreview(iframe) {
  if (!iframe.dataset.overlayPreviewLoading) return;
  delete iframe.dataset.overlayPreviewLoading;
  activeOverlayPreviewLoads = Math.max(0, activeOverlayPreviewLoads - 1);
  drainOverlayPreviewLoadQueue();
}

function cancelDeferredOverlayPreview(frame) {
  dequeueDeferredOverlayPreview(frame);
  const iframe = frame.querySelector("iframe[data-overlay-src]");
  if (!iframe) return;
  completeDeferredOverlayPreview(iframe);
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

function bindOverlayRuntimeFrames(root = document) {
  for (const frame of observedOverlayRuntimeFrames) {
    if (frame.isConnected) continue;
    overlayRuntimeFrameObserver?.unobserve(frame);
    overlayPreviewVisibilityObserver?.unobserve(frame);
    cancelDeferredOverlayPreview(frame);
    observedOverlayRuntimeFrames.delete(frame);
  }
  root.querySelectorAll("[data-overlay-native-frame]").forEach((frame) => {
    if (!observedOverlayRuntimeFrames.has(frame)) {
      observedOverlayRuntimeFrames.add(frame);
      overlayRuntimeFrameObserver?.observe(frame);
    }
    const iframe = frame.querySelector("iframe");
    if (iframe && !iframe.dataset.overlayPreviewLoadBound) {
      iframe.dataset.overlayPreviewLoadBound = "true";
      iframe.addEventListener("load", () => {
        if (
          iframe.dataset.overlaySrc &&
          !iframe.dataset.overlayPreviewLoading
        ) return;
        iframe.dataset.overlayPreviewReady = "true";
        frame.classList.add("overlay-runtime-frame--ready");
        completeDeferredOverlayPreview(iframe);
      });
    }
    if (iframe?.dataset.overlaySrc) {
      if (overlayPreviewVisibilityObserver) {
        overlayPreviewVisibilityObserver.observe(frame);
      } else {
        queueDeferredOverlayPreview(frame);
      }
    }
    updateOverlayRuntimeFrameScale(frame);
  });
}
