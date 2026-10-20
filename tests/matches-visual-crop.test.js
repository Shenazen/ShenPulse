"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
async function run(mode, bannerROI, ownerROI, ownerMode) {
  const draws = [], canvasSizes = [], timers = [], frames = [], tracks = [{ stop() {}, addEventListener() {} }];
  const video = { videoWidth: 1920, videoHeight: 1080, play: async () => {}, pause() {} };
  const context = {
    console, Date, setTimeout: (callback) => { timers.push(callback); return timers.length; }, clearTimeout() {},
    navigator: { mediaDevices: { getDisplayMedia: async () => ({ getTracks: () => tracks, getVideoTracks: () => tracks, getAudioTracks: () => [] }) } },
    document: { getElementById: () => video, createElement: () => {
      const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: (...args) => draws.push(args.slice(1)) }),
        toDataURL: () => { canvasSizes.push([canvas.width, canvas.height]); return "data:image/png;base64,synthetic"; } };
      return canvas;
    } },
    window: { addEventListener() {}, shenPulseVision: { onStop() {}, status: async () => {},
      frame: async (payload) => { frames.push(payload); return { accepted: true, stop: true }; } } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/renderer/match-vision.js"), "utf8"), context);
  await context.window.startShenPulseVisionCapture({ mode, token: "synthetic-only", bannerROI, ownerROI, ownerMode });
  await timers.shift()();
  await new Promise(setImmediate);
  return { draws, canvasSizes, frames };
}
test("monitor enlarges only the two exact consented crops for small Studio text", async () => {
  const roi = { x: 0.1, y: 0.2, width: 0.2, height: 0.05 };
  const result = await run("monitor", roi, roi);
  assert.equal(result.draws.length, 2);
  assert.deepEqual(result.canvasSizes, [[768, 108], [768, 108]]);
  for (const draw of result.draws) assert.deepEqual(draw.slice(0, 4), [192, 216, 384, 54]);
  assert.equal(result.frames[0].image, undefined);
});
test("large monitoring crops retain existing PNG size bounds", async () => {
  const result = await run("monitor", { x: 0, y: 0, width: 1, height: 0.3 }, { x: 0, y: 0, width: 1, height: 0.1 });
  assert.ok(result.canvasSizes[0][0] <= 1600 && result.canvasSizes[0][1] <= 600);
  assert.ok(result.canvasSizes[1][0] <= 1200 && result.canvasSizes[1][1] <= 400);
});
test("one-shot preview remains the same full-window bounded size without OCR enlargement", async () => {
  const result = await run("preview");
  assert.deepEqual(result.canvasSizes, [[1920, 1080]]);
  assert.equal(result.frames[0].banner, undefined);
  assert.equal(result.frames[0].owner, undefined);
});

test("declared own-screen monitoring draws only the consented banner, never the face or identity", async () => {
  const roi = { x: 0.1, y: 0.2, width: 0.2, height: 0.05 };
  const result = await run("monitor", roi, null, "self-screen");
  assert.equal(result.draws.length, 1);
  assert.deepEqual(result.draws[0].slice(0, 4), [192, 216, 384, 54]);
  assert.deepEqual(result.canvasSizes, [[768, 108]]);
  assert.equal(result.frames[0].owner, null);
  assert.equal(result.frames[0].image, undefined);
});
