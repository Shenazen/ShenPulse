"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  COMMUNITY_HEART_CANONICAL_NAME,
  canonicalGiftName,
  enrichGiftEvent,
  giftConditionMatches,
  giftFamily,
  giftImageIdentity
} = require("../src/shared/gift-identity");

const catalog = [
  {
    id: "hat-and-mustache",
    name: "Chapeau et moustache",
    cost: 99,
    imageUrl:
      "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/2f1e4f3f5c728ffbfa35705b480fdc92~tplv-obj.webp"
  },
  {
    id: "singing-sax",
    name: "Saxo-chant",
    cost: 399,
    imageUrl:
      "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/0962211de9b80bda00a7da89400d2a5a.png~tplv-obj.webp"
  }
];

function giftEvent(name, value, imageUrl, giftId = "") {
  return {
    type: "gift",
    data: {
      giftId,
      giftName: name,
      giftImageUrl: imageUrl,
      value
    }
  };
}

test("reconnaît un cadeau TikTok malgré un nom LIVE anglais", () => {
  const event = giftEvent(
    "Hat and Mustache",
    99,
    "https://example.com/visuel-personnalise.png",
    "hat-and-mustache"
  );
  assert.equal(
    giftConditionMatches(
      { operator: "equals", value: "Chapeau et moustache" },
      event,
      catalog
    ),
    true
  );
});

test("utilise l'identifiant enregistré même sans catalogue chargé", () => {
  const event = giftEvent(
    "Singing Sax",
    399,
    "https://example.com/autre-visuel.png",
    "singing-sax"
  );
  assert.equal(
    giftConditionMatches(
      {
        operator: "equals",
        value: "Saxo-chant",
        giftId: "singing-sax",
        giftCost: 399,
        giftImageUrl: catalog[1].imageUrl
      },
      event,
      []
    ),
    true
  );
});

test("n'assimile pas deux cadeaux uniquement parce que leur prix est égal", () => {
  const event = giftEvent(
    "Un autre cadeau",
    99,
    "https://example.com/another-gift.png"
  );
  assert.equal(
    giftConditionMatches(
      { operator: "equals", value: "Chapeau et moustache" },
      event,
      catalog
    ),
    false
  );
});

test("n'assimile jamais deux cadeaux uniquement par leur visuel", () => {
  const event = giftEvent(
    "Autre cadeau",
    399,
    catalog[1].imageUrl,
    "different-gift-id"
  );
  assert.equal(
    giftConditionMatches(
      {
        operator: "equals",
        value: "Saxo-chant",
        giftId: "singing-sax",
        giftImageUrl: catalog[1].imageUrl
      },
      event,
      catalog
    ),
    false
  );
});

test("reconnaît le cœur de communauté même personnalisé par le créateur", () => {
  const event = {
    type: "gift",
    data: {
      giftId: "601333",
      giftName: "Kiickers",
      giftCombo: true,
      giftImageUri: "webcast-sg/resource/saliency_seg_creator.png",
      value: 1
    }
  };

  assert.equal(giftFamily(event.data), "community-heart");
  assert.equal(canonicalGiftName(event.data), "Cœur sur moi");
  assert.equal(
    giftConditionMatches(
      { value: "Envoie-moi un cœur", giftId: "7934" },
      event,
      []
    ),
    true
  );
  const enriched = enrichGiftEvent(event, []);
  assert.equal(enriched.data.giftName, COMMUNITY_HEART_CANONICAL_NAME);
  assert.equal(enriched.data.giftOriginalName, "Kiickers");
});

test("les anciens libellés Heart Me restent dans la catégorie Cœur sur moi", () => {
  for (const name of [
    "Heart Me",
    "Envoie-moi un cœur",
    "Cœur de la communauté",
    "Cœur sur moi"
  ]) {
    assert.equal(giftFamily({ giftName: name }), "community-heart");
    assert.equal(canonicalGiftName({ giftName: name }), "Cœur sur moi");
  }
});

test("enrichit le flux LIVE avec l'identifiant du cadeau localisé", () => {
  const event = enrichGiftEvent(
    giftEvent(
      "Singing Sax",
      399,
      "https://example.com/visuel-live.png",
      "singing-sax"
    ),
    catalog
  );
  assert.equal(event.data.giftName, "Singing Sax");
  assert.equal(event.data.giftId, "singing-sax");
  assert.equal(event.data.giftCatalogName, "Saxo-chant");
});

test("normalise les variantes de CDN et de format d'un même visuel", () => {
  assert.equal(
    giftImageIdentity(
      "https://p16.example/img/gift.png~tplv-obj.webp"
    ),
    giftImageIdentity(
      "https://p19.example/other/gift.png~tplv-obj.png"
    )
  );
});
