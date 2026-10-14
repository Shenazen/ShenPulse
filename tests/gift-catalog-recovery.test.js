"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { GiftCatalog, dedupeGiftCatalog, normalizeGift } = require("../src/main/catalogs/gifts");
const { findCatalogGift, giftFamily } = require("../src/shared/gift-identity");

const resourcesDirectory = path.join(__dirname, "..", "resources");

function catalogWith(gifts, fetchLocalizedGifts = async () => []) {
  const catalog = new GiftCatalog(resourcesDirectory, { fileNames: [], fetchLocalizedGifts });
  catalog.baseGifts = dedupeGiftCatalog(gifts);
  catalog.gifts = [...catalog.baseGifts];
  return catalog;
}

test("le chargement complet inclut les cadeaux sélectionnés au-delà des mille cadeaux les moins chers", () => {
  const catalog = new GiftCatalog(resourcesDirectory);
  const full = catalog.search("", 10000);
  assert.equal(full.gifts.length, full.total);
  assert.ok(full.total > 1000);
  assert.ok(full.gifts.filter((gift) => gift.cost === 1).length > 1000);
  for (const [name, id] of [
    ["Forever Rosa", "8914"], ["Sunglasses", "5509"], ["Corgi", "6267"],
    ["Voiture de course", "voiture-de-cou"], ["Lion", "6369"], ["Chat", "18697"],
    ["Trésor de pirate", "17357"], ["Amour en langue des signes", "8259"]
  ]) {
    const gift = findCatalogGift(full.gifts, { name, id });
    assert.ok(gift, name);
    assert.match(gift.imageUrl, /^https:\/\//, name);
  }
});

test("les anciens slugs vérifiés restent reliés aux mêmes ID TikTok et images", () => {
  const catalog = new GiftCatalog(resourcesDirectory);
  for (const [legacyId, numericId] of [
    ["forever-rosa", "8914"], ["sunglasses", "5509"], ["corgi", "6267"],
    ["pirate-s-treasure", "17357"], ["sign-language-love", "8259"]
  ]) {
    const legacy = findCatalogGift(catalog.gifts, { id: legacyId });
    const numeric = findCatalogGift(catalog.gifts, { id: numericId });
    assert.equal(legacy, numeric, legacyId);
    assert.ok(legacy.imageUrl, legacyId);
  }
});

test("le slug historique Voiture de course reste intact si plusieurs ID partagent son dessin et son prix", () => {
  const catalog = new GiftCatalog(resourcesDirectory);
  const legacy = findCatalogGift(catalog.gifts, { id: "voiture-de-cou" });
  assert.equal(legacy.id, "voiture-de-cou");
  assert.deepEqual(legacy.alternateIds, []);
  assert.ok(legacy.imageUrl);
  for (const id of ["7063", "7286"]) {
    const gift = findCatalogGift(catalog.gifts, { id });
    assert.equal(gift.id, id);
    assert.notEqual(gift, legacy);
  }
  assert.equal(findCatalogGift(catalog.gifts, { name: "Voiture de course", cost: 12000 }), null);
});

test("le libellé historique langue des signes est un alias exact du cadeau vérifié 8259", () => {
  const catalog = new GiftCatalog(resourcesDirectory);
  const gift = findCatalogGift(catalog.gifts, { name: "Amour en langue des signes", cost: 49 });
  assert.equal(gift.id, "8259");
  assert.ok(gift.alternateNames.includes("Amour en langage des signes"));
  assert.match(gift.imageUrl, /a90213d1783ef37bf68d1c7d4a0f4d4b/);
  const unrelated = dedupeGiftCatalog([{ id: "999999", name: "Autre cadeau", cost: 49 }])[0];
  assert.ok(!unrelated.alternateNames.includes("Amour en langue des signes"));
});

test("les noms historiques uniques se retrouvent et les homonymes sans ID restent ambigus", () => {
  const catalog = new GiftCatalog(resourcesDirectory);
  assert.equal(findCatalogGift(catalog.gifts, { name: "TikTok" }).id, "5269");
  assert.equal(findCatalogGift(catalog.gifts, { name: "Galaxy" }).id, "11046");
  for (const name of ["Gants de boxe", "Love You", "Rosa", "Voiture de sport"]) {
    assert.equal(findCatalogGift(catalog.gifts, { name }), null, name);
  }
  for (const [name, cost, id] of [
    ["Gants de boxe", 299, "6007"], ["Gants de boxe", 1999, "12869"],
    ["Love You", 1, "6890"], ["Love You", 199, "6671"],
    ["Rosa", 1, "549679"], ["Rosa", 10, "8913"],
    ["Voiture de sport", 4999, "13061"], ["Voiture de sport", 7000, "6089"]
  ]) assert.equal(findCatalogGift(catalog.gifts, { name, cost }).id, id, `${name} / ${cost}`);
});

test("une salle partielle n'efface pas les cadeaux localisés connus de la salle précédente", async () => {
  let response = [
    { id: 22222, name: "Cadeau propre à la première salle", diamond_count: 22, image: { url_list: ["https://example.com/first.webp"] } },
    { id: 33333, name: "Cadeau partagé", diamond_count: 33, image: { url_list: ["https://example.com/old.webp"] } }
  ];
  const catalog = catalogWith([], async () => response);
  await catalog.refreshLocalized("premiere");
  response = [{ id: 33333, name: "Cadeau partagé actuel", diamond_count: 33, image: { url_list: ["https://example.com/new.webp"] } }];
  await catalog.refreshLocalized("deuxieme");
  assert.equal(findCatalogGift(catalog.gifts, { id: "22222" }).imageUrl, "https://example.com/first.webp");
  const current = findCatalogGift(catalog.gifts, { id: "33333" });
  assert.equal(current.imageUrl, "https://example.com/new.webp");
  assert.equal(current.name, "Cadeau partagé actuel");
  assert.ok(current.alternateNames.includes("Cadeau partagé"));
  assert.equal(catalog.gifts.length, 2);
});

test("un rafraîchissement de salle en erreur conserve les données précédentes", async () => {
  let response = [{ id: 22222, name: "Cadeau historique", diamond_count: 22 }];
  const catalog = catalogWith([], async () => response);
  await catalog.refreshLocalized("premiere");
  const before = catalog.gifts;
  response = [];
  await assert.rejects(catalog.refreshLocalized("deuxieme"), /vide/);
  assert.equal(catalog.gifts, before);
  assert.equal(catalog.localizedUsername, "premiere");
});

test("un événement LIVE enrichit l'image manquante d'un ID déjà connu", () => {
  const original = [{ id: "11111", name: "Nom français", cost: 7, source: "catalog" }];
  const originalJson = JSON.stringify(original);
  const catalog = catalogWith(original);
  assert.equal(catalog.mergeLiveGift({ giftId: "11111", giftName: "English name", value: 7, giftImageUrl: "https://example.com/current.webp" }), true);
  const gift = findCatalogGift(catalog.gifts, { id: "11111" });
  assert.equal(gift.imageUrl, "https://example.com/current.webp");
  assert.equal(gift.name, "Nom français");
  assert.ok(gift.alternateNames.includes("English name"));
  assert.equal(JSON.stringify(original), originalJson);
});

test("le dessin du LIVE remplace celui d'un catalogue localisé déjà présent", async () => {
  const catalog = catalogWith([], async () => [{ id: 11111, name: "Cadeau français", diamond_count: 7, image: { url_list: ["https://example.com/room.webp"] } }]);
  await catalog.refreshLocalized("premiere");
  assert.equal(catalog.mergeLiveGift({ giftId: "11111", giftName: "Gift", value: 7, giftImageUrl: "https://example.com/live.webp" }), true);
  assert.equal(findCatalogGift(catalog.gifts, { id: "11111" }).imageUrl, "https://example.com/live.webp");
  await catalog.refreshLocalized("premiere", { force: true });
  assert.equal(findCatalogGift(catalog.gifts, { id: "11111" }).imageUrl, "https://example.com/live.webp");
});

test("un événement réduit à l'ID et à l'image préserve le prix, le nom et les métadonnées", () => {
  const catalog = catalogWith([{ id: "11111", name: "Nom français", cost: 7, giftType: 1, combo: true, imageUri: "resource/known.png", primaryEffectId: 22, isGlobalGift: true, isDisplayedOnPanel: true }]);
  assert.equal(catalog.mergeLiveGift({ giftId: "11111", giftImageUrl: "https://example.com/current.webp" }), true);
  const gift = findCatalogGift(catalog.gifts, { id: "11111" });
  assert.equal(gift.name, "Nom français");
  assert.equal(gift.cost, 7);
  assert.equal(gift.giftType, 1);
  assert.equal(gift.combo, true);
  assert.equal(gift.imageUri, "resource/known.png");
  assert.equal(gift.primaryEffectId, 22);
  assert.equal(gift.isGlobalGift, true);
  assert.equal(gift.isDisplayedOnPanel, true);
});

test("un alias d'ID connu conserve l'ID canonique et toutes les anciennes références", () => {
  const catalog = catalogWith([{ id: "11111", alternateIds: ["22222", "ancien-slug"], name: "Cadeau", cost: 7 }]);
  assert.equal(catalog.mergeLiveGift({ giftId: "22222", giftName: "Cadeau", value: 7, giftImageUrl: "https://example.com/current.webp" }), true);
  const gift = catalog.gifts[0];
  assert.equal(gift.id, "11111");
  assert.deepEqual(new Set(gift.alternateIds), new Set(["22222", "ancien-slug"]));
  assert.equal(findCatalogGift(catalog.gifts, { id: "ancien-slug" }), gift);
});

test("les événements LIVE identiques ne reconstruisent pas le catalogue à chaque cadeau", () => {
  const catalog = catalogWith([{ id: "11111", name: "Cadeau", cost: 7 }]);
  const event = { giftId: "11111", giftName: "Cadeau", value: 7, giftImageUrl: "https://example.com/current.webp" };
  assert.equal(catalog.mergeLiveGift(event), true);
  const entries = catalog.gifts;
  for (let count = 0; count < 10; count += 1) assert.equal(catalog.mergeLiveGift(event), false);
  assert.equal(catalog.gifts, entries);
  assert.equal(catalog.learnedGifts.length, 1);
});

test("le cache des cadeaux appris reste borné à dix mille et conserve la dernière entrée reçue", () => {
  const catalog = catalogWith([]);
  catalog.learnedGifts = Array.from({ length: 10000 }, (_, index) => normalizeGift({
    id: String(100000 + index), name: `Cadeau connu ${index}`, cost: 1, source: "live"
  }));
  catalog.gifts = [...catalog.learnedGifts];
  const event = { giftId: "200000", giftName: "Nouveau cadeau coûteux", value: 99999, giftImageUrl: "https://example.com/new.webp" };
  assert.equal(catalog.mergeLiveGift(event), true);
  assert.equal(catalog.learnedGifts.length, 10000);
  assert.equal(catalog.gifts.length, 10000);
  assert.equal(findCatalogGift(catalog.gifts, { id: "100000" }), null, "la plus ancienne entrée du cache LIVE est évincée");
  assert.equal(findCatalogGift(catalog.gifts, { id: "200000" }).imageUrl, event.giftImageUrl);
  const entries = catalog.gifts;
  const learnedEntries = catalog.learnedGifts;
  assert.equal(catalog.mergeLiveGift(event), false);
  assert.equal(catalog.gifts, entries);
  assert.equal(catalog.learnedGifts, learnedEntries);
  assert.equal(catalog.mergeLiveGift({ giftId: "100001", giftName: "Cadeau connu 1", value: 1, giftImageUrl: "https://example.com/updated.webp" }), true);
  assert.equal(catalog.learnedGifts.length, 10000, "enrichir un ID connu n'ajoute pas une entrée");
  assert.equal(findCatalogGift(catalog.gifts, { id: "100001" }).imageUrl, "https://example.com/updated.webp");
});

test("deux ID numériques distincts ne sont pas assimilés au seul motif qu'ils partagent prix et image", () => {
  const catalog = catalogWith([{ id: "11111", name: "Premier cadeau", cost: 7, imageUrl: "https://example.com/shared.webp" }]);
  assert.equal(catalog.mergeLiveGift({ giftId: "22222", giftName: "Second cadeau", value: 7, giftImageUrl: "https://example.com/shared.webp" }), true);
  assert.equal(catalog.gifts.length, 2);
  assert.notEqual(findCatalogGift(catalog.gifts, { id: "11111" }), findCatalogGift(catalog.gifts, { id: "22222" }));
});

test("le catalogue ne crée pas d'alias entre deux ID numériques au même nom et au même prix", () => {
  for (const sameImage of [true, false]) {
    const gifts = dedupeGiftCatalog([
      { id: "11111", name: "Cadeau homonyme", cost: 7, imageUrl: "https://example.com/first.webp" },
      { id: "22222", name: "Cadeau homonyme", cost: 7, imageUrl: `https://example.com/${sameImage ? "first" : "second"}.webp` }
    ]);
    assert.equal(gifts.length, 2);
    assert.ok(gifts.every((gift) => gift.alternateIds.length === 0));
    assert.equal(findCatalogGift(gifts, { name: "Cadeau homonyme", cost: 7 }), null);
  }
});

test("deux slugs historiques ne deviennent pas des alias sur le seul dessin et le même prix", () => {
  const gifts = dedupeGiftCatalog([
    { id: "premier-slug", name: "Premier cadeau", cost: 7, imageUrl: "https://example.com/shared.webp" },
    { id: "deuxieme-slug", name: "Second cadeau", cost: 7, imageUrl: "https://example.com/shared.webp" }
  ]);
  assert.equal(gifts.length, 2);
  assert.ok(gifts.every((gift) => gift.alternateIds.length === 0));
});

test("un slug ne choisit pas un ID arbitraire parmi plusieurs cadeaux ayant son dessin et son prix", () => {
  const gifts = dedupeGiftCatalog([
    { id: "ancien-slug", name: "Cadeau", cost: 7, imageUrl: "https://example.com/shared.webp" },
    { id: "11111", name: "Cadeau", cost: 7, imageUrl: "https://example.com/shared.webp" },
    { id: "22222", name: "Cadeau", cost: 7, imageUrl: "https://example.com/shared.webp" }
  ]);
  assert.equal(gifts.length, 3);
  assert.ok(gifts.every((gift) => gift.alternateIds.length === 0));
  assert.equal(findCatalogGift(gifts, { id: "ancien-slug" }).id, "ancien-slug");
});

test("un suffixe PNG de hash TikTok ne crée pas une fausse preuve d'ID unique pour un ancien slug", () => {
  const hash = "44818035acbbe673514caa600755268c";
  const gifts = dedupeGiftCatalog([
    { id: "ancien-slug", name: "Ancien cadeau", cost: 7, imageUrl: `https://p16-webcast.tiktokcdn.com/img/resource/${hash}~tplv-obj.webp` },
    { id: "11111", name: "Premier cadeau", cost: 7, imageUrl: `https://p16-webcast.tiktokcdn.com/img/resource/${hash}~tplv-obj.webp` },
    { id: "22222", name: "Deuxième cadeau", cost: 7, imageUrl: `https://p19-webcast.tiktokcdn.com/img/resource/${hash}.png~tplv-obj.webp` }
  ]);
  assert.equal(gifts.length, 3);
  assert.ok(gifts.every((gift) => gift.alternateIds.length === 0));
});

test("un ID inconnu nommé Heart Me ne reçoit pas arbitrairement le dessin ni la famille du cœur actuel", () => {
  const [gift] = dedupeGiftCatalog([{ id: "999999", name: "Heart Me", cost: 1, imageUrl: "https://example.com/independent.webp" }]);
  assert.equal(gift.id, "999999");
  assert.equal(gift.name, "Heart Me");
  assert.equal(gift.giftFamily, "");
  assert.equal(gift.imageUrl, "https://example.com/independent.webp");
});

test("seuls les alias techniques explicites ou une famille vérifiée peuvent regrouper des ID numériques", () => {
  const explicit = dedupeGiftCatalog([
    { id: "11111", alternateIds: ["22222"], name: "Cadeau historique", cost: 7 },
    { id: "22222", name: "Nom actuel", cost: 7, imageUrl: "https://example.com/current.webp" }
  ]);
  assert.equal(explicit.length, 1);
  assert.deepEqual(new Set([explicit[0].id, ...explicit[0].alternateIds]), new Set(["11111", "22222"]));
  const unknownFamily = dedupeGiftCatalog([
    { id: "11111", giftFamily: "famille-non-verifiee", name: "Cadeau", cost: 7 },
    { id: "22222", giftFamily: "famille-non-verifiee", name: "Cadeau", cost: 7 }
  ]);
  assert.equal(unknownFamily.length, 2);
});

test("chaque ID numérique embarqué reste indépendant hors famille de cœur explicitement vérifiée", () => {
  const catalog = new GiftCatalog(resourcesDirectory);
  const payload = JSON.parse(fs.readFileSync(path.join(resourcesDirectory, "catalogs/tiklive-gifts.json"), "utf8"));
  for (const original of payload.gifts) {
    if (!/^\d+$/.test(original.id) || giftFamily(original) === "community-heart") continue;
    const gift = findCatalogGift(catalog.gifts, { id: original.id });
    assert.ok(gift, original.id);
    const numericIds = [gift.id, ...gift.alternateIds].filter((id) => /^\d+$/.test(id));
    assert.deepEqual(numericIds, [original.id], `${original.name} : aucun autre ID numérique ajouté`);
  }
});

test("la recherche complète reste bornée sans modifier la limite usuelle", () => {
  const catalog = catalogWith([]);
  catalog.gifts = Array.from({ length: 10020 }, (_, index) => ({ id: String(index), name: "Cadeau", cost: 1 }));
  assert.equal(catalog.search().gifts.length, 80);
  assert.equal(catalog.search("", Infinity).gifts.length, 10000);
  assert.equal(catalog.search("", 50000).gifts.length, 10000);
  assert.equal(catalog.search("", 1).gifts.length, 1);
});
