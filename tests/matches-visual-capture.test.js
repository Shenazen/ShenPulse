"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createVisualCapture, normalizeCaptureROI, pngBytes } = require("../src/main/matches/visual-capture");

const settle = () => new Promise(setImmediate);
const ROI = { x: 0.1, y: 0.1, width: 0.6, height: 0.1 };
const OWNER = { x: 0.1, y: 0.4, width: 0.3, height: 0.1 };
function png(width = 10, height = 10) {
  const bytes = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.write("IHDR", 12); bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}
function fixture(onFrame = () => {}) {
  const handlers = new Map(), windows = [], enumerations = [], statuses = [];
  const controls = { onExecute: null };
  const sources = [{ id: "window:42:0", name: "TikTok LIVE Studio", thumbnail: "not-read" }, { id: "screen:0:0", name: "Screen" }];
  class FakeWindow extends EventEmitter {
    constructor(options) {
      super(); this.options = options; this.destroyed = false; windows.push(this);
      const session = new EventEmitter();
      session.webRequest = { onBeforeRequest: (callback) => { session.beforeRequest = callback; } };
      session.setDisplayMediaRequestHandler = (callback) => { session.display = callback; };
      session.setPermissionRequestHandler = (callback) => { session.permissionRequest = callback; };
      session.setPermissionCheckHandler = (callback) => { session.permissionCheck = callback; };
      const contents = new EventEmitter(); this.webContents = contents;
      Object.assign(contents, { session, mainFrame: { url: "" }, getURL: () => this.url,
        isDestroyed: () => this.destroyed, setAudioMuted: (value) => { this.audioMuted = value; },
        setWindowOpenHandler: (callback) => { this.openHandler = callback; }, send: () => {},
        executeJavaScript: async (source, gesture) => { this.command = JSON.parse(source.slice(source.indexOf("(") + 1, -1)); this.gesture = gesture;
          if (controls.onExecute) await controls.onExecute(this); return true; } });
    }
    async loadFile(filename) { this.url = pathToFileURL(filename).href; this.webContents.mainFrame.url = this.url; }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; this.emit("closed"); }
  }
  const capture = createVisualCapture({ BrowserWindow: FakeWindow,
    desktopCapturer: { getSources: async (options) => { enumerations.push(options); return sources; } },
    ipcMain: { handle: (channel, callback) => { assert.equal(handlers.has(channel), false); handlers.set(channel, callback); }, removeHandler: (channel) => handlers.delete(channel) },
    onFrame, onStatus: (status) => statuses.push(status) });
  const event = (window) => ({ sender: window.webContents, senderFrame: window.webContents.mainFrame });
  const handler = (suffix) => [...handlers].find(([channel]) => channel.endsWith(suffix))?.[1];
  const send = (window, changes = {}, sender = event(window)) => handler(":frame")(sender, {
    token: window.command.token, mode: "monitor", banner: png(), owner: png(), capturedAtMs: Date.now(), ...changes
  });
  return { capture, windows, handlers, enumerations, statuses, sources, event, handler, send, controls };
}

test("capture lists only window names and IDs without collecting thumbnails or icons", async () => {
  const f = fixture();
  assert.deepEqual(await f.capture.listSources(), [{ id: "window:42:0", name: "TikTok LIVE Studio" }]);
  assert.deepEqual(f.enumerations[0], { types: ["window"], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false });
  assert.equal(f.windows.length, 0);
});

test("capture rejects screens, stale IDs and broad or malformed monitoring regions before creating a page", async () => {
  const f = fixture();
  for (const input of [{ sourceId: "screen:0:0" }, { sourceId: "window:99:0", bannerROI: ROI, ownerROI: OWNER },
    { sourceId: "window:42:0", bannerROI: { x: 0, y: 0, width: 1, height: 1 }, ownerROI: OWNER },
    { sourceId: "window:42:0", bannerROI: ROI, ownerROI: { ...OWNER, x: "0.1" } }]) {
    await assert.rejects(f.capture.start(input));
  }
  assert.equal(f.windows.length, 0);
  assert.deepEqual(normalizeCaptureROI(ROI, 0.3), ROI);
  assert.throws(() => normalizeCaptureROI({ ...ROI, x: 0.8 }, 0.3));
});

test("capture page is sandboxed, network-denied, private, muted and can receive only its selected video window", async () => {
  const f = fixture();
  let selected;
  f.controls.onExecute = (window) => window.webContents.session.display({ frame: window.webContents.mainFrame, videoRequested: true, audioRequested: false }, (value) => { selected = value; });
  await f.capture.start({ sourceId: "window:42:0", bannerROI: ROI, ownerROI: OWNER });
  const window = f.windows[0], contents = window.webContents, session = contents.session;
  assert.equal(window.options.show, false); assert.equal(window.options.webPreferences.sandbox, true);
  assert.equal(window.options.webPreferences.contextIsolation, true); assert.equal(window.options.webPreferences.nodeIntegration, false);
  assert.equal(window.options.webPreferences.partition.startsWith("persist:"), false); assert.equal(window.audioMuted, true); assert.equal(window.gesture, true);
  assert.deepEqual(window.openHandler({ url: "https://example.test" }), { action: "deny" });
  for (const url of ["https://example.test", "http://127.0.0.1:1234", "file:///C:/private.txt", "wss://example.test", "data:text/html,leak"]) {
    session.beforeRequest({ url }, (result) => assert.equal(result.cancel, true));
  }
  session.beforeRequest({ url: window.url }, (result) => assert.equal(result.cancel, false));
  assert.equal(selected.video.id, "window:42:0"); assert.equal(Object.hasOwn(selected, "audio"), false);
  session.display({ frame: contents.mainFrame, videoRequested: true, audioRequested: false }, (value) => assert.equal(value, null));
  session.display({ frame: {}, videoRequested: true, audioRequested: true }, (value) => assert.equal(value, null));
  assert.equal(session.permissionCheck(contents, "media"), false);
  await f.capture.stop(); assert.equal(window.destroyed, true); assert.equal(f.handlers.size, 0); assert.equal(session.display, null);
});

test("only one exact private desktop start permits empty-types media; camera, mic, child frames and foreign documents stay denied", async () => {
  const f = fixture(); let desktopAllowed = false;
  f.controls.onExecute = (window) => {
    const contents = window.webContents, session = contents.session;
    const details = { isMainFrame: true, requestingUrl: window.url, mediaTypes: [] };
    const ask = (permission, changed = {}, requester = contents) => {
      let accepted; session.permissionRequest(requester, permission, (value) => { accepted = value; }, { ...details, ...changed }); return accepted;
    };
    for (const mediaTypes of [["video"], ["audio"], ["video", "audio"], undefined]) assert.equal(ask("media", { mediaTypes }), false);
    assert.equal(ask("media", { isMainFrame: false }), false); assert.equal(ask("media", {}, {}), false);
    assert.equal(ask("media", { requestingUrl: window.url + "#foreign" }), false); assert.equal(ask("notifications"), false);
    desktopAllowed = ask("media"); assert.equal(desktopAllowed, true); assert.equal(ask("media"), false);
    session.display({ frame: contents.mainFrame, videoRequested: true, audioRequested: true }, (value) => assert.equal(value, null));
    session.display({ frame: contents.mainFrame, videoRequested: true, audioRequested: false }, (value) => assert.equal(value.video.id, "window:42:0"));
  };
  await f.capture.start({ sourceId: "window:42:0", bannerROI: ROI, ownerROI: OWNER });
  assert.equal(desktopAllowed, true);
  const window = f.windows[0];
  window.webContents.session.permissionRequest(window.webContents, "media", (value) => assert.equal(value, false), { isMainFrame: true, requestingUrl: window.url, mediaTypes: [] });
  await f.capture.stop();
});

test("capture rejects untrusted windows, child frames, URL changes, wrong tokens and stale frame timestamps", async () => {
  let calls = 0; const f = fixture(() => { calls += 1; });
  await f.capture.start({ sourceId: "window:42:0", bannerROI: ROI, ownerROI: OWNER });
  const window = f.windows[0];
  for (const event of [{ sender: {}, senderFrame: window.webContents.mainFrame }, { sender: window.webContents, senderFrame: { url: window.url } }]) {
    assert.equal((await f.send(window, {}, event)).accepted, false);
  }
  assert.equal((await f.send(window, { token: "wrong" })).accepted, false);
  assert.equal((await f.send(window, { capturedAtMs: Date.now() - 6000 })).accepted, false);
  window.webContents.mainFrame.url += "#other";
  assert.equal((await f.send(window)).accepted, false);
  assert.equal(calls, 0); await f.capture.stop();
});

test("one in-memory cropped pair stays in flight until OCR ACK then buffers are erased", async () => {
  let release, borrowed, calls = 0;
  const f = fixture(async (frame) => { calls += 1; borrowed = frame; await new Promise((resolve) => { release = resolve; }); });
  await f.capture.start({ sourceId: "window:42:0", bannerROI: ROI, ownerROI: OWNER });
  const window = f.windows[0], first = f.send(window);
  await settle(); assert.equal(calls, 1); assert.equal(Buffer.isBuffer(borrowed.banner), true); assert.equal(borrowed.banner[0], 137);
  assert.equal((await f.send(window)).accepted, false); assert.equal(calls, 1);
  release(); assert.equal((await first).accepted, true); assert.equal(borrowed.banner.every((byte) => byte === 0), true);
  assert.equal(borrowed.owner.every((byte) => byte === 0), true); await f.capture.stop();
});

test("own-screen capture requires explicit transient confirmation and still rejects a missing banner", async () => {
  const f = fixture();
  const options = { sourceId: "window:42:0", ownerMode: "self-screen", ownerROI: null, bannerROI: ROI };
  for (const ownScreenConfirmed of [undefined, false, "true", 1]) {
    await assert.rejects(f.capture.start({ ...options, ownScreenConfirmed }));
  }
  await assert.rejects(f.capture.start({ ...options, ownScreenConfirmed: true, bannerROI: null }));
  assert.equal(f.windows.length, 0);
});

test("own-screen mode passes and erases one banner only without accepting an unsolicited owner image", async () => {
  let borrowed, calls = 0;
  const f = fixture((frame) => { calls += 1; borrowed = frame; });
  const options = { sourceId: "window:42:0", ownerMode: "self-screen", ownScreenConfirmed: true, ownerROI: null, bannerROI: ROI };
  await f.capture.start(options);
  const window = f.windows[0];
  assert.equal(window.command.ownerMode, "self-screen");
  assert.equal(window.command.ownerROI, null);
  assert.equal(Object.hasOwn(window.command, "ownScreenConfirmed"), false);
  assert.equal((await f.send(window, { owner: null })).accepted, true);
  assert.equal(calls, 1);
  assert.equal(borrowed.owner, undefined);
  assert.equal(borrowed.banner.every((byte) => byte === 0), true);
  assert.equal((await f.send(window)).accepted, false);
  assert.equal(calls, 1);
  await f.capture.stop();
});

test("stop invalidates pending ACK and old-generation IPC without restarting capture", async () => {
  let release; const f = fixture(() => new Promise((resolve) => { release = resolve; }));
  await f.capture.start({ sourceId: "window:42:0", bannerROI: ROI, ownerROI: OWNER });
  const old = f.windows[0], oldHandler = f.handler(":frame"), pending = f.send(old);
  await settle(); await f.capture.stop(); release(); assert.equal((await pending).accepted, false);
  await f.capture.start({ sourceId: "window:42:0", bannerROI: ROI, ownerROI: OWNER });
  assert.equal((await oldHandler(f.event(old), { token: old.command.token, mode: "monitor" })).accepted, false);
  await f.capture.stop();
});

test("concurrent start calls cannot create two capture windows or reuse an earlier generation", async () => {
  const f = fixture(), options = { sourceId: "window:42:0", bannerROI: ROI, ownerROI: OWNER };
  const results = await Promise.allSettled([f.capture.start(options), f.capture.start(options)]);
  assert.deepEqual(results.map((result) => result.status), ["rejected", "fulfilled"]);
  assert.equal(f.windows.length, 1); await f.capture.stop();
});

test("explicit preview returns a single selected-window PNG in memory and destroys its private page", async () => {
  const f = fixture(); const pending = f.capture.preview("window:42:0");
  await settle(); const window = f.windows[0]; assert.equal(window.command.mode, "preview");
  const data = png(30, 20);
  const result = await f.handler(":frame")(f.event(window), { token: window.command.token, mode: "preview", image: data });
  assert.equal(result.stop, true); assert.equal(await pending, data); assert.equal(window.destroyed, true); assert.equal(f.handlers.size, 0);
});

test("PNG validation bounds input and never accepts a URL, oversized image or non-PNG", () => {
  assert.equal(pngBytes(png(), 1024, 20, 20).length, 33);
  for (const value of ["https://example.test/frame.png", "data:image/jpeg;base64,AAAA", png(5000, 10)]) assert.throws(() => pngBytes(value, 1024, 20, 20));
});

test("capture renderer requests video only and uses sequential ACK scheduling with only cropped monitoring canvases", async () => {
  const timers = [], drawings = [], payloads = []; let tracksStopped = 0, resolveAck;
  const track = { stop: () => { tracksStopped += 1; }, addEventListener: () => {} };
  const video = { videoWidth: 1000, videoHeight: 500, play: async () => {}, pause: () => {} };
  const context = { Date, Math, setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout: () => {},
    navigator: { mediaDevices: { getDisplayMedia: async (options) => { assert.equal(options.audio, false); assert.equal("deviceId" in options.video, false); return { getTracks: () => [track], getAudioTracks: () => [], getVideoTracks: () => [track] }; } } },
    document: { getElementById: () => video, createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: (...args) => drawings.push(args) }), toDataURL: () => png() }) },
    window: { addEventListener: () => {}, shenPulseVision: { onStop: () => {}, status: async () => {}, frame: (payload) => { payloads.push(payload); return new Promise((resolve) => { resolveAck = resolve; }); } } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "match-vision.js"), "utf8"), context);
  assert.equal(await context.window.startShenPulseVisionCapture({ token: "test", mode: "monitor", bannerROI: ROI, ownerROI: OWNER }), true);
  assert.equal(timers.length, 1); timers.shift()(); await settle();
  assert.equal(payloads.length, 1); assert.equal(drawings.length, 2); assert.equal(timers.length, 0);
  assert.deepEqual(drawings[0].slice(1, 5), [100, 50, 600, 50]);
  resolveAck({ accepted: false, stop: true }); await settle(); assert.equal(tracksStopped, 1);
});
