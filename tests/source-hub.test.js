"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeEvent } = require("../src/main/event-normalizer");
const {
  isTikTokOfflineError,
  parseTikTokRelayStatus,
  parseTwitchLine,
  applyTikTokLikeDelta,
  tiktokGiftIsFinal,
  tiktokConnectorPayload
} = require("../src/main/source-hub");

test("parse un PRIVMSG Twitch IRC", () => {
  const result = parseTwitchLine(
    "@user-id=42;display-name=Alice;subscriber=1;mod=0 :alice!alice@alice.tmi.twitch.tv PRIVMSG #channel :Bonjour !"
  );
  assert.equal(result.event, "chat");
  assert.equal(result.data.user.id, "42");
  assert.equal(result.data.user.subscriber, true);
  assert.equal(result.data.message, "Bonjour !");
});

test("détecte les états LIVE et hors ligne d'un relais TikTok", () => {
  assert.deepEqual(
    parseTikTokRelayStatus({
      event: "status",
      data: { live: true, roomId: "room-42" }
    }),
    { status: "live", roomId: "room-42" }
  );
  assert.deepEqual(
    parseTikTokRelayStatus({ event: "streamEnd", data: {} }),
    { status: "offline", roomId: "" }
  );
  assert.equal(
    parseTikTokRelayStatus({ event: "gift", data: { giftName: "Rose" } }),
    null
  );
});

test("prépare un cadeau du connecteur TikTok pour le moteur ShenPulse", () => {
  const payload = tiktokConnectorPayload(
    "gift",
    {
      user: { uniqueId: "alice", nickname: "Alice" },
      giftId: "rose",
      giftName: "Rose",
      repeatCount: 3,
      diamondCount: 1
    },
    "creator"
  );
  assert.equal(payload.uniqueId, "alice");
  assert.equal(payload.giftName, "Rose");
  assert.equal(payload.repeatCount, 3);
  assert.equal(payload.channelUsername, "creator");
});

test("récupère l'image native du cadeau TikTok même dans un objet moderne", () => {
  const payload = tiktokConnectorPayload("gift", {
    giftName: "Rose",
    gift: {
      giftImage: {
        urlList: ["https://cdn.example/tiktok-rose.webp"]
      }
    }
  });

  assert.equal(
    payload.giftImageUrl,
    "https://cdn.example/tiktok-rose.webp"
  );
});

test("un USERNOTICE Twitch non lié à un abonnement reste ignoré", () => {
  const unrelated = parseTwitchLine(
    "@user-id=42;display-name=Alice;msg-id=announcement :alice!alice@alice.tmi.twitch.tv USERNOTICE #channel :Info"
  );
  const subscription = parseTwitchLine(
    "@user-id=42;display-name=Alice;msg-id=sub :alice!alice@alice.tmi.twitch.tv USERNOTICE #channel :Merci"
  );

  assert.equal(unrelated, null);
  assert.equal(subscription.event, "subscribe");
});

test("récupère la photo TikTok depuis les structures modernes et historiques", () => {
  const modern = tiktokConnectorPayload("like", {
    user: {
      uniqueId: "alice",
      profilePicture: {
        url: [
          "https://cdn.example/avatar-shrink.jpeg",
          "https://cdn.example/avatar-100x100.webp?x=1"
        ]
      }
    }
  });
  const historical = tiktokConnectorPayload("gift", {
    uniqueId: "bob",
    userDetails: {
      profilePictureUrls: ["https://cdn.example/bob.jpeg"]
    }
  });

  assert.equal(
    modern.profilePictureUrl,
    "https://cdn.example/avatar-100x100.webp?x=1"
  );
  assert.equal(historical.profilePictureUrl, "https://cdn.example/bob.jpeg");
});

test("reconnaît un compte TikTok simplement hors ligne", () => {
  assert.equal(
    isTikTokOfflineError(new Error("User is offline or room not found")),
    true
  );
  assert.equal(
    isTikTokOfflineError(
      new Error("Failed to retrieve Room ID from all sources.")
    ),
    true
  );
  assert.equal(
    isTikTokOfflineError(new Error("The requested user isn't online :(")),
    true
  );
  assert.equal(
    isTikTokOfflineError({
      info: { message: "The requested user is not online" }
    }),
    true
  );
  assert.equal(isTikTokOfflineError(new Error("Network timeout")), false);
});

test("attend la fin d'une série de cadeaux TikTok", () => {
  assert.equal(tiktokGiftIsFinal({ giftType: 1, repeatEnd: false }), false);
  assert.equal(tiktokGiftIsFinal({ giftType: 1, repeatEnd: true }), true);
  assert.equal(tiktokGiftIsFinal({ giftType: 0 }), true);
});

test("reconstitue les likes TikTok manquants avec le total du LIVE", () => {
  const runtime = { lastTotalLikes: 0 };

  assert.equal(
    applyTikTokLikeDelta(runtime, { likeCount: 5, totalLikes: 100 }).likeCount,
    5
  );
  assert.equal(
    applyTikTokLikeDelta(runtime, { likeCount: 4, totalLikes: 135 }).likeCount,
    35
  );
  assert.equal(
    applyTikTokLikeDelta(runtime, { likeCount: 4, totalLikes: 135 }),
    null
  );
  assert.equal(
    applyTikTokLikeDelta(runtime, { likeCount: 3, totalLikes: 10 }).likeCount,
    3
  );
});

test("conserve tout le lot de likes dans le pipeline TikTok", () => {
  const runtime = { lastTotalLikes: 34452 };
  const payload = tiktokConnectorPayload(
    "like",
    {
      user: { uniqueId: "alice", nickname: "Alice" },
      likeCount: 15,
      totalLikeCount: 34497
    },
    "creator"
  );
  const recovered = applyTikTokLikeDelta(runtime, payload);
  const event = normalizeEvent(
    { event: "like", data: recovered },
    "source_tiktok"
  );

  assert.equal(recovered.likeCount, 45);
  assert.equal(event.data.count, 45);
});
