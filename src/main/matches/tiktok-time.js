"use strict";

/** TikTok Studio schedules rewards from the explicit *Time countdown, not the
 * parallel *Timestamp forecast. *Time is seconds remaining before the original
 * battle end (excluding extra duration); resolve it only against that verified
 * local end. Absolute Unix seconds/milliseconds remain a fallback when no
 * usable relative countdown is present.
 * Protobuf zero is absence, not proof that a reward starts with the match.
 */
const FIRST_ABSOLUTE_MS = 1e12;
const MAX_DATE_MS = 8.64e15;
const MAX_RELATIVE_SECONDS = 7200;

function positiveInteger(value) {
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() !== value || !/^[1-9]\d*$/.test(value))) return 0;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

function absoluteMilliseconds(value) {
  const number = positiveInteger(value);
  return number >= FIRST_ABSOLUTE_MS && number <= MAX_DATE_MS ? number : 0;
}

function timestampMilliseconds(value) {
  const number = positiveInteger(value);
  if (number < 1e9) return 0;
  return absoluteMilliseconds(number < FIRST_ABSOLUTE_MS ? number * 1000 : number);
}

function battlePeriodTime(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { startsAtMs: 0 };
  const seconds = positiveInteger(input.startTime);
  if (seconds && seconds <= MAX_RELATIVE_SECONDS) {
    const startsBeforeEndMs = seconds * 1000;
    const battleEnd = absoluteMilliseconds(input.battleEndMs);
    const resolved = battleEnd > FIRST_ABSOLUTE_MS ? absoluteMilliseconds(battleEnd - startsBeforeEndMs) : 0;
    return { startsAtMs: resolved, startsBeforeEndMs };
  }
  const absolute = timestampMilliseconds(input.timestamp);
  if (absolute) return { startsAtMs: absolute };
  if (seconds >= 1e9) {
    const legacy = seconds < FIRST_ABSOLUTE_MS ? seconds * 1000 : seconds;
    return { startsAtMs: absoluteMilliseconds(legacy) };
  }
  return { startsAtMs: 0 };
}

module.exports = { battlePeriodTime };
