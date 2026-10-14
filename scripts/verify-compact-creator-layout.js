"use strict";

/**
 * Smoke visuel Chromium des espaces créateurs compacts.
 * L'index, ses scripts et ses styles sont réels ; toutes les données et API sont
 * artificielles. Aucun StateStore, secret, réseau, lecteur audio ou appareil IRL
 * utilisateur n'est ouvert. Le profil Chromium et les captures restent dans un
 * répertoire temporaire distinct, conservé pour inspection.
 * Exécution : node_modules/.bin/electron scripts/verify-compact-creator-layout.js
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");
const { createDefaultState } = require("../src/main/defaults");
const { version: appVersion } = require("../package.json");

const rendererDirectory = path.resolve(__dirname, "../src/renderer");
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-compact-layout-"));
app.setPath("userData", path.join(temporaryDirectory, "chromium"));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND");

let testWindow = null;
let currentStage = "initialisation";
const consoleErrors = [], blockedRequests = [];
const results = [];
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const deadline = setTimeout(() => {
  fs.writeFileSync(path.join(temporaryDirectory, "failure.json"), JSON.stringify({ error: "Délai global dépassé", stage: currentStage }));
  app.exit(1);
}, 90000);

function fixtureSnapshot() {
  const state = createDefaultState();
  const account = { uid: "layout-fixture", email: "layout@example.invalid", authenticated: true, displayName: "Test disposition", emailVerified: true };
  state.settings.account = account;
  state.commerce.subscription = { tier: "pro", status: "active", source: "own" };
  state.settings.irl = { enabled: false, devices: ["Stroboscope", "Cuisine", "Ballon", "Lumière", "Ping-Pong"].map((name, index) => ({
    id: `shellyplusplugs-fixture-${index}`, name, host: `192.0.2.${10 + index}`, model: "SNPL-00112EU", generation: 2, online: index !== 4, controllable: true
  })) };
  state.rules = ["Ballon 1", "Lumière 3", "Ping-Pong 5"].map((name, index) => ({
    id: `irl-rule-${index}`, name, enabled: true, trigger: { type: index ? "follow" : "gift" },
    conditions: index ? [] : [{ field: "data.giftName", operator: "equals", value: "Rose", giftId: "5655" }],
    actions: [{ id: `irl-action-${index}`, type: "irl.shelly", config: { deviceId: state.settings.irl.devices[index].id, operation: "pulse", durationMs: (index + 1) * 1000 } }]
  })).concat(["Agadou 500+", "Follow", "Bienvenue"].map((name, index) => ({
    id: `audio-rule-${index}`, name, enabled: index !== 2, trigger: { type: index ? "follow" : "gift" },
    actions: [{ id: `audio-action-${index}`, type: "audio.play", config: { soundName: name, soundUrl: "", volume: 0.7, outputMode: index === 1 ? "live" : "local", liveScreen: 1 } }]
  })));
  state.profiles.find((profile) => profile.id === state.session.profileId).enabledRuleIds = state.rules.map((rule) => rule.id);
  state.commands = [
    { id: "skip", kind: "command", command: "!skip", aliases: ["!next", "!suivant"], execution: { type: "music", operation: "next" }, enabled: true, audience: "moderator", cooldownMs: 10000, globalCooldownMs: 3000 },
    { id: "launch", kind: "command", command: "!launch", aliases: [], execution: { type: "action", actionId: "irl-action-0" }, enabled: true, audience: "moderator", platform: "tiktok", cooldownMs: 10000, globalCooldownMs: 3000 },
    { id: "wins", kind: "command", command: "!wins", aliases: ["!victoire"], execution: { type: "overlay", overlayKey: "winCounter", operation: "adjust", amount: 1 }, enabled: false, audience: "subscriber", cooldownMs: 20000 }
  ];
  state.activity = [];
  state.connections = [];
  return { state, appVersion, packs: [], soundCatalog: [], mediaCatalog: [], catalogCounts: {},
    timerRuntime: [], overlayUrls: {}, localOverlayUrls: {}, publicOverlayRelay: {}, liveDirectory: { available: false, rows: [] } };
}

/** Preload sans IPC : les fonctions opérationnelles échouent avant tout effet. */
function installFixture(snapshot) {
  const copy = (value) => JSON.parse(JSON.stringify(value));
  globalThis.compactSmokeCalls = { mutations: [], effects: [], media: [], network: [], errors: [] };
  const forbidden = (name, group = "effects") => async (...args) => {
    compactSmokeCalls[group].push({ name, args: copy(args) });
    throw new Error(`Opération interdite dans le smoke : ${name}`);
  };
  const account = snapshot.state.settings.account;
  const rose = { id: "5655", name: "Rose", cost: 1, imageUrl: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#28caa0" d="M23 25h4v22h-4zM25 38 13 29l12 5z"/><path fill="#ff498c" d="M24 5c-8-9-22 5-13 14-5 10 11 19 18 11 13 1 18-15 10-21-5-7-12-6-15-4Z"/></svg>') };
  globalThis.shenPulse = {
    ...Object.fromEntries(["startSession", "stopSession", "simulateEvent", "testEvent", "testAction", "previewAction", "testRule", "startConnection", "startTikTok", "startGameSession", "stopGameSession", "triggerEffect", "controlSpotify", "launchGame", "selectGame", "testGame", "irlTest", "scanIrl", "openExternal"].map((name) => [name, forbidden(name)])),
    getSnapshot: async () => copy(snapshot), searchGifts: async () => ({ gifts: [rose], total: 1 }),
    upsert: forbidden("upsert", "mutations"), remove: forbidden("remove", "mutations"), saveSettings: forbidden("saveSettings", "mutations"),
    getGameRuntimeStatus: async () => null, getSpotifyStatus: async () => ({ configured: true, connected: false, devices: [] }),
    updates: { check: async () => ({ available: false }) },
    account: { status: async () => copy(account), gameCheatAccess: async () => ({ allowed: false }), syncEntitlements: async () => null },
    admin: { status: async () => ({ authorized: false }), visibility: async () => copy(snapshot.state.settings.siteVisibility) },
    on: () => () => {}
  };
  globalThis.fetch = forbidden("fetch", "network");
  globalThis.WebSocket = class { constructor() { compactSmokeCalls.network.push({ name: "WebSocket" }); throw new Error("WebSocket interdit"); } };
  globalThis.EventSource = class { constructor() { compactSmokeCalls.network.push({ name: "EventSource" }); throw new Error("EventSource interdit"); } };
  HTMLMediaElement.prototype.play = forbidden("media.play", "media");
  globalThis.addEventListener("error", (event) => compactSmokeCalls.errors.push(String(event.error?.stack || event.message)));
  globalThis.addEventListener("unhandledrejection", (event) => compactSmokeCalls.errors.push(String(event.reason?.stack || event.reason)));
}

async function waitUntil(callback, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await callback()) return;
    await delay(60);
  }
  throw new Error(`Condition non atteinte : ${currentStage}`);
}

function inspectLayout() {
  const content = document.getElementById("content");
  const box = (element) => element ? { width: Math.round(element.getBoundingClientRect().width), height: Math.round(element.getBoundingClientRect().height) } : null;
  const page = content.firstElementChild;
  const gift = content.querySelector("[data-gift-picker-root]");
  const simulator = content.querySelector(".dashboard-simulator");
  const rows = (selector) => [...content.querySelectorAll(selector)].map((element) => box(element).height);
  return { viewport: { width: innerWidth, height: innerHeight }, content: box(content), page: box(page),
    documentOverflow: document.documentElement.scrollWidth - innerWidth,
    contentOverflow: content.scrollWidth - content.clientWidth,
    simulator: box(simulator), gift: box(gift), giftFull: gift?.classList.contains("full") || false,
    giftShortcuts: Boolean(content.querySelector("[data-dashboard-gifts]")),
    devices: rows(".irl-device-row"), interactions: rows(".irl-interaction-row"), commands: rows(".chatbot-entry"),
    sounds: rows(".audio-alert-card"),
    soundControls: [...content.querySelectorAll(".audio-alert-card .automation-row-controls")].map((element) => ({
      buttons: element.querySelectorAll("button").length, menu: Boolean(element.querySelector("details,summary,.compact-context-menu")), height: box(element).height,
      buttonTops: [...element.querySelectorAll("button")].map((button) => Math.round(button.getBoundingClientRect().top))
    })),
    commandColumns: content.querySelectorAll(".chatbot-command-table thead th").length,
    tableScroll: [...content.querySelectorAll(".compact-resource-table-wrap,.automation-table-wrap")].map((element) => ({ width: element.clientWidth, scrollWidth: element.scrollWidth })),
    calls: globalThis.compactSmokeCalls };
}

async function capture(name, width, height) {
  testWindow.setContentSize(width, height);
  await delay(150);
  await testWindow.webContents.executeJavaScript("content.scrollTop = 0");
  const metrics = await testWindow.webContents.executeJavaScript(`(${inspectLayout.toString()})()`);
  fs.writeFileSync(path.join(temporaryDirectory, `${name}-${width}x${height}.json`), JSON.stringify(metrics, null, 2));
  assert.ok(metrics.documentOverflow <= 1, `${name} : débordement de la fenêtre`);
  assert.ok(metrics.contentOverflow <= 1, `${name} : débordement de la page hors du tableau`);
  if (name === "dashboard-gift") {
    assert.ok(metrics.gift && !metrics.giftFull);
    assert.ok(metrics.gift.width < metrics.simulator.width * 0.6, "Le cadeau ne doit pas occuper toute la largeur");
    assert.equal(metrics.giftShortcuts, true);
  }
  if (name === "dashboard-follow") {
    assert.equal(metrics.gift, null); assert.equal(metrics.giftShortcuts, false);
  }
  if (name === "irl") {
    assert.equal(metrics.devices.length, 5); assert.equal(metrics.interactions.length, 3);
    assert.ok(Math.max(...metrics.devices) < 150, "Chaque prise doit rester une ligne compacte");
  }
  if (name === "commands") {
    assert.equal(metrics.commands.length, 3); assert.equal(metrics.commandColumns, 6);
    assert.ok(Math.max(...metrics.commands) < 150, "Chaque commande doit rester une ligne compacte");
  }
  if (name === "sounds") {
    assert.equal(metrics.sounds.length, 3);
    for (const controls of metrics.soundControls) {
      assert.equal(controls.buttons, 4); assert.equal(controls.menu, false);
      assert.equal(new Set(controls.buttonTops).size, 1, "Les quatre outils audio doivent rester sur une ligne");
    }
  }
  for (const [group, entries] of Object.entries(metrics.calls)) assert.equal(entries.length, 0, `${name} : ${group} inattendu`);
  const screenshot = path.join(temporaryDirectory, `${name}-${width}x${height}.png`);
  fs.writeFileSync(screenshot, (await testWindow.webContents.capturePage()).toPNG());
  results.push({ name, screenshot, ...metrics });
  if (name === "irl") {
    await testWindow.webContents.executeJavaScript('content.querySelector(".irl-actions-panel").scrollIntoView({ block: "start" })');
    await delay(60);
    fs.writeFileSync(path.join(temporaryDirectory, `irl-interactions-${width}x${height}.png`), (await testWindow.webContents.capturePage()).toPNG());
  }
}

async function run() {
  const preload = path.join(temporaryDirectory, "fixture-preload.js");
  fs.writeFileSync(preload, `(${installFixture.toString()})(${JSON.stringify(fixtureSnapshot())});\n`);
  testWindow = new BrowserWindow({ width: 1440, height: 1000, show: false, backgroundColor: "#0b0d19",
    webPreferences: { preload, contextIsolation: false, nodeIntegration: false, sandbox: false,
      webSecurity: true, offscreen: true, backgroundThrottling: false, partition: "compact-layout-fixture" } });
  testWindow.webContents.setAudioMuted(true);
  testWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  testWindow.webContents.session.setPermissionCheckHandler(() => false);
  testWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const protocol = new URL(details.url).protocol;
    if (!["file:", "data:", "blob:", "about:"].includes(protocol)) {
      blockedRequests.push(details.url.replace(/\/[^/]*$/, "/[masqué]")); return callback({ cancel: true });
    }
    callback({});
  });
  testWindow.webContents.on("console-message", (details) => {
    if (details.level === "error") consoleErrors.push(details.message);
  });
  currentStage = "index réel";
  await testWindow.loadURL(pathToFileURL(path.join(rendererDirectory, "index.html")).toString());
  await waitUntil(() => testWindow.webContents.executeJavaScript('Boolean(document.querySelector(".creator-home-page"))'));
  for (const route of ["dashboard-gift", "dashboard-follow", "irl", "commands", "sounds"]) {
    currentStage = route;
    const page = route.startsWith("dashboard") ? "dashboard" : route === "sounds" ? "voice" : route;
    await testWindow.webContents.executeJavaScript(`currentPage = ${JSON.stringify(page)}; ${route.startsWith("dashboard") ? `simulatorType = ${JSON.stringify(route.split("-")[1])};` : route === "sounds" ? 'creatorVoiceTab = "sounds";' : ""} render();`);
    for (const [width, height] of [[1440, 1000], [1000, 800]]) await capture(route, width, height);
  }
  assert.deepEqual(blockedRequests, [], "Les fixtures ne demandent aucune ressource distante");
  assert.deepEqual(consoleErrors, [], "La console Chromium ne doit pas signaler d'erreur");
  fs.writeFileSync(path.join(temporaryDirectory, "results.json"), JSON.stringify({ results, consoleErrors, blockedRequests }, null, 2));
  process.stdout.write(JSON.stringify({ output: temporaryDirectory, results: results.map(({ name, viewport, page, simulator, devices, interactions, commands, sounds, screenshot }) => ({ name, viewport, page, simulator, devices, interactions, commands, sounds, screenshot })) }, null, 2) + "\n");
}

app.whenReady().then(run).then(() => { clearTimeout(deadline); testWindow?.destroy(); app.exit(0); }).catch((error) => {
  clearTimeout(deadline);
  fs.writeFileSync(path.join(temporaryDirectory, "failure.json"), JSON.stringify({ stage: currentStage, error: error.stack, consoleErrors, blockedRequests, results }, null, 2));
  process.stderr.write(`${error.stack}\nRésultats : ${temporaryDirectory}\n`);
  testWindow?.destroy(); app.exit(1);
});
