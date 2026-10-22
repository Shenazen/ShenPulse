"use strict";

/** Vérifie la vraie mise en page Chromium sans ouvrir ni modifier le profil utilisateur. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { JSDOM } = require("jsdom");
const { app, BrowserWindow } = require("electron");
const catalog = require("../resources/overlays/overlay-catalog");
const { createDefaultOverlayConfigs } = require("../src/main/defaults");

const root = path.resolve(__dirname, "..");
const output = path.join(root, ".artifacts", "wheel-sheet-review");
fs.mkdirSync(output, { recursive: true });
app.setPath("userData", path.join(output, "electron-profile"));
app.disableHardwareAcceleration();
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function fixtureHtml(design = "classic") {
  const config = createDefaultOverlayConfigs().wheel;
  config.wheels[0].design = design;
  config.wheels[0].name = "Actions du jeu — une roue avec un nom long";
  config.wheels[0].segments[0].actionId = "game-action";
  config.wheels.push({ ...structuredClone(config.wheels[0]), name: "Ancienne copie de la roue" });
  let body;
  let variant;
  const context = vm.createContext({
    URL, window: { addEventListener() {} }, overlayCatalog: catalog,
    wheelEditorContext: null, overlayDesignSelections: {}, cryptoId: () => "fixture",
    giftCatalogById: new Map(), giftCatalogByName: new Map(), GIFT_CATALOG: [],
    isAccountAuthenticated: () => true,
    snapshot: { state: { settings: {} }, previewOverlayUrls: {} },
    flattenActions: () => [{ rule: { name: "Minecraft — actions de la partie en cours" }, action: { id: "game-action", type: "game.effect" } }]
  });
  for (const file of ["core/ui-foundations.js", "core/components.js", "editors/core.js", "features/media/gift-picker.js", "features/overlays/fields.js", "features/overlays/catalog.js", "features/overlays/cards.js", "features/overlays/editor.js", "features/overlays/wheel-editor.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, "src/renderer/app", file), "utf8"), context);
  }
  context.actionTypeLabel = () => "Interaction du jeu";
  context.overlayProfileName = () => "Vérification isolée";
  context.overlayConfig = () => context.normalizeWheelConfig(config);
  context.openEditor = (options) => {
    body = options.body;
    variant = options.variant;
    const dom = new JSDOM(`<form>${body}</form>`);
    context.dialogBody = dom.window.document.querySelector("form");
  };
  context.openWheelOverlayConfig({ ...catalog.definition("wheel"), url: "http://127.0.0.1:41738/overlay/?view=wheel&preview=static&native=1&token=codex-preview" }, config);
  const source = fs.readFileSync(path.join(root, "src/renderer/index.html"), "utf8");
  const dialog = source.slice(source.indexOf('<dialog id="editor-dialog">'), source.indexOf("</dialog>", source.indexOf('<dialog id="editor-dialog">')) + 9)
    .replace('<dialog id="editor-dialog">', `<dialog id="editor-dialog" data-variant="${variant}">`)
    .replace('<div id="dialog-body" class="dialog-body"></div>', `<div id="dialog-body" class="dialog-body">${body}</div>`)
    .replace('<h2 id="dialog-title">Modifier</h2>', '<h2 id="dialog-title">Configurer la roue d’actions</h2>');
  context.dialogBody.ownerDocument.defaultView.close();
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

async function inspect(window) {
  return window.webContents.executeJavaScript(`(() => {
    const rect = element => { const r=element.getBoundingClientRect(); return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
    const panel=document.querySelector('.overlay-live-preview-panel');
    const fields=document.querySelector('.overlay-config-fields');
    const frame=panel.querySelector('.overlay-runtime-frame--live');
    const controls=[...fields.querySelectorAll('input:not([type=hidden]):not([type=radio]),select')].filter(el=>el.getClientRects().length);
    const firstRow = selector => {
      const items=[...fields.querySelector(selector).children].filter(el=>el.matches('.field') && el.getClientRects().length);
      if(!items.length) return 0;
      const bottom=Math.min(...items.map(el=>rect(el).bottom));
      return items.filter(el=>Math.abs(rect(el).bottom-bottom)<1).length;
    };
    return {viewport:innerWidth, viewportHeight:innerHeight, header:rect(document.querySelector('#editor-form > header')), footer:rect(document.querySelector('#editor-form > footer')), frame:rect(frame), iframe:rect(frame.querySelector('iframe')), note:rect(panel.querySelector('p')), actions:rect(panel.querySelector('.overlay-live-preview-actions')), panel:rect(panel),
      horizontalOverflow: fields.scrollWidth-fields.clientWidth,
      dialogOverflow:document.getElementById('dialog-body').scrollWidth-document.getElementById('dialog-body').clientWidth,
      selected:document.querySelector('[data-wheel-selection]').selectedOptions.length,
      density: { typography:firstRow('.wheel-render-settings > .form-grid'), visibility:firstRow('.wheel-visibility-settings > .form-grid'), playback:firstRow('.wheel-playback-settings > .form-grid'), sectors:firstRow('.wheel-segment-fields') },
      controls:controls.map(el=>({name:el.name,width:rect(el).width,font:parseFloat(getComputedStyle(el).fontSize),type:el.type}))};
  })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { offscreen: true, backgroundThrottling: false, nodeIntegration: false, contextIsolation: true } });
  const errors = [];
  window.webContents.on("console-message", (event) => { if (/Uncaught/.test(event.message || "")) errors.push(event.message); });
  const htmlPath = path.join(output, "fixture.html");
  const results = [];
  try {
    for (const design of ["classic", "royal"]) {
      fs.writeFileSync(htmlPath, fixtureHtml(design));
      await window.loadFile(htmlPath, { query: { design } });
      await wait(400);
      for (const [width, height] of [[1440, 900], [1280, 720], [1024, 640], [900, 720], [600, 850]]) {
      window.setContentSize(width, height);
      await wait(100);
      for (const advanced of [false, true]) {
        await window.webContents.executeJavaScript(`document.querySelector('.dialog-advanced').open=${advanced}; document.querySelector('.overlay-config-fields').scrollTop=0; document.getElementById('dialog-body').scrollTop=0;`);
        await wait(80);
        const state = await inspect(window);
        results.push({ design, width, height, advanced, ...state });
        assert.equal(state.selected, 1);
        assert.ok(state.header.top >= 0 && state.footer.bottom <= state.viewportHeight, `en-tête ou enregistrement coupé à ${width}`);
        assert.ok(state.frame.height > 30, `aperçu absent à ${width}`);
        assert.ok(state.frame.bottom <= state.note.top + 1, `aperçu sur le texte à ${width}`);
        assert.ok(state.note.bottom <= state.actions.top + 1, `texte sur les boutons à ${width}`);
        assert.ok(state.actions.bottom <= state.panel.bottom - 8, `boutons hors de leur zone à ${width}`);
        assert.ok(state.horizontalOverflow <= 1 && state.dialogOverflow <= 1, `débordement horizontal à ${width}`);
        if (advanced && width >= 1000) {
          assert.ok(state.density.typography >= (width >= 1280 ? 4 : 3), `réglages de texte insuffisamment regroupés à ${width}`);
          assert.equal(state.density.visibility, 3);
          assert.equal(state.density.playback, 3);
          assert.equal(state.density.sectors, 3);
        }
        for (const field of state.controls) {
          if (field.type !== "range") assert.ok(field.font >= 14, `texte trop petit : ${field.name}`);
          if (!["color", "range"].includes(field.type)) assert.ok(field.width >= 125, `champ trop étroit : ${field.name}`);
        }
        const prefix = design === "royal" ? "wheel-royal" : "wheel";
        if (!advanced) fs.writeFileSync(path.join(output, `${prefix}-${width}.png`), (await window.webContents.capturePage()).toPNG());
        if (advanced && width >= 1280) {
          await window.webContents.executeJavaScript(`{const area=document.querySelector('.overlay-config-fields'); area.scrollTop+=document.querySelector('.wheel-render-settings').getBoundingClientRect().top-area.getBoundingClientRect().top;}`);
          await wait(60);
          fs.writeFileSync(path.join(output, `${prefix}-${width}-typography.png`), (await window.webContents.capturePage()).toPNG());
          await window.webContents.executeJavaScript(`{const area=document.querySelector('.overlay-config-fields'); area.scrollTop+=document.querySelector('.wheel-sectors-settings').getBoundingClientRect().top-area.getBoundingClientRect().top;}`);
          await wait(60);
          fs.writeFileSync(path.join(output, `${prefix}-${width}-sectors.png`), (await window.webContents.capturePage()).toPNG());
        }
      }
    }
    }
    assert.deepEqual(errors, []);
    console.log(`Fiche roue : ${results.length} rendus Chromium vérifiés, sans chevauchement ni champ coupé.`);
  } finally {
    fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify({ errors, results }, null, 2));
    window.destroy();
  }
}).then(() => app.quit()).catch(error => { console.error(error.stack); app.exit(1); });
