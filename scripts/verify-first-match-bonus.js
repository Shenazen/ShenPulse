"use strict";

/** Qualification Windows OCR → vrai moteur Matchs, données entièrement fictives.
 * Aucun écran, compte réel, Studio, LIVE ou lecteur audio. Les deux fenêtres
 * Chromium invisibles dessinent seulement le texte synthétique du scénario.
 * Images en mémoire uniquement ; réseau externe interdit avant chargement.
 */
if (!process.versions.electron) {
  const { spawnSync } = require("node:child_process");
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(require("electron"), [__filename], { env, stdio: "inherit", windowsHide: true });
  process.exit(result.status ?? 1);
}
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");
const { MatchVisualService } = require("../src/main/matches/visual-service");
const { MatchesService } = require("../src/main/matches/service");
const { createWindowsOcr } = require("../src/main/matches/windows-ocr");
const { selectStatePaths } = require("../src/main/state-projection");
const { normalizeMatchesConfig, createMatchSession } = require("../src/shared/matches-contract");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-first-bonus-qa-")));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND");
app.on("window-all-closed", () => {});
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const OWN = "9007199254740993123", RIVAL = "9007199254740993456", ROOM = "7123456789012345678";
const SCOPE = { ownerUid: "native-ocr-fixture", profileId: "native-ocr-profile" };
const ROI = { x: 0, y: 0, width: 0.5, height: 0.1 };
let visual, matches, bannerWindow, ownerWindow, worker;
async function textWindow(width, height, fontSize) {
  const window = new BrowserWindow({ width, height, show: false, frame: false, useContentSize: true, webPreferences: {
    contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false,
    partition: `first-bonus-fixture-${width}-${height}`
  } });
  window.webContents.setAudioMuted(true);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith("data:text/html,") }));
  await window.loadURL("data:text/html," + encodeURIComponent(`<!doctype html><body style="margin:0;padding:16px;background:#94275b;color:white;font:${fontSize}px Arial;white-space:pre"><div id="text"></div></body>`));
  return window;
}
async function png(window, text, maxWidth = 1200, maxHeight = 400) {
  await window.webContents.executeJavaScript(`document.getElementById('text').textContent=${JSON.stringify(text)}`);
  await delay(40);
  const frame = await window.webContents.capturePage(), size = frame.getSize();
  const scale = Math.min(2, maxWidth / size.width, maxHeight / size.height);
  return frame.resize({ width: Math.floor(size.width * scale), height: Math.floor(size.height * scale), quality: "best" }).toPNG();
}
async function scenario(multiplier, ownText, shouldFire, ownPosition) {
  const calls = [], nativeReads = [], startedAtMs = Date.now() - 20000;
  const state = { settings: { account: { uid: SCOPE.ownerUid, email: "fixture@example.invalid", refreshTokenSecretId: "fixture-only" },
    tiktok: { username: "creator", roomId: ROOM, status: "live", broadcaster: { userId: OWN, username: "creator", nickname: "Creator Phoenix Legion" } },
    siteVisibility: {}, matches: normalizeMatchesConfig(), overlayConfigs: {} },
    connections: [{ id: "source_tiktok", enabled: true, type: "tiktok-direct", config: { username: "creator" } }],
    session: { running: true, profileId: SCOPE.profileId, startedAt: new Date(startedAtMs - 1000).toISOString() },
    commerce: { subscription: { tier: "pro", status: "active" } }, matchSession: createMatchSession(), rules: [], profiles: [] };
  const store = { getStateProjection: (paths) => selectStatePaths(state, paths), getAccountSession: () => state.settings.account,
    getSecret: () => "fixture-only", mutate: (fn) => fn(state), mutateRuntime: (fn) => fn(state) };
  matches = new MatchesService({ store, actionRunner: { run: async (_action, event) => {
    if (event.shouldExecute()) calls.push(event.data.moment); return { executed: true };
  } } });
  matches.saveAutomation({ id: `fixture-x${multiplier}`, moment: `multiplierX${multiplier}`, enabled: true,
    reaction: { type: "sound", url: "https://fixture.invalid/never-requested.wav" } });
  matches.handle({ source: "source_tiktok", phase: "start", id: "synthetic-open", roomId: ROOM, channelUsername: "creator", battleId: "8001",
    receivedAtMs: Date.now(), startsAtMs: startedAtMs, endsAtMs: startedAtMs + 300000,
    participants: [{ id: OWN, username: "creator", displayName: "Creator Phoenix Legion", score: 0 },
      { id: RIVAL, username: "rival", displayName: "Rival Gamer", score: 0 },
      ...(ownPosition === "top-left" ? [{ id: "9007199254740993789", displayName: "Third Fixture", score: 0 },
        { id: "9007199254740993999", displayName: "Fourth Fixture", score: 0 }] : [])] });
  let callbacks, generation = 0;
  visual = new MatchVisualService({ store, matches, createCapture: (options) => {
    callbacks = options; return { listSources: async () => [{ id: "window:4242:0", name: "Synthetic fixture only" }],
      start: async () => ({ generation: ++generation }), stop: async () => { generation += 1; } };
  }, createOcr: () => worker });
  worker = createWindowsOcr();
  const recognize = worker.recognize.bind(worker);
  worker.recognize = async (bytes) => {
    const result = await recognize(bytes);
    nativeReads.push({ available: result.available, lines: result.lines.map((line) => line.text) });
    return result;
  };
  const ownerBytes = ownPosition ? null : await png(ownerWindow, ownText);
  const warmBytes = ownerBytes || await png(bannerWindow, `Points Cadeaux x${multiplier} par premier Cadeau | 30s`, 1600, 600);
  try {
    // Warm only with our synthetic text, never with a desktop capture.
    assert.equal((await worker.recognize(warmBytes)).available, true, "Windows OCR unavailable");
    await visual.configure({ enabled: true, sourceId: "window:4242:0", bannerROI: ROI,
      ...(ownPosition ? { ownerMode: "self-screen", ownPosition, ownScreenConfirmed: true, ownerROI: null }
        : { ownerMode: "studio-self", ownerROI: ROI }) }, SCOPE);
    for (const remaining of [30, 29, 28]) {
      const banner = await png(bannerWindow, `Points Cadeaux x${multiplier} par premier Cadeau | ${remaining}s`, 1600, 600);
      try {
        await callbacks.onFrame({ sourceId: "window:4242:0", generation, capturedAtMs: Date.now(), owner: ownerBytes, banner });
        await matches.whenIdle();
      } finally { banner.fill(0); }
      if (remaining !== 28) await delay(1000);
    }
    assert.deepEqual(calls, shouldFire ? [`multiplierX${multiplier}`] : []);
    assert.equal(state.matchSession.multiplier, shouldFire ? multiplier : 1);
  } catch (error) {
    // This script never accepts real captures: these are synthetic fixtures only.
    console.error(JSON.stringify({ fixture: ownText, multiplier, status: visual.status(),
      contextAvailable: Boolean(visual.context()), nativeReads, calls }));
    throw error;
  } finally { ownerBytes?.fill(0); warmBytes.fill(0); await visual.close(); visual = null; matches.reset(); matches = null; worker.close(); worker = null; }
}
app.whenReady().then(async () => {
  bannerWindow = await textWindow(920, 90, 18); ownerWindow = await textWindow(420, 120, 14);
  await scenario(2, "Creator Phoenix...\nToi", true);
  await scenario(3, "Creator Phoenix...\nToi", true);
  await scenario(2, "Rival Gamer\nToi", false);
  await scenario(2, "Creator Phoenix...\nAdversaire", false);
  await scenario(2, null, true, "left");
  await scenario(3, null, true, "top-left");
  console.log(JSON.stringify({ ok: true, nativeOcr: true, firstBonusSeconds: 30, x2: true, x3: true,
    rivalRejected: true, adversaireRejected: true, declaredScreenX2: true, declaredScreenX3: true,
    realDesktopCaptured: false, effectsSentToLive: 0 }));
}).catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  await visual?.close(); matches?.reset(); worker?.close(); bannerWindow?.destroy(); ownerWindow?.destroy(); app.exit(process.exitCode || 0);
});
