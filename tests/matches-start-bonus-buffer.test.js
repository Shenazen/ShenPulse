"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const sdk = require("tiktok-live-connector");
const { normalizeTikTokBattle } = require("../src/main/matches/tiktok-battle");
const { MatchesService } = require("../src/main/matches/service");
const { selectStatePaths } = require("../src/main/state-projection");
const { normalizeMatchesConfig, createMatchSession } = require("../src/shared/matches-contract");

// Synthetic protobuf data only. These tests reproduce delivery ordering, not
// evidence that a real observed LIVE emitted START_BONUS (target type 22).
const OWN = "9007199254740993123", RIVAL = "9007199254740993456";
const BASE = 1790000000000, PREFIX = "WebcastLinkmicBattleTaskMessage_";
const blank = (name, values = {}) => ({ ...sdk[name].decode(new Uint8Array()), ...values });
function fixture(context, { holdEffect } = {}) {
  let now = BASE, sequence = 0;
  const state = { settings: { account: { uid: "buffer-fixture", email: "fixture@example.invalid", refreshTokenSecretId: "fixture-secret" },
    tiktok: { username: "creator", roomId: "8080", status: "live", broadcaster: { userId: OWN, username: "creator" } },
    matches: normalizeMatchesConfig(), siteVisibility: {}, overlayConfigs: {} },
  connections: [{ id: "source_tiktok", type: "tiktok-direct", enabled: true, config: { username: "creator" } }],
  session: { running: true, profileId: "buffer-profile", startedAt: new Date(BASE).toISOString() },
  commerce: { subscription: { tier: "pro", status: "active" } }, matchSession: createMatchSession(), rules: [], profiles: [] };
  const timers = new Set(), calls = [], contexts = [];
  const store = { getStateProjection: (paths) => selectStatePaths(state, paths), getAccountSession: () => state.settings.account,
    getSecret: () => "fixture-only", mutate: (callback) => callback(state), mutateRuntime: (callback) => callback(state) };
  const service = new MatchesService({ store, now: () => now,
    actionRunner: { run: async (_action, event) => {
      contexts.push(event); if (holdEffect) await holdEffect;
      if (event.shouldExecute()) calls.push({ moment: event.data.moment, at: now });
      return { executed: true };
    } }, setTimeoutImpl: (callback, delay) => {
      const timer = { at: now + delay, callback, unref() {} }; timers.add(timer); return timer;
    }, clearTimeoutImpl: (timer) => timers.delete(timer) });
  context.after(() => service.reset());
  for (const moment of ["multiplierX2", "multiplierX3"]) service.saveAutomation({ id: moment, name: moment, moment,
    enabled: true, cooldownMs: 60000, reaction: { type: "sound", url: "https://example.invalid/synthetic.mp3" } });
  const common = () => blank("CommonMessageData", { roomId: "8080", msgId: String(++sequence), createTime: String(Math.floor(now / 1000)) });
  const frame = (name, value) => {
    const packet = sdk[name].decode(sdk[name].encode(blank(name, value)).finish());
    return { ...normalizeTikTokBattle(name, packet, { roomId: "8080", channelUsername: "creator", receivedAtMs: now }), source: "source_tiktok" };
  };
  const task = ({ multiplier = 2, battleId = "9001", startsAtMs = BASE + 20000, relative = false,
    duration = 30, targetType = 22 } = {}) => frame("WebcastLinkmicBattleTaskMessage", { common: common(), battleId, battleTaskMessageType: 0,
    taskStart: blank(`${PREFIX}BattleTaskStart`, { battleBonusConfig: blank(`${PREFIX}BattleTaskStart_BattleBonusConfig`, {
      taskPeriodConfig: blank(`${PREFIX}BattleTaskStart_BattleBonusConfig_TaskPeriodConfig`, { targetType }),
      rewardPeriodConfig: blank(`${PREFIX}BattleTaskStart_BattleBonusConfig_RewardPeriodConfig`, { rewardMultiple: multiplier,
        duration: String(duration), rewardStartTimestamp: relative ? "0" : String(startsAtMs), rewardStartTime: relative ? "280" : "0" })
    }) }) });
  const open = (battleId = "9001", phase = 4) => service.handle(frame("WebcastLinkMicBattle", { common: common(), battleId, action: phase,
    battleSetting: blank("BattleSetting", { battleId, startTimeMs: String(BASE), duration: 300 }),
    anchorInfo: Object.fromEntries([[OWN, "creator"], [RIVAL, "rival"]].map(([userId, displayId]) => [userId,
      blank("WebcastLinkMicBattle_BattleUserInfo", { user: blank("WebcastLinkMicBattle_BattleUserInfo_BattleBaseUserInfo", { userId, displayId }) })])) }));
  const update = () => service.handle({ source: "source_tiktok", phase: "update", battleId: "9001", roomId: "8080",
    channelUsername: "creator", id: String(++sequence), receivedAtMs: now, participants: [] });
  const settle = (type, result = 0) => service.handle(frame("WebcastLinkmicBattleTaskMessage", {
    common: common(), battleId: "9001", battleTaskMessageType: type,
    ...(type === 3 ? { rewardSettle: blank(`${PREFIX}BattleRewardSettle`, { status: 0 }) }
      : { taskSettle: blank(`${PREFIX}BattleTaskSettle`, { taskResult: result, rewardStartTimestamp: String(BASE + 70000) }) })
  }));
  const advance = async (milliseconds) => {
    const target = now + milliseconds;
    for (let limit = 0; limit < 1000; limit += 1) {
      const timer = [...timers].filter((row) => row.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!timer) { now = target; await service.whenIdle(); return; }
      now = timer.at; timers.delete(timer); timer.callback(); await service.whenIdle();
    }
    throw new Error("Synthetic timer loop must remain bounded");
  };
  return { state, service, calls, contexts, task, open, update, settle, advance, now: () => now };
}

for (const multiplier of [2, 3]) test(`explicit x${multiplier} received before OPEN waits for verified OPEN then starts at its own time`, async (context) => {
  const f = fixture(context), input = f.task({ multiplier });
  assert.equal(f.service.handle(input), false);
  assert.equal(f.service.bonuses.pendingStarts.size, 1);
  assert.equal(f.service.bonuses.periods.size, 0);
  assert.equal(f.state.matchSession.battleId, "");
  assert.equal(f.state.matchSession.multiplier, 1);
  assert.equal(f.service.timers.has("bonus:start"), false, "No activation timer before OPEN");
  input.bonus.multiplier = multiplier === 2 ? 3 : 2;
  input.bonus.durationMs = 1;
  await f.advance(1000); assert.deepEqual(f.calls, []);
  assert.equal(f.open(), true);
  assert.equal(f.service.bonuses.pendingStarts.size, 0);
  await f.advance(18999); assert.deepEqual(f.calls, []);
  await f.advance(1); assert.deepEqual(f.calls, [{ moment: `multiplierX${multiplier}`, at: BASE + 20000 }]);
  const duplicate = f.task({ multiplier });
  f.service.handle(duplicate); f.service.handle(duplicate); await f.service.whenIdle();
  assert.equal(f.calls.length, 1);
  await f.advance(30000); assert.equal(f.state.matchSession.multiplier, 1);
});

test("relative START_BONUS received before OPEN resolves only against the actual regulation end", async (context) => {
  const f = fixture(context); f.service.handle(f.task({ multiplier: 3, relative: true }));
  await f.advance(3000); f.open();
  f.service.handle({ source: "source_tiktok", phase: "update", roomId: "8080", channelUsername: "creator", battleId: "9001",
    id: "extra-time-fixture", receivedAtMs: f.now(), endsAtMs: BASE + 330000, participants: [] });
  await f.advance(17000);
  assert.deepEqual(f.calls, [{ moment: "multiplierX3", at: BASE + 20000 }]);
});

test("buffer requires primary enabled direct source, exact room/channel and fresh explicit data", (context) => {
  for (const change of ["foreign-source", "missing-source", "room", "missing-room", "channel", "missing-channel", "disabled", "relay", "extra-source", "missing-profile", "missing-live-start", "unsafe-owner", "expired", "stale-created", "stale-received", "test", "none", "unknown"]) {
    const f = fixture(context); const input = f.task();
    if (change === "foreign-source") input.source = "other";
    if (change === "missing-source") delete input.source;
    if (change === "room") input.roomId = "9090";
    if (change === "missing-room") input.roomId = "";
    if (change === "channel") input.channelUsername = "rival";
    if (change === "missing-channel") input.channelUsername = "";
    if (change === "disabled") f.state.connections[0].enabled = false;
    if (change === "relay") f.state.connections[0].type = "tiktok-relay";
    if (change === "extra-source") f.state.connections.push({ ...f.state.connections[0], id: "other" });
    if (change === "missing-profile") f.state.session.profileId = "";
    if (change === "missing-live-start") delete f.state.session.startedAt;
    if (change === "unsafe-owner") f.state.settings.tiktok.broadcaster.userId = Number(OWN);
    if (change === "expired") input.bonus.startsAtMs = BASE - 31000;
    if (change === "stale-created") input.bonus.createdAtMs = BASE - 31000;
    if (change === "stale-received") input.receivedAtMs = BASE - 6000;
    if (change === "test") input.test = true;
    if (change === "none") input.bonus = null;
    if (change === "unknown") input.bonus.multiplier = 5;
    f.service.handle(input);
    assert.equal(f.service.bonuses.pendingStarts.size, 0, change);
    assert.equal(f.service.bonuses.periods.size, 0, change);
  }
});

test("captured proof cannot cross account/profile/owner/source/room/LIVE changes before OPEN", async (context) => {
  for (const change of ["account", "profile", "room", "channel", "owner", "missing-owner", "source", "source-type", "live-start", "rights", "offline", "not-running", "disconnect"]) {
    const f = fixture(context); f.service.handle(f.task());
    if (change === "account") f.state.settings.account.uid = "other-account";
    if (change === "profile") f.state.session.profileId = "other-profile";
    if (change === "room") f.state.settings.tiktok.roomId = "9090";
    if (change === "channel") { f.state.settings.tiktok.username = "other"; f.state.connections[0].config.username = "other"; }
    if (change === "owner") f.state.settings.tiktok.broadcaster.userId = RIVAL;
    if (change === "missing-owner") delete f.state.settings.tiktok.broadcaster.userId;
    if (change === "source") f.state.connections[0].enabled = false;
    if (change === "source-type") f.state.connections[0].type = "tiktok-relay";
    if (change === "live-start") f.state.session.startedAt = new Date(BASE + 1).toISOString();
    if (change === "rights") f.state.commerce.subscription = { tier: "free", status: "free" };
    if (change === "offline") f.state.settings.tiktok.status = "offline";
    if (change === "not-running") f.state.session.running = false;
    if (change === "disconnect") f.service.disconnect();
    f.open(); await f.advance(60000);
    assert.deepEqual(f.calls, [], change);
    assert.equal(f.service.bonuses.pendingStarts.size, 0, change);
  }
});

test("unknown owner may be verified after OPEN but never activates without exact ownership", async (context) => {
  const f = fixture(context); delete f.state.settings.tiktok.broadcaster.userId;
  f.service.handle(f.task()); await f.advance(1000); f.open();
  assert.equal(f.service.bonuses.pendingStarts.size, 1);
  await f.advance(5000); assert.deepEqual(f.calls, []);
  f.state.settings.tiktok.broadcaster.userId = OWN; f.update();
  assert.equal(f.service.bonuses.pendingStarts.size, 0);
  await f.advance(14000);
  assert.deepEqual(f.calls, [{ moment: "multiplierX2", at: BASE + 20000 }]);
});

test("scores without OPEN do not consume or activate the pre-OPEN proof", async (context) => {
  const f = fixture(context); f.service.handle(f.task());
  f.service.handle({ source: "source_tiktok", phase: "update", battleId: "9001", roomId: "8080", channelUsername: "creator",
    id: "score-before-open", startsAtMs: BASE, endsAtMs: BASE + 300000, receivedAtMs: BASE,
    participants: [{ id: OWN, username: "creator", score: 0 }, { id: RIVAL, username: "rival", score: 0 }] });
  await f.advance(10000); assert.deepEqual(f.calls, []); assert.equal(f.service.bonuses.pendingStarts.size, 1);
  f.open(); await f.advance(10000);
  assert.deepEqual(f.calls, [{ moment: "multiplierX2", at: BASE + 20000 }]);
});

test("bounded queue expires after 30 seconds, does not attach to another battle, and reset releases all memory", async (context) => {
  const f = fixture(context);
  for (let index = 0; index < 20; index += 1) f.service.handle(f.task({ battleId: String(9001 + index) }));
  assert.equal(f.service.bonuses.pendingStarts.size, 8);
  assert.equal(f.service.bonuses.periods.size, 0);
  f.open("9999"); await f.advance(30000);
  assert.deepEqual(f.calls, []); assert.equal(f.service.bonuses.pendingStarts.size, 0);
  f.service.reset(); assert.equal(f.service.bonuses.blockedStarts.size, 0);
  const expired = fixture(context); expired.service.handle(expired.task({ startsAtMs: BASE + 40000 }));
  await expired.advance(30001); expired.open(); await expired.advance(10000);
  assert.deepEqual(expired.calls, []);
});

test("cancel/end/failed reward before OPEN retire the buffered proof without replay and leave later ordinary bonus intact", async (context) => {
  for (const terminal of ["cancel", "end", "reward-end", "failed"]) {
    const f = fixture(context); f.service.handle(f.task());
    if (terminal === "cancel") f.open("9001", 6);
    if (terminal === "end") f.open("9001", 5);
    if (terminal === "reward-end") f.settle(3);
    if (terminal === "failed") f.settle(2, 1);
    assert.equal(f.service.bonuses.pendingStarts.size, 0);
    f.open(); f.service.handle(f.task()); await f.advance(20000);
    assert.deepEqual(f.calls, [], terminal);
    if (terminal === "cancel") {
      f.service.handle(f.task({ relative: true }));
      f.service.handle(f.task({ startsAtMs: BASE + 21000 }));
      await f.advance(1000);
      assert.deepEqual(f.calls, [], "Cancelled battle cannot replay under a different time representation");
    }
    if (terminal === "end") continue; // Finished battle stays terminal.
    f.service.handle(f.task({ targetType: 1, startsAtMs: BASE + 70000, duration: 50 }));
    f.settle(2, 0); await f.advance(BASE + 70000 - f.now());
    assert.deepEqual(f.calls, [{ moment: "multiplierX2", at: BASE + 70000 }], terminal);
  }
});

test("async output rechecks captured source, LIVE epoch, owner, profile and rights after waiting", async (context) => {
  for (const change of ["source", "live-start", "owner", "profile", "rights"]) {
    let release; const holdEffect = new Promise((resolve) => { release = resolve; });
    context.after(() => release());
    const f = fixture(context, { holdEffect }); f.service.handle(f.task()); f.open();
    const pending = f.advance(20000); await new Promise(setImmediate);
    assert.equal(f.contexts.length, 1); assert.equal(f.contexts[0].shouldExecute(), true);
    if (change === "source") f.state.connections[0].enabled = false;
    if (change === "live-start") f.state.session.startedAt = new Date(BASE + 1).toISOString();
    if (change === "owner") f.state.settings.tiktok.broadcaster.userId = RIVAL;
    if (change === "profile") f.state.session.profileId = "other-profile";
    if (change === "rights") f.state.commerce.subscription = { tier: "free", status: "free" };
    assert.equal(f.contexts[0].shouldExecute(), false, change);
    release(); await pending; assert.deepEqual(f.calls, [], change);
  }
});
