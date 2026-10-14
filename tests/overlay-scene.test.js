"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const vm = require("node:vm");
const { JSDOM, VirtualConsole } = require("jsdom");
const os = require("node:os");
const { StateStore } = require("../src/main/store");
const { createDefaultState } = require("../src/main/defaults");
const layout = require("../resources/overlays/scene-layout");
const catalog = require("../resources/overlays/overlay-catalog");
const { OverlayServer } = require("../src/main/overlay-server");
const { createRelayState, publicOverlayUrls } = require("../src/shared/public-overlay-protocol");

function availablePort() {
  return new Promise((resolve) => {
    const socket = net.createServer();
    socket.listen(0, "127.0.0.1", () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

/**
 * Le rendu actif précède les scripts chargés dynamiquement. Une fermeture à
 * cette étape laisse JSDOM exécuter leur file sur une fenêtre déjà détruite.
 * Attendre le vrai chargeur (parent et enfants) garde aussi leurs erreurs dans
 * le test, au lieu de les reporter dans un test ultérieur de la suite.
 */
async function waitForSceneRuntime(window, label) {
  const deadline = Date.now() + 8000;
  while (
    window.document.readyState !== "complete" ||
    !Number.isFinite(window.shenPulseOverlayPerformance?.modulesReadyAt)
  ) {
    if (Date.now() >= deadline) throw new Error(`${label} did not finish loading`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

test("scene composition validates sizes and routes, keeps no arbitrary sources or credentials", () => {
  const scene = layout.normalizeScene({ width: -1, height: 99999, widgets: [
    { id: "valid", key: "likeGoal", x: -40, y: 90000, width: Infinity, height: 4,
      url: "https://untrusted.test", token: "private" },
    { id: "valid", key: "timer" }, { key: "matchPlayer" }, { key: "unknown" }
  ] });
  assert.equal(scene.width, 360);
  assert.equal(scene.height, 3840);
  assert.equal(scene.widgets.length, 1);
  assert.equal(scene.widgets[0].x, 0);
  assert.equal(scene.widgets[0].y, 3820);
  assert.equal(scene.widgets[0].height, 80);
  assert.doesNotMatch(JSON.stringify(scene), /untrusted|private/);
  const first = layout.createDefaultScene();
  first.widgets[0].x = 10000;
  assert.equal(layout.createDefaultScene().widgets[0].x, 40);
  assert.equal(layout.normalizeScene({ widgets: [{ id: "audio-a", key: "alerts", screen: 1 },
    { id: "audio-b", key: "alerts", screen: 1 }] }).widgets.length, 1,
  "one playback surface per audio screen prevents duplicate speech");
});

test("scene composition follows the profile and survives application reload", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-scene-profile-"));
  try {
    const store = new StateStore(directory, { isEncryptionAvailable: () => false });
    store.load();
    store.activateAccount("scene-owner");
    store.set("settings.account", { uid: "scene-owner", email: "scene@example.test" });
    const initialProfile = store.getState().session.profileId;
    store.set("settings.overlayScene", { ...layout.createDefaultScene(), name: "Portrait perso" });
    store.upsert("profiles", { id: "scene-other-profile", name: "Autre scène" });
    store.selectProfile("scene-other-profile");
    store.set("settings.overlayScene", { ...layout.createDefaultScene("landscape"), name: "Paysage perso" });
    store.selectProfile(initialProfile);
    assert.equal(store.getState().settings.overlayScene.name, "Portrait perso");
    store.flush();
    const reopened = new StateStore(directory, { isEncryptionAvailable: () => false });
    reopened.load();
    reopened.activateAccount("scene-owner");
    assert.equal(reopened.getState().settings.overlayScene.name, "Portrait perso");
    reopened.selectProfile("scene-other-profile");
    assert.equal(reopened.getState().settings.overlayScene.width, 1920);
    assert.equal(reopened.getState().settings.overlayScene.name, "Paysage perso");
    reopened.flush();
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("local and public scene URLs share routing and public state filters Pro widgets", () => {
  const local = catalog.buildUrls({ baseUrl: "http://127.0.0.1:17654",
    credentialName: "token", credentialValue: "local-secret", proAccess: false });
  const publicUrls = publicOverlayUrls({ channelId: "public-channel", proAccess: false });
  assert.equal(new URL(local.scene).searchParams.get("view"), "scene");
  assert.equal(new URL(publicUrls.scene).searchParams.get("view"), "scene");
  assert.doesNotMatch(publicUrls.scene, /token|127\.0\.0\.1/);
  const state = { settings: { overlayToken: "local-secret", overlayScene: {
    ...layout.createDefaultScene(), widgets: [{ id: "free", key: "likeGoal" },
      { id: "paid", key: "winCounter" }] } }, commerce: { subscription: {
    tier: "pro", status: "trial", source: "trial", expiresAtMs: Date.now() - 1000
  } } };
  assert.deepEqual(createRelayState(state).overlayScene.widgets.map(({ key }) => key), ["likeGoal"]);
  state.commerce.subscription = { tier: "pro", status: "active", source: "paid" };
  assert.equal(createRelayState(state).overlayScene.widgets.length, 2);
  assert.doesNotMatch(JSON.stringify(createRelayState(state)), /local-secret/);
  assert.equal(layout.acceptsSceneChannel("win-counter", false), false);
  assert.equal(layout.acceptsSceneChannel("win-counter", true), true);
  assert.equal(layout.acceptsSceneChannel("match", true), false);
});

test("the scene editor edits coordinates, saves only the composition and copies the usable local URL", async (t) => {
  const dom = new JSDOM('<main id="content"></main>', { pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const state = createDefaultState();
  state.settings.account = { uid: "scene-test", email: "scene@test.example" };
  const saved = [];
  const copied = [];
  const context = vm.createContext({ window: dom.window, document: dom.window.document,
    content: dom.window.document.getElementById("content"), ShenPulseSceneLayout: layout,
    overlayCatalog: catalog, URL, snapshot: { state, localOverlayUrls: {
      scene: "http://127.0.0.1:17654/overlay/?view=scene&token=secret" } },
    isAccountAuthenticated: () => true, hasProAccess: () => false, canAccessOverlay: () => true,
    overlayConfig: (key) => catalog.defaultConfig(key), cryptoId: () => "new-timer",
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    escapeHtml: (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;"),
    toast: () => {}, perform: async (operation) => operation(),
    api: { copy: async (url) => copied.push(url), saveSettings: async (settings) => {
      saved.push(settings); state.settings = { ...state.settings, ...settings };
      return { state, localOverlayUrls: context.snapshot.localOverlayUrls };
    } }
  });
  context.acceptSnapshot = (snapshot) => { context.snapshot = snapshot; };
  const rendererDirectory = path.join(__dirname, "../src/renderer/app");
  vm.runInContext([
    fs.readFileSync(path.join(rendererDirectory, "features/overlays/scene.js"), "utf8"),
    fs.readFileSync(path.join(rendererDirectory, "actions/handlers/contracts.js"), "utf8"),
    fs.readFileSync(path.join(rendererDirectory, "actions/scene.js"), "utf8"),
    "globalThis.sceneAction = ACTION_HANDLERS[0];"
  ].join("\n"), context);
  context.render = () => {
    context.content.innerHTML = context.renderSceneComposer();
    context.bindSceneComposer();
  };
  context.render();
  assert.match(context.content.textContent, /publication nécessaire/);
  context.content.querySelector("[data-scene-add-key]").value = "timer";
  await context.sceneAction({ action: "scene-add", target: { dataset: {} } });
  assert.equal(context.content.querySelectorAll(".scene-layer").length, 4);
  const input = context.content.querySelector('[data-scene-field="x"]');
  input.value = "210";
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await context.sceneAction({ action: "scene-save", target: { dataset: {} } });
  assert.deepEqual(Object.keys(saved[0]), ["overlayScene"]);
  assert.equal(saved[0].overlayScene.widgets.at(-1).x, 210);
  assert.equal(saved[0].overlayScene.widgets.at(-1).key, "timer");
  await context.sceneAction({ action: "scene-copy", target: { dataset: { delivery: "local" } } });
  assert.equal(copied[0], context.snapshot.localOverlayUrls.scene);
});

test("scene browser runtime reuses iframe widgets, hydrates their state and removes revoked layers", () => {
  const dom = new JSDOM('<div id="scene-canvas"></div>', {
    url: "https://overlay.test/?view=scene&channel=public-channel", runScripts: "outside-only"
  });
  const window = dom.window;
  window.ShenPulseSceneLayout = layout;
  window.ShenPulseOverlayCatalog = catalog;
  window.eval(fs.readFileSync(path.join(__dirname, "../resources/overlays/runtime/scene.js"), "utf8") +
    "\nglobalThis.sceneTestApi = { hydrateSceneState, hydrateScene, sceneWidgetConfiguration }; ");
  const wheel = window.sceneTestApi.sceneWidgetConfiguration("wheel", {
    choices: ["Previous"], selectedWheelId: "selected", wheels: [{ id: "selected", design: "royal",
      settings: { spinDuration: 11 }, segments: [{ label: "Alpha", color: "#ff0000" },
        { label: "Beta", color: "#0000ff" }] }]
  });
  assert.equal(wheel.choices, "Alpha|Beta");
  assert.equal(wheel.design, "royal");
  assert.equal(wheel.spinDuration, 11);
  const invalidConfig = window.sceneTestApi.sceneWidgetConfiguration("likeGoal", {
    title: "Allowed", view: "scene", token: "overwritten", embedded: "none", channel: "other"
  });
  assert.deepEqual(Object.keys(invalidConfig), ["title"]);
  window.sceneTestApi.hydrateSceneState({ overlayScene: { ...layout.createDefaultScene(), proAccess: true,
    widgets: [{ id: "counter", key: "winCounter", x: 20, y: 100, width: 400, height: 300 },
      { id: "likes", key: "likeGoal", x: 50, y: 30, width: 800, height: 160 }] },
    overlaySession: { likeGoalCurrent: 12 }, configurations: { likeGoal: { title: "LIVE TEST" } }
  });
  let frames = window.document.querySelectorAll("iframe");
  assert.equal(frames.length, 2);
  assert.equal(new URL(frames[1].src).searchParams.get("embedded"), "scene");
  assert.equal(new URL(frames[1].src).searchParams.get("title"), "LIVE TEST");
  assert.equal(new URL(frames[1].src).searchParams.has("preview"), false);
  const delivered = [];
  frames[1].contentWindow.postMessage = (message) => delivered.push(message);
  window.dispatchEvent(new window.MessageEvent("message", { source: frames[1].contentWindow,
    origin: "https://overlay.test", data: { source: "shenpulse-overlay-runtime", type: "ready" } }));
  assert.equal(delivered.at(-1).channel, "bootstrap");
  assert.equal(delivered.at(-1).payload.overlaySession.likeGoalCurrent, 12);
  const keptFrame = frames[1];
  window.sceneTestApi.hydrateScene({ ...layout.createDefaultScene(), proAccess: false,
    widgets: [{ id: "counter", key: "winCounter" }, { id: "likes", key: "likeGoal", x: 80 }] });
  frames = window.document.querySelectorAll("iframe");
  assert.equal(frames.length, 1);
  assert.equal(frames[0], keptFrame);
  assert.equal(frames[0].style.left, "80px");
  window.close();
});

test("scene local source protects credentials, shares one stream and revokes only paid layers", async () => {
  const overlayPort = await availablePort();
  const apiPort = await availablePort();
  const state = { settings: { overlayPort, apiPort, overlayToken: "scene-secret", apiToken: "api-secret",
    overlayScene: { ...layout.createDefaultScene(), widgets: [{ id: "likes", key: "likeGoal" },
      { id: "wins", key: "winCounter" }] }, overlayConfigs: { likeGoal: { title: "MY LIVE" } } },
    commerce: { subscription: { tier: "pro", status: "active" } }, session: {}, goals: [], statistics: {} };
  const server = new OverlayServer({ store: { getState: () => structuredClone(state) },
    staticDirectory: path.join(__dirname, "../resources/overlays"), onInboundEvent: async () => {}, onEffectRequest: async () => {} });
  try {
    await server.start();
    const url = server.urls().scene;
    assert.equal((await fetch(url.replace("scene-secret", "wrong"))).status, 401);
    const page = await fetch(url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /scene-canvas/);
    const errors = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("jsdomError", (error) => errors.push(error.message));
    const dom = await JSDOM.fromURL(`${url}&preview=static`, {
      runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole,
      beforeParse(window) {
        window.HTMLCanvasElement.prototype.getContext = () => ({ fillRect() {} });
        window.HTMLMediaElement.prototype.load = () => {};
        window.HTMLMediaElement.prototype.pause = () => {};
        window.HTMLMediaElement.prototype.play = async () => {};
      }
    });
    try {
      await waitForSceneRuntime(dom.window, "scene module loader");
      const view = dom.window.document.getElementById("scene-view");
      assert.equal(view.classList.contains("active"), true);
      assert.equal(view.classList.contains("native-overlay-canvas"), false,
        "the scene controls its own portrait canvas rather than applying the old landscape scaling twice");
      dom.window.dispatchEvent(new dom.window.MessageEvent("message", { source: dom.window,
        data: { source: "shenpulse-overlay-card", channel: "scene", payload: {
          ...layout.createDefaultScene(), widgets: [{ id: "test-likes", key: "likeGoal", x: 20,
            y: 30, width: 1000, height: 160 }], proAccess: false } } }));
      assert.equal(dom.window.document.querySelectorAll("#scene-canvas iframe").length, 1);
      const child = dom.window.document.querySelector("#scene-canvas iframe");
      await waitForSceneRuntime(child.contentWindow, "embedded Like Goal loader");
      assert.equal(child.contentDocument.getElementById("like-goal-view").classList.contains("active"), true,
        "the real embedded widget must initialise before its window is closed");
      assert.equal(new URL(child.src).searchParams.get("embedded"), "scene");
      assert.equal(new URL(child.src).searchParams.get("token"), "scene-secret");
      assert.deepEqual(errors, [], "the real scene loader must execute without DOM errors");
    } finally { dom.window.close(); }
    const response = await fetch(`http://127.0.0.1:${overlayPort}/events?view=scene&token=scene-secret`);
    const reader = response.body.getReader();
    const boot = new TextDecoder().decode((await reader.read()).value);
    assert.match(boot, /"key":"winCounter"/);
    assert.match(boot, /MY LIVE/);
    assert.equal(server.sseClients.size, 1);
    server.publish("like-goal", { operation: "add", amount: 10 });
    assert.match(new TextDecoder().decode((await reader.read()).value), /event: like-goal/);
    state.commerce.subscription.status = "revoked";
    server.refreshAccess();
    const revoked = new TextDecoder().decode((await reader.read()).value);
    assert.match(revoked, /event: scene/);
    assert.doesNotMatch(revoked, /winCounter/);
    assert.equal(server.sseClients.size, 1);
    await reader.cancel();
  } finally { await server.stop(); }
});
