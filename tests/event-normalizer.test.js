"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeEvent, normalizeType } = require("../src/main/event-normalizer");

test("normalise un cadeau de relais TikTok-compatible", () => {
  const event = normalizeEvent(
    {
      event: "gift",
      data: {
        userId: "42",
        uniqueId: "alice",
        nickname: "Alice",
        giftId: "rose",
        giftName: "Rose",
        repeatCount: 5,
        diamondCount: 1
      }
    },
    "relay"
  );
  assert.equal(event.type, "gift");
  assert.equal(event.source, "relay");
  assert.equal(event.user.id, "42");
  assert.equal(event.user.displayName, "Alice");
  assert.equal(event.data.giftName, "Rose");
  assert.equal(event.data.count, 5);
});

test("un lot de likes utilise likeCount même si repeatCount vaut un", () => {
  const event = normalizeEvent(
    {
      event: "like",
      data: {
        uniqueId: "alice",
        repeatCount: 1,
        likeCount: 45,
        totalLikeCount: 34497
      }
    },
    "tiktok-direct"
  );

  assert.equal(event.type, "like");
  assert.equal(event.data.count, 45);
  assert.equal(event.data.totalLikes, 34497);
});

test("normalise les tableaux d'URL TikTok en véritable photo de profil", () => {
  const event = normalizeEvent({
    event: "like",
    data: {
      uniqueId: "alice",
      profilePicture: {
        url: [
          "https://cdn.example/alice-shrink.jpeg",
          "https://cdn.example/alice-100x100.webp"
        ]
      }
    }
  });

  assert.equal(
    event.user.avatarUrl,
    "https://cdn.example/alice-100x100.webp"
  );
});

test("normalise aussi l'image imbriquée du cadeau TikTok", () => {
  const event = normalizeEvent({
    event: "gift",
    data: {
      uniqueId: "alice",
      giftName: "Rose",
      giftDetails: {
        image: {
          urls: ["https://cdn.example/rose.png"]
        }
      }
    }
  });

  assert.equal(event.data.giftImageUrl, "https://cdn.example/rose.png");
});

test("conserve le cout TikTok fourni dans l'objet cadeau", () => {
  const event = normalizeEvent({
    event: "gift",
    data: {
      uniqueId: "alice",
      value: 0,
      gift: {
        name: "TikTok Universe",
        cost: 44999
      }
    }
  });

  assert.equal(event.data.value, 44999);
});

test("normalise la famille du cœur personnalisé indépendamment de son nom", () => {
  const event = normalizeEvent({
    event: "gift",
    data: {
      giftId: "601333",
      giftName: "Nom personnalisé",
      giftCombo: true,
      giftImageUri: "webcast-sg/resource/saliency_seg_creator.png",
      diamondCount: 1
    }
  });

  assert.equal(event.data.giftFamily, "community-heart");
});

test("normalise les alias d'événements", () => {
  assert.equal(normalizeType("member"), "join");
  assert.equal(normalizeType("roomUser"), "roomUser");
  assert.equal(normalizeType("streamEnd"), "streamEnd");
});

test("tronque le contenu non fiable", () => {
  const event = normalizeEvent(
    { event: "chat", data: { uniqueId: "u", comment: "x".repeat(2000) } },
    "test"
  );
  assert.equal(event.data.message.length, 1000);
});
