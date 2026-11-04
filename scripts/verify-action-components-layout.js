"use strict";
/** Rendu Chromium isolé du formulaire réel : aucun compte ni appel au moteur. */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const assert = require("node:assert/strict");
const { app, BrowserWindow } = require("electron");
const { actionEditorFixture } = require("../tests/helpers/action-editor-fixture");
const { readRendererStyles } = require("../tests/helpers/source-bundles");
const output = path.resolve(".artifacts/action-components-visual");
fs.mkdirSync(output, { recursive: true });
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-action-layout-")));
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND");
let window;
const deadline = setTimeout(() => app.exit(2), 45000);
app.whenReady().then(async () => {
  const h = actionEditorFixture(null, { actions: [
    { id: "media", type: "overlay.media", config: { durationMs: 5000 } },
    { id: "text", type: "overlay.text", config: { alert: { enabled: true, message: "Merci {giftname} !", screen: 1 } } },
    { id: "sound", type: "audio.play", config: {} }
  ] });
  Object.assign(h.window, { MEDIA_LIBRARY: [], SOUND_LIBRARY: [], mediaSessionEntries: new Map(), soundLibraryEntry: () => null, soundActionRows: () => [] });
  require("node:vm").runInContext(fs.readFileSync(path.resolve("src/renderer/app/features/media/library.js"), "utf8"), h.dom.getInternalVMContext());
  h.window.openActionEditor({ rule: h.rule, action: h.rule.actions[0], actionIndex: 0 });
  const body = h.form.innerHTML;
  h.dom.window.close();
  window = new BrowserWindow({ show: false, width: 1100, height: 900, useContentSize: true,
    webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true, nodeIntegration: false } });
  await window.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(`<html><head><meta charset="utf-8"><style>${readRendererStyles()}</style></head><body><dialog id="editor-dialog" data-variant="wide" open><form id="editor-form"><header><div><p>ACTION & DÉCLENCHEUR</p><h2>Créer une action</h2></div></header><div id="dialog-body" class="dialog-body">${body}</div><footer><button class="button ghost">Annuler</button><button class="button primary">Enregistrer</button></footer></form></dialog></body></html>`));
  const results = [];
  for (const [width, height] of [[1100,900],[900,850],[600,900],[360,780]]) {
    window.setContentSize(width, height);
    await new Promise(resolve => setTimeout(resolve, 100));
    const bounds = await window.webContents.executeJavaScript(`(()=>{
      const body=document.querySelector('#dialog-body'), list=document.querySelector('[data-action-component-list]'), root=document.querySelector('[data-action-components-editor]');
      return {viewport:innerWidth,body:[body.clientWidth,body.scrollWidth],list:[list.clientWidth,list.scrollWidth],root:[root.clientWidth,root.scrollWidth],groups:root.querySelectorAll('[data-action-type-group]').length};
    })()`);
    fs.writeFileSync(path.join(output, `editor-${width}.png`), (await window.webContents.capturePage()).toPNG());
    for (const name of ["body", "list", "root"]) assert.ok(bounds[name][1] <= bounds[name][0] + 2, JSON.stringify(bounds));
    assert.equal(bounds.groups, 3);
    results.push(bounds);
  }
  window.setContentSize(1100, 900);
  await window.webContents.executeJavaScript(`document.querySelector('[data-action-type-group="overlay.text"]').open=true`);
  await new Promise(resolve => setTimeout(resolve, 100));
  fs.writeFileSync(path.join(output, "editor-text.png"), (await window.webContents.capturePage()).toPNG());
  fs.writeFileSync(path.join(output, "result.json"), JSON.stringify({ ok: true, results }, null, 2));
  clearTimeout(deadline); window.destroy(); app.exit(0);
}).catch(error => {
  fs.writeFileSync(path.join(output, "result.json"), JSON.stringify({ ok: false, error: error.stack }, null, 2));
  clearTimeout(deadline); window?.destroy(); app.exit(1);
});
