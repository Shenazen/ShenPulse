"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../resources/overlays/runtime/widgets/match-progress.js"), "utf8");

/** Horloge et décodeur contrôlés : aucun média, réseau ou effet réel. */
function harness({ frameCallbacks = false } = {}) {
  let now = 0, nextId = 0, current = true;
  const timers = new Map(), frames = new Map(), errors = [];
  const video = { currentTime: 0, ended: false };
  if (frameCallbacks) {
    video.requestVideoFrameCallback = (callback) => {
      if (frameCallbacks === "throw") throw new Error("CEF unsupported");
      const id = ++nextId; frames.set(id, callback); return id;
    };
    video.cancelVideoFrameCallback = (id) => frames.delete(id);
  }
  const context = vm.createContext({ Date: { now: () => now },
    setTimeout: (callback, delay) => { const id = ++nextId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: (id) => timers.delete(id)
  });
  vm.runInContext(source, context);
  let progress = 0;
  const monitor = context.MatchVideoProgress.watch(video, {
    isCurrent: () => current, onProgress: () => { progress++; }, onStall: (reason) => errors.push(reason)
  });
  return { video, timers, frames, monitor, errors, progress: () => progress,
    revoke: () => { current = false; },
    advance: (milliseconds) => {
      now += milliseconds;
      for (const [id, timer] of [...timers]) if (timers.has(id) && timer.at <= now) {
        timers.delete(id); timer.callback();
      }
    },
    frame: (metadata = {}) => {
      const entry = frames.entries().next().value;
      if (!entry) return;
      frames.delete(entry[0]); entry[1](now, metadata);
    }
  };
}

test("le watchdog attend une horloge réellement avancée avant de confirmer la vidéo", () => {
  const h = harness();
  h.advance(1000);
  assert.equal(h.progress(), 0);
  h.video.currentTime = .1; h.advance(200);
  assert.equal(h.progress(), 1);
  h.video.currentTime = .4; h.advance(200);
  assert.equal(h.progress(), 1, "confirmation unique pour ce média");
  h.monitor.stop();
  assert.equal(h.timers.size, 0);
});

test("un décodeur moderne exige des images avancées et pas seulement une horloge", () => {
  const h = harness({ frameCallbacks: true });
  h.video.currentTime = 2; h.advance(200);
  assert.equal(h.progress(), 0);
  h.frame({ mediaTime: 0, presentedFrames: 1 });
  h.frame({ mediaTime: 0, presentedFrames: 2 });
  assert.equal(h.progress(), 0, "répéter la même image n'est pas une progression");
  h.frame({ mediaTime: .04, presentedFrames: 3 });
  assert.equal(h.progress(), 1);
  h.monitor.stop();
  assert.equal(h.frames.size, 0);
  assert.equal(h.timers.size, 0);
});

test("un démarrage figé et un gel persistant échouent une seule fois puis restent au repos", () => {
  const startup = harness({ frameCallbacks: true });
  startup.advance(1800);
  assert.deepEqual(startup.errors, ["video-stalled"]);
  assert.equal(startup.frames.size, 0);
  assert.equal(startup.timers.size, 0);
  startup.advance(10000);
  assert.deepEqual(startup.errors, ["video-stalled"]);
  const stalled = harness();
  stalled.video.currentTime = .1; stalled.advance(200);
  stalled.advance(2000);
  assert.deepEqual(stalled.errors, ["video-stalled"]);
  assert.equal(stalled.progress(), 1);
  assert.equal(stalled.timers.size, 0);
});

test("révocation, remplacement et fin de lecture annulent callbacks et délais", () => {
  for (const finish of [
    (h) => { h.revoke(); h.frame({ mediaTime: 2 }); },
    (h) => { h.monitor.stop(); h.frame({ mediaTime: 2 }); },
    (h) => { h.video.ended = true; h.advance(200); }
  ]) {
    const h = harness({ frameCallbacks: true }); finish(h);
    assert.equal(h.frames.size, 0);
    assert.equal(h.timers.size, 0);
    assert.equal(h.progress(), 0);
    assert.deepEqual(h.errors, []);
    h.advance(90000);
    assert.deepEqual(h.errors, []);
  }
});

test("une lecture qui ne finit jamais reste bornée même lorsqu'elle progresse", () => {
  const h = harness();
  for (let step = 0; step < 45; step++) { h.video.currentTime += 2; h.advance(2000); }
  assert.deepEqual(h.errors, ["media-timeout"]);
  assert.equal(h.timers.size, 0);
});

test("une ancienne méthode de frame inutilisable retombe sur l'horloge sans boucle inactive", () => {
  const h = harness({ frameCallbacks: "throw" });
  h.video.currentTime = .1; h.advance(200);
  assert.equal(h.progress(), 1);
  assert.deepEqual(h.errors, []);
  h.monitor.stop();
  h.monitor.stop();
  assert.equal(h.frames.size, 0);
  assert.equal(h.timers.size, 0);
});
