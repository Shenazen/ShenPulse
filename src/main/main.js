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
  screen,
  dialog
} = require("electron");
const { ShenPulseCore } = require("./core");
const { appPermissionAllowed } = require("./app-permissions");
const { BackblazeMediaService } = require("./backblaze-media");
const { AccountService } = require("./account-service");
const { AdminService } = require("./admin-service");
const { GameRuntimeService } = require("./game-runtime");
const { runOriginalGamesSmoke } = require("./original-games-smoke");
const { createInteractionAuditRunner } = require("./bootstrap/interaction-audit");
const { registerIpc } = require("./ipc");
const { StateStore } = require("./store");
const { StoreUpdateService } = require("./store-update-service");
const {
  shouldSuppressRendererChannel,
  hasAuthenticatedAccount,
  snapshotForRenderer
} = require("./account-access");

let mainWindow = null;
let core = null;
let gameRuntime = null;
let store = null;
let accountService = null;
let storeUpdateService = null;
let ipcController = null;
let quitting = false;
const interactionAudit = createInteractionAuditRunner({
  getCore: () => core,
  getGameRuntime: () => gameRuntime,
  getIpcController: () => ipcController,
  getWindow: () => mainWindow,
  getUserDataDirectory: () => app.getPath("userData"),
  dialog
});
const startInteractionAuditFromArgs = (args) => interactionAudit.startInteractionAuditFromArgs(args);

function getApplicationVersion() {
  return String(app.getVersion()).trim();
}

const originalGamesSmokeRequested =
  process.argv.includes("--original-games-smoke") ||
  app.commandLine.hasSwitch("original-games-smoke");
const smokeUserDataArgument = process.argv.find((argument) =>
  String(argument).startsWith("--shenpulse-smoke-user-data-dir=")
);
app.setName("ShenPulse");
app.setAppUserModelId("ShenPulse.ShenPulse");
if (smokeUserDataArgument) {
  app.setPath(
    "userData",
    path.resolve(
      smokeUserDataArgument.slice(smokeUserDataArgument.indexOf("=") + 1)
    )
  );
} else if (originalGamesSmokeRequested) {
  app.setPath(
    "userData",
    path.join(app.getPath("temp"), `shenpulse-original-games-smoke-${process.pid}`)
  );
}
const gotLock = originalGamesSmokeRequested || app.requestSingleInstanceLock();
if (!gotLock) app.quit();

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
  const notifyVisibility = () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
    mainWindow.webContents.send("renderer-visibility", {
      visible: mainWindow.isVisible() && !mainWindow.isMinimized()
    });
  };
  for (const eventName of ["hide", "minimize", "show", "restore"]) mainWindow.on(eventName, notifyVisibility);
  mainWindow.webContents.on("did-finish-load", notifyVisibility);
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
  const permissionAllowed = (webContents, permission, details = {}) => appPermissionAllowed({
    permission,
    requestingUrl: details.requestingUrl || "",
    contentsUrl: webContents?.getURL() || "",
    isMainFrame: details.isMainFrame === true,
    authenticated: hasAuthenticatedAccount(store),
    rendererDirectory: path.join(__dirname, "..", "renderer"),
    overlayPort: store?.getState().settings.overlayPort
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission, _origin, details) => permissionAllowed(contents, permission, details));
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(permissionAllowed(contents, permission, details)));
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
    const gameArgument = process.argv.find((argument) =>
      argument.startsWith("--original-games-smoke-game=")
    );
    await runOriginalGamesSmoke({
      BrowserWindow,
      outputDirectory,
      gameId: gameArgument
        ? gameArgument.slice(gameArgument.indexOf("=") + 1)
        : ""
    });
    quitting = true;
    app.exit(0);
    return;
  }
  store = new StateStore(app.getPath("userData"), safeStorage);
  store.load();
  accountService = new AccountService({
    store,
    openExternal: (url) => shell.openExternal(url)
  });
  const backblazeMedia = new BackblazeMediaService({
    store,
    createUpload: (incoming) => accountService.prepareMediaUpload(incoming)
  });
  storeUpdateService = new StoreUpdateService({ app, shell });
  const adminService = new AdminService({ store, accountService });
  const resourcesDirectory = path.join(__dirname, "..", "..", "resources");
  createWindow();
  core = new ShenPulseCore({
    store,
    resourcesDirectory,
    notifyRenderer,
    appVersion: getApplicationVersion(),
    liveDirectoryIdentityProvider: () => accountService.identityForLiveDirectory()
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
    storeUpdateService,
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
    .finally(() => {
      app.quit();
    });
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
