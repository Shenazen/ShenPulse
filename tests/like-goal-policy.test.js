"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeBehavior,
  resolveCompletion
} = require("../resources/overlays/like-goal-policy");

test("Augmenter ajoute toujours le palier initial de 10 000 likes", () => {
  assert.deepEqual(resolveCompletion(9_999, 10_000, "increase"), {
    behavior: "increase",
    target: 10_000,
    hidden: false
  });
  assert.equal(resolveCompletion(10_000, 10_000, "increase").target, 20_000);
  assert.equal(resolveCompletion(20_000, 10_000, "increase").target, 30_000);
  assert.equal(resolveCompletion(39_500, 10_000, "increase").target, 40_000);
});

test("Augmenter reprend exactement la valeur choisie au départ", () => {
  assert.equal(resolveCompletion(2_500, 2_500, "increase").target, 5_000);
  assert.equal(resolveCompletion(5_000, 2_500, "increase").target, 7_500);
  assert.equal(resolveCompletion(1_000, 1_000, "increase").target, 2_000);
  assert.equal(resolveCompletion(2_000, 1_000, "increase").target, 3_000);
});

test("Conserver laisse l'objectif rempli et inchangé", () => {
  assert.deepEqual(resolveCompletion(15_000, 10_000, "keep"), {
    behavior: "keep",
    target: 10_000,
    hidden: false
  });
});

test("Doubler multiplie chaque nouvel objectif par deux", () => {
  assert.equal(resolveCompletion(10_000, 10_000, "double").target, 20_000);
  assert.equal(resolveCompletion(20_000, 10_000, "double").target, 40_000);
  assert.equal(resolveCompletion(45_000, 10_000, "double").target, 80_000);
});

test("Masquer cache le Like Goal seulement après l'objectif", () => {
  assert.equal(resolveCompletion(9_999, 10_000, "hide").hidden, false);
  assert.equal(resolveCompletion(10_000, 10_000, "hide").hidden, true);
});

test("une ancienne configuration utilise Augmenter par défaut", () => {
  assert.equal(normalizeBehavior(""), "increase");
  assert.equal(normalizeBehavior("ancienne-valeur"), "increase");
});
