"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  FOLLOW_DUPLICATE_WINDOW_MS,
  FollowSessionGuard,
  followEventIdentity
} = require("../src/main/follow-session-guard");

function follow({
  eventId = "follow-message-1",
  id = "viewer-one",
  source = "source_tiktok"
} = {}) {
  return {
    id: eventId,
    type: "follow",
    source,
    user: { id, name: id },
    data: {
      raw: {
        common: { msgId: eventId },
        channelUsername: "streamer"
      }
    }
  };
}

test("écarte uniquement la seconde livraison du même follow TikTok", () => {
  const guard = new FollowSessionGuard();
  const event = follow();

  assert.equal(guard.accept({}, event), true);
  assert.equal(guard.accept({}, { ...event }), false);
});

test("accepte un unfollow puis refollow du même spectateur", () => {
  const guard = new FollowSessionGuard();

  assert.equal(guard.accept({}, follow({ eventId: "follow-1" })), true);
  assert.equal(guard.accept({}, follow({ eventId: "follow-2" })), true);
  assert.equal(guard.accept({}, follow({ eventId: "follow-3" })), true);
});

test("accepte le même identifiant natif après la fenêtre réseau", () => {
  let now = 100000;
  const guard = new FollowSessionGuard({ now: () => now });
  const event = follow();

  assert.equal(guard.accept({}, event), true);
  now += FOLLOW_DUPLICATE_WINDOW_MS + 1;
  assert.equal(guard.accept({}, event), true);
});

test("la déduplication ne fusionne pas deux sources", () => {
  const guard = new FollowSessionGuard();

  assert.equal(guard.accept({}, follow({ source: "source-a" })), true);
  assert.equal(guard.accept({}, follow({ source: "source-b" })), true);
});

test("les simulateurs restent répétables", () => {
  const guard = new FollowSessionGuard();
  const event = follow({ source: "simulator" });

  assert.equal(guard.accept({}, event), true);
  assert.equal(guard.accept({}, event), true);
});

test("les follows sans identifiant natif et les autres événements passent", () => {
  const guard = new FollowSessionGuard();
  const withoutId = follow({ eventId: "" });

  assert.equal(guard.accept({}, withoutId), true);
  assert.equal(guard.accept({}, withoutId), true);
  assert.equal(guard.accept({}, { ...follow(), type: "gift" }), true);
});

test("construit l'identité avec la source et le message TikTok", () => {
  assert.equal(
    followEventIdentity(follow({ eventId: "Native-42" })),
    "source_tiktok:native-42"
  );
});
