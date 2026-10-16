"use strict";

/** Real Electron -> selected synthetic window -> Windows OCR -> real match
 * service. No user window is selected; no images, OCR text, secrets, LIVE
 * connections or network requests are written or sent. Bounded to 55 seconds. */
if (!process.versions.electron) {
  const { spawnSync } = require("node:child_process"), environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const argumentsList = [__filename, ...(process.argv.includes("--debug-synthetic") ? ["--debug-synthetic"] : [])];
  const result = spawnSync(require("electron"), argumentsList, { env: environment, windowsHide: true,
    encoding: "utf8", timeout: 60000, maxBuffer: 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  const reports = String(result.stdout || "").split(/\r?\n/).flatMap((line) => {
    try { const value = JSON.parse(line); return value.test === "match-visual-synthetic" ? [value] : []; } catch { return []; }
  });
  process.stdout.write(JSON.stringify(reports.at(-1) || { test: "match-visual-synthetic", ok: false, failure: "electron-start-or-deadline" }) + "\n");
  process.exit(result.status ?? 1);
}

const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { randomUUID } = require("node:crypto");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, desktopCapturer, ipcMain } = require("electron");
const { createVisualCapture } = require("../src/main/matches/visual-capture");
const { createWindowsOcr } = require("../src/main/matches/windows-ocr");
const { MatchVisualService } = require("../src/main/matches/visual-service");
const { parseVisualBonusBanner } = require("../src/main/matches/visual-bonus");
const { MatchesService } = require("../src/main/matches/service");
const { normalizeMatchesConfig, createMatchSession } = require("../src/shared/matches-contract");
const { selectStatePaths } = require("../src/main/state-projection");
const { sameLocalDocumentUrl } = require("../src/main/integration-ipc-access");

const isolated = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-vision-synthetic-"));
app.setPath("userData", path.join(isolated, "chromium"));
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND");
app.commandLine.appendSwitch("disable-breakpad");
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

const report = { test: "match-visual-synthetic", ok: false, syntheticWindowOnly: true,
  frames: 0, ocrRequests: 0, ocrAvailable: false, ownerExact: false, twoDetected: false, threeDetected: false,
  runtimeTwo: false, runtimeThree: false, exactlyTwoEffects: false, networkRequestsBlocked: 0 };
const startedAtMs = Date.now(), effects = [];
const scope = { ownerUid: "synthetic-vision-account", profileId: "synthetic-vision-profile" };
const OWN = "10001", ROOM = "10002", BATTLE = "10003", HANDLE = "fixture_creator";
let target, visual, matches, selectedSourceId = "", finished = false, stage = "startup";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deadline = setTimeout(() => { void finish(false, "deadline"); }, 55000);

async function waitUntil(predicate, milliseconds = 15000) {
  const expiresAt = Math.min(Date.now() + milliseconds, startedAtMs + 52000);
  while (!finished && Date.now() < expiresAt) {
    if (predicate()) return;
    if (visual && visual.status().state === "unavailable") throw new Error("capture-unavailable");
    await delay(100);
  }
  throw new Error("condition");
}
async function finish(ok, failure) {
  if (finished) return; finished = true; clearTimeout(deadline);
  try { await visual?.close(); } catch { /* Synthetic cleanup only. */ }
  try { matches?.reset(); } catch { /* Synthetic cleanup only. */ }
  try { if (target && !target.isDestroyed()) target.destroy(); } catch { /* Already closed. */ }
  report.ok = ok; report.elapsedMs = Date.now() - startedAtMs;
  if (!ok) report.failure = failure;
  process.stdout.write(JSON.stringify(report) + "\n");
  app.exit(ok ? 0 : 1);
}
function InstrumentedCaptureWindow(options) {
  const window = new BrowserWindow(options), loadFile = window.loadFile.bind(window);
  const execute = window.webContents.executeJavaScript.bind(window.webContents);
  const session = window.webContents.session;
  const check = session.setPermissionCheckHandler.bind(session), request = session.setPermissionRequestHandler.bind(session);
  const display = session.setDisplayMediaRequestHandler.bind(session);
  const permissionName = (value) => ["media", "display-capture"].includes(value) ? value : "other";
  session.setPermissionCheckHandler = (handler) => check(handler && ((...args) => {
    const allowed = handler(...args); report.permissionCheck = permissionName(args[1]); report.permissionCheckAllowed = allowed; return allowed;
  }));
  session.setPermissionRequestHandler = (handler) => request(handler && ((contents, permission, callback, details) => {
    report.permissionRequest = permissionName(permission);
    report.requestMediaVideoOnly = Array.isArray(details.mediaTypes) && details.mediaTypes.length === 1 && details.mediaTypes[0] === "video";
    report.requestHasMediaTypes = Array.isArray(details.mediaTypes); report.requestMediaCount = Array.isArray(details.mediaTypes) ? details.mediaTypes.length : 0;
    report.requestIncludesAudio = Array.isArray(details.mediaTypes) && details.mediaTypes.includes("audio");
    report.requestIncludesVideo = Array.isArray(details.mediaTypes) && details.mediaTypes.includes("video");
    report.requestMediaTypeVideo = details.mediaType === "video"; report.requestMediaTypeUnknown = details.mediaType === "unknown";
    report.requestMainFrame = details.isMainFrame === true; report.requestContentsMatches = contents === window.webContents;
    report.requestDocumentMatches = sameLocalDocumentUrl(details.requestingUrl, pathToFileURL(path.join(__dirname, "../src/renderer/match-vision.html")).href);
    return handler(contents, permission, (allowed) => { report.permissionRequestAllowed = allowed; callback(allowed); }, details);
  }));
  session.setDisplayMediaRequestHandler = (handler, settings) => display(handler && ((value, callback) => {
    report.displayRequested = true; report.displayFrameMatches = value.frame === window.webContents.mainFrame;
    report.displayVideoRequested = value.videoRequested; report.displayAudioRequested = value.audioRequested;
    return handler(value, (streams) => { report.displayGranted = Boolean(streams?.video); callback(streams); });
  }), settings);
  window.loadFile = async (...args) => {
    await loadFile(...args);
    // Observe only an exception name in our own private capture document.
    // This does not change the constraints, selection, permission or stream.
    await execute(`(() => { const original=navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getDisplayMedia=async options=>{try{return await original(options)}catch(error){globalThis.syntheticMediaErrorName=error.name;throw error}};
    })()`);
  };
  window.webContents.executeJavaScript = async (...args) => {
    const result = await execute(...args);
    if (result === false) {
      const status = await execute("({name:globalThis.syntheticMediaErrorName||'',focused:document.hasFocus(),hidden:document.hidden,ready:document.getElementById('capture').readyState})");
      report.captureErrorName = ["InvalidStateError", "NotAllowedError", "AbortError", "NotFoundError", "NotReadableError", "OverconstrainedError", "TypeError", "SecurityError", ""].includes(status.name) ? status.name : "other";
      report.captureFocused = status.focused; report.captureHidden = status.hidden; report.videoReady = status.ready;
    }
    return result;
  };
  return window;
}
function syntheticHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'"><style>
    html,body{margin:0;width:1200px;height:220px;background:white;color:black;overflow:hidden;font-family:Arial,sans-serif}
    #owner{position:absolute;left:12px;top:2px;font-size:30px;font-weight:600;line-height:38px}
    #banner{position:absolute;left:12px;top:58px;font-size:44px;line-height:54px;white-space:nowrap}
    </style></head><body><div id="owner">@${HANDLE}</div><div id="banner"></div><script>
    window.syntheticBonus={multiplier:2,endsAtMs:Date.now()+30000};
    function update(){const v=window.syntheticBonus;document.getElementById('banner').textContent='x'+v.multiplier+' points Cadeaux '+Math.max(1,Math.ceil((v.endsAtMs-Date.now())/1000))+' s';}
    update();setInterval(update,50);
    </script></body></html>`;
}
async function run() {
  assert.equal(process.platform, "win32");
  stage = "synthetic-window";
  target = new BrowserWindow({ width: 1200, height: 220, useContentSize: true, frame: false, show: false,
    title: "ShenPulse synthetic OCR test - no LIVE", backgroundColor: "#ffffff",
    webPreferences: { partition: `synthetic-vision-target-${randomUUID()}`, nodeIntegration: false, sandbox: true,
      contextIsolation: true, webSecurity: true, backgroundThrottling: false, spellcheck: false } });
  target.webContents.setAudioMuted(true);
  target.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  target.webContents.session.setPermissionCheckHandler(() => false);
  target.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  target.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const allowed = details.url.startsWith("data:text/html,");
    if (!allowed) report.networkRequestsBlocked += 1;
    callback({ cancel: !allowed });
  });
  await target.loadURL("data:text/html," + encodeURIComponent(syntheticHtml()));
  target.showInactive();
  selectedSourceId = target.getMediaSourceId();
  assert.match(selectedSourceId, /^window:\d+:\d+$/);
  await delay(350);

  const now = Date.now();
  const state = { settings: { account: { uid: scope.ownerUid, email: "synthetic@example.invalid", refreshTokenSecretId: "synthetic-only" },
    tiktok: { username: HANDLE, roomId: ROOM, status: "live", broadcaster: { userId: OWN, username: HANDLE } },
    matches: normalizeMatchesConfig(), overlayConfigs: {}, siteVisibility: {} },
    connections: [{ id: "source_tiktok", enabled: true, type: "tiktok-direct", config: { username: HANDLE } }],
    session: { running: true, profileId: scope.profileId, startedAt: new Date(now).toISOString() },
    commerce: { subscription: { tier: "pro", status: "active" } }, matchSession: createMatchSession(), rules: [], profiles: [] };
  const store = { getStateProjection: (paths) => selectStatePaths(state, paths), getAccountSession: () => state.settings.account,
    getSecret: () => "synthetic-only", mutate: (callback) => callback(state), mutateRuntime: (callback) => callback(state) };
  matches = new MatchesService({ store, actionRunner: { run: async (_action, event) => {
    if (event.shouldExecute()) effects.push({ moment: event.data.moment, atMs: Date.now() });
    return { executed: true };
  } } });
  for (const moment of ["multiplierX2", "multiplierX3"]) matches.saveAutomation({ id: moment, moment, enabled: true,
    reaction: { type: "sound", url: "https://synthetic.invalid/inert-never-fetched.mp3" } });
  matches.handle({ source: "source_tiktok", phase: "start", id: "synthetic-open", roomId: ROOM, channelUsername: HANDLE,
    battleId: BATTLE, receivedAtMs: now, startsAtMs: now, endsAtMs: now + 120000,
    participants: [{ id: OWN, username: HANDLE, score: 0 }, { id: "10004", username: "synthetic_rival", score: 0 }] });
  visual = new MatchVisualService({ store, matches,
    createCapture: (callbacks) => createVisualCapture({ BrowserWindow: InstrumentedCaptureWindow, ipcMain,
      desktopCapturer: { getSources: async (options) => {
        assert.deepEqual(options, { types: ["window"], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false });
        const sources = await desktopCapturer.getSources(options);
        return sources.filter((source) => source.id === selectedSourceId);
      } },
      onStatus: (status) => { report.captureState = status.state; callbacks.onStatus(status); },
      onFrame: async (frame) => {
        assert.equal(frame.sourceId, selectedSourceId, "Only the synthetic window may be captured");
        report.frames += 1; await callbacks.onFrame(frame);
        report.maximumFrameAgeMs = Math.max(report.maximumFrameAgeMs || 0, Date.now() - frame.capturedAtMs);
      } }),
    createOcr: () => {
      const ocr = createWindowsOcr();
      return { close: () => ocr.close(), recognize: async (bytes) => {
        report.ocrRequests += 1;
        const result = await ocr.recognize(bytes);
        report.ocrAvailable ||= result.available;
        report.ownerExact ||= result.lines.some((line) => line.text.toLowerCase() === `@${HANDLE}`);
        const lines = result.lines.map((line) => line.text);
        if (lines.some((line) => /points|cadeaux/i.test(line))) {
          report.bannerParsed ||= Boolean(parseVisualBonusBanner(lines));
          if (process.argv.includes("--debug-synthetic")) report.syntheticBannerSample = lines.slice(0, 4).map((line) => line.slice(0, 160));
        }
        return result;
      } };
    } });
  stage = "configure-capture";
  await visual.configure({ enabled: true, sourceId: selectedSourceId,
    ownerROI: { x: 0, y: 0, width: 0.45, height: 0.2 },
    bannerROI: { x: 0, y: 0.25, width: 1, height: 0.3 } }, scope);
  stage = "real-x2-ocr-and-effect";
  await waitUntil(() => effects.some((effect) => effect.moment === "multiplierX2"), 18000);
  await matches.whenIdle(); report.twoDetected = true; report.runtimeTwo = state.matchSession.multiplier === 2;
  await delay(2000);
  await target.webContents.executeJavaScript("window.syntheticBonus={multiplier:3,endsAtMs:Date.now()+60000}");
  stage = "real-x3-ocr-and-effect";
  await waitUntil(() => effects.some((effect) => effect.moment === "multiplierX3"), 18000);
  await matches.whenIdle(); report.threeDetected = true; report.runtimeThree = state.matchSession.multiplier === 3;
  await delay(1200);
  report.exactlyTwoEffects = effects.length === 2;
  assert.equal(report.runtimeTwo && report.runtimeThree && report.ownerExact && report.ocrAvailable && report.exactlyTwoEffects, true);
  assert.equal(report.networkRequestsBlocked, 0);
  await finish(true);
}
app.whenReady().then(run).catch(() => finish(false, stage));
