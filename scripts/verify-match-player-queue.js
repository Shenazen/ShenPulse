"use strict";

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

async function waitFor(window, callback, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await window.webContents.executeJavaScript(`(${callback.toString()})()`)) {
      return;
    }
    await delay(80);
  }
  throw new Error(`Condition non atteinte après ${timeoutMs} ms.`);
}

async function waitUntil(callback, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (callback()) return;
    await delay(80);
  }
  throw new Error(`Condition locale non atteinte après ${timeoutMs} ms.`);
}

let overlayServer = null;
let playerWindow = null;

async function run() {
  const overlayPort = await freePort();
  const apiPort = await freePort();
  const state = {
    settings: {
      overlayPort,
      apiPort,
      overlayToken: "match-player-smoke-token",
      apiToken: "match-player-smoke-api"
    },
    goals: [],
    session: { running: false },
    statistics: {},
    commerce: {
      subscription: { tier: "pro", source: "paid", status: "active" }
    }
  };
  overlayServer = new OverlayServer({
    store: { getState: () => structuredClone(state) },
    staticDirectory: path.join(__dirname, "..", "resources", "overlays"),
    onInboundEvent: async () => {},
    onEffectRequest: async () => ({ ok: true })
  });
  await overlayServer.start();

  const consoleErrors = [];
  playerWindow = new BrowserWindow({
    width: 540,
    height: 960,
    show: false,
    backgroundColor: "#00000000",
    transparent: true,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      offscreen: true,
      sandbox: true,
      webSecurity: true
    }
  });
  playerWindow.webContents.on("console-message", (_event, level, message) => {
    if (level >= 2) consoleErrors.push(message);
  });

  await playerWindow.loadURL(overlayServer.urls().matchPlayer);
  await waitFor(playerWindow, () => typeof matchPlaybackQueue?.enqueue === "function");
  await waitFor(playerWindow, () => document.querySelector("#match-video")?.paused === true);
  await waitUntil(() => overlayServer.sseClients.size === 1);

  overlayServer.playMatch({ match: "x2", variant: "tikcontrol" });
  await waitFor(playerWindow, () => {
    const video = document.querySelector("#match-video");
    return video?.currentSrc.includes("x2-tikcontrol.webm") && !video.paused;
  });
  await playerWindow.webContents.executeJavaScript(`(() => {
    const video = document.querySelector("#match-video");
    video.pause();
    video.currentTime = Math.min(0.1, Math.max(0, video.duration / 2));
  })()`);
  overlayServer.playMatch({ match: "x3", variant: "gladiador" });
  await waitFor(playerWindow, () =>
    matchPlaybackQueue.snapshot().pending.some((item) => item.match === "x3")
  );
  const queued = await playerWindow.webContents.executeJavaScript(`(() => ({
    source: document.querySelector("#match-video")?.currentSrc || "",
    queue: matchPlaybackQueue.snapshot().pending.map((item) => item.match)
  }))()`);
  if (!queued.source.includes("x2-tikcontrol.webm")) {
    throw new Error("La seconde demande a interrompu la première vidéo.");
  }
  if (queued.queue.join(",") !== "x3") {
    throw new Error(
      `La seconde animation n’est pas dans la file Match : ${JSON.stringify(queued)}`
    );
  }

  await playerWindow.webContents.executeJavaScript(`(() => {
    const video = document.querySelector("#match-video");
    video.currentTime = Math.max(0, video.duration - 0.12);
    return video.play();
  })()`);
  await waitFor(playerWindow, () => {
    const video = document.querySelector("#match-video");
    return video?.currentSrc.includes("x3-gladiador.webm") && !video.paused;
  });

  const result = await playerWindow.webContents.executeJavaScript(`(() => ({
    source: document.querySelector("#match-video")?.currentSrc || "",
    active: matchPlaybackQueue.snapshot().active,
    pending: matchPlaybackQueue.snapshot().pending.length
  }))()`);
  if (consoleErrors.length) {
    throw new Error(`Erreurs console : ${consoleErrors.join(" | ")}`);
  }
  process.stdout.write(`${JSON.stringify({ ok: true, queued, result }, null, 2)}\n`);
}

app.whenReady()
  .then(run)
  .then(async () => {
    playerWindow?.destroy();
    await overlayServer?.stop();
    app.exit(0);
  })
  .catch(async (error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    playerWindow?.destroy();
    await overlayServer?.stop().catch(() => {});
    app.exit(1);
  });
