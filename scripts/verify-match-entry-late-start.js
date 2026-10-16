"use strict";

/**
 * Régression Chromium réelle : entrée HTTPS ouverte AVANT ShenPulse, présence
 * hors ligne, puis démarrage local et présence fraîche sur un vrai EventSource.
 * Usage : node scripts/verify-match-entry-late-start.js
 *
 * Les seules réponses HTTPS sont fabriquées par le gestionnaire de protocole
 * de cette session temporaire : aucun serveur Firebase, compte ou LIVE réel.
 * Le serveur Matchs et les vidéos protégées sont réels mais l'état est factice.
 * Fenêtre invisible, matériel muet avant tout chargement, puis gain nul en plus.
 */
if (!process.versions.electron) {
  const { spawnSync } = require("node:child_process"), environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawnSync(require("electron"), [__filename], { env: environment, stdio: "inherit", windowsHide: true });
  if (child.error) process.stderr.write(`${child.error.message}\n`);
  process.exit(child.status ?? 1);
}
const assert = require("node:assert/strict"), fs = require("node:fs"), net = require("node:net");
const os = require("node:os"), path = require("node:path");
const { app, BrowserWindow } = require("electron");
const { OverlayServer } = require("../src/main/overlay-server");
const { matchAccountNumber } = require("../src/main/match-access");
const { selectStatePaths } = require("../src/main/state-projection");
const output = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-match-late-start-"));
app.setPath("userData", path.join(output, "chromium"));
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND, EXCLUDE 127.0.0.1");
const report = { ok: false, scope: "HTTPS/Firebase artificiels, magasin isolé, aucune interaction ou son utilisateur.",
  bootstrapRequests: 0, presenceStreams: 0, blockedRequests: 0, navigations: [], consoleErrors: [] };
let server, player, stage = "initialisation", finished = false;
const controllers = new Set(), encoder = new TextEncoder();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value) => String(value).replace(/https?:\/\/\S+/g, "[URL masquée]");
const deadline = setTimeout(() => finish(new Error(`Délai dépassé : ${stage}`)), 25000);
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer(); probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => { const port = probe.address().port; probe.close(() => resolve(port)); });
  });
}
async function waitUntil(callback, timeoutMs = 10000) {
  const expires = Date.now() + timeoutMs;
  while (Date.now() < expires) { if (await callback()) return; await delay(50); }
  throw new Error(`Condition non atteinte : ${stage}`);
}
async function inspect() {
  return player.webContents.executeJavaScript(`(() => {
    const video=document.getElementById('match-video');
    return {protocol:location.protocol,entry:globalThis.shenPulseMatchLocalEntry?.status||'',
      hasVideo:Boolean(video),hidden:document.documentElement.hidden,
      playbackId:video?.dataset.matchPlaybackId||'',time:video?.currentTime||0,
      muted:video?.muted,paused:video?.paused,
      frames:video?.getVideoPlaybackQuality?.().totalVideoFrames||0,
      error:document.documentElement.dataset.matchPlaybackError||''};
  })()`);
}
async function run() {
  const account = { uid: "late-start-fixture", email: "fixture@example.invalid", refreshTokenSecretId: "fixture-only" };
  const channel = "l".repeat(24), accountNumber = matchAccountNumber(account.uid);
  const state = { settings: { overlayPort: await freePort(), apiPort: await freePort(), overlayToken: "fixture-overlay", apiToken: "fixture-api", account,
    matchAccess: { accessKey: "a".repeat(32) }, publicOverlayRelay: { publicBaseUrl: "https://shenpulse-overlays.web.app", matchChannelId: channel },
    siteVisibility: {}, tiktok: { roomId: "fixture-room" }, matches: { widgets: {}, automations: [] } },
    session: { profileId: "fixture-profile", running: true }, commerce: { subscription: { tier: "pro", status: "active" } },
    matchSession: {}, overlaySession: {}, rules: [], goals: [], statistics: {} };
  const origin = `http://127.0.0.1:${state.settings.overlayPort}`;
  const store = { getState: () => { throw new Error("Magasin utilisateur interdit"); },
    getStateProjection: (keys) => selectStatePaths(state, keys), getSecret: () => "fixture-refresh-only" };
  server = new OverlayServer({ store, staticDirectory: path.join(__dirname, "../resources/overlays"),
    onInboundEvent: async () => { throw new Error("Événement externe interdit"); },
    onEffectRequest: async () => { throw new Error("Effet applicatif externe interdit"); } });
  const documentValue = { matchSource: { enabled: true, accountNumber, localPort: state.settings.overlayPort, localEntryVersion: 1 },
    presence: { connected: false, updatedAt: new Date().toISOString() } };
  player = new BrowserWindow({ width: 360, height: 640, show: false, backgroundColor: "#00000000", webPreferences: {
    partition: "isolated-match-entry-late-start", backgroundThrottling: false, contextIsolation: true,
    nodeIntegration: false, sandbox: true, offscreen: true, webSecurity: true } });
  player.webContents.setAudioMuted(true);
  player.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  player.webContents.on("did-finish-load", () => report.navigations.push(new URL(player.webContents.getURL()).protocol));
  const session = player.webContents.session;
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  session.protocol.handle("https", (request) => {
    const url = new URL(request.url);
    if (url.hostname === "entry-fixture.invalid") {
      if (url.pathname === `/m/${accountNumber}/${channel}`) return new Response(
        '<!doctype html><html><head><script src="/runtime/dependencies.js"></script><script src="/runtime/match-local-entry.js"></script></head><body></body></html>',
        { headers: { "Content-Type": "text/html; charset=utf-8" } });
      if (["/runtime/dependencies.js", "/runtime/match-local-entry.js"].includes(url.pathname)) return new Response(
        fs.readFileSync(path.join(__dirname, "../resources/overlays", url.pathname), "utf8"),
        { headers: { "Content-Type": "text/javascript; charset=utf-8" } });
      return new Response("", { status: 404 });
    }
    if (url.hostname === "shenazenoverlay-default-rtdb.firebaseio.com" && url.pathname === `/publicOverlayRelay/${channel}.json`) {
      const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };
      if (!request.headers.get("accept")?.includes("text/event-stream")) {
        report.bootstrapRequests += 1;
        return new Response(JSON.stringify(documentValue), { headers: { ...headers, "Content-Type": "application/json" } });
      }
      report.presenceStreams += 1;
      const body = new ReadableStream({ start(controller) {
        controllers.add(controller);
        controller.enqueue(encoder.encode(`event: put\ndata: ${JSON.stringify({ path: "/", data: documentValue })}\n\n`));
      }, cancel() { controllers.clear(); } });
      return new Response(body, { headers: { ...headers, "Content-Type": "text/event-stream; charset=utf-8" } });
    }
    report.blockedRequests += 1;
    return new Response("", { status: 403 });
  });
  session.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    const allowed = ["about:", "data:", "blob:"].includes(url.protocol) || url.origin === origin ||
      url.protocol === "https:" && ["entry-fixture.invalid", "shenazenoverlay-default-rtdb.firebaseio.com"].includes(url.hostname);
    if (!allowed) report.blockedRequests += 1;
    callback({ cancel: !allowed });
  });
  player.webContents.on("console-message", (details) => {
    if (details.level === "error") report.consoleErrors.push(clean(details.message));
  });
  stage = "entrée HTTPS avant démarrage local";
  await player.loadURL(`https://entry-fixture.invalid/m/${accountNumber}/${channel}?transport=local`);
  await waitUntil(() => report.presenceStreams === 1);
  report.before = await inspect(); assert.equal(report.before.protocol, "https:");
  assert.equal(report.before.hasVideo, false); assert.equal(report.before.entry, "unavailable");
  stage = "démarrage local puis présence fraîche sans actualisation";
  await server.start(); documentValue.presence = { connected: true, updatedAt: new Date().toISOString() };
  for (const controller of controllers) controller.enqueue(encoder.encode(
    `event: patch\ndata: ${JSON.stringify({ path: "/presence", data: documentValue.presence })}\n\n`));
  await waitUntil(() => player.webContents.getURL().startsWith(origin) && server.sseClients.size === 1);
  report.after = await inspect(); assert.equal(report.after.protocol, "http:");
  assert.equal(report.after.hasVideo, true); assert.equal(report.after.hidden, false);
  assert.equal(report.after.playbackId, "", "l'entrée ne doit rejouer aucun effet ancien");
  report.silentGraph = await player.webContents.executeJavaScript(`(async () => {
    const context=new AudioContext(),source=context.createMediaElementSource(document.getElementById('match-video'));
    const gain=context.createGain();gain.gain.value=0;source.connect(gain);gain.connect(context.destination);
    globalThis.lateStartAudioGraph={context,source,gain};await context.resume();
    return {state:context.state,gain:gain.gain.value};
  })()`);
  assert.equal(report.silentGraph.gain, 0);
  stage = "animation originale après reprise automatique";
  const request = server.playMatch({ match: "x2", variant: "cyber" });
  await waitUntil(async () => { const value = await inspect(); return value.playbackId === request.requestId && value.time >= .25; });
  const first = await inspect(); await delay(700); const last = await inspect();
  assert.ok(last.time > first.time + .4 && last.frames > first.frames + 8);
  assert.equal(last.error, ""); assert.equal(last.paused, false);
  report.playback = { first, last }; report.hardwareOutputMuted = player.webContents.isAudioMuted();
  assert.equal(report.hardwareOutputMuted, true); assert.equal(report.bootstrapRequests, 1);
  assert.equal(report.presenceStreams, 1); assert.equal(report.blockedRequests, 0);
  assert.deepEqual(report.navigations, ["https:", "http:"]);
  assert.deepEqual(report.consoleErrors, []); report.ok = true;
}
async function finish(error = null) {
  if (finished) return; finished = true; clearTimeout(deadline);
  if (error) report.error = clean(error.stack || error);
  report.stage = stage;
  player?.destroy(); for (const controller of controllers) { try { controller.close(); } catch { /* Déjà fermé. */ } }
  await server?.stop().catch(() => {});
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify({ ...report, reportFile: path.join(output, "report.json") }, null, 2)}\n`);
  app.exit(report.ok && !error ? 0 : 1);
}
app.whenReady().then(run).then(() => finish()).catch(finish);
