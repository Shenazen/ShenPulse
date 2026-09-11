"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  create
} = require("../resources/overlays/match-playback-queue");

test("le lecteur Match remplace immédiatement la vidéo active sans file d’attente", () => {
  const started = [];
  const queue = create({
    onStart: (payload) => started.push(payload.match)
  });

  assert.equal(queue.enqueue({ requestId: "1", match: "x2" }), "started");
  assert.equal(queue.enqueue({ requestId: "2", match: "x3" }), "replaced");
  assert.equal(queue.enqueue({ requestId: "3", match: "x3" }), "restarted");
  assert.deepEqual(started, ["x2", "x3", "x3"]);
  assert.deepEqual(queue.snapshot().pending, []);
  assert.equal(queue.snapshot().current.requestId, "3");
  assert.equal(queue.complete("2"), false);
  assert.equal(queue.snapshot().active, true);
  assert.equal(queue.complete("3"), true);
  assert.equal(queue.complete(), false);
  assert.equal(queue.snapshot().active, false);
});

test("une erreur de démarrage ne bloque pas les Matchs suivants", () => {
  const started = [];
  const queue = create({
    onStart: (payload) => {
      started.push(payload.match);
      if (payload.match === "x2") throw new Error("vidéo indisponible");
    }
  });

  assert.equal(queue.enqueue({ match: "x2" }), "failed");
  assert.equal(queue.enqueue({ match: "x3" }), "started");
  assert.deepEqual(started, ["x2", "x3"]);
  assert.equal(queue.snapshot().current.match, "x3");
});
