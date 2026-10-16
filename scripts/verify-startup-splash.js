"use strict";

/**
 * Qualification Chromium du vrai splash, sans démarrer ShenPulse.
 * Fenêtres invisibles, profil temporaire, aucun compte/IPC/service/LIVE.
 * Les captures et le rapport sont conservés en TEMP pour revue visuelle.
 * Exécution : electron scripts/verify-startup-splash.js
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");

const output = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-startup-splash-"));
const source = path.resolve(__dirname, "../src/renderer/splash.html");
app.setPath("userData", path.join(output, "chromium"));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND");
app.on("window-all-closed", () => {});

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const captures = [], requests = [], blockedRequests = [], errors = [], windows = new Set();
let stage = "initialisation";
const deadline = setTimeout(() => finish(new Error(`Délai dépassé : ${stage}`)), 45000);

function inspect() {
  const rect = (element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  };
  const logo = document.querySelector("h1 img");
  const style = (selector) => {
    const value = getComputedStyle(document.querySelector(selector));
    return { opacity: value.opacity, transform: value.transform, dashOffset: value.strokeDashoffset, display: value.display };
  };
  return {
    viewport: { width: innerWidth, height: innerHeight }, reducedMotion: matchMedia("(prefers-reduced-motion:reduce)").matches,
    overflow: { horizontal: document.documentElement.scrollWidth - innerWidth, vertical: document.documentElement.scrollHeight - innerHeight },
    logo: { ...rect(logo), complete: logo.complete, naturalWidth: logo.naturalWidth, naturalHeight: logo.naturalHeight },
    copy: [...document.querySelectorAll(".startup-eyebrow,.startup-tagline,.startup-status,.startup-footer")].map((element) => ({
      name: element.className, ...rect(element), opacity: getComputedStyle(element).opacity
    })),
    layers: { logo: style("h1"), cyan: style(".startup-orbit-cyan"), red: style(".startup-orbit-red"), signal: style(".startup-pulse-signal") },
    forbiddenElements: document.querySelectorAll("iframe,audio,video,script").length,
    animations: document.getAnimations().map((animation) => {
      const timing = animation.effect.getTiming();
      return { name: animation.animationName, playState: animation.playState, currentTime: animation.currentTime,
        duration: timing.duration, delay: timing.delay, iterations: timing.iterations };
    })
  };
}

async function create(width, height, reducedMotion = false) {
  const window = new BrowserWindow({ width, height, useContentSize: true, show: false, frame: false, resizable: false,
    backgroundColor: "#070913", webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true,
      offscreen: true, backgroundThrottling: false, partition: `startup-splash-${width}-${height}-${reducedMotion}` } });
  windows.add(window);
  window.once("closed", () => windows.delete(window));
  window.webContents.setAudioMuted(true);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const session = window.webContents.session;
  session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  session.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    if (url.protocol !== "file:") { blockedRequests.push({ protocol: url.protocol, hostname: url.hostname }); return callback({ cancel: true }); }
    requests.push({ type: details.resourceType, file: path.basename(url.pathname) }); callback({});
  });
  window.webContents.on("console-message", (details) => { if (details.level === "error") errors.push(details.message); });
  window.webContents.on("render-process-gone", (_event, details) => errors.push(`Renderer arrêté : ${details.reason}`));
  await window.loadURL(pathToFileURL(source).toString());
  if (reducedMotion) {
    window.webContents.debugger.attach("1.3");
    await window.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }]
    });
  }
  return { window, started: performance.now() };
}

async function capture(fixture, name, seconds) {
  stage = name;
  await delay(Math.max(0, seconds * 1000 - (performance.now() - fixture.started)));
  const metrics = await fixture.window.webContents.executeJavaScript(`(${inspect.toString()})()`);
  assert.equal(metrics.forbiddenElements, 0, "Le splash ne doit pas embarquer de script, média ou iframe");
  assert.equal(metrics.logo.complete, true);
  assert.equal(metrics.logo.naturalWidth, 1583); assert.equal(metrics.logo.naturalHeight, 320);
  assert.ok(Math.abs(metrics.logo.width / metrics.logo.height - 1583 / 320) < 0.01, "Le logo reste à ses bonnes proportions");
  assert.ok(metrics.logo.width <= metrics.viewport.width * 0.95 && metrics.logo.height < metrics.viewport.height / 2);
  assert.equal(metrics.overflow.horizontal, 0); assert.equal(metrics.overflow.vertical, 0);
  for (const copy of metrics.copy) {
    assert.ok(copy.x >= -1 && copy.y >= -1 && copy.x + copy.width <= metrics.viewport.width + 1 && copy.y + copy.height <= metrics.viewport.height + 1,
      `${copy.name} ne doit pas sortir de la fenêtre`);
  }
  assert.ok(metrics.animations.every((animation) => Number.isFinite(animation.iterations)), "Aucune animation infinie");
  const bitmap = await fixture.window.webContents.capturePage();
  const screenshot = path.join(output, `${name}.png`);
  fs.writeFileSync(screenshot, bitmap.toPNG());
  const hash = createHash("sha256").update(bitmap.toBitmap()).digest("hex");
  const result = { name, seconds: (performance.now() - fixture.started) / 1000, screenshot, hash, ...metrics };
  captures.push(result);
  process.stdout.write(`${name} : ${screenshot}\n`);
  return result;
}

async function run() {
  const normal = await create(760, 480);
  const sequence = [];
  for (const seconds of [0.8, 2, 3.5, 4.8]) sequence.push(await capture(normal, `normal-760x480-${String(seconds).replace(".", "_")}s`, seconds));
  assert.equal(new Set(sequence.map((entry) => entry.hash)).size, sequence.length, "Les phases de l'intro évoluent réellement");
  const settled = await capture(normal, "normal-760x480-termine-5_3s", 5.3);
  const stable = await capture(normal, "normal-760x480-stable-5_6s", 5.6);
  assert.ok(settled.animations.every((entry) => entry.playState === "finished"), "Toutes les animations se terminent");
  assert.equal(stable.hash, settled.hash, "L'intro terminée ne continue pas à repeindre une boucle");
  normal.window.destroy();

  const small = await create(560, 360);
  await capture(small, "petit-560x360-3_5s", 3.5);
  small.window.destroy();

  const reduced = await create(760, 480, true);
  const still = await capture(reduced, "reduced-motion-760x480-0_8s", 0.8);
  const stillLater = await capture(reduced, "reduced-motion-760x480-1_2s", 1.2);
  assert.equal(still.reducedMotion, true); assert.equal(still.animations.length, 0);
  assert.equal(still.hash, stillLater.hash, "Le mode sans animation est immédiatement stable");
  assert.equal(still.layers.logo.opacity, "1"); assert.equal(still.layers.signal.display, "none");
  reduced.window.destroy();
  assert.equal(windows.size, 0); assert.equal(BrowserWindow.getAllWindows().length, 0);
  assert.deepEqual(blockedRequests, []); assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify({ source, captures, requests, blockedRequests, errors, cleanup: { windows: 0, rendererScripts: 0 } }, null, 2));
  process.stdout.write(`PASS — rapport : ${output}\n`);
}

function finish(error = null) {
  clearTimeout(deadline);
  for (const window of windows) if (!window.isDestroyed()) window.destroy();
  if (error) {
    fs.writeFileSync(path.join(output, "failure.json"), JSON.stringify({ stage, error: error.stack, captures, requests, blockedRequests, errors }, null, 2));
    process.stderr.write(`${error.stack}\nRapport : ${output}\n`);
  }
  app.exit(error ? 1 : 0);
}

app.whenReady().then(run).then(() => finish(), finish);
