"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const sdk = require("tiktok-live-connector");
const { normalizeTikTokBattle } = require("../src/main/matches/tiktok-battle");
const { MatchesService } = require("../src/main/matches/service");
const { selectStatePaths } = require("../src/main/state-projection");
const { normalizeMatchesConfig, createMatchSession } = require("../src/shared/matches-contract");
const { projectMatchesOverlayState } = require("../src/main/matches-overlay-state");

// Synthetic packets use the installed SDK's real codecs. No LIVE, media,
// account, network, clock setting or actual effect is involved.
const blank = (name, value = {}) => ({ ...sdk[name].decode(new Uint8Array()), ...value });
const decode = (name, value) => sdk[name].decode(sdk[name].encode(blank(name, value)).finish());
const PREFIX = "WebcastLinkmicBattleTaskMessage_";

function fixture(context, { clockOffsetMs = 0 } = {}) {
  let now = 1790000000000, sequence = 0;
  const beganAt = now, timers = new Set(), calls = [];
  const state = {
    settings: {
      account: { uid: "anchor-fixture", email: "fixture@example.invalid", refreshTokenSecretId: "fixture-secret" },
      siteVisibility: {}, matches: normalizeMatchesConfig(), overlayConfigs: {},
      tiktok: { username: "creator", roomId: "8080", status: "live", broadcaster: { userId: "111", username: "creator" } }
    },
    session: { running: true, profileId: "anchor-profile", startedAt: new Date(now).toISOString() },
    commerce: { subscription: { tier: "pro", status: "active" } },
    matchSession: createMatchSession(), rules: [], profiles: []
  };
  const store = {
    getStateProjection: (paths) => selectStatePaths(state, paths),
    getAccountSession: () => state.settings.account, getSecret: () => "fixture-only",
    mutate: (callback) => callback(state), mutateRuntime: (callback) => callback(state)
  };
  const service = new MatchesService({ store, now: () => now,
    actionRunner: { run: async (_action, event) => {
      if (event.shouldExecute()) calls.push({ moment: event.data.moment, at: now });
      return { executed: true };
    } },
    setTimeoutImpl: (callback, delay) => {
      const timer = { callback, at: now + delay, unref() {} }; timers.add(timer); return timer;
    }, clearTimeoutImpl: (timer) => timers.delete(timer)
  });
  context.after(() => service.reset());
  for (const moment of ["multiplierX2", "multiplierX3", "snipe"]) service.saveAutomation({
    id: moment, name: moment, moment, enabled: true, cooldownMs: 0, remainingSeconds: 15,
    reaction: { type: "sound", url: "https://media.example.invalid/fixture.mp3" }
  });
  const common = () => blank("CommonMessageData", { roomId: "8080", msgId: String(++sequence) });
  const setting = (extraSeconds, explicitEnd) => blank("BattleSetting", {
    battleId: "9001", startTimeMs: String(beganAt + clockOffsetMs), duration: 301,
    battleType: sdk.BattleType.BATTLE_TYPE_NORMAL_BATTLE,
    ...(extraSeconds === undefined ? {} : { extraDurationSecond: String(extraSeconds) }),
    ...(explicitEnd === undefined ? {} : { endTimeMs: String(explicitEnd + clockOffsetMs) })
  });
  const deliver = async (name, value, alterFrame) => {
    const frame = normalizeTikTokBattle(name, decode(name, value), {
      roomId: "8080", channelUsername: "creator", receivedAtMs: now, clockOffsetMs
    });
    assert.ok(frame);
    if (alterFrame) alterFrame(frame);
    assert.equal(service.handle({ ...frame, source: "source_tiktok" }), true);
    await service.whenIdle();
    return frame;
  };
  const open = (extraSeconds, explicitEnd) => deliver("WebcastLinkMicBattle", {
    common: common(), battleId: "9001", action: sdk.BattleAction.BATTLE_ACTION_OPEN,
    battleSetting: setting(extraSeconds, explicitEnd),
    anchorInfo: Object.fromEntries([["111", "creator"], ["333", "rival"]].map(([id, username]) => [id,
      blank("WebcastLinkMicBattle_BattleUserInfo", { user:
        blank("WebcastLinkMicBattle_BattleUserInfo_BattleBaseUserInfo", { userId: id, displayId: username }) })]))
  });
  const update = (extraSeconds, explicitEnd, alterFrame) => deliver("WebcastLinkMicArmies", {
    common: common(), battleId: "9001", battleStatus: sdk.TriggerReason.TRIGGER_REASON_SCORE_UPDATE,
    battleSettings: setting(extraSeconds, explicitEnd)
  }, alterFrame);
  const announce = (multiplier, { countdown = 94, initial = false, duration = 50 } = {}) =>
    deliver("WebcastLinkmicBattleTaskMessage", {
      common: common(), battleId: "9001", battleTaskMessageType: 0,
      taskStart: blank(`${PREFIX}BattleTaskStart`, {
        battleBonusConfig: blank(`${PREFIX}BattleTaskStart_BattleBonusConfig`, {
          taskPeriodConfig: blank(`${PREFIX}BattleTaskStart_BattleBonusConfig_TaskPeriodConfig`, { targetType: initial ? 22 : 1 }),
          rewardPeriodConfig: blank(`${PREFIX}BattleTaskStart_BattleBonusConfig_RewardPeriodConfig`, {
            rewardMultiple: multiplier, duration: String(duration), rewardStartTime: String(countdown),
            rewardStartTimestamp: String(beganAt + clockOffsetMs + 301000 - countdown * 1000 + 39000)
          })
        })
      })
    });
  const settle = () => deliver("WebcastLinkmicBattleTaskMessage", {
    common: common(), battleId: "9001", battleTaskMessageType: 2, taskSettle: blank(`${PREFIX}BattleTaskSettle`, { taskResult: 0 })
  });
  const advance = async (milliseconds) => {
    const target = now + milliseconds;
    for (let i = 0; i < 1000; i += 1) {
      const timer = [...timers].filter((row) => row.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!timer) { now = target; await service.whenIdle(); return; }
      now = timer.at; timers.delete(timer); timer.callback(); await service.whenIdle();
    }
    throw new Error("The anchor fixture must not produce an unbounded timer loop");
  };
  return { state, service, calls, beganAt, open, update, announce, settle, advance, now: () => now };
}

test("bonus natif : 30/40 secondes déjà ajoutées avant START ne retardent ni ×2 ni ×3", async (context) => {
  for (const extraSeconds of [30, 40]) for (const multiplier of [2, 3]) {
    const f = fixture(context, { clockOffsetMs: 2385 }), originalEnd = f.beganAt + 301000;
    const frame = await f.open(extraSeconds);
    assert.equal(frame.endsAtMs, originalEnd + extraSeconds * 1000);
    assert.equal(frame.bonusEndsAtMs, originalEnd);
    assert.equal(f.state.matchSession.bonusEndsAtMs, originalEnd);
    await f.advance(65000);
    const sparse = await f.update(0, originalEnd + extraSeconds * 1000);
    assert.equal(sparse.bonusEndsAtMs, originalEnd,
      "A later SDK default zero for extra time cannot make the extended end the original end");
    assert.equal(f.state.matchSession.bonusEndsAtMs, originalEnd);
    await f.announce(multiplier);
    await f.advance(80000); await f.settle();
    await f.advance(61999); assert.deepEqual(f.calls, [], "Early success does not itself activate the reward");
    await f.advance(1);
    assert.deepEqual(f.calls, [{ moment: `multiplierX${multiplier}`, at: originalEnd - 94000 }]);
    await f.advance(50000); assert.equal(f.state.matchSession.multiplier, 1);
    assert.equal(f.calls.length, 1, "Neither the extra duration nor the absolute forecast replays the effect");
  }
});

test("bonus initial type 22 relatif : la vraie valeur ×2/×3 démarre sans ajouter la prolongation", async (context) => {
  for (const multiplier of [2, 3]) {
    const f = fixture(context, { clockOffsetMs: 2385 }); await f.open(40);
    await f.announce(multiplier, { countdown: 281, initial: true, duration: 30 });
    await f.advance(19999); assert.deepEqual(f.calls, []);
    await f.advance(1);
    assert.deepEqual(f.calls, [{ moment: `multiplierX${multiplier}`, at: f.beganAt + 20000 }]);
    await f.advance(30000); assert.equal(f.state.matchSession.multiplier, 1);
    await f.advance(40000); assert.equal(f.calls.length, 1);
  }
});

test("bonus résolu puis prolongation : l'animation reste fixe mais Snipe et le chrono suivent la vraie fin", async (context) => {
  const f = fixture(context, { clockOffsetMs: 2385 }); await f.open();
  await f.advance(65000); await f.announce(2); await f.settle();
  await f.advance(50000); await f.update(40);
  const originalEnd = f.beganAt + 301000, actualEnd = originalEnd + 40000;
  assert.equal(f.state.matchSession.bonusEndsAtMs, originalEnd);
  assert.equal(f.service.status().runtime.endsAtMs, actualEnd);
  const projected = projectMatchesOverlayState(f.state, f.now());
  assert.equal(projected.session.timing.endsAtMs, actualEnd);
  assert.equal("bonusEndsAtMs" in projected.session, false, "The internal bonus anchor does not replace the public timer");
  await f.advance(91999); assert.deepEqual(f.calls, []);
  await f.advance(1); assert.deepEqual(f.calls, [{ moment: "multiplierX2", at: originalEnd - 94000 }]);
  await f.advance(79000); assert.equal(f.calls.length, 1, "No Snipe at the pre-extension end minus15s");
  await f.advance(39999); assert.equal(f.calls.length, 1);
  await f.advance(1);
  assert.deepEqual(f.calls[1], { moment: "snipe", at: actualEnd - 15000 });
});

test("sans durée supplémentaire : les paquets SDK historiques conservent leur ancre et échéance", async (context) => {
  const f = fixture(context), frame = await f.open();
  assert.equal(frame.bonusEndsAtMs, frame.endsAtMs);
  await f.announce(3); await f.settle();
  await f.advance(207000);
  assert.deepEqual(f.calls, [{ moment: "multiplierX3", at: f.beganAt + 207000 }]);
});

test("une preuve d'ancre malformée ou hors manche n'écrase pas la fin originale vérifiée", async (context) => {
  const f = fixture(context), originalEnd = f.beganAt + 301000, actualEnd = originalEnd + 40000;
  await f.open(40, actualEnd);
  for (const invalid of [undefined, null, false, [], {}, "1790000301000", 0, -1, 1e12, f.beganAt,
    f.beganAt - 1, actualEnd + 1, NaN, Infinity, originalEnd + 0.5]) {
    await f.update(40, actualEnd, (frame) => { frame.bonusEndsAtMs = invalid; });
    assert.equal(f.state.matchSession.bonusEndsAtMs, originalEnd);
    assert.equal(f.state.matchSession.endsAtMs, actualEnd);
  }
  await f.announce(2); await f.settle(); await f.advance(207000);
  assert.deepEqual(f.calls, [{ moment: "multiplierX2", at: originalEnd - 94000 }]);
});
