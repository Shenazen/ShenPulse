"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { GiftCatalog, dedupeGiftCatalog, dedupeLocalizedGifts } = require("../src/main/catalogs");
const { COMMUNITY_HEART_IMAGE_URL, enrichGiftEvent, giftConditionMatches } = require("../src/shared/gift-identity");

const historicalHeartImage = "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/d56945782445b0b8c8658ed44f894c7b~tplv-obj.webp";
const resourcesDirectory = path.join(__dirname, "..", "resources");

test("le cœur de communauté utilise son visuel TikTok actuel sans perdre les anciens ID", () => {
  const raw = [
    { id: "heart-me", name: "Heart Me", cost: 1, imageUrl: historicalHeartImage, source: "catalog" },
    { id: "7934", name: "Envoie-moi un cœur", cost: 1, imageUrl: "https://example.com/personnalise.webp", source: "tiklive" },
    { id: "17712", name: "Cœur de la communauté", cost: 1, imageUrl: COMMUNITY_HEART_IMAGE_URL, source: "tiklive" }
  ];
  const before = JSON.stringify(raw);
  const [gift] = dedupeGiftCatalog(raw);
  assert.equal(gift.name, "Cœur sur moi");
  assert.equal(gift.imageUrl, COMMUNITY_HEART_IMAGE_URL);
  assert.equal(gift.cost, 1);
  assert.deepEqual(new Set([gift.id, ...gift.alternateIds]), new Set(raw.map((entry) => entry.id)));
  assert.equal(JSON.stringify(raw), before, "les sources originales ne sont pas réécrites");
});

test("le visuel embarqué correspond au cadeau 17712 renvoyé par le catalogue TikTok", () => {
  const payload = JSON.parse(fs.readFileSync(path.join(resourcesDirectory, "catalogs/tiklive-gifts.json"), "utf8"));
  const current = payload.gifts.find((gift) => gift.id === "17712");
  assert.equal(current.imageUrl, COMMUNITY_HEART_IMAGE_URL);
  const catalog = new GiftCatalog(resourcesDirectory);
  const result = catalog.search("Cœur sur moi", 10).gifts[0];
  assert.equal(result.imageUrl, current.imageUrl);
  assert.ok([result.id, ...result.alternateIds].includes("7934"));
  assert.ok([result.id, ...result.alternateIds].includes("heart-me"));
});

test("les associations de profils, jeux, actions et sons ne dépendent pas du changement de visuel", () => {
  const catalog = new GiftCatalog(resourcesDirectory);
  // Chaque emplacement garde sa condition, son ID, son ordre et son action.
  const references = ["actions", "sounds", "games", "other-profile"].flatMap((scope) =>
    ["7934", "17712", "heart-me"].map((giftId) => ({
      id: `${scope}-${giftId}`,
      actionIds: [`${scope}-action`],
      conditions: [{ field: "data.giftName", operator: "equals", value: "Heart Me", giftId, giftImageUrl: historicalHeartImage }]
    }))
  );
  const before = JSON.stringify(references);
  for (const rule of references) {
    for (const giftId of ["7934", "17712", "62816", "601333"]) {
      assert.equal(giftConditionMatches(rule.conditions[0], { type: "gift", data: { giftId, giftName: "Cœur sur moi", value: 1 } }, catalog.gifts), true);
    }
    assert.equal(giftConditionMatches(rule.conditions[0], { type: "gift", data: { giftId: "5655", giftName: "Rose", value: 1 } }, catalog.gifts), false);
  }
  assert.equal(JSON.stringify(references), before);
});

test("les visuels LIVE originaux sont conservés, les autres cadeaux restent inchangés", () => {
  const input = [{ id: 601333, name: "Nom personnalisé", diamond_count: 1, combo: true, image: { uri: "webcast-sg/resource/saliency_seg_custom.png", url_list: ["https://example.com/custom.webp"] } }];
  const localized = dedupeLocalizedGifts(input);
  assert.equal(localized[0].imageUrl, COMMUNITY_HEART_IMAGE_URL);
  const event = { type: "gift", data: { giftId: "601333", giftName: "Nom personnalisé", giftFamily: "community-heart", giftImageUrl: "https://example.com/custom.webp", value: 1 } };
  const before = JSON.stringify(event);
  const enriched = enrichGiftEvent(event, localized);
  assert.equal(enriched.data.giftImageUrl, event.data.giftImageUrl);
  assert.equal(enriched.data.giftCatalogImageUrl, COMMUNITY_HEART_IMAGE_URL);
  assert.equal(JSON.stringify(event), before);
  const [rose] = dedupeGiftCatalog([{ id: "5655", name: "Rose", cost: 1, imageUrl: "https://example.com/rose.webp" }]);
  assert.equal(rose.imageUrl, "https://example.com/rose.webp");
});

test("les caches du renderer actualisent les noms et les alias sans garder l’ancien visuel", () => {
  const context = vm.createContext({ giftCatalogById: new Map(), giftCatalogByName: new Map(), GIFT_CATALOG: [] });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/core/ui-foundations.js"), "utf8"), context);
  const previous = { id: "7934", alternateIds: ["heart-me"], name: "Heart Me", alternateNames: ["Ancien nom conservé"], imageUrl: historicalHeartImage };
  const current = { id: "7934", alternateIds: [], name: "Cœur sur moi", alternateNames: ["Heart Me"], imageUrl: COMMUNITY_HEART_IMAGE_URL };
  context.rememberGifts([previous]);
  context.rememberGifts([current]);
  assert.equal(context.giftForIdentity("Heart Me", "7934"), current);
  assert.equal(context.giftForIdentity("Heart Me", "heart-me"), current);
  assert.equal(context.giftForName("Heart Me"), current);
  assert.equal(context.giftForName("Ancien nom conservé"), current);
  assert.equal(context.GIFT_CATALOG.length, 1);
  assert.equal(context.GIFT_CATALOG[0], current);
});
