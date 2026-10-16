"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { TikTokMatchClock } = require("../src/main/matches/tiktok-clock");

const EPOCH = 1792100000000;
function fixture() {
  let now = EPOCH;
  return { clock: new TikTokMatchClock({ now: () => now }), now: () => now,
    advance: (amount) => { now += amount; }, set: (value) => { now = value; } };
}

test("observed container lead +2318ms translates a future server deadline without waiting for another packet", () => {
  const f = fixture();
  assert.equal(f.clock.offsetMs, 0);
  assert.equal(f.clock.observe(String(EPOCH + 2318), EPOCH), true);
  assert.equal(f.clock.offsetMs, 2318);
  const futureServerDeadline = EPOCH + 2318 + 20000;
  assert.equal(futureServerDeadline - f.clock.offsetMs - EPOCH, 20000);
});

test("slower packets cannot reduce the established maximum or introduce a negative estimate", () => {
  const f = fixture();
  assert.equal(f.clock.observe(EPOCH + 2318, EPOCH), true);
  f.advance(1000);
  assert.equal(f.clock.observe(f.now() + 2000, f.now()), true);
  assert.equal(f.clock.offsetMs, 2318);
  f.advance(1000);
  assert.equal(f.clock.observe(f.now() + 1800, f.now()), true);
  assert.equal(f.clock.offsetMs, 2318);
  f.advance(5000);
  assert.equal(f.clock.observe(f.now() - 100, f.now()), false);
  assert.equal(f.clock.offsetMs, 2318);
});

test("samples expire passively at sixty seconds and the next valid candidate takes over", () => {
  const f = fixture();
  f.clock.observe(f.now() + 2318, f.now());
  f.advance(10000); f.clock.observe(f.now() + 2000, f.now());
  f.advance(49999); assert.equal(f.clock.offsetMs, 2318);
  f.advance(1); assert.equal(f.clock.offsetMs, 2000);
  f.advance(10000); assert.equal(f.clock.offsetMs, 0);
});

test("decreasing candidate burst preserves the maximum while memory stays capped", () => {
  const f = fixture();
  f.clock.observe(f.now() + 5000, f.now());
  for (let index = 1; index < 100; index++) {
    f.advance(100);
    assert.equal(f.clock.observe(f.now() + 5000 - index, f.now()), true);
    assert.equal(f.clock.offsetMs, 5000);
  }
  f.set(EPOCH + 60000);
  assert.equal(f.clock.offsetMs, 4931, "After cap, maximum plus31 newest candidates were retained");
  f.advance(10000); assert.equal(f.clock.offsetMs, 0);
});

test("newer larger or equal offsets dominate older candidates and extend only their own lease", () => {
  const f = fixture();
  f.clock.observe(f.now() + 1000, f.now());
  f.advance(10000); f.clock.observe(f.now() + 2318, f.now());
  f.advance(10000); f.clock.observe(f.now() + 2318, f.now());
  f.set(EPOCH + 79999); assert.equal(f.clock.offsetMs, 2318);
  f.advance(1); assert.equal(f.clock.offsetMs, 0);
});

test("malformed, zero, coerced, nonintegral, impossible and excessive-skew inputs are rejected", () => {
  const invalid = [null, undefined, NaN, Infinity, -1, 0, "0", "", " ", "1e12", "0x1234", "01792100000000", "1792100000000.5", "1792100000000\n",
    [], [EPOCH], {}, { valueOf: () => EPOCH }, true, false, EPOCH + 0.5, Number.MAX_SAFE_INTEGER + 1, 8.64e15 + 1, 1792100000];
  for (const value of invalid) {
    const f = fixture();
    assert.equal(f.clock.observe(value, f.now()), false);
    assert.equal(f.clock.observe(f.now() + 2318, value), false);
    assert.equal(f.clock.offsetMs, 0);
  }
  const f = fixture();
  assert.equal(f.clock.observe(f.now() + 30000, f.now()), true);
  f.advance(1000);
  assert.equal(f.clock.observe(f.now() + 30001, f.now()), false);
  assert.equal(f.clock.offsetMs, 30000);
});

test("out-of-order server times, out-of-order receipts and stale or future receipts cannot update the clock", () => {
  const f = fixture();
  f.clock.observe(f.now() + 2318, f.now());
  f.advance(1000);
  for (const [server, received] of [[EPOCH + 2318, f.now()], [EPOCH + 2317, f.now()],
    [f.now() + 2500, EPOCH - 1], [f.now() + 2500, f.now() + 1], [f.now() + 2500, f.now() - 60000]]) {
    assert.equal(f.clock.observe(server, received), false);
    assert.equal(f.clock.offsetMs, 2318);
  }
});

test("zero offset is valid but never produces a delay or overrides a positive estimate", () => {
  const f = fixture();
  assert.equal(f.clock.observe(f.now(), f.now()), true);
  assert.equal(f.clock.offsetMs, 0);
  f.advance(1000); f.clock.observe(f.now() + 2318, f.now());
  f.advance(5000); f.clock.observe(f.now(), f.now());
  assert.equal(f.clock.offsetMs, 2318);
});

test("connection instances are isolated and reconnect reset drops observations and ordering fences", () => {
  const first = fixture(), second = fixture();
  first.clock.observe(first.now() + 2318, first.now());
  assert.equal(second.clock.offsetMs, 0);
  second.clock.observe(second.now() + 500, second.now());
  assert.equal(first.clock.offsetMs, 2318);
  first.clock.reset();
  assert.equal(first.clock.offsetMs, 0);
  assert.equal(second.clock.offsetMs, 500);
  assert.equal(first.clock.observe(first.now() + 100, first.now()), true, "new connection does not inherit old server ordering fence");
  assert.equal(first.clock.offsetMs, 100);
});

test("backward host-clock jumps and invalid local clock invalidate old samples without timers", () => {
  const f = fixture();
  f.clock.observe(f.now() + 2318, f.now());
  f.advance(20000); assert.equal(f.clock.offsetMs, 2318);
  f.advance(-1); assert.equal(f.clock.offsetMs, 0);
  assert.equal(f.clock.observe(f.now() + 500, f.now()), true);
  f.set(NaN); assert.equal(f.clock.offsetMs, 0);
  assert.equal(f.clock.observe(EPOCH + 25000, EPOCH + 24000), false);
  f.set(EPOCH + 25000);
  assert.equal(f.clock.observe(f.now() + 600, f.now()), true);
  assert.equal(f.clock.offsetMs, 600);
});
