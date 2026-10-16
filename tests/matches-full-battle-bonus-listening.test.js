"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const sdk = require("tiktok-live-connector");
const { MatchesService } = require("../src/main/matches/service");
const { normalizeTikTokBattle } = require("../src/main/matches/tiktok-battle");
const { selectStatePaths } = require("../src/main/state-projection");
const { normalizeMatchesConfig, createMatchSession } = require("../src/shared/matches-contract");

// Codec -> normalizer -> actual service. Fake time, fixture account, inert
// action runner: no network, real media, LIVE contribution or computer input.
const OWN = "9007199254740993123", RIVAL = "9007199254740993456";
const PREFIX = "WebcastLinkmicBattleTaskMessage_";
const blank = (name, values = {}) => ({ ...sdk[name].decode(new Uint8Array()), ...values });
const codec = (name, values) => sdk[name].decode(sdk[name].encode(blank(name, values)).finish());

function fixture(context, { durationSeconds = 301, holdEffect } = {}) {
  let now = 1790000000000, sequence = 0;
  const start = now, timers = new Set(), calls = [], contexts = [];
  const state = {
    settings: {
      account: { uid: "timeline-fixture", email: "fixture@example.invalid", refreshTokenSecretId: "fixture-secret" },
      tiktok: { username: "creator", roomId: "8080", status: "live", broadcaster: { userId: OWN, username: "creator" } },
      siteVisibility: {}, overlayConfigs: {}, matches: normalizeMatchesConfig()
    },
    commerce: { subscription: { tier: "pro", status: "active" } },
    session: { running: true, profileId: "timeline-profile", startedAt: new Date(now).toISOString() },
    matchSession: createMatchSession(), profiles: [], rules: []
  };
  const store = {
    getStateProjection: (paths) => selectStatePaths(state, paths), getAccountSession: () => state.settings.account,
    getSecret: () => "fixture-only", mutate: (callback) => callback(state), mutateRuntime: (callback) => callback(state)
  };
  const service = new MatchesService({ store, now: () => now,
    actionRunner: { run: async (_action, event) => {
      contexts.push(event);
      if (holdEffect) await holdEffect;
      if (event.shouldExecute()) calls.push({ moment: event.data.moment, at: now });
      return { executed: true };
    } },
    setTimeoutImpl: (callback, delay) => {
      const timer = { at: now + delay, callback, unref() {} }; timers.add(timer); return timer;
    }, clearTimeoutImpl: (timer) => timers.delete(timer)
  });
  context.after(() => service.reset());
  // Even a long automation cooldown must not suppress separate proven periods.
  for (const moment of ["multiplierX2", "multiplierX3"]) service.saveAutomation({
    id: moment, name: moment, moment, enabled: true, cooldownMs: 60000,
    reaction: { type: "sound", url: "https://media.example.invalid/fixture.mp3" }
  });
  const common = (roomId = "8080") => blank("CommonMessageData", { roomId, msgId: String(++sequence) });
  const normalize = (name, values) => {
    const frame = normalizeTikTokBattle(name, codec(name, values), {
      roomId: "8080", channelUsername: "creator", receivedAtMs: now
    });
    return frame ? { ...frame, source: "source_tiktok" } : null;
  };
  const send = async (name, values) => {
    const frame = normalize(name, values);
    const accepted = frame ? service.handle(frame) : false; await service.whenIdle(); return accepted;
  };
  const open = (battleId = "9001", startedAtMs = start) => send("WebcastLinkMicBattle", {
    common: common(), battleId, action: sdk.BattleAction.BATTLE_ACTION_OPEN,
    battleSetting: blank("BattleSetting", { battleId, startTimeMs: String(startedAtMs), duration: durationSeconds,
      battleType: sdk.BattleType.BATTLE_TYPE_NORMAL_BATTLE }),
    anchorInfo: Object.fromEntries([[OWN, "creator"], [RIVAL, "rival"]].map(([userId, displayId]) => [userId,
      blank("WebcastLinkMicBattle_BattleUserInfo", { user:
        blank("WebcastLinkMicBattle_BattleUserInfo_BattleBaseUserInfo", { userId, displayId }) })]))
  });
  const task = (type, { battleId = "9001", roomId = "8080", multiplier = 2,
    atMs, seconds = 1, result = 0 } = {}) => {
    const currentStart = state.matchSession.startedAtMs || start;
    const countdown = Math.max(0, Math.floor(durationSeconds - (atMs - currentStart) / 1000));
    return send("WebcastLinkmicBattleTaskMessage", {
      common: common(roomId), battleId, battleTaskMessageType: type,
      ...(type === 0 ? { taskStart: blank(`${PREFIX}BattleTaskStart`, {
        battleBonusConfig: blank(`${PREFIX}BattleTaskStart_BattleBonusConfig`, {
          taskPeriodConfig: blank(`${PREFIX}BattleTaskStart_BattleBonusConfig_TaskPeriodConfig`, { targetType: 1 }),
          rewardPeriodConfig: blank(`${PREFIX}BattleTaskStart_BattleBonusConfig_RewardPeriodConfig`, {
            rewardMultiple: multiplier, duration: String(seconds), rewardStartTime: String(countdown),
            rewardStartTimestamp: String(atMs)
          })
        })
      }) } : { taskSettle: blank(`${PREFIX}BattleTaskSettle`, {
        taskResult: result, rewardStartTime: String(countdown), rewardStartTimestamp: String(atMs)
      }) })
    });
  };
  const confirm = async (values) => { await task(0, values); await task(2, values); };
  const advance = async (milliseconds) => {
    const target = now + milliseconds;
    for (let index = 0; index < 2000; index += 1) {
      const timer = [...timers].filter((item) => item.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!timer) { now = target; await service.whenIdle(); return; }
      now = timer.at; timers.delete(timer); timer.callback(); await service.whenIdle();
    }
    throw new Error("Full-battle fixture timer loop is unexpectedly unbounded");
  };
  return { state, service, calls, contexts, start, durationSeconds, open, task, confirm, advance,
    now: () => now, shiftClock: (milliseconds) => { now += milliseconds; } };
}

for (const multiplier of [2, 3]) test(`continuous bonus listening: confirmed x${multiplier} activates at every second +1 through +299`, async (context) => {
  for (let second = 1; second <= 299; second += 1) {
    const f = fixture(context, { durationSeconds: 300 }); await f.open();
    const atMs = f.start + second * 1000;
    await f.advance(second * 1000);
    assert.deepEqual(f.calls, [], `Elapsed time alone does not invent x${multiplier} at +${second}s`);
    await f.confirm({ atMs, multiplier });
    assert.deepEqual(f.calls, [{ moment: `multiplierX${multiplier}`, at: atMs }],
      `x${multiplier} first received active at +${second}s starts immediately without another event or a listening window`);
    assert.equal(f.state.matchSession.multiplier, multiplier);
    f.service.reset();
  }
});

test("continuous bonus listening: first second, repeated x2/x3 cycles and final second need no score packet", async (context) => {
  const f = fixture(context); assert.equal(await f.open(), true);
  const periods = [[1, 2], [17, 2], [46, 3], [118, 2], [209, 3], [300, 2]];
  for (const [offsetSeconds, multiplier] of periods) {
    const atMs = f.start + offsetSeconds * 1000;
    await f.confirm({ atMs, multiplier });
    // Duplicate announcements and confirmations carry new message IDs but
    // remain the same reward period, not another animation.
    await f.confirm({ atMs, multiplier });
    const count = f.calls.length;
    await f.advance(atMs - f.now() - 1);
    assert.equal(f.calls.length, count, "A confirmed future reward must not start early");
    await f.advance(1);
    assert.deepEqual(f.calls.at(-1), { moment: `multiplierX${multiplier}`, at: atMs });
    assert.equal(f.calls.length, count + 1, "Every distinct confirmed period starts exactly once");
    assert.equal(f.state.matchSession.multiplier, multiplier);
    await f.advance(1000);
    assert.equal(f.state.matchSession.multiplier, 1, `Reward ending at offset ${offsetSeconds + 1}s resets its multiplier`);
  }
  assert.deepEqual(f.calls.map((item) => item.moment), periods.map(([, multiplier]) => `multiplierX${multiplier}`));
});

test("continuous bonus listening: time alone, unconfirmed challenge and opponent-only failure never invent a multiplier", async (context) => {
  const f = fixture(context); await f.open();
  await f.advance(20000); assert.deepEqual(f.calls, [], "There is no inferred bonus at +20 seconds");
  await f.task(0, { atMs: f.start + 21000, multiplier: 3, seconds: 30 });
  await f.advance(1000); assert.deepEqual(f.calls, [], "The challenge announcement is not activation");
  await f.task(2, { atMs: f.start + 21000, multiplier: 3, seconds: 30, result: 1 });
  await f.advance(100000); assert.deepEqual(f.calls, [], "An opponent-only win leaves the own task FAILED");
  await f.confirm({ atMs: f.start + 150000, multiplier: 2, roomId: "9090" });
  await f.advance(180000); assert.deepEqual(f.calls, [], "A foreign-room task cannot attach to the current match");
  assert.equal(f.state.matchSession.multiplier, 1);
});

test("continuous bonus listening: first notification at match end or after it cannot execute", async (context) => {
  for (const milliseconds of [301000, 301001, 340000]) {
    const f = fixture(context); await f.open(); await f.advance(milliseconds);
    await f.confirm({ atMs: f.now(), multiplier: 2, seconds: 10 });
    await f.advance(1000); assert.deepEqual(f.calls, [], `Rejected at match offset ${milliseconds}ms`);
    assert.equal(f.state.matchSession.multiplier, 1);
  }
});

test("continuous bonus listening: disconnect cancels old timers and next match can detect a first-second x3", async (context) => {
  const f = fixture(context); await f.open();
  await f.confirm({ atMs: f.start + 17000, multiplier: 2, seconds: 30 });
  await f.advance(5000); f.service.disconnect(); f.state.settings.tiktok.status = "disconnected";
  await f.advance(13000); assert.deepEqual(f.calls, [], "No old reward may execute after disconnection");
  f.state.settings.tiktok.status = "live";
  const nextStart = f.now(); await f.open("9002", nextStart);
  await f.confirm({ atMs: nextStart + 1000, multiplier: 3, seconds: 1, battleId: "9002" });
  await f.advance(999); assert.deepEqual(f.calls, []);
  await f.advance(1); assert.deepEqual(f.calls, [{ moment: "multiplierX3", at: nextStart + 1000 }]);
  await f.advance(1000); assert.equal(f.state.matchSession.multiplier, 1);
});

test("continuous bonus listening: a deferred final-second reaction is invalid at match end even without timer delivery", async (context) => {
  let release;
  const holdEffect = new Promise((resolve) => { release = resolve; });
  context.after(() => release());
  const f = fixture(context, { durationSeconds: 300, holdEffect }); await f.open();
  await f.confirm({ atMs: f.start + 299000, multiplier: 3, seconds: 30 });
  f.shiftClock(299000); f.service.bonuses.reconcile();
  assert.equal(f.contexts.length, 1);
  const event = f.contexts[0], key = f.service.bonuses.activeKey;
  assert.equal(event.shouldExecute(), true); assert.equal(f.service.bonuses.isActive(key), true);
  f.shiftClock(1000);
  assert.equal(f.service.bonuses.isActive(key), false, "Proof expiry must not depend on delivering an end timer");
  assert.equal(event.shouldExecute(), false, "An asynchronous output cannot cross the real match deadline");
  release(); await f.service.whenIdle(); assert.deepEqual(f.calls, []);
});
