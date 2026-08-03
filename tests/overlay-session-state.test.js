"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyOverlayOperation,
  createDefaultOverlaySession,
  finishOverlaySession,
  recordOverlayEvent,
  resetOverlaySession
} = require("../src/main/overlay-session-state");

function runtimeState() {
  return {
    session: { running: true },
    overlaySession: createDefaultOverlaySession()
  };
}

test("un nouveau LIVE vide les overlays puis conserve son dernier état", () => {
  const state = runtimeState();
  resetOverlaySession(state, "2026-07-28T10:00:00.000Z");

  recordOverlayEvent(state, {
    id: "gift-1",
    type: "gift",
    source: "tiktok-direct",
    timestamp: "2026-07-28T10:00:01.000Z",
    user: {
      id: "alice",
      name: "alice",
      displayName: "Alice",
      avatarUrl: "https://example.com/alice.png"
    },
    data: { count: 5, value: 2, giftName: "Rose" }
  });
  recordOverlayEvent(state, {
    id: "like-1",
    type: "like",
    source: "tiktok-direct",
    timestamp: "2026-07-28T10:00:02.000Z",
    user: {
      id: "bob",
      name: "bob",
      displayName: "Bob",
      avatarUrl: "https://example.com/bob.png"
    },
    data: { count: 240, value: 0 }
  });

  assert.equal(state.overlaySession.coinJarCurrent, 10);
  assert.equal(state.overlaySession.likeGoalCurrent, 240);
  assert.equal(state.overlaySession.winCounterCurrent, 0);
  assert.deepEqual(state.overlaySession.leaderboards.donors[0], {
    id: "alice",
    name: "Alice",
    avatarUrl: "https://example.com/alice.png",
    score: 10
  });
  assert.equal(state.overlaySession.leaderboards.tappers[0].score, 240);

  state.session.running = false;
  finishOverlaySession(state, "2026-07-28T11:00:00.000Z");
  assert.equal(state.overlaySession.active, false);
  assert.equal(state.overlaySession.likeGoalCurrent, 240);
  assert.equal(state.overlaySession.leaderboards.donors[0].name, "Alice");

  state.session.running = true;
  resetOverlaySession(state, "2026-07-28T12:00:00.000Z");
  assert.equal(state.overlaySession.active, true);
  assert.equal(state.overlaySession.likeGoalCurrent, 0);
  assert.equal(state.overlaySession.coinJarCurrent, 0);
  assert.deepEqual(state.overlaySession.recentEvents, []);
  assert.deepEqual(state.overlaySession.leaderboards, {
    donors: [],
    tappers: []
  });
});

test("les cadeaux seuls ne modifient jamais le compteur WINS", () => {
  const state = runtimeState();
  resetOverlaySession(state);
  state.overlaySession.winCounterCurrent = 7;

  recordOverlayEvent(state, {
    id: "gift-without-win-action",
    type: "gift",
    source: "tiktok-direct",
    user: { id: "alice", name: "alice", displayName: "Alice" },
    data: { count: 25, value: 10, giftName: "Rose" }
  });

  assert.equal(state.overlaySession.coinJarCurrent, 250);
  assert.equal(state.overlaySession.winCounterCurrent, 7);
});

test("un Like Goal simulé reste hydratable hors LIVE sans activer une session", () => {
  const state = {
    session: { running: false },
    overlaySession: createDefaultOverlaySession()
  };

  for (let index = 0; index < 2; index += 1) {
    recordOverlayEvent(state, {
      id: `like-test-${index}`,
      type: "like",
      source: "simulator",
      user: {
        id: "test_viewer",
        name: "test_viewer",
        displayName: "Spectateur test"
      },
      data: { count: 2500 }
    });
  }

  assert.equal(state.overlaySession.likeGoalCurrent, 5000);
  assert.equal(state.overlaySession.hasData, true);
  assert.equal(state.overlaySession.active, false);
  assert.equal(state.session.running, false);
});

test("un événement TikTok hors LIVE ne modifie toujours pas l'état hydraté", () => {
  const state = {
    session: { running: false },
    overlaySession: createDefaultOverlaySession()
  };
  recordOverlayEvent(state, {
    id: "like-hors-live",
    type: "like",
    source: "source_tiktok",
    user: { id: "alice", name: "alice", displayName: "Alice" },
    data: { count: 2500 }
  });

  assert.equal(state.overlaySession.likeGoalCurrent, 0);
  assert.equal(state.overlaySession.hasData, false);
});

test("les remises à zéro manuelles modifient aussi l'état hydraté", () => {
  const state = runtimeState();
  resetOverlaySession(state);
  state.overlaySession.likeGoalCurrent = 900;
  state.overlaySession.coinJarCurrent = 60;
  state.overlaySession.winCounterCurrent = 8;

  applyOverlayOperation(state, "like-goal", { operation: "reset" });
  applyOverlayOperation(state, "coin-jar", {
    operation: "adjust",
    amount: -10
  });
  applyOverlayOperation(state, "win-counter", {
    operation: "set",
    amount: 3
  });

  assert.equal(state.overlaySession.likeGoalCurrent, 0);
  assert.equal(state.overlaySession.coinJarCurrent, 50);
  assert.equal(state.overlaySession.winCounterCurrent, 3);
});

test("le multiplicateur WINS s'applique aux gains et aux pertes jusqu'à son expiration", () => {
  const state = {
    session: { running: false },
    overlaySession: {}
  };
  const startedAt = "2030-01-01T10:00:00.000Z";

  applyOverlayOperation(
    state,
    "win-counter",
    { operation: "set", amount: 10 },
    startedAt
  );
  applyOverlayOperation(
    state,
    "win-counter",
    { operation: "multiplier", amount: 2, durationSeconds: 60 },
    startedAt
  );
  applyOverlayOperation(
    state,
    "win-counter",
    { operation: "adjust", amount: 1 },
    "2030-01-01T10:00:10.000Z"
  );
  applyOverlayOperation(
    state,
    "win-counter",
    { operation: "adjust", amount: -1 },
    "2030-01-01T10:00:20.000Z"
  );
  assert.equal(state.overlaySession.winCounterCurrent, 10);
  assert.equal(state.overlaySession.winCounterMultiplier, 2);

  applyOverlayOperation(
    state,
    "win-counter",
    { operation: "adjust", amount: 1 },
    "2030-01-01T10:01:01.000Z"
  );
  assert.equal(state.overlaySession.winCounterCurrent, 11);
  assert.equal(state.overlaySession.winCounterMultiplier, 1);
  assert.equal(state.overlaySession.winCounterMultiplierUntil, 0);
});

test("le timer conserve son échéance pour les overlays connectés plus tard", () => {
  const state = runtimeState();
  const startedAt = "2030-01-01T10:00:00.000Z";

  applyOverlayOperation(
    state,
    "timer",
    { operation: "set", seconds: 600, label: "Temps restant" },
    startedAt
  );
  assert.equal(state.overlaySession.timerSeconds, 600);
  assert.equal(
    state.overlaySession.timerEndsAt,
    Date.parse(startedAt) + 600_000
  );
  assert.equal(state.overlaySession.timerPaused, false);

  applyOverlayOperation(
    state,
    "timer",
    { operation: "pause" },
    "2030-01-01T10:01:00.000Z"
  );
  assert.equal(state.overlaySession.timerSeconds, 540);
  assert.equal(state.overlaySession.timerEndsAt, 0);
  assert.equal(state.overlaySession.timerPaused, true);

  applyOverlayOperation(
    state,
    "timer",
    { operation: "resume" },
    "2030-01-01T10:02:00.000Z"
  );
  assert.equal(
    state.overlaySession.timerEndsAt,
    Date.parse("2030-01-01T10:11:00.000Z")
  );
  assert.equal(state.overlaySession.timerPaused, false);
});
