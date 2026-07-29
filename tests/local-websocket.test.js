"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { encodeFrame } = require("../src/main/local-websocket");

test("encode une frame texte courte", () => {
  const frame = encodeFrame("hello");
  assert.equal(frame[0], 0x81);
  assert.equal(frame[1], 5);
  assert.equal(frame.subarray(2).toString("utf8"), "hello");
});

test("encode une frame étendue", () => {
  const frame = encodeFrame("x".repeat(200));
  assert.equal(frame[1], 126);
  assert.equal(frame.readUInt16BE(2), 200);
});

