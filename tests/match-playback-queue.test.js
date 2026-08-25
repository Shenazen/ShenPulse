"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  create
} = require("../resources/overlays/match-playback-queue");

test("la file Match attend la fin réelle avant de lancer la vidéo suivante", () => {
  const started = [];
  const queue = create({
    onStart: (payload) => started.push(payload.match)
  });

  assert.equal(queue.enqueue({ match: "x2" }), 1);
  assert.equal(queue.enqueue({ match: "x3" }), 2);
  assert.equal(queue.enqueue({ match: "cofre" }), 3);
  assert.deepEqual(started, ["x2"]);
  assert.deepEqual(queue.snapshot().pending.map((item) => item.match), [
    "x3",
    "cofre"
  ]);

  assert.equal(queue.complete(), true);
  assert.deepEqual(started, ["x2", "x3"]);
  assert.equal(queue.snapshot().current.match, "x3");

  assert.equal(queue.complete(), true);
  assert.deepEqual(started, ["x2", "x3", "cofre"]);
  assert.equal(queue.complete(), true);
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

  queue.enqueue({ match: "x2" });
  queue.enqueue({ match: "x3" });
  assert.deepEqual(started, ["x2", "x3"]);
  assert.equal(queue.snapshot().current.match, "x3");
});
