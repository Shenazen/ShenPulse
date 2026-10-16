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

test("seuls 7934 et heart-me désignent le cœur, les cadeaux personnels ne deviennent pas ses alias", () => {
  const rule = { giftId: "7934", name: "Cœur sur moi", giftFamily: "community-heart", coinCount: 2, enabled: true };
  assert.equal(coinPusher.findCoinPusherGiftRule({ giftId: "heart-me", name: "Heart Me" }, { giftRules: [rule] }).coinCount, 2);
  for (const giftId of ["17712", "62816", "601333", "157842", "creator-specific"]) {
    const gift = { giftId, giftFamily: "community-heart", name: "Cœur sur moi", giftIds: [giftId, "7934", "heart-me"] };
    assert.equal(coinPusher.findCoinPusherGiftRule(gift, { giftRules: [rule] }), undefined);
    assert.equal(coinPusher.coinPusherDesignatedGiftMatches(gift, rule), false);
    for (const trigger of ["gift:7934", "7934", "heart-me", "gift-name:coeur-sur-moi"]) {
      assert.equal(gifts.triggerMatchesGift(trigger, gift), false, `${giftId} / ${trigger}`);
    }
  }
});

test("les données normalisées du LIVE gardent aussi le coût, le dessin et les IDs connus", () => {
  const gift = gifts.normalizeLiveGift({ giftId: "new", giftIds: ["old", "new"], giftFamily: "community-heart", giftName: "Cœur sur moi", value: 1, giftImageUrl: "heart.webp" });
  assert.equal(gift.cost, 1);
  assert.equal(gift.imageUrl, "heart.webp");
  assert.deepEqual(Array.from(gift.giftIds), ["old", "new"]);
  assert.equal(gift.giftFamily, undefined, "a precise unrelated ID rejects an old automatic heart family");
  assert.equal(gifts.triggerMatchesGift("gift:old", gift), true);
});

test("les nouvelles listes cachent le bretzel et les cadeaux non sélectionnables, mais les références historiques restent lisibles", () => {
  const rows = [{ id: "17712", name: "Cœur de la communauté", cost: 1, imageUrl: "pretzel.webp" },
    { id: "10001", name: "Hidden", selectable: false, cost: 1 },
    { id: "7934", name: "Cœur sur moi", cost: 1, imageUrl: "red.webp" },
    { id: "157842", name: "Shenazen Pulse", cost: 1, imageUrl: "blue.webp" }];
  const options = gifts.createGiftTriggerOptions(rows);
  assert.equal(gifts.findGiftTriggerOption("gift:17712", options), undefined);
  assert.equal(gifts.findGiftTriggerOption("gift:10001", options), undefined);
  assert.equal(gifts.findGiftTriggerOption("gift:7934", options).name, "Cœur sur moi");
  assert.equal(gifts.findGiftTriggerOption("gift:157842", options).name, "Shenazen Pulse");
  const historical = gifts.normalizeGiftTriggerOption({ id: "gift:17712", name: "Cœur de la communauté", selectable: false });
  assert.equal(gifts.findGiftTriggerOption("gift:17712", [historical]).name, "Cœur de la communauté");
  assert.equal(gifts.createGiftTriggerOptionList([historical]).length, 0);
  assert.equal(gifts.triggerMatchesGift("gift:17712", { giftId: "17712" }), true);
});

test("les alias erronés traversant le cœur et un cadeau personnel ne fusionnent plus les options", () => {
  const options = gifts.createGiftTriggerOptions([
    { id: "7934", name: "Cœur sur moi", alternateIds: ["heart-me", "17712", "157842"], cost: 1, imageUrl: "red.webp" },
    { id: "157842", name: "Shenazen Pulse", giftIds: ["7934", "157842"], cost: 1, imageUrl: "blue.webp" }
  ]);
  const heart = gifts.findGiftTriggerOption("gift:7934", options), custom = gifts.findGiftTriggerOption("gift:157842", options);
  assert.ok(heart); assert.ok(custom); assert.notEqual(heart, custom);
  assert.equal(heart.name, "Cœur sur moi"); assert.equal(custom.name, "Shenazen Pulse");
  assert.equal(gifts.findGiftTriggerOption("gift:heart-me", options).id, "gift:7934");
  assert.equal(gifts.findGiftTriggerOption("gift:17712", options), undefined);
  assert.equal(heart.alternateIds.includes("gift:157842"), false);
  assert.equal(custom.alternateIds.includes("gift:7934"), false);
});

test("Coin Pusher refuse les fausses familles même dans une désignation sans ID et garde les règles exactes du cadeau bleu", () => {
  const blue = { giftId: "157842", giftName: "Shenazen Pulse", giftFamily: "community-heart", cost: 1, giftImageUrl: "blue.webp" };
  const heart = { giftId: "7934", giftName: "Cœur sur moi", cost: 1 };
  const blueRule = { giftId: "157842", giftIds: ["157842", "7934"], giftFamily: "community-heart", name: "Shenazen Pulse", coinCount: 7, enabled: true };
  assert.equal(coinPusher.findCoinPusherGiftRule(blue, { giftRules: [blueRule] }).coinCount, 7);
  assert.equal(coinPusher.findCoinPusherGiftRule(heart, { giftRules: [blueRule] }), undefined);
  assert.equal(coinPusher.coinPusherDesignatedGiftMatches(blue, { giftFamily: "community-heart", name: "Shenazen Pulse" }), false);
  assert.equal(coinPusher.coinPusherDesignatedGiftMatches(heart, { giftFamily: "community-heart", name: "Cœur sur moi" }), true);
  const normalized = gifts.normalizeLiveGift(blue);
  assert.equal(normalized.name, "Shenazen Pulse"); assert.equal(normalized.imageUrl, "blue.webp");
  assert.equal(normalized.giftFamily, undefined);
});

test("une famille cœur sans ID principal ne peut importer un cadeau personnel par ses alias persistés", () => {
  const designation = { giftId: "", giftIds: ["7934", "157842"], giftFamily: "community-heart", name: "Cœur sur moi", coinCount: 9, enabled: true };
  const blue = { giftId: "157842", giftName: "Shenazen Pulse", giftFamily: "community-heart" };
  assert.equal(coinPusher.findCoinPusherGiftRule(blue, { giftRules: [designation] }), undefined);
  assert.equal(coinPusher.coinPusherDesignatedGiftMatches(blue, designation), false);
  assert.equal(coinPusher.coinPusherDesignatedGiftMatches({ giftId: "7934", giftName: "Cœur sur moi" }, designation), true);
  const normalized = gifts.normalizeLiveGift({ giftIds: ["7934", "157842"], giftFamily: "community-heart", name: "Cœur sur moi" });
  assert.deepEqual(Array.from(normalized.giftIds), ["7934"]);
  assert.equal(gifts.triggerMatchesGift("gift:157842", normalized), false);
  const option = gifts.normalizeGiftTriggerOption({ id: "", name: "Cœur sur moi", giftIds: ["7934", "157842"], giftFamily: "community-heart" });
  assert.deepEqual(Array.from(option.giftIds), ["7934"]);
  assert.equal(gifts.giftTriggerOptionMatches(option, "gift:157842"), false);
});
