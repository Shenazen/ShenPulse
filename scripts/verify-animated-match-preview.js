"use strict";

/** Smoke Chromium isolé des aperçus Match protégés, jamais du LIVE utilisateur.
 * Compte et droits artificiels en mémoire, profil Chromium temporaire unique,
 * réseau externe bloqué et délai global de 45 s. Les captures sont temporaires.
 * Vérifie la vraie vidéo Pro muette, le poster Free après 403 et le poster
 * statique sans ticket ; aucun flux SSE, son ou action IRL n'est permis.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { app, BrowserWindow } = require("electron");
const { OverlayServer } = require("../src/main/overlay-server");
const { selectStatePaths } = require("../src/main/state-projection");

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-match-preview-"));
app.setPath("userData", path.join(temporaryDirectory, "chromium"));
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost");

let overlayServer = null, previewWindow = null, currentStage = "initialisation";
const deadline = setTimeout(() => {
  fs.writeFileSync(path.join(temporaryDirectory, "failure.json"), JSON.stringify({ error: "Délai global dépassé.", stage: currentStage }));
  app.exit(1);
}, 45000);
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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

async function waitUntil(callback, timeoutMs = 8000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await callback()) return;
    await delay(80);
  }
  throw new Error(`Condition d’aperçu non atteinte : ${currentStage}.`);
}

function outputDirectory() {
  const argument = process.argv.find((entry) => entry.startsWith("--output="));
  return argument ? path.resolve(argument.slice(argument.indexOf("=") + 1)) : temporaryDirectory;
}

function inspectPreview() {
  const video = document.querySelector("#match-video");
  if (!video) return null;
  const source = video.currentSrc || video.getAttribute("src") || "";
  let frame = "";
  if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
    const canvas = document.createElement("canvas");
    canvas.width = 90; canvas.height = 160;
    canvas.getContext("2d").drawImage(video, 0, 0, 90, 160);
    frame = canvas.toDataURL("image/png");
  }
  return { autoplay: video.autoplay, loop: video.loop, muted: video.muted, paused: video.paused,
    currentTime: video.currentTime, duration: video.duration, readyState: video.readyState,
    decodedFrames: video.getVideoPlaybackQuality?.().totalVideoFrames || 0,
    presentedFrames: globalThis.previewSmokeFrames || 0,
    hasSource: Boolean(source), hasSourceAttribute: video.hasAttribute("src"),
    ticketSource: Boolean(source && new URL(source, location.href).origin === location.origin &&
      /^\/match-media\/[A-Za-z0-9_-]{32}$/.test(new URL(source, location.href).pathname)),
    poster: video.poster ? new URL(video.poster).pathname.split("/posters/")[1] || "" : "",
    status: video.dataset.matchPreviewStatus || "", hidden: document.documentElement.hidden, frame };
}

async function sample() {
  const value = await previewWindow.webContents.executeJavaScript(`(${inspectPreview.toString()})()`);
  if (!value) throw new Error("L’aperçu vidéo est absent.");
  const frameHash = value.frame ? createHash("sha256").update(value.frame).digest("hex") : "";
  delete value.frame;
  return { ...value, frameHash };
}

async function run() {
  const targetDirectory = outputDirectory();
  fs.mkdirSync(targetDirectory, { recursive: true });
  const state = {
    settings: { overlayPort: await freePort(), apiPort: await freePort(),
      overlayToken: "isolated-preview-token", apiToken: "isolated-api-token",
      account: { uid: "isolated-preview-account", email: "isolated@example.invalid", refreshTokenSecretId: "isolated-preview-secret" } },
    session: { running: false, profileId: "isolated-preview-profile" }, goals: [], statistics: {}, overlaySession: {},
    commerce: { subscription: { tier: "pro", status: "active", source: "own" } }
  };
  const store = {
    getState: () => { throw new Error("Le smoke ne doit pas lire de magasin complet ou utilisateur."); },
    getStateProjection: (paths) => selectStatePaths(state, paths),
    getAccountSession: () => ({ ...state.settings.account }), getActiveAccountUid: () => state.settings.account.uid,
    getSecret: (id) => id === "isolated-preview-secret" ? "isolated-fixture-refresh-token" : ""
  };
  overlayServer = new OverlayServer({ store,
    staticDirectory: path.join(__dirname, "../resources/overlays"),
    onInboundEvent: async () => { throw new Error("Événement LIVE interdit dans l’aperçu."); },
    onEffectRequest: async () => { throw new Error("Effet applicatif interdit dans l’aperçu."); }
  });
  await overlayServer.start();
  const origin = `http://127.0.0.1:${state.settings.overlayPort}`;
  const requests = { tickets: 0, media: 0, rawMedia: 0, privateAssets: 0, sse: 0, externalBlocked: 0 };
  const ticketStatuses = [], consoleErrors = [];
  previewWindow = new BrowserWindow({ width: 540, height: 960, show: false, backgroundColor: "#02040a",
    webPreferences: { partition: "isolated-match-preview", backgroundThrottling: false,
      contextIsolation: true, nodeIntegration: false, offscreen: true, sandbox: true, webSecurity: true } });
  previewWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    if (!["data:", "blob:", "about:"].includes(url.protocol) && url.origin !== origin) {
      requests.externalBlocked += 1;
      return callback({ cancel: true });
    }
    if (url.pathname === "/match-preview/ticket") requests.tickets += 1;
    if (url.pathname.startsWith("/match-media/")) requests.media += 1;
    if (/\/events\/?$/.test(url.pathname)) { requests.sse += 1; return callback({ cancel: true }); }
    if (/\/media\/video\/.*\.(?:webm|mp4)$/i.test(url.pathname)) { requests.rawMedia += 1; return callback({ cancel: true }); }
    if (/protected-match-media|client-key\.json|\.spm(?:$|\/)/i.test(url.pathname)) { requests.privateAssets += 1; return callback({ cancel: true }); }
    callback({});
  });
  previewWindow.webContents.session.webRequest.onCompleted((details) => {
    if (new URL(details.url).pathname === "/match-preview/ticket") ticketStatuses.push(details.statusCode);
  });
  previewWindow.webContents.on("console-message", (details) => {
    if (["warning", "error"].includes(details.level)) consoleErrors.push(String(details.message).replace(/https?:\/\/\S+/g, "[URL masquée]"));
  });
  const load = async (variant, mode = "animated") => {
    currentStage = `${state.commerce.subscription.tier} : x2 ${variant}, ${mode}`;
    await previewWindow.loadURL(`${origin}/overlay/?${new URLSearchParams({ view: "match", match: "x2", variant,
      preview: mode, autoplay: "true", loop: "true", token: state.settings.overlayToken })}`);
  };
  const results = [];
  for (const variant of ["tikcontrol", "cyber"]) {
    const previousTickets = requests.tickets;
    await load(variant);
    await previewWindow.webContents.executeJavaScript(`(() => {
      globalThis.previewSmokeFrames = 0;
      const video = document.getElementById("match-video");
      const next = () => { globalThis.previewSmokeFrames += 1; video.requestVideoFrameCallback(next); };
      video.requestVideoFrameCallback(next);
    })()`);
    await waitUntil(async () => { const value = await sample(); return value.status === "ready" && value.readyState >= 2 && !value.paused && value.currentTime >= 1.8; });
    const samples = [await sample()];
    await delay(700); samples.push(await sample());
    await delay(700); samples.push(await sample());
    const first = samples[0], last = samples.at(-1);
    assert.ok(last.currentTime > first.currentTime + 0.8, `x2 ${variant} doit progresser`);
    assert.ok(last.decodedFrames > first.decodedFrames + 8);
    assert.ok(last.presentedFrames > first.presentedFrames + 8);
    assert.ok(new Set(samples.map((value) => value.frameHash)).size > 1, "les vraies images changent");
    assert.ok(samples.every((value) => value.autoplay && value.loop && value.muted && !value.paused && value.ticketSource && !value.hidden));
    assert.equal(requests.tickets, previousTickets + 1);
    assert.equal(ticketStatuses.at(-1), 200);
    assert.equal(overlayServer.sseClients.size, 0);
    const screenshot = path.join(targetDirectory, `match-x2-${variant}-animated-pro.png`);
    fs.writeFileSync(screenshot, (await previewWindow.webContents.capturePage()).toPNG());
    results.push({ variant, mode: "animated", tier: "pro", samples, screenshot });
  }
  state.commerce.subscription = { tier: "free", status: "free", source: "free" };
  const beforeFree = { ...requests };
  await load("cyber");
  await waitUntil(async () => (await sample()).status === "pro-required");
  await waitUntil(() => ticketStatuses.at(-1) === 403);
  const free = await sample();
  assert.equal(free.poster, "x2-cyber.webp");
  assert.equal(free.hasSource, false); assert.equal(free.hasSourceAttribute, false);
  assert.equal(free.paused, true); assert.equal(free.currentTime, 0);
  assert.equal(requests.tickets, beforeFree.tickets + 1); assert.equal(requests.media, beforeFree.media);
  assert.equal(overlayServer.sseClients.size, 0);
  results.push({ variant: "cyber", mode: "animated", tier: "free", sample: free, ticketStatus: 403 });

  state.commerce.subscription = { tier: "pro", status: "active", source: "own" };
  const beforeStatic = { ...requests };
  await load("cyber", "static");
  await waitUntil(async () => (await sample()).status === "poster");
  await delay(250);
  const staticPro = await sample();
  assert.equal(staticPro.poster, "x2-cyber.webp");
  assert.equal(staticPro.hasSource, false); assert.equal(staticPro.hasSourceAttribute, false);
  assert.equal(staticPro.paused, true);
  assert.equal(requests.tickets, beforeStatic.tickets); assert.equal(requests.media, beforeStatic.media);
  assert.equal(overlayServer.sseClients.size, 0);
  results.push({ variant: "cyber", mode: "static", tier: "pro", sample: staticPro });
  for (const name of ["sse", "rawMedia", "privateAssets"]) assert.equal(requests[name], 0, name);
  const result = { results, requests, ticketStatuses, consoleErrors, sseClients: overlayServer.sseClients.size, temporaryDirectory };
  fs.writeFileSync(path.join(targetDirectory, "result.json"), JSON.stringify(result, null, 2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

app.whenReady().then(run).then(async () => {
  clearTimeout(deadline); previewWindow?.destroy(); await overlayServer?.stop(); app.exit(0);
}).catch(async (error) => {
  clearTimeout(deadline);
  fs.writeFileSync(path.join(temporaryDirectory, "failure.json"), JSON.stringify({ error: error?.stack || String(error), stage: currentStage }, null, 2));
  process.stderr.write(`${error?.stack || error}\n`);
  previewWindow?.destroy(); await overlayServer?.stop().catch(() => {}); app.exit(1);
});
