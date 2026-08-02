"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  app,
  BrowserWindow,
  ipcMain
} = require("electron");
const { createDefaultState } = require("../src/main/defaults");
const {
  loadShenazenGameCatalog
} = require("../src/main/game-catalog");

const OWNER_EMAIL = "alexandre.leuridan@gmail.com";
const VIEWER_EMAIL = "viewer@example.com";
const ADDED_EMAIL = "second-viewer@example.com";
const modes = new Map();
const consoleErrors = [];
let siteSettings = {
  schemaVersion: 7,
  actionTypeOverrides: {},
  cheatAccess: {
    "game-tabs": {
      entries: [{ email: VIEWER_EMAIL }]
    }
  },
  navigation: {},
  features: {},
  games: {},
  overlays: {},
  setupFeatures: {},
  actionTypes: {},
  maintenanceFeatures: {}
};

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function withTimeout(promise, description, timeoutMs = 10000) {
  return Promise.race([
    promise,
    delay(timeoutMs).then(() => {
      throw new Error(`Délai dépassé : ${description}.`);
    })
  ]);
}

async function waitFor(window, expression, description, timeoutMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await withTimeout(
      window.webContents
        .executeJavaScript(`Boolean(${expression})`)
        .catch(() => false),
      `évaluation ${description}`,
      1500
    ).catch(() => false);
    if (result) return;
    await delay(80);
  }
  throw new Error(`Délai dépassé : ${description}.`);
}

function modeFor(event) {
  return modes.get(event.sender.id) || "denied";
}

function accountForMode(mode) {
  const owner = mode === "admin";
  return {
    authenticated: true,
    email: owner ? OWNER_EMAIL : VIEWER_EMAIL,
    uid: owner ? "owner_uid" : "viewer_uid",
    displayName: owner ? "Propriétaire" : "Viewer",
    photoUrl: "",
    providerId: "password",
    emailVerified: true,
    lastAuthenticatedAt: new Date().toISOString(),
    offline: false
  };
}

function snapshotForMode(mode) {
  const account = accountForMode(mode);
  const state = createDefaultState();
  state.settings.account = {
    email: account.email,
    uid: account.uid,
    displayName: account.displayName,
    photoUrl: "",
    providerId: "password",
    emailVerified: true,
    refreshTokenSecretId: "smoke-secret",
    lastAuthenticatedAt: account.lastAuthenticatedAt
  };
  state.commerce.subscription = {
    tier: "pro",
    source: "own",
    status: "active",
    priceMonthly: 9.99,
    renewalDate: "2026-08-30T12:00:00.000Z"
  };
  state.commerce.gameEntitlements = [
    {
      id: "deal-or-no-deal",
      gameId: "deal-or-no-deal",
      productId: "deal-or-no-deal",
      source: "purchase",
      status: "active",
      expiresAt: "",
      expiresAtMs: 0
    }
  ];
  return {
    state,
    packs: loadShenazenGameCatalog(
      path.join(__dirname, "..", "resources")
    ),
    soundCatalog: [],
    mediaCatalog: [],
    overlayUrls: {},
    localOverlayUrls: {},
    publicOverlayRelay: {},
    services: {
      api: { running: false },
      overlay: { running: false }
    }
  };
}

function installIpcMocks() {
  ipcMain.handle("snapshot:get", (event) =>
    snapshotForMode(modeFor(event))
  );
  ipcMain.handle("catalog:gifts", () => ({
    gifts: [],
    total: 0
  }));
  ipcMain.handle("account:status", (event) =>
    accountForMode(modeFor(event))
  );
  ipcMain.handle("account:game-cheat-access", (event) => ({
    allowed: modeFor(event) !== "denied",
    checkedAt: new Date().toISOString()
  }));
  ipcMain.handle("account:sync-entitlements", () => ({
    checkedAt: new Date().toISOString(),
    gameEntitlements: [],
    source: "own",
    tier: "pro"
  }));
  ipcMain.handle("admin:visibility-public", () => ({
    schemaVersion: 7,
    navigation: {},
    features: {},
    actionTypes: {},
    overlays: {},
    games: {}
  }));
  ipcMain.handle("admin:status", (event) => {
    const owner = modeFor(event) === "admin";
    return {
      authorized: owner,
      email: owner ? OWNER_EMAIL : "",
      uid: owner ? "owner_uid" : "",
      lastAuthenticatedAt: owner ? new Date().toISOString() : ""
    };
  });
  ipcMain.handle("admin:dashboard", (event) => ({
    status: {
      authorized: modeFor(event) === "admin",
      email: modeFor(event) === "admin" ? OWNER_EMAIL : "",
      uid: modeFor(event) === "admin" ? "owner_uid" : "",
      lastAuthenticatedAt: new Date().toISOString()
    },
    siteSettings: structuredClone(siteSettings),
    commerce: {
      catalog: {
        products: {},
        promotions: {},
        subscriptions: {}
      },
      history: []
    },
    trials: { ok: true, trials: [] },
    errors: {}
  }));
  ipcMain.handle("admin:site-save", (_event, incoming) => {
    siteSettings = structuredClone(incoming);
    return structuredClone(siteSettings);
  });
}

async function createWindow(mode, dimensions = {}) {
  const window = new BrowserWindow({
    width: dimensions.width || 1440,
    height: dimensions.height || 980,
    show: false,
    backgroundColor: "#050611",
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      offscreen: true,
      preload: path.join(__dirname, "..", "src", "main", "preload.js"),
      sandbox: false,
      webSecurity: true
    }
  });
  modes.set(window.webContents.id, mode);
  window.webContents.on("console-message", (_event, level, message) => {
    if (level >= 2) consoleErrors.push(`${mode}: ${message}`);
  });
  await withTimeout(
    window.loadFile(
      path.join(__dirname, "..", "src", "renderer", "index.html")
    ),
    `chargement de la fenêtre ${mode}`
  );
  await waitFor(
    window,
    'document.querySelector("#navigation button")',
    `navigation ${mode}`
  );
  return window;
}

async function verifyAdmin(targetDirectory) {
  const window = await createWindow("admin");
  await waitFor(
    window,
    'document.querySelector(\'[data-navigate="admin"]\')',
    "navigation administrateur"
  );
  await window.webContents.executeJavaScript(
    'document.querySelector(\'[data-navigate="admin"]\').click()'
  );
  await waitFor(
    window,
    'document.querySelector(\'[data-action="admin-workspace"][data-value="game-cheats"]\')',
    "rubrique Triche de jeux"
  );
  await window.webContents.executeJavaScript(
    'document.querySelector(\'[data-action="admin-workspace"][data-value="game-cheats"]\').click()'
  );
  await waitFor(
    window,
    'document.querySelector("#admin-game-cheat-form")',
    "formulaire des accès"
  );

  const initial = await window.webContents.executeJavaScript(`(() => {
    const form = document.querySelector("#admin-game-cheat-form");
    const layout = document.querySelector(".admin-cheat-access-layout");
    return {
      workspaceCount: document.querySelectorAll(".admin-workspaces > button").length,
      title: document.querySelector(".admin-cheat-access-hero h3").textContent,
      ownerVisible: document.body.innerText.includes(${JSON.stringify(OWNER_EMAIL)}),
      viewerVisible: document.body.innerText.includes(${JSON.stringify(VIEWER_EMAIL)}),
      formVisible: form.getBoundingClientRect().height > 0,
      columns: getComputedStyle(layout).gridTemplateColumns.split(" ").length
    };
  })()`);
  if (
    initial.workspaceCount !== 5 ||
    initial.title !== "Onglets de triche" ||
    !initial.ownerVisible ||
    !initial.viewerVisible ||
    !initial.formVisible ||
    initial.columns !== 2
  ) {
    throw new Error(
      `Présentation de l’administration incorrecte : ${JSON.stringify(initial)}`
    );
  }

  await window.webContents.executeJavaScript(`(() => {
    const form = document.querySelector("#admin-game-cheat-form");
    form.querySelector('input[name="email"]').value = ${JSON.stringify(ADDED_EMAIL)};
    form.requestSubmit();
  })()`);
  await waitFor(
    window,
    `document.body.innerText.includes(${JSON.stringify(ADDED_EMAIL)})`,
    "ajout de l’adresse"
  );

  const image = await window.webContents.capturePage();
  const screenshot = path.join(
    targetDirectory,
    "administration-triche-de-jeux.png"
  );
  await fs.promises.writeFile(screenshot, image.toPNG());
  window.destroy();
  return { ...initial, screenshot };
}

async function verifyDealTab(mode, expected, targetDirectory) {
  const window = await createWindow(mode, { width: 1500, height: 1050 });
  await window.webContents.executeJavaScript(
    'document.querySelector(\'[data-navigate="games"]\').click()'
  );
  await waitFor(
    window,
    'document.querySelector(\'[data-action="open-game"][data-id="deal-or-no-deal"]\')',
    `carte DealOrNoDeal ${mode}`
  );
  await window.webContents.executeJavaScript(
    'document.querySelector(\'[data-action="open-game"][data-id="deal-or-no-deal"]\').click()'
  );
  await waitFor(
    window,
    'document.querySelector("[data-integrated-game-settings=\\"deal-or-no-deal\\"]")',
    `réglages DealOrNoDeal ${mode}`
  );
  const state = await window.webContents.executeJavaScript(`(() => ({
    cheatTabVisible: Boolean(document.getElementById("deal-settings-cheat")),
    privateMonitorVisible: Boolean(document.querySelector("[data-deal-private-monitor]"))
  }))()`);
  if (
    state.cheatTabVisible !== expected ||
    state.privateMonitorVisible !== expected
  ) {
    throw new Error(
      `Droit DealOrNoDeal ${mode} incorrect : ${JSON.stringify(state)}`
    );
  }
  const image = await window.webContents.capturePage();
  const screenshot = path.join(
    targetDirectory,
    `deal-or-no-deal-${mode}.png`
  );
  await fs.promises.writeFile(screenshot, image.toPNG());
  window.destroy();
  return { ...state, screenshot };
}

async function run() {
  const targetDirectory = path.join(
    __dirname,
    "..",
    ".artifacts",
    "game-cheat-access"
  );
  await fs.promises.mkdir(targetDirectory, { recursive: true });
  installIpcMocks();
  process.stdout.write("Vérification administration…\n");
  const admin = await verifyAdmin(targetDirectory);
  process.stdout.write("Vérification compte autorisé…\n");
  const allowed = await verifyDealTab(
    "allowed",
    true,
    targetDirectory
  );
  process.stdout.write("Vérification compte non autorisé…\n");
  const denied = await verifyDealTab(
    "denied",
    false,
    targetDirectory
  );
  if (consoleErrors.length) {
    throw new Error(`Erreurs console : ${consoleErrors.join(" | ")}`);
  }
  const result = { admin, allowed, consoleErrors, denied };
  await fs.promises.writeFile(
    path.join(targetDirectory, "result.json"),
    JSON.stringify(result, null, 2),
    "utf8"
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

app
  .whenReady()
  .then(run)
  .then(() => app.exit(0))
  .catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    BrowserWindow.getAllWindows().forEach((window) => window.destroy());
    app.exit(1);
  });
