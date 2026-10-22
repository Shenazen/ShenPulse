"use strict";

/** Contrôle Chromium isolé de la fiche et des 14 bocaux, sans données utilisateur. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { JSDOM } = require("jsdom");
const { app, BrowserWindow } = require("electron");
const catalog = require("../resources/overlays/overlay-catalog");
const root = path.resolve(__dirname, "..");
const output = path.join(root, ".artifacts", "coin-jar-sheet-review");
const runtimeUrl = "http://127.0.0.1:41738/overlay/?view=coin-jar&preview=static&native=1&token=codex-preview";
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
fs.mkdirSync(output, { recursive: true });
app.setPath("userData", path.join(output, "electron-profile"));
app.disableHardwareAcceleration();

function fixtureHtml() {
  const config = catalog.defaultConfig("coinJar");
  let editor;
  const context = vm.createContext({
    URL, window: { addEventListener() {} }, overlayCatalog: catalog,
    overlayDesignSelections: {}, isAccountAuthenticated: () => true,
    snapshot: { state: { settings: {} }, previewOverlayUrls: {} }
  });
  for (const file of ["core/ui-foundations.js", "core/components.js", "editors/core.js", "features/overlays/fields.js", "features/overlays/catalog.js", "features/overlays/cards.js", "features/overlays/editor.js", "features/overlays/coin-jar-editor.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, "src/renderer/app", file), "utf8"), context);
  }
  context.overlayProfileName = () => "Vérification isolée";
  context.overlayConfig = () => config;
  context.openEditor = (options) => { editor = options; };
  context.openCoinJarOverlayConfig({ ...catalog.definition("coinJar"), url: runtimeUrl });
  const source = fs.readFileSync(path.join(root, "src/renderer/index.html"), "utf8");
  const start = source.indexOf('<dialog id="editor-dialog">');
  const dialog = source.slice(start, source.indexOf("</dialog>", start) + 9)
    .replace('<dialog id="editor-dialog">', `<dialog id="editor-dialog" data-variant="${editor.variant}">`)
    .replace('<div id="dialog-body" class="dialog-body"></div>', `<div id="dialog-body" class="dialog-body">${editor.body}</div>`)
    .replace('<h2 id="dialog-title">Modifier</h2>', `<h2 id="dialog-title">${editor.title}</h2>`);
  return `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(root, "src/renderer/styles.css"))}"><body>${dialog}<script>
    document.getElementById('editor-dialog').showModal();
    const update = ${context.updateOverlayRuntimeFrameScale.toString()};
    const observer = new ResizeObserver(entries => entries.forEach(entry => update(entry.target)));
    document.querySelectorAll('[data-overlay-native-frame]').forEach(frame => {
      observer.observe(frame); update(frame);
      frame.querySelector('iframe').addEventListener('load', () => frame.classList.add('overlay-runtime-frame--ready'));
    });
  </script>`;
}

async function configure(window, payload) {
  await window.webContents.executeJavaScript(`window.dispatchEvent(new MessageEvent('message', {source:window, data:{source:'shenpulse-overlay-card', channel:'configuration', payload:${JSON.stringify(payload)}}}))`);
  await wait(80);
}

app.whenReady().then(async () => {
  const options = { show: false, webPreferences: { offscreen: true, backgroundThrottling: false, nodeIntegration: false, contextIsolation: true } };
  const window = new BrowserWindow({ ...options, width: 1440, height: 900 });
  const runtime = new BrowserWindow({ ...options, width: 720, height: 520 });
  const results = [];
  const errors = [];
  for (const instance of [window, runtime]) instance.webContents.on("console-message", (event) => { if (/Uncaught/.test(event.message || "")) errors.push(event.message); });
  try {
    const htmlPath = path.join(output, "fixture.html");
    fs.writeFileSync(htmlPath, fixtureHtml());
    await window.loadFile(htmlPath);
    await wait(600);
    for (const [width, height] of [[1440, 900], [1280, 720], [1024, 640], [900, 720], [600, 850]]) {
      window.setContentSize(width, height);
      for (const advanced of [false, true]) {
        await window.webContents.executeJavaScript(`document.querySelector('.dialog-advanced').open=${advanced}; document.querySelector('.overlay-config-fields').scrollTop=0; document.getElementById('dialog-body').scrollTop=0;`);
        await wait(100);
        const state = await window.webContents.executeJavaScript(`(() => {
          const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
          const panel=document.querySelector('.overlay-live-preview-panel'),fields=document.querySelector('.overlay-config-fields');
          const row=selector=>{const items=[...document.querySelector(selector).children].filter(el=>el.matches('.field')&&el.getClientRects().length);const bottom=Math.min(...items.map(el=>rect(el).bottom));return items.filter(el=>Math.abs(rect(el).bottom-bottom)<1).length;};
          return {header:rect(document.querySelector('#editor-form>header')), footer:rect(document.querySelector('#editor-form>footer')),frame:rect(panel.querySelector('.overlay-runtime-frame--live')),note:rect(panel.querySelector('p')),actions:rect(panel.querySelector('.overlay-live-preview-actions')),panel:rect(panel),
            overflow:fields.scrollWidth-fields.clientWidth,bodyOverflow:document.getElementById('dialog-body').scrollWidth-document.getElementById('dialog-body').clientWidth,
            density:{title:row('.coin-jar-title-settings>.form-grid'),visibility:row('.coin-jar-visibility-settings>.form-grid'),text:row('.coin-jar-render-settings>.form-grid')},
            removedFields:[...fields.querySelectorAll('[name]')].filter(el=>['current','target','minCoins','showGoal','showPercent','showBase','coinJarLabel','coinJarValueScale','coinJarLabelScale'].includes(el.name)).map(el=>el.name),
            controls:[...fields.querySelectorAll('input:not([type=hidden]),select')].filter(el=>el.getClientRects().length).map(el=>({name:el.name,type:el.type,width:rect(el).width,font:parseFloat(getComputedStyle(el).fontSize)}))};
        })()`);
        assert.ok(state.header.top >= 0 && state.footer.bottom <= height);
        assert.ok(state.frame.height > 30 && state.frame.bottom <= state.note.top + 1);
        assert.ok(state.note.bottom <= state.actions.top + 1 && state.actions.bottom <= state.panel.bottom - 8);
        assert.ok(state.overflow <= 1 && state.bodyOverflow <= 1);
        assert.deepEqual(state.removedFields, []);
        if (width >= 1000) {
          assert.equal(state.density.title, 3);
          if (advanced) { assert.equal(state.density.visibility, 2); assert.equal(state.density.text, 4); }
        }
        for (const field of state.controls) {
          if (field.type !== "range") assert.ok(field.font >= 14, field.name);
          if (!["color", "range"].includes(field.type)) assert.ok(field.width >= 115, field.name);
        }
        results.push({ kind: "editor", width, height, advanced, ...state });
        if (advanced && width >= 1280) await window.webContents.executeJavaScript(`{const area=document.querySelector('.overlay-config-fields'); area.scrollTop+=document.querySelector('.coin-jar-visibility-settings').getBoundingClientRect().top-area.getBoundingClientRect().top;}`);
        await wait(60);
        fs.writeFileSync(path.join(output, `editor-${width}${advanced ? "-advanced" : ""}.png`), (await window.webContents.capturePage()).toPNG());
      }
    }
    await runtime.loadURL(`${runtimeUrl}&current=600&target=1000`);
    await wait(350);
    for (const [model] of catalog.coinJarModels) {
      for (const scale of [50, 100, 400]) {
        await configure(runtime, { model, title: scale === 400 ? "LE GRAND BOCAL DE LA COMMUNAUTÉ" : "COIN JAR", coinJarTitleScale: scale, showGoal: true, showBase: true, showPercent: true, coinJarLabel: "PIÈCES" });
        const state = await runtime.webContents.executeJavaScript(`(() => {
          const zones=['coin-jar-title'].map(id=>{const el=document.getElementById(id),zone=el.getBoundingClientRect(),text=el.firstElementChild.getBoundingClientRect();return {id,zone:{x:zone.x,y:zone.y,width:zone.width,height:zone.height},text:{x:text.x,y:text.y,width:text.width,height:text.height},font:parseFloat(getComputedStyle(el).fontSize)};});
          return {zones, removedWidgets:document.querySelectorAll('.coin-jar-meter,.coin-jar-level,#coin-jar-current,#coin-jar-target,#coin-jar-percent,#coin-jar-label').length, front:document.getElementById('coin-jar-front').complete&&document.getElementById('coin-jar-front').naturalWidth>0};
        })()`);
        assert.equal(state.front, true, model);
        assert.equal(state.removedWidgets, 0, model);
        for (const { id, zone, text } of state.zones) {
          assert.ok(text.width <= zone.width + 1 && text.height <= zone.height + 1, `${model} ${scale} ${id}: texte hors zone`);
          assert.ok(Math.abs((zone.x+zone.width/2)-(text.x+text.width/2)) < 1, `${model} ${id}: décentré`);
          assert.ok(text.y >= zone.y - 1 && text.y + text.height <= zone.y + zone.height + 1, `${model} ${id}: débordement vertical`);
        }
        results.push({ kind: "runtime", model, scale, ...state });
        fs.writeFileSync(path.join(output, `${model}-${scale}.png`), (await runtime.webContents.capturePage()).toPNG());
      }
    }
    assert.deepEqual(errors, []);
    console.log(`Coin Jar : ${results.length} rendus Chromium vérifiés, 14 modèles et tailles de 50 à 400 %.`);
  } finally {
    fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify({ errors, results }, null, 2));
    window.destroy(); runtime.destroy();
  }
}).then(() => app.quit()).catch(error => { console.error(error.stack); app.exit(1); });
