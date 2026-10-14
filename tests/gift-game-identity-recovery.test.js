"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { loadRendererModule } = require("./helpers/three-renderer-traces");

const original = path.join(__dirname, "..", "src/renderer/games/original-src");
const gifts = loadRendererModule(path.join(original, "domain/liveGifts.ts")).api;
const coinPusher = loadRendererModule(path.join(original, "components/games/coinPusherSettings.ts")).api;

test("les jeux ne fusionnent pas deux IDs ayant le même nom, prix et dessin", () => {
  const options = gifts.createGiftTriggerOptions([{ id: "10001", name: "Homonyme", cost: 10, imageUrl: "same.webp", source: "catalog" }, { id: "10002", name: "Homonyme", cost: 10, imageUrl: "same.webp", source: "catalog" }]);
  assert.equal(options.filter((option) => option.name === "Homonyme").length, 2);
  assert.equal(gifts.findGiftTriggerOption("gift:10001", options).id, "gift:10001");
  assert.equal(gifts.findGiftTriggerOption("gift:10002", options).id, "gift:10002");
  assert.equal(gifts.findGiftTriggerOption("gift-name:homonyme", options), undefined);
  assert.equal(gifts.findGiftTriggerOptionByName("Homonyme", options), undefined);
});

test("un ID inconnu n'est pas résolu par un nom identique ou une recherche approximative", () => {
  const options = [{ id: "gift:10001", name: "Corgi", imageUrl: "corgi.webp", colors: [], cost: "10" }];
  assert.equal(gifts.findGiftTriggerOption("gift:10002", options), undefined);
  assert.equal(gifts.findGiftTriggerOptionByName("Cor", options), undefined);
  assert.equal(gifts.findGiftTriggerOptionByName("Corgi", options).id, "gift:10001");
});

test("les alias déclarés du catalogue restent sélectionnables après regroupement", () => {
  const options = gifts.createGiftTriggerOptions([{ id: "10001", alternateIds: ["10002"], alternateNames: ["Ancien nom"], name: "Nouveau nom", cost: 10, imageUrl: "gift.webp", source: "catalog" }]);
  assert.equal(gifts.findGiftTriggerOption("gift:10002", options).id, "gift:10001");
  assert.equal(gifts.findGiftTriggerOptionByName("Ancien nom", options).id, "gift:10001");
});

test("Coin Pusher refuse un autre ID même si le nom de règle est identique", () => {
  const gift = { giftId: "10002", name: "Cadeau", cost: 10 };
  const rule = { giftId: "10001", name: "Cadeau", cost: 10, coinCount: 55, enabled: true };
  assert.equal(coinPusher.findCoinPusherGiftRule(gift, { giftRules: [rule] }), undefined);
  assert.equal(coinPusher.coinPusherDesignatedGiftMatches(gift, rule), false);
  assert.equal(gifts.triggerMatchesGift("gift:10001", gift), false);
  assert.equal(gifts.triggerMatchesGift("10001", gift), false);
});

test("un fournisseur sans ID conserve le repli par nom exact", () => {
  const rule = { giftId: "10001", name: "Cadeau", cost: 10, coinCount: 55, enabled: true };
  assert.equal(coinPusher.findCoinPusherGiftRule({ name: "Cadeau", cost: 10 }, { giftRules: [rule] }).coinCount, 55);
  assert.equal(coinPusher.coinPusherDesignatedGiftMatches({ name: "Cadeau", cost: 10 }, rule), true);
});

test("les alias et la famille persistés survivent à la normalisation et au matching du jeu", () => {
  const rule = { giftId: "old", giftIds: ["old", "10001"], giftFamily: "custom-family", name: "Cadeau", image: "saved.webp", cost: 42, coinCount: 55, enabled: true };
  const normalized = coinPusher.normalizeCoinPusherSettings({ giftRules: [rule], guardGift: rule });
  assert.deepEqual(Array.from(normalized.giftRules[0].giftIds), rule.giftIds);
  assert.deepEqual(Array.from(normalized.guardGift.giftIds), rule.giftIds);
  assert.equal(normalized.giftRules[0].giftFamily, rule.giftFamily);
  assert.equal(normalized.giftRules[0].giftId, "old");
  assert.equal(normalized.giftRules[0].cost, 42);
  assert.equal(coinPusher.findCoinPusherGiftRule({ giftId: "10001", name: "Nouveau nom" }, normalized).coinCount, 55);
  assert.equal(coinPusher.coinPusherDesignatedGiftMatches({ giftId: "10001", name: "Nouveau nom" }, normalized.guardGift), true);
});

test("les anciens IDs de Cœur sur moi fonctionnent avec le cadeau actuel et sa famille personnalisée", () => {
  const rule = { giftId: "7934", name: "Cœur sur moi", giftFamily: "community-heart", coinCount: 2, enabled: true };
  assert.equal(coinPusher.findCoinPusherGiftRule({ giftId: "17712", name: "Cœur du jour" }, { giftRules: [rule] }).coinCount, 2);
  assert.equal(coinPusher.coinPusherDesignatedGiftMatches({ giftId: "creator-specific", giftFamily: "community-heart", name: "Mon cœur" }, rule), true);
  assert.equal(gifts.triggerMatchesGift("gift:7934", { giftId: "creator-specific", giftFamily: "community-heart" }), true);
});

test("les données normalisées du LIVE gardent aussi le coût, le dessin et les IDs connus", () => {
  const gift = gifts.normalizeLiveGift({ giftId: "new", giftIds: ["old", "new"], giftFamily: "community-heart", giftName: "Cœur sur moi", value: 1, giftImageUrl: "heart.webp" });
  assert.equal(gift.cost, 1);
  assert.equal(gift.imageUrl, "heart.webp");
  assert.deepEqual(Array.from(gift.giftIds), ["old", "new"]);
  assert.equal(gifts.triggerMatchesGift("gift:old", gift), true);
});
