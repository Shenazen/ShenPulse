"use strict";

/** Vérification Chromium isolée : aucune publication des réglages administrateur. */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { gameCatalogRenderer } = require("../tests/helpers/game-catalog-renderer");
const visibility = require("../src/shared/visibility-catalog");
const root = path.resolve(__dirname, ".."), output = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-admin-platforms-"));
app.setPath("userData", path.join(output, "electron-profile"));
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const packs = loadShenazenGameCatalog(path.join(root, "resources")).filter(pack => ["balatro", "blue-prince", "hades"].includes(pack.id));
  const fixture = gameCatalogRenderer(packs, { owner: true }), context = fixture.context;
  context.snapshot.appVersion = "2.0.4";
  Object.assign(context, {
    ACTION_TYPE_LABELS: {}, overlayDefinitions: () => [],
    adminVisibilitySection: "games", adminVisibilitySearch: "", adminBusy: false,
    accountSession: { uid: "fixture-owner" },
    adminDashboard: { siteSettings: { schemaVersion: visibility.VISIBILITY_SCHEMA_VERSION, games: {
      hades: { scope: "hidden", platforms: visibility.GAME_PLATFORM_IDS, platformsConfigured: true, minAppVersion: "2.0.10" },
      "blue-prince": { scope: "public", platformsConfigured: true, minAppVersion: "2.0.5" }
    } } },
    openEditor: options => { context.editor = options; }
  });
  for (const file of ["features/admin/page.js", "features/admin/game-platforms.js", "features/admin/game-versions.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, "src/renderer/app", file), "utf8"), context);
  }
  context.openAdminGamePlatformsEditor("hades");
  const platformEditor = context.editor;
  context.openAdminGameVersionEditor("blue-prince");
  const versionEditor = context.editor;
  const gallery = `<article class="game-gallery-tile platform-test-card"><div class="tile-caption"><h3>Hades · sept logos</h3>${context.gamePlatformLogos(packs.find(pack => pack.id === "hades"), context.adminDashboard.siteSettings)}</div></article>`;
  const views = {
    visibility: `<div class="admin-page">${context.renderAdminVisibility()}</div>`,
    editor: `<main class="platform-test-editor"><h2>${platformEditor.title}</h2>${platformEditor.body}</main>${gallery}`,
    version: `<main class="platform-test-editor"><h2>${versionEditor.title}</h2>${versionEditor.body}</main>`
  };
  const window = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const results = [];
  try {
    for (const [view, body] of Object.entries(views)) {
      const file = path.join(output, `${view}.html`);
      fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><base href="${pathToFileURL(path.join(root, "src/renderer/")).href}"><link rel="stylesheet" href="styles.css"><style>body{margin:0;padding:18px;box-sizing:border-box;overflow:auto}.admin-page{width:100%;min-width:0}.platform-test-editor{width:min(100%,720px);margin:auto}.platform-test-card{width:280px;height:320px;background:#11182b;margin:24px auto;position:relative}</style>${body}`);
      await window.loadFile(file);
      for (const width of [1440, 1024, 600, 400]) {
        window.setContentSize(width, 1000);
        await new Promise(resolve => setTimeout(resolve, 80));
        const state = await window.webContents.executeJavaScript(`(() => ({overflow:document.documentElement.scrollWidth-innerWidth,choices:document.querySelectorAll('input[name="platforms"]').length,logos:document.querySelectorAll('.platform-test-card .tile-platform-logo').length,versions:[...document.querySelectorAll('[data-action="admin-game-version"]')].map(el=>el.textContent),version:document.querySelector('[name="minAppVersion"]')?.value,bounds:[...document.querySelectorAll('.admin-game-platform-option,.admin-game-visibility-row > select,.admin-game-platforms .button,.admin-game-version .button,[name="minAppVersion"],.platform-test-card .tile-platform-logo')].map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};})}))()`);
        assert.equal(state.overflow, 0, `${view} ${width}`);
        if (view === "editor") { assert.equal(state.choices, 7); assert.equal(state.logos, 7); }
        if (view === "visibility") assert.deepEqual(state.versions, ["Toutes les versions", "≥ 2.0.5", "≥ 2.0.10"]);
        if (view === "version") assert.equal(state.version, "2.0.5");
        for (const rect of state.bounds) assert.ok(rect.left >= 0 && rect.right <= width && rect.width > 0, `${view} ${width}: ${JSON.stringify(rect)}`);
        fs.writeFileSync(path.join(output, `${view}-${width}.png`), (await window.webContents.capturePage()).toPNG());
        results.push({ view, width, ...state });
      }
    }
    fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify(results, null, 2));
    console.log(`Administration, versions minimales et sept logos : ${results.length} rendus Chromium validés. ${output}`);
  } finally { fixture.close(); window.destroy(); }
}).then(() => app.quit()).catch(error => { console.error(error.stack); app.exit(1); });
