"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const sdk = require("tiktok-live-connector");
const { normalizeTikTokBattle } = require("../src/main/matches/tiktok-battle");
const { normalizeTikTokBattleBonus } = require("../src/main/matches/tiktok-bonus");
const empty = (type, input = {}) => ({ ...sdk[type].decode(new Uint8Array()), ...input });
const packet = (input) => sdk.WebcastLinkmicBattleTaskMessage.decode(sdk.WebcastLinkmicBattleTaskMessage.encode(empty("WebcastLinkmicBattleTaskMessage", {
  common: empty("CommonMessageData", { msgId: "7001", roomId: "8080" }), battleId: "9001", ...input
})).finish());
const context = { roomId: "8080", channelUsername: "creator", receivedAtMs: 1790000001000 };
const at = 1790000030000;

test("le cycle classique observé conserve le vrai horaire malgré un succès protobuf vide précoce", () => {
  const captured = require("./fixtures/tiktok-bonus-early-success-20261016.json");
  const codecs = { message: "WebcastLinkmicBattleTaskMessage", common: "CommonMessageData",
    taskStart: "WebcastLinkmicBattleTaskMessage_BattleTaskStart",
    battleBonusConfig: "WebcastLinkmicBattleTaskMessage_BattleTaskStart_BattleBonusConfig",
    taskPeriodConfig: "WebcastLinkmicBattleTaskMessage_BattleTaskStart_BattleBonusConfig_TaskPeriodConfig",
    rewardPeriodConfig: "WebcastLinkmicBattleTaskMessage_BattleTaskStart_BattleBonusConfig_RewardPeriodConfig",
    taskSettle: "WebcastLinkmicBattleTaskMessage_BattleTaskSettle",
    taskUpdate: "WebcastLinkmicBattleTaskMessage_BattleTaskUpdate",
    rewardSettle: "WebcastLinkmicBattleTaskMessage_BattleRewardSettle" };
  const complete = (value, field = "message") => ({ ...empty(codecs[field]), ...Object.fromEntries(Object.entries(value)
    .map(([key, entry]) => [key, codecs[key] ? complete(entry, key) : entry])) });
  const decode = (value) => sdk.WebcastLinkmicBattleTaskMessage.decode(sdk.WebcastLinkmicBattleTaskMessage.encode(complete(value)).finish());
  const announcement = normalizeTikTokBattleBonus(decode(captured.start));
  assert.equal(announcement.stage, "announced");
  assert.equal(announcement.startsAtMs, 0, "Le compte à rebours explicite attend la vraie fin du match, pas une date parallèle");
  assert.equal(announcement.startsBeforeEndMs, 94000, "Studio programme le bonus à 94 secondes de la fin hors prolongation");
  assert.equal(announcement.multiplier, 2); assert.equal(announcement.durationMs, 50000);
  const settlement = normalizeTikTokBattleBonus(decode(captured.settle));
  assert.equal(settlement.result, "success", "Le champ SETTLE vide matérialise le résultat protobuf par défaut 0");
  assert.equal(settlement.startsAtMs, 0, "Aucun horaire réel corrigé n'est fabriqué à la réception du succès");
  assert.equal(normalizeTikTokBattleBonus(decode(captured.update)), null, "Le donateur de progression ne détermine pas le bénéficiaire");
  assert.equal(normalizeTikTokBattleBonus(decode(captured.end)).stage, "ended");
});
const start = (multiple = 2) => empty("WebcastLinkmicBattleTaskMessage_BattleTaskStart", {
  battleBonusConfig: empty("WebcastLinkmicBattleTaskMessage_BattleTaskStart_BattleBonusConfig", {
    rewardPeriodConfig: empty("WebcastLinkmicBattleTaskMessage_BattleTaskStart_BattleBonusConfig_RewardPeriodConfig", {
      rewardMultiple: multiple, rewardStartTime: String(at / 1000), duration: "25"
    })
  })
});
const startBonus = (multiple = 2) => {
  const value = start(multiple);
  value.battleBonusConfig.taskPeriodConfig = empty("WebcastLinkmicBattleTaskMessage_BattleTaskStart_BattleBonusConfig_TaskPeriodConfig", { targetType: 22 });
  return value;
};

test("START réel du SDK n'est qu'une annonce, pas une preuve de bonus obtenu", () => {
  for (const multiple of [2, 3]) {
    const frame = normalizeTikTokBattle("linkMicBattleTask", packet({ battleTaskMessageType: 0, taskStart: start(multiple) }), context);
    assert.deepEqual(frame.bonus, { stage: "announced", multiplier: multiple, startsAtMs: at, durationMs: 25000, result: "unknown", periodKey: "", createdAtMs: 0 });
    assert.equal(frame.roomId, context.roomId);
  }
});

test("le contrat SDK START_BONUS type 22 rend son ×2 ou ×3 explicite disponible sans SETTLE", () => {
  for (const multiple of [2, 3]) {
    const data = packet({ battleTaskMessageType: 0, taskStart: startBonus(multiple) });
    const bonus = normalizeTikTokBattleBonus(data);
    assert.deepEqual(bonus, { stage: "start-bonus", multiplier: multiple, startsAtMs: at, durationMs: 25000,
      result: "available", periodKey: "", createdAtMs: 0 });
    assert.equal("ownerUserId" in bonus, false, "Le bénéficiaire est vérifié dans le contexte de salle, jamais inventé dans le paquet");
    const relative = structuredClone(data);
    relative.taskStart.battleBonusConfig.rewardPeriodConfig.rewardStartTime = "280";
    relative.taskStart.battleBonusConfig.rewardPeriodConfig.rewardStartTimestamp = "0";
    assert.deepEqual(normalizeTikTokBattleBonus(relative), { ...bonus, startsAtMs: 0, startsBeforeEndMs: 280000 });
  }
});

test("START_BONUS sans multiplicateur, durée ou date explicites valides ne devient jamais ×2 par défaut", () => {
  const data = packet({ battleTaskMessageType: 0, taskStart: startBonus() });
  const cases = [
    ...[0, 1, 4, -1, null, undefined, "2", NaN].map((rewardMultiple) => ({ rewardMultiple })),
    ...[0, "0", -1, "-1", 1.5, "1.5", " 30", "030", 3601, "3601", null, undefined, NaN].map((duration) => ({ duration })),
    { rewardStartTime: "0", rewardStartTimestamp: "0" },
    { rewardStartTime: "garbage", rewardStartTimestamp: "garbage" }
  ];
  for (const change of cases) {
    const malformed = structuredClone(data);
    Object.assign(malformed.taskStart.battleBonusConfig.rewardPeriodConfig, change);
    assert.equal(normalizeTikTokBattleBonus(malformed), null, JSON.stringify(change));
  }
  for (const targetType of [0, 1, 2, 21, 23, "22", null, undefined]) {
    const unknown = structuredClone(data);
    unknown.taskStart.battleBonusConfig.taskPeriodConfig.targetType = targetType;
    assert.equal(normalizeTikTokBattleBonus(unknown).stage, "announced", String(targetType));
  }
});

test("TASK_SETTLE conserve le résultat de la salle et la date réelle sans configuration START répétée", () => {
  for (const [taskResult, result] of [[0, "success"], [1, "failed"], [2, "both"], [-1, "unknown"]]) {
    const frame = normalizeTikTokBattle("linkMicBattleTask", packet({ battleTaskMessageType: 2,
      taskSettle: empty("WebcastLinkmicBattleTaskMessage_BattleTaskSettle", { taskResult, rewardStartTimestamp: String(at + 2000) }) }), context);
    assert.deepEqual(frame.bonus, { stage: "settled", multiplier: null, startsAtMs: at + 2000, durationMs: 0, result, periodKey: "", createdAtMs: 0 });
  }
});

test("START ignore un champ SETTLE étranger à son étape, même pour le bonus initial", () => {
  for (const taskStart of [start(2), startBonus(3)]) {
    const data = packet({ battleTaskMessageType: 0, taskStart,
      taskSettle: empty("WebcastLinkmicBattleTaskMessage_BattleTaskSettle", {
        taskResult: 1, rewardStartTimestamp: String(at - 15000)
      }) });
    assert.equal(normalizeTikTokBattleBonus(data).startsAtMs, at);
  }
});

test("les dates nulles protobuf n'écrasent pas la date positive ni le résultat FAILED", () => {
  const frame = normalizeTikTokBattle("linkMicBattleTask", packet({ battleTaskMessageType: 2, taskStart: start(),
    taskSettle: empty("WebcastLinkmicBattleTaskMessage_BattleTaskSettle", { taskResult: 1, rewardStartTimestamp: "0", rewardStartTime: String((at + 1000) / 1000) }) }), context);
  assert.equal(frame.bonus.startsAtMs, at + 1000);
  assert.equal(frame.bonus.multiplier, 2);
  assert.equal(frame.bonus.result, "failed");
});

test("les secondes restantes de récompense ne deviennent jamais une date Unix de 1970", () => {
  const data = packet({ battleTaskMessageType: 0, taskStart: empty("WebcastLinkmicBattleTaskMessage_BattleTaskStart", {
    battleBonusConfig: empty("WebcastLinkmicBattleTaskMessage_BattleTaskStart_BattleBonusConfig", {
      rewardPeriodConfig: empty("WebcastLinkmicBattleTaskMessage_BattleTaskStart_BattleBonusConfig_RewardPeriodConfig", {
        rewardMultiple: 3, rewardStartTime: "134", rewardStartTimestamp: "0", duration: "60"
      })
    })
  }) });
  const bonus = normalizeTikTokBattleBonus(data);
  assert.equal(bonus.startsAtMs, 0);
  assert.equal(bonus.startsBeforeEndMs, 134000);
});

test("le compte à rebours START ou SETTLE reste prioritaire sur une date parallèle 39 secondes plus tardive", () => {
  const delta = 2385;
  for (const multiple of [2, 3]) {
    const taskStart = start(multiple), reward = taskStart.battleBonusConfig.rewardPeriodConfig;
    Object.assign(reward, { rewardStartTime: "134", rewardStartTimestamp: String((at + 39000) / 1000) });
    const announced = normalizeTikTokBattleBonus(packet({ battleTaskMessageType: 0, taskStart }), { clockOffsetMs: delta });
    assert.equal(announced.startsAtMs, 0);
    assert.equal(announced.startsBeforeEndMs, 134000);
    assert.equal("sourceStartsAtMs" in announced, false, "Un compte à rebours n'est pas une date serveur à corriger deux fois");
    const settled = normalizeTikTokBattleBonus(packet({ battleTaskMessageType: 2,
      taskSettle: empty("WebcastLinkmicBattleTaskMessage_BattleTaskSettle", { taskResult: 0,
        rewardStartTime: "134", rewardStartTimestamp: String((at + 39000) / 1000) }) }), { clockOffsetMs: delta });
    assert.equal(settled.startsAtMs, 0);
    assert.equal(settled.startsBeforeEndMs, 134000);
    assert.equal(settled.result, "success");
  }
});

test("une horloge serveur en avance ne retarde ni le match ni le bonus confirmé", () => {
  const delta = 2342;
  const frame = normalizeTikTokBattle("linkMicBattleTask", packet({ battleTaskMessageType: 2, taskStart: start(3),
    taskSettle: empty("WebcastLinkmicBattleTaskMessage_BattleTaskSettle", { taskResult: 0, rewardStartTimestamp: String(at) })
  }), { ...context, clockOffsetMs: delta });
  assert.equal(frame.bonus.startsAtMs, at - delta);
  const battle = normalizeTikTokBattle("linkMicBattle", { battleId: "9001", action: 4,
    battleSetting: { startTimeMs: String(at), endTimeMs: String(at + 301000), duration: 301 }
  }, { ...context, clockOffsetMs: delta });
  assert.equal(battle.startsAtMs, at - delta);
  assert.equal(battle.endsAtMs, at + 301000 - delta);
});

test("REWARD_SETTLE n'est pas une nouvelle activation et un auteur de progression n'est pas un bénéficiaire", () => {
  const ended = normalizeTikTokBattle("linkMicBattleTask", packet({ battleTaskMessageType: 3,
    rewardSettle: empty("WebcastLinkmicBattleTaskMessage_BattleRewardSettle", { status: 0 }) }), context);
  assert.equal(ended.bonus.stage, "ended");
  assert.equal(ended.bonus.multiplier, null);
  const update = normalizeTikTokBattle("linkMicBattleTask", packet({ battleTaskMessageType: 1,
    taskUpdate: empty("WebcastLinkmicBattleTaskMessage_BattleTaskUpdate", { fromUserUid: "999", taskProgress: "1" }) }), context);
  assert.equal(update.bonus, null);
  assert.equal("recipientIds" in ended.bonus, false);
  assert.equal("ownerId" in ended.bonus, false);
});

test("la date d'émission du SDK reste distincte de la date de réception d'une fin de bonus retardée", () => {
  const frame = normalizeTikTokBattle("linkMicBattleTask", packet({ battleTaskMessageType: 3,
    common: empty("CommonMessageData", { roomId: "8080", createTime: String(at / 1000) }),
    rewardSettle: empty("WebcastLinkmicBattleTaskMessage_BattleRewardSettle", { status: 0 })
  }), { ...context, receivedAtMs: at + 60000 });
  assert.equal(frame.bonus.createdAtMs, at);
  assert.equal(frame.receivedAtMs, at + 60000);
  assert.equal(frame.bonus.stage, "ended");
});

test("une enveloppe, un cadeau, une autre salle ou des données malformées ne confirment aucun bonus", () => {
  for (const value of [null, [], false, {}, { battleTaskMessageType: 2 }, { battleTaskMessageType: 3 },
    { battleTaskMessageType: 0, taskStart: [] }, { battleTaskMessageType: 9, taskSettle: { taskResult: 0 } }]) {
    assert.equal(normalizeTikTokBattleBonus(value), null);
  }
  const data = packet({ battleTaskMessageType: 2, taskSettle: empty("WebcastLinkmicBattleTaskMessage_BattleTaskSettle", { taskResult: 0 }) });
  assert.equal(normalizeTikTokBattle("linkMicBattleTask", data, { ...context, roomId: "other" }), null);
  assert.equal(normalizeTikTokBattle("gift", data, context), null);
  const scores = normalizeTikTokBattle("linkMicArmies", { battleId: "9001", triggerCriticalStrike: true }, context);
  assert.equal(scores.bonus, null);
});
