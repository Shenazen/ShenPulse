"use strict";

const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");
const { OverlayServer } = require("../src/main/overlay-server");

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function closeEnough(actual, expected, tolerance = 0.02) {
  return Math.abs(actual - expected) <= tolerance;
}

function outputDirectory() {
  const argument = process.argv.find((entry) =>
    entry.startsWith("--output=")
  );
  if (argument) {
    return path.resolve(argument.slice(argument.indexOf("=") + 1));
  }
  return path.join(app.getPath("temp"), "shenpulse-timer-configuration");
}

let overlayServer = null;
let previewWindow = null;

async function readTimerState(view) {
  const prefix = view === "timer" ? "timer" : "multiplier-timer";
  return previewWindow.webContents.executeJavaScript(`(() => {
    const title = document.getElementById("${prefix}-label");
    const value = document.getElementById("${prefix}-value");
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      text: value.textContent,
      titleRect: {
        height: title.getBoundingClientRect().height,
        width: title.getBoundingClientRect().width
      },
      valueRect: {
        height: value.getBoundingClientRect().height,
        width: value.getBoundingClientRect().width
      },
      variables: {
        titleScale: rootStyle.getPropertyValue("--timer-title-scale").trim(),
        valueScale: rootStyle.getPropertyValue("--timer-value-scale").trim()
      }
    };
  })()`);
}

async function configure(payload) {
  await previewWindow.webContents.executeJavaScript(`window.postMessage(
    {
      source: "shenpulse-overlay-card",
      channel: "configuration",
      payload: ${JSON.stringify(payload)}
    },
    location.origin
  )`);
  await delay(120);
}

async function verifyView(view, overlayPort, targetDirectory) {
  const title = view === "timer" ? "TEMPS RESTANT" : "BONUS ACTIF";
  const previewUrl =
    `http://127.0.0.1:${overlayPort}/overlay/` +
    `?view=${encodeURIComponent(view)}&theme=gta&preview=static` +
    `&title=${encodeURIComponent(title)}` +
    "&seconds=300&showHours=true&showHeader=true" +
    "&timerTitleScale=100&timerValueScale=100" +
    "&token=timer-smoke-token";
  await previewWindow.loadURL(previewUrl);
  await delay(220);

  const initial = await readTimerState(view);
  if (initial.text !== "00:05:00") {
    throw new Error(`${view} n’affiche pas les heures : ${initial.text}.`);
  }

  await configure({ showHours: "false" });
  const withoutHours = await readTimerState(view);
  if (withoutHours.text !== "05:00") {
    throw new Error(`${view} ne masque pas les heures : ${withoutHours.text}.`);
  }

  await configure({
    showHours: "true",
    timerTitleScale: "135",
    timerValueScale: "70"
  });
  const restored = await readTimerState(view);
  if (restored.text !== "00:05:00") {
    throw new Error(`${view} ne réaffiche pas les heures : ${restored.text}.`);
  }
  const titleScale = restored.titleRect.width / initial.titleRect.width;
  const valueScale = restored.valueRect.width / initial.valueRect.width;
  if (!closeEnough(titleScale, 1.35)) {
    throw new Error(`${view} : zoom du titre incorrect (${titleScale}).`);
  }
  if (!closeEnough(valueScale, 0.7)) {
    throw new Error(`${view} : zoom de la valeur incorrect (${valueScale}).`);
  }

  const image = await previewWindow.webContents.capturePage();
  const screenshot = path.join(targetDirectory, `${view}-hours-and-scales.png`);
  await fs.promises.writeFile(screenshot, image.toPNG());
  return {
    initial,
    restored,
    scales: { title: titleScale, value: valueScale },
    screenshot,
    withoutHours
  };
}

async function run() {
  const targetDirectory = outputDirectory();
  const overlayPort = await freePort();
  const apiPort = await freePort();
  const state = {
    settings: {
      overlayPort,
      apiPort,
      overlayToken: "timer-smoke-token",
      apiToken: "timer-smoke-api"
    },
    goals: [],
    session: { running: false },
    statistics: {},
    commerce: {
      subscription: {
        tier: "free",
        source: "free",
        status: "free"
      }
    }
  };
  overlayServer = new OverlayServer({
    store: { getState: () => structuredClone(state) },
    staticDirectory: path.join(__dirname, "..", "resources", "overlays"),
    onInboundEvent: async () => {},
    onEffectRequest: async () => ({ ok: true })
  });
  await overlayServer.start();
  await fs.promises.mkdir(targetDirectory, { recursive: true });

  const consoleErrors = [];
  previewWindow = new BrowserWindow({
    width: 900,
    height: 506,
    show: false,
    backgroundColor: "#02040a",
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      offscreen: true,
      sandbox: true,
      webSecurity: true
    }
  });
  previewWindow.webContents.on("console-message", (_event, level, message) => {
    if (level >= 2) consoleErrors.push(message);
  });

  const timer = await verifyView("timer", overlayPort, targetDirectory);
  const multiplierTimer = await verifyView(
    "multiplier-timer",
    overlayPort,
    targetDirectory
  );
  if (overlayServer.sseClients.size !== 0) {
    throw new Error("Les aperçus Timer ne doivent pas ouvrir de connexion LIVE.");
  }
  if (consoleErrors.length) {
    throw new Error(`Erreurs console : ${consoleErrors.join(" | ")}`);
  }

  const result = {
    consoleErrors,
    multiplierTimer,
    sseClients: overlayServer.sseClients.size,
    timer
  };
  await fs.promises.writeFile(
    path.join(targetDirectory, "result.json"),
    JSON.stringify(result, null, 2),
    "utf8"
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

app.whenReady()
  .then(run)
  .then(async () => {
    previewWindow?.destroy();
    await overlayServer?.stop();
    app.exit(0);
  })
  .catch(async (error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    previewWindow?.destroy();
    await overlayServer?.stop().catch(() => {});
    app.exit(1);
  });
