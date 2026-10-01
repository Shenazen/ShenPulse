"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  FollowSessionGuard,
  followEventIdentity,
  followLiveIdentity,
  followViewerIdentity,
  followViewerIdentities
} = require("../src/main/follow-session-guard");

function liveState({
  roomId = "room-a",
  startedAt = "2026-10-01T12:00:00.000Z",
  interruptedAt = null
} = {}) {
  return {
    session: {
      running: true,
      startedAt,
      tiktokRoomId: roomId,
      tiktokInterruptedAt: interruptedAt
    }
  };
}

function follow({
  eventId = "follow-message-1",
  id = "viewer-one",
  name = id,
  source = "source_tiktok"
} = {}) {
  return {
    id: eventId,
    type: "follow",
    source,
    user: { id, name },
    data: {
      raw: {
        common: { msgId: eventId },
        channelUsername: "streamer"
      }
    }
  };
}

test("accepte un seul follow par spectateur pendant le même LIVE", () => {
  const guard = new FollowSessionGuard();
  const state = liveState();

  assert.equal(guard.accept(state, follow({ eventId: "follow-1" })), true);
  assert.equal(guard.accept(state, follow({ eventId: "follow-2" })), false);
  assert.equal(guard.accept(state, follow({ eventId: "follow-3" })), false);
});

test("accepte chaque spectateur une fois pendant le LIVE", () => {
  const guard = new FollowSessionGuard();
  const state = liveState();

  assert.equal(guard.accept(state, follow({ id: "alice" })), true);
  assert.equal(
    guard.accept(state, follow({ id: "bob", eventId: "follow-2" })),
    true
  );
  assert.equal(
    guard.accept(state, follow({ id: "alice", eventId: "follow-3" })),
    false
  );
});

test("conserve le verrou pendant une reconnexion au même LIVE", () => {
  const guard = new FollowSessionGuard();
  const firstState = liveState();
  const reconnectedState = liveState({
    interruptedAt: "2026-10-01T12:30:00.000Z"
  });

  assert.equal(guard.accept(firstState, follow()), true);
  assert.equal(
    guard.accept(
      reconnectedState,
      follow({ eventId: "follow-after-reconnect" })
    ),
    false
  );
});

test("réautorise le spectateur au LIVE suivant", () => {
  const guard = new FollowSessionGuard();

  assert.equal(guard.accept(liveState(), follow()), true);
  assert.equal(
    guard.accept(
      liveState({
        roomId: "room-b",
        startedAt: "2026-10-01T18:00:00.000Z"
      }),
      follow({ eventId: "follow-next-live" })
    ),
    true
  );
});

test("fusionne le même spectateur reçu par deux sources techniques", () => {
  const guard = new FollowSessionGuard();
  const state = liveState();

  assert.equal(guard.accept(state, follow({ source: "source-a" })), true);
  assert.equal(
    guard.accept(
      state,
      follow({ source: "source-b", eventId: "follow-2" })
    ),
    false
  );
});

test("fusionne les variantes identifiant numérique et @ TikTok", () => {
  const guard = new FollowSessionGuard();
  const state = liveState();

  assert.equal(
    guard.accept(state, follow({ id: "user-42", name: "alice" })),
    true
  );
  assert.equal(
    guard.accept(
      state,
      follow({ id: "alice", name: "alice", eventId: "follow-2" })
    ),
    false
  );
});

test("les simulateurs restent répétables", () => {
  const guard = new FollowSessionGuard();
  const state = liveState();
  const event = follow({ source: "simulator" });

  assert.equal(guard.accept(state, event), true);
  assert.equal(guard.accept(state, event), true);
});

test("un follow anonyme déduplique seulement son message natif", () => {
  const guard = new FollowSessionGuard();
  const state = liveState();
  const anonymous = follow({ id: "anonymous", name: "anonymous" });

  assert.equal(guard.accept(state, anonymous), true);
  assert.equal(guard.accept(state, { ...anonymous }), false);
  assert.equal(
    guard.accept(
      state,
      follow({
        id: "anonymous",
        name: "anonymous",
        eventId: "another-anonymous-follow"
      })
    ),
    true
  );
});

test("construit les identités du LIVE, du viewer et du message", () => {
  const event = follow({ eventId: "Native-42", id: "42", name: "@Alice" });
  assert.equal(
    followLiveIdentity(liveState()),
    "started:2026-10-01t12:00:00.000z"
  );
  assert.equal(followViewerIdentity(event), "42");
  assert.deepEqual(followViewerIdentities(event), ["42", "alice"]);
  assert.equal(
    followEventIdentity(event),
    "source_tiktok:native-42"
  );
});
