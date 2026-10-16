"use strict";

/**
 * Régression réelle : lecteur Chromium laissé ouvert pendant un redémarrage
 * du serveur Matchs SUR LE MÊME PORT, puis changement de LIVE et de profil.
 * Usage : node scripts/verify-match-player-reconnection.js
 *
 * Magasin synthétique, ports éphémères, profil Chromium temporaire, réseau
 * externe interdit, fenêtre invisible. Le matériel est rendu muet AVANT le
 * chargement et le lecteur reçoit soundEnabled=false. Aucun compte, processus
 * ShenPulse/Studio utilisateur, réglage Windows ou événement LIVE réel.
 */
if (!process.versions.electron) {
  const { spawnSync } = require("node:child_process");
  const environment = { ...process.env }; delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawnSync(require("electron"), [__filename], { stdio: "inherit", env: environment, windowsHide: true });
  if (child.error) process.stderr.write(`${child.error.message}\n`);
  process.exit(child.status ?? 1);
}

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { app, BrowserWindow } = require("electron");
const { OverlayServer } = require("../src/main/overlay-server");
const { matchAccountNumber } = require("../src/main/match-access");
const { selectStatePaths } = require("../src/main/state-projection");
const { createMatchSession } = require("../src/shared/matches-contract");

const output = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-match-reconnection-"));
app.setPath("userData", path.join(output, "chromium"));
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND, EXCLUDE 127.0.0.1");
const report = { ok: false, scope: "Serveurs et compte artificiels uniquement ; matériel muet et aucun LIVE utilisateur.",
  stages: [], playbacks: [], navigations: 0, requests: { tickets: 0, videos: 0, external: 0 }, networkErrors: [], consoleErrors: [] };
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let server, player, origin, stage = "initialisation", finished = false;
const deadline = setTimeout(() => finish(new Error(`Délai global dépassé : ${stage}`)), 55000);
const clean = (value) => String(value).replace(/https?:\/\/\S+/g, "[URL masquée]");
function mark(value) { stage = value; report.stages.push({ stage, atMs: Date.now() }); }
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer(); probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => { const port = probe.address().port; probe.close(() => resolve(port)); });
  });
}
async function waitUntil(callback, timeoutMs = 12000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try { if (await callback()) return; } catch (error) {
      if (!/context was destroyed|frame was disposed|ERR_FAILED|Cannot read properties of undefined/i.test(error.message)) throw error;
    }
    await delay(60);
  }
  throw new Error(`Condition non atteinte : ${stage}`);
}
function inspectPlayer() {
  const video = document.getElementById("match-video"); if (!video) return null;
  let image = "";
  if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
    const canvas = document.createElement("canvas"); canvas.width = 64; canvas.height = 112;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height); image = canvas.toDataURL("image/png");
  }
  return { playbackId: video.dataset.matchPlaybackId || "", time: video.currentTime, duration: Number.isFinite(video.duration) ? video.duration : null,
    paused: video.paused, muted: video.muted, decodedFrames: video.getVideoPlaybackQuality?.().totalVideoFrames || 0,
    readyState: video.readyState, hidden: document.documentElement.hidden,
    playing: video.parentElement.classList.contains("playing"), error: document.documentElement.dataset.matchPlaybackError || "",
    nativeSource: new URL(video.currentSrc || location.href).pathname.startsWith("/match-media/"), image };
}
async function sample() {
  const value = await player.webContents.executeJavaScript(`(${inspectPlayer.toString()})()`);
  if (!value) return null;
  value.frameHash = value.image ? createHash("sha256").update(value.image).digest("hex") : ""; delete value.image;
  return value;
}
async function verifyPlayback(label, match, variant = "cyber") {
  mark(label);
  const request = server.playMatch({ match, variant });
  await waitUntil(async () => {
    const value = await sample();
    return value?.playbackId === request.requestId && value.time >= .25 && !value.paused && value.nativeSource;
  });
  const first = await sample(); await delay(800); const last = await sample();
  assert.ok(last.time > first.time + .4, `${label} : le temps doit avancer`);
  assert.ok(last.decodedFrames >= first.decodedFrames + 8, `${label} : images réellement décodées`);
  assert.notEqual(last.frameHash, first.frameHash, `${label} : les images réelles doivent changer`);
  for (const value of [first, last]) assert.ok(value.playbackId === request.requestId && !value.hidden &&
    !value.paused && value.muted && value.nativeSource && value.playing && !value.error, `${label} : état natif invalide`);
  assert.equal(player.webContents.isAudioMuted(), true, "La sortie matérielle doit rester coupée");
  report.playbacks.push({ label, first, last });
  return request.requestId;
}
function newServer(store) {
  return new OverlayServer({ store, staticDirectory: path.join(__dirname, "../resources/overlays"),
    onInboundEvent: async () => { throw new Error("Aucun événement externe autorisé"); },
    onEffectRequest: async () => { throw new Error("Aucun effet applicatif externe autorisé"); } });
}
async function run() {
  const state = { settings: { overlayPort: await freePort(), apiPort: await freePort(), overlayToken: "reconnect-overlay", apiToken: "reconnect-api",
    account: { uid: "isolated-reconnect-account", email: "fixture@example.invalid", refreshTokenSecretId: "fixture-only" },
    matchAccess: { accessKey: "b".repeat(32) }, publicOverlayRelay: { publicBaseUrl: "https://shenpulse-overlays.web.app", matchChannelId: "r".repeat(24) },
    siteVisibility: {}, tiktok: { roomId: "room-a", username: "fixture", status: "live" }, matches: { widgets: {}, automations: [] } },
    session: { profileId: "profile-a", running: true }, commerce: { subscription: { tier: "pro", status: "active" } },
    matchSession: createMatchSession(), rules: [], goals: [], statistics: {}, overlaySession: {}, profiles: [] };
  const store = { getState: () => { throw new Error("Le magasin réel ne doit jamais être lu"); },
    getStateProjection: (keys) => selectStatePaths(state, keys), getSecret: () => "fixture-refresh-only" };
  server = newServer(store); await server.start();
  origin = `http://127.0.0.1:${state.settings.overlayPort}`;
  const sourceUrl = `${origin}/match-bridge/${matchAccountNumber(state.settings.account.uid)}/${state.settings.publicOverlayRelay.matchChannelId}?soundEnabled=false`;
  player = new BrowserWindow({ width: 360, height: 640, show: false, backgroundColor: "#00000000",
    webPreferences: { partition: "isolated-match-reconnection", backgroundThrottling: false,
      contextIsolation: true, nodeIntegration: false, sandbox: true, offscreen: true, webSecurity: true } });
  player.webContents.setAudioMuted(true);
  player.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  player.webContents.on("did-finish-load", () => { report.navigations += 1; });
  const session = player.webContents.session;
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  session.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    if (!["about:", "data:", "blob:"].includes(url.protocol) && url.origin !== origin) {
      report.requests.external += 1; return callback({ cancel: true });
    }
    if (url.pathname.endsWith("/ticket")) report.requests.tickets += 1;
    if (url.pathname.startsWith("/match-media/")) report.requests.videos += 1;
    callback({});
  });
  session.webRequest.onErrorOccurred((details) => {
    if (details.error !== "net::ERR_ABORTED") report.networkErrors.push({ stage, resourceType: details.resourceType, error: details.error });
  });
  player.webContents.on("console-message", (details) => {
    if (details.level === "error") report.consoleErrors.push({ stage, message: clean(details.message) });
  });
  mark("chargement initial"); await player.loadURL(sourceUrl);
  await waitUntil(() => server.sseClients.size === 1);
  const firstId = await verifyPlayback("avant redémarrage", "x2");
  const originalNavigations = report.navigations, stoppedPort = state.settings.overlayPort;
  mark("arrêt réel du premier serveur pendant la lecture"); await server.stop();
  await delay(500);
  mark("nouvelle instance serveur sur le même port"); server = newServer(store); await server.start();
  assert.equal(state.settings.overlayPort, stoppedPort);
  await waitUntil(() => server.sseClients.size === 1);
  assert.equal(report.navigations, originalNavigations, "EventSource doit se reconnecter sans recharger la page");
  mark("fin naturelle de l'ancien clip, aucun nouveau replay");
  await waitUntil(async () => !(await sample())?.playbackId, 18000);
  await delay(250); assert.equal((await sample()).playbackId, "");
  const secondId = await verifyPlayback("après redémarrage sans toucher au navigateur", "x3");
  assert.notEqual(secondId, firstId);
  mark("changement LIVE et profil pendant une lecture");
  const priorNavigations = report.navigations;
  state.session.profileId = "profile-b"; state.settings.tiktok.roomId = "room-b"; server.refreshAccess();
  await waitUntil(() => report.navigations > priorNavigations && server.sseClients.size === 1);
  await waitUntil(async () => { const value = await sample(); return value && !value.hidden && !value.playbackId && !value.playing; });
  const recovered = await sample();
  assert.equal(recovered.time, 0); assert.equal(recovered.paused, true);
  report.contextRecovery = { navigationsBefore: priorNavigations, navigationsAfter: report.navigations, recovered };
  await verifyPlayback("après nouveau LIVE et nouveau profil", "snipe");
  assert.equal(player.webContents.getURL(), sourceUrl, "La capacité autorisée doit rester sur la même URL");
  assert.equal(report.requests.external, 0);
  assert.equal(report.requests.tickets, 3);
  report.hardwareOutputMuted = player.webContents.isAudioMuted();
  report.ok = true;
}
async function finish(error = null) {
  if (finished) return; finished = true; clearTimeout(deadline);
  if (error) report.error = clean(error.stack || error);
  report.stage = stage;
  player?.destroy(); await server?.stop().catch(() => {});
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify({ ...report, reportFile: path.join(output, "report.json") }, null, 2)}\n`);
  app.exit(report.ok && !error ? 0 : 1);
}
app.whenReady().then(run).then(() => finish()).catch(finish);
