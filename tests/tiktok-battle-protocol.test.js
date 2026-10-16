"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const sdk = require("tiktok-live-connector");
const { normalizeTikTokBattle, tiktokBattleEventKind } = require("../src/main/matches/tiktok-battle");

// Fixtures synthétiques encodées puis décodées par le SDK réellement installé.
// Aucun compte, flux réseau, média ou effet LIVE n'est utilisé dans ces tests.
const blank = (type, input = {}) => ({ ...sdk[type].decode(new Uint8Array()), ...input });
const roundTrip = (type, input) => sdk[type].decode(sdk[type].encode(blank(type, input)).finish());
const setting = (input = {}) => blank("BattleSetting", {
  battleId: "9001", startTimeMs: "1790000000000", duration: 300,
  battleType: sdk.BattleType.BATTLE_TYPE_TEAM_BATTLE, ...input
});
const common = () => blank("CommonMessageData", { msgId: "7001", roomId: "8080" });
const member = (userId, score = "0") => blank("BattleTeamUser", { userId, userIdStr: userId, score });
const anchor = (userId, displayId) => blank("WebcastLinkMicBattle_BattleUserInfo", {
  user: blank("WebcastLinkMicBattle_BattleUserInfo_BattleBaseUserInfo", { userId, displayId, nickName: displayId })
});
const context = { roomId: "8080", channelUsername: "creator", receivedAtMs: 1790000001000 };

test("OPEN cohébergé décode la composition explicite des deux équipes sans inventer de score", () => {
  const packet = roundTrip("WebcastLinkMicBattle", {
    common: common(), battleId: "9001", battleSetting: setting(), action: sdk.BattleAction.BATTLE_ACTION_OPEN,
    anchorInfo: { 111: anchor("111", "creator"), 222: anchor("222", "teammate"), 333: anchor("333", "rival"), 444: anchor("444", "rival2") },
    teamUsers: [
      blank("WebcastLinkMicBattle_TeamUsersInfo", { teamId: "81", userIds: ["111", "222"] }),
      blank("WebcastLinkMicBattle_TeamUsersInfo", { teamId: "82", userIds: ["333", "444"] })
    ]
  });
  const frame = normalizeTikTokBattle("WebcastLinkMicBattle", packet, context);
  assert.equal(frame.phase, "start"); assert.equal(frame.battleType, 2);
  assert.equal(frame.participants.length, 4); assert.equal(frame.endsAtMs, 1790000300000);
  assert.deepEqual(frame.teams.map(({ id, participantIds, score }) => ({ id, participantIds, score })), [
    { id: "81", participantIds: ["111", "222"], score: null }, { id: "82", participantIds: ["333", "444"], score: null }
  ]);
  assert.equal(frame.participants.find((row) => row.id === "111").username, "creator");
  assert.equal(frame.participants.find((row) => row.id === "111").teamId, "81");
  assert.equal(frame.participants.every((row) => row.score === null), true);
});

test("armées d'équipe : total explicite, scores individuels et donateurs restent distincts", () => {
  const donor = blank("BattleUserArmy", { userId: "991", userIdStr: "991", nickname: "Donateur test", score: "90", diamondScore: "45" });
  const packet = roundTrip("WebcastLinkMicArmies", {
    common: common(), battleId: "9001", battleSettings: setting(), battleStatus: sdk.TriggerReason.TRIGGER_REASON_SCORE_UPDATE,
    fromUserId: "991", teamArmies: [
      blank("BattleTeamUserArmies", { teamId: "81", teamUsers: [member("111", "20"), member("222", "30")], teamTotalScore: "500",
        userArmies: blank("BattleUserArmies", { anchorIdStr: "111", hostScore: "50", userArmy: [donor] }) }),
      blank("BattleTeamUserArmies", { teamId: "82", teamUsers: [member("333"), member("444")], teamTotalScore: "0" })
    ]
  });
  const frame = normalizeTikTokBattle("linkMicArmies", packet, context);
  assert.equal(frame.phase, "update"); assert.equal(frame.teams[0].score, 500); assert.equal(frame.teams[1].score, 0);
  assert.deepEqual(frame.participants.map((row) => row.score), [20, 30, 0, 0]);
  assert.equal(frame.teams[0].donors[0].id, "991"); assert.equal(frame.teams[0].donors[0].diamonds, 45);
  assert.equal(frame.participants.some((row) => row.id === "991"), false);
  assert.equal(frame.participants.every((row) => row.donors.length === 0), true);
  assert.equal(frame.participants.some((row) => "own" in row), false);
});

test("FINISH conserve le résultat WIN=0 et le total de teamBattleResult, pas un résultat individuel inventé", () => {
  const packet = roundTrip("WebcastLinkMicBattle", {
    common: common(), battleId: "9001", action: sdk.BattleAction.BATTLE_ACTION_FINISH, battleSetting: setting(),
    teamBattleResult: [
      blank("WebcastLinkMicBattle_BattleTeamResult", { teamId: "81", teamUsers: [member("111", "20"), member("222", "30")], totalScore: "999", result: 0 }),
      blank("WebcastLinkMicBattle_BattleTeamResult", { teamId: "82", teamUsers: [member("333", "40"), member("444", "50")], totalScore: "998", result: 1 })
    ]
  });
  const frame = normalizeTikTokBattle("linkMicBattle", packet, context);
  assert.equal(frame.confirmedEnd, true); assert.equal(frame.phase, "end");
  assert.deepEqual(frame.teams.map(({ id, score, result }) => ({ id, score, result })), [
    { id: "81", score: 999, result: "win" }, { id: "82", score: 998, result: "lose" }
  ]);
  assert.deepEqual(frame.participants.map((row) => row.score), [20, 30, 40, 50]);
  assert.equal(frame.participants.every((row) => row.result === null), true);
});

test("les valeurs manquantes restent nulles tandis que les scores zéro reçus sont conservés", () => {
  const frame = normalizeTikTokBattle("linkMicArmies", { battleId: "9001", battleStatus: 1, teamArmies: [
    { teamId: "81", teamUsers: [{ userId: "111" }] },
    { teamId: "82", teamTotalScore: "0", teamUsers: [{ userId: "333", score: "0" }] }
  ] }, context);
  assert.equal(frame.teams[0].score, null); assert.equal(frame.participants[0].score, null);
  assert.equal(frame.teams[1].score, 0); assert.equal(frame.participants[1].score, 0);
});

test("un battleUsers hérité vide ne détruit pas le @ connu et les identifiants longs restent des chaînes", () => {
  const uid = "9007199254740993123";
  const frame = normalizeTikTokBattle("linkMicBattle", {
    battleId: "9001", action: 4, anchorInfo: { [uid]: { user: { userId: uid, displayId: "creator", nickName: "Créateur" } } },
    battleUsers: [{ userId: uid, uniqueId: "", nickname: "" }],
    teamArmies: [{ teamId: "81", teamTotalScore: "3", teamUsers: [{ userId: "0", userIdStr: uid, score: "3" }] }]
  }, context);
  assert.equal(frame.participants[0].id, uid); assert.equal(frame.participants[0].username, "creator");
  assert.equal(frame.participants[0].displayName, "Créateur"); assert.equal(frame.participants[0].teamId, "81");
  assert.deepEqual(frame.teams[0].participantIds, [uid]);
});

test("un cohébergement seul n'est jamais converti en match ni en carte", () => {
  const packet = { battleId: "9001", action: 4, teamUsers: [{ teamId: "81", userIds: ["111", "222"] }] };
  for (const kind of ["linkMicMethod", "WebcastLinkMicMethod", "linkMessage", "WebcastLinkLayerMessage", "cohost", "linkMicBattleItemCard"]) {
    assert.equal(tiktokBattleEventKind(kind), ""); assert.equal(normalizeTikTokBattle(kind, packet, context), null);
  }
  assert.equal(normalizeTikTokBattle("linkMicBattle", { action: 4, teamUsers: packet.teamUsers }, context), null);
  for (const action of [0, 1, 2, 7, 8, 9, 10]) assert.equal(normalizeTikTokBattle("linkMicBattle", { ...packet, action }, context), null);
});

test("les identifiants nuls et paquets d'une autre room sont rejetés, sans deviner le soi depuis l'auteur", () => {
  assert.equal(normalizeTikTokBattle("linkMicBattle", { common: { roomId: "9999" }, battleId: "9001", action: 4 }, context), null);
  const frame = normalizeTikTokBattle("linkMicBattle", { battleId: "9001", action: 4, actionByUserId: "888", fromUserId: "777",
    teamUsers: [{ teamId: "0", userIds: ["111"] }, { teamId: "81", userIds: ["0", "222"] }] }, context);
  assert.deepEqual(frame.participants.map((row) => row.id), ["222"]);
  assert.deepEqual(frame.teams.map((row) => row.id), ["81"]);
});

test("une appartenance contradictoire reste ambiguë au lieu de choisir arbitrairement une équipe", () => {
  const frame = normalizeTikTokBattle("linkMicBattle", { battleId: "9001", action: 4,
    teamUsers: [{ teamId: "81", userIds: ["111"] }, { teamId: "82", userIds: ["111", "333"] }] }, context);
  assert.equal(frame.participants.find((row) => row.id === "111").teamId, undefined);
  assert.equal(frame.teams.every((team) => team.participantIds.includes("111")), true);
  assert.equal(frame.participants.find((row) => row.id === "333").teamId, "82");
});

test("les équipes, membres et donateurs restent bornés et les collections malformées ne lèvent pas", () => {
  const frame = normalizeTikTokBattle("linkMicArmies", { battleId: "9001", teamArmies: Array.from({ length: 40 }, (_, index) => ({
    teamId: String(index + 1), teamTotalScore: "1", teamUsers: Array.from({ length: 40 }, (_, memberIndex) => ({ userId: String(100 + index * 100 + memberIndex), score: "1" })),
    userArmies: { userArmy: Array.from({ length: 30 }, (_, userIndex) => ({ userId: String(10000 + userIndex), score: "1" })) }
  })) }, context);
  assert.ok(frame.participants.length <= 16); assert.ok(frame.teams.length <= 8);
  assert.equal(frame.teams.every((team) => team.participantIds.length <= 8 && team.donors.length <= 10), true);
  assert.doesNotThrow(() => normalizeTikTokBattle("linkMicBattle", { battleId: "9001", action: 4,
    teamUsers: {}, teamArmies: [null, { teamId: "81", teamUsers: {}, userArmies: { userArmy: {} } }], teamBattleResult: "invalid", battleUsers: {}, armies: { 111: null }, battleResult: { 111: null }
  }, context));
  assert.equal(normalizeTikTokBattle("linkMicBattle", null, context), null);
});

test("un 1v1 normal conserve ses scores, résultats et absence d'équipe", () => {
  const frame = normalizeTikTokBattle("linkMicBattle", { battleId: "9001", action: 5,
    battleResult: { 111: { userId: "111", score: "5", result: 0 }, 333: { userId: "333", score: "0", result: 1 } }
  }, context);
  assert.deepEqual(frame.teams, []); assert.equal(frame.battleType, 0);
  assert.deepEqual(frame.participants.map(({ id, score, result }) => ({ id, score, result })), [
    { id: "111", score: 5, result: "win" }, { id: "333", score: 0, result: "lose" }
  ]);
});

test("les zéros protobuf ne masquent pas le vrai début futur des bonus x2/x3 ni leur durée", () => {
  const rewardAt = context.receivedAtMs + 29000;
  for (const multiplier of [2, 3]) {
    const period = blank("WebcastLinkmicBattleTaskMessage_BattleTaskStart_BattleBonusConfig_RewardPeriodConfig", {
      rewardMultiple: multiplier, rewardStartTimestamp: "0", rewardStartTime: String(rewardAt / 1000), duration: "25"
    });
    const packet = roundTrip("WebcastLinkmicBattleTaskMessage", {
      battleId: "9001", battleTaskMessageType: sdk.BattleTaskMessageType.BATTLE_TASK_MESSAGE_TYPE_START,
      taskStart: blank("WebcastLinkmicBattleTaskMessage_BattleTaskStart", {
        battleBonusConfig: blank("WebcastLinkmicBattleTaskMessage_BattleTaskStart_BattleBonusConfig", { rewardPeriodConfig: period })
      }),
      taskSettle: blank("WebcastLinkmicBattleTaskMessage_BattleTaskSettle", { rewardStartTimestamp: "0", rewardStartTime: "0" })
    });
    const frame = normalizeTikTokBattle("linkMicBattleTask", packet, context);
    assert.equal(frame.multiplier, multiplier); assert.equal(frame.rewardStartsAtMs, rewardAt);
    assert.ok(frame.rewardStartsAtMs > frame.receivedAtMs, "L'annonce d'un bonus futur ne le transforme pas en bonus immédiat");
    assert.equal(frame.rewardDurationMs, 25000);
  }
});

test("le premier horodatage positif conserve la priorité règlement puis période, timestamp puis time", () => {
  const rewardAt = context.receivedAtMs + 29000;
  const periodName = "WebcastLinkmicBattleTaskMessage_BattleTaskStart_BattleBonusConfig_RewardPeriodConfig";
  const packet = (settle = {}, period = {}) => roundTrip("WebcastLinkmicBattleTaskMessage", {
    battleId: "9001", battleTaskMessageType: sdk.BattleTaskMessageType.BATTLE_TASK_MESSAGE_TYPE_TASK_SETTLE,
    taskSettle: blank("WebcastLinkmicBattleTaskMessage_BattleTaskSettle", settle),
    taskStart: blank("WebcastLinkmicBattleTaskMessage_BattleTaskStart", {
      battleBonusConfig: blank("WebcastLinkmicBattleTaskMessage_BattleTaskStart_BattleBonusConfig", {
        rewardPeriodConfig: blank(periodName, { rewardMultiple: 2, duration: "20", ...period })
      })
    })
  });
  const cases = [
    [packet({ rewardStartTimestamp: String(rewardAt), rewardStartTime: String((rewardAt + 1000) / 1000) }), rewardAt],
    [packet({ rewardStartTimestamp: "0", rewardStartTime: String(rewardAt / 1000) }, { rewardStartTimestamp: String(rewardAt + 1000) }), rewardAt],
    [packet({}, { rewardStartTimestamp: String(rewardAt), rewardStartTime: String((rewardAt + 1000) / 1000) }), rewardAt],
    [packet({}, { rewardStartTimestamp: "0", rewardStartTime: String(rewardAt / 1000) }), rewardAt],
    [packet({ rewardStartTimestamp: "-1" }, { rewardStartTimestamp: String(rewardAt) }), rewardAt],
    [packet(), 0]
  ];
  for (const [data, expected] of cases) assert.equal(normalizeTikTokBattle("linkMicBattleTask", data, context).rewardStartsAtMs, expected);
});
