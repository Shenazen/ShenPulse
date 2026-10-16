"use strict";

const path = require("node:path");
const { fileURLToPath } = require("node:url");
const { performance } = require("node:perf_hooks");

/** Splash purement visuelle : aucune identité, aucun preload, aucun service.
 * La fenêtre principale n'est libérée qu'après son premier rendu réel ET
 * cinq secondes visibles. Horloge et fenêtres sont injectables pour les tests.
 */
function createStartupWindow({ BrowserWindow, splashPath, onReady, onCancel, onFailure,
  now = () => performance.now(), schedule = setTimeout, cancel = clearTimeout,
  minimumMs = 5000, maximumMs = 20000 }) {
  const splash = new BrowserWindow({
    width: 760, height: 480, center: true, backgroundColor: "#070913",
    show: false, frame: false, resizable: false, maximizable: false,
    minimizable: false, fullscreenable: false, title: "ShenPulse",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true,
      webSecurity: true, javascript: false, spellcheck: false, devTools: false,
      partition: "shenpulse-startup" }
  });
  let settled = false, released = false, rendererReady = false, shownAt = null, intentionalClose = false;
  let minimumTimer = null, maximumTimer = null;
  const clearTimers = () => {
    if (minimumTimer !== null) cancel(minimumTimer);
    if (maximumTimer !== null) cancel(maximumTimer);
    minimumTimer = null; maximumTimer = null;
  };
  const destroySplash = () => { intentionalClose = true; if (!splash.isDestroyed()) splash.destroy(); };
  const finish = () => {
    if (settled || !rendererReady || shownAt === null) return;
    const remaining = minimumMs - (now() - shownAt);
    if (remaining > 0) {
      if (minimumTimer === null) minimumTimer = schedule(() => { minimumTimer = null; finish(); }, Math.ceil(remaining));
      return;
    }
    settled = true; released = true; clearTimers();
    // La principale est affichée avant le retrait du splash pour éviter un
    // flash du bureau. Le splash n'est jamais réutilisé pour l'authentification.
    try { onReady(); } finally { destroySplash(); }
  };
  const cancelStartup = () => {
    if (settled) return;
    settled = true; clearTimers(); onCancel();
  };
  const fail = (error) => {
    if (settled) return;
    settled = true; clearTimers(); destroySplash(); onFailure(error);
  };
  const unavailable = () => {
    if (settled) return;
    // Une image/HTML de splash défectueuse ne condamne pas une application
    // prête à fonctionner ; seule l'attente décorative est alors abandonnée.
    shownAt = now() - minimumMs;
    if (minimumTimer !== null) cancel(minimumTimer);
    minimumTimer = null;
    destroySplash(); finish();
  };
  const rendererDirectory = path.dirname(splashPath);
  splash.webContents.session.setPermissionCheckHandler(() => false);
  splash.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  splash.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    let allowed = false;
    try {
      const url = new URL(details.url);
      if (url.protocol === "file:" && !url.hostname && !url.search && !url.hash) {
        const filename = fileURLToPath(url), relative = path.relative(rendererDirectory, filename);
        const sameDocument = process.platform === "win32"
          ? filename.toLowerCase() === splashPath.toLowerCase() : filename === splashPath;
        allowed = Boolean(relative && !relative.startsWith("..") && !path.isAbsolute(relative) &&
          (sameDocument || /\.(?:css|png|webp|svg|ico|woff2?)$/i.test(filename)));
      }
    } catch { /* Toute origine non locale est refusée, y compris data:/http(s). */ }
    callback({ cancel: !allowed });
  });
  splash.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  splash.webContents.on("will-navigate", (event) => event.preventDefault());
  splash.webContents.on("did-fail-load", (_event, code, _description, _url, mainFrame) => {
    if (mainFrame !== false && code !== -3) unavailable();
  });
  splash.webContents.on("render-process-gone", unavailable);
  splash.once("ready-to-show", () => {
    if (settled || shownAt !== null || splash.isDestroyed()) return;
    splash.show(); shownAt = now();
    minimumTimer = schedule(() => { minimumTimer = null; finish(); }, minimumMs);
  });
  splash.on("close", cancelStartup);
  splash.on("closed", () => { if (!settled && !intentionalClose) cancelStartup(); });
  maximumTimer = schedule(() => fail(new Error("Le démarrage de ShenPulse a dépassé le délai prévu. Relancez l'application.")), maximumMs);
  Promise.resolve(splash.loadFile(splashPath)).catch(unavailable);
  return {
    get released() { return released; },
    ownsWindow: (window) => window === splash,
    ready() { if (settled) return false; rendererReady = true; finish(); return true; },
    focus() {
      if (settled) return false;
      if (shownAt !== null && !splash.isDestroyed()) splash.focus();
      return true;
    },
    fail,
    dispose() { if (!settled) { settled = true; clearTimers(); } destroySplash(); }
  };
}

module.exports = { createStartupWindow };
