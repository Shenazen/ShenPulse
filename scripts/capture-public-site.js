"use strict";

/**
 * Captures publiques reproductibles du véritable renderer ShenPulse.
 *
 * Exécution : node_modules/.bin/electron scripts/capture-public-site.js
 * Les données sont exclusivement synthétiques ; aucun StateStore, compte,
 * service distant, fichier utilisateur ou équipement n'est consulté. Les API
 * d'écriture, de lecture multimédia et de contrôle échouent avant tout effet.
 * Un profil Chromium temporaire et non partagé est conservé pour l'audit.
 */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");
const { createDefaultState } = require("../src/main/defaults");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const overlayCatalog = require("../resources/overlays/overlay-catalog");
const { version: appVersion } = require("../package.json");
const { normalizeMatchesConfig } = require("../src/shared/matches-contract");

const root = path.resolve(__dirname, "..");
const matchesReview = process.argv.includes("--matches-redesign");
const outputDirectory = path.join(root, matchesReview ? "tmp/matches-page-review-20261016" : "website/public/screenshots");
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-public-captures-"));
const viewport = { width: matchesReview && process.argv.includes("--narrow") ? 980 : 1440, height: 900 };
const consoleErrors = [], blockedRequests = [], frameErrors = [], results = [];
let captureWindow, staticServer, staticOrigin = "", stage = "initialisation";
app.setPath("userData", path.join(temporaryDirectory, "chromium"));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND, EXCLUDE 127.0.0.1");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deadline = setTimeout(() => { process.stderr.write(`Délai dépassé : ${stage}\n`); app.exit(1); }, 180000);

function createFixture() {
  const state = createDefaultState();
  const now = Date.now();
  const at = (minutes) => new Date(now - minutes * 60000).toISOString();
  state.settings.account = { uid: "public-demo", email: "", authenticated: true, displayName: "Démonstration", emailVerified: true };
  state.settings.siteVisibility.navigation = { live: { scope: "hidden" }, goals: { scope: "hidden" } };
  state.commerce.subscription = { ...state.commerce.subscription, tier: "pro", status: "active", source: "own" };
  state.profiles[0].name = "LIVE · démonstration";
  state.profiles[0].description = "Configuration d'exemple, sans données personnelles.";
  state.session.running = true;
  state.session.startedAt = at(24);
  state.settings.tiktok = { ...state.settings.tiktok, username: "exemple_createur", status: "live", currentViewers: 128, broadcaster: { uniqueId: "exemple_createur", nickname: "Démonstration" } };
  state.connections = [{ id: "source_tiktok", name: "TikTok · démonstration", type: "tiktok-direct", enabled: true, status: "connected", liveStatus: "live", config: { username: "exemple_createur" } }];
  state.settings.irl = { enabled: false, devices: ["Lumière · démo", "Ventilateur · démo", "Ballon · démo"].map((name, index) => ({ id: `shellyplusplugs-demo-${index}`, name, host: `prise-${index + 1}.invalid`, model: "SNPL-00112EU", generation: 2, online: true, controllable: true })) };
  const soundRules = [
    ["Merci pour la rose", "gift", "Merci · exemple", true, "local"],
    ["Bienvenue aux nouveaux", "follow", "Bienvenue · exemple", true, "live"],
    ["Objectif de likes", "like", "Objectif · exemple", false, "live"]
  ].map(([name, type, soundName, enabled, outputMode], index) => ({ id: `demo-sound-${index}`, name, enabled, trigger: { type }, conditions: type === "gift" ? [{ field: "data.giftName", operator: "equals", value: "Rose", giftId: "5655" }] : [], actions: [{ id: `demo-sound-action-${index}`, type: "audio.play", config: { soundName, soundUrl: "", outputMode, liveScreen: 1, volume: 0.7 } }] }));
  const irlRules = ["Lumière 2 secondes", "Ventilateur 3 secondes", "Ballon 1 seconde"].map((name, index) => ({ id: `demo-irl-${index}`, name, enabled: true, trigger: { type: index === 1 ? "follow" : "gift" }, conditions: index === 1 ? [] : [{ field: "data.giftName", operator: "equals", value: "Rose", giftId: "5655" }], actions: [{ id: `demo-irl-action-${index}`, type: "irl.shelly", config: { deviceId: state.settings.irl.devices[index].id, operation: "pulse", durationMs: [2000, 3000, 1000][index] } }] }));
  state.rules = [...soundRules, ...irlRules];
  state.profiles[0].enabledRuleIds = state.rules.filter((rule) => rule.enabled).map((rule) => rule.id);
  state.commands = [
    { id: "demo-skip", kind: "command", command: "!skip", aliases: ["!suivant"], execution: { type: "music", operation: "next" }, enabled: true, audience: "moderator", cooldownMs: 10000, globalCooldownMs: 3000 },
    { id: "demo-wheel", kind: "command", command: "!roue", aliases: [], execution: { type: "overlay", overlayKey: "wheel", operation: "spin" }, enabled: true, audience: "everyone", cooldownMs: 15000, globalCooldownMs: 3000 },
    { id: "demo-light", kind: "command", command: "!lumiere", aliases: [], execution: { type: "action", actionId: "demo-irl-action-0" }, enabled: true, audience: "moderator", cooldownMs: 10000, globalCooldownMs: 3000 },
    { id: "demo-wins", kind: "command", command: "!victoire", aliases: ["!wins"], execution: { type: "overlay", overlayKey: "winCounter", operation: "adjust", amount: 1 }, enabled: false, audience: "subscriber", cooldownMs: 20000 }
  ];
  const people = [
    ["demo_luna", "Luna · démo", 3200], ["demo_noa", "Noa · démo", 1800], ["demo_iris", "Iris · démo", 650], ["demo_sacha", "Sacha · démo", 120], ["demo_jade", "Jade · démo", 15], ["demo_eli", "Éli · démo", 0]
  ].map(([username, name, diamonds], index) => ({ id: `demo-viewer-${index}`, username, name, displayName: name, platform: "tiktok", streamer: "exemple_createur", diamonds, coins: diamonds, gifts: index ? 5 : 12, likes: 1200 - index * 150, comments: 5 + index, shares: 1, avatarUrl: "", firstSeen: at(1440 + index * 60), lastSeen: at(index), blocked: false }));
  state.statistics.liveSession = { ...state.statistics.liveSession, hasData: true, platform: "tiktok", username: "exemple_createur", startedAt: at(24), events: 352, gifts: 47, giftCoins: 5785, likes: 12450, platformLikes: 18320, followers: 26, shares: 18, comments: 142, currentViewers: 128, peakViewers: 164, viewersByPlatform: { tiktok: 128, kick: null }, participants: people, topDonors: people.slice(0, 5), audienceHistory: [25, 40, 36, 62, 71, 66, 98, 115, 104, 138, 121, 128].map((viewers, index) => ({ atMs: now - (11 - index) * 120000, viewers })), engagementHistory: [] };
  state.statistics.sessionEvents = 352;
  state.statistics.liveSession.audienceHistory = state.statistics.liveSession.audienceHistory.map((point) => ({ ...point, timestamp: new Date(point.atMs).toISOString() }));
  state.statistics.sessionLikes = 12450;
  state.statistics.sessionUniqueViewers = people.map((person) => person.id);
  state.activity = [];
  state.matchSession = { ...state.matchSession, status: "running", battleId: "demonstration", scope: { uid: "public-demo", profileId: state.session.profileId }, startedAtMs: now - 90000, endsAtMs: now + 110000, multiplier: 2, participants: [{ id: "demo-creator", username: "exemple_createur", displayName: "Démonstration", own: true, score: 12300, avatarUrl: "" }, { id: "demo-opponent", username: "exemple_invite", displayName: "Invité · démo", own: false, score: 10750, avatarUrl: "" }], liveContributors: people.slice(0, 3), rounds: { own: 2, opponent: 1 }, session: { battles: 5, wins: 3, losses: 1, draws: 1, winStreak: 2 }, history: [{ result: "win", ownScore: 8400, rivalScore: 7200, endedAtMs: now - 300000 }], capabilities: { battle: true, scores: true, multiplier: true, cards: false } };
  const requestSettings = { enabled: true, allowExplicit: false, maxDurationMinutes: 10, maxQueue: 20, maxPerViewer: 3, cooldownSeconds: 10, allowViewerSkip: false, blockedArtists: [], commands: { request: "!sr", skip: "!skip", nowPlaying: "!np", queue: "!queue" } };
  const track = { id: "demo-track", name: "Piste de démonstration", artists: ["Bibliothèque exemple"], album: "Sélection démo", durationMs: 210000, imageUrl: "" };
  const spotify = { configured: true, connected: true, account: { displayName: "Démonstration" }, activeDevice: { name: "Lecteur de démonstration", volume: 65 }, playback: { item: track, isPlaying: false, progressMs: 65000 }, capabilities: { canControlPlayback: true, canControlVolume: true, canSearch: true }, songRequests: { settings: requestSettings } };
  const requests = { settings: requestSettings, queue: [{ id: "demo-request-1", track: { ...track, name: "Prochaine piste · exemple" }, username: "demo_luna", requestedBy: "demo_luna" }, { id: "demo-request-2", track: { ...track, name: "Ambiance de démonstration" }, username: "demo_noa", requestedBy: "demo_noa" }] };
  state.settings.spotify.songRequests = requestSettings;
  // Le catalogue complet reste fidèle ; les couvertures distantes hors champ
  // utilisent simplement le repli officiel de l'UI pendant cette session hors ligne.
  const packs = loadShenazenGameCatalog(path.join(root, "resources")).filter((pack) => pack.ownerOnly !== true).map((pack) => ({ ...pack, artworkUrl: "" }));
  const overlayUrls = { base: "https://exemple.invalid" }, localOverlayUrls = {};
  for (const item of overlayCatalog.definitionsWithUrls().filter((item) => item.category === "counters")) {
    const local = new URL("/overlay/index.html", staticOrigin);
    local.searchParams.set("view", item.route.view);
    localOverlayUrls[item.key] = local.toString();
    overlayUrls[item.key] = `https://exemple.invalid/overlay/${item.route.view}`;
  }
  if (matchesReview) {
    // Synthetic renderer qualification only. These values cannot reach a
    // real overlay server, customer account, LIVE, media player or device.
    overlayUrls.matchPlayer = "https://shenpulse-overlays.web.app/m/123456789012/fixture-review-channel-1234567890";
    state.settings.matches = normalizeMatchesConfig({ automations: [
      ["battleStart", "cofre", "tikcontrol"], ["multiplierX2", "x2", "cyber"],
      ["multiplierX3", "x3", "gladiador"], ["card", "guantes", "cyber"],
      ["likeRush", "taptap", "tikcontrol"], ["snipe", "snipe", "cyber"]
    ].map(([moment, match, variant]) => ({ id: `review-${moment}`, name: moment, moment,
      enabled: moment !== "card", reaction: { type: "animation", match, variant, fit: "contain" } })) });
  }
  return { state, appVersion, packs, soundCatalog: [], mediaCatalog: [], catalogCounts: {}, timerRuntime: [], overlayUrls, localOverlayUrls, publicOverlayRelay: { connected: true, status: "connected" }, liveDirectory: { available: true, connected: true, rows: people.slice(0, 3).map((person, index) => ({ id: person.id, platform: "TikTok", username: person.username, avatarUrl: "", viewers: [128, 76, 42][index] })) }, fixtureUsers: { rows: people, total: people.length, filteredTotal: people.length, blockedUsers: [], blockedTotal: 0, blockedEntries: [], streamers: ["exemple_createur"], stats: { diamonds: 5785, dominantRank: "" } }, fixtureSpotify: spotify, fixtureRequests: requests };
}

/** Remplace seulement la frontière IPC par une fixture : aucun rendu n'est simulé. */
function installFixture(snapshot) {
  const copy = (value) => JSON.parse(JSON.stringify(value));
  globalThis.publicCaptureCalls = { mutations: [], effects: [], media: [], network: [], errors: [] };
  const forbidden = (name, group = "effects") => async (...args) => { publicCaptureCalls[group].push({ name, args: copy(args) }); throw new Error(`Opération interdite dans la capture : ${name}`); };
  const rose = { id: "5655", name: "Rose", cost: 1, imageUrl: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#28caa0" d="M23 25h4v22h-4zM25 38 13 29l12 5z"/><path fill="#ff498c" d="M24 5c-8-9-22 5-13 14-5 10 11 19 18 11 13 1 18-15 10-21-5-7-12-6-15-4Z"/></svg>') };
  globalThis.shenPulse = {
    ...Object.fromEntries(["startSession", "stopSession", "simulateEvent", "testEvent", "testAction", "previewAction", "testRule", "startConnection", "startTikTok", "startGameSession", "stopGameSession", "triggerEffect", "launchGame", "selectGame", "testGame", "irlTest", "scanIrl", "openExternal"].map((name) => [name, forbidden(name)])),
    getSnapshot: async () => copy(snapshot), searchGifts: async () => ({ gifts: [rose], total: 1 }),
    upsert: forbidden("upsert", "mutations"), remove: forbidden("remove", "mutations"), saveSettings: forbidden("saveSettings", "mutations"),
    getGameRuntimeStatus: async () => null, getSpotifyStatus: async () => copy(snapshot.fixtureSpotify),
    controlSpotify: async (request) => { if (request.operation === "requests_status") return copy(snapshot.fixtureRequests); if (request.operation === "queue_list") return { queue: [] }; return forbidden("controlSpotify")(request); },
    users: { snapshot: async () => copy(snapshot.fixtureUsers) },
    updates: { check: async () => ({ available: false }) },
    account: { status: async () => copy(snapshot.state.settings.account), gameCheatAccess: async () => ({ allowed: false }), syncEntitlements: async () => null },
    admin: { status: async () => ({ authorized: false }), visibility: async () => copy(snapshot.state.settings.siteVisibility) },
    on: () => () => {}
  };
  globalThis.fetch = forbidden("fetch", "network");
  globalThis.WebSocket = class { constructor() { publicCaptureCalls.network.push({ name: "WebSocket" }); throw new Error("WebSocket interdit"); } };
  globalThis.EventSource = class { constructor() { publicCaptureCalls.network.push({ name: "EventSource" }); throw new Error("EventSource interdit"); } };
  HTMLMediaElement.prototype.play = forbidden("media.play", "media");
  globalThis.addEventListener("error", (event) => publicCaptureCalls.errors.push(String(event.error?.stack || event.message)));
  globalThis.addEventListener("unhandledrejection", (event) => publicCaptureCalls.errors.push(String(event.reason?.stack || event.reason)));
}

async function waitUntil(callback, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) { if (await callback()) return; await delay(60); }
  throw new Error(`Condition non atteinte : ${stage}`);
}

async function settleImages() {
  await captureWindow.webContents.executeJavaScript(`(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('img')].map(async (image) => { image.loading='eager'; try { await image.decode(); } catch {} }));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  })()`);
  await delay(180);
}

async function capture({ file, label, page, setup = "", scroll = 0 }) {
  stage = file;
  await captureWindow.webContents.executeJavaScript(`currentPage=${JSON.stringify(page)}; ${setup} render(); content.scrollTop=0;`);
  await settleImages();
  if (page === "users") { await captureWindow.webContents.executeJavaScript('refreshCreatorUsersDatabase({force:true})'); await delay(100); }
  await captureWindow.webContents.executeJavaScript(`content.scrollTop=${scroll};`);
  await settleImages();
  if (matchesReview) {
    // The synthetic authenticated session is injected after the startup UI
    // schedules its sign-in invitation. This closes only that fixture modal;
    // no real account, authentication dialog or user window is involved.
    await captureWindow.webContents.executeJavaScript('if(isAccountAuthenticated() && dialog.open) dialog.close("fixture-only");');
    await delay(80);
  }
  if (page === "overlays") {
    await waitUntil(() => captureWindow.webContents.executeJavaScript(`Array.from(content.querySelectorAll('iframe[data-overlay-src]')).filter(frame => { const rect=frame.getBoundingClientRect(); return rect.bottom>64 && rect.top<innerHeight; }).every(frame => frame.dataset.overlayPreviewReady==='true')`));
    await delay(400);
  }
  const audit = await captureWindow.webContents.executeJavaScript(`({ viewport:{width:innerWidth,height:innerHeight}, title:document.title, page:currentPage, authenticated:isAccountAuthenticated(), admin:isVerifiedAdminSession(), overflow:document.documentElement.scrollWidth-innerWidth, calls:publicCaptureCalls, brokenImages:[...document.querySelectorAll('img')].filter(img=>img.getBoundingClientRect().width>0 && (!img.complete || !img.naturalWidth)).map(img=>img.getAttribute('src')), text:document.getElementById('content').innerText })`);
  assert.deepEqual(audit.viewport, viewport);
  assert.equal(audit.authenticated, true);
  assert.equal(audit.admin, false);
  assert.ok(audit.overflow <= 1, `${file} : débordement de fenêtre`);
  assert.deepEqual(audit.brokenImages, [], `${file} : images non chargées`);
  assert.ok(!/alexa|@.*\.(?:com|fr)|192\.168\.|127\.0\.0\.1/i.test(audit.text), `${file} : contenu personnel ou adresse locale`);
  for (const [group, entries] of Object.entries(audit.calls)) assert.deepEqual(entries, [], `${file} : ${group} inattendu`);
  const target = path.join(outputDirectory, file);
  const png = (await captureWindow.webContents.capturePage()).toPNG();
  assert.equal(png.readUInt32BE(16), viewport.width); assert.equal(png.readUInt32BE(20), viewport.height);
  fs.writeFileSync(target, png);
  results.push({ path: `/screenshots/${file}`, ...viewport, label, sha256: crypto.createHash("sha256").update(png).digest("hex"), page, scroll });
  process.stdout.write(`Capture : ${file}\n`);
}

async function run() {
  // Serveur de fichiers de test uniquement : pas de route API, de jeton, de
  // websocket ou d'événement LIVE. Le port éphémère respecte la CSP réelle des
  // aperçus. Aucun répertoire utilisateur n'est accessible par cette route.
  const staticRoot = path.join(root, "resources/overlays");
  const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
  staticServer = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://fixture.invalid").pathname);
    const file = path.resolve(staticRoot, pathname.replace(/^\/overlay\//, ""));
    if (!["GET", "HEAD"].includes(request.method) || !file.startsWith(staticRoot + path.sep)) { response.writeHead(403); return response.end(); }
    fs.readFile(file, (error, contents) => { if (error) { response.writeHead(404); return response.end(); } response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); response.end(request.method === "HEAD" ? undefined : contents); });
  });
  await new Promise((resolve) => staticServer.listen(0, "127.0.0.1", resolve));
  staticOrigin = `http://127.0.0.1:${staticServer.address().port}`;
  const preload = path.join(temporaryDirectory, "fixture-preload.js");
  fs.writeFileSync(preload, `(${installFixture.toString()})(${JSON.stringify(createFixture())});\n`);
  fs.mkdirSync(outputDirectory, { recursive: true });
  captureWindow = new BrowserWindow({ ...viewport, show: false, backgroundColor: "#0b0d19", webPreferences: { preload, contextIsolation: false, nodeIntegration: false, sandbox: false, webSecurity: true, offscreen: true, backgroundThrottling: false, partition: "public-screenshot-fixture" } });
  captureWindow.setContentSize(viewport.width, viewport.height);
  captureWindow.webContents.setAudioMuted(true);
  captureWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  captureWindow.webContents.session.setPermissionCheckHandler(() => false);
  captureWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => { const url = new URL(details.url); if (!["file:", "data:", "blob:", "about:"].includes(url.protocol) && !(url.origin === staticOrigin && url.pathname.startsWith("/overlay/"))) { blockedRequests.push(details.url); return callback({ cancel: true }); } callback({}); });
  captureWindow.webContents.on("console-message", (details) => { if (details.level === "error") consoleErrors.push(details.message); });
  captureWindow.webContents.on("did-fail-load", (_event, code, description) => { if (code !== -3) frameErrors.push({ code, description, stage }); });
  await captureWindow.loadURL(pathToFileURL(path.join(root, "src/renderer/index.html")).toString());
  await waitUntil(() => captureWindow.webContents.executeJavaScript('Boolean(document.querySelector(".creator-home-page")) && isAccountAuthenticated()'));
  await captureWindow.webContents.executeJavaScript('(async()=>{spotifyStatus = await api.getSpotifyStatus();})()');
  const pages = matchesReview ? [
    { file: `matches-automations${viewport.width < 1000 ? "-narrow" : ""}.png`, label: "Matchs · automatisations", page: "matches", setup: 'creatorMatchesTab="automations";' },
    { file: `matches-moments${viewport.width < 1000 ? "-narrow" : ""}.png`, label: "Matchs · modèles adaptés", page: "matches", setup: 'creatorMatchesTab="automations";', scroll: 470 },
    { file: `matches-widgets${viewport.width < 1000 ? "-narrow" : ""}.png`, label: "Matchs · widgets", page: "matches", setup: 'creatorMatchesTab="widgets";', scroll: 220 }
  ] : [
    { file: "home-public.png", label: "Accueil ShenPulse", page: "home" },
    { file: "app-overview-public.png", label: "Tableau de bord et simulateur", page: "dashboard", scroll: 220 },
    { file: "actions-public.png", label: "Actions et déclencheurs", page: "actions", scroll: 190 },
    { file: "commands-public.png", label: "Commandes du chat", page: "commands", scroll: 170 },
    { file: "matches-public.png", label: "Suivi des matchs TikTok", page: "matches", scroll: 180 },
    { file: "music-public.png", label: "Musique et demandes de titres", page: "music", setup: 'creatorMusicTab="player";', scroll: 100 },
    { file: "irl-public.png", label: "Machines et interactions IRL", page: "irl", scroll: 200 },
    { file: "users-public.png", label: "Utilisateurs, rangs et modération", page: "users", scroll: 300 },
    { file: "overlays-public.png", label: "Objectifs, compteurs et overlays", page: "overlays", setup: 'overlayCategory="counters";', scroll: 370 },
    { file: "games-public.png", label: "Catalogue public de jeux", page: "games", setup: 'gamePageMode="catalog";', scroll: 150 },
    { file: "sounds-public.png", label: "Alertes sonores et diffusion LIVE", page: "voice", setup: 'creatorVoiceTab="sounds";', scroll: 220 },
    { file: "subscription-public.png", label: "Abonnements ShenPulse", page: "membership", scroll: 150 }
  ];
  for (const page of pages) await capture(page);
  assert.deepEqual(blockedRequests, [], "Aucune ressource distante ne doit être demandée");
  assert.deepEqual(consoleErrors, [], "Console Chromium sans erreur");
  assert.deepEqual(frameErrors, [], "Les aperçus réels ne doivent pas échouer");
  const entries = results.map(({ path: file, width, height, label, sha256 }) => `  ${JSON.stringify(file)}: ${JSON.stringify({ width, height, label, sha256 })}`).join(",\n");
  if (!matchesReview) fs.writeFileSync(path.join(root, "website/app/screenshots.js"), `/** Captures du renderer ${appVersion}, données de démonstration. Générées par scripts/capture-public-site.js. */\nexport const SCREENSHOTS = {\n${entries}\n};\n`);
  fs.writeFileSync(path.join(temporaryDirectory, "results.json"), JSON.stringify({ appVersion, results, consoleErrors, blockedRequests, frameErrors }, null, 2));
  process.stdout.write(JSON.stringify({ appVersion, outputDirectory, auditDirectory: temporaryDirectory, captures: results.length }, null, 2) + "\n");
}

app.whenReady().then(run).then(() => { clearTimeout(deadline); captureWindow?.destroy(); staticServer?.close(); app.exit(0); }).catch((error) => {
  clearTimeout(deadline);
  fs.writeFileSync(path.join(temporaryDirectory, "failure.json"), JSON.stringify({ stage, error: error.stack, consoleErrors, blockedRequests, frameErrors, results }, null, 2));
  process.stderr.write(`${error.stack}\nAudit : ${temporaryDirectory}\n`);
  captureWindow?.destroy(); staticServer?.close(); app.exit(1);
});
