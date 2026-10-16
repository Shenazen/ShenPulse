"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { GiftCatalog, dedupeGiftCatalog, dedupeLocalizedGifts, normalizeGift } = require("../src/main/catalogs");
const { COMMUNITY_HEART_IMAGE_URL, enrichGiftEvent, giftConditionMatches, giftIdentity } = require("../src/shared/gift-identity");
const { collectGiftReferenceUpdates, applyGiftReferenceUpdates } = require("../src/main/state/gift-upgrade-migration");

const historicalHeartImage = "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/d56945782445b0b8c8658ed44f894c7b~tplv-obj.webp";
const intertwinedHeartImage = "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/dad7a63955f98891958e37071bb067f3.png~tplv-obj.webp";
const neutralHeartImage = "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/heartme_outfit/base_heartme_composition.png~tplv-obj.webp";
const resourcesDirectory = path.join(__dirname, "..", "resources");

test("Cœur sur moi garde uniquement ses vrais ID, le bretzel reste une référence historique non sélectionnable", () => {
  const raw = [
    { id: "heart-me", name: "Heart Me", cost: 1, imageUrl: historicalHeartImage, source: "catalog" },
    { id: "7934", name: "Envoie-moi un cœur", cost: 1, imageUrl: "https://example.com/personnalise.webp", source: "tiklive" },
    { id: "17712", name: "Cœur de la communauté", cost: 1, imageUrl: COMMUNITY_HEART_IMAGE_URL, source: "tiklive" }
  ];
  const before = JSON.stringify(raw);
  const gifts = dedupeGiftCatalog(raw), gift = gifts.find((entry) => entry.giftFamily === "community-heart");
  assert.equal(gift.name, "Cœur sur moi");
  assert.equal(gift.imageUrl, COMMUNITY_HEART_IMAGE_URL);
  assert.equal(gift.cost, 1);
  assert.deepEqual(new Set([gift.id, ...gift.alternateIds]), new Set(["heart-me", "7934"]));
  const pretzel = gifts.find((entry) => entry.id === "17712");
  assert.equal(pretzel.selectable, false); assert.equal(pretzel.giftFamily, "");
  assert.notEqual(pretzel, gift);
  assert.equal(JSON.stringify(raw), before, "les sources originales ne sont pas réécrites");
});

test("la base rouge remplace l'icône dorée sans réécrire les sources, les identités ou les prix", () => {
  const payload = JSON.parse(fs.readFileSync(path.join(resourcesDirectory, "catalogs/tiklive-gifts.json"), "utf8"));
  const current = payload.gifts.find((gift) => gift.id === "17712");
  const oldHeartMe = payload.gifts.find((gift) => gift.id === "7934");
  assert.equal(current.imageUrl, intertwinedHeartImage, "la source brute reste une preuve de provenance, pas un correctif d'identité");
  assert.match(oldHeartMe.imageUrl, /resource\/composed\./, "la variante de salle ne devient pas l'icône neutre");
  assert.equal(COMMUNITY_HEART_IMAGE_URL, neutralHeartImage);
  const catalog = new GiftCatalog(resourcesDirectory);
  const result = catalog.search("Cœur sur moi", 10).gifts[0];
  assert.equal(result.imageUrl, neutralHeartImage);
  assert.equal(result.cost, 1);
  assert.ok([result.id, ...result.alternateIds].includes("7934"));
  assert.ok([result.id, ...result.alternateIds].includes("heart-me"));
});

test("toutes les sources du vrai cœur restent rouges, sans assimiler les cadeaux personnels", async () => {
  for (const id of ["7934", "heart-me"]) {
    for (const source of ["catalog", "tiklive", "tiktok-fr", "live", "tiktok-room"]) {
      const input = { id, name: "Heart Me", cost: 1, imageUrl: intertwinedHeartImage, source };
      const gift = normalizeGift(input);
      assert.equal(gift.id, id);
      assert.equal(gift.cost, 1);
      assert.equal(gift.imageUrl, neutralHeartImage);
      assert.equal(input.imageUrl, intertwinedHeartImage);
    }
  }
  const catalog = new GiftCatalog(resourcesDirectory, { fetchLocalizedGifts: async () => [
    { id: "7934", name: "Heart Me", diamond_count: 1, image: { url_list: [intertwinedHeartImage] } }
  ] });
  await catalog.refreshLocalized("synthetic-fixture");
  assert.equal(catalog.search("Cœur sur moi").gifts[0].imageUrl, neutralHeartImage);
  catalog.mergeLiveGift({ giftId: "7934", giftName: "Heart Me", value: 1, giftImageUrl: intertwinedHeartImage });
  assert.equal(catalog.search("Cœur sur moi").gifts[0].imageUrl, neutralHeartImage);
  assert.equal(catalog.search("Cœur sur moi").gifts[0].cost, 1);
});

test("la migration du catalogue réel corrige les anciennes images dorées de tous les profils sans changement fonctionnel", () => {
  const gifts = new GiftCatalog(resourcesDirectory).gifts;
  const canonical = gifts.find((gift) => gift.giftFamily === "community-heart");
  const identity = giftIdentity(canonical);
  const condition = () => ({ field: "data.giftName", operator: "equals", value: "Heart Me", giftId: "7934",
    giftIds: identity.ids.filter((id) => id !== "7934"), giftFamily: "community-heart", giftCost: 1, giftImageUrl: intertwinedHeartImage });
  const workspace = () => ({ rules: [{ id: "configured-sound", enabled: false, conditions: [condition()],
    actions: [{ id: "audio", type: "audio.play", config: { url: "https://example.test/fixture.mp3", volume: 42 } }] }] });
  const state = { ...workspace(), profiles: [{ id: "first", workspace: workspace() }, { id: "second", workspace: workspace() }],
    accountWorkspaces: { dormant: { ...workspace(), profiles: [{ id: "other-profile", workspace: workspace() }] } } };
  const before = JSON.parse(JSON.stringify(state));
  const updates = collectGiftReferenceUpdates(state, gifts);
  assert.equal(updates.length, 5);
  assert.ok(updates.every((update) => update.key === "giftImageUrl" && update.value === neutralHeartImage));
  assert.deepEqual(state, before);
  applyGiftReferenceUpdates(updates);
  const expected = JSON.parse(JSON.stringify(before).replaceAll(intertwinedHeartImage, neutralHeartImage));
  assert.deepEqual(state, expected);
  assert.equal(collectGiftReferenceUpdates(state, gifts).length, 0);
});

test("les associations de profils, jeux, actions et sons ne dépendent pas du changement de visuel", () => {
  const catalog = new GiftCatalog(resourcesDirectory);
  // Chaque emplacement garde sa condition, son ID, son ordre et son action.
  const references = ["actions", "sounds", "games", "other-profile"].flatMap((scope) =>
    ["7934", "heart-me"].map((giftId) => ({
      id: `${scope}-${giftId}`,
      actionIds: [`${scope}-action`],
      conditions: [{ field: "data.giftName", operator: "equals", value: "Heart Me", giftId, giftImageUrl: historicalHeartImage }]
    }))
  );
  const before = JSON.stringify(references);
  for (const rule of references) {
    for (const giftId of ["7934", "heart-me"]) {
      assert.equal(giftConditionMatches(rule.conditions[0], { type: "gift", data: { giftId, giftName: "Cœur sur moi", value: 1 } }, catalog.gifts), true);
    }
    for (const giftId of ["17712", "62816", "601333", "157842"]) {
      assert.equal(giftConditionMatches(rule.conditions[0], { type: "gift", data: { giftId, giftName: "Cœur sur moi", value: 1 } }, catalog.gifts), false);
    }
    assert.equal(giftConditionMatches(rule.conditions[0], { type: "gift", data: { giftId: "5655", giftName: "Rose", value: 1 } }, catalog.gifts), false);
  }
  assert.equal(JSON.stringify(references), before);
});

test("le cadeau personnel garde son nom et son visuel, sans être assimilé au cœur", () => {
  const input = [{ id: 157842, name: "Shenazen Pulse", diamond_count: 1, combo: true, image: { uri: "webcast-sg/resource/saliency_seg_custom.png", url_list: ["https://example.com/custom.webp"] } }];
  const localized = dedupeLocalizedGifts(input);
  assert.equal(localized[0].imageUrl, "https://example.com/custom.webp");
  assert.equal(localized[0].name, "Shenazen Pulse"); assert.equal(localized[0].giftFamily, "");
  const event = { type: "gift", data: { giftId: "157842", giftName: "Shenazen Pulse", giftImageUrl: "https://example.com/custom.webp", value: 1 } };
  const before = JSON.stringify(event);
  const enriched = enrichGiftEvent(event, localized);
  assert.equal(enriched.data.giftImageUrl, event.data.giftImageUrl);
  assert.equal(enriched.data.giftCatalogImageUrl, "https://example.com/custom.webp");
  assert.equal(enriched.data.giftName, "Shenazen Pulse");
  assert.equal(JSON.stringify(event), before);
  const [rose] = dedupeGiftCatalog([{ id: "5655", name: "Rose", cost: 1, imageUrl: "https://example.com/rose.webp" }]);
  assert.equal(rose.imageUrl, "https://example.com/rose.webp");
});

test("les caches du renderer actualisent les noms et les alias sans garder l’ancien visuel", () => {
  const context = vm.createContext({ giftCatalogById: new Map(), giftCatalogByName: new Map(), GIFT_CATALOG: [] });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/core/ui-foundations.js"), "utf8"), context);
  const previous = { id: "7934", alternateIds: ["heart-me"], name: "Heart Me", alternateNames: ["Ancien nom conservé"], imageUrl: intertwinedHeartImage };
  const current = { id: "7934", alternateIds: [], name: "Cœur sur moi", alternateNames: ["Heart Me"], imageUrl: COMMUNITY_HEART_IMAGE_URL };
  context.rememberGifts([previous]);
  context.rememberGifts([current]);
  for (const result of [context.giftForIdentity("Heart Me", "7934"), context.giftForIdentity("Heart Me", "heart-me"),
    context.giftForName("Heart Me"), context.giftForName("Ancien nom conservé")]) {
    assert.deepEqual(JSON.parse(JSON.stringify(result)), current);
  }
  assert.equal(context.giftCatalogById.get("7934"), context.giftCatalogById.get("heart-me"));
  assert.equal(context.GIFT_CATALOG.length, 1);
  assert.equal(context.GIFT_CATALOG[0], context.giftCatalogById.get("7934"));
});
