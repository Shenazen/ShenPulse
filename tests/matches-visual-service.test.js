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
  const controls = { list: null, preview: null, start: null, stop: null, recognize: null, accountGeneration: 0 };
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
        start: async (options) => { starts.push(options); if (controls.start) return controls.start(options); captureGeneration += 1; return { generation: captureGeneration }; },
        stop: async () => { stops.push(captureGeneration); captureGeneration += 1; if (controls.stop) await controls.stop(); },
        preview: async (sourceId) => controls.preview ? controls.preview(sourceId) : "data:image/png;base64,synthetic"
      };
    }, createOcr: () => {
      const item = { closed: false, reads: 0,
        close() { this.closed = true; },
        async recognize(bytes) {
          if (this.closed) throw new Error("Terminal OCR worker cannot restart");
          this.reads += 1;
          if (controls.recognize) return controls.recognize(bytes, this);
          return { available: true, lines: bytes.toString("utf8").split(/\r?\n/).map((text) => ({ text, x: 0, y: 0, width: 100, height: 10 })) };
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

test("current capture ended/error/stopped becomes inactive immediately and recovers only the same consented window", async (context) => {
  for (const state of ["ended", "error", "stopped"]) {
    const f = fixture(context); await f.enable(); const old = f.captureGeneration(), worker = f.ocrs[0];
    f.callbacks().onStatus({ state, generation: old });
    assert.equal(f.visual.status().active, false); assert.equal(f.visual.status().state, "recovering"); assert.equal(worker.closed, true);
    await settle(); await f.visual.tick(); assert.equal(f.starts.length, 1, "no retry before the bounded delay");
    f.shift(500); await f.visual.tick(); assert.equal(f.starts.length, 2); assert.equal(f.starts[1].sourceId, "window:42:0");
    assert.equal(f.visual.status().active, true);
    f.callbacks().onStatus({ state: "error", generation: old });
    assert.equal(f.visual.status().active, true, "an obsolete capture cannot stop the current one");
    await f.visual.close();
  }
});

test("a planned capture stop invalidates its generation before stopped status and never starts recovery", async (context) => {
  const f = fixture(context); await f.enable(); const generation = f.captureGeneration();
  f.controls.stop = async () => f.callbacks().onStatus({ state: "stopped", generation });
  const previous = f.stops.length; await f.visual.stopCapture();
  assert.equal(f.stops.length, previous + 1, "the planned stop must not recursively stop itself");
  assert.equal(f.visual.status().active, false); assert.equal(f.visual.recoveryPending, null);
  assert.equal(f.visual.recoveryAttempts, 0); assert.equal(f.visual.retryAtMs, 0); assert.equal(f.starts.length, 1);
});

test("an absent selected window has only three recovery attempts and never selects a different window", async (context) => {
  const f = fixture(context); await f.enable();
  f.controls.list = async () => [{ id: "window:99:0", name: "TikTok LIVE Studio replacement" }];
  f.controls.start = async () => { throw new Error("Selected window is absent"); };
  f.callbacks().onStatus({ state: "ended", generation: f.captureGeneration() }); await settle();
  for (const delay of [500, 1500, 4000]) { f.shift(delay); await f.visual.tick(); }
  assert.equal(f.starts.length, 4); assert.ok(f.starts.every((row) => row.sourceId === "window:42:0"));
  assert.equal(f.visual.status().active, false); assert.equal(f.visual.status().state, "capture-unavailable");
  f.shift(30000); await f.visual.tick(); assert.equal(f.starts.length, 4, "no infinite automatic retry loop");
});

test("explicit reconfiguration during recovery waits for the old stop then starts its consented selection", async (context) => {
  const f = fixture(context); await f.enable(); const pending = deferred(); let stops = 0;
  f.controls.stop = () => ++stops === 1 ? pending.promise : Promise.resolve();
  f.callbacks().onStatus({ state: "error", generation: f.captureGeneration() });
  const configured = f.enable({ bannerROI: { ...ROI, x: 0.2 } }); await settle();
  assert.equal(f.starts.length, 1, "no new capture may race the previous capture's pending stop");
  pending.resolve(); await configured;
  assert.equal(f.visual.status().active, true); assert.equal(f.starts.length, 2);
  assert.deepEqual(f.starts.at(-1).bannerROI, { ...ROI, x: 0.2 });
});

test("a preview awaiting recovery rechecks its account scope before it can capture an image", async (context) => {
  const f = fixture(context); await f.enable(); const pending = deferred(); let stops = 0, previews = 0;
  f.controls.stop = () => ++stops === 1 ? pending.promise : Promise.resolve();
  f.controls.preview = async () => { previews += 1; return "data:image/png;base64,synthetic"; };
  f.callbacks().onStatus({ state: "ended", generation: f.captureGeneration() });
  const previewed = f.visual.preview("window:42:0", SCOPE); await settle();
  assert.equal(previews, 0); f.state.session.profileId = "changed-profile";
  pending.resolve(); await assert.rejects(previewed, /compte|profil/i);
  assert.equal(previews, 0, "changed scopes may not capture even a temporary local preview");
});

test("capture recovery and OCR interruptions never replay an already observed visual period", async (context) => {
  const f = fixture(context); await f.enable(); f.shift(20000); await f.send(30); f.shift(1000); await f.send(29);
  assert.equal(f.calls.length, 1);
  f.callbacks().onStatus({ state: "error", generation: f.captureGeneration() }); await settle();
  f.shift(500); await f.visual.tick(); await f.send(28); f.shift(1000); await f.send(27); assert.equal(f.calls.length, 1);
  f.controls.recognize = async () => ({ available: false, lines: [] }); f.shift(1000); await f.send(26);
  f.controls.recognize = null; f.shift(1000); await f.send(25); f.shift(1000); await f.send(24);
  assert.equal(f.calls.length, 1, "temporary OCR failure cannot erase period deduplication");
  f.shift(35000); await f.send(30); f.shift(1000); await f.send(29);
  assert.equal(f.calls.length, 2, "a separate later period still executes");
});

function studioFixtureIdentity(f) {
  f.state.settings.tiktok.broadcaster.nickname = "Shenazen🔥Phoenix Lég.🔥";
  for (const participant of f.state.matchSession.participants) participant.displayName = participant.id === OWN ? "Shenazen🔥Phoenix Lég.🔥" : "Mamie cocotte";
}

test("Studio self mode confirms the early thirty-second OCR banner without an @, only for the verified duo", async (context) => {
  const f = fixture(context); studioFixtureIdentity(f); await f.enable({ ownerMode: "studio-self" });
  assert.equal(f.visual.status().ownerMode, "studio-self"); f.shift(20000);
  await f.send(30, { owner: Buffer.from("Shenazen🔥Phoe...\nToi"), banner: Buffer.from("Points Cadeaux x2 par premier Cadeau 1 30s") });
  assert.equal(f.calls.length, 0); f.shift(1000);
  await f.send(29, { owner: Buffer.from("Shenazen🔥Phoe...\nToi"), banner: Buffer.from("Points Cadeaux x2 par premier Cadeau 1 29s") });
  assert.deepEqual(f.calls.map((row) => row.moment), ["multiplierX2"]);
  assert.equal(f.state.matchSession.multiplier, 2);
});

test("Studio mode refuses unknown owners/names, team formats and inconsistent singleton team memberships", async (context) => {
  const changes = [
    (f) => { f.state.settings.tiktok.broadcaster.userId = RIVAL; },
    (f) => { f.state.settings.tiktok.broadcaster.nickname = ""; },
    (f) => { f.state.matchSession.participants.find((row) => row.id === RIVAL).displayName = ""; },
    (f) => { f.state.matchSession.participants.push({ id: "9001", displayName: "Third" }); },
    (f) => { f.state.matchSession.battleType = 2; },
    (f) => { f.state.matchSession.teams = [{ id: "a", participantIds: [OWN, RIVAL] }]; },
    (f) => { f.state.matchSession.teams = [{ id: "a", participantIds: [OWN] }, { id: "b", participantIds: ["9001"] }]; }
  ];
  for (const change of changes) {
    const f = fixture(context); studioFixtureIdentity(f); change(f); await f.enable({ ownerMode: "studio-self" });
    assert.equal(f.starts.length, 0, change.toString()); await f.visual.close();
  }
  const f = fixture(context); studioFixtureIdentity(f);
  f.state.matchSession.teams = [{ id: "a", participantIds: [OWN] }, { id: "b", participantIds: [RIVAL] }];
  await f.enable({ ownerMode: "studio-self" }); assert.equal(f.starts.length, 1, "two exact singleton sides retain the verified duo guarantee");
});

test("changing consented owner mode or verified Studio name invalidates the old capture and its incomplete proof", async (context) => {
  const f = fixture(context); studioFixtureIdentity(f); await f.enable(); f.shift(20000); await f.send(30);
  f.state.settings.matches.visualBonus.ownerMode = "studio-self";
  assert.equal(f.visual.status().state, "choose-window"); assert.equal(f.visual.status().active, false);
  await f.visual.tick(); assert.equal(f.ocrs[0].closed, true); assert.equal(f.starts.length, 1);
  await f.enable({ ownerMode: "studio-self" }); await f.send(29, { owner: Buffer.from("Shenazen Phoe...\nToi") });
  assert.equal(f.calls.length, 0);
  f.state.settings.tiktok.broadcaster.nickname = "A different verified name"; f.shift(1000);
  await f.send(28, { owner: Buffer.from("Shenazen Phoe...\nToi") }); assert.equal(f.calls.length, 0);
});

const selfScreenConfig = (extra = {}) => ({ ownerMode: "self-screen", ownPosition: "left", ownerROI: null, ownScreenConfirmed: true, ...extra });

test("self-screen requires a fresh ephemeral confirmation and reads the active banner only, never an owner crop", async (context) => {
  const f = fixture(context);
  for (const ownScreenConfirmed of [undefined, false, "true", 1]) {
    await assert.rejects(f.enable(selfScreenConfig({ ownScreenConfirmed })), /confirmez/i);
    assert.equal(f.starts.length, 0); assert.equal(f.writes.length, 2, "only fixture automations have been saved");
  }
  await f.enable(selfScreenConfig());
  assert.equal(f.visual.status().ownerMode, "self-screen"); assert.equal(f.visual.status().ownPosition, "left");
  assert.equal("ownScreenConfirmed" in f.visual.status(), false);
  assert.deepEqual(f.starts[0], { sourceId: "window:42:0", bannerROI: ROI, ownerROI: null, ownerMode: "self-screen", ownScreenConfirmed: true });
  const config = f.state.settings.matches.visualBonus;
  assert.deepEqual(config, { enabled: true, bannerROI: ROI, ownerROI: null, ownerMode: "self-screen", ownPosition: "left" });
  assert.equal(JSON.stringify(f.writes).includes("ownScreenConfirmed"), false);
  f.shift(20000); await f.send(30, { owner: null }); assert.equal(f.ocrs[0].reads, 1); assert.equal(f.calls.length, 0);
  f.shift(1000); await f.send(29, { owner: null }); assert.equal(f.ocrs[0].reads, 2);
  assert.deepEqual(f.calls.map((row) => row.moment), ["multiplierX2"]);
  await assert.rejects(f.enable(selfScreenConfig({ ownScreenConfirmed: undefined })), /confirmez/i);
  await f.visual.close();
  const restarted = fixture(context); restarted.state.settings.matches.visualBonus = structuredClone(config);
  await restarted.visual.tick(); assert.equal(restarted.visual.status().state, "choose-window");
  assert.equal(restarted.starts.length, 0, "stored ROIs and mode are not consent to a window after restart");
});

test("self-screen binds the first compatible verified topology, including three/four-person top-left without requiring names", async (context) => {
  for (const count of [3, 4]) {
    const f = fixture(context); f.state.matchSession.status = "finished";
    await f.enable(selfScreenConfig({ ownPosition: "top-left" })); assert.equal(f.starts.length, 0);
    assert.equal(f.visual.selection.layoutKey, "");
    f.state.matchSession.status = "running"; f.state.matchSession.battleType = 2;
    while (f.state.matchSession.participants.length < count) f.state.matchSession.participants.push({ id: `90071992547409937${f.state.matchSession.participants.length}`, score: 0 });
    await f.visual.tick(); assert.equal(f.starts.length, 1); assert.equal(f.visual.status().active, true);
    assert.equal(f.visual.status().ownPosition, "top-left"); assert.ok(f.visual.selection.layoutKey);
    f.shift(20000); await f.send(30, { owner: null }); f.shift(1000); await f.send(29, { owner: null });
    assert.equal(f.calls.length, 1); await f.visual.close();
  }
});

test("self-screen rejects incompatible layouts, duplicate/missing owners and unverified participant/team IDs", async (context) => {
  const changes = [
    (f) => { f.state.matchSession.participants.pop(); },
    (f) => { f.state.matchSession.participants[1].id = OWN; },
    (f) => { f.state.matchSession.participants[0].id = "9002"; },
    (f) => { f.state.matchSession.participants[1].id = Number(RIVAL); },
    (f) => { f.state.matchSession.participants[1].id = "18446744073709551616"; },
    (f) => { f.state.matchSession.participants.push({ id: "9003" }); },
    (f) => { f.state.matchSession.teams = [{ id: "a", participantIds: [OWN] }]; },
    (f) => { f.state.settings.tiktok.broadcaster.userId = RIVAL; }
  ];
  for (const change of changes) {
    const f = fixture(context); change(f); await f.enable(selfScreenConfig());
    assert.equal(f.starts.length, 0, change.toString()); assert.equal(f.visual.status().active, false); await f.visual.close();
  }
  const duo = fixture(context); await duo.enable(selfScreenConfig({ ownPosition: "top-left" }));
  assert.equal(duo.starts.length, 0);
});

test("self-screen layout changes latch off until explicit fresh confirmation, even if the old topology returns", async (context) => {
  for (const change of [
    (f) => { f.state.matchSession.participants.push({ id: "9003", score: 0 }); },
    (f) => { f.state.matchSession.participants.pop(); },
    (f) => { f.state.matchSession.teams = [{ id: "a", participantIds: [OWN] }]; },
    (f) => { f.state.matchSession.battleType = 1; },
    (f) => { f.state.matchSession.teams = [{ id: "a", participantIds: [OWN] }, { id: "b", participantIds: [RIVAL] }]; }
  ]) {
    const f = fixture(context); await f.enable(selfScreenConfig()); f.shift(20000); await f.send(30, { owner: null });
    const original = structuredClone(f.state.matchSession); change(f);
    assert.equal(f.visual.status().state, "layout-changed"); assert.equal(f.visual.status().active, false);
    await f.visual.tick(); assert.equal(f.ocrs[0].closed, true);
    f.state.matchSession = original; await f.visual.tick(); assert.equal(f.starts.length, 1);
    assert.equal(f.visual.status().state, "layout-changed");
    await assert.rejects(f.enable(selfScreenConfig({ ownScreenConfirmed: false })), /confirmez/i);
    await f.enable(selfScreenConfig()); assert.equal(f.starts.length, 2); assert.equal(f.visual.status().active, true);
    f.shift(1000); await f.send(29, { owner: null }); assert.equal(f.calls.length, 0, "new consent cannot reuse the old incomplete OCR pair");
    await f.visual.close();
  }
});

test("self-screen topology binding ignores display names and replacement rivals when the layout stays identical", async (context) => {
  const f = fixture(context); await f.enable(selfScreenConfig()); const layout = f.visual.selection.layoutKey;
  f.state.settings.tiktok.broadcaster.nickname = "Changed name";
  f.state.matchSession.participants[1] = { id: "9007199254740993999", displayName: "New rival", score: 0 };
  await f.visual.tick(); assert.equal(f.starts.length, 1); assert.equal(f.visual.status().active, true);
  assert.equal(f.visual.selection.layoutKey, layout);
});

test("self-screen LIVE binding rejects another coherent LIVE and stays revoked when the old LIVE returns", async (context) => {
  const f = fixture(context); await f.enable(selfScreenConfig());
  const tiktok = structuredClone(f.state.settings.tiktok), match = structuredClone(f.state.matchSession);
  f.state.settings.tiktok = { username: "next.creator", roomId: "7002", status: "live", broadcaster: { userId: "9002", username: "next.creator" } };
  f.state.connections[0].config.username = "next.creator";
  f.state.matchSession.scope.roomId = "7002"; f.state.matchSession.ownUserId = "9002";
  f.state.matchSession.participants[0].id = "9002";
  assert.equal(f.visual.status().state, "confirmation-required"); assert.equal(f.visual.status().active, false);
  await f.visual.tick(); assert.equal(f.ocrs[0].closed, true);
  f.state.settings.tiktok = tiktok; f.state.matchSession = match; f.state.connections[0].config.username = "creator";
  await f.visual.tick(); assert.equal(f.starts.length, 1); assert.equal(f.visual.status().state, "confirmation-required");
  await f.enable(selfScreenConfig()); assert.equal(f.starts.length, 2); assert.equal(f.visual.status().active, true);
  f.state.matchSession.battleId = "8002"; await f.visual.tick();
  assert.equal(f.visual.status().active, true); assert.equal(f.visual.status().state, "reading", "the same verified LIVE may continue into a new battle");
});

test("self-screen source enumeration cannot transfer an old confirmation to a newly configured LIVE", async (context) => {
  const f = fixture(context), pending = deferred(); f.controls.list = () => pending.promise;
  const configured = f.enable(selfScreenConfig());
  f.state.settings.tiktok = { username: "next.creator", roomId: "7002", status: "live", broadcaster: { userId: "9002", username: "next.creator" } };
  f.state.connections[0].config.username = "next.creator";
  f.state.matchSession.scope.roomId = "7002"; f.state.matchSession.ownUserId = "9002"; f.state.matchSession.participants[0].id = "9002";
  pending.resolve([{ id: "window:42:0", name: "TikTok LIVE Studio" }]);
  await assert.rejects(configured, /LIVE a changé/); assert.equal(f.starts.length, 0);
  assert.equal(f.state.settings.matches.visualBonus?.enabled === true, false);
});

test("self-screen confirmation is revoked by observed mode, crop, profile and account changes even after restoration", async (context) => {
  for (const change of [
    (f) => { f.state.settings.matches.visualBonus.ownerMode = "username"; },
    (f) => { f.state.settings.matches.visualBonus.ownPosition = "top-left"; },
    (f) => { f.state.settings.matches.visualBonus.bannerROI = { ...ROI, x: 0.2 }; },
    (f) => { f.state.session.profileId = "other-profile"; },
    (f) => { f.state.settings.account.uid = "other-account"; },
    (f) => { f.controls.accountGeneration += 1; }
  ]) {
    const f = fixture(context); await f.enable(selfScreenConfig());
    const config = structuredClone(f.state.settings.matches.visualBonus); change(f);
    f.visual.status(); await f.visual.tick();
    f.state.settings.matches.visualBonus = config; f.state.session.profileId = SCOPE.profileId; f.state.settings.account.uid = SCOPE.ownerUid;
    f.controls.accountGeneration = 0; await f.visual.tick();
    assert.equal(f.starts.length, 1, change.toString()); assert.equal(f.visual.status().state, "confirmation-required");
    assert.equal(f.visual.status().active, false); await f.visual.close();
  }
});

test("self-screen awaited capture startup is obsolete after calibration, LIVE or topology changes", async (context) => {
  for (const change of [
    (f) => { f.state.settings.matches.visualBonus.ownPosition = "top-left"; },
    (f) => { f.state.settings.matches.visualBonus.ownerMode = "studio-self"; },
    (f) => { f.state.settings.matches.visualBonus.bannerROI = { ...ROI, x: 0.2 }; },
    (f) => { f.state.settings.tiktok.roomId = "7002"; },
    (f) => { f.state.matchSession.participants.push({ id: "9003", score: 0 }); },
    (f) => { f.controls.accountGeneration += 1; }
  ]) {
    const f = fixture(context), pending = deferred();
    f.controls.start = async () => { await pending.promise; return { generation: f.captureGeneration() }; };
    const configured = f.enable(selfScreenConfig()); await settle(); change(f); pending.resolve();
    try { await configured; } catch { /* Changed scope cannot return a committed selection. */ }
    assert.equal(f.visual.status().active, false, change.toString());
    assert.equal(f.calls.length, 0); assert.ok(f.ocrs.every((worker) => worker.closed)); await f.visual.close();
  }
});

test("self-screen awaited banner OCR cannot cross position, ROI, account generation, room or layout changes", async (context) => {
  for (const change of [
    (f) => { f.state.settings.matches.visualBonus.ownPosition = "top-left"; },
    (f) => { f.state.settings.matches.visualBonus.bannerROI = { ...ROI, x: 0.2 }; },
    (f) => { f.controls.accountGeneration += 1; },
    (f) => { f.state.settings.tiktok.roomId = "7002"; },
    (f) => { f.state.matchSession.participants.push({ id: "9003", score: 0 }); }
  ]) {
    const f = fixture(context); await f.enable(selfScreenConfig()); f.shift(20000); await f.send(30, { owner: null }); f.shift(1000);
    const pending = deferred(); f.controls.recognize = async (bytes) => { await pending.promise; return { available: true, lines: [{ text: bytes.toString("utf8") }] }; };
    const result = f.send(29, { owner: null }); await settle(); change(f); pending.resolve(); await result;
    assert.equal(f.calls.length, 0, change.toString()); await f.visual.close();
  }
});

test("self-screen capture recovery retains its explicit window declaration and observed-period deduplication", async (context) => {
  const f = fixture(context); await f.enable(selfScreenConfig()); f.shift(20000);
  await f.send(30, { owner: null }); f.shift(1000); await f.send(29, { owner: null }); assert.equal(f.calls.length, 1);
  f.callbacks().onStatus({ state: "ended", generation: f.captureGeneration() }); await settle(); f.shift(500); await f.visual.tick();
  assert.equal(f.starts.length, 2); assert.equal(f.starts[1].ownScreenConfirmed, true); assert.equal(f.starts[1].ownerROI, null);
  await f.send(28, { owner: null }); f.shift(1000); await f.send(27, { owner: null }); assert.equal(f.calls.length, 1);
});

test("matches IPC keeps the main-window sender, authentication and Pro access guards", () => {
  const ipc = fs.readFileSync(path.join(__dirname, "..", "src", "main", "ipc.js"), "utf8");
  const matchesIpc = fs.readFileSync(path.join(__dirname, "..", "src", "main", "ipc", "matches.js"), "utf8");
  assert.match(ipc, /"matches:"/); assert.match(ipc, /assertIntegrationIpcSender\(channel/); assert.match(ipc, /assertAuthenticatedAccount\(store\)/);
  assert.match(matchesIpc, /assertProFeatureAccess\(store, "matches"\)/);
});
