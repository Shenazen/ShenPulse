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
    new URLSearchParams(location.search).get("native") === "1" ||
    location.protocol !== "https:" ||
    location.hostname !== "shenpulse-overlays.web.app" ||
    overlayRuntimeVersionTimer
  ) {
    return;
  }
  checkOverlayRuntimeVersion();
  overlayRuntimeVersionTimer = setInterval(checkOverlayRuntimeVersion, 15000);
}

function overlayFontStack(fontName) {
  return overlayFontStacks[String(fontName || "Inter").trim()] || overlayFontStacks.Inter;
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

let nativeOverlayShellFrame = null;

function overlayNativeSourceSize(viewName, catalog) {
  const definition = catalog?.definitions?.find(
    (item) => item?.route?.view === viewName && Array.isArray(item.sourceSize)
  );
  const [width, height] = definition?.sourceSize || [1920, 1080];
  return [Math.max(1, Number(width) || 1920), Math.max(1, Number(height) || 1080)];
}

function mountNativeOverlayShell(viewName, catalog) {
  const url = new URL(location.href);
  if (url.searchParams.get("native") === "1") return false;

  const [width, height] = overlayNativeSourceSize(viewName, catalog);
  const shell = document.createElement("div");
  const frame = document.createElement("iframe");
  const synchronize = () => {
    const viewportWidth = Math.max(1, window.innerWidth || width);
    const viewportHeight = Math.max(1, window.innerHeight || height);
    shell.style.setProperty(
      "--native-overlay-scale",
      String(Math.min(1, viewportWidth / width, viewportHeight / height))
    );
  };

  url.searchParams.set("native", "1");
  if (overlayRuntimeVersion) {
    url.searchParams.set("runtime", overlayRuntimeVersion);
  }
  shell.className = "native-overlay-shell";
  shell.style.setProperty("--native-overlay-width", `${width}px`);
  shell.style.setProperty("--native-overlay-height", `${height}px`);
  frame.title = "ShenPulse overlay";
  frame.src = url.toString();
  frame.setAttribute("scrolling", "no");
  frame.addEventListener("load", markOverlayReady, { once: true });
  shell.append(frame);
  document.getElementById("overlay-root")?.setAttribute("hidden", "");
  document.body.append(shell);
  nativeOverlayShellFrame = frame;
  synchronize();
  globalThis.addEventListener("resize", synchronize, { passive: true });
  return true;
}

function forwardNativeOverlayShellMessage(event) {
  if (
    !nativeOverlayShellFrame ||
    event.source !== window.parent ||
    event.data?.source !== "shenpulse-overlay-card"
  ) {
    return false;
  }
  const forward = () => nativeOverlayShellFrame.contentWindow?.postMessage(event.data, "*");
  if (nativeOverlayShellFrame.contentWindow) forward();
  else nativeOverlayShellFrame.addEventListener("load", forward, { once: true });
  return true;
}

(function loadOverlayDependencies() {
  if (new URLSearchParams(location.search).get("native") !== "1") return;
  const view = /^(?:\/match\/\d{12}\/[A-Za-z0-9_-]{32,128}|\/m\/\d{12}\/[A-Za-z0-9_-]{24,128})\/?$/i.test(
    location.pathname
  )
    ? "match"
    : new URLSearchParams(location.search).get("view") || "alerts";
  if (view !== "alerts") return;
  const script = document.createElement("script");
  script.src = "vendor/lottie-player.js";
  script.async = true;
  document.head.append(script);
})();
