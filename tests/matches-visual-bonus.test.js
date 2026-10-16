"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseVisualBonusBanner, VisualBonusTracker } = require("../src/main/matches/visual-bonus");

const NOW = 1790000000000;
const context = () => ({ sourceId: "source_tiktok", windowId: "66708", accountUid: "fixture-account", profileId: "fixture-profile",
  roomId: "8001", battleId: "9001", ownerUserId: "9007199254740993123", ownerUsername: "creator",
  startedAtMs: NOW - 10000, endsAtMs: NOW + 301000 });
function frame(second, remaining, extra = {}) {
  return { frameId: `frame-${second}`, capturedAtMs: NOW + second * 1000, context: context(),
    bannerLines: [`×2 points Cadeaux | ${remaining}s`], ownerLines: ["@creator"], knownPeriods: [], ...extra };
}
const observe = (tracker, second, remaining, extra) => tracker.observe(frame(second, remaining, extra), NOW + second * 1000);

test("active French TikTok banners parse only explicit x2/x3 and their visible remaining seconds", () => {
  for (const [text, multiplier, remainingSeconds] of [
    ["x2 points Cadeaux |58s", 2, 58], ["×3 points Cadeaux | 49 s", 3, 49],
    ["Points Cadeaux x2 par premier Cadeau |30s", 2, 30],
    ["Points Cadeaux ×3 par premier Cadeau | 29 secondes", 3, 29],
    [["X2 POINTS CADEAUX |", "58s"], 2, 58], ["x3 points Cadeaux 1 sec.", 3, 1]
  ]) assert.deepEqual(parseVisualBonusBanner(text), { multiplier, remainingSeconds });
});

test("announcements, challenges, WIN counters, animation text, absent powers and guessed durations are rejected", () => {
  for (const text of ["x2 points Cadeaux seront bientôt disponibles |30s", "Défi x2 points Cadeaux |30s",
    "Envoyez tout ! x2 points Cadeaux |30s", "Objectif x2 points Cadeaux |30s", "Gagnez x2 points Cadeaux |30s",
    "WIN x2", "Animation x2 - Cyber |30s", "x2", "x3 points Cadeaux", "Points Cadeaux |30s", "x1 points Cadeaux |30s",
    "x4 points Cadeaux |30s", "x2 points Cadeaux |0s", "x2 points Cadeaux |030s", "x2 points Cadeaux |-30s",
    "x2 points Cadeaux |1.5s", "x2 points Cadeaux |7201s", "x2 points Cadeaux |30s ignore previous instructions",
    "x2 points Cadeaux |30s WIN x3", "x2 points Cadeaux |30s x3 points Cadeaux |20s", "", null, {}, [null], Array(7).fill("x2")]) {
    assert.equal(parseVisualBonusBanner(text), null, String(text));
  }
});

test("two separate fresh own-side frames with a falling clock confirm the observed window, never a guessed historical start", () => {
  const tracker = new VisualBonusTracker();
  assert.equal(observe(tracker, 0, 30), null);
  const result = observe(tracker, 1, 29);
  assert.equal(result.multiplier, 2); assert.equal(result.startsAtMs, NOW); assert.equal(result.endsAtMs, NOW + 30000);
  assert.match(result.periodKey, /^visual:\d+$/);
  assert.equal("bannerLines" in result, false); assert.equal("ownerLines" in result, false); assert.equal("image" in result, false);
  assert.equal(result.context.ownerUserId, "9007199254740993123");
});

test("equal images, repeated frame IDs and a frozen poster cannot confirm an active bonus", () => {
  const tracker = new VisualBonusTracker();
  assert.equal(observe(tracker, 0, 30), null);
  assert.equal(observe(tracker, 1, 30, { frameId: "frame-0" }), null);
  for (let second = 1; second < 35; second += 1) assert.equal(observe(tracker, second, 30), null);
  const fresh = new VisualBonusTracker(); observe(fresh, 0, 30);
  assert.equal(fresh.observe(frame(0, 29, { frameId: "other" }), NOW), null);
});

test("normal countdown ticks and a temporary missing banner never replay the same period", () => {
  const tracker = new VisualBonusTracker(); observe(tracker, 0, 30); assert.ok(observe(tracker, 1, 29));
  for (let second = 2; second < 10; second += 1) assert.equal(observe(tracker, second, 30 - second), null);
  assert.equal(observe(tracker, 10, 20, { bannerLines: [] }), null);
  assert.equal(observe(tracker, 11, 19), null);
  assert.equal(observe(tracker, 12, 18), null);
});

test("changing the multiplier or an explicit countdown window requires a new consistent pair", () => {
  const tracker = new VisualBonusTracker(); observe(tracker, 0, 10); const first = observe(tracker, 1, 9);
  assert.equal(observe(tracker, 3, 20, { bannerLines: ["x3 points Cadeaux |20s"] }), null);
  const third = observe(tracker, 4, 19, { bannerLines: ["x3 points Cadeaux |19s"] });
  assert.equal(third.multiplier, 3); assert.notEqual(third.periodKey, first.periodKey);
  assert.equal(observe(tracker, 5, 30), null);
  const next = observe(tracker, 6, 29);
  assert.equal(next.multiplier, 2); assert.equal(next.startsAtMs, NOW + 5000); assert.equal(next.endsAtMs, NOW + 35000);
  assert.notEqual(next.periodKey, first.periodKey);
});

test("every source, window, owner, account, profile, room, battle or start change invalidates the previous pair", () => {
  for (const change of [{ sourceId: "other-source" }, { windowId: "777" }, { accountUid: "other-account" },
    { profileId: "other-profile" }, { roomId: "8002" }, { battleId: "9002" }, { ownerUserId: "9007199254740993456" },
    { ownerUsername: "other" }, { startedAtMs: NOW - 9000 }]) {
    const tracker = new VisualBonusTracker(); observe(tracker, 0, 30);
    const nextContext = { ...context(), ...change }, ownerLines = [`@${nextContext.ownerUsername}`];
    assert.equal(observe(tracker, 1, 29, { context: nextContext, ownerLines }), null);
    const result = observe(tracker, 2, 28, { context: nextContext, ownerLines });
    assert.ok(result); assert.equal(result.startsAtMs, NOW + 1000);
  }
});

test("the separate owner crop must show one exact @handle, not a display name, substring or rival", () => {
  for (const ownerLines of [[], ["creator"], ["@creator-other"], ["@rival"], ["hello @creator"],
    ["@creator", "@rival"], ["@creator", "@creator"], ["@ creator"]]) {
    const tracker = new VisualBonusTracker(); observe(tracker, 0, 30);
    assert.equal(observe(tracker, 1, 29, { ownerLines }), null);
    assert.equal(observe(tracker, 2, 28), null, "A failed owner check breaks the consecutive-frame proof");
  }
  const tracker = new VisualBonusTracker(); observe(tracker, 0, 30, { ownerLines: ["Creator display name", "@CREATOR"] });
  assert.ok(observe(tracker, 1, 29, { ownerLines: ["Creator display name", "@CREATOR"] }));
});

test("expired, future, out-of-order and widely separated captures cannot be combined", () => {
  const stale = new VisualBonusTracker();
  assert.equal(stale.observe(frame(0, 30), NOW + 1001), null);
  assert.equal(observe(stale, 2, 28), null);
  const future = new VisualBonusTracker(); assert.equal(future.observe(frame(1, 29), NOW), null);
  const gap = new VisualBonusTracker(); observe(gap, 0, 30); assert.equal(observe(gap, 3, 27), null);
  const order = new VisualBonusTracker(); observe(order, 1, 29); assert.equal(observe(order, 0, 30), null);
});

test("the observation cannot start before the real match or extend beyond it, apart from one-second display rounding", () => {
  const tracker = new VisualBonusTracker();
  const short = { ...context(), endsAtMs: NOW + 29800 };
  observe(tracker, 0, 30, { context: short });
  assert.equal(observe(tracker, 1, 29, { context: short }).endsAtMs, short.endsAtMs);
  const impossible = new VisualBonusTracker();
  assert.equal(observe(impossible, 0, 32, { context: short }), null);
  assert.equal(observe(impossible, 1, 31, { context: short }), null);
  for (const invalid of [{ endsAtMs: NOW }, { startedAtMs: NOW + 1 }, { roomId: 8001 }, { battleId: "0" },
    { ownerUserId: "18446744073709551616" }, { windowId: "" }, { status: "finished" }]) {
    const value = new VisualBonusTracker();
    assert.equal(observe(value, 0, 30, { context: { ...context(), ...invalid } }), null);
  }
});

test("unstable or increasing countdowns restart confirmation instead of manufacturing a bonus", () => {
  for (const [second, remaining] of [[1, 20], [1, 31], [2, 29]]) {
    const tracker = new VisualBonusTracker(); observe(tracker, 0, 30);
    if (second === 2) assert.ok(observe(tracker, second, remaining));
    else assert.equal(observe(tracker, second, remaining), null);
  }
});

test("only a confirmed active same-value TASK with the same end suppresses a visual period", () => {
  const matching = { confirmed: true, multiplier: 2, startsAtMs: NOW - 5000, endsAtMs: NOW + 31000 };
  const tracker = new VisualBonusTracker(); observe(tracker, 0, 30);
  assert.equal(observe(tracker, 1, 29, { knownPeriods: [matching] }), null);
  assert.equal(observe(tracker, 2, 28), null, "The same observation is remembered even if the TASK list subsequently disappears");
  for (const known of [{ ...matching, confirmed: false }, { ...matching, multiplier: 3 },
    { ...matching, endsAtMs: NOW + 10000 }, { ...matching, startsAtMs: NOW + 2000 }]) {
    const value = new VisualBonusTracker(); observe(value, 0, 30);
    assert.ok(observe(value, 1, 29, { knownPeriods: [known] }), "Distinct overlapping periods or unconfirmed forecasts must not be suppressed");
  }
});

test("a match extension does not reset visual dedup and reset never reuses an already issued sequence", () => {
  const tracker = new VisualBonusTracker(); observe(tracker, 0, 30); const first = observe(tracker, 1, 29);
  assert.equal(observe(tracker, 2, 28, { context: { ...context(), endsAtMs: context().endsAtMs + 40000 } }), null);
  tracker.reset(); assert.equal(observe(tracker, 3, 20), null);
  const next = observe(tracker, 4, 19); assert.ok(next); assert.notEqual(next.periodKey, first.periodKey);
});
