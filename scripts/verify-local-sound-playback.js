"use strict";

/**
 * Vérification Chromium réelle de la lecture locale des sons de ShenPulse.
 * Usage : node scripts/verify-local-sound-playback.js
 * Option facultative : --remote-url=https://... (plusieurs fois possible).
 *
 * Le lecteur et le résolveur d'URL sont chargés depuis les vraies sources.
 * Profil Chromium temporaire, serveur 127.0.0.1 éphémère, aucune API de
 * ShenPulse, aucun compte réel, aucune source Studio et aucun événement LIVE.
 * La fenêtre est cachée et sa sortie matérielle coupée AVANT son chargement.
 * Un deuxième verrou, un gain Web Audio nul, permet de mesurer le PCM sans
 * l'entendre. Aucune modification de la politique d'autoplay par défaut.
 * Les médias distants facultatifs sont lus en mémoire, jamais enregistrés.
 */
if (!process.versions.electron) {
  const { spawnSync } = require("node:child_process");
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawnSync(require("electron"), [__filename, ...process.argv.slice(2)], {
    stdio: "inherit", env: environment, windowsHide: true
  });
  if (child.error) process.stderr.write(`${child.error.message}\n`);
  process.exit(child.status ?? 1);
}

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const output = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-local-sound-smoke-"));
const renderer = path.resolve(__dirname, "../src/renderer");
const library = fs.readFileSync(path.join(renderer, "app/features/media/library.js"), "utf8");
const resolverStart = library.indexOf("function resolvedMediaUrl(");
const resolverEnd = library.indexOf("function mediaPreviewMarkup(", resolverStart);
assert.ok(resolverStart >= 0 && resolverEnd > resolverStart, "Résolveur réel introuvable.");
const resolver = library.slice(resolverStart, resolverEnd).trim();
const playback = fs.readFileSync(path.join(renderer, "app/core/audio-playback.js"), "utf8");
const csp = fs.readFileSync(path.join(renderer, "index.html"), "utf8")
  .match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1];
assert.ok(csp, "La politique de sécurité réelle doit être conservée.");
const remoteUrls = process.argv.filter((argument) => argument.startsWith("--remote-url="))
  .map((argument) => argument.slice("--remote-url=".length));
for (const value of remoteUrls) {
  const url = new URL(value);
  assert.equal(url.protocol, "https:", "Les sondes distantes doivent utiliser HTTPS.");
  assert.ok(!url.username && !url.password, "Aucun identifiant ne doit être fourni au smoke.");
}
assert.ok(remoteUrls.length <= 2, "Deux médias distants au maximum par vérification.");
const remoteOrigins = new Set(remoteUrls.map((value) => new URL(value).origin));
const report = {
  ok: false, autoplayPolicyOverridden: false, hardwareOutputMuted: true,
  scope: "Lecteur Chromium isolé et données artificielles ; aucun compte réel, Studio, LIVE ou son matériel.",
  playbacks: [], requests: [], consoleErrors: [], blockedRequests: []
};
app.setPath("userData", path.join(output, "chromium"));
app.commandLine.appendSwitch("disable-background-networking");
let player, server, origin, stage = "initialisation";
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const clean = (value) => String(value).replace(/https?:\/\/\S+/g, "[URL masquée]");
const deadline = setTimeout(() => finish(new Error(`Délai global dépassé (${stage}).`)), 55000);

function sineWave() {
  const rate = 44100, length = rate * 4, wav = Buffer.alloc(44 + length * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(length * 2, 40);
  for (let index = 0; index < length; index += 1) {
    wav.writeInt16LE(Math.round(Math.sin(index * 2 * Math.PI * 440 / rate) * 12000), 44 + index * 2);
  }
  return wav;
}

/** S'exécute uniquement dans la fenêtre artificielle, avant toute lecture. */
async function installMeasurements(base) {
  globalThis.snapshot = {
    state: { settings: { account: { uid: "isolated-audio-fixture" }, overlayToken: "fixture-token" },
      session: { profileId: "isolated-profile" } }, localOverlayUrls: { base }
  };
  globalThis.creatorPrivateOperationGeneration = 0;
  globalThis.activePreviewAudio = null;
  globalThis.activePreviewAudioScope = "";
  globalThis.dialog = { open: true };
  globalThis.mediaLibraryDialog = { open: true };
  globalThis.mediaLibraryContext = { kind: "sound" };
  const context = new AudioContext();
  const zeroGain = context.createGain(); zeroGain.gain.value = 0; zeroGain.connect(context.destination);
  const measurements = [], notices = [];
  globalThis.toast = (...args) => notices.push(args);
  const createElement = document.createElement.bind(document);
  document.createElement = function (tagName, ...args) {
    const node = createElement(tagName, ...args);
    if (String(tagName).toLowerCase() === "audio") {
      const source = context.createMediaElementSource(node), analyser = context.createAnalyser();
      analyser.fftSize = 2048; source.connect(analyser); analyser.connect(zeroGain);
      measurements.push({ node, source, analyser, values: new Float32Array(analyser.fftSize) });
    }
    return node;
  };
  globalThis.localAudioSmoke = { context, zeroGain, measurements, notices };
  await context.resume();
  return { contextState: context.state, gain: zeroGain.gain.value,
    autoplayPolicy: navigator.getAutoplayPolicy?.("mediaelement") || "default-browser-policy" };
}

function inspectAudio() {
  const smoke = globalThis.localAudioSmoke, measurement = smoke?.measurements.at(-1);
  if (!measurement) return null;
  const { node, analyser, values } = measurement;
  analyser.getFloatTimeDomainData(values);
  let squares = 0, peak = 0;
  for (const value of values) { squares += value * value; peak = Math.max(peak, Math.abs(value)); }
  return {
    currentTime: node.currentTime, duration: Number.isFinite(node.duration) ? node.duration : null,
    paused: node.paused, readyState: node.readyState, muted: node.muted, defaultMuted: node.defaultMuted,
    volume: node.volume, audioDecodedBytes: node.webkitAudioDecodedByteCount || 0,
    contextState: smoke.context.state, gain: smoke.zeroGain.gain.value,
    rms: Math.sqrt(squares / values.length), peak, errorCode: node.error?.code || 0,
    notices: smoke.notices.map((notice) => notice.slice(0, 2))
  };
}

async function measure(label, url, { pcm = true } = {}) {
  stage = label;
  const before = await player.webContents.executeJavaScript("localAudioSmoke.notices.length");
  await Promise.race([
    player.webContents.executeJavaScript(`playRendererAudio(${JSON.stringify({ url, volume: .8 })})`),
    delay(10000).then(() => { throw new Error(`${label} : la lecture ne démarre pas en 10 s.`); })
  ]);
  const samples = [], expires = Date.now() + 9000;
  while (Date.now() < expires) {
    const sample = await player.webContents.executeJavaScript(`(${inspectAudio.toString()})()`);
    if (sample) {
      samples.push(sample);
      if (sample.errorCode || sample.notices.length > before) break;
      if (samples.length > 12 && sample.currentTime - samples[0].currentTime > .5) break;
    }
    await delay(70);
  }
  const first = samples[0], last = samples.at(-1);
  const result = {
    label, pcmRequired: pcm, sampleCount: samples.length,
    first, last, maximumRms: Math.max(0, ...samples.map((sample) => sample.rms)),
    maximumDecodedBytes: Math.max(0, ...samples.map((sample) => sample.audioDecodedBytes))
  };
  report.playbacks.push(result);
  assert.ok(player.webContents.isAudioMuted(), "La coupure matérielle doit rester active.");
  assert.ok(first && last && last.currentTime > first.currentTime + .3, `${label} : horloge média immobile (${clean(JSON.stringify(last))}).`);
  assert.ok(last.readyState >= 2 && !last.paused && !last.muted && !last.defaultMuted && !last.errorCode,
    `${label} : lecture coupée ou en erreur.`);
  assert.equal(last.volume, .8); assert.equal(last.gain, 0);
  assert.equal(last.contextState, "running", `${label} : contexte audio suspendu par la politique standard.`);
  assert.equal(last.notices.length, before, `${label} : erreur réelle du lecteur.`);
  if (pcm) assert.ok(result.maximumRms > .01, `${label} : aucun PCM réel décodé.`);
  await player.webContents.executeJavaScript("stopRendererAudioPlayback()");
}

async function run() {
  const wav = sineWave();
  server = http.createServer((request, response) => {
    const url = new URL(request.url, origin || "http://127.0.0.1");
    response.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": csp });
      return response.end('<!doctype html><html lang="fr"><head><title>Vérification audio isolée</title></head><body><div id="audio-stage" hidden></div><script src="/resolved-media.js"></script><script src="/audio-playback.js"></script></body></html>');
    }
    if (["/resolved-media.js", "/audio-playback.js"].includes(url.pathname)) {
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
      return response.end(url.pathname === "/resolved-media.js" ? resolver : playback);
    }
    if (["/tone.wav", "/overlay/media/sounds/fixture.wav"].includes(url.pathname)) {
      if (url.pathname.startsWith("/overlay/") && url.searchParams.get("token") !== "fixture-token") {
        response.writeHead(403); return response.end();
      }
      const range = String(request.headers.range || "").match(/^bytes=(\d+)-(\d*)$/);
      const start = range ? Number(range[1]) : 0;
      const end = range?.[2] ? Math.min(wav.length - 1, Number(range[2])) : wav.length - 1;
      if (start > end || start >= wav.length) { response.writeHead(416); return response.end(); }
      response.writeHead(range ? 206 : 200, { "Content-Type": "audio/wav", "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1, ...(range ? { "Content-Range": `bytes ${start}-${end}/${wav.length}` } : {}) });
      return response.end(wav.subarray(start, end + 1));
    }
    response.writeHead(404); response.end();
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  player = new BrowserWindow({ width: 320, height: 240, show: false,
    webPreferences: { partition: "isolated-local-sound-smoke", backgroundThrottling: false,
      contextIsolation: true, nodeIntegration: false, offscreen: true, sandbox: true, webSecurity: true } });
  player.webContents.setAudioMuted(true);
  player.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    if (!["data:", "blob:", "about:"].includes(url.protocol) && url.origin !== origin && !remoteOrigins.has(url.origin)) {
      report.blockedRequests.push({ host: url.hostname, resourceType: details.resourceType });
      return callback({ cancel: true });
    }
    callback({});
  });
  player.webContents.session.webRequest.onCompleted((details) => {
    const url = new URL(details.url);
    if (["http:", "https:"].includes(url.protocol)) report.requests.push({ host: url.hostname,
      local: url.origin === origin, resourceType: details.resourceType, status: details.statusCode,
      contentType: details.responseHeaders?.["content-type"]?.[0] || details.responseHeaders?.["Content-Type"]?.[0] || "" });
  });
  player.webContents.on("console-message", (details) => {
    if (details.level === "error") report.consoleErrors.push(clean(details.message));
  });
  await player.loadURL(origin);
  report.initialAudio = await player.webContents.executeJavaScript(`(${installMeasurements.toString()})(${JSON.stringify(origin)})`);
  assert.equal(app.commandLine.hasSwitch("autoplay-policy"), false, "L'autoplay ne doit pas être assoupli par le smoke.");
  await measure("WAV HTTP local", `${origin}/tone.wav`);
  await measure("Chemin relatif fourni par ShenPulse", "/overlay/media/sounds/fixture.wav");
  await measure("WAV en mémoire data:audio", `data:audio/wav;base64,${wav.toString("base64")}`);
  for (let index = 0; index < remoteUrls.length; index += 1) {
    await measure(`Média distant ${index + 1} (${new URL(remoteUrls[index]).hostname})`, remoteUrls[index], { pcm: false });
  }
  report.ok = true;
}

let finished = false;
async function finish(error) {
  if (finished) return;
  finished = true; clearTimeout(deadline);
  if (error) report.error = clean(error.stack || error);
  report.stage = stage;
  report.hardwareOutputMuted = !player || player.webContents.isAudioMuted();
  await player?.webContents.executeJavaScript("stopRendererAudioPlayback(); localAudioSmoke?.context.close()").catch(() => {});
  player?.destroy();
  await new Promise((resolve) => { if (server?.listening) server.close(resolve); else resolve(); });
  fs.writeFileSync(path.join(output, "result.json"), JSON.stringify(report, null, 2), "utf8");
  process.stdout.write(`${JSON.stringify({ ...report, reportFile: path.join(output, "result.json") }, null, 2)}\n`);
  app.exit(error ? 1 : 0);
}

app.whenReady().then(run).then(() => finish()).catch(finish);
