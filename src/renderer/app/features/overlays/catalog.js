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
const overlayBackgroundPreviewCache = new Map();
const overlayBackgroundPreviewQueue = [];
const OVERLAY_BACKGROUND_PREVIEW_CONCURRENCY = 2;
const OVERLAY_BACKGROUND_PREVIEW_LIMIT = 2;
const overlayPreviewPriorityKeys = [];
let activeOverlayBackgroundPreviewLoads = 0;
let overlayPreviewWarmupTimer = null;
const overlayRuntimeFrameObserver = typeof ResizeObserver === "undefined"
  ? null
  : new ResizeObserver((entries) => {
    for (const entry of entries) updateOverlayRuntimeFrameScale(entry.target);
  });

function overlayBackgroundPreviewCacheKey(key, url) {
  return `${String(key || "")}\n${String(url || "")}`;
}

function overlayPreviewWarmupHost() {
  let host = document.querySelector("[data-overlay-preview-warmup-host]");
  if (host) return host;
  host = document.createElement("div");
  host.className = "overlay-preview-warmup-host";
  host.dataset.overlayPreviewWarmupHost = "true";
  host.setAttribute("aria-hidden", "true");
  document.body.appendChild(host);
  return host;
}

function scheduleOverlayPreviewWarmup(delayMs = 0) {
  if (overlayPreviewWarmupTimer) clearTimeout(overlayPreviewWarmupTimer);
  overlayPreviewWarmupTimer = setTimeout(() => {
    overlayPreviewWarmupTimer = null;
    warmOverlayRuntimePreviews();
  }, Math.max(0, Number(delayMs) || 0));
}

function prioritizeOverlayRuntimePreview(key) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return;
  const existingIndex = overlayPreviewPriorityKeys.indexOf(normalizedKey);
  if (existingIndex >= 0) overlayPreviewPriorityKeys.splice(existingIndex, 1);
  overlayPreviewPriorityKeys.unshift(normalizedKey);
  overlayPreviewPriorityKeys.splice(OVERLAY_BACKGROUND_PREVIEW_LIMIT);
  scheduleOverlayPreviewWarmup();
}

function warmOverlayRuntimePreviews() {
  if (!snapshot) return;
  const availableItems = overlayDefinitions().filter(
    (item) =>
      canAccessOverlay(item) &&
      !item.catalogHidden &&
      item.previewKind !== "match"
  );
  const visibleKeys = [...content.querySelectorAll("[data-overlay-card]")]
    .map((card) => card.dataset.overlayCard)
    .filter(Boolean);
  const priorities = [
    ...overlayPreviewPriorityKeys,
    ...visibleKeys,
    "likeGoal",
    "timer"
  ];
  const priorityIndex = new Map(
    priorities.map((key, index) => [key, index])
  );
  const items = [...availableItems]
    .sort((left, right) =>
      (priorityIndex.get(left.key) ?? Number.MAX_SAFE_INTEGER) -
      (priorityIndex.get(right.key) ?? Number.MAX_SAFE_INTEGER)
    )
    .slice(0, OVERLAY_BACKGROUND_PREVIEW_LIMIT);
  const desiredCacheKeys = new Set();
  for (const item of items) {
    const url = overlayRuntimePreviewUrl(item, overlayConfig(item.key), {
      context: "card"
    });
    if (!url) continue;
    const cacheKey = overlayBackgroundPreviewCacheKey(item.key, url);
    desiredCacheKeys.add(cacheKey);
    if (overlayBackgroundPreviewCache.has(cacheKey)) continue;
    const record = {
      cacheKey,
      iframe: null,
      inUse: false,
      item,
      loading: false,
      queued: true,
      ready: false,
      url
    };
    overlayBackgroundPreviewCache.set(cacheKey, record);
    overlayBackgroundPreviewQueue.push(record);
  }
  for (const [cacheKey, record] of overlayBackgroundPreviewCache) {
    if (desiredCacheKeys.has(cacheKey) || record.inUse) continue;
    discardOverlayBackgroundPreview(record);
  }
  drainOverlayBackgroundPreviewQueue();
}

function discardOverlayBackgroundPreview(record) {
  const queueIndex = overlayBackgroundPreviewQueue.indexOf(record);
  if (queueIndex >= 0) overlayBackgroundPreviewQueue.splice(queueIndex, 1);
  record.queued = false;
  if (record.loading) {
    record.loading = false;
    activeOverlayBackgroundPreviewLoads = Math.max(
      0,
      activeOverlayBackgroundPreviewLoads - 1
    );
  }
  record.iframe?.remove();
  overlayBackgroundPreviewCache.delete(record.cacheKey);
}

function drainOverlayBackgroundPreviewQueue() {
  while (
    activeOverlayBackgroundPreviewLoads <
      OVERLAY_BACKGROUND_PREVIEW_CONCURRENCY &&
    overlayBackgroundPreviewQueue.length
  ) {
    const record = overlayBackgroundPreviewQueue.shift();
    if (!record || !record.queued || record.iframe) continue;
    startOverlayBackgroundPreview(record);
  }
}

function startOverlayBackgroundPreview(record) {
  const iframe = document.createElement("iframe");
  record.iframe = iframe;
  record.loading = true;
  record.queued = false;
  activeOverlayBackgroundPreviewLoads += 1;
  iframe.dataset.overlayPreviewCacheKey = record.cacheKey;
  iframe.dataset.overlayPreviewKey = record.item.key;
  iframe.dataset.overlayPreviewWarm = "true";
  iframe.dataset.overlayRuntimePreview = "true";
  iframe.loading = "eager";
  iframe.tabIndex = -1;
  iframe.title = `Préchargement ${record.item.name}`;
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
  const [sourceWidth = 1920, sourceHeight = 1080] =
    record.item.sourceSize || [];
  iframe.style.setProperty("--overlay-warmup-width", `${sourceWidth}px`);
  iframe.style.setProperty("--overlay-warmup-height", `${sourceHeight}px`);
  const complete = (loaded) => {
    if (!record.loading) return;
    record.loading = false;
    if (loaded) {
      window.hydrateOverlayPreviewFrame?.(iframe);
    }
    activeOverlayBackgroundPreviewLoads = Math.max(
      0,
      activeOverlayBackgroundPreviewLoads - 1
    );
    drainOverlayBackgroundPreviewQueue();
  };
  iframe.addEventListener("load", () => complete(true), { once: true });
  iframe.addEventListener("error", () => complete(false), { once: true });
  iframe.src = record.url;
  overlayPreviewWarmupHost().appendChild(iframe);
}

function adoptWarmedOverlayPreview(frame) {
  const placeholderFrame = frame.querySelector("iframe");
  const key = frame.dataset.overlayPreviewKey || "";
  const url =
    placeholderFrame?.dataset.overlaySrc ||
    placeholderFrame?.getAttribute("src") ||
    "";
  const record = overlayBackgroundPreviewCache.get(
    overlayBackgroundPreviewCacheKey(key, url)
  );
  if (!placeholderFrame || !record?.iframe) return placeholderFrame;
  const iframe = record.iframe;
  placeholderFrame.remove();
  record.inUse = true;
  if (placeholderFrame.hasAttribute("data-overlay-live-preview")) {
    iframe.setAttribute("data-overlay-live-preview", "");
    iframe.removeAttribute("data-overlay-runtime-preview");
  } else {
    iframe.removeAttribute("data-overlay-live-preview");
    iframe.setAttribute("data-overlay-runtime-preview", "true");
  }
  delete iframe.dataset.overlayPreviewWarm;
  iframe.removeAttribute("aria-hidden");
  iframe.title = placeholderFrame.title;
  frame.appendChild(iframe);
  if (record.ready || iframe.dataset.overlayPreviewReady) {
    iframe.dataset.overlayPreviewReady = "true";
    frame.classList.add("overlay-runtime-frame--ready");
    window.hydrateOverlayPreviewFrame?.(iframe);
  }
  return iframe;
}

function preserveOverlayRuntimeFrames(root = document) {
  const host = overlayPreviewWarmupHost();
  root.querySelectorAll("[data-overlay-native-frame]").forEach((frame) => {
    const iframe = frame.querySelector(
      'iframe[data-overlay-runtime-preview="true"]'
    );
    if (!iframe) return;
    const key = frame.dataset.overlayPreviewKey || iframe.dataset.overlayPreviewKey;
    const url = iframe.dataset.overlaySrc || iframe.getAttribute("src") || "";
    if (!key || !url || url === "about:blank") return;
    const cacheKey = overlayBackgroundPreviewCacheKey(key, url);
    let record = overlayBackgroundPreviewCache.get(cacheKey);
    if (!record) {
      record = {
        cacheKey,
        iframe,
        inUse: true,
        item: { key, name: key },
        loading: false,
        queued: false,
        ready: iframe.dataset.overlayPreviewReady === "true",
        url
      };
      overlayBackgroundPreviewCache.set(cacheKey, record);
    }
    if (record.iframe !== iframe) return;
    record.inUse = false;
    iframe.dataset.overlayPreviewCacheKey = cacheKey;
    iframe.dataset.overlayPreviewKey = key;
    iframe.dataset.overlayPreviewWarm = "true";
    iframe.setAttribute("aria-hidden", "true");
    host.appendChild(iframe);
  });
  scheduleOverlayPreviewWarmup();
}
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
    const iframe = adoptWarmedOverlayPreview(frame);
    if (iframe && !iframe.dataset.overlayPreviewLoadBound) {
      iframe.dataset.overlayPreviewLoadBound = "true";
      iframe.addEventListener("load", () => {
        if (
          iframe.dataset.overlaySrc &&
          !iframe.dataset.overlayPreviewLoading
        ) return;
        completeDeferredOverlayPreview(iframe);
        window.hydrateOverlayPreviewFrame?.(iframe);
      });
    }
    if (iframe?.dataset.overlayPreviewReady === "true") {
      frame.classList.add("overlay-runtime-frame--ready");
      window.hydrateOverlayPreviewFrame?.(iframe);
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
  iframe
    .closest("[data-overlay-native-frame]")
    ?.classList.add("overlay-runtime-frame--ready");
  const record = overlayBackgroundPreviewCache.get(
    iframe.dataset.overlayPreviewCacheKey || ""
  );
  if (record?.iframe === iframe) record.ready = true;
});
