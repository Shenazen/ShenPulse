"use strict";

/** Vérifie les vraies légendes et logos dans un Chromium isolé. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { gameCatalogRenderer } = require("../tests/helpers/game-catalog-renderer");
const root = path.resolve(__dirname, "..");
const output = path.join(root, ".artifacts/game-platform-review");
fs.mkdirSync(output, { recursive: true });
app.setPath("userData", path.join(output, "electron-profile"));
app.disableHardwareAcceleration();
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const packs = loadShenazenGameCatalog(path.join(root, "resources"));
  const fixture = gameCatalogRenderer(packs, { owner: true });
  const results = [];
  try {
    const page = fixture.render();
    const samples = ["ark-survival-ascended", "balatro", "blue-prince", "hades"].map(id => {
      const pack = fixture.context.visibleGamePacks().find(pack => pack.id === id);
      return `<article class="game-gallery-tile"><div class="tile-caption"><h3>${fixture.context.escapeHtml(pack.name)}</h3>${fixture.context.gamePlatformLogos(pack)}</div></article>`;
    }).join("");
    const html = path.join(output, "fixture.html");
    fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(root, "src/renderer/styles.css"))}"><style>body{margin:0;padding:24px;box-sizing:border-box;overflow:auto}main{width:100%;min-width:0}.game-platform-samples{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:18px;margin-top:24px}.game-platform-samples .game-gallery-tile{min-height:170px;aspect-ratio:auto;background:linear-gradient(135deg,#1e1638,#101827)}</style><body><main class="games-gallery-page">${page.querySelector(".game-platform-legend").outerHTML}<div class="game-platform-samples">${samples}</div></main>`);
    await window.loadFile(html);
    for (const width of [1440, 1024, 600, 400]) {
      window.setContentSize(width, 900);
      await wait(120);
      const state = await window.webContents.executeJavaScript(`(() => {
        return {overflow:document.documentElement.scrollWidth-innerWidth,legend:document.querySelectorAll('.game-platform-legend .platform-game-pass').length,
          badges:document.querySelectorAll('.game-platform-samples .platform-game-pass').length,
          logos:[...document.querySelectorAll('.platform-game-pass')].map(el=>{const r=el.getBoundingClientRect(),svg=el.querySelector('svg').getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height,svgWidth:svg.width,svgHeight:svg.height};})};
      })()`);
      assert.equal(state.overflow, 0);
      assert.equal(state.legend, 1);
      assert.equal(state.badges, 3);
      for (const logo of state.logos) assert.ok(logo.left >= 0 && logo.right <= width && logo.svgWidth <= logo.width && logo.svgHeight <= logo.height);
      results.push({ width, ...state });
      fs.writeFileSync(path.join(output, `platforms-${width}.png`), (await window.webContents.capturePage()).toPNG());
    }
    console.log(`Plateformes : ${results.length} rendus Chromium validés avec Game Pass sur les cartes et dans la légende.`);
  } finally {
    fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify(results, null, 2));
    fixture.close(); window.destroy();
  }
}).then(() => app.quit()).catch(error => { console.error(error.stack); app.exit(1); });
