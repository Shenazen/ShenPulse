"use strict";

/** Charge les bibliothèques lourdes uniquement pour la source qui les utilise. */

const overlayFontStacks = Object.freeze({
  Inter: '"Inter", "Segoe UI", Arial, sans-serif',
  Arial: 'Arial, "Segoe UI", sans-serif',
  Georgia: 'Georgia, "Times New Roman", serif',
  Impact: 'Impact, "Arial Black", sans-serif',
  Verdana: 'Verdana, Arial, sans-serif'
});

const overlayRuntimeVersion = String(
  document.querySelector('meta[name="shenpulse-overlay-version"]')?.content || ""
).trim();
let overlayRuntimeVersionTimer = null;

function readEarlyPublicRelayCache(channel) {
  try {
    const value = JSON.parse(
      localStorage.getItem(`shenpulse-overlay-v2:${channel}`) || "null"
    );
    if (
      !value ||
      Date.now() - Number(value.cachedAt || 0) > 6 * 60 * 60 * 1000 ||
      !value.document ||
      typeof value.document !== "object"
    ) {
      return null;
    }
    return value.document;
  } catch {
    return null;
  }
}

function startEarlyPublicRelayBootstrap() {
  const query = new URLSearchParams(location.search);
  if (["static", "animated"].includes(query.get("preview"))) return;
  const matchRoute = /^\/m\/\d{12}\/([A-Za-z0-9_-]{24,128})\/?$/i.exec(
    location.pathname
  );
  const channel = matchRoute?.[1] || query.get("channel") || "";
  if (!channel) return;
  const cachedDocument = readEarlyPublicRelayCache(channel);
  const url = `https://shenazenoverlay-default-rtdb.firebaseio.com/publicOverlayRelay/${encodeURIComponent(channel)}.json`;
  const request = fetch(url, { cache: "no-store" })
    .then((response) => response.ok ? response.json() : null)
    .then((documentValue) =>
      documentValue && typeof documentValue === "object" ? documentValue : null
    )
    .catch(() => null);
  globalThis.shenPulseRelayBootstrap = { cachedDocument, channel, request };
}

startEarlyPublicRelayBootstrap();

async function checkOverlayRuntimeVersion() {
  try {
    const versionUrl = new URL("/runtime-version.json", location.origin);
    versionUrl.searchParams.set("_", Date.now());
    const response = await fetch(versionUrl, { cache: "no-store" });
    if (!response.ok) return;
    const publishedVersion = String((await response.json())?.version || "").trim();
    if (publishedVersion && overlayRuntimeVersion && publishedVersion !== overlayRuntimeVersion) {
      location.reload();
    }
  } catch {
    // La source reste active hors ligne et réessaie au prochain passage.
  }
}

function startOverlayRuntimeVersionMonitor() {
  if (
    location.protocol !== "https:" ||
    location.hostname !== "shenpulse-overlays.web.app" ||
    overlayRuntimeVersionTimer
  ) {
    return;
  }
  overlayRuntimeVersionTimer = setInterval(checkOverlayRuntimeVersion, 15000);
}

function overlayFontStack(fontName) {
  return overlayFontStacks[String(fontName || "Inter").trim()] || overlayFontStacks.Inter;
}

function mediaUrl(relativePath) {
  const runtimeBase =
    location.origin && location.origin !== "null" ? location.origin : location.href;
  const versioned = (value) => {
    const url = new URL(value, runtimeBase);
    if (overlayRuntimeVersion) url.searchParams.set("v", overlayRuntimeVersion);
    return url.toString();
  };
  if (relayChannel) {
    if (/^lottie\/[^/]+\.json$/i.test(relativePath)) {
      return `https://tikfinity.zerody.one/assets/lotties/${encodeURIComponent(
        String(relativePath).slice("lottie/".length)
      )}`;
    }
    return versioned(`/media/${String(relativePath)
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/")}`);
  }
  const url = new URL(`/overlay/media/${relativePath}`, runtimeBase);
  url.searchParams.set("token", token);
  if (overlayRuntimeVersion) url.searchParams.set("v", overlayRuntimeVersion);
  return url.toString();
}

function configureLikeGoalViewport(viewName, activeView) {
  if (viewName !== "like-goal") return;
  const synchronize = () => {
    const width = Math.max(1, activeView.clientWidth || window.innerWidth || 1300);
    const height = Math.max(1, activeView.clientHeight || window.innerHeight || 200);
    document.documentElement.style.setProperty(
      "--like-goal-viewport-scale",
      String(Math.min(1, width / 1300, height / 200))
    );
  };
  synchronize();
  globalThis.addEventListener("resize", synchronize, { passive: true });
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(synchronize);
    observer.observe(activeView);
  }
}

function configureNativeOverlayCanvas(viewName, activeView, catalog) {
  const [width, height] = overlayNativeSourceSize(viewName, catalog);
  const synchronize = () => {
    const viewportWidth = Math.max(1, window.innerWidth || width);
    const viewportHeight = Math.max(1, window.innerHeight || height);
    activeView.style.setProperty(
      "--native-canvas-scale",
      String(Math.min(1, viewportWidth / width, viewportHeight / height))
    );
  };
  activeView.classList.add("native-overlay-canvas");
  activeView.style.setProperty("--native-canvas-width", `${width}px`);
  activeView.style.setProperty("--native-canvas-height", `${height}px`);
  synchronize();
  globalThis.addEventListener("resize", synchronize, { passive: true });
}

function overlayNativeSourceSize(viewName, catalog) {
  const definition = catalog?.definitions?.find(
    (item) => item?.route?.view === viewName && Array.isArray(item.sourceSize)
  );
  const [width, height] = definition?.sourceSize || [1920, 1080];
  return [Math.max(1, Number(width) || 1920), Math.max(1, Number(height) || 1080)];
}

(function loadOverlayDependencies() {
  const view = /^(?:\/match\/\d{12}\/[A-Za-z0-9_-]{32,128}|\/m\/\d{12}\/[A-Za-z0-9_-]{24,128})\/?$/i.test(
    location.pathname
  )
    ? "match"
    : new URLSearchParams(location.search).get("view") || "alerts";
  if (view !== "alerts") return;
  const script = document.createElement("script");
  script.src = `vendor/lottie-player.js?v=${encodeURIComponent(overlayRuntimeVersion)}`;
  script.async = true;
  document.head.append(script);
})();
