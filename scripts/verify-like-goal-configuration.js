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
    const rect = (element) => {
      const { left, top, width, height } = element.getBoundingClientRect();
      return { left, top, width, height };
    };
    const title = document.getElementById("like-goal-title");
    const content = document.querySelector(".like-goal-content > small");
    const label = document.getElementById("like-goal-progress-label");
    const percent = document.getElementById("like-goal-percent");
    return {
      theme: document.documentElement.dataset.theme,
      title: rect(title), titleText: rect(title.firstElementChild),
      content: rect(content), contentText: rect(content.firstElementChild),
      bar: rect(document.querySelector(".like-goal-bar")),
      hidden: {
        title: getComputedStyle(title).display === "none",
        label: getComputedStyle(label).display === "none",
        percent: getComputedStyle(percent).display === "none"
      },
      label: label.textContent,
      colors: {
        title: getComputedStyle(title).color,
        content: getComputedStyle(content).color,
        percent: getComputedStyle(percent).color
      }
    };
  })()`);
}

function assertCentered(inner, outer, label) {
  for (const [position, dimension] of [["left", "width"], ["top", "height"]]) {
    if (!closeEnough(inner[position] + inner[dimension] / 2, outer[position] + outer[dimension] / 2)) {
      throw new Error(`${label}: text is not centered on ${position}.`);
    }
    if (inner[dimension] > outer[dimension] + 0.75) {
      throw new Error(`${label}: text overflows ${dimension}.`);
    }
  }
}

function assertLayout(state) {
  if (!state.hidden.title) assertCentered(state.titleText, state.title, `${state.theme} title`);
  assertCentered(state.contentText, state.bar, `${state.theme} progress`);
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

async function waitForReady() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = await previewWindow.webContents.executeJavaScript(`
      !document.documentElement.classList.contains("overlay-booting") &&
      Number(getComputedStyle(document.getElementById("overlay-root")).opacity) === 1
    `);
    if (ready) return;
    await delay(100);
  }
  throw new Error("The overlay did not become visible.");
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
  const knownWarnings = new Set();
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
  previewWindow.webContents.on("console-message", ({ level, message }) => {
    // Le bootstrap de base-path existant est inline ; le serveur local le bloque.
    // /overlay/ résout déjà les chemins relatifs sans ce bootstrap.
    if (message.includes("sha256-Wq/Lyhstace2rd3EMS9KZiT7uGqm+5oANVw72r4CRKY=")) {
      knownWarnings.add(message);
    } else if (["warning", "error"].includes(level)) consoleErrors.push(message);
  });

  const previewUrl =
    `http://127.0.0.1:${overlayPort}/overlay/` +
    "?view=like-goal&theme=gta&preview=static" +
    "&title=LIKE%20GOAL&progressLabel=Objectif%20LIVE" +
    "&current=12500&target=50000&showHeader=true&showGoal=true" +
    "&token=like-goal-smoke-token";
  await previewWindow.loadURL(previewUrl);
  await waitForReady();

  const themes = require("../resources/overlays/catalog/like-goal").definition.options;
  const results = [];
  for (const [theme] of themes) {
    await waitForReady();
    await configure({
      theme, title: "LIKE GOAL", titleScale: "100", contentScale: "100",
      current: "12500", target: "50000", whenReached: "keep", progressLabel: "likes",
      showHeader: "true", showGoal: "true", showPercent: "true",
      titleColor: "#ffffff", contentColor: "#ffffff", percentColor: "#ff4f86",
      titleX: "450", titleY: "-200", contentX: "-400", contentY: "250"
    });
    await previewWindow.webContents.executeJavaScript(`Promise.all([
      document.fonts.ready,
      ...Array.from(document.querySelectorAll("#like-goal-view img"), (image) => image.decode().catch(() => {}))
    ])`);
    const initial = await readState();
    assertLayout(initial);
    const screenshot = path.join(targetDirectory, `like-goal-${theme}.png`);
    await fs.promises.writeFile(screenshot, (await previewWindow.webContents.capturePage()).toPNG());
    await configure({ showHeader: "false", showGoal: "false", showPercent: "false" });
    const hidden = await readState();
    if (!hidden.hidden.title || !hidden.hidden.label || !hidden.hidden.percent || !hidden.bar.height) {
      throw new Error(`${theme}: visibility settings did not apply.`);
    }
    assertLayout(hidden);
    await configure({
      title: "UN TRES LONG TITRE PERSONNALISE POUR NOTRE OBJECTIF DE LIKES DU LIVE",
      progressLabel: "Un long texte de progression personnalise pour ce LIVE",
      current: "123456789", target: "987654321",
      titleScale: "400", contentScale: "400", font: "Georgia", rtl: "true",
      showHeader: "true", showGoal: "true", showPercent: "true",
      titleColor: "#ff0000", contentColor: "#00ff00", percentColor: "#0000ff"
    });
    const restored = await readState();
    assertLayout(restored);
    if (Object.values(restored.hidden).some(Boolean)) throw new Error(`${theme}: elements did not reappear.`);
    if (restored.colors.title !== "rgb(255, 0, 0)" || restored.colors.content !== "rgb(0, 255, 0)" || restored.colors.percent !== "rgb(0, 0, 255)") {
      throw new Error(`${theme}: text colors did not apply.`);
    }
    await configure({ progressLabel: "", showPercent: "false", rtl: "false", font: "Inter" });
    const noLabel = await readState();
    assertLayout(noLabel);
    if (!noLabel.hidden.label || noLabel.label !== "") throw new Error(`${theme}: empty label did not apply.`);
    for (const [width, height] of [[650, 100], [390, 60], [780, 400]]) {
      previewWindow.setContentSize(width, height);
      await delay(60);
      assertLayout(await readState());
    }
    previewWindow.setContentSize(1300, 200);
    await delay(60);
    // Re-opening an old URL must ignore its manual offsets as well.
    await previewWindow.loadURL(previewUrl.replace("theme=gta", `theme=${theme}`).replace("progressLabel=Objectif%20LIVE", "progressLabel=") + "&titleX=450&titleY=-200&contentX=-400&contentY=250");
    await delay(100);
    const reloaded = await readState();
    assertLayout(reloaded);
    if (reloaded.label !== "") throw new Error(`${theme}: empty label was lost after reload.`);
    results.push({ theme, initial, restored, screenshot });
    process.stdout.write(`OK ${theme}: centering, visibility, colors, fitting, resize and old URLs\n`);
  }
  if (overlayServer.sseClients.size !== 0) throw new Error("Static previews opened a LIVE connection.");
  if (consoleErrors.length) throw new Error(`Console errors: ${consoleErrors.join(" | ")}`);
  await fs.promises.writeFile(path.join(targetDirectory, "result.json"), JSON.stringify({ results, consoleErrors, knownWarnings: [...knownWarnings] }, null, 2), "utf8");
  process.stdout.write(`Verified ${results.length} designs. Screenshots: ${targetDirectory}\n`);

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
