"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeTikTokBattleInfo } = require("../src/main/matches/tiktok-battle-info");

// Schema-derived fixtures, not a recorded successful first-gift LIVE response.
const at = 1790000000000;
const context = { battleId: "9001", ownerUserId: "7001", roomId: "8001", channelUsername: "@creator",
  receivedAtMs: at, battleEndMs: at + 301000 };
function fixture() {
  return { status_code: 0, data: { battle_id: "9001", battle_settings: { battle_id: "9001", start_time_ms: String(at) },
    battle_task: { config: { target_config: { target_type: 22 },
      reward_config: { reward_start_time: "281", reward_start_timestamp: "0", duration: "30", reward_multiple: "3" } },
    status: { status: 1 } } } };
}
const normalize = (response = fixture(), overrides = {}) => normalizeTikTokBattleInfo(response, { ...context, ...overrides });

test("battle/info : le bonus initial configuré n'attend pas un résultat de défi ordinaire", () => {
  for (const status of [0, 1, 2, 3, 4, 6]) {
    const data = fixture(); data.data.battle_task.status.status = status;
    const frame = normalize(data);
    assert.equal(frame.phase, "task"); assert.equal(frame.battleId, context.battleId);
    assert.equal(frame.roomId, context.roomId); assert.equal(frame.channelUsername, "creator");
    assert.deepEqual(frame.participants, []); assert.deepEqual(frame.teams, []);
    assert.deepEqual(frame.bonus, { stage: "available", multiplier: 3, startsAtMs: at + 20000,
      durationMs: 30000, result: "available", ownerUserId: "7001", periodKey: "remaining:281000",
      startsBeforeEndMs: 281000, createdAtMs: 0 });
  }
});

test("battle/info : sans compte à rebours, le début serveur absolu conserve son décalage appliqué une fois", () => {
  const data = fixture(), delta = 2318;
  data.data.battle_settings.start_time_ms = String(at + delta);
  data.data.battle_task.config.reward_config.reward_start_time = "0";
  data.data.battle_task.config.reward_config.reward_start_timestamp = String(at + delta + 10000);
  const frame = normalize(data, { clockOffsetMs: delta });
  assert.equal(frame.bonus.startsAtMs, at + 10000);
  assert.equal(frame.bonus.sourceStartsAtMs, at + delta + 10000);
  assert.equal(frame.bonus.periodKey, `server:${at + delta + 10000}`);
  assert.equal("startsBeforeEndMs" in frame.bonus, false);
});

test("battle/info : le compte à rebours natif prévaut sur une date serveur 39 secondes trop tardive", () => {
  const data = fixture(), delta = 2318;
  data.data.battle_settings.start_time_ms = String(at + delta);
  data.data.battle_task.config.reward_config.reward_start_timestamp = String(at + 20000 + delta + 39000);
  const frame = normalize(data, { clockOffsetMs: delta });
  assert.equal(frame.bonus.startsAtMs, at + 20000);
  assert.equal(frame.bonus.startsBeforeEndMs, 281000);
  assert.equal(frame.bonus.periodKey, "remaining:281000");
  assert.equal("sourceStartsAtMs" in frame.bonus, false);
});

test("battle/info : une prolongation n'est jamais ajoutée à la fenêtre du bonus", () => {
  const frame = normalize(fixture(), { battleEndMs: context.battleEndMs + 40000, bonusEndsAtMs: context.battleEndMs });
  assert.equal(frame.bonus.startsAtMs, at + 20000);
  for (const bonusEndsAtMs of [0, at / 1000, context.battleEndMs + 1, NaN, null, "1790000301000"]) {
    assert.equal(normalize(fixture(), { bonusEndsAtMs }), null);
  }
});

test("battle/info : les secondes restantes utilisent la fin locale déjà corrigée", () => {
  const data = fixture(); data.data.battle_settings.start_time_ms = String(at + 2318);
  assert.equal(normalize(data, { clockOffsetMs: 2318 }).bonus.startsAtMs, at + 20000);
  assert.equal(normalize(data, { clockOffsetMs: 1000 }).bonus.periodKey,
    normalize(data, { clockOffsetMs: 2318 }).bonus.periodKey);
});

test("battle/info : les dates absolues en secondes et millisecondes partagent la même identité", () => {
  const second = fixture(), millisecond = fixture(), start = at + 20000;
  second.data.battle_task.config.reward_config.reward_start_time = "0";
  millisecond.data.battle_task.config.reward_config.reward_start_time = "0";
  second.data.battle_task.config.reward_config.reward_start_timestamp = String(start / 1000);
  millisecond.data.battle_task.config.reward_config.reward_start_timestamp = String(start);
  assert.deepEqual(normalize(second, { clockOffsetMs: 2385 }), normalize(millisecond, { clockOffsetMs: 2385 }));
  assert.equal(normalize(second, { clockOffsetMs: 2385 }).bonus.startsAtMs, start - 2385);
});

test("battle/info : une ancienne date absolue dans start_time reste compatible sans inventer un compte à rebours", () => {
  const data = fixture(); data.data.battle_task.config.reward_config.reward_start_time = String((at + 10000) / 1000);
  const frame = normalize(data);
  assert.equal(frame.bonus.startsAtMs, at + 10000);
  assert.equal(frame.bonus.periodKey, `server:${at + 10000}`);
});

test("battle/info : le propriétaire, la salle et le match sont obligatoires et les réponses anciennes refusées", () => {
  for (const overrides of [{ ownerUserId: "" }, { ownerUserId: 7001 }, { ownerUserId: "0" },
    { roomId: "" }, { battleId: "" }, { battleId: "9002" }, { receivedAtMs: 0 }, { battleEndMs: 0 },
    { clockOffsetMs: -1 }, { clockOffsetMs: 30001 }, { clockOffsetMs: NaN }, { clockOffsetMs: "1" }]) {
    assert.equal(normalize(fixture(), overrides), null);
  }
  for (const mutate of [d => { delete d.data.battle_settings; }, d => { delete d.data.battle_settings.battle_id; },
    d => { d.data.battle_settings.battle_id = "9002"; }, d => { d.data.battle_id = "9002"; },
    d => { d.data.room_id = "8002"; }, d => { d.data.battle_settings.start_time_ms = String(at + 21000); }]) {
    const data = fixture(); mutate(data); assert.equal(normalize(data), null);
  }
});

test("battle/info : aucun échec, fin ou défi ordinaire ne prouve un bonus initial", () => {
  for (const status of [undefined, null, "", false, 5, 7, 8, -1]) {
    const data = fixture(); data.data.battle_task.status.status = status; assert.equal(normalize(data), null);
  }
  for (const type of [undefined, null, false, 0, 1, 2, 21, 23, "22.0"]) {
    const data = fixture(); data.data.battle_task.config.target_config.target_type = type; assert.equal(normalize(data), null);
  }
});

test("battle/info : aucune durée, date ou puissance n'est inventée ni bornée silencieusement", () => {
  for (const [key, values] of Object.entries({ reward_multiple: [undefined, null, false, 0, 1, 4, "x3", "3.0"],
    duration: [undefined, null, false, 0, -1, 3601, 0.5, "30.0"],
    reward_start_timestamp: [null, false, -1, "broken", 134, 999999999, Number.MAX_SAFE_INTEGER],
    reward_start_time: [null, false, -1, "broken", 0.5] })) {
    for (const value of values) { const data = fixture(); data.data.battle_task.config.reward_config[key] = value;
      assert.equal(normalize(data), null, `${key}: ${String(value)}`); }
  }
  const data = fixture(); delete data.data.battle_task.config.reward_config.reward_start_time;
  assert.equal(normalize(data), null);
});

test("battle/info : les fenêtres expirées, hors manche ou trop longues sont refusées", () => {
  const expired = fixture();
  assert.equal(normalize(expired, { receivedAtMs: at + 50000 }), null);
  assert.equal(normalize(expired, { receivedAtMs: at + 301000 }), null);
  for (const [start, duration] of [[at - 1000, 30], [at + 301000, 30], [at + 280000, 30]]) {
    const data = fixture(); Object.assign(data.data.battle_task.config.reward_config,
      { reward_start_timestamp: String(start), reward_start_time: "0", duration });
    assert.equal(normalize(data), null);
  }
  assert.equal(normalize(expired, { receivedAtMs: at + 49999 }).bonus.multiplier, 3);
});

test("battle/info : les réponses et objets malformés sont refusés sans exception", () => {
  for (const value of [null, false, [], {}, { status_code: "0", data: {} }, { status_code: 1, data: {} }]) {
    assert.equal(normalize(value), null);
  }
  for (const path of [["data"], ["data", "battle_settings"], ["data", "battle_task"],
    ["data", "battle_task", "config"], ["data", "battle_task", "status"],
    ["data", "battle_task", "config", "target_config"], ["data", "battle_task", "config", "reward_config"]]) {
    for (const value of [null, [], false, "invalid"]) {
      const data = fixture(); let object = data;
      for (const key of path.slice(0, -1)) object = object[key];
      object[path.at(-1)] = value; assert.equal(normalize(data), null);
    }
  }
  assert.equal(normalizeTikTokBattleInfo(fixture(), null), null);
});
