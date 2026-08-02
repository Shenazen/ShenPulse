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

function outputDirectory() {
  const argument = process.argv.find((entry) =>
    entry.startsWith("--output=")
  );
  if (argument) {
    return path.resolve(argument.slice(argument.indexOf("=") + 1));
  }
  return path.join(app.getPath("temp"), "shenpulse-like-goal-configuration");
}

function closeEnough(actual, expected, tolerance = 0.75) {
  return Math.abs(actual - expected) <= tolerance;
}

let overlayServer = null;
let previewWindow = null;

async function readState() {
  return previewWindow.webContents.executeJavaScript(`(() => {
    const title = document.getElementById("like-goal-title");
    const content = document.querySelector(".like-goal-content > small");
    const goalLabel = document.getElementById("like-goal-progress-label");
    const progressBar = document.querySelector(".like-goal-bar");
    const styles = getComputedStyle(document.documentElement);
    return {
      titleHidden: title.hidden,
      goalLabelHidden: goalLabel.hidden,
      progressBarHidden: progressBar.hidden,
      titleRect: {
        height: title.getBoundingClientRect().height,
        left: title.getBoundingClientRect().left,
        top: title.getBoundingClientRect().top,
        width: title.getBoundingClientRect().width
      },
      contentRect: {
        height: content.getBoundingClientRect().height,
        left: content.getBoundingClientRect().left,
        top: content.getBoundingClientRect().top,
        width: content.getBoundingClientRect().width
      },
      variables: {
        titleX: styles.getPropertyValue("--like-goal-title-x").trim(),
        titleY: styles.getPropertyValue("--like-goal-title-y").trim(),
        titleScale: styles.getPropertyValue("--like-goal-title-scale").trim(),
        contentX: styles.getPropertyValue("--like-goal-content-x").trim(),
        contentY: styles.getPropertyValue("--like-goal-content-y").trim(),
        contentScale: styles.getPropertyValue("--like-goal-content-scale").trim()
      },
      colors: {
        title: getComputedStyle(title).color,
        content: getComputedStyle(content).color,
        percent: getComputedStyle(
          document.getElementById("like-goal-percent")
        ).color
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

async function run() {
  const targetDirectory = outputDirectory();
  const overlayPort = await freePort();
  const apiPort = await freePort();
  const state = {
    settings: {
      overlayPort,
      apiPort,
      overlayToken: "like-goal-smoke-token",
      apiToken: "like-goal-smoke-api"
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
    width: 1300,
    height: 200,
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
    "?view=like-goal&theme=classic&preview=static" +
    "&title=LIKE%20GOAL&progressLabel=Objectif%20LIVE" +
    "&current=12500&target=50000&showHeader=true&showGoal=true" +
    "&token=like-goal-smoke-token";
  await previewWindow.loadURL(previewUrl);
  await delay(200);

  const initial = await readState();
  await configure({ showHeader: "false", showGoal: "false" });
  const hidden = await readState();
  if (!hidden.titleHidden || !hidden.goalLabelHidden) {
    throw new Error("Le titre ou le libellé d’objectif ne se masque pas.");
  }
  if (hidden.progressBarHidden) {
    throw new Error("Afficher l’objectif ne doit pas masquer la progression.");
  }

  await configure({
    showHeader: "true",
    showGoal: "true",
    titleX: "60",
    titleY: "-14",
    titleScale: "140",
    titleColor: "#ff0000",
    contentX: "-40",
    contentY: "18",
    contentScale: "70",
    contentColor: "#00ff00",
    percentColor: "#0000ff"
  });
  const restored = await readState();
  if (restored.titleHidden || restored.goalLabelHidden) {
    throw new Error("Le titre ou le libellé d’objectif ne réapparaît pas.");
  }
  if (restored.progressBarHidden) {
    throw new Error("La barre de progression a été masquée.");
  }
  const titleDelta = {
    x:
      restored.titleRect.left + restored.titleRect.width / 2 -
      (initial.titleRect.left + initial.titleRect.width / 2),
    y:
      restored.titleRect.top + restored.titleRect.height / 2 -
      (initial.titleRect.top + initial.titleRect.height / 2)
  };
  const contentDelta = {
    x:
      restored.contentRect.left + restored.contentRect.width / 2 -
      (initial.contentRect.left + initial.contentRect.width / 2),
    y:
      restored.contentRect.top + restored.contentRect.height / 2 -
      (initial.contentRect.top + initial.contentRect.height / 2)
  };
  if (!closeEnough(titleDelta.x, 60) || !closeEnough(titleDelta.y, -14)) {
    throw new Error(`Décalage du titre incorrect : ${JSON.stringify(titleDelta)}.`);
  }
  if (!closeEnough(contentDelta.x, -40) || !closeEnough(contentDelta.y, 18)) {
    throw new Error(`Décalage du texte central incorrect : ${JSON.stringify(contentDelta)}.`);
  }
  const titleScale = restored.titleRect.width / initial.titleRect.width;
  const contentScale = restored.contentRect.width / initial.contentRect.width;
  if (!closeEnough(titleScale, 1.4, 0.02)) {
    throw new Error(`Zoom du titre incorrect : ${titleScale}.`);
  }
  if (!closeEnough(contentScale, 0.7, 0.02)) {
    throw new Error(`Zoom du texte central incorrect : ${contentScale}.`);
  }
  if (
    restored.colors.title !== "rgb(255, 0, 0)" ||
    restored.colors.content !== "rgb(0, 255, 0)" ||
    restored.colors.percent !== "rgb(0, 0, 255)"
  ) {
    throw new Error(`Couleurs Like Goal incorrectes : ${JSON.stringify(restored.colors)}.`);
  }
  if (overlayServer.sseClients.size !== 0) {
    throw new Error("L’aperçu Like Goal ne doit pas ouvrir de connexion LIVE.");
  }
  if (consoleErrors.length) {
    throw new Error(`Erreurs console : ${consoleErrors.join(" | ")}`);
  }

  const image = await previewWindow.webContents.capturePage();
  const screenshot = path.join(targetDirectory, "like-goal-restored-offsets.png");
  await fs.promises.writeFile(screenshot, image.toPNG());
  const result = {
    consoleErrors,
    contentDelta,
    hidden,
    restored,
    screenshot,
    sseClients: overlayServer.sseClients.size,
    scales: { content: contentScale, title: titleScale },
    titleDelta
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
