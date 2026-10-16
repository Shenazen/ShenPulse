"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "../src/renderer/app");
const imageData = "data:image/png;base64,aGVsbG8="; // Inert synthetic fixture; no image or network is read.
const plain = (value) => JSON.parse(JSON.stringify(value));
const flush = () => new Promise((resolve) => setImmediate(resolve));

function harness(context, { status = { enabled: false }, sources = [{ id: "window:1", name: "TikTok Studio" }], hooks = {} } = {}) {
  const dom = new JSDOM('<dialog><form><div id="body"></div><button type="submit">Activer</button></form></dialog>', { runScripts: "outside-only" });
  context.after(() => dom.window.close());
  const window = dom.window, calls = [], results = [], errors = [], account = { uid: "fixture-owner", authenticated: true };
  window.snapshot = { state: { session: { profileId: "profile-1" }, settings: { tiktok: { username: "creator" } } } };
  window.dialog = window.document.querySelector("dialog"); window.dialogBody = window.document.querySelector("#body");
  window.dialogSubmitButton = window.document.querySelector('[type="submit"]'); window.dialogSessionId = 0;
  window.visibleAccountSession = () => account; window.isAccountAuthenticated = () => account.authenticated;
  window.hasProAccess = () => true; window.canNavigateTo = () => true;
  window.escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  window.showDialogError = (value) => errors.push(value);
  window.creatorMatchesAcceptResult = (value, owner) => { window.assertCreatorMatchesOwner(owner); results.push(value); };
  window.openEditor = (options) => {
    window.editorOptions = options; window.dialogSessionId += 1; window.dialog.open = true;
    window.dialogBody.innerHTML = options.body; window.dialogSubmitButton.textContent = options.submitLabel;
  };
  window.api = { matches: {
    visualStatus: async () => { calls.push({ method: "visualStatus" }); return hooks.visualStatus ? hooks.visualStatus() : status; },
    visualSources: async () => { calls.push({ method: "visualSources" }); return hooks.visualSources ? hooks.visualSources() : sources; },
    visualPreview: async (...args) => { calls.push({ method: "visualPreview", args: plain(args) }); return hooks.visualPreview ? hooks.visualPreview(...args) : { image: imageData }; },
    saveVisual: async (...args) => { calls.push({ method: "saveVisual", args: plain(args) }); return hooks.saveVisual ? hooks.saveVisual(...args) : { status: { fixture: true }, snapshot: window.snapshot }; }
  } };
  const run = (file) => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), dom.getInternalVMContext(), { filename: file });
  run("core/account-operation-guard.js"); run("features/matches/editor.js"); run("features/matches/vision.js");
  const select = (id = "window:1") => {
    const element = window.dialog.querySelector("[data-vision-source]"); element.value = id;
    element.dispatchEvent(new window.Event("change", { bubbles: true }));
  };
  const preview = async () => {
    window.dialog.querySelector("[data-vision-preview]").click(); await flush();
    const image = window.dialog.querySelector("[data-vision-image]");
    Object.defineProperty(image, "complete", { value: true, configurable: true });
    Object.defineProperty(image, "naturalWidth", { value: 1000, configurable: true });
  };
  const draw = (key, first, second) => {
    window.dialog.querySelector(`[data-vision-region="${key}"]`).click();
    const stage = window.dialog.querySelector("[data-vision-stage]");
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500 });
    for (const [type, point] of [["pointerdown", first], ["pointermove", second], ["pointerup", second]]) {
      const event = new window.MouseEvent(type, { button: 0, clientX: point[0], clientY: point[1], bubbles: true });
      Object.defineProperty(event, "pointerId", { value: 1 }); stage.dispatchEvent(event);
    }
  };
  const ready = async () => {
    await window.openCreatorMatchesVisualEditor(); select(); await preview();
    draw("bannerROI", [100, 25], [550, 100]); draw("ownerROI", [50, 350], [250, 400]);
  };
  return { window, account, calls, results, errors, select, preview, draw, ready };
}

test("visual setup: opening is opt-in only and escapes window names, IDs and the own username", async (context) => {
  const f = harness(context, { sources: [{ id: 'window:1" onload="bad()', name: '<img src=x onerror="bad()">' }] });
  f.window.snapshot.state.settings.tiktok.username = '<script>bad()</script>';
  await f.window.openCreatorMatchesVisualEditor();
  assert.deepEqual(f.calls.map((call) => call.method), ["visualStatus", "visualSources"]);
  assert.equal(f.window.dialog.querySelectorAll("img").length, 1); assert.equal(f.window.dialog.querySelector("script"), null);
  assert.equal(f.window.dialog.querySelector("[onload]"), null); assert.equal(f.window.dialog.querySelector("[onerror]"), null);
  assert.equal(f.window.dialog.querySelector("option").nextElementSibling.textContent, '<img src=x onerror="bad()">');
  assert.equal(f.window.dialog.querySelector("[data-vision-image]").hasAttribute("src"), false);
  assert.equal(f.window.dialogSubmitButton.disabled, true);
  assert.match(f.window.dialog.textContent, /aucune image enregistrée ni envoyée/);
  assert.match(f.window.dialog.textContent, /Après chaque redémarrage/);
});

test("visual setup: explicit preview then two normalized rectangles saves only regions and ephemeral source ID", async (context) => {
  const f = harness(context); await f.ready();
  assert.equal(f.window.dialogSubmitButton.disabled, false);
  const previewCall = f.calls.find((call) => call.method === "visualPreview");
  assert.deepEqual(previewCall.args, ["window:1", { ownerUid: "fixture-owner", profileId: "profile-1" }]);
  await f.window.editorOptions.onSubmit();
  const save = f.calls.find((call) => call.method === "saveVisual");
  assert.deepEqual(save.args, [{ enabled: true, sourceId: "window:1",
    bannerROI: { x: 0.1, y: 0.05, width: 0.45000000000000007, height: 0.15000000000000002 },
    ownerROI: { x: 0.05, y: 0.7, width: 0.2, height: 0.10000000000000009 } }, { ownerUid: "fixture-owner", profileId: "profile-1" }]);
  assert.equal(JSON.stringify(save).includes("data:image"), false); assert.equal(f.results.length, 1);
  assert.equal(f.calls.some((call) => /testAutomation|play|effect/i.test(call.method)), false);
});

test("visual setup: rectangle limits, reverse drags and pointer bounds never create full-window regions", async (context) => {
  const f = harness(context); await f.window.openCreatorMatchesVisualEditor(); f.select(); await f.preview();
  f.draw("bannerROI", [0, 0], [1000, 500]); assert.equal(f.window.dialog.querySelector('[data-vision-box="bannerROI"]').hidden, true);
  f.draw("ownerROI", [0, 0], [600, 400]); assert.equal(f.window.dialog.querySelector('[data-vision-box="ownerROI"]').hidden, true);
  assert.equal(f.window.dialogSubmitButton.disabled, true);
  assert.deepEqual(plain(f.window.creatorMatchesVisualRectangle({ x: -1, y: -1 }, { x: 0.2, y: 0.2 }, 0.3)), { x: 0, y: 0, width: 0.2, height: 0.2 });
  assert.deepEqual(plain(f.window.creatorMatchesVisualRectangle({ x: 0.4, y: 0.4 }, { x: 0.2, y: 0.2 }, 0.1)), { x: 0.2, y: 0.2, width: 0.2, height: 0.2 });
  assert.equal(f.window.creatorMatchesVisualRectangle({ x: 0, y: 0 }, { x: 0.001, y: 0.1 }, 0.3), null);
  assert.equal(f.window.creatorMatchesVisualRegion({ x: 0.9, y: 0, width: 0.2, height: 0.1 }, 0.3), null);
  await assert.rejects(f.window.editorOptions.onSubmit(), /tracez les deux zones/);
});

test("visual setup: changing windows or closing discards the old preview and zones", async (context) => {
  const f = harness(context, { sources: [{ id: "window:1", name: "One" }, { id: "window:2", name: "Two" }] }); await f.ready();
  const image = f.window.dialog.querySelector("[data-vision-image]"); assert.equal(image.src, imageData);
  f.select("window:2"); assert.equal(image.hasAttribute("src"), false); assert.equal(f.window.dialogSubmitButton.disabled, true);
  await f.preview(); assert.equal(image.src, imageData);
  f.window.dialog.open = false; f.window.dialog.dispatchEvent(new f.window.Event("close"));
  assert.equal(image.hasAttribute("src"), false);
});

test("visual setup: disabled configuration stops reading without requiring a preview or image in settings", async (context) => {
  const f = harness(context, { status: { enabled: true, active: false } }); await f.window.openCreatorMatchesVisualEditor();
  f.window.dialog.querySelector("[data-vision-disable]").click(); await flush();
  assert.deepEqual(f.calls.find((call) => call.method === "saveVisual").args,
    [{ enabled: false }, { ownerUid: "fixture-owner", profileId: "profile-1" }]);
  assert.equal(f.calls.some((call) => call.method === "visualPreview"), false);
  assert.equal(f.window.dialog.querySelector(".matches-vision-state").textContent, "Désactivée");
});

test("visual setup: read, preview and save results cannot cross account or profile changes", async (context) => {
  let releaseStatus;
  const first = harness(context, { hooks: { visualStatus: () => new Promise((resolve) => { releaseStatus = resolve; }) } });
  const opening = first.window.openCreatorMatchesVisualEditor(); first.account.uid = "other"; releaseStatus({ enabled: false });
  await assert.rejects(opening, /compte a changé/); assert.equal(first.window.editorOptions, undefined);
  let releasePreview;
  const second = harness(context, { hooks: { visualPreview: () => new Promise((resolve) => { releasePreview = resolve; }) } });
  await second.window.openCreatorMatchesVisualEditor(); second.select(); second.window.dialog.querySelector("[data-vision-preview]").click();
  second.window.snapshot.state.session.profileId = "other"; releasePreview({ image: imageData }); await flush();
  assert.equal(second.window.dialog.querySelector("[data-vision-image]").hasAttribute("src"), false);
  let releaseSave;
  const third = harness(context, { hooks: { saveVisual: () => new Promise((resolve) => { releaseSave = resolve; }) } }); await third.ready();
  const saving = third.window.editorOptions.onSubmit(); third.account.uid = "other"; releaseSave({ snapshot: third.window.snapshot });
  await assert.rejects(saving, /compte a changé/); assert.equal(third.results.length, 0);
});

test("visual setup: a replaced dialog ignores late previews and releases the detached image", async (context) => {
  let release;
  const f = harness(context, { hooks: { visualPreview: () => new Promise((resolve) => { release = resolve; }) } });
  await f.window.openCreatorMatchesVisualEditor(); f.select(); f.window.dialog.querySelector("[data-vision-preview]").click();
  const image = f.window.dialog.querySelector("[data-vision-image]");
  f.window.dialogSessionId += 1; f.window.dialogBody.innerHTML = "<p>Another editor</p>";
  release({ image: imageData }); await flush();
  assert.equal(image.hasAttribute("src"), false); assert.equal(f.errors.length, 0);
  assert.match(f.window.dialogBody.textContent, /Another editor/);
});

test("visual setup: remote or malformed previews are never assigned to the image", async (context) => {
  for (const image of ["https://example.invalid/image.png", "file:///private.png", "data:image/svg+xml;base64,AAAA", "data:image/png;base64,invalid<>" ]) {
    const f = harness(context, { hooks: { visualPreview: async () => ({ image }) } });
    await f.window.openCreatorMatchesVisualEditor(); f.select(); await f.preview();
    assert.equal(f.window.dialog.querySelector("[data-vision-image]").hasAttribute("src"), false);
    assert.equal(f.window.dialogSubmitButton.disabled, true); assert.equal(f.errors.length, 1);
  }
});

test("visual setup: entrypoint assets and explicit action route are present", () => {
  const index = fs.readFileSync(path.resolve(root, "../index.html"), "utf8");
  const routes = fs.readFileSync(path.join(root, "actions/handlers/creator-matches.js"), "utf8");
  const editor = fs.readFileSync(path.join(root, "features/matches/editor.js"), "utf8");
  assert.match(index, /app\/features\/matches\/vision\.js/); assert.match(index, /styles\/matches-vision\.css/);
  assert.match(routes, /action === "matches-visual-configure"\) return openCreatorMatchesVisualEditor/);
  assert.match(editor, /data-action="matches-visual-configure"/);
});
