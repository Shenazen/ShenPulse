"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  FollowSessionGuard,
  followLiveScope,
  followViewerIdentity
} = require("../src/main/follow-session-guard");

function liveState({
  startedAt = "2026-08-07T12:00:00.000Z",
  roomId = "room-123"
} = {}) {
  return {
    session: { running: true, startedAt },
    settings: {
      tiktok: { username: "streamer", roomId }
    }
  };
}

function follow({
  id = "viewer-one",
  name = "viewer-one",
  source = "source_tiktok"
} = {}) {
  return {
    type: "follow",
    source,
    user: { id, name },
    data: { raw: { channelUsername: "streamer" } }
  };
}

test("accepte un seul follow par viewer pendant le même LIVE", () => {
  const guard = new FollowSessionGuard();
  const state = liveState();

  assert.equal(guard.accept(state, follow()), true);
  assert.equal(guard.accept(state, follow()), false);
  assert.equal(guard.accept(state, follow({ id: "viewer-two" })), true);
});

test("une reconnexion à la même salle TikTok ne réarme pas le follow", () => {
  const guard = new FollowSessionGuard();
  const firstConnection = liveState({
    startedAt: "2026-08-07T12:00:00.000Z",
    roomId: "room-123"
  });
  const reconnected = liveState({
    startedAt: "2026-08-07T12:02:00.000Z",
    roomId: "room-123"
  });

  assert.equal(guard.accept(firstConnection, follow()), true);
  assert.equal(guard.accept(reconnected, follow()), false);
});

test("le même viewer peut déclencher un follow au LIVE suivant", () => {
  const guard = new FollowSessionGuard();

  assert.equal(
    guard.accept(liveState({ roomId: "room-123" }), follow()),
    true
  );
  assert.equal(
    guard.accept(liveState({ roomId: "room-456" }), follow()),
    true
  );
});

test("une session manuelle utilise son heure de démarrage comme frontière", () => {
  const guard = new FollowSessionGuard();
  const event = follow({ source: "generic_websocket" });

  assert.equal(
    guard.accept(
      liveState({ startedAt: "2026-08-07T12:00:00.000Z", roomId: "" }),
      event
    ),
    true
  );
  assert.equal(
    guard.accept(
      liveState({ startedAt: "2026-08-07T12:00:00.000Z", roomId: "" }),
      event
    ),
    false
  );
  assert.equal(
    guard.accept(
      liveState({ startedAt: "2026-08-07T13:00:00.000Z", roomId: "" }),
      event
    ),
    true
  );
});

test("les simulateurs restent répétables et les viewers inconnus ne sont pas fusionnés", () => {
  const guard = new FollowSessionGuard();
  const state = liveState();
  const simulated = follow({ source: "simulator" });
  const anonymous = follow({ id: "anonymous", name: "anonymous" });

  assert.equal(guard.accept(state, simulated), true);
  assert.equal(guard.accept(state, simulated), true);
  assert.equal(guard.accept(state, anonymous), true);
  assert.equal(guard.accept(state, anonymous), true);
});

test("ignore la déduplication hors LIVE et pour les autres événements", () => {
  const guard = new FollowSessionGuard();
  const offline = liveState();
  offline.session.running = false;
  const event = follow();

  assert.equal(guard.accept(offline, event), true);
  assert.equal(guard.accept(offline, event), true);
  assert.equal(
    guard.accept(liveState(), { ...event, type: "gift" }),
    true
  );
});

test("normalise la portée LIVE et l’identité du viewer", () => {
  assert.equal(
    followLiveScope(liveState(), follow()),
    "tiktok:streamer:room-123"
  );
  assert.equal(
    followViewerIdentity(follow({ id: "@Viewer-One" })),
    "source_tiktok:viewer-one"
  );
});

test("ne limite jamais les cadeaux repetes du meme viewer", () => {
  const guard = new FollowSessionGuard();
  const state = liveState();
  const event = follow();
  const gift = { ...event, type: "gift" };

  assert.equal(guard.accept(state, event), true);
  assert.equal(guard.accept(state, gift), true);
  assert.equal(guard.accept(state, gift), true);
  assert.equal(guard.accept(state, event), false);
  assert.equal(guard.accept(state, gift), true);
});
