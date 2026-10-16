"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MatchVisualService } = require("../src/main/matches/visual-service");
const { MatchesService } = require("../src/main/matches/service");
const { selectStatePaths } = require("../src/main/state-projection");
const { normalizeMatchesConfig, createMatchSession } = require("../src/shared/matches-contract");

const OWN = "9007199254740993123", RIVAL = "9007199254740993456", ROOM = "7123456789012345678";
const SCOPE = { ownerUid: "visual-fixture-account", profileId: "visual-fixture-profile" };
const ROI = { x: 0.1, y: 0.1, width: 0.6, height: 0.1 }, OWNER = { x: 0.1, y: 0.4, width: 0.3, height: 0.1 };
const settle = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

function fixture(context) {
  let now = 1790000000000, captureGeneration = 0, callbacks;
  const calls = [], ocrs = [], starts = [], stops = [], timers = new Set(), writes = [];
  const controls = { list: null, preview: null, recognize: null, accountGeneration: 0 };
  const state = { settings: { account: { uid: SCOPE.ownerUid, email: "fixture@example.invalid", refreshTokenSecretId: "fixture-secret" },
    tiktok: { username: "creator", roomId: ROOM, status: "live", broadcaster: { userId: OWN, username: "creator" } },
    siteVisibility: {}, matches: normalizeMatchesConfig(), overlayConfigs: {} },
    connections: [{ id: "source_tiktok", enabled: true, type: "tiktok-direct", config: { username: "creator" } }],
    session: { running: true, profileId: SCOPE.profileId, startedAt: new Date(now).toISOString() },
    commerce: { subscription: { tier: "pro", status: "active" } }, matchSession: createMatchSession(), rules: [], profiles: [] };
  const store = { getStateProjection: (paths) => selectStatePaths(state, paths), getAccountSession: () => state.settings.account,
    getSecret: () => "fixture-only", mutate: (callback) => { callback(state); writes.push(structuredClone(state)); }, mutateRuntime: (callback) => callback(state) };
  const setTimeoutImpl = (callback, delay) => { const timer = { callback, at: now + delay, unref() {} }; timers.add(timer); return timer; };
  const clearTimeoutImpl = (timer) => timers.delete(timer);
  const matches = new MatchesService({ store, now: () => now, setTimeoutImpl, clearTimeoutImpl,
    actionRunner: { run: async (_action, event) => { if (event.shouldExecute()) calls.push({ moment: event.data.moment, at: now }); return { executed: true }; } } });
  for (const moment of ["multiplierX2", "multiplierX3"]) matches.saveAutomation({ id: moment, moment, enabled: true,
    reaction: { type: "sound", url: "https://media.example.invalid/fixture.mp3" } });
  matches.handle({ source: "source_tiktok", phase: "start", id: "open", roomId: ROOM, channelUsername: "creator", battleId: "8001",
    receivedAtMs: now, startsAtMs: now, endsAtMs: now + 301000,
    participants: [{ id: OWN, username: "creator", score: 0 }, { id: RIVAL, username: "rival", score: 0 }] });
  const visual = new MatchVisualService({ store, matches, now: () => now, setTimeoutImpl, clearTimeoutImpl,
    getAccountGeneration: () => controls.accountGeneration,
    createCapture: (options) => {
      callbacks = options;
      return {
        listSources: async () => controls.list ? controls.list() : [{ id: "window:42:0", name: "TikTok LIVE Studio" }],
        start: async (options) => { starts.push(options); captureGeneration += 1; return { generation: captureGeneration }; },
        stop: async () => { stops.push(captureGeneration); captureGeneration += 1; },
        preview: async (sourceId) => controls.preview ? controls.preview(sourceId) : "data:image/png;base64,synthetic"
      };
    }, createOcr: () => {
      const item = { closed: false, reads: 0,
        close() { this.closed = true; },
        async recognize(bytes) {
          if (this.closed) throw new Error("Terminal OCR worker cannot restart");
          this.reads += 1;
          if (controls.recognize) return controls.recognize(bytes, this);
          return { available: true, lines: [{ text: bytes.toString("utf8"), x: 0, y: 0, width: 100, height: 10 }] };
        } };
      ocrs.push(item); return item;
    } });
  context.after(async () => { await visual.close(); matches.reset(); });
  const config = (extra = {}) => ({ enabled: true, sourceId: "window:42:0", bannerROI: ROI, ownerROI: OWNER, ...extra });
  const enable = (extra) => visual.configure(config(extra), SCOPE);
  const frame = (remaining, extra = {}) => ({ sourceId: "window:42:0", generation: captureGeneration,
    owner: Buffer.from("@creator"), banner: Buffer.from(`x2 points Cadeaux |${remaining}s`), capturedAtMs: now, ...extra });
  const send = async (remaining, extra) => { await callbacks.onFrame(frame(remaining, extra)); await matches.whenIdle(); };
  return { visual, matches, state, store, controls, calls, starts, stops, ocrs, writes, timers, config, enable, frame, send,
    now: () => now, shift: (milliseconds) => { now += milliseconds; }, callbacks: () => callbacks, captureGeneration: () => captureGeneration };
}

test("visual observer is disabled by default and never starts wildcard capture or OCR", async (context) => {
  const f = fixture(context); await f.visual.tick();
  assert.equal(f.visual.status().enabled, false); assert.equal(f.visual.status().active, false);
  assert.deepEqual(f.starts, []); assert.equal(f.ocrs.length, 0);
  await assert.rejects(f.visual.configure(f.config({ sourceId: "" }), SCOPE));
  assert.deepEqual(f.starts, []); assert.equal(f.ocrs.length, 0);
});

test("per-profile config retains only consent and bounded ROIs, never source IDs, names, images or OCR text", async (context) => {
  const f = fixture(context); await f.enable({ windowTitle: "PRIVATE title", image: "PRIVATE image", ownerText: "PRIVATE text" });
  const config = f.state.settings.matches.visualBonus;
  assert.deepEqual(config, { enabled: true, bannerROI: ROI, ownerROI: OWNER });
  const serialized = JSON.stringify(f.writes);
  assert.equal(serialized.includes("window:42:0"), false); assert.equal(serialized.includes("PRIVATE"), false);
  f.state.session.profileId = "other-profile";
  const status = f.visual.status(); assert.equal(status.active, false); assert.equal(status.sourceId, ""); assert.equal(status.sourceName, "");
});

test("paired OCR text objects become strings and two falling-countdown frames activate one real MatchesService reaction", async (context) => {
  for (const multiplier of [2, 3]) {
    const f = fixture(context); await f.enable(); f.shift(20000);
    const bonusFrame = (remaining) => ({ banner: Buffer.from(`x${multiplier} points Cadeaux |${remaining}s`) });
    await f.send(30, bonusFrame(30)); assert.deepEqual(f.calls, []); assert.equal(f.state.matchSession.multiplier, 1);
    f.shift(1000); await f.send(29, bonusFrame(29));
    assert.equal(f.state.matchSession.multiplier, multiplier); assert.deepEqual(f.calls.map((call) => call.moment), [`multiplierX${multiplier}`]);
    f.shift(1000); await f.send(28, bonusFrame(28)); assert.equal(f.calls.length, 1);
    assert.equal(JSON.stringify(f.state).includes("points Cadeaux"), false);
    assert.equal(f.ocrs[0].reads, 6); await f.visual.close();
  }
});

test("a fresh own-username proof is required on every frame; rival, missing and frozen banner frames never activate", async (context) => {
  for (const owner of ["@rival", "creator", "@creator-other", "@creator\n@rival", ""]) {
    const f = fixture(context); await f.enable(); f.shift(20000); await f.send(30);
    f.shift(1000); await f.send(29, { owner: Buffer.from(owner) }); f.shift(1000); await f.send(28);
    assert.deepEqual(f.calls, []); await f.visual.close();
  }
  const frozen = fixture(context); await frozen.enable(); frozen.shift(20000);
  for (let i = 0; i < 3; i += 1) { await frozen.send(30); frozen.shift(1000); }
  assert.deepEqual(frozen.calls, []);
});

test("source enumeration and preview cannot return another account or profile's completion", async (context) => {
  for (const operation of ["sources", "preview"]) {
    const f = fixture(context), pending = deferred();
    if (operation === "sources") f.controls.list = () => pending.promise;
    else f.controls.preview = () => pending.promise;
    const result = operation === "sources" ? f.visual.sources() : f.visual.preview("window:42:0", SCOPE);
    f.state.session.profileId = "other-profile";
    pending.resolve(operation === "sources" ? [{ id: "window:42:0", name: "PRIVATE" }] : "PRIVATE image");
    await assert.rejects(result, /profil|compte/i);
  }
});

test("configuration cannot commit a source selection after awaited enumeration changes owner or profile", async (context) => {
  const f = fixture(context), pending = deferred(); f.controls.list = () => pending.promise;
  const result = f.enable(); f.state.settings.account.uid = "other-account";
  pending.resolve([{ id: "window:42:0", name: "PRIVATE" }]); await assert.rejects(result);
  assert.deepEqual(f.starts, []); assert.equal(f.state.settings.matches.visualBonus?.enabled === true, false);
});

test("scope, room, source, LIVE, verified owner and rights changes after awaited OCR cancel every output", async (context) => {
  const changes = [
    (state) => { state.settings.account.uid = "other-account"; }, (state) => { state.session.profileId = "other-profile"; },
    (state) => { state.settings.tiktok.roomId = "7002"; }, (state) => { state.settings.tiktok.status = "disconnected"; },
    (state) => { state.settings.tiktok.username = "rival"; }, (state) => { state.settings.tiktok.broadcaster.userId = RIVAL; },
    (state) => { state.matchSession.ownUserId = RIVAL; },
    (state) => { state.matchSession.battleId = "8002"; }, (state) => { state.session.running = false; },
    (state) => { state.commerce.subscription.tier = "free"; }, (state) => { state.connections[0].enabled = false; },
    (state) => { state.connections[0].config.username = "rival"; },
    (state) => { state.settings.matches.visualBonus.bannerROI = { ...ROI, x: 0.2 }; },
    (state) => { state.settings.matches.visualBonus.ownerROI = { ...OWNER, y: 0.6 }; }
  ];
  for (const gateStage of [1, 2]) for (const change of changes) {
    const f = fixture(context); await f.enable(); f.shift(20000); await f.send(30); f.shift(1000);
    const pending = deferred(); let reads = 0;
    f.controls.recognize = async (bytes) => {
      reads += 1; if (reads === gateStage) await pending.promise;
      return { available: true, lines: [{ text: bytes.toString("utf8") }] };
    };
    const result = f.send(29); await settle(); change(f.state); pending.resolve(); await result;
    assert.deepEqual(f.calls, [], change.toString()); await f.visual.close();
  }
});

test("invalid own context never starts capture or OCR even if capture is opted in", async (context) => {
  for (const change of [
    (state) => { state.settings.tiktok.broadcaster = null; }, (state) => { state.matchSession.ownUserId = RIVAL; },
    (state) => { state.matchSession.status = "finished"; }, (state) => { state.matchSession.scope.profileId = "other"; },
    (state) => { state.settings.tiktok.roomId = ""; state.matchSession.scope.roomId = ""; },
    (state) => { state.connections[0].enabled = false; }
  ]) {
    const f = fixture(context); change(f.state); await f.enable();
    assert.deepEqual(f.starts, [], change.toString()); assert.equal(f.ocrs.length, 0); await f.visual.close();
  }
});

test("stop and restart create a fresh OCR worker; close is terminal and late old capture frames are obsolete", async (context) => {
  const f = fixture(context); await f.enable(); f.shift(20000); const oldFrame = f.frame(30);
  await f.send(30); const previous = f.ocrs[0]; await f.visual.stopCapture(); assert.equal(previous.closed, true);
  await f.visual.tick(); assert.equal(f.ocrs.length, 2); assert.notEqual(f.ocrs[1], previous);
  f.shift(1000); await f.callbacks().onFrame(oldFrame); f.shift(1000); await f.send(28);
  assert.deepEqual(f.calls, [], "An old capture generation cannot seed a fresh two-frame proof");
  await f.visual.close(); const count = f.starts.length; await f.visual.tick();
  assert.equal(f.starts.length, count); assert.equal(f.ocrs[1].closed, true);
});

test("calibration preview pauses monitoring while pending then safely resumes only the selected configured source", async (context) => {
  const f = fixture(context); await f.enable(); const pending = deferred(); f.controls.preview = () => pending.promise;
  const before = f.stops.length, starts = f.starts.length, worker = f.ocrs[0];
  const result = f.visual.preview("window:42:0", SCOPE); await settle();
  assert.ok(f.stops.length > before); assert.equal(f.visual.status().active, false); assert.equal(worker.closed, true);
  await f.visual.tick(); assert.equal(f.starts.length, starts, "Timer ticks must not capture during the calibration preview");
  pending.resolve("data:image/png;base64,synthetic"); assert.equal((await result).image, "data:image/png;base64,synthetic");
  assert.equal(f.visual.status().active, true); assert.equal(f.starts.length, starts + 1);
  assert.equal(f.starts.at(-1).sourceId, "window:42:0"); assert.notEqual(f.ocrs.at(-1), worker);
});

test("same-UID account re-login generation changes invalidate awaited OCR even when profile and public LIVE are unchanged", async (context) => {
  const f = fixture(context); await f.enable(); f.shift(20000); await f.send(30); f.shift(1000);
  const pending = deferred(); f.controls.recognize = async (bytes) => { await pending.promise; return { available: true, lines: [{ text: bytes.toString("utf8") }] }; };
  const result = f.send(29); await settle(); f.controls.accountGeneration += 1; pending.resolve(); await result;
  assert.deepEqual(f.calls, []);
});

test("a newer disable configuration wins over an older pending source enumeration", async (context) => {
  const f = fixture(context), pending = deferred(); f.controls.list = () => pending.promise;
  const older = f.enable(); await f.visual.configure({ enabled: false }, SCOPE);
  pending.resolve([{ id: "window:42:0", name: "TikTok LIVE Studio" }]); await assert.rejects(older);
  assert.equal(f.visual.status().enabled, false); assert.equal(f.visual.status().sourceId, ""); assert.deepEqual(f.starts, []);
});

test("an imported or externally changed crop requires new explicit window selection before reading", async (context) => {
  const f = fixture(context); await f.enable();
  const worker = f.ocrs[0], count = f.starts.length;
  f.state.settings.matches.visualBonus.bannerROI = { ...ROI, x: 0.2 };
  assert.equal(f.visual.status().active, false);
  assert.equal(f.visual.status().state, "choose-window");
  assert.equal(f.visual.status().sourceId, "");
  await f.visual.tick();
  assert.equal(worker.closed, true);
  assert.equal(f.starts.length, count);
  await f.enable({ bannerROI: { ...ROI, x: 0.2 } });
  assert.equal(f.visual.status().active, true);
  assert.equal(f.starts.length, count + 1);
});

test("matches IPC keeps the main-window sender, authentication and Pro access guards", () => {
  const ipc = fs.readFileSync(path.join(__dirname, "..", "src", "main", "ipc.js"), "utf8");
  const matchesIpc = fs.readFileSync(path.join(__dirname, "..", "src", "main", "ipc", "matches.js"), "utf8");
  assert.match(ipc, /"matches:"/); assert.match(ipc, /assertIntegrationIpcSender\(channel/); assert.match(ipc, /assertAuthenticatedAccount\(store\)/);
  assert.match(matchesIpc, /assertProFeatureAccess\(store, "matches"\)/);
});
