"use strict";

/** Optional, memory-only capture of one explicitly selected window. The page
 * receives no account data, network permission or arbitrary IPC capability. */
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { randomUUID } = require("node:crypto");
const { sameLocalDocumentUrl } = require("../integration-ipc-access");

const PAGE_PATH = path.join(__dirname, "..", "..", "renderer", "match-vision.html");
const PAGE_URL = pathToFileURL(PAGE_PATH).href;
const SCRIPT_URL = pathToFileURL(path.join(path.dirname(PAGE_PATH), "match-vision.js")).href;
const PRELOAD_PATH = path.join(__dirname, "visual-capture-preload.js");
const PNG_HEADER = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const FRAME_LIMIT = 3 * 1024 * 1024;
const PREVIEW_LIMIT = 12 * 1024 * 1024;

function normalizeCaptureROI(input, maxArea) {
  if (!input || typeof input !== "object") throw new Error("Zone de lecture manquante.");
  const result = Object.fromEntries(["x", "y", "width", "height"].map((key) => [key, input[key]]));
  if (Object.values(result).some((value) => typeof value !== "number" || !Number.isFinite(value)) ||
    result.x < 0 || result.y < 0 || result.width <= 0 || result.height <= 0 ||
    result.x + result.width > 1 || result.y + result.height > 1 || result.width * result.height > maxArea) {
    throw new Error("Zone de lecture invalide ou trop grande.");
  }
  return result;
}

function pngBytes(value, limit, maxWidth, maxHeight) {
  if (typeof value !== "string" || value.length > Math.ceil(limit * 4 / 3) + 64 ||
    !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error("Image de lecture invalide.");
  const bytes = Buffer.from(value.slice(22), "base64");
  if (bytes.length < 33 || bytes.length > limit || !bytes.subarray(0, 8).equals(PNG_HEADER) ||
    bytes.toString("ascii", 12, 16) !== "IHDR") throw new Error("Image de lecture invalide.");
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (!width || !height || width > maxWidth || height > maxHeight) throw new Error("Image de lecture trop grande.");
  return bytes;
}

function createVisualCapture({ BrowserWindow, desktopCapturer, ipcMain, onFrame = () => {}, onStatus = () => {} }) {
  if (!BrowserWindow || !desktopCapturer || !ipcMain) throw new Error("Capture locale indisponible.");
  const partition = `shenpulse-vision-${randomUUID()}`;
  let current = null, generation = 0;
  const status = (state, item) => { try { onStatus({ state, generation: item?.generation ?? generation }); } catch { /* Status is not authority. */ } };
  const isCurrent = (item) => current === item && generation === item.generation && !item.closed;
  const trusted = (event, item) => {
    try {
      const contents = item.window.webContents;
      return isCurrent(item) && !item.window.isDestroyed() && !contents.isDestroyed() && event.sender === contents &&
        event.senderFrame === contents.mainFrame && sameLocalDocumentUrl(contents.getURL(), PAGE_URL) &&
        sameLocalDocumentUrl(event.senderFrame.url, PAGE_URL);
    } catch { return false; }
  };
  async function listSources() {
    const rows = await desktopCapturer.getSources({ types: ["window"], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false });
    return rows.filter((row) => /^window:\d+:\d+$/.test(row.id)).map((row) => ({
      id: row.id, name: String(row.name || "Fenêtre").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 180)
    }));
  }
  async function stop() {
    generation += 1;
    const item = current; current = null;
    if (!item) return;
    item.closed = true;
    clearTimeout(item.timeout); clearTimeout(item.startupTimeout);
    item.rejectStartup?.(new Error("Lecture interrompue.")); item.rejectStartup = null;
    item.rejectPreview?.(new Error("Aperçu interrompu.")); item.rejectPreview = null;
    ipcMain.removeHandler(item.frameChannel); ipcMain.removeHandler(item.statusChannel);
    try { item.window.webContents.send(item.stopChannel); } catch { /* Destroy below also stops media tracks. */ }
    try { item.window.destroy(); } catch { /* Already closed. */ }
    try { item.session.setDisplayMediaRequestHandler(null); } catch { /* Private session may be destroyed. */ }
    try { item.session.setPermissionRequestHandler(null); item.session.setPermissionCheckHandler(null); } catch { /* Closed. */ }
    try { item.session.webRequest.onBeforeRequest(null); } catch { /* Closed. */ }
    try { item.session.removeListener("will-download", item.downloadHandler); } catch { /* Closed. */ }
    status("stopped", item);
  }
  async function begin(options, mode) {
    const stopping = stop(), expectedGeneration = generation;
    await stopping;
    const sourceId = typeof options.sourceId === "string" ? options.sourceId : "";
    if (!/^window:\d+:\d+$/.test(sourceId)) throw new Error("Choisissez une fenêtre, pas un écran.");
    const declaredScreen = mode === "monitor" && options.ownerMode === "self-screen";
    if (declaredScreen && options.ownScreenConfirmed !== true) throw new Error("Confirmez explicitement votre propre écran avant la lecture.");
    const bannerROI = mode === "monitor" ? normalizeCaptureROI(options.bannerROI, 0.3) : null;
    const ownerROI = mode === "monitor" && !declaredScreen ? normalizeCaptureROI(options.ownerROI, 0.1) : null;
    const sources = await desktopCapturer.getSources({ types: ["window"], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false });
    const source = sources.find((row) => row.id === sourceId);
    if (!source || expectedGeneration !== generation) throw new Error("La fenêtre sélectionnée n’est plus disponible.");
    const channel = `shenpulse-vision-${randomUUID()}`, token = randomUUID();
    const item = { generation, sourceId, token, mode, closed: false, busy: false, captureGranted: false,
      desktopPermissionArmed: false, desktopPermissionUsed: false, desktopPermissionExpiresAtMs: 0,
      resolvePreview: options.resolvePreview, rejectPreview: options.rejectPreview,
      frameChannel: `${channel}:frame`, statusChannel: `${channel}:status`, stopChannel: `${channel}:stop`, startedAtMs: Date.now() };
    const window = new BrowserWindow({ show: false, width: 320, height: 180, skipTaskbar: true,
      webPreferences: { preload: PRELOAD_PATH, partition, contextIsolation: true, sandbox: true,
        nodeIntegration: false, webSecurity: true, backgroundThrottling: false, spellcheck: false, devTools: false,
        additionalArguments: [`--shenpulse-vision-channel=${channel}`] } });
    item.window = window; item.session = window.webContents.session; current = item;
    const contents = window.webContents, session = item.session;
    contents.setAudioMuted(true);
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    for (const name of ["will-navigate", "will-redirect", "will-frame-navigate", "will-attach-webview"]) contents.on(name, (event) => event.preventDefault());
    session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: ![PAGE_URL, SCRIPT_URL].includes(details.url) }));
    item.downloadHandler = (event, download) => { event.preventDefault(); download?.cancel?.(); };
    session.on("will-download", item.downloadHandler);
    const desktopRequestCurrent = (requester, details) => requester === contents && isCurrent(item) && !item.captureGranted &&
      item.desktopPermissionArmed && Date.now() <= item.desktopPermissionExpiresAtMs && details?.isMainFrame === true &&
      sameLocalDocumentUrl(details.requestingUrl, PAGE_URL) && sameLocalDocumentUrl(contents.getURL(), PAGE_URL) &&
      sameLocalDocumentUrl(contents.mainFrame.url, PAGE_URL);
    session.setPermissionCheckHandler((requester, permission, _origin, details) => permission === "display-capture" && desktopRequestCurrent(requester, details));
    session.setPermissionRequestHandler((requester, permission, callback, details) => {
      // Electron 43 asks for one empty-types "media" permission before its
      // display handler. Camera/microphone requests contain media types and
      // remain denied. Only our immediate, one-shot desktop start is armed.
      const desktop = permission === "media" && !item.desktopPermissionUsed && Array.isArray(details?.mediaTypes) &&
        details.mediaTypes.length === 0 && desktopRequestCurrent(requester, details);
      if (desktop) item.desktopPermissionUsed = true;
      callback(desktop || permission === "display-capture" && desktopRequestCurrent(requester, details));
    });
    session.setDisplayMediaRequestHandler((request, callback) => {
      if (!isCurrent(item) || item.captureGranted || !item.desktopPermissionArmed || Date.now() > item.desktopPermissionExpiresAtMs || request.frame !== contents.mainFrame ||
        !sameLocalDocumentUrl(request.frame?.url, PAGE_URL) || !request.videoRequested || request.audioRequested) return callback(null);
      item.captureGranted = true; callback({ video: source });
    }, { useSystemPicker: false });
    ipcMain.handle(item.statusChannel, (event, payload) => {
      if (!trusted(event, item) || payload?.token !== token) return { accepted: false };
      if (["ended", "error"].includes(payload.state)) { status(payload.state, item); void stop(); }
      return { accepted: true };
    });
    ipcMain.handle(item.frameChannel, async (event, payload) => {
      if (!trusted(event, item) || payload?.token !== token || item.busy || payload.mode !== mode) return { accepted: false };
      item.busy = true;
      let banner, owner;
      try {
        if (mode === "preview") {
          const bytes = pngBytes(payload.image, PREVIEW_LIMIT, 1920, 1080);
          item.resolvePreview?.(`data:image/png;base64,${bytes.toString("base64")}`); item.resolvePreview = null; item.rejectPreview = null;
          return { accepted: true, stop: true };
        }
        const at = Date.now();
        if (!Number.isSafeInteger(payload.capturedAtMs) || payload.capturedAtMs < Math.max(item.startedAtMs, at - 5000) || payload.capturedAtMs > at + 1000) return { accepted: false };
        banner = pngBytes(payload.banner, FRAME_LIMIT, 1600, 600);
        if (declaredScreen) {
          // No identity crop was consented in this mode. Never pass or parse
          // an extra image even if a renderer sends one unexpectedly.
          if (payload.owner !== null && payload.owner !== undefined) throw new Error("Zone d’identité inattendue.");
        } else owner = pngBytes(payload.owner, FRAME_LIMIT, 1200, 400);
        await onFrame({ banner, owner, capturedAtMs: Math.min(at, payload.capturedAtMs), sourceId, generation: item.generation });
        return { accepted: isCurrent(item), stop: !isCurrent(item) };
      } catch { status("error", item); if (isCurrent(item)) void stop(); return { accepted: false, stop: true }; }
      finally { banner?.fill(0); owner?.fill(0); item.busy = false; }
    });
    window.on("closed", () => { if (isCurrent(item)) void stop(); });
    contents.on("render-process-gone", () => { if (isCurrent(item)) { status("error", item); void stop(); } });
    status(mode === "preview" ? "preview" : "starting", item);
    try {
      const startup = (async () => {
        await window.loadFile(PAGE_PATH);
        if (!isCurrent(item)) throw new Error("Lecture interrompue.");
        const command = { token, mode, bannerROI, ownerROI, ...(declaredScreen ? { ownerMode: "self-screen" } : {}), intervalMs: 500 };
        item.desktopPermissionArmed = true; item.desktopPermissionExpiresAtMs = Date.now() + 5000;
        const started = await contents.executeJavaScript(`window.startShenPulseVisionCapture(${JSON.stringify(command)})`, true);
        item.desktopPermissionArmed = false;
        if (!started || !isCurrent(item)) throw new Error("Lecture locale indisponible.");
      })();
      const cancelled = new Promise((_resolve, reject) => {
        item.rejectStartup = reject;
        item.startupTimeout = setTimeout(() => reject(new Error("Lecture locale indisponible.")), 15000);
      });
      await Promise.race([startup, cancelled]);
      return item;
    } catch (error) { if (isCurrent(item)) await stop(); throw error; }
    finally { clearTimeout(item.startupTimeout); item.rejectStartup = null; item.desktopPermissionArmed = false; }
  }
  async function start(options) {
    const item = await begin(options, "monitor"); status("running", item);
    return { generation: item.generation };
  }
  async function preview(sourceId) {
    let resolvePreview, rejectPreview;
    const result = new Promise((resolve, reject) => { resolvePreview = resolve; rejectPreview = reject; });
    // Prevent a startup failure from leaving a rejected promise unobserved.
    result.catch(() => {});
    const item = await begin({ sourceId, resolvePreview, rejectPreview }, "preview");
    item.timeout = setTimeout(() => { rejectPreview(new Error("Aperçu local indisponible.")); if (isCurrent(item)) void stop(); }, 10000);
    try { return await result; } finally { if (isCurrent(item)) await stop(); }
  }
  return { listSources, start, stop, preview };
}

module.exports = { createVisualCapture, normalizeCaptureROI, pngBytes };
