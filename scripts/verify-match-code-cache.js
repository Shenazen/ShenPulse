"use strict";

/**
 * Régression cache HTTP réelle : deux moteurs Match sous la même version
 * applicative, le même port et la même partition Chromium persistante.
 * Le premier script reste réellement en cache après remplacement du serveur ;
 * le document no-store doit charger le second grâce à son empreinte de code.
 *
 * Usage : node scripts/verify-match-code-cache.js
 * État et copies de ressources synthétiques en dossier temporaire, aucune
 * installation utilisateur, aucun LIVE/Studio ni média. Fenêtre invisible,
 * sortie matérielle muette avant tout chargement, réseau externe interdit.
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
const { app, BrowserWindow } = require("electron");
const { OverlayServer } = require("../src/main/overlay-server");
const { matchAccountNumber } = require("../src/main/match-access");
const { selectStatePaths } = require("../src/main/state-projection");
const { createMatchSession } = require("../src/shared/matches-contract");

const output = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-match-code-cache-"));
app.setPath("userData", path.join(output, "chromium"));
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND, EXCLUDE 127.0.0.1");
const report = { ok: false, scope: "Serveur et compte artificiels, même partition Chromium ; aucun média, son, LIVE ou Studio utilisateur.",
  commercialVersion: require("../package.json").version, stages: [], samples: [],
  requests: [], externalRequests: 0, unexpectedMediaRequests: 0, networkErrors: [], fontCacheProbes: [], consoleErrors: [] };
let server, player, origin, stage = "initialisation", finished = false;
const deadline = setTimeout(() => finish(new Error(`Délai global dépassé : ${stage}`)), 55000);
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const clean = (value) => String(value?.stack || value).replace(/https?:\/\/\S+/g, "[URL fixture]");
const mark = (value) => { stage = value; report.stages.push(value); };

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer(); probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => { const port = probe.address().port; probe.close(() => resolve(port)); });
  });
}

function copyFixture(revision) {
  const source = path.join(__dirname, "../resources/overlays");
  const target = path.join(output, revision);
  const permittedDirectories = new Set(["catalog", "runtime", "styles", "vendor", "fonts"]);
  fs.cpSync(source, target, { recursive: true, filter: (filename) => {
    const relative = path.relative(source, filename);
    if (!relative) return true;
    const segments = relative.split(path.sep);
    const stat = fs.lstatSync(filename);
    if (stat.isSymbolicLink()) return false;
    if (segments.length > 1 && !permittedDirectories.has(segments[0])) return false;
    if (stat.isDirectory()) return permittedDirectories.has(segments[0]);
    return stat.isFile() && (/\.(?:js|css|woff2?)$/i.test(filename) || relative === "index.html");
  } });
  fs.appendFileSync(path.join(target, "runtime/widgets/match.js"),
    `\n/* Marqueur de fixture sans média ni effet. */\nglobalThis.matchCodeCacheFixtureRevision = ${JSON.stringify(revision)};\n`);
  return target;
}

async function waitForRevision(revision) {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    const sample = await player.webContents.executeJavaScript(`({
      revision: globalThis.matchCodeCacheFixtureRevision || "",
      version: document.querySelector('meta[name="shenpulse-overlay-version"]')?.content || "",
      moduleUrl: [...document.scripts].map(script => script.src).find(url => /\\/runtime\\/widgets\\/match\\.js\\?/.test(url)) || "",
      ready: Boolean(globalThis.shenPulseOverlayPerformance?.modulesReadyAt),
      error: document.documentElement.dataset.overlayLoadError || ""
    })`);
    if (sample.error) throw new Error(`Le lecteur signale une erreur : ${sample.error}`);
    if (sample.revision === revision && sample.ready) {
      // Attendre aussi le chargement CSS/font évite de couper une requête
      // annexe encore en vol pendant le redémarrage volontaire du serveur.
      sample.fontsLoaded = await player.webContents.executeJavaScript(
        `document.fonts.load('16px Inter').then(fonts => fonts.length > 0 && fonts.every(font => font.status === "loaded"))`
      );
      assert.equal(sample.fontsLoaded, true);
      assert.equal(player.webContents.isAudioMuted(), true);
      assert.match(sample.version, /^match-local-[a-f0-9]{24}$/);
      assert.equal(new URL(sample.moduleUrl).searchParams.get("v"), sample.version);
      report.samples.push({ ...sample, moduleUrl: new URL(sample.moduleUrl).pathname + new URL(sample.moduleUrl).search });
      return sample;
    }
    await delay(50);
  }
  throw new Error(`Le moteur ${revision} n'a pas été chargé.`);
}

async function run() {
  const firstDirectory = copyFixture("first"), secondDirectory = copyFixture("second");
  const state = {
    settings: { overlayPort: await freePort(), apiPort: await freePort(), overlayToken: "fixture-overlay", apiToken: "fixture-api",
      account: { uid: "fixture-code-cache", email: "fixture@example.invalid", refreshTokenSecretId: "fixture-only" },
      siteVisibility: {}, publicOverlayRelay: { matchChannelId: "m".repeat(24) }, matchAccess: { accessKey: "a".repeat(32) },
      matches: { widgets: {} }, tiktok: { roomId: "fixture-room" }, overlayConfigs: {} },
    session: { profileId: "fixture-profile", running: true }, commerce: { subscription: { tier: "pro", status: "active" } },
    goals: [], statistics: {}, overlaySession: {}, matchSession: createMatchSession()
  };
  const store = { getState: () => { throw new Error("Aucun magasin utilisateur n'est accessible."); },
    getStateProjection: (keys) => selectStatePaths(state, keys), getSecret: () => "fixture-refresh-only" };
  const createServer = async (staticDirectory) => {
    server = new OverlayServer({ store, staticDirectory,
      onInboundEvent: async () => { throw new Error("Aucun événement autorisé."); },
      onEffectRequest: async () => { throw new Error("Aucun effet autorisé."); } });
    await server.start();
  };
  origin = `http://127.0.0.1:${state.settings.overlayPort}`;
  const source = `${origin}/match-bridge/${matchAccountNumber(state.settings.account.uid)}/${state.settings.publicOverlayRelay.matchChannelId}?soundEnabled=false`;
  player = new BrowserWindow({ show: false, width: 360, height: 640, webPreferences: {
    partition: "persist:isolated-match-code-cache", backgroundThrottling: false, contextIsolation: true,
    nodeIntegration: false, sandbox: true, offscreen: true, webSecurity: true } });
  player.webContents.setAudioMuted(true);
  player.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const session = player.webContents.session;
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  session.on("will-download", (event) => event.preventDefault());
  session.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    if (!["about:", "blob:", "data:"].includes(url.protocol) && url.origin !== origin) {
      report.externalRequests += 1; return callback({ cancel: true });
    }
    if (/\/match-media\/|\/(?:ticket|match-preview)(?:\?|\/|$)|\.(?:webm|mp4|mp3|ogg|wav)(?:$|[?#])/i.test(url.pathname)) {
      report.unexpectedMediaRequests += 1; return callback({ cancel: true });
    }
    callback({});
  });
  session.webRequest.onCompleted((details) => {
    const url = new URL(details.url);
    if (url.origin === origin && /\.(?:js|css)$/.test(url.pathname)) report.requests.push({
      stage, path: url.pathname, version: url.searchParams.get("v"), fromCache: details.fromCache, status: details.statusCode
    });
  });
  session.webRequest.onErrorOccurred((details) => {
    // Le flux SSE de la première instance est volontairement fermé au redémarrage.
    const pathname = new URL(details.url).pathname;
    const diagnostic = {
      stage, resourceType: details.resourceType,
      path: pathname.startsWith("/match-bridge/") ? "document-Match-fixture" : pathname,
      error: clean(details.error)
    };
    // Chromium sonde parfois le cache seul pour la police préchargée sous
    // une autre URL que son @font-face. Sa vraie lecture/décompression est
    // vérifiée séparément par document.fonts.load dans chaque document.
    if (details.resourceType === "font" && details.error === "net::ERR_CACHE_MISS") report.fontCacheProbes.push(diagnostic);
    else if (!pathname.endsWith("/events")) report.networkErrors.push(diagnostic);
  });
  player.webContents.on("console-message", (_event, level, message) => {
    if (level >= 3) report.consoleErrors.push(clean(message));
  });

  mark("première instance et mise en cache Chromium");
  await createServer(firstDirectory);
  await player.loadURL(source);
  const first = await waitForRevision("first");
  const firstModule = await player.webContents.executeJavaScript(`fetch(${JSON.stringify(first.moduleUrl)}, { cache: "force-cache" }).then(response => response.text())`);
  assert.ok(firstModule.includes('matchCodeCacheFixtureRevision = "first"'));

  mark("redémarrage même port et même version commerciale, sans vider le cache");
  await server.stop(); server = null;
  await createServer(secondDirectory);
  // Navigation normale, pas reloadIgnoringCache, session.clearCache ou nouveau profil.
  await player.loadURL(source);
  const second = await waitForRevision("second");
  assert.notEqual(first.version, second.version);
  assert.notEqual(first.moduleUrl, second.moduleUrl);
  assert.equal(player.webContents.session, session);

  mark("preuve que l'ancien script immutable reste dans le vrai cache");
  const cachedFirst = await player.webContents.executeJavaScript(`fetch(${JSON.stringify(first.moduleUrl)}, { cache: "force-cache" }).then(response => response.text())`);
  assert.ok(cachedFirst.includes('matchCodeCacheFixtureRevision = "first"'), "Le vrai cache doit encore contenir le premier moteur sous son ancienne URL.");
  const uncachedOldUrl = await fetch(first.moduleUrl, { headers: { Connection: "close" } }).then(response => response.text());
  assert.ok(uncachedOldUrl.includes('matchCodeCacheFixtureRevision = "second"'), "Le serveur expose pourtant déjà le nouveau code à cette ancienne URL.");
  report.oldUrlServesCachedFirstButServerHasSecond = true;
  report.cachedModuleRequests = report.requests.filter((request) => request.path === "/overlay/runtime/widgets/match.js" && request.fromCache).length;
  assert.ok(report.cachedModuleRequests > 0, "Chromium doit confirmer une réponse issue du cache HTTP.");
  assert.equal(report.externalRequests, 0);
  assert.equal(report.unexpectedMediaRequests, 0);
  assert.deepEqual(report.networkErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  assert.equal(player.webContents.isAudioMuted(), true);
  report.ok = true;
}

async function finish(error) {
  if (finished) return; finished = true;
  clearTimeout(deadline);
  if (error) { report.ok = false; report.stage = stage; report.error = clean(error); }
  player?.destroy(); await server?.stop().catch(() => {});
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ ok: report.ok, cachedModuleRequests: report.cachedModuleRequests,
    versions: report.samples.map((sample) => sample.version), fontCacheProbes: report.fontCacheProbes.length,
    report: path.join(output, "report.json"),
    ...(error ? { error: report.error } : {}) }, null, 2) + "\n");
  app.exit(report.ok ? 0 : 1);
}

app.whenReady().then(run).then(() => finish()).catch(finish);
