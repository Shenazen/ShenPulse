"use strict";

const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");
const { OverlayServer } = require("../src/main/overlay-server");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

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

async function waitFor(window, callback, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await window.webContents.executeJavaScript(`(${callback.toString()})()`)) {
      return;
    }
    await delay(80);
  }
  throw new Error(`Condition non atteinte après ${timeoutMs} ms.`);
}

function outputDirectory() {
  const argument = process.argv.find((entry) =>
    entry.startsWith("--output=")
  );
  if (argument) {
    return path.resolve(argument.slice(argument.indexOf("=") + 1));
  }
  return path.join(app.getPath("temp"), "shenpulse-animated-match-preview");
}

let overlayServer = null;
let previewWindow = null;

async function run() {
  const targetDirectory = outputDirectory();
  const overlayPort = await freePort();
  const apiPort = await freePort();
  const state = {
    settings: {
      overlayPort,
      apiPort,
      overlayToken: "preview-smoke-token",
      apiToken: "preview-smoke-api"
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
    width: 540,
    height: 960,
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

  const previewUrl =
    `http://127.0.0.1:${overlayPort}/overlay/` +
    "?view=match&match=x2&variant=tikcontrol" +
    "&preview=animated&autoplay=true&loop=true" +
    "&token=preview-smoke-token";
  await previewWindow.loadURL(previewUrl);
  await waitFor(previewWindow, () => {
    const video = document.querySelector("#match-video");
    return Boolean(
      video &&
      video.readyState >= 2 &&
      !video.paused &&
      video.currentTime > 0.05
    );
  });

  const firstSample = await previewWindow.webContents.executeJavaScript(`(() => {
    const video = document.querySelector("#match-video");
    return {
      autoplay: video.autoplay,
      currentTime: video.currentTime,
      duration: video.duration,
      loop: video.loop,
      paused: video.paused,
      readyState: video.readyState
    };
  })()`);
  await delay(700);
  const secondSample = await previewWindow.webContents.executeJavaScript(`(() => {
    const video = document.querySelector("#match-video");
    return {
      currentTime: video.currentTime,
      paused: video.paused
    };
  })()`);
  if (
    secondSample.paused ||
    secondSample.currentTime <= firstSample.currentTime + 0.15
  ) {
    throw new Error("La vidéo Match ne progresse pas dans l’aperçu animé.");
  }
  if (!firstSample.autoplay || !firstSample.loop || firstSample.paused) {
    throw new Error("La lecture automatique en boucle n’est pas active.");
  }
  if (overlayServer.sseClients.size !== 0) {
    throw new Error("L’aperçu animé ne doit pas ouvrir de connexion LIVE.");
  }

  const image = await previewWindow.webContents.capturePage();
  const screenshot = path.join(targetDirectory, "match-x2-animated.png");
  await fs.promises.writeFile(screenshot, image.toPNG());
  const result = {
    consoleErrors,
    firstSample,
    secondSample,
    screenshot,
    sseClients: overlayServer.sseClients.size
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
