"use strict";

const { battlePeriodTime } = require("./tiktok-time");

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const identifier = (value) => typeof value === "string" && /^[1-9]\d{0,119}$/.test(value) ? value : "";
const integer = (value) => {
  if (typeof value !== "number" && (typeof value !== "string" || !/^(?:0|[1-9]\d*)$/.test(value))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
};
const absolute = (value) => Number.isSafeInteger(value) && value >= 1e12 && value <= 8.64e15;

/** Read-only battle/info contract. START_BONUS (target_type 22) makes its
 * configured reward window available without the ordinary challenge result.
 * The caller binds the request to the verified broadcaster, room and battle;
 * neither task status nor a donor identity supplies an owner here.
 * *_start_time is remaining original match seconds (without extra duration)
 * and has native Studio priority over the absolute *_start_timestamp fallback.
 */
function normalizeTikTokBattleInfo(response, context = {}) {
  if (!object(response) || response.status_code !== 0 || !object(response.data) || !object(context)) return null;
  const { battleId, ownerUserId, roomId, receivedAtMs, battleEndMs, bonusEndsAtMs, clockOffsetMs = 0 } = context;
  if (!identifier(battleId) || !identifier(ownerUserId) || !identifier(roomId) ||
    !absolute(receivedAtMs) || !absolute(battleEndMs) || battleEndMs <= receivedAtMs ||
    !Number.isFinite(clockOffsetMs) || clockOffsetMs < 0 || clockOffsetMs > 30000 ||
    (bonusEndsAtMs !== undefined && (!absolute(bonusEndsAtMs) || bonusEndsAtMs > battleEndMs))) return null;
  const data = response.data, settings = data.battle_settings;
  if (!object(settings) || settings.battle_id !== battleId ||
    (data.battle_id !== undefined && data.battle_id !== battleId) ||
    (data.room_id !== undefined && data.room_id !== roomId)) return null;
  const task = data.battle_task;
  if (!object(task) || !object(task.config) || !object(task.status)) return null;
  const status = integer(task.status.status);
  if (![0, 1, 2, 3, 4, 6].includes(status)) return null;
  const config = task.config, target = config.target_config, reward = config.reward_config;
  if (!object(target) || integer(target.target_type) !== 22 || !object(reward)) return null;
  const multiplier = integer(reward.reward_multiple), duration = integer(reward.duration);
  if (![2, 3].includes(multiplier) || duration === null || duration <= 0 || duration > 3600) return null;
  const timestamp = reward.reward_start_timestamp === undefined ? 0 : integer(reward.reward_start_timestamp);
  const startTime = reward.reward_start_time === undefined ? 0 : integer(reward.reward_start_time);
  if (timestamp === null || startTime === null || (timestamp > 0 && !battlePeriodTime({ timestamp }).startsAtMs)) return null;
  const resolved = battlePeriodTime({ timestamp, startTime, battleEndMs: bonusEndsAtMs ?? battleEndMs });
  if (!absolute(resolved.startsAtMs)) return null;
  // clockOffsetMs is server minus local. The countdown end is already local.
  const serverStart = resolved.startsBeforeEndMs ? 0 : resolved.startsAtMs;
  const startsAtMs = serverStart ? serverStart - clockOffsetMs : resolved.startsAtMs;
  const durationMs = duration * 1000, endsAtMs = startsAtMs + durationMs;
  if (!absolute(startsAtMs) || startsAtMs >= battleEndMs || endsAtMs > battleEndMs || endsAtMs <= receivedAtMs) return null;
  if (settings.start_time_ms !== undefined) {
    const sourceBattleStart = integer(settings.start_time_ms);
    if (sourceBattleStart === null || !absolute(sourceBattleStart) || startsAtMs < sourceBattleStart - clockOffsetMs) return null;
  }
  const periodKey = serverStart ? `server:${serverStart}` : `remaining:${resolved.startsBeforeEndMs}`;
  return {
    phase: "task", battleId, roomId, receivedAtMs, participants: [], teams: [],
    channelUsername: typeof context.channelUsername === "string" ? context.channelUsername.replace(/^@+/, "").slice(0, 120) : "",
    bonus: {
      stage: "available", multiplier, startsAtMs, durationMs, result: "available", ownerUserId, periodKey,
      ...(serverStart && clockOffsetMs ? { sourceStartsAtMs: serverStart } : {}),
      ...(resolved.startsBeforeEndMs ? { startsBeforeEndMs: resolved.startsBeforeEndMs } : {}),
      createdAtMs: 0
    }
  };
}

module.exports = { normalizeTikTokBattleInfo };
