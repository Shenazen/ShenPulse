"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { actionEditorFixture } = require("./helpers/action-editor-fixture");

test("Tester prend les tailles du brouillon et l’écran choisi, sans sauvegarder ni tester le média", async t => {
  const h = actionEditorFixture(t, { actions: [
    { id: "media", type: "overlay.media", config: { mediaUrl: "https://example.test/a.gif", screen: 1 } },
    { id: "viewer", type: "overlay.text", config: { alert: { enabled: true, message: "Merci {username}", screen: 2 } } }
  ] });
  const requests = [];
  h.window.api.testAction = async action => { requests.push(action); return { displayed: true }; };
  const panel = h.parts().find(node => node.querySelector('[name="actionType"]').value === "overlay.text");
  panel.querySelector('[name="alertFontSize"]').value = "106";
  panel.querySelector('[name="alertStrokeWidth"]').value = "0";
  await h.window.editorOptions.onTest();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].type, "overlay.text");
  assert.equal(requests[0].config.previewScope, undefined);
  assert.equal(requests[0].config.alert.fontSize, 106);
  assert.equal(requests[0].config.alert.strokeWidth, 0);
  assert.equal(requests[0].config.alert.screen, 2);
  assert.equal(h.calls.length, 0);
  assert.equal(h.rule.actions[1].config.alert.fontSize, undefined);
  assert.equal(panel.querySelector("iframe"), null);
  assert.equal(panel.querySelector("[data-viewer-draft-preview]"), null);
});

test("le bouton Tester reste dans le pied de popup, ne soumet rien et protège du double clic", async t => {
  const dom = new JSDOM('<dialog><form><h2 id="title"></h2><p id="kicker"></p><div id="body"></div><footer><div id="error"></div><div class="dialog-actions"><button type="button">Annuler</button><button id="submit" type="submit">Enregistrer</button></div></footer></form></dialog>', { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document;
  Object.assign(w, { dialog: d.querySelector("dialog"), dialogForm: d.querySelector("form"), dialogBody: d.querySelector("#body"), dialogTitle: d.querySelector("#title"), dialogKicker: d.querySelector("#kicker"), dialogError: d.querySelector("#error"), dialogSubmitButton: d.querySelector("#submit"), dialogSessionId: 0,
    requestAnimationFrame: () => {}, syncActionEditorVisibility: () => {}, bindOverlayRuntimeFrames: () => {} });
  w.dialog.showModal = () => w.dialog.setAttribute("open", "");
  vm.runInContext(fs.readFileSync("src/renderer/app/editors/core.js", "utf8"), dom.getInternalVMContext());
  let tests = 0, saves = 0, release;
  w.openEditor({ title: "Viewer", body: "", onSubmit: () => saves++, onTest: () => { tests++; return new Promise(resolve => { release = resolve; }); } });
  const button = d.querySelector("[data-dialog-test]");
  assert.equal(button.closest("footer") != null, true);
  assert.equal(button.type, "button");
  button.click(); button.click();
  assert.equal(tests, 1); assert.equal(saves, 0); assert.equal(button.disabled, true);
  release(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(button.disabled, false);
  w.openEditor({ title: "Autre popup", body: "", onSubmit: () => saves++ });
  assert.equal(d.querySelector("[data-dialog-test]"), null);
});
