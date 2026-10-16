"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { battlePeriodTime } = require("../src/main/matches/tiktok-time");

const START = 1792100000000;
const END = START + 301000;

test("the native Studio relative countdown outranks a conflicting absolute forecast", () => {
  for (const timestamp of [START + 176000, String(START + 176000)]) {
    assert.deepEqual(battlePeriodTime({ timestamp, startTime: 5, battleEndMs: END }), {
      startsAtMs: END - 5000, startsBeforeEndMs: 5000
    });
    assert.deepEqual(battlePeriodTime({ timestamp, startTime: 1792100999, battleEndMs: END }), { startsAtMs: START + 176000 });
  }
});

test("observed absolute *Timestamp Unix seconds normalize like milliseconds, including seconds-only values", () => {
  const observedRewardSeconds = 1792104085;
  const observedBattleEndMs = 1792104179000;
  const expected = { startsAtMs: observedRewardSeconds * 1000 };
  for (const timestamp of [observedRewardSeconds, String(observedRewardSeconds), observedRewardSeconds * 1000, String(observedRewardSeconds * 1000)]) {
    assert.deepEqual(battlePeriodTime({ timestamp, startTime: 94, battleEndMs: observedBattleEndMs }), {
      ...expected, startsBeforeEndMs: 94000
    });
    assert.deepEqual(battlePeriodTime({ timestamp }), expected);
    assert.deepEqual(battlePeriodTime({ timestamp, startTime: 5, battleEndMs: observedBattleEndMs }), {
      startsAtMs: observedBattleEndMs - 5000, startsBeforeEndMs: 5000
    }, "The explicit remaining-time schedule wins even when both timestamp units are valid");
  }
  assert.deepEqual(battlePeriodTime({ startTime: 94, battleEndMs: observedBattleEndMs }), {
    ...expected, startsBeforeEndMs: 94000
  });
});

test("a seconds-only SETTLE timestamp preserves an actual reward date earlier than the START forecast", () => {
  const forecast = battlePeriodTime({ timestamp: 1792104085, startTime: 94, battleEndMs: 1792104179000 });
  const settled = battlePeriodTime({ timestamp: "1792104067", startTime: "0" });
  assert.deepEqual(settled, { startsAtMs: 1792104067000 });
  assert.equal(forecast.startsAtMs - settled.startsAtMs, 18000);
});

test("absolute timestamp unit boundaries remain strict and protobuf zero never becomes a date", () => {
  for (const timestamp of [0, "0", 1, 20, 999999999, "999999999"]) {
    assert.deepEqual(battlePeriodTime({ timestamp }), { startsAtMs: 0 });
  }
  for (const timestamp of [1e9, "1000000000", 1e12, "1000000000000"]) {
    assert.deepEqual(battlePeriodTime({ timestamp }), { startsAtMs: 1e12 });
  }
  assert.deepEqual(battlePeriodTime({ timestamp: 999999999999 }), { startsAtMs: 999999999999000 });
  assert.deepEqual(battlePeriodTime({ timestamp: 8.64e15 }), { startsAtMs: 8.64e15 });
  assert.deepEqual(battlePeriodTime({ timestamp: 8.64e15 + 1 }), { startsAtMs: 0 });
});

test("relative reward countdown resolves only against verified absolute battle end", () => {
  assert.deepEqual(battlePeriodTime({ startTime: 134, battleEndMs: END }), {
    startsAtMs: START + 167000, startsBeforeEndMs: 134000
  });
  assert.deepEqual(battlePeriodTime({ timestamp: "0", startTime: "134", battleEndMs: String(END) }), {
    startsAtMs: START + 167000, startsBeforeEndMs: 134000
  });
  assert.deepEqual(battlePeriodTime({ startTime: 20 }), { startsAtMs: 0, startsBeforeEndMs: 20000 });
});

test("observed preview, task and reward countdowns agree with their absolute timestamps", () => {
  for (const [startTime, elapsedSeconds] of [[225, 76], [200, 101], [134, 167]]) {
    assert.deepEqual(battlePeriodTime({ startTime, battleEndMs: END }), {
      startsAtMs: START + elapsedSeconds * 1000, startsBeforeEndMs: startTime * 1000
    });
    assert.deepEqual(battlePeriodTime({ timestamp: START + elapsedSeconds * 1000, startTime, battleEndMs: END }), {
      startsAtMs: START + elapsedSeconds * 1000, startsBeforeEndMs: startTime * 1000
    });
  }
});

test("a forecast 39 seconds late cannot postpone an explicit relative reward window", () => {
  const expected = END - 134000;
  for (const timestamp of [expected + 39000, String((expected + 39000) / 1000)]) {
    assert.deepEqual(battlePeriodTime({ timestamp, startTime: 134, battleEndMs: END }), {
      startsAtMs: expected, startsBeforeEndMs: 134000
    });
    assert.deepEqual(battlePeriodTime({ timestamp, startTime: 134 }), {
      startsAtMs: 0, startsBeforeEndMs: 134000
    }, "Before OPEN the relative proof is retained, not replaced by the late forecast");
  }
});

test("missing, zero or unusable countdowns preserve a valid absolute timestamp fallback", () => {
  for (const startTime of [undefined, null, 0, "0", "invalid", 7201, 999999999]) {
    assert.deepEqual(battlePeriodTime({ timestamp: START / 1000, startTime, battleEndMs: END }), { startsAtMs: START });
  }
});

test("legacy absolute seconds and milliseconds remain supported without relative metadata", () => {
  for (const startTime of [1792100000, "1792100000", START, String(START)]) {
    assert.deepEqual(battlePeriodTime({ startTime }), { startsAtMs: START });
  }
  assert.deepEqual(battlePeriodTime({ startTime: 1e9 }), { startsAtMs: 1e12 });
  assert.deepEqual(battlePeriodTime({ startTime: 1e12 }), { startsAtMs: 1e12 });
});

test("relative one second and two-hour boundaries are inclusive; gap values are unknown", () => {
  for (const seconds of [1, 7200]) assert.deepEqual(battlePeriodTime({ startTime: seconds, battleEndMs: END }), {
    startsAtMs: END - seconds * 1000, startsBeforeEndMs: seconds * 1000
  });
  for (const startTime of [7201, 1e8, 999999999]) assert.deepEqual(battlePeriodTime({ startTime, battleEndMs: END }), { startsAtMs: 0 });
});

test("protobuf zeros do not invent a match-start reward, including missing or partial objects", () => {
  for (const input of [undefined, null, {}, { timestamp: 0, startTime: 0, battleEndMs: END },
    { timestamp: "0", startTime: "0", battleEndMs: END }, { battleEndMs: END }]) {
    assert.deepEqual(battlePeriodTime(input), { startsAtMs: 0 });
  }
});

test("malformed or impossible values cannot become timestamps via JavaScript coercion", () => {
  const invalid = [NaN, Infinity, -Infinity, -1, -0, 0, "0", "", " ", " 20 ", "20\n", "1e3", "0x20", "01", "1.5", 1.5,
    [], [20], {}, { valueOf: () => START }, true, false, null, undefined, Number.MAX_SAFE_INTEGER + 1, 8.64e15 + 1];
  for (const value of invalid) {
    assert.deepEqual(battlePeriodTime({ timestamp: value }), { startsAtMs: 0 });
    assert.deepEqual(battlePeriodTime({ startTime: value }), { startsAtMs: 0 });
    assert.deepEqual(battlePeriodTime({ startTime: 20, battleEndMs: value }), { startsAtMs: 0, startsBeforeEndMs: 20000 });
  }
  for (const input of [[], [START], "input", 4, true]) assert.deepEqual(battlePeriodTime(input), { startsAtMs: 0 });
});

test("malformed timestamp falls back to an independently valid relative or legacy time", () => {
  assert.deepEqual(battlePeriodTime({ timestamp: [], startTime: 134, battleEndMs: END }), {
    startsAtMs: START + 167000, startsBeforeEndMs: 134000
  });
  assert.deepEqual(battlePeriodTime({ timestamp: 176, startTime: 1792100000 }), { startsAtMs: START });
});

test("battle-end seconds and lower boundary cannot masquerade as verified milliseconds", () => {
  for (const battleEndMs of [1792100000, 1e12 - 1, 1e12, 1e12 + 1]) assert.deepEqual(battlePeriodTime({ startTime: 20, battleEndMs }), {
    startsAtMs: 0, startsBeforeEndMs: 20000
  });
  assert.deepEqual(battlePeriodTime({ timestamp: 1e12 }), { startsAtMs: 1e12 });
  assert.deepEqual(battlePeriodTime({ timestamp: 8.64e15 }), { startsAtMs: 8.64e15 });
  assert.deepEqual(battlePeriodTime({ startTime: 20, battleEndMs: 8.64e15 }), { startsAtMs: 8.64e15 - 20000, startsBeforeEndMs: 20000 });
  assert.deepEqual(battlePeriodTime({ startTime: 20, battleStartMs: START }), { startsAtMs: 0, startsBeforeEndMs: 20000 },
    "An elapsed battle start is never accepted as the countdown anchor");
});
