"use strict";

/**
 * Contrôle isolé des pistes audio natives des animations Matchs chiffrées.
 *
 * Utilise le vrai serveur local et son vrai lecteur, avec uniquement un état
 * artificiel en mémoire. Aucun compte, magasin utilisateur, Firebase, LIVE,
 * Studio ou appareil IRL n'est sollicité. La fenêtre reste invisible ; la
 * sortie matérielle est coupée avant le chargement et le graphe de mesure
 * possède en plus un gain nul. Le son décodé est mesuré, jamais diffusé.
 *
 * L'option d'autoplay est propre à CE processus de test : elle permet de
 * vérifier le décodage Opus sans modifier la politique de l'application ou
 * contourner les refus de lecture du navigateur utilisé par une personne.
 * Lancer avec electron scripts/verify-match-video-audio.js.
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

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-match-audio-"));
app.setPath("userData", path.join(temporaryDirectory, "chromium"));
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let overlayServer = null;
let playerWindow = null;
let currentStage = "initialisation";
const deadline = setTimeout(() => {
  fs.writeFileSync(path.join(temporaryDirectory, "failure.json"), JSON.stringify({
    error: "Délai global du contrôle audio dépassé.", stage: currentStage
  }, null, 2));
  app.exit(1);
}, 45000);

function stage(value) {
  currentStage = value;
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

async function waitUntil(callback, timeoutMs = 12000) {
  const expiresAt = Date.now() + timeoutMs;
  while (Date.now() < expiresAt) {
    if (await callback()) return;
    await delay(60);
  }
  throw new Error(`Condition audio non atteinte après ${timeoutMs} ms (${currentStage}).`);
}

/** Exécuté dans Chromium : détourne et mesure le signal, sortie forcée à zéro. */
async function installAudioMeasurement() {
  const video = document.getElementById("match-video");
  if (!video) throw new Error("Le lecteur vidéo Matchs n'est pas présent.");
  const context = new AudioContext();
  const source = context.createMediaElementSource(video);
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  const silentOutput = context.createGain();
  silentOutput.gain.value = 0;
  source.connect(analyser);
  analyser.connect(silentOutput);
  silentOutput.connect(context.destination);
  globalThis.matchAudioSmoke = {
    context, source, analyser, silentOutput,
    samples: new Float32Array(analyser.fftSize)
  };
  await context.resume();
  if (context.state !== "running") throw new Error("Le décodeur audio de test reste suspendu.");
}

/** Exécuté dans Chromium : mesure le vrai signal PCM et les images décodées. */
function inspectPlayback() {
  const video = document.getElementById("match-video");
  const measurement = globalThis.matchAudioSmoke;
  if (!video || !measurement) return null;
  measurement.analyser.getFloatTimeDomainData(measurement.samples);
  let squares = 0, peak = 0;
  for (const value of measurement.samples) {
    squares += value * value;
    peak = Math.max(peak, Math.abs(value));
  }
  const quality = video.getVideoPlaybackQuality?.();
  let frame = "";
  if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
    const canvas = document.createElement("canvas");
    canvas.width = 72;
    canvas.height = 128;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    frame = canvas.toDataURL("image/png");
  }
  const mediaUrl = new URL(video.currentSrc || location.href);
  return {
    playbackId: video.dataset.matchPlaybackId || "",
    currentTime: video.currentTime,
    paused: video.paused,
    muted: video.muted,
    defaultMuted: video.defaultMuted,
    volume: video.volume,
    readyState: video.readyState,
    width: video.videoWidth,
    height: video.videoHeight,
    decodedFrames: quality?.totalVideoFrames || 0,
    audioDecodedBytes: video.webkitAudioDecodedByteCount || 0,
    contextState: measurement.context.state,
    rms: Math.sqrt(squares / measurement.samples.length),
    peak,
    silentOutputGain: measurement.silentOutput.gain.value,
    ticketSource: mediaUrl.origin === location.origin && mediaUrl.pathname.startsWith("/match-media/"),
    compatibleVisible: Boolean(document.getElementById("match-compatible-animation")),
    error: document.documentElement.dataset.matchPlaybackError || "",
    playing: video.parentElement.classList.contains("playing"),
    frame
  };
}

async function samplePlayback() {
  const sample = await playerWindow.webContents.executeJavaScript(`(${inspectPlayback.toString()})()`);
  if (!sample) throw new Error("La mesure audio du lecteur n'est pas installée.");
  const frameHash = sample.frame ? createHash("sha256").update(sample.frame).digest("hex") : "";
  delete sample.frame;
  return { ...sample, frameHash };
}

async function verifyNativeAudio({ match, variant, label }) {
  stage(`lecture protégée et audio natif : ${label}`);
  const request = overlayServer.playMatch({ match, variant });
  await waitUntil(async () => {
    const sample = await samplePlayback();
    return sample.playbackId === request.requestId && !sample.paused &&
      sample.readyState >= 2 && sample.currentTime >= 0.2 && sample.ticketSource;
  });
  const samples = [];
  // Plusieurs secondes écartent les courts silences présents au début d'un clip.
  for (let index = 0; index < 40; index += 1) {
    samples.push(await samplePlayback());
    await delay(80);
  }
  const first = samples[0], last = samples.at(-1);
  const distinctFrames = new Set(samples.map((sample) => sample.frameHash).filter(Boolean)).size;
  const audibleSamples = samples.filter((sample) => sample.rms > 0.0001 && sample.peak > 0.001).length;
  if (last.currentTime <= first.currentTime + 1 ||
      last.decodedFrames <= first.decodedFrames + 10 || distinctFrames < 2) {
    throw new Error(`Les images de ${label} ne progressent pas réellement.`);
  }
  if (audibleSamples < 3) {
    throw new Error(`Aucun signal audio natif mesurable pour ${label} (${audibleSamples} échantillons).`);
  }
  if (samples.some((sample) => sample.playbackId !== request.requestId || sample.paused || sample.muted ||
      sample.volume !== 1 || sample.contextState !== "running" || sample.silentOutputGain !== 0 ||
      !sample.ticketSource || sample.compatibleVisible || sample.error || !sample.playing)) {
    throw new Error(`Le son ou le lecteur de ${label} est coupé, remplacé ou en erreur.`);
  }
  if (!playerWindow.webContents.isAudioMuted()) throw new Error("La sortie matérielle du smoke n'est plus coupée.");
  return {
    match, variant, label, audibleSamples, distinctFrames,
    peakRms: Math.max(...samples.map((sample) => sample.rms)),
    peakAmplitude: Math.max(...samples.map((sample) => sample.peak)),
    first, last
  };
}

async function run() {
  const state = {
    settings: {
      overlayPort: await freePort(), apiPort: await freePort(),
      overlayToken: "isolated-audio-overlay-token", apiToken: "isolated-audio-api-token",
      account: { uid: "isolated-audio-account", email: "isolated@example.invalid", refreshTokenSecretId: "isolated-secret" },
      matchAccess: { accessKey: "b".repeat(32) }, tiktok: { roomId: "isolated-audio-room" },
      publicOverlayRelay: { publicBaseUrl: "https://shenpulse-overlays.web.app", matchChannelId: "n".repeat(24) },
      matches: { widgets: { scoreboard: { enabled: true } } }
    },
    session: { running: true, profileId: "isolated-audio-profile" },
    goals: [], statistics: {}, overlaySession: {},
    matchSession: { status: "active", participants: [{ username: "isolated-viewer", own: true, score: 25 }] },
    commerce: { subscription: { tier: "pro", status: "active" } }
  };
  const store = {
    getState: () => { throw new Error("Le magasin utilisateur complet n'est pas autorisé dans ce smoke."); },
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
  const playerUrl = `${localOrigin}/match-bridge/${matchAccountNumber(state.settings.account.uid)}/${state.settings.publicOverlayRelay.matchChannelId}`;
  const requests = { local: 0, tickets: 0, video: 0, directVideoBlocked: 0, privateAssetBlocked: 0, externalBlocked: 0 };
  const consoleErrors = [];
  const consoleWarnings = [];
  playerWindow = new BrowserWindow({
    width: 360, height: 640, show: false, backgroundColor: "#00000000",
    webPreferences: {
      partition: "match-native-audio-smoke", backgroundThrottling: false,
      contextIsolation: true, nodeIntegration: false, offscreen: true, sandbox: true, webSecurity: true
    }
  });
  // Deux barrières indépendantes avant toute requête média, même à volume DOM 1.
  playerWindow.webContents.setAudioMuted(true);
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
        requests.directVideoBlocked += 1;
        return callback({ cancel: true });
      }
      if (/protected-match-media|client-key\.json|\.spm(?:$|\/)/i.test(url.pathname)) {
        requests.privateAssetBlocked += 1;
        return callback({ cancel: true });
      }
    }
    callback({});
  });
  playerWindow.webContents.on("console-message", (details) => {
    if (["warning", "error"].includes(details.level)) {
      const message = String(details.message).replace(/https?:\/\/\S+/g, "[URL masquée]");
      // Chromium avertit d'un preload inutilisé sur ce lecteur minimal. Cet
      // avertissement de performance ne signale ni refus audio, ni erreur média.
      if (details.level === "warning" && /preloaded using link preload but not used within a few seconds/.test(message)) {
        consoleWarnings.push(message);
      } else consoleErrors.push(message);
    }
  });
  await playerWindow.loadURL(playerUrl);
  await waitUntil(() => playerWindow.webContents.executeJavaScript(
    'typeof matchPlaybackQueue !== "undefined" && typeof matchPlaybackQueue?.enqueue === "function"'
  ));
  await waitUntil(() => overlayServer.sseClients.size === 1);
  await playerWindow.webContents.executeJavaScript(`(${installAudioMeasurement.toString()})()`);
  // Deux événements synthétiques sur le serveur artificiel, pas sur le LIVE réel.
  const playbacks = [];
  playbacks.push(await verifyNativeAudio({ match: "x2", variant: "cyber", label: "x2 - Cyber" }));
  playbacks.push(await verifyNativeAudio({ match: "cofre", variant: "gladiador", label: "Coffre - Gladiador" }));
  if (requests.tickets !== 2 || requests.video < 2 || requests.externalBlocked ||
      requests.directVideoBlocked || requests.privateAssetBlocked || consoleErrors.length) {
    throw new Error(`Transport ou console inattendu : ${JSON.stringify({ requests, consoleErrors })}.`);
  }
  const result = {
    ok: true, playbacks, requests, consoleErrors, consoleWarnings, hardwareOutputMuted: true,
    scope: "État artificiel et lecteur Chromium local ; aucun son diffusé, LIVE, Studio ou Firebase."
  };
  fs.writeFileSync(path.join(temporaryDirectory, "result.json"), JSON.stringify(result, null, 2), "utf8");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  stage("terminé");
}

async function cleanup() {
  stage("fermeture");
  await playerWindow?.webContents.executeJavaScript(
    'globalThis.matchAudioSmoke?.context.close().catch(() => {})'
  ).catch(() => {});
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
