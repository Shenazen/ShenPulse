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
  assert.deepEqual(save.args, [{ enabled: true, initialOnly: true, sourceId: "window:1",
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
  assert.match(routes, /action === "matches-visual-configure"\) return openCreatorMatchesStudioVisualEditor/);
  assert.match(editor, /data-action="matches-visual-configure"/);
});

test("visual setup: Studio self identification is explicit and changing modes requires a new preview and both crops", async (context) => {
  const f = harness(context); await f.ready();
  const mode = f.window.dialog.querySelector("[data-vision-owner-mode]");
  assert.equal(mode.value, "username");
  mode.value = "studio-self"; mode.dispatchEvent(new f.window.Event("change", { bubbles: true }));
  assert.equal(f.window.dialog.querySelector("[data-vision-image]").hasAttribute("src"), false);
  assert.equal(f.window.dialog.querySelector('[data-vision-box="bannerROI"]').hidden, true);
  assert.equal(f.window.dialog.querySelector('[data-vision-box="ownerROI"]').hidden, true);
  assert.equal(f.window.dialogSubmitButton.disabled, true);
  assert.match(f.window.dialog.querySelector("[data-vision-owner-guide]").textContent, /nom de créateur et le libellé « Toi »/);
  await assert.rejects(f.window.editorOptions.onSubmit(), /tracez les deux zones/);
  await f.preview(); f.draw("bannerROI", [100, 25], [550, 100]);
  assert.equal(f.window.dialogSubmitButton.disabled, true);
  f.draw("ownerROI", [50, 350], [250, 400]); await f.window.editorOptions.onSubmit();
  assert.equal(f.calls.find((call) => call.method === "saveVisual").args[0].ownerMode, "studio-self");
  assert.equal(f.calls.filter((call) => call.method === "saveVisual").length, 1);
  assert.equal(f.calls.some((call) => /testAutomation|play|effect/i.test(call.method)), false);
});

test("visual setup: a saved Studio mode reopens honestly and switching back preserves the legacy username contract", async (context) => {
  const f = harness(context, { status: { enabled: true, state: "choose-window", ownerMode: "studio-self" } });
  await f.window.openCreatorMatchesVisualEditor(); f.select(); await f.preview();
  assert.equal(f.window.dialog.querySelector("[data-vision-owner-mode]").value, "studio-self");
  assert.match(f.window.dialog.textContent, /En équipe ou si l’identité est ambiguë/);
  const mode = f.window.dialog.querySelector("[data-vision-owner-mode]");
  mode.value = "username"; mode.dispatchEvent(new f.window.Event("change", { bubbles: true }));
  await f.preview(); f.draw("bannerROI", [100, 25], [550, 100]); f.draw("ownerROI", [50, 350], [250, 400]);
  await f.window.editorOptions.onSubmit();
  assert.equal(Object.hasOwn(f.calls.find((call) => call.method === "saveVisual").args[0], "ownerMode"), false);
});

function changeVisualMode(f, value) {
  const mode = f.window.dialog.querySelector("[data-vision-owner-mode]"); mode.value = value;
  mode.dispatchEvent(new f.window.Event("change", { bubbles: true }));
}

async function prepareOwnScreen(f, position = "left") {
  await f.window.openCreatorMatchesVisualEditor(); f.select(); changeVisualMode(f, "self-screen");
  const choice = f.window.dialog.querySelector("[data-vision-own-position]"); choice.value = position;
  choice.dispatchEvent(new f.window.Event("change", { bubbles: true }));
  await f.preview(); f.draw("bannerROI", [100, 25], [550, 100]);
  return f.window.dialog.querySelector("[data-vision-own-screen-confirmed]");
}

test("visual own screen: no identity crop is required, but a fresh preview, own banner and explicit unchecked consent are mandatory", async (context) => {
  const f = harness(context), confirmation = await prepareOwnScreen(f);
  assert.equal(f.window.dialog.querySelector('[data-vision-region="ownerROI"]').hidden, true);
  assert.equal(f.window.dialog.querySelector('[data-vision-region="ownerROI"]').disabled, true);
  assert.equal(confirmation.checked, false); assert.equal(confirmation.disabled, false);
  assert.equal(f.window.dialogSubmitButton.disabled, true);
  assert.match(f.window.dialog.querySelector("[data-vision-self-settings]").textContent, /identité n’est pas vérifiée par l’image/);
  assert.match(f.window.dialog.querySelector("[data-vision-self-settings]").textContent, /bandeau global ou concernant l’adversaire/);
  await assert.rejects(f.window.editorOptions.onSubmit(), /Confirmez explicitement/);
  assert.equal(f.calls.some(call => call.method === "saveVisual"), false);
  confirmation.click(); assert.equal(f.window.dialogSubmitButton.disabled, false);
  await f.window.editorOptions.onSubmit();
  assert.deepEqual(f.calls.find(call => call.method === "saveVisual").args, [{ enabled: true, initialOnly: true, sourceId: "window:1", ownerMode: "self-screen",
    ownPosition: "left", ownScreenConfirmed: true, ownerROI: null,
    bannerROI: { x: 0.1, y: 0.05, width: 0.45000000000000007, height: 0.15000000000000002 } }, { ownerUid: "fixture-owner", profileId: "profile-1" }]);
  assert.equal(f.calls.some(call => /testAutomation|play|effect/i.test(call.method)), false);
  assert.equal(JSON.stringify(f.calls.find(call => call.method === "saveVisual")).includes("data:image"), false);
});

test("visual own screen: top-left is an explicit position, never an automatically selected rectangle or a restored confirmation", async (context) => {
  const f = harness(context, { status: { enabled: true, ownerMode: "self-screen", ownPosition: "top-left", ownScreenConfirmed: true,
    bannerROI: { x: 0, y: 0, width: 0.2, height: 0.2 } } });
  await f.window.openCreatorMatchesVisualEditor();
  const confirmation = f.window.dialog.querySelector("[data-vision-own-screen-confirmed]");
  assert.equal(f.window.dialog.querySelector("[data-vision-owner-mode]").value, "self-screen");
  assert.equal(f.window.dialog.querySelector("[data-vision-own-position]").value, "top-left");
  assert.equal(confirmation.checked, false); assert.equal(f.window.dialogSubmitButton.disabled, true);
  assert.deepEqual(f.calls.map(call => call.method), ["visualStatus", "visualSources"]);
  assert.equal(f.window.dialog.querySelector("[data-vision-image]").hasAttribute("src"), false);
  f.select(); await f.preview();
  assert.equal(f.window.dialog.querySelector('[data-vision-box="bannerROI"]').hidden, true);
  assert.equal(confirmation.disabled, true);
  f.draw("bannerROI", [100, 25], [550, 100]); confirmation.click();
  assert.match(f.window.dialog.querySelector("[data-vision-own-screen-confirmation-label]").textContent, /en haut à gauche, pas celui de l’adversaire/);
  await f.window.editorOptions.onSubmit();
  assert.equal(f.calls.find(call => call.method === "saveVisual").args[0].ownPosition, "top-left");
  f.window.dialog.open = false; f.window.dialog.dispatchEvent(new f.window.Event("close"));
  assert.equal(confirmation.checked, false);
  await f.window.openCreatorMatchesVisualEditor();
  assert.equal(f.window.dialog.querySelector("[data-vision-own-screen-confirmed]").checked, false);
  assert.equal(f.window.dialogSubmitButton.disabled, true);
});

test("visual own screen: source, mode, position, banner edits and refreshed preview always invalidate consent", async (context) => {
  for (const operation of ["source", "mode", "position", "banner", "preview"]) {
    const f = harness(context, { sources: [{ id: "window:1", name: "One" }, { id: "window:2", name: "Two" }] });
    const confirmation = await prepareOwnScreen(f); confirmation.click();
    assert.equal(confirmation.checked, true);
    if (operation === "source") f.select("window:2");
    if (operation === "mode") changeVisualMode(f, "studio-self");
    if (operation === "position") {
      const position = f.window.dialog.querySelector("[data-vision-own-position]"); position.value = "top-left";
      position.dispatchEvent(new f.window.Event("change", { bubbles: true }));
    }
    if (operation === "banner") f.draw("bannerROI", [120, 25], [550, 100]);
    if (operation === "preview") await f.preview();
    assert.equal(confirmation.checked, false, operation); assert.equal(f.window.dialogSubmitButton.disabled, true, operation);
    await assert.rejects(f.window.editorOptions.onSubmit());
    assert.equal(f.calls.some(call => call.method === "saveVisual"), false, operation);
  }
});

test("visual own screen: an old preview and a backend refusal never become successful activation", async (context) => {
  const old = harness(context), confirmation = await prepareOwnScreen(old); confirmation.click();
  const now = old.window.Date.now(); old.window.Date.now = () => now + 120001;
  await assert.rejects(old.window.editorOptions.onSubmit(), /aperçu est trop ancien/);
  assert.equal(old.calls.some(call => call.method === "saveVisual"), false);
  const refused = harness(context, { hooks: { saveVisual: async () => { throw new Error("OWN_SCREEN_CONFIRMATION_REQUIRED"); } } });
  (await prepareOwnScreen(refused)).click();
  await assert.rejects(refused.window.editorOptions.onSubmit(), /OWN_SCREEN_CONFIRMATION_REQUIRED/);
  assert.equal(refused.results.length, 0);
  assert.equal(refused.window.dialog.querySelector("[data-vision-owner-mode]").disabled, false);
});

test("visual own screen: pending activation disables calibration and cannot apply after a profile change", async (context) => {
  let release;
  const f = harness(context, { hooks: { saveVisual: () => new Promise(resolve => { release = resolve; }) } });
  (await prepareOwnScreen(f)).click(); const pending = f.window.editorOptions.onSubmit();
  assert.equal(f.window.dialog.querySelector("[data-vision-owner-mode]").disabled, true);
  assert.equal(f.window.dialog.querySelector("[data-vision-own-position]").disabled, true);
  assert.equal(f.window.dialog.querySelector("[data-vision-own-screen-confirmed]").disabled, true);
  f.window.snapshot.state.session.profileId = "other"; release({ snapshot: f.window.snapshot });
  await assert.rejects(pending, /profil a changé/); assert.equal(f.results.length, 0);
});

function statusHarness(context, options = {}) {
  const f = harness(context, { status: { enabled: true, active: true, state: "reading", sourceId: "window:1", sourceName: "PRIVATE window title" }, ...options });
  const { window } = f;
  window.currentPage = "matches"; window.creatorMatchesTab = "automations";
  const controls = { visible: true, pro: true, now: 1790000000000 };
  window.Date.now = () => controls.now;
  window.rendererVisualsActive = () => controls.visible; window.hasProAccess = () => controls.pro;
  window.creatorMatchesOwnerKey = () => `${f.account.uid}:${window.snapshot.state.session.profileId}`;
  window.snapshot.state.session.running = true;
  window.snapshot.state.settings.matches = { visualBonus: { enabled: true, bannerROI: { x: 0, y: 0, width: 0.5, height: 0.1 }, ownerROI: { x: 0, y: 0.5, width: 0.5, height: 0.1 } } };
  window.content = window.document.createElement("main"); window.document.body.append(window.content);
  const renderNotice = () => {
    window.content.innerHTML = `<section data-creator-matches-panel data-matches-owner="${window.creatorMatchesOwnerKey()}">${window.creatorMatchesVisualStatusMarkup()}</section>`;
  };
  renderNotice();
  return { ...f, controls, renderNotice, title: () => window.content.querySelector("[data-matches-vision-status-title]")?.textContent,
    sync: () => window.syncCreatorMatchesVisualStatus(), tick: async () => { controls.now += 1000; window.syncCreatorMatchesVisualStatus(); await flush(); } };
}

test("visual notice: disabled and restart-needs-window are visible without a capture, status request or private window title", (context) => {
  const f = statusHarness(context);
  assert.match(f.title(), /Fenêtre à choisir sur ce PC/);
  assert.match(f.window.content.textContent, /Après chaque relance de ShenPulse/);
  f.window.snapshot.state.settings.matches.visualBonus = null; f.renderNotice(); f.sync();
  assert.match(f.title(), /Lecture visuelle désactivée/);
  assert.match(f.window.content.textContent, /sans attendre de cadeau/);
  assert.match(f.window.content.textContent, /uniquement sur téléphone/);
  assert.deepEqual(f.calls, []);
  assert.equal(f.window.content.innerHTML.includes("PRIVATE"), false);
});

test("visual notice: read-only local status updates only its text and displays running, waiting, recovery and failure honestly", async (context) => {
  const f = statusHarness(context), notice = f.window.content.querySelector("[data-matches-vision-status]"), button = notice.querySelector("button");
  f.sync(); await flush(); assert.equal(f.title(), "Lecture visuelle active");
  assert.equal(f.window.content.querySelector("[data-matches-vision-status]"), notice);
  assert.equal(notice.querySelector("button"), button);
  assert.deepEqual(f.calls.map((call) => call.method), ["visualStatus"]);
  assert.equal(f.window.content.innerHTML.includes("PRIVATE window title"), false);
  assert.equal(f.window.content.innerHTML.includes("window:1"), false);
  for (const [state, title] of [["waiting-match", "En attente du LIVE et du match"], ["recovering", "Reconnexion de la lecture locale"],
    ["capture-unavailable", "Lecture visuelle indisponible"], ["ocr-unavailable", "Lecture visuelle indisponible"], ["choose-window", "Fenêtre à choisir sur ce PC"]]) {
    f.window.creatorMatchesAcceptVisualStatus({ enabled: true, active: state === "ocr-unavailable", state, sourceId: "window:1" }, f.window.creatorMatchesCaptureOwner());
    assert.equal(f.title(), title);
  }
  assert.equal(f.calls.some((call) => call.method !== "visualStatus"), false);
});

test("visual notice: stopping the session immediately replaces active with waiting without another IPC", async (context) => {
  const f = statusHarness(context); f.sync(); await flush(); assert.equal(f.title(), "Lecture visuelle active");
  f.window.snapshot.state.session.running = false; await f.tick();
  assert.equal(f.title(), "En attente du LIVE et du match"); assert.equal(f.calls.length, 1);
});

test("visual notice: polling is throttled, single-flight and stops outside the visible authenticated running automation view", async (context) => {
  let release;
  const f = statusHarness(context, { hooks: { visualStatus: () => new Promise((resolve) => { release = resolve; }) } });
  f.sync(); f.sync(); await flush(); f.controls.now += 1000; f.sync();
  assert.equal(f.calls.length, 1);
  release({ enabled: true, active: true, state: "reading", sourceId: "window:1" }); await flush();
  for (const change of [() => { f.window.currentPage = "home"; }, () => { f.window.creatorMatchesTab = "widgets"; },
    () => { f.controls.visible = false; }, () => { f.account.authenticated = false; }, () => { f.controls.pro = false; },
    () => { f.window.snapshot.state.session.running = false; }, () => { f.window.snapshot.state.settings.matches.visualBonus.enabled = false; },
    () => { f.window.content.innerHTML = ""; }]) {
    f.window.currentPage = "matches"; f.window.creatorMatchesTab = "automations"; f.controls.visible = true; f.controls.pro = true;
    f.account.authenticated = true; f.window.snapshot.state.session.running = true; f.window.snapshot.state.settings.matches.visualBonus.enabled = true;
    f.renderNotice(); change(); await f.tick(); assert.equal(f.calls.length, 1);
  }
});

test("visual notice: late status cannot cross account, profile, permission, page, hidden window, stopped session, crop or replaced panel", async (context) => {
  for (const change of [f => { f.account.uid = "other"; }, f => { f.window.snapshot.state.session.profileId = "other"; },
    f => { f.controls.pro = false; }, f => { f.window.currentPage = "home"; }, f => { f.window.creatorMatchesTab = "dashboard"; },
    f => { f.controls.visible = false; }, f => { f.window.snapshot.state.session.running = false; },
    f => { f.window.snapshot.state.settings.matches.visualBonus.ownerROI.x = 0.1; }, f => { f.renderNotice(); }]) {
    let release;
    const f = statusHarness(context, { hooks: { visualStatus: () => new Promise((resolve) => { release = resolve; }) } });
    f.sync(); await flush(); change(f);
    release({ enabled: true, active: true, state: "reading", sourceId: "window:1" }); await flush();
    assert.notEqual(f.title(), "Lecture visuelle active", change.toString());
  }
});

test("visual notice: a new profile can request fresh status without waiting for the old profile's unresolved IPC", async (context) => {
  const pending = [];
  const f = statusHarness(context, { hooks: { visualStatus: () => new Promise((resolve) => pending.push(resolve)) } });
  f.sync(); await flush(); f.window.snapshot.state.session.profileId = "profile-2"; f.renderNotice(); f.sync(); await flush();
  assert.equal(pending.length, 2);
  pending[0]({ enabled: true, active: true, state: "reading", sourceId: "window:1" }); await flush();
  assert.notEqual(f.title(), "Lecture visuelle active");
  pending[1]({ enabled: true, active: false, state: "waiting-match", sourceId: "window:2" }); await flush();
  assert.equal(f.title(), "En attente du LIVE et du match");
});

test("visual notice: a failed local status request shows a generic error and closing before the microtask sends no IPC", async (context) => {
  const first = statusHarness(context, { hooks: { visualStatus: async () => { throw new Error("PRIVATE URL and window title"); } } });
  first.sync(); await flush(); assert.equal(first.title(), "Lecture visuelle indisponible");
  assert.equal(first.window.content.textContent.includes("PRIVATE"), false);
  const second = statusHarness(context); second.sync(); second.window.content.innerHTML = ""; await flush();
  assert.deepEqual(second.calls, []);
});

test("visual own-screen notice: reading remains declared rather than identity-verified and layout changes require new confirmation", async (context) => {
  const f = statusHarness(context); f.window.snapshot.state.settings.matches.visualBonus.ownerMode = "self-screen";
  f.window.snapshot.state.settings.matches.visualBonus.ownerROI = null; f.renderNotice();
  assert.match(f.window.content.textContent, /confirmation n’est jamais restaurée/);
  f.sync(); await flush(); assert.equal(f.title(), "Lecture active — zone déclarée par vous");
  assert.match(f.window.content.textContent, /identité n’est pas vérifiée par l’image/);
  assert.match(f.window.content.textContent, /bandeau global ou adverse peut être ambigu/);
  f.window.creatorMatchesAcceptVisualStatus({ enabled: true, active: false, state: "layout-changed", sourceId: "window:1" }, f.window.creatorMatchesCaptureOwner());
  assert.equal(f.title(), "Disposition modifiée : confirmation requise");
  assert.match(f.window.content.textContent, /nouvel aperçu/);
  f.window.creatorMatchesAcceptVisualStatus({ enabled: true, active: false, state: "confirmation-required", sourceId: "window:1" }, f.window.creatorMatchesCaptureOwner());
  assert.equal(f.title(), "Zone à confirmer à nouveau");
  assert.match(f.window.content.textContent, /LIVE, le compte ou le calibrage a changé/);
  assert.match(f.window.content.textContent, /nouvel aperçu et une nouvelle confirmation/);
  assert.equal(f.window.content.textContent.includes("La disposition du match a changé"), false);
  assert.equal(f.calls.some(call => call.method !== "visualStatus"), false);
});

test("first-only notice distinguishes stopped capture from active native detection and clears on session stop", async (context) => {
  for (const [state, title] of [["initial-complete", "Premier bonus confirmé · lecture arrêtée"], ["native-bonus", "Détection TikTok prioritaire"]]) {
    const f = statusHarness(context); f.window.snapshot.state.settings.matches.visualBonus.initialOnly = true; f.renderNotice();
    f.window.creatorMatchesAcceptVisualStatus({ enabled: true, active: false, state, sourceId: "window:1" }, f.window.creatorMatchesCaptureOwner());
    assert.equal(f.title(), title);
    assert.match(f.window.content.textContent, /second bonus/);
    assert.match(f.window.content.textContent, /snipe/);
    f.window.snapshot.state.session.running = false; f.window.creatorMatchesPaintVisualStatus();
    assert.equal(f.title(), "En attente du LIVE et du match");
    assert.equal(f.calls.length, 0, "status rendering cannot start capture or media");
  }
});

test("Studio setup auto-selects Studio, has no username, side or identity fields, and confirms only one crop on activation", async (context) => {
  const f=harness(context,{sources:[{id:"window:7",name:"TikTok LIVE Studio"},{id:"window:9",name:"Private browser"}]});
  await f.window.openCreatorMatchesStudioVisualEditor();
  const style = f.window.document.createElement("style");
  style.textContent = ".field { display: grid; }\\n" + fs.readFileSync(path.resolve(root, "../styles/matches-vision.css"), "utf8");
  f.window.document.head.append(style);
  assert.equal(f.window.getComputedStyle(f.window.dialog.querySelector("[data-studio-source-field]")).display, "none");
  assert.equal(f.window.dialog.querySelector("[data-vision-source]"),null);
  assert.equal(f.window.dialog.querySelector("[data-vision-owner-mode]"),null);
  assert.equal(f.window.dialog.querySelector("[data-vision-own-position]"),null);
  assert.equal(f.window.dialog.querySelector("[data-vision-own-screen-confirmed]"),null);
  assert.equal(f.window.dialog.querySelector('[data-vision-region="ownerROI"]'),null);
  await f.preview();f.draw("bannerROI",[100,25],[550,100]);
  assert.equal(f.window.dialogSubmitButton.disabled,false);await f.window.editorOptions.onSubmit();
  const saved=f.calls.find(call=>call.method==="saveVisual").args[0];
  assert.equal(saved.sourceId,"window:7");assert.equal(saved.ownerMode,"studio-banner");assert.equal(saved.initialOnly,true);
  assert.equal(saved.ownerROI,null);assert.equal("ownPosition" in saved,false);
  assert.equal(JSON.stringify(saved).includes("creator"),false);
  assert.equal(f.calls.some(call=>/testAutomation|play|effect/i.test(call.method)),false);
});

test("Studio setup never silently substitutes a browser when Studio is closed", async(context)=>{
 const f=harness(context,{sources:[{id:"window:9",name:"TikTok LIVE in Brave"}]});
 await f.window.openCreatorMatchesStudioVisualEditor();
 assert.equal(f.window.dialogSubmitButton.disabled,true);assert.match(f.window.dialog.textContent,/Ouvrez TikTok LIVE Studio/);
 assert.equal(f.calls.some(call=>call.method==="visualPreview"),false);
});
