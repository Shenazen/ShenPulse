"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  safeStorage,
  session,
  shell,
  screen
} = require("electron");
const { ShenPulseCore } = require("./core");
const { BackblazeMediaService } = require("./backblaze-media");
const { AccountService } = require("./account-service");
const { AdminService } = require("./admin-service");
const { GameRuntimeService } = require("./game-runtime");
const { runOriginalGamesSmoke } = require("./original-games-smoke");
const {
  orderInteractionAuditEffects
} = require("./interaction-audit-plan");
const { registerIpc } = require("./ipc");
const { StateStore } = require("./store");
const {
  shouldSuppressRendererChannel,
  snapshotForRenderer
} = require("./account-access");

let mainWindow = null;
let core = null;
let gameRuntime = null;
let store = null;
let accountService = null;
let ipcController = null;
let activeInteractionAudit = null;
let quitting = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

app.setName("ShenPulse");
app.setAppUserModelId("ShenPulse.ShenPulse");

function createWindow() {
  const iconPath = path.join(__dirname, "..", "..", "build", "shenpulse.ico");
  const icon = nativeImage.createFromPath(iconPath);
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const initialWidth = Math.min(
    1440,
    Math.max(1, Number(workArea.width) || 1440)
  );
  const initialHeight = Math.min(
    900,
    Math.max(1, Number(workArea.height) || 900)
  );
  mainWindow = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    minWidth: Math.min(1080, initialWidth),
    minHeight: Math.min(700, initialHeight),
    backgroundColor: "#090B14",
    show: false,
    frame: false,
    titleBarStyle: "hidden",
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      // Les connecteurs tournent dans le processus principal, tandis que le
      // rendu reçoit le TTS, l'audio et les états en direct. Une minimisation
      // ne doit ralentir aucun de ces échanges.
      backgroundThrottling: false,
      devTools: !app.isPackaged
    }
  });

  let windowShown = false;
  const showWindow = () => {
    if (windowShown || !mainWindow || mainWindow.isDestroyed()) return;
    windowShown = true;
    mainWindow.show();
    mainWindow.focus();
  };
  mainWindow.once("ready-to-show", showWindow);
  mainWindow.webContents.once("did-finish-load", showWindow);
  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) require("electron").shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function notifyRenderer(channel, value) {
  if (
    accountService &&
    shouldSuppressRendererChannel(channel, store)
  ) {
    return;
  }
  const rendererValue =
    channel === "state-changed" && accountService
      ? snapshotForRenderer(value, store)
      : value;
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed() || window.webContents.isDestroyed()) continue;
    window.webContents.send(channel, rendererValue);
  }
}

async function bootstrap() {
  Menu.setApplicationMenu(null);
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; img-src 'self' data: https: http://127.0.0.1:*; " +
            "media-src 'self' data: blob: https: http://127.0.0.1:*; " +
            "frame-src http://127.0.0.1:*; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' data: https://fonts.gstatic.com; " +
            "script-src 'self'; connect-src 'self' https: http://127.0.0.1:*"
        ]
      }
    });
  });
  if (
    process.argv.includes("--original-games-smoke") ||
    app.commandLine.hasSwitch("original-games-smoke")
  ) {
    const outputArgument = process.argv.find((argument) =>
      argument.startsWith("--original-games-smoke-output=")
    );
    const outputDirectory = outputArgument
      ? path.resolve(outputArgument.slice(outputArgument.indexOf("=") + 1))
      : path.join(app.getPath("temp"), "shenpulse-original-games");
    await runOriginalGamesSmoke({
      BrowserWindow,
      outputDirectory
    });
    quitting = true;
    app.exit(0);
    return;
  }
  store = new StateStore(app.getPath("userData"), safeStorage);
  store.load();
  const backblazeMedia = new BackblazeMediaService({
    store,
    environmentPaths: [
      process.env.SHENAZEN_OVERLAY_ENV,
      path.resolve(app.getAppPath(), "..", "ShenazenOverlay", ".env")
    ].filter(Boolean)
  });
  backblazeMedia.importEnvironmentConfiguration();
  accountService = new AccountService({
    store,
    openExternal: (url) => shell.openExternal(url)
  });
  const adminService = new AdminService({ store, accountService });
  createWindow();
  core = new ShenPulseCore({
    store,
    resourcesDirectory: path.join(__dirname, "..", "..", "resources"),
    notifyRenderer,
    appVersion: app.getVersion()
  });
  gameRuntime = new GameRuntimeService({
    app,
    store,
    getWindow: () => mainWindow,
    notifyRenderer,
    assertAccess: (gameId) => core.gameHub.assertAccess(gameId),
    onMinecraftWinCounter: (event) =>
      core.handleMinecraftWinCounter(event)
  });
  core.gameHub.setMinecraftRuntime(gameRuntime);
  ipcController = registerIpc({
    core,
    store,
    backblazeMedia,
    accountService,
    adminService,
    gameRuntime,
    getWindow: () => mainWindow
  });
  await core.initialize();
  setTimeout(() => {
    startInteractionAuditFromArgs(process.argv).catch(() => {});
  }, 500);
  if (
    process.env.SHENPULSE_SMOKE_TEST === "1" ||
    process.argv.includes("--smoke-test") ||
    app.commandLine.hasSwitch("smoke-test") ||
    app.commandLine.hasSwitch("shenpulse-smoke-test") ||
    fs.existsSync(path.join(__dirname, "..", "..", "release", "smoke.request"))
  ) {
    await runSmokeTest();
  }
}

async function runSmokeTest() {
  if (mainWindow.webContents.isLoadingMainFrame()) {
    await new Promise((resolve) =>
      mainWindow.webContents.once("did-finish-load", resolve)
    );
  }
  await new Promise((resolve) => setTimeout(resolve, 800));
  await core.testEvent("gift");
  await new Promise((resolve) => setTimeout(resolve, 500));
  const image = await mainWindow.capturePage();
  const target = path.join(app.getPath("temp"), "shenpulse-smoke.png");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, image.toPNG());
  await Promise.all([core.shutdown(), gameRuntime?.dispose()]);
  quitting = true;
  app.exit(0);
}

app.on("second-instance", (_event, commandLine) => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  setTimeout(() => {
    startInteractionAuditFromArgs(commandLine).catch(() => {});
  }, 250);
});

app.whenReady().then(bootstrap).catch((error) => {
  console.error(error);
  const outputArgument = process.argv.find((argument) =>
    argument.startsWith("--original-games-smoke-output=")
  );
  if (outputArgument) {
    try {
      const outputDirectory = path.resolve(
        outputArgument.slice(outputArgument.indexOf("=") + 1)
      );
      fs.mkdirSync(outputDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(outputDirectory, "failure.txt"),
        error?.stack || String(error),
        "utf8"
      );
    } catch {
      // Le code de sortie non nul reste la source de vérité.
    }
  }
  app.exit(1);
});

app.on("before-quit", (event) => {
  if (quitting || !core) return;
  event.preventDefault();
  quitting = true;
  Promise.all([
    core.shutdown(),
    gameRuntime?.dispose() || Promise.resolve()
  ])
    .catch(() => {})
    .finally(() => app.quit());
});

app.on("window-all-closed", () => {
  if (
    process.argv.includes("--original-games-smoke") ||
    app.commandLine.hasSwitch("original-games-smoke")
  ) {
    return;
  }
  app.quit();
});

async function startInteractionAuditFromArgs(args = []) {
  const gameArgument = args.find((entry) =>
    String(entry).startsWith("--audit-game=")
  );
  if (!gameArgument || !core || !ipcController) return null;
  const gameId = String(gameArgument)
    .slice("--audit-game=".length)
    .trim();
  if (!/^[a-z0-9-]{1,160}$/.test(gameId)) return null;
  const startArgument = args.find((entry) =>
    String(entry).startsWith("--audit-start=")
  );
  const startIndex = Math.max(
    0,
    Number.parseInt(
      String(startArgument || "").slice("--audit-start=".length),
      10
    ) || 0
  );
  const failedOnly = args.some(
    (entry) => String(entry) === "--audit-failed-only"
  );
  return runInteractionAudit(gameId, startIndex, { failedOnly });
}

async function runInteractionAudit(
  gameId,
  startIndex = 0,
  { failedOnly = false } = {}
) {
  if (activeInteractionAudit) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
    return activeInteractionAudit;
  }
  activeInteractionAudit = (async () => {
    const pack = core.gameHub
      .listPacks()
      .find((entry) => entry.id === gameId);
    if (!pack) throw new Error(`Jeu introuvable : ${gameId}`);
    const allEffects = orderInteractionAuditEffects(
      gameId,
      pack.effects.filter((effect) => effect.available !== false)
    );
    const previousStatus = readInteractionAuditStatus();
    let failures = rememberedInteractionAuditFailures(
      previousStatus,
      gameId
    );
    const failedIds = new Set(
      failures.map((failure) => failure.effectId)
    );
    const effects = allEffects
      .map((step, originalIndex) => ({ ...step, originalIndex }))
      .filter(({ effect, originalIndex }) =>
        failedOnly
          ? failedIds.has(effect.id)
          : originalIndex >= startIndex
      );
    if (!effects.length) {
      throw new Error(
        failedOnly
          ? "Aucune interaction refusée n’est en attente de nouveau test."
          : "Aucune interaction n’est disponible pour cette campagne."
      );
    }
    await core.gameHub.prepareConnection(gameId);
    await core.startGameSession(gameId);
    const runtimeStatus = gameRuntime.status(gameId);
    if (runtimeStatus.automated && !runtimeStatus.serverRunning) {
      await gameRuntime.launch(gameId);
    }
    await waitForInteractionAuditConnection(gameId);
    for (let index = 0; index < effects.length; index += 1) {
      const { effect, preparation, originalIndex } = effects[index];
      const current = failedOnly ? index + 1 : originalIndex + 1;
      const total = failedOnly ? effects.length : allEffects.length;
      writeInteractionAuditStatus({
        status: "waiting",
        phase: failedOnly ? "retest" : "initial",
        gameId,
        gameName: pack.name,
        current,
        total,
        effectId: effect.id,
        effectName: effect.name,
        expectation: effect.description || "",
        preparation,
        failures,
        updatedAt: new Date().toISOString()
      });
      let result;
      try {
        result = await ipcController.auditGameInteraction(
          gameId,
          effect.id,
          {
            current,
            total,
            expectation: effect.description || "",
            preparation,
            observationDelayMs: interactionAuditDelay(effect)
          }
        );
      } catch (error) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
        const executionError = String(error?.message || error);
        const decision = await require("electron").dialog.showMessageBox(
          mainWindow,
          {
            type: "error",
            title: `Interaction en échec — ${current}/${total}`,
            message: `${effect.name} n’a pas pu être exécutée.`,
            detail: [
              "Erreur renvoyée par le jeu :",
              executionError,
              "",
              "L’échec est mémorisé. Continuez pour tester automatiquement l’interaction suivante."
            ].join("\n"),
            buttons: [
              "Mémoriser et continuer",
              "Arrêter la campagne"
            ],
            defaultId: 0,
            cancelId: 1,
            noLink: true
          }
        );
        result = {
          answer: decision.response === 0 ? "no" : "cancel",
          packId: gameId,
          packName: pack.name,
          effectId: effect.id,
          effectName: effect.name,
          description: effect.description || "",
          expectation: effect.description || "",
          executionError,
          current,
          total
        };
      }
      if (result.answer === "no") {
        failures = [
          ...failures.filter(
            (failure) => failure.effectId !== result.effectId
          ),
          {
            effectId: result.effectId,
            effectName: result.effectName,
            description: result.description,
            expectation: result.expectation,
            originalIndex,
            firstRejectedAt:
              failures.find(
                (failure) => failure.effectId === result.effectId
              )?.firstRejectedAt || new Date().toISOString(),
            lastRejectedAt: new Date().toISOString()
          }
        ].sort((left, right) => left.originalIndex - right.originalIndex);
      } else if (result.answer === "yes" && failedOnly) {
        failures = failures.filter(
          (failure) => failure.effectId !== result.effectId
        );
      }
      writeInteractionAuditStatus({
        status:
          result.answer === "yes"
            ? "validated"
            : result.answer === "no"
              ? "failed"
              : "canceled",
        phase: failedOnly ? "retest" : "initial",
        ...result,
        failures,
        nextIndex: originalIndex + 1,
        updatedAt: new Date().toISOString()
      });
      if (result.answer === "cancel") return result;
    }
    const completed = {
      status: failures.length ? "repair-needed" : "completed",
      phase: failedOnly ? "retest" : "initial",
      answer: failures.length ? "failures-recorded" : "complete",
      gameId,
      gameName: pack.name,
      current: failedOnly ? effects.length : allEffects.length,
      total: failedOnly ? effects.length : allEffects.length,
      failures,
      updatedAt: new Date().toISOString()
    };
    writeInteractionAuditStatus(completed);
    await require("electron").dialog.showMessageBox(mainWindow, {
      type: failures.length ? "warning" : "info",
      title: "Campagne terminée",
      message: failures.length
        ? `${failures.length} interaction(s) à réparer`
        : `${completed.total}/${completed.total} interactions validées`,
      detail: failures.length
        ? `Les refus ont été mémorisés. ShenPulse peut maintenant les réparer puis ne rejouer que ces ${failures.length} test(s).`
        : `Toutes les interactions de ${pack.name} ont été confirmées.`,
      buttons: ["Fermer"],
      defaultId: 0,
      noLink: true
    });
    return completed;
  })();
  try {
    return await activeInteractionAudit;
  } catch (error) {
    writeInteractionAuditStatus({
      status: "error",
      gameId,
      error: String(error?.message || error),
      updatedAt: new Date().toISOString()
    });
    await require("electron").dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Campagne de test interrompue",
      message: "Impossible de lancer l’interaction.",
      detail: String(error?.message || error),
      buttons: ["Fermer"],
      defaultId: 0,
      noLink: true
    });
    throw error;
  } finally {
    activeInteractionAudit = null;
  }
}

async function waitForInteractionAuditConnection(
  gameId,
  timeoutMs = 10 * 60 * 1000
) {
  const deadline = Date.now() + Math.max(10_000, Number(timeoutMs || 0));
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      return await core.gameHub.testConnection(gameId);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw (
    lastError ||
    new Error(
      "Le jeu ne sâ€™est pas connectÃ© Ã  ShenPulse dans le dÃ©lai prÃ©vu."
    )
  );
}

function interactionAuditDelay(effect) {
  if (
    [
      "bedrock-blackhole",
      "bedrock-comets",
      "bedrock-longhands",
      "bedrock-glass-prison"
    ].includes(effect.id)
  ) {
    return 12_000;
  }
  if (
    [
      "bedrock-tnt-step",
      "bedrock-tnt-rocket",
      "bedrock-meteor",
      "bedrock-tnt-ring"
    ].includes(effect.id)
  ) {
    return 6_000;
  }
  return 3_500;
}

function writeInteractionAuditStatus(value) {
  try {
    fs.writeFileSync(
      path.join(app.getPath("userData"), "interaction-audit-status.json"),
      JSON.stringify(value, null, 2),
      "utf8"
    );
  } catch {
    // La campagne reste utilisable même si son état de reprise ne peut pas être écrit.
  }
}

function readInteractionAuditStatus() {
  try {
    return JSON.parse(
      fs.readFileSync(
        path.join(app.getPath("userData"), "interaction-audit-status.json"),
        "utf8"
      )
    );
  } catch {
    return {};
  }
}

function rememberedInteractionAuditFailures(status, gameId) {
  if (!status || (status.gameId || status.packId) !== gameId) return [];
  const failures = Array.isArray(status.failures)
    ? status.failures.filter((failure) => failure?.effectId)
    : [];
  if (status.answer !== "no" || !status.effectId) return failures;
  if (failures.some((failure) => failure.effectId === status.effectId)) {
    return failures;
  }
  return [
    ...failures,
    {
      effectId: status.effectId,
      effectName: status.effectName || status.effectId,
      description: status.description || "",
      expectation: status.expectation || "",
      originalIndex: Math.max(0, Number(status.current || 1) - 1),
      firstRejectedAt: status.updatedAt || new Date().toISOString(),
      lastRejectedAt: status.updatedAt || new Date().toISOString()
    }
  ];
}
