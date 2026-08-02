"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeEvent } = require("../src/main/event-normalizer");
const {
  SourceHub,
  TIKTOK_REQUEST_POLLING_INTERVAL_MS,
  connectTikTokWhenLive,
  isTikTokOfflineError,
  parseTikTokRelayStatus,
  parseTwitchLine,
  applyTikTokLikeDelta,
  tiktokGiftIsFinal,
  tiktokConnectorPayload
} = require("../src/main/source-hub");

test("réduit la latence du polling TikTok de secours", () => {
  assert.equal(TIKTOK_REQUEST_POLLING_INTERVAL_MS, 250);
});

test("n'autodémarre jamais une source de démonstration", async () => {
  const calls = [];
  const hub = new SourceHub({
    store: {
      getState: () => ({
        connections: [
          { id: "source_demo", type: "demo", enabled: true },
          { id: "source_live", type: "websocket", enabled: true },
          { id: "source_disabled", type: "websocket", enabled: false }
        ]
      })
    }
  });
  hub.start = async (connectionId) => calls.push(connectionId);

  await hub.startEnabled();

  assert.deepEqual(calls, ["source_live"]);
});

test("une source de démonstration n'émet que les tests envoyés explicitement", async () => {
  const state = {
    connections: [
      {
        id: "source_demo",
        type: "demo",
        enabled: false,
        status: "disconnected",
        config: {}
      }
    ]
  };
  const hub = new SourceHub({
    store: {
      getState: () => state,
      mutateRuntime: (mutate) => mutate(state)
    }
  });
  const events = [];
  hub.on("event", (event) => events.push(event));

  await hub.start("source_demo");
  assert.equal(hub.runtimes.get("source_demo").timer, undefined);
  assert.deepEqual(events, []);

  hub.send("source_demo", {
    event: "like",
    data: { uniqueId: "viewer_test", nickname: "Viewer test", likeCount: 3 }
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].user.id, "viewer_test");
  assert.equal(events[0].data.count, 3);

  await hub.stop("source_demo");
});

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

test("recupere aussi le cout moderne du cadeau TikTok", () => {
  const payload = tiktokConnectorPayload("gift", {
    giftName: "TikTok Universe",
    gift: { cost: 44999 }
  });

  assert.equal(payload.diamondCount, 44999);
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

test("refuse une ancienne salle TikTok quand le compte est hors ligne", async () => {
  let connectCalls = 0;
  const connector = {
    fetchIsLive: async () => false,
    connect: async () => {
      connectCalls += 1;
    }
  };

  await assert.rejects(
    connectTikTokWhenLive(connector),
    (error) =>
      error.code === "TIKTOK_OFFLINE" && isTikTokOfflineError(error)
  );
  assert.equal(connectCalls, 0);
});

test("autorise la connexion TikTok uniquement apres confirmation du LIVE", async () => {
  let connectCalls = 0;
  const connector = {
    fetchIsLive: async () => true,
    connect: async () => {
      connectCalls += 1;
      return { roomId: "room-42" };
    }
  };

  const state = await connectTikTokWhenLive(connector);
  assert.equal(connectCalls, 1);
  assert.equal(state.roomId, "room-42");
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
    applyTikTokLikeDelta(runtime, { likeCount: 4, totalLikes: 135 }).likeCount,
    4
  );
  assert.equal(
    applyTikTokLikeDelta(runtime, { likeCount: 3, totalLikes: 10 }).likeCount,
    3
  );
});

test("compte chaque lot unique mais ignore un doublon réseau TikTok", () => {
  const runtime = { lastTotalLikes: 100 };
  const first = applyTikTokLikeDelta(runtime, {
    id: "like-message-1",
    likeCount: 5,
    totalLikes: 105
  });
  const duplicate = applyTikTokLikeDelta(runtime, {
    id: "like-message-1",
    likeCount: 5,
    totalLikes: 105
  });
  const next = applyTikTokLikeDelta(runtime, {
    id: "like-message-2",
    likeCount: 3,
    totalLikes: 105
  });

  assert.equal(first.likeCount, 5);
  assert.equal(duplicate, null);
  assert.equal(next.likeCount, 3);
});

test("préserve l'identifiant natif d'un événement TikTok", () => {
  const payload = tiktokConnectorPayload(
    "like",
    {
      common: { msgId: "native-like-id" },
      user: { uniqueId: "alice" },
      likeCount: 2
    },
    "creator"
  );

  assert.equal(payload.id, "native-like-id");
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
