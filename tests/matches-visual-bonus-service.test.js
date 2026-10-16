"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { MatchesService } = require("../src/main/matches/service");
const { selectStatePaths } = require("../src/main/state-projection");
const { normalizeMatchesConfig, createMatchSession } = require("../src/shared/matches-contract");

// Only trusted semantic frames are exercised here: no OCR, capture, network,
// real LIVE, media, account or inferred TikTok reward is used by this fixture.
const NOW = 1790000000000, OWN = "9007199254740993123", RIVAL = "9007199254740993456";
function fixture(context, { holdEffect } = {}) {
  let now = NOW, sequence = 0;
  const calls = [], contexts = [], timers = new Set();
  const state = { settings: {
    account: { uid: "visual-fixture", email: "fixture@example.invalid", refreshTokenSecretId: "fixture-secret" },
    tiktok: { username: "creator", roomId: "8080", status: "live", broadcaster: { userId: OWN, username: "creator" } },
    siteVisibility: {}, matches: normalizeMatchesConfig(), overlayConfigs: {}
  }, session: { running: true, profileId: "visual-profile", startedAt: new Date(now).toISOString() },
  commerce: { subscription: { tier: "pro", status: "active" } }, matchSession: createMatchSession(), profiles: [], rules: [] };
  const store = { getStateProjection: (paths) => selectStatePaths(state, paths), getAccountSession: () => state.settings.account,
    getSecret: () => "fixture-only", mutate: (callback) => callback(state), mutateRuntime: (callback) => callback(state) };
  const service = new MatchesService({ store, now: () => now, actionRunner: { run: async (_action, event) => {
    contexts.push(event); if (holdEffect) await holdEffect;
    if (event.shouldExecute()) calls.push({ moment: event.data.moment, at: now }); return { executed: true };
  } }, setTimeoutImpl: (callback, delay) => {
    const timer = { at: now + delay, callback, unref() {} }; timers.add(timer); return timer;
  }, clearTimeoutImpl: (timer) => timers.delete(timer) });
  context.after(() => service.reset());
  for (const moment of ["multiplierX2", "multiplierX3"]) service.saveAutomation({ id: moment, name: moment, moment,
    enabled: true, cooldownMs: 60000, reaction: { type: "sound", url: "https://media.example.invalid/fixture.mp3" } });
  const frame = (phase, extra = {}) => ({ source: "source_tiktok", phase, id: String(++sequence),
    roomId: "8080", channelUsername: "creator", battleId: "9001", receivedAtMs: now, ...extra });
  const open = (extra = {}) => service.handle(frame("start", { startsAtMs: now, endsAtMs: now + 301000,
    participants: [{ id: OWN, username: "creator", score: 0 }, { id: RIVAL, username: "rival", score: 0 }], ...extra }));
  const task = (bonus, extra = {}) => service.handle(frame("task", { bonus, ...extra }));
  const visual = (multiplier = 2, startsAtMs = now, durationMs = 30000, extra = {}, frameExtra = {}) => task({
    stage: "available", result: "available", origin: "visual", ownerUserId: OWN, multiplier, startsAtMs, durationMs,
    periodKey: `visual:fixture:${++sequence}`, ...extra }, frameExtra);
  const announce = (startsAtMs, multiplier = 2, durationMs = 30000, extra = {}) => task({
    stage: "announced", result: "unknown", multiplier, startsAtMs, durationMs, ...extra });
  const settle = (startsAtMs, result = "success", extra = {}) => task({
    stage: "settled", result, multiplier: null, startsAtMs, durationMs: 0, ...extra });
  const initial = (startsAtMs, multiplier = 2, durationMs = 30000) => task({
    stage: "start-bonus", result: "available", multiplier, startsAtMs, durationMs });
  const advance = async (milliseconds) => {
    const target = now + milliseconds;
    for (let i = 0; i < 1000; i += 1) {
      const timer = [...timers].filter((row) => row.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!timer) { now = target; await service.whenIdle(); return; }
      now = timer.at; timers.delete(timer); timer.callback(); await service.whenIdle();
    }
    throw new Error("The visual bonus fixture must not create an unbounded timer loop");
  };
  return { state, service, calls, contexts, frame, task, open, visual, announce, settle, initial, advance,
    now: () => now, shiftClock: (ms) => { now += ms; } };
}

test("visual first, then successful ordinary TASK: one animation and the formal clock replaces the observed start", async (context) => {
  for (const multiplier of [2, 3]) {
    const f = fixture(context); f.open(); await f.advance(20000);
    const actualStart = f.now(), actualEnd = actualStart + 30000;
    await f.advance(1000); f.visual(multiplier, f.now(), actualEnd - f.now()); await f.service.whenIdle();
    const visualKey = f.service.bonuses.activeKey;
    assert.equal(f.state.matchSession.multiplier, multiplier); assert.equal(f.calls.length, 1);
    f.announce(actualStart, multiplier, 30000); await f.service.whenIdle();
    assert.equal(f.service.bonuses.periods.size, 2, "A pending announcement is not merged into the visual proof");
    assert.equal(f.calls.length, 1);
    f.settle(actualStart); await f.service.whenIdle();
    assert.equal(f.calls.length, 1); assert.equal(f.service.bonuses.periods.size, 1);
    const [period] = f.service.bonuses.periods.values();
    assert.equal(period.key, visualKey); assert.equal(period.origin, "visual"); assert.equal(period.formalBound, true);
    assert.equal(period.startsAtMs, actualStart); assert.equal(period.startsAtMs + period.durationMs, actualEnd);
    assert.equal(f.service.bonuses.isActive(visualKey), true);
    await f.advance(actualEnd - f.now()); assert.equal(f.state.matchSession.multiplier, 1); assert.equal(f.calls.length, 1);
  }
});

test("confirmed ordinary TASK first, then the matching visual proof: no duplicate and no shortened formal clock", async (context) => {
  const f = fixture(context); f.open(); await f.advance(20000); const actualStart = f.now();
  f.announce(actualStart, 3); f.settle(actualStart); await f.service.whenIdle();
  const formalKey = f.service.bonuses.activeKey;
  await f.advance(1000); f.visual(3, f.now(), 29000); await f.service.whenIdle();
  assert.equal(f.calls.length, 1); assert.equal(f.service.bonuses.periods.size, 1);
  const [period] = f.service.bonuses.periods.values();
  assert.equal(period.key, formalKey); assert.equal(period.startsAtMs, actualStart); assert.equal(period.durationMs, 30000);
  assert.equal(f.state.matchSession.multiplier, 3);
  await f.advance(29000); assert.equal(f.state.matchSession.multiplier, 1);
});

test("visual and explicit START_BONUS target 22 deduplicate in either delivery order", async (context) => {
  for (const visualFirst of [true, false]) {
    const f = fixture(context); f.open(); await f.advance(23000); const start = f.now();
    if (visualFirst) { f.visual(2); await f.service.whenIdle(); f.initial(start); }
    else { f.initial(start); await f.service.whenIdle(); await f.advance(1000); f.visual(2, f.now(), 29000); }
    await f.service.whenIdle();
    assert.equal(f.calls.length, 1); assert.equal(f.service.bonuses.periods.size, 1);
    assert.equal(f.state.matchSession.multiplier, 2); await f.advance(start + 30000 - f.now());
    assert.equal(f.state.matchSession.multiplier, 1);
  }
});

test("a later separate bonus of the same value remains independent of the first visual period", async (context) => {
  const f = fixture(context); f.open(); await f.advance(20000); f.visual(2); await f.service.whenIdle();
  await f.advance(40000); const secondStart = f.now(); f.announce(secondStart, 2, 50000); f.settle(secondStart);
  await f.service.whenIdle(); assert.equal(f.calls.length, 2); assert.equal(f.service.bonuses.periods.size, 2);
  assert.equal(f.state.matchSession.multiplier, 2); await f.advance(50000); assert.equal(f.state.matchSession.multiplier, 1);
});

test("distinct overlapping formal cycles never merge, even after one absorbed a visual observation", async (context) => {
  const f = fixture(context); f.open(); await f.advance(20000); const first = f.now();
  f.visual(2); f.announce(first, 2, 30000); f.settle(first); await f.service.whenIdle();
  await f.advance(1000); const second = f.now(); f.announce(second, 2, 29000); f.settle(second);
  await f.service.whenIdle(); assert.equal(f.service.bonuses.periods.size, 2); assert.equal(f.calls.length, 2,
    "Equal formal end times do not erase a distinct formally identified overlapping cycle");
});

test("different end, multiplier, or later formal start is not proof of the same visual period", async (context) => {
  for (const scenario of ["different-end", "different-value", "later-start"]) {
    const f = fixture(context); f.open(); await f.advance(20000); const observed = f.now();
    f.visual(2); await f.service.whenIdle();
    const start = observed + (scenario === "later-start" ? 3000 : 1000);
    f.announce(start, scenario === "different-value" ? 3 : 2,
      scenario === "different-end" ? 50000 : scenario === "later-start" ? 27000 : 29000); f.settle(start);
    await f.advance(3000); assert.equal(f.service.bonuses.periods.size, 2); assert.equal(f.calls.length, 2, scenario);
  }
});

test("pending and failed TASK packets cannot create or deduplicate a confirmed animation", async (context) => {
  const f = fixture(context); f.open(); await f.advance(20000); const start = f.now();
  f.announce(start, 2); f.settle(start, "failed"); await f.service.whenIdle();
  assert.equal(f.calls.length, 0); assert.equal(f.state.matchSession.multiplier, 1);
  f.initial(start); await f.service.whenIdle(); assert.equal(f.calls.length, 0, "A failure remains terminal for its formal alias");
  f.visual(3); await f.service.whenIdle(); assert.equal(f.calls.length, 1);
  assert.equal(f.service.bonuses.periods.size, 2, "A failed x2 task never swallows an independently proven x3 visual period");
});

test("available periods require an exact room and verified own UID, including nonvisual HTTP availability", async (context) => {
  for (const origin of ["visual", undefined]) for (const scenario of ["unverified", "no-room", "rival-room", "rival-owner"]) {
    const f = fixture(context); f.open(); await f.advance(20000);
    if (scenario === "unverified") delete f.state.settings.tiktok.broadcaster.userId;
    f.visual(2, f.now(), 30000, { origin, ...(scenario === "rival-owner" ? { ownerUserId: RIVAL } : {}) },
      scenario === "no-room" ? { roomId: "" } : scenario === "rival-room" ? { roomId: "8081" } : {});
    await f.service.whenIdle(); assert.equal(f.calls.length, 0, `${origin}:${scenario}`);
    assert.equal(f.service.bonuses.periods.size, 0); assert.equal(f.state.matchSession.multiplier, 1);
  }
});

test("an available period is invalid after UID verification, room, team, start, account or profile changes", async (context) => {
  for (const change of [
    f => { delete f.state.settings.tiktok.broadcaster.userId; },
    f => { f.state.settings.tiktok.broadcaster.userId = RIVAL; },
    f => { f.state.settings.tiktok.roomId = "8081"; },
    f => { f.state.session.profileId = "other-profile"; },
    f => { f.state.settings.account.uid = "other-account"; },
    f => { f.state.matchSession.startedAtMs += 1; },
    f => { f.state.matchSession.teams = [{ id: "own-team", own: true, participantIds: [OWN] },
      { id: "rival-team", own: false, participantIds: [RIVAL] }]; }
  ]) {
    let release; const wait = new Promise((resolve) => { release = resolve; });
    const f = fixture(context, { holdEffect: wait }); f.open(); await f.service.whenIdle(); f.shiftClock(20000); f.visual(2);
    await Promise.resolve();
    assert.equal(f.contexts.length, 1); const key = f.service.bonuses.activeKey; assert.equal(f.service.bonuses.isActive(key), true);
    change(f); assert.equal(f.service.bonuses.isActive(key), false); f.service.bonuses.reconcile();
    assert.equal(f.service.bonuses.activeKey, ""); release(); await f.service.whenIdle(); assert.equal(f.calls.length, 0);
  }
});

test("merging late formal metadata keeps a queued visual effect valid, but cannot cross the real deadline", async (context) => {
  for (const expires of [false, true]) {
    let release; const wait = new Promise((resolve) => { release = resolve; });
    const f = fixture(context, { holdEffect: wait }); f.open(); await f.service.whenIdle(); f.shiftClock(20000); const start = f.now();
    f.visual(2); await Promise.resolve(); const key = f.service.bonuses.activeKey; assert.equal(f.contexts.length, 1);
    f.announce(start); f.settle(start); assert.equal(f.service.bonuses.activeKey, key); assert.equal(f.service.bonuses.isActive(key), true);
    if (expires) { f.shiftClock(30000); assert.equal(f.service.bonuses.isActive(key), false); }
    release(); await f.service.whenIdle(); assert.equal(f.calls.length, expires ? 0 : 1);
  }
});

test("new visual epochs matching a formal-bound period neither replay nor overwrite its formal timing", async (context) => {
  const f = fixture(context); f.open(); await f.advance(20000); const start = f.now();
  f.visual(2); f.announce(start); f.settle(start); await f.service.whenIdle();
  await f.advance(2000); f.visual(2, f.now(), 28000, { periodKey: "visual:new-epoch:1" }); await f.service.whenIdle();
  assert.equal(f.calls.length, 1); assert.equal(f.service.bonuses.periods.size, 1);
  const [period] = f.service.bonuses.periods.values(); assert.equal(period.startsAtMs, start); assert.equal(period.durationMs, 30000);
  f.visual(2, f.now(), 28000, { periodKey: "visual:new-epoch:1" }); await f.service.whenIdle();
  assert.equal(f.calls.length, 1); assert.equal(period.startsAtMs, start); assert.equal(period.durationMs, 30000);
});

test("a formal period's original confirmation scope cannot be rebound before merging with a later visual proof", async (context) => {
  for (const change of ["teams", "start"]) {
    const f = fixture(context); f.open(); await f.advance(20000); const start = f.now();
    f.announce(start, 2); f.settle(start); await f.service.whenIdle();
    if (change === "teams") f.state.matchSession.teams = [{ id: "own-team", own: true, participantIds: [OWN] },
      { id: "rival-team", own: false, participantIds: [RIVAL] }];
    else f.state.matchSession.startedAtMs += 1;
    f.service.bonuses.reconcile();
    await f.advance(1000); f.visual(2, f.now(), 29000); await f.service.whenIdle();
    assert.equal(f.service.bonuses.periods.size, 2, change);
    assert.equal([...f.service.bonuses.periods.values()].filter((row) => row.formalBound).length, 0,
      "Similar countdowns do not prove the same period across a different confirmation scope");
  }
});
