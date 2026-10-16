"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const sdk = require("tiktok-live-connector");
const { normalizeTikTokBattle } = require("../src/main/matches/tiktok-battle");
const { MatchesService } = require("../src/main/matches/service");
const { selectStatePaths } = require("../src/main/state-projection");
const { normalizeMatchesConfig, createMatchSession } = require("../src/shared/matches-contract");

// Les paquets passent par les vrais codecs installés. Les résultats SUCCEED /
// FAILED sont ceux de la salle connectée : aucun champ bénéficiaire inventé,
// aucun LIVE, média, compte réel ou appel réseau dans cette fixture.
const blank = (name, input = {}) => ({ ...sdk[name].decode(new Uint8Array()), ...input });
const roundtrip = (name, input) => sdk[name].decode(sdk[name].encode(blank(name, input)).finish());
const PREFIX = "WebcastLinkmicBattleTaskMessage_";
const PERIOD = `${PREFIX}BattleTaskStart_BattleBonusConfig_RewardPeriodConfig`;

const initialBonus = (f, multiplier, startsAtMs, roomId = "8080") => ({
  common: f.common(roomId), battleId: "9001", battleTaskMessageType: 0,
  taskStart: blank(`${PREFIX}BattleTaskStart`, {
    battleBonusConfig: blank(`${PREFIX}BattleTaskStart_BattleBonusConfig`, {
      taskPeriodConfig: blank(`${PREFIX}BattleTaskStart_BattleBonusConfig_TaskPeriodConfig`, { targetType: 22 }),
      rewardPeriodConfig: blank(PERIOD, { rewardMultiple: multiplier, duration: "30",
        rewardStartTime: "0", rewardStartTimestamp: String(startsAtMs / 1000) })
    })
  })
});

function fixture(context, { clockOffsetMs = 0 } = {}) {
  let now = 1790000000000, sequence = 0;
  const state = {
    settings: {
      account: { uid: "bonus-fixture", email: "fixture@example.invalid", refreshTokenSecretId: "fixture-secret" },
      siteVisibility: {},
      tiktok: { username: "creator", broadcaster: { username: "creator", userId: "111" }, roomId: "8080", status: "live" },
      matches: normalizeMatchesConfig(), overlayConfigs: {}
    },
    session: { running: true, profileId: "bonus-profile", startedAt: new Date(now).toISOString() },
    commerce: { subscription: { tier: "pro", status: "active" } },
    matchSession: createMatchSession(), rules: [], profiles: [{ id: "bonus-profile", enabledRuleIds: [] }]
  };
  const calls = [], timers = new Set();
  const store = {
    getStateProjection: (paths) => selectStatePaths(state, paths),
    getAccountSession: () => state.settings.account, getSecret: () => "fixture-only",
    mutateRuntime: (callback) => callback(state), mutate: (callback) => callback(state)
  };
  const service = new MatchesService({
    store, now: () => now,
    actionRunner: { run: async (_action, event) => {
      if (event.shouldExecute()) calls.push({ moment: event.data.moment, at: now });
      return { executed: true };
    } },
    setTimeoutImpl: (callback, delay) => {
      const timer = { callback, at: now + delay, unref() {} }; timers.add(timer); return timer;
    },
    clearTimeoutImpl: (timer) => timers.delete(timer)
  });
  context.after(() => service.reset());
  for (const moment of ["multiplierX2", "multiplierX3"]) service.saveAutomation({
    id: moment, name: moment, moment, enabled: true, cooldownMs: 0,
    reaction: { type: "sound", url: "https://media.example.invalid/fixture.mp3" }
  });
  const common = (roomId = "8080") => blank("CommonMessageData", { roomId, msgId: String(++sequence) });
  const deliver = async (name, input, handled = true) => {
    const packet = roundtrip(name, input);
    const frame = normalizeTikTokBattle(name, packet, { roomId: "8080", channelUsername: "creator", receivedAtMs: now, clockOffsetMs });
    assert.ok(frame, "Le vrai paquet protobuf doit être normalisé");
    assert.equal(service.handle({ ...frame, source: "source_tiktok" }), handled);
    await service.whenIdle();
    return packet;
  };
  const open = () => deliver("WebcastLinkMicBattle", {
    common: common(), battleId: "9001", action: sdk.BattleAction.BATTLE_ACTION_OPEN,
    battleSetting: blank("BattleSetting", { battleId: "9001", startTimeMs: String(now + clockOffsetMs), duration: 300,
      battleType: sdk.BattleType.BATTLE_TYPE_NORMAL_BATTLE }),
    anchorInfo: Object.fromEntries([["111", "creator"], ["333", "rival"]].map(([id, displayId]) => [id,
      blank("WebcastLinkMicBattle_BattleUserInfo", {
        user: blank("WebcastLinkMicBattle_BattleUserInfo_BattleBaseUserInfo", { userId: id, displayId })
      })]))
  });
  const announce = (startsAtMs, multiplier = 2, durationSeconds = 10, handled = true) => deliver("WebcastLinkmicBattleTaskMessage", {
    common: common(), battleId: "9001", battleTaskMessageType: sdk.BattleTaskMessageType.BATTLE_TASK_MESSAGE_TYPE_START,
    taskStart: blank(`${PREFIX}BattleTaskStart`, {
      battleBonusConfig: blank(`${PREFIX}BattleTaskStart_BattleBonusConfig`, {
        rewardPeriodConfig: blank(PERIOD, { rewardMultiple: multiplier, duration: String(durationSeconds),
          rewardStartTimestamp: String(startsAtMs), rewardStartTime: "0" })
      })
    })
  }, handled);
  const settle = (startsAtMs, taskResult, handled = true) => deliver("WebcastLinkmicBattleTaskMessage", {
    common: common(), battleId: "9001", battleTaskMessageType: sdk.BattleTaskMessageType.BATTLE_TASK_MESSAGE_TYPE_TASK_SETTLE,
    taskSettle: blank(`${PREFIX}BattleTaskSettle`, { taskResult, rewardStartTimestamp: String(startsAtMs), rewardStartTime: "0" })
  }, handled);
  const endReward = (createdAtMs) => deliver("WebcastLinkmicBattleTaskMessage", {
    common: { ...common(), ...(createdAtMs === undefined ? {} : { createTime: String(Math.floor(createdAtMs / 1000)) }) }, battleId: "9001",
    battleTaskMessageType: sdk.BattleTaskMessageType.BATTLE_TASK_MESSAGE_TYPE_REWARD_SETTLE,
    rewardSettle: blank(`${PREFIX}BattleRewardSettle`, { status: sdk.RewardStatus.REWARD_STATUS_SUCCEED })
  });
  const advance = async (milliseconds) => {
    const target = now + milliseconds;
    for (let processed = 0; processed < 1000; processed += 1) {
      const timer = [...timers].filter((entry) => entry.at <= target).sort((left, right) => left.at - right.at)[0];
      if (!timer) { now = target; await service.whenIdle(); return; }
      now = timer.at; timers.delete(timer); timer.callback(); await service.whenIdle();
    }
    throw new Error("La fixture ne doit pas créer de boucle de minuteries.");
  };
  return { state, service, calls, open, announce, settle, endReward, advance, deliver, common, now: () => now };
}

test("bonus protobuf : une date SETTLE en secondes Unix remplace la prévision 39 s trop tardive", async (context) => {
  for (const multiplier of [2, 3]) {
    const delta = 2385, f = fixture(context, { clockOffsetMs: delta }); await f.open();
    const serverStart = f.now() + 40000, localStart = serverStart - delta;
    await f.announce(serverStart + 39000, multiplier, 50);
    await f.deliver("WebcastLinkmicBattleTaskMessage", {
      common: f.common(), battleId: "9001", battleTaskMessageType: 2,
      taskSettle: blank(`${PREFIX}BattleTaskSettle`, { taskResult: 0,
        rewardStartTime: "0", rewardStartTimestamp: String(serverStart / 1000) })
    });
    await f.advance(localStart - f.now() - 1); assert.deepEqual(f.calls, []);
    await f.advance(1);
    assert.deepEqual(f.calls, [{ moment: `multiplierX${multiplier}`, at: localStart }]);
    await f.advance(39000); assert.equal(f.calls.length, 1, "Ni ancien horaire ni prochaine mise à jour des scores nécessaires");
    await f.advance(11000); assert.equal(f.state.matchSession.multiplier, 1);
  }
});

test("bonus protobuf : le succès vide observé arme le vrai horaire sans jouer pendant bientôt disponible", async (context) => {
  const f = fixture(context), beganAt = f.now(); await f.open();
  const rewardAt = beganAt + 206000;
  await f.deliver("WebcastLinkmicBattleTaskMessage", {
    common: f.common(), battleId: "9001", battleTaskMessageType: 0,
    taskStart: blank(`${PREFIX}BattleTaskStart`, {
      battleBonusConfig: blank(`${PREFIX}BattleTaskStart_BattleBonusConfig`, {
        rewardPeriodConfig: blank(PERIOD, { rewardMultiple: 2, duration: "50",
          rewardStartTimestamp: String(rewardAt / 1000), rewardStartTime: "94" })
      })
    })
  });
  await f.advance(153000);
  await f.deliver("WebcastLinkmicBattleTaskMessage", {
    common: f.common(), battleId: "9001", battleTaskMessageType: 2,
    taskSettle: blank(`${PREFIX}BattleTaskSettle`)
  });
  await f.advance(52999); assert.deepEqual(f.calls, [], "SETTLE vide n'est pas une activation immédiate");
  await f.advance(1); assert.deepEqual(f.calls, [{ moment: "multiplierX2", at: rewardAt }]);
  await f.advance(50000); assert.equal(f.state.matchSession.multiplier, 1);
});

test("bonus protobuf : le compte à rebours natif évite une prévision absolue 39 s en retard, sans double décalage d'horloge", async (context) => {
  for (const multiplier of [2, 3]) for (const explicitSettlement of [false, true]) {
    const delta = 2385, f = fixture(context, { clockOffsetMs: delta }); await f.open();
    const beganAt = f.now(), rewardAt = beganAt + 166000;
    const lateForecastServerAt = rewardAt + delta + 39000;
    await f.deliver("WebcastLinkmicBattleTaskMessage", {
      common: f.common(), battleId: "9001", battleTaskMessageType: 0,
      taskStart: blank(`${PREFIX}BattleTaskStart`, {
        battleBonusConfig: blank(`${PREFIX}BattleTaskStart_BattleBonusConfig`, {
          rewardPeriodConfig: blank(PERIOD, { rewardMultiple: multiplier, duration: "50",
            rewardStartTime: explicitSettlement ? "100" : "134", rewardStartTimestamp: String(lateForecastServerAt) })
        })
      })
    });
    await f.advance(150000); assert.deepEqual(f.calls, [], "L'annonce seule ne prouve jamais un bonus gagné");
    await f.deliver("WebcastLinkmicBattleTaskMessage", {
      common: f.common(), battleId: "9001", battleTaskMessageType: 2,
      taskSettle: blank(`${PREFIX}BattleTaskSettle`, { taskResult: 0,
        ...(explicitSettlement ? { rewardStartTime: "134", rewardStartTimestamp: String(lateForecastServerAt) } : {}) })
    });
    await f.advance(15999); assert.deepEqual(f.calls, [], "Un succès précoce n'est pas encore le début du bonus");
    await f.advance(1);
    assert.deepEqual(f.calls, [{ moment: `multiplierX${multiplier}`, at: rewardAt }],
      "La fin du match déjà locale fournit l'ancre ; le décalage serveur ne s'applique pas une seconde fois");
    await f.advance(39000); assert.equal(f.calls.length, 1, "L'ancien horaire absolu ne rejoue pas le bonus");
    await f.advance(11000); assert.equal(f.state.matchSession.multiplier, 1);
  }
});

test("bonus protobuf initial : seul le vrai type 22 de la salle propre joue sa valeur ×2 ou ×3, sans SETTLE", async (context) => {
  for (const [multiplier, elapsed] of [[2, 17000], [3, 26000]]) {
    const f = fixture(context), startsAtMs = f.now() + elapsed; await f.open();
    await f.deliver("WebcastLinkmicBattleTaskMessage", initialBonus(f, multiplier, startsAtMs));
    await f.advance(elapsed - 1); assert.deepEqual(f.calls, []);
    await f.advance(1); assert.deepEqual(f.calls, [{ moment: `multiplierX${multiplier}`, at: startsAtMs }]);
    await f.deliver("WebcastLinkmicBattleTaskMessage", initialBonus(f, multiplier, startsAtMs));
    assert.equal(f.calls.length, 1);
    await f.advance(30000); assert.equal(f.state.matchSession.multiplier, 1);
  }
});

test("bonus protobuf initial : aucune animation sans valeur, salle explicite ou UID vérifié", async (context) => {
  for (const scenario of ["none", "x1", "no-room", "no-source-room", "unverified-owner"]) {
    const f = fixture(context); await f.open();
    if (scenario === "unverified-owner") delete f.state.settings.tiktok.broadcaster.userId;
    if (scenario === "no-source-room") {
      const data = roundtrip("WebcastLinkmicBattleTaskMessage", initialBonus(f, 2, f.now() + 20000));
      assert.equal(normalizeTikTokBattle("linkMicBattleTask", data, { channelUsername: "creator" }).bonus, null);
    } else if (scenario !== "none") await f.deliver("WebcastLinkmicBattleTaskMessage",
      initialBonus(f, scenario === "x1" ? 1 : 2, f.now() + 20000, scenario === "no-room" ? "0" : "8080"));
    await f.advance(60000); assert.deepEqual(f.calls, [], scenario);
  }
});

test("bonus protobuf : un échec reste terminal pour la même fenêtre, entre défi ordinaire et START_BONUS", async (context) => {
  for (const failedFirst of [true, false]) {
    const f = fixture(context); await f.open(); const startsAtMs = f.now() + 20000;
    if (failedFirst) {
      await f.announce(startsAtMs, 2, 30);
      await f.settle(startsAtMs, 1);
      await f.deliver("WebcastLinkmicBattleTaskMessage", initialBonus(f, 2, startsAtMs));
    } else {
      await f.deliver("WebcastLinkmicBattleTaskMessage", initialBonus(f, 2, startsAtMs));
      await f.settle(startsAtMs, 1);
    }
    await f.advance(20000); assert.deepEqual(f.calls, []);
    assert.equal(f.service.bonuses.periods.size, 1, "Les deux messages prouvent la même fenêtre, sans clé artificielle");
  }
});

test("bonus protobuf : une annonce puis FAILED dans la salle connectée ne déclenchent aucun x2", async (context) => {
  const f = fixture(context); await f.open();
  const rewardAt = f.now() + 10000;
  await f.announce(rewardAt);
  assert.deepEqual(f.calls, [], "L'annonce seule n'est pas une récompense acquise");
  await f.settle(rewardAt, sdk.WebcastLinkmicBattleTaskMessage_BattleTaskSettle_Result.RESULT_FAILED);
  await f.advance(20000);
  assert.deepEqual(f.calls, [], "Un bonus non gagné dans cette salle ne doit pas jouer sur son LIVE");
  assert.equal(f.state.matchSession.multiplier, 1);
});

test("bonus protobuf : SUCCEED sans taskStart répété retrouve la configuration et joue une seule fois à la date réelle", async (context) => {
  const f = fixture(context); await f.open();
  const rewardAt = f.now() + 10000;
  await f.announce(rewardAt, 3, 10);
  const settled = await f.settle(rewardAt, sdk.WebcastLinkmicBattleTaskMessage_BattleTaskSettle_Result.RESULT_SUCCEED);
  assert.equal(settled.taskStart, undefined, "La fixture ne réinjecte pas artificiellement la configuration dans le règlement");
  await f.advance(9999); assert.deepEqual(f.calls, []);
  await f.advance(1);
  assert.deepEqual(f.calls, [{ moment: "multiplierX3", at: rewardAt }]);
  assert.equal(f.state.matchSession.multiplier, 3);
  await f.settle(rewardAt, sdk.WebcastLinkmicBattleTaskMessage_BattleTaskSettle_Result.RESULT_SUCCEED);
  await f.advance(1000);
  await f.settle(rewardAt, sdk.WebcastLinkmicBattleTaskMessage_BattleTaskSettle_Result.RESULT_SUCCEED);
  assert.equal(f.calls.length, 1, "Des règlements répétés avec de nouveaux msgId ne rejouent pas la même période");
});

test("bonus protobuf : après un premier FAILED, deux périodes x2 gagnées distinctes se jouent chacune", async (context) => {
  const f = fixture(context); await f.open();
  const failedAt = f.now() + 10000;
  await f.announce(failedAt);
  await f.settle(failedAt, sdk.WebcastLinkmicBattleTaskMessage_BattleTaskSettle_Result.RESULT_FAILED);
  await f.advance(20000); assert.deepEqual(f.calls, []);
  const expected = [];
  for (let period = 0; period < 2; period += 1) {
    const rewardAt = f.now() + 5000;
    await f.announce(rewardAt, 2, 5);
    await f.settle(rewardAt, sdk.WebcastLinkmicBattleTaskMessage_BattleTaskSettle_Result.RESULT_SUCCEED);
    await f.advance(5000);
    expected.push({ moment: "multiplierX2", at: rewardAt });
    assert.deepEqual(f.calls, expected, "Une autre période du même multiplicateur n'est pas supprimée comme doublon");
    await f.advance(5000); assert.equal(f.state.matchSession.multiplier, 1);
  }
});

test("bonus protobuf : BOTH_SUCCEED comprend la salle connectée sans inventer d'identifiants bénéficiaires", async (context) => {
  const f = fixture(context); await f.open();
  const rewardAt = f.now() + 10000;
  await f.announce(rewardAt, 2, 10);
  await f.settle(rewardAt, sdk.WebcastLinkmicBattleTaskMessage_BattleTaskSettle_Result.RESULT_BOTH_SUCCEED);
  await f.advance(10000);
  assert.deepEqual(f.calls, [{ moment: "multiplierX2", at: rewardAt }]);
  assert.equal(f.state.matchSession.ownUserId, "111");
});

test("bonus protobuf : la première tâche arrivée avant OPEN attend le vrai match puis conserve son règlement", async (context) => {
  const f = fixture(context), rewardAt = f.now() + 10000;
  await f.announce(rewardAt, 2, 10, false);
  await f.settle(rewardAt, sdk.WebcastLinkmicBattleTaskMessage_BattleTaskSettle_Result.RESULT_SUCCEED, false);
  assert.equal(f.state.matchSession.battleId, "", "Des tâches seules ne créent jamais un match");
  assert.deepEqual(f.calls, []);
  await f.advance(1000); await f.open();
  await f.advance(8999); assert.deepEqual(f.calls, []);
  await f.advance(1);
  assert.deepEqual(f.calls, [{ moment: "multiplierX2", at: rewardAt }]);
  assert.equal(f.state.matchSession.battleId, "9001");
});

test("bonus protobuf : une nouvelle période x2 gagnée reste distincte même si le multiplicateur affiché vaut déjà deux", async (context) => {
  const f = fixture(context); await f.open();
  const firstAt = f.now() + 1000;
  await f.announce(firstAt, 2, 30);
  await f.settle(firstAt, sdk.WebcastLinkmicBattleTaskMessage_BattleTaskSettle_Result.RESULT_SUCCEED);
  await f.advance(1000); assert.equal(f.state.matchSession.multiplier, 2);
  const secondAt = f.now() + 10000;
  await f.announce(secondAt, 2, 10);
  await f.settle(secondAt, sdk.WebcastLinkmicBattleTaskMessage_BattleTaskSettle_Result.RESULT_SUCCEED);
  await f.advance(10000);
  assert.deepEqual(f.calls, [{ moment: "multiplierX2", at: firstAt }, { moment: "multiplierX2", at: secondAt }]);
});

test("bonus protobuf : un règlement tardif dont la période est déjà expirée ne rejoue pas une animation", async (context) => {
  const f = fixture(context); await f.open();
  const rewardAt = f.now() + 1000;
  await f.announce(rewardAt, 2, 5);
  await f.advance(10000);
  assert.deepEqual(f.calls, [], "Le début prévu sans réussite confirmée ne suffit pas");
  await f.settle(rewardAt, sdk.WebcastLinkmicBattleTaskMessage_BattleTaskSettle_Result.RESULT_SUCCEED);
  assert.deepEqual(f.calls, []);
  assert.equal(f.state.matchSession.multiplier, 1);
});

test("bonus protobuf : une fin créée avant la nouvelle période ne coupe pas son bonus si elle arrive en retard", async (context) => {
  const f = fixture(context); await f.open();
  const firstAt = f.now() + 1000, firstEnd = firstAt + 5000;
  await f.announce(firstAt, 2, 5);
  await f.settle(firstAt, sdk.WebcastLinkmicBattleTaskMessage_BattleTaskSettle_Result.RESULT_SUCCEED);
  await f.advance(6000); assert.equal(f.state.matchSession.multiplier, 1);
  const secondAt = f.now() + 1000;
  await f.announce(secondAt, 2, 10);
  await f.settle(secondAt, sdk.WebcastLinkmicBattleTaskMessage_BattleTaskSettle_Result.RESULT_SUCCEED);
  await f.advance(1000); assert.equal(f.state.matchSession.multiplier, 2);
  await f.endReward(firstEnd);
  assert.equal(f.state.matchSession.multiplier, 2,
    "Le vrai common.createTime prouve que cette fin ne concerne pas la période commencée après");
  assert.equal(f.calls.length, 2, "Aucune animation supplémentaire n'est créée par cette fin tardive");
});

test("bonus protobuf : une fin sans date reste ambiguë après deux périodes et ne coupe pas le nouveau x2", async (context) => {
  const f = fixture(context); await f.open();
  const firstAt = f.now() + 1000;
  await f.announce(firstAt, 2, 5);
  await f.settle(firstAt, sdk.WebcastLinkmicBattleTaskMessage_BattleTaskSettle_Result.RESULT_SUCCEED);
  await f.advance(6000); assert.equal(f.state.matchSession.multiplier, 1);
  const secondAt = f.now() + 1000;
  await f.announce(secondAt, 2, 10);
  await f.settle(secondAt, sdk.WebcastLinkmicBattleTaskMessage_BattleTaskSettle_Result.RESULT_SUCCEED);
  await f.advance(1000); assert.equal(f.state.matchSession.multiplier, 2);
  const packet = await f.endReward();
  assert.equal(packet.common.createTime, "0", "Le codec matérialise une date absente, sans date inventée par la fixture");
  assert.equal(f.state.matchSession.multiplier, 2, "Une fin non attribuable ne doit pas être assignée arbitrairement au nouveau bonus");
  await f.advance(10000); assert.equal(f.state.matchSession.multiplier, 1, "La durée mesurée reste la source de la vraie fin");
  assert.equal(f.calls.length, 2);
});
