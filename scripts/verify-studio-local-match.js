"use strict";

/**
 * Vérification Chromium isolée du lecteur Matchs destiné à TikTok Studio.
 *
 * Utilise le serveur et le runtime réels, mais un compte et des capacités
 * artificiels en mémoire. Aucun magasin utilisateur, Firebase, LIVE réel,
 * son, action IRL ou application visible n'est ouvert. Les requêtes externes
 * sont bloquées. Le navigateur et ses captures sont dans un dossier temporaire.
 * Lancer avec electron scripts/verify-studio-local-match.js ; cette vérification
 * prouve le décodage local Chromium, pas le comportement du moteur Studio réel.
 */
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { app, BrowserWindow } = require("electron");
const { OverlayServer } = require("../src/main/overlay-server");
const { matchAccountNumber } = require("../src/main/match-access");
const { selectStatePaths } = require("../src/main/state-projection");

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-studio-match-"));
app.setPath("userData", path.join(temporaryDirectory, "chromium"));
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let overlayServer = null;
let playerWindow = null;
let currentStage = "initialisation";
const deadline = setTimeout(() => {
  fs.writeFileSync(path.join(temporaryDirectory, "failure.json"), JSON.stringify({
    error: "Délai global du smoke dépassé.", stage: currentStage
  }, null, 2));
  app.exit(1);
}, 45000);

function stage(value) {
  currentStage = value;
  fs.writeFileSync(path.join(temporaryDirectory, "stage.json"), JSON.stringify({ stage: value }));
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });
}

async function waitUntil(callback, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await callback()) return;
    await delay(80);
  }
  throw new Error(`Condition du lecteur local non atteinte après ${timeoutMs} ms.`);
}

function inspectPlayer() {
  const video = document.getElementById("match-video");
  if (!video) return null;
  const quality = video.getVideoPlaybackQuality?.();
  let frame = "";
  if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 170;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    frame = canvas.toDataURL("image/png");
  }
  return {
    playbackId: video.dataset.matchPlaybackId || "",
    currentTime: video.currentTime,
    duration: video.duration,
    paused: video.paused,
    muted: video.muted,
    readyState: video.readyState,
    width: video.videoWidth,
    height: video.videoHeight,
    decodedFrames: quality?.totalVideoFrames || 0,
    presentedFrames: globalThis.studioSmokeFrames || 0,
    ticketSource: new URL(video.currentSrc || location.href).origin === location.origin &&
      new URL(video.currentSrc || location.href).pathname.startsWith("/match-media/"),
    compatibleVisible: Boolean(document.getElementById("match-compatible-animation")),
    error: document.documentElement.dataset.matchPlaybackError || "",
    playing: video.parentElement.classList.contains("playing"),
    hidden: document.documentElement.hidden,
    frame
  };
}

async function samplePlayer() {
  const sample = await playerWindow.webContents.executeJavaScript(`(${inspectPlayer.toString()})()`);
  if (!sample) throw new Error("Le lecteur Matchs n'est pas créé.");
  const frameHash = sample.frame ? createHash("sha256").update(sample.frame).digest("hex") : "";
  delete sample.frame;
  return { ...sample, frameHash };
}

async function verifyProgressivePlayback({ match, variant, label }) {
  const dispatchAt = Date.now();
  const dispatched = overlayServer.playMatch({ match, variant });
  await waitUntil(async () => {
    const sample = await samplePlayer();
    return sample.playbackId === dispatched.requestId && sample.readyState >= 2 && !sample.paused &&
      sample.currentTime >= 0.4 && sample.ticketSource;
  });
  const readyAfterMs = Date.now() - dispatchAt;
  stage(`vraie vidéo démarrée : ${label}`);
  const samples = [];
  const screenshots = [];
  for (let index = 0; index < 3; index += 1) {
    samples.push(await samplePlayer());
    const screenshot = path.join(temporaryDirectory, `studio-match-${match}-${variant}-${index + 1}.png`);
    fs.writeFileSync(screenshot, (await playerWindow.webContents.capturePage()).toPNG());
    screenshots.push(screenshot);
    if (index < 2) await delay(700);
  }
  const first = samples[0], last = samples.at(-1);
  const distinctFrames = new Set(samples.map((sample) => sample.frameHash).filter(Boolean)).size;
  const result = { match, variant, label, readyAfterMs, distinctFrames, samples, screenshots };
  fs.writeFileSync(path.join(temporaryDirectory, `playback-${match}-${variant}.json`), JSON.stringify(result, null, 2));
  if (last.currentTime <= first.currentTime + 0.6 || distinctFrames < 2 ||
      last.presentedFrames < first.presentedFrames + 8 || last.decodedFrames < first.decodedFrames + 8) {
    throw new Error(`La vidéo ${label} ne décode pas d’images progressives : ${JSON.stringify(samples)}.`);
  }
  if (samples.some((sample) => sample.playbackId !== dispatched.requestId || sample.paused || !sample.muted || !sample.ticketSource ||
      sample.compatibleVisible || sample.error || sample.hidden || !sample.playing)) {
    throw new Error(`La vraie vidéo ${label} a été remplacée, arrêtée ou masquée : ${JSON.stringify(samples)}.`);
  }
  return result;
}

async function run() {
  const state = {
    settings: {
      overlayPort: await freePort(), apiPort: await freePort(),
      overlayToken: "isolated-overlay-token", apiToken: "isolated-api-token",
      account: { uid: "isolated-studio-smoke-account", email: "isolated@example.invalid", refreshTokenSecretId: "isolated-secret" },
      matchAccess: { accessKey: "a".repeat(32) }, tiktok: { roomId: "isolated-room" },
      publicOverlayRelay: { publicBaseUrl: "https://shenpulse-overlays.web.app", matchChannelId: "m".repeat(24) },
      matches: { widgets: { scoreboard: { enabled: true } } }
    },
    session: { running: true, profileId: "isolated-profile" },
    goals: [], statistics: {}, overlaySession: {},
    matchSession: { status: "active", participants: [{ username: "isolated-viewer", own: true, score: 25 }] },
    commerce: { subscription: { tier: "pro", status: "active" } }
  };
  const store = {
    getState: () => { throw new Error("Aucune lecture du magasin complet n'est autorisée par ce smoke."); },
    getStateProjection: (keys) => selectStatePaths(state, keys),
    getSecret: () => "isolated-refresh-token"
  };
  overlayServer = new OverlayServer({
    store,
    staticDirectory: path.join(__dirname, "../resources/overlays"),
    onInboundEvent: async () => { throw new Error("Aucun événement LIVE n'est autorisé."); },
    onEffectRequest: async () => { throw new Error("Aucun effet applicatif n'est autorisé."); }
  });
  await overlayServer.start();
  const localOrigin = `http://127.0.0.1:${state.settings.overlayPort}`;
  // Smoke visuel historique : coupe explicitement le son de cette source
  // artificielle. Le décodage sonore est couvert par verify-match-video-audio.
  const playerUrl = `${localOrigin}/match-bridge/${matchAccountNumber(state.settings.account.uid)}/${state.settings.publicOverlayRelay.matchChannelId}?soundEnabled=false`;
  const requests = { local: 0, tickets: 0, video: 0, rawVideo: 0, privateAsset: 0, externalBlocked: 0 };
  const consoleErrors = [];

  playerWindow = new BrowserWindow({
    width: 540, height: 960, show: false, transparent: true, backgroundColor: "#00000000",
    webPreferences: {
      partition: "studio-local-match-smoke", backgroundThrottling: false,
      contextIsolation: true, nodeIntegration: false, offscreen: true,
      sandbox: true, webSecurity: true
    }
  });
  playerWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    if (!["data:", "blob:", "about:"].includes(url.protocol) && url.origin !== localOrigin) {
      requests.externalBlocked += 1;
      return callback({ cancel: true });
    }
    if (url.origin === localOrigin) {
      requests.local += 1;
      if (url.pathname.endsWith("/ticket")) requests.tickets += 1;
      if (url.pathname.startsWith("/match-media/")) requests.video += 1;
      if (/\/media\/video\/.*\.(?:webm|mp4)$/i.test(url.pathname)) {
        requests.rawVideo += 1;
        return callback({ cancel: true });
      }
      if (/protected-match-media|client-key\.json|\.spm(?:$|\/)/i.test(url.pathname)) {
        requests.privateAsset += 1;
        return callback({ cancel: true });
      }
    }
    callback({});
  });
  playerWindow.webContents.on("console-message", (details) => {
    if (["warning", "error"].includes(details.level)) {
      consoleErrors.push(String(details.message).replace(/https?:\/\/\S+/g, "[URL masquée]"));
    }
  });
  await playerWindow.loadURL(playerUrl);
  stage("document chargé");
  await waitUntil(() => playerWindow.webContents.executeJavaScript(
    'typeof matchPlaybackQueue !== "undefined" && typeof matchPlaybackQueue?.enqueue === "function"'
  ));
  await waitUntil(() => overlayServer.sseClients.size === 1);
  const idle = await samplePlayer();
  if (idle.playing || idle.currentTime !== 0 || idle.compatibleVisible) {
    throw new Error("Le lecteur local n'est pas transparent au repos.");
  }
  await playerWindow.webContents.executeJavaScript(`(() => {
    globalThis.studioSmokeFrames = 0;
    const video = document.getElementById("match-video");
    const observe = () => { globalThis.studioSmokeFrames += 1; video.requestVideoFrameCallback(observe); };
    video.requestVideoFrameCallback(observe);
  })()`);
  // Deux effets synthétiques sur notre serveur artificiel : jamais sur un LIVE.
  const playbacks = [];
  playbacks.push(await verifyProgressivePlayback({ match: "cofre", variant: "gladiador", label: "Coffre - Gladiador" }));
  playbacks.push(await verifyProgressivePlayback({ match: "x2", variant: "cyber", label: "x2 - Cyber" }));
  const rawRoutes = ["cofre-gladiador.webm", "x2-cyber.webm"];
  const rawRouteChecks = [];
  for (const name of rawRoutes) {
    const response = await fetch(`${localOrigin}/overlay/media/video/${name}?token=isolated-overlay-token`, { method: "HEAD" });
    rawRouteChecks.push({ name, status: response.status });
    if (response.status !== 403) throw new Error(`La route directe ${name} est encore disponible.`);
  }
  if (requests.externalBlocked !== 0 || requests.tickets !== 2 || requests.video < 2 ||
      requests.rawVideo !== 0 || requests.privateAsset !== 0 || consoleErrors.length) {
    throw new Error(`Transport ou console inattendu : ${JSON.stringify({ requests, consoleErrors })}.`);
  }
  stage("progression vérifiée");
  state.session.profileId = "isolated-profile-changed";
  overlayServer.refreshAccess();
  await waitUntil(() => playerWindow.webContents.executeJavaScript(
    'document.documentElement.hidden && !document.getElementById("match-video").hasAttribute("src")'
  ));
  const stopped = await samplePlayer();
  if (!stopped.paused || stopped.playing || stopped.compatibleVisible || !stopped.hidden) {
    throw new Error("La révocation du profil n'arrête pas proprement le lecteur.");
  }
  // Le changement de contexte recharge ensuite sa même URL autorisée, sans
  // rejouer l'effet ancien : la nouvelle source doit rester transparente.
  await delay(450);
  await waitUntil(() => overlayServer.sseClients.size === 1);
  await waitUntil(() => playerWindow.webContents.executeJavaScript(
    '!document.documentElement.hidden && typeof matchPlaybackQueue !== "undefined" && !document.getElementById("match-video").hasAttribute("src")'
  ));
  const recovered = await samplePlayer();
  if (!recovered.paused || recovered.playing || recovered.compatibleVisible ||
      recovered.hidden || recovered.currentTime !== 0 || requests.tickets !== 2 || consoleErrors.length) {
    throw new Error("Le changement de profil rejoue un effet ancien ou ne reconnecte pas son lecteur.");
  }
  const result = { ok: true, playbacks, rawRouteChecks, stopped, recovered, requests,
    consoleErrors, scope: "Serveur local artificiel ; aucun utilisateur, Firebase, son ou IRL." };
  fs.writeFileSync(path.join(temporaryDirectory, "result.json"), JSON.stringify(result, null, 2), "utf8");
  stage("terminé");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function cleanup() {
  stage("fermeture");
  playerWindow?.destroy();
  await overlayServer?.stop();
}

app.whenReady().then(run).then(async () => {
  await cleanup();
  clearTimeout(deadline);
  app.exit(0);
}).catch(async (error) => {
  fs.writeFileSync(path.join(temporaryDirectory, "failure.json"), JSON.stringify({
    error: String(error?.stack || error), stage: currentStage
  }, null, 2));
  process.stderr.write(`${error?.stack || error}\n`);
  await cleanup().catch(() => {});
  clearTimeout(deadline);
  app.exit(1);
});
