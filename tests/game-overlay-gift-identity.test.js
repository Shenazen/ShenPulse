"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const api = import("../src/renderer/game-overlays/gifts.mjs");

test("l'export garde deux cadeaux aux ID distincts même si leur nom, prix et image sont identiques", async () => {
  const { normalizeGiftTriggerOptions } = await api;
  const options = normalizeGiftTriggerOptions([
    { id: "gift:11111", name: "Cadeau partagé", cost: 7, imageUrl: "https://example.com/shared.webp" },
    { id: "gift:22222", name: "Cadeau partagé", cost: 7, imageUrl: "https://example.com/shared.webp" }
  ]);
  assert.equal(options.length, 2);
  assert.deepEqual(options.map((option) => option.id), ["gift:11111", "gift:22222"]);
});

test("l'export n'attribue jamais un ID numérique inconnu par le seul nom d'une option", async () => {
  const { findGiftTriggerOption, giftTriggerOptionMatches } = await api;
  const options = [{ id: "gift:99999", name: "Rose", imageUrl: "https://example.com/rose.webp" }];
  assert.equal(giftTriggerOptionMatches(options[0], "gift:5655"), false);
  assert.equal(findGiftTriggerOption("gift:5655", options), undefined);
  assert.equal(findGiftTriggerOption("5655", options), undefined);
});

test("l'export conserve les alias explicites lors de la fusion et résout chacune des références", async () => {
  const { normalizeGiftTriggerOptions, findGiftTriggerOption } = await api;
  const options = normalizeGiftTriggerOptions([
    { id: "gift:11111", alternateIds: ["ancien-slug", "22222"], name: "Cadeau", cost: 7 },
    { id: "gift:22222", name: "Nom actuel", cost: 7, imageUrl: "https://example.com/current.webp" }
  ]);
  assert.equal(options.length, 1);
  assert.equal(options[0].id, "gift:11111");
  assert.ok(options[0].alternateIds.includes("ancien-slug"));
  assert.ok(options[0].alternateIds.includes("gift:22222"));
  assert.equal(options[0].imageUrl, "https://example.com/current.webp");
  for (const id of ["gift:11111", "11111", "gift:22222", "22222", "ancien-slug"]) {
    assert.equal(findGiftTriggerOption(id, options).id, "gift:11111");
  }
});

test("l'export rassemble les chaînes d'alias techniques transitives sans perdre une référence", async () => {
  const { normalizeGiftTriggerOptions, findGiftTriggerOption } = await api;
  const options = normalizeGiftTriggerOptions([
    { id: "gift:11111", alternateIds: ["gift:22222"], name: "Cadeau" },
    { id: "gift:33333", name: "Autre nom" },
    { id: "gift:22222", alternateIds: ["gift:33333"], name: "Cadeau récent", imageUrl: "https://example.com/current.webp" }
  ]);
  assert.equal(options.length, 1);
  for (const id of ["gift:11111", "gift:22222", "gift:33333"]) assert.ok(findGiftTriggerOption(id, options));
});

test("l'export distingue les deux Love You et laisse le nom seul ambigu", async () => {
  const { normalizeGiftTriggerOptions, findGiftTriggerOption } = await api;
  const options = [
    { id: "gift:6671", name: "Love You", cost: 199 },
    { id: "gift:6890", name: "Love you", cost: 1 }
  ];
  assert.equal(normalizeGiftTriggerOptions(options).length, 2);
  assert.equal(findGiftTriggerOption("gift:6671", options).coinCost, 199);
  assert.equal(findGiftTriggerOption("gift:6890", options).coinCost, 1);
  assert.equal(findGiftTriggerOption("gift-name:Love You", options), undefined);
});

test("l'export résout les noms anciens uniquement lorsqu'ils désignent une seule option", async () => {
  const { findGiftTriggerOption } = await api;
  const options = [{ id: "gift:8259", alternateNames: ["Amour en langue des signes"], name: "Amour en langage des signes", cost: 49 }];
  assert.equal(findGiftTriggerOption("gift-name:Amour en langue des signes", options).id, "gift:8259");
  assert.equal(findGiftTriggerOption("Amour en langue des signes", options).id, "gift:8259");
  assert.equal(findGiftTriggerOption("gift:Amour en langue des signes", options), undefined);
});

test("les anciens alias techniques déclarés Rose et 5655 restent compatibles", async () => {
  const { normalizeGiftTriggerOptions, findGiftTriggerOption } = await api;
  const options = normalizeGiftTriggerOptions([
    { id: "gift:rose", name: "Rose", cost: 1 },
    { id: "gift:5655", name: "Rose", cost: 1, imageUrl: "https://example.com/rose.webp" }
  ]);
  assert.equal(options.length, 1);
  assert.equal(options[0].id, "gift:5655");
  assert.equal(findGiftTriggerOption("gift:rose", options).id, "gift:5655");
});

test("les ID Galaxy distincts ne sont pas fusionnés par un nom anglais ou français commun", async () => {
  const { normalizeGiftTriggerOptions, findGiftTriggerOption } = await api;
  const options = [
    { id: "gift:5886", name: "Galaxie", cost: 1000 },
    { id: "gift:11046", name: "Galaxy", cost: 1000 }
  ];
  assert.equal(normalizeGiftTriggerOptions(options).length, 2);
  assert.equal(findGiftTriggerOption("gift:5886", options).id, "gift:5886");
  assert.equal(findGiftTriggerOption("gift:11046", options).id, "gift:11046");
  assert.equal(findGiftTriggerOption("gift-name:Galaxy", options), undefined);
});

test("l'export préserve les lettres non latines au lieu de créer de faux homonymes", async () => {
  const { slugify, findGiftTriggerOption } = await api;
  assert.notEqual(slugify("TikTok 화산"), slugify("TikTok"));
  assert.notEqual(slugify("هيا يا Galaxy"), slugify("Galaxy"));
  const options = [
    { id: "gift:5269", name: "TikTok" },
    { id: "gift:14669", name: "TikTok 화산" },
    { id: "gift:11046", name: "Galaxy" },
    { id: "gift:18056", name: "هيا يا Galaxy" }
  ];
  assert.equal(findGiftTriggerOption("gift-name:TikTok", options).id, "gift:5269");
  assert.equal(findGiftTriggerOption("gift-name:Galaxy", options).id, "gift:11046");
});

test("la normalisation d'export ne modifie pas les options données par les profils", async () => {
  const { normalizeGiftTriggerOptions } = await api;
  const input = [{ id: "gift:11111", alternateIds: ["ancien-id"], alternateNames: ["Ancien nom"], name: "Cadeau", cost: 7 }];
  const before = JSON.stringify(input);
  normalizeGiftTriggerOptions(input);
  assert.equal(JSON.stringify(input), before);
});
