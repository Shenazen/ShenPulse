"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { findCatalogGift, giftFamily, giftImageIdentity, giftVisualUrl, normalizeGiftName } = require("../src/shared/gift-identity");
const { wheelGiftTriggerMatches } = require("../src/main/core/trigger-policy");

const catalogue = [
  { id: "rose", alternateIds: ["5655"], name: "Rose", cost: 1, imageUrl: "https://cdn/rose.png" },
  { id: "galaxy-500", name: "Galaxy", cost: 500, imageUrl: "https://cdn/galaxy.png" },
  { id: "galaxy-1000", name: "Galaxie", alternateNames: ["Galaxy"], cost: 1000, imageUrl: "https://cdn/galaxy.png" }
];

test("l’ID exact prime sur un ancien nom, prix ou dessin erroné", () => {
  assert.equal(findCatalogGift(catalogue, { giftId: "5655", giftName: "Galaxy", giftCost: 1000, giftImageUrl: "https://cdn/galaxy.png" }), catalogue[0]);
});

test("les alias techniques enregistrés permettent une reprise confirmée", () => {
  assert.equal(findCatalogGift(catalogue, { giftId: "ancien-slug", giftIds: ["5655"], giftName: "Ancien nom" }), catalogue[0]);
  assert.equal(findCatalogGift(catalogue, { giftIds: ["5655", "galaxy-500"] }), null);
});

test("un ID inconnu n’est jamais réattribué par nom, prix ou image", () => {
  assert.equal(findCatalogGift(catalogue, { giftId: "retired", giftName: "Rose", giftCost: 1, giftImageUrl: "https://cdn/rose.png" }), null);
  assert.equal(findCatalogGift(catalogue, { giftImageUrl: "https://cdn/rose.png" }), null);
  assert.equal(findCatalogGift(catalogue, { giftCost: 1 }), null);
});

test("les anciens noms seuls sont résolus uniquement sans ambiguïté", () => {
  assert.equal(findCatalogGift(catalogue, { giftName: "Rose" }), catalogue[0]);
  assert.equal(findCatalogGift(catalogue, { giftName: "Galaxy" }), null);
  assert.equal(findCatalogGift(catalogue, { giftName: "Galaxy", giftCost: 1000 }), catalogue[2]);
  assert.equal(findCatalogGift([...catalogue, { id: "autre-galaxie", name: "Galaxy", cost: 1000 }], { giftName: "Galaxy", giftCost: 1000 }), null);
});

test("un alias d’ID partagé par deux cadeaux n’est pas choisi arbitrairement", () => {
  assert.equal(findCatalogGift([
    { id: "first", alternateIds: ["shared"], name: "Premier" },
    { id: "second", alternateIds: ["shared"], name: "Second" }
  ], { giftId: "shared" }), null);
});

test("les noms non latins ne sont pas tronqués en un autre cadeau", () => {
  assert.notEqual(normalizeGiftName("TikTok 화산"), normalizeGiftName("TikTok"));
  assert.notEqual(normalizeGiftName("هيا يا Galaxy"), normalizeGiftName("Galaxy"));
  assert.equal(normalizeGiftName("CŒUR sur moi"), "coeur sur moi");
});

test("un visuel commun retrouve une ancienne sélection sans inventer d’identité", () => {
  const regional = [
    { id: "one", name: "Chat", cost: 222, imageUrl: "https://cdn-a/chat.png~small.webp" },
    { id: "two", name: "Chat", cost: 222, imageUrl: "https://cdn-b/chat.png~large.webp" }
  ];
  assert.equal(findCatalogGift(regional, { giftName: "Chat" }), null);
  assert.equal(giftVisualUrl(regional, { giftName: "Chat" }), regional[0].imageUrl);
  assert.equal(giftVisualUrl(regional, { giftId: "retired", giftName: "Chat" }), "");
  assert.equal(giftVisualUrl(regional, { giftImageUrl: regional[0].imageUrl, giftCost: 222 }), "");
  assert.equal(giftVisualUrl([...regional, { id: "other", name: "Chat", cost: 222, imageUrl: "https://cdn/other.png" }], { giftName: "Chat" }), "");
  assert.equal(giftVisualUrl([...regional, { id: "other", name: "Chat", cost: 333, imageUrl: "https://cdn-a/chat.png" }], { giftName: "Chat" }), "");
});

test("les formats du même hash CDN ont le même visuel, sans assimiler les fichiers ordinaires", () => {
  const hash = "44818035acbbe673514caa600755268c";
  assert.equal(giftImageIdentity(`https://cdn-a/${hash}`), giftImageIdentity(`https://cdn-b/${hash}.png~obj.webp`));
  assert.equal(giftImageIdentity(`https://cdn-a/${hash}.webp`), hash);
  assert.notEqual(giftImageIdentity("https://cdn/chat.png"), giftImageIdentity("https://cdn/chat.webp"));
});

test("un ID distinct n’est pas déclaré cœur de communauté sur son seul nom", () => {
  assert.equal(giftFamily({ giftId: "distinct", giftName: "Heart Me", giftCost: 999 }), "");
  assert.equal(giftFamily({ giftId: "distinct", giftName: "Envoie-moi un cœur", giftCost: 1 }), "");
  assert.equal(giftFamily({ giftId: "heart-me", giftName: "Ancien libellé" }), "community-heart");
  assert.equal(giftFamily({ giftId: "distinct", giftCost: 1, giftCombo: true, giftImageUri: "saliency_seg_custom.png" }), "community-heart");
});

test("le résolveur commun s’exécute aussi dans l’interface sans CommonJS", () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/shared/gift-identity.js"), "utf8"), context);
  assert.equal(typeof context.ShenPulseGiftIdentity.findCatalogGift, "function");
  assert.equal(context.ShenPulseGiftIdentity.findCatalogGift(catalogue, { giftId: "5655" }), catalogue[0]);
  assert.equal(context.ShenPulseGiftIdentity.findCatalogGift(catalogue, { giftId: "unknown", giftName: "Rose" }), null);
});

test("les roues utilisent les alias enregistrés même hors catalogue", () => {
  const wheel = { enabled: true, trigger: "Ancien nom", triggerGift: { giftId: "ancien", giftIds: ["nouveau"] } };
  assert.equal(wheelGiftTriggerMatches(wheel, { type: "gift", data: { giftId: "nouveau", giftName: "Nouveau nom" } }), true);
  assert.equal(wheelGiftTriggerMatches(wheel, { type: "gift", data: { giftId: "autre", giftName: "Ancien nom" } }), false);
});
