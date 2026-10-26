"use strict";

/** Contrôle des filtres dans Chromium, avec un catalogue de test et un profil isolé. */
if (!process.versions.electron) {
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = require("node:child_process").spawnSync(require("electron"), [__filename], {
    env: environment, stdio: "inherit", windowsHide: true
  });
  if (child.error) process.stderr.write(`${child.error.message}\n`);
  process.exit(child.status ?? 1);
}
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { gameCatalogRenderer } = require("../tests/helpers/game-catalog-renderer");
const { categories } = require("../src/shared/game-categories");
const root = path.resolve(__dirname, "..");
const output = path.join(root, ".artifacts/game-category-review");
fs.mkdirSync(output, { recursive: true });
app.setPath("userData", path.join(output, "electron-profile"));
app.disableHardwareAcceleration();
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1440, height: 600, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const fixture = gameCatalogRenderer(loadShenazenGameCatalog(path.join(root, "resources")));
  const results = [];
  try {
    for (const { id: category } of categories) {
      fixture.context.gameCategory = category;
      const page = fixture.render();
      const displayed = [...page.querySelectorAll(".game-gallery-tile")].map(tile => tile.dataset.id);
      assert.equal(new Set(displayed).size, displayed.length, `${category} : cartes dupliquées`);
      if (["horror", "simulation", "adventure"].includes(category)) assert.ok(displayed.includes("dredge"), `${category} : DREDGE absent`);
      const toolbar = page.querySelector(".games-toolbar").outerHTML;
      const html = path.join(output, "fixture.html");
      fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(root, "src/renderer/styles.css"))}"><style>body{margin:0;padding:24px;box-sizing:border-box}main{width:100%;min-width:0}</style><body><main class="games-gallery-page">${toolbar}</main>`);
      await window.loadFile(html);
      for (const width of [1440, 1024, 600, 400]) {
        window.setContentSize(width, 600);
        await wait(100);
        const state = await window.webContents.executeJavaScript(`(() => {
          const buttons=[...document.querySelectorAll('[data-action="set-game-category"]')];
          return {overflow:document.documentElement.scrollWidth-innerWidth, active:buttons.filter(el=>el.getAttribute('aria-pressed')==='true').map(el=>el.dataset.value),buttons:buttons.map(el=>{const r=el.getBoundingClientRect();return {id:el.dataset.value,left:r.left,right:r.right,bottom:r.bottom,count:el.querySelector('.game-category-count').textContent,font:parseFloat(getComputedStyle(el).fontSize)};})};
        })()`);
        assert.equal(state.buttons.length, 9);
        assert.deepEqual(state.active, [category]);
        assert.ok(state.overflow <= 1);
        for (const button of state.buttons) assert.ok(button.left >= 0 && button.right <= width + 1 && button.bottom <= 600 && button.font >= 12, `${width} ${JSON.stringify(button)}`);
        results.push({ width, category, ...state });
        fs.writeFileSync(path.join(output, `${category}-${width}.png`), (await window.webContents.capturePage()).toPNG());
      }
    }
    console.log(`Filtres jeux : ${results.length} rendus Chromium validés, neuf catégories sans débordement.`);
  } finally {
    fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify(results, null, 2));
    fixture.close(); window.destroy();
  }
}).then(() => app.quit()).catch(error => { console.error(error.stack); app.exit(1); });
