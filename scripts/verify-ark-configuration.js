"use strict";

// Pages réelles avec un profil isolé : aucun jeu lancé et aucun réglage publié.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const root = path.resolve(__dirname, "..");
const output = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-ark-configuration-"));
app.setPath("userData", path.join(output, "electron-profile"));
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const pack = loadShenazenGameCatalog(path.join(root, "resources")).find(pack => pack.id === "ark-survival-ascended");
  const context = vm.createContext({
    snapshot: { state: { game: { installations: {}, connectorOverrides: { [pack.id]: { keyLayout: "azerty" } } }, settings: {} } },
    MANAGED_BIZHAWK_GAME_IDS: new Set(), CONFIGURABLE_INTEGRATED_GAMES: new Set(),
    MINECRAFT_MODE_IDS: [], MINECRAFT_ROUND_MODE_IDS: [], gameInstallBusyId: "", gameLaunchBusyId: "",
    escapeHtml: value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
    renderGamePageMessage: () => "", activeGameSession: () => null, gameMappedEffects: () => [],
    overlayProfileName: () => "Profil ARK", visibilityTools: { gameScopeFor: () => "public" }, siteVisibility: {}
  });
  const bootstrap = fs.readFileSync(path.join(root, "src/renderer/app/core/bootstrap.js"), "utf8");
  for (const name of ["AUTOMATED_GAME_INSTALLERS", "GAME_OVERLAY_GENERATOR_ONLY_IDS"]) {
    vm.runInContext(bootstrap.match(new RegExp(`const ${name} = new Set\\(\\[[\\s\\S]*?\\]\\);`))[0], context);
  }
  vm.runInContext(bootstrap.match(/const GTA_INTERACTION_OVERLAY_BACKGROUNDS = \[[\s\S]*?\];/)[0], context);
  vm.runInContext(fs.readFileSync(path.join(root, "src/renderer/app/features/games/overlay-cards.js"), "utf8"), context);
  const views = { installation: context.renderGameInstallation(pack, true) };
  context.snapshot.state.game.installations[pack.id] = { installerVersion: pack.installerVersion };
  views.overlays = context.renderGameOverlays(pack, true);
  views.launch = context.renderGameLaunch(pack, true);
  const window = new BrowserWindow({ show: false, width: 1440, height: 1050, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const results = [];
  try {
    for (const [view, body] of Object.entries(views)) {
      const file = path.join(output, `${view}.html`);
      fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><base href="${pathToFileURL(path.join(root, "src/renderer/")).href}"><link rel="stylesheet" href="styles.css"><style>body{margin:0;padding:24px;box-sizing:border-box;overflow:auto}main{width:100%;min-width:0}</style><main>${body}</main>`);
      await window.loadFile(file);
      for (const width of [1440, 1024, 600, 400]) {
        window.setContentSize(width, 1050);
        await new Promise(resolve => setTimeout(resolve, 80));
        const state = await window.webContents.executeJavaScript(`(() => ({overflow:document.documentElement.scrollWidth-innerWidth,fields:[...document.querySelectorAll('button,select')].map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent.trim().slice(0,80),left:r.left,right:r.right,width:r.width,height:r.height};})}))()`);
        assert.ok(state.overflow <= 1, `${view} ${width}: débordement ${state.overflow}`);
        for (const field of state.fields) assert.ok(field.left >= 0 && field.right <= width + 1 && field.width > 0 && field.height >= 28, `${view} ${width}: ${JSON.stringify(field)}`);
        fs.writeFileSync(path.join(output, `${view}-${width}.png`), (await window.webContents.capturePage()).toPNG());
        results.push({ view, width, ...state });
      }
    }
    fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify(results, null, 2));
    console.log(`Configuration ARK : ${results.length} rendus Chromium validés. ${output}`);
  } finally { window.destroy(); }
}).then(() => app.quit()).catch(error => { console.error(error.stack); app.exit(1); });
