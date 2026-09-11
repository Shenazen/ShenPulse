"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ShenPulseCore,
  clearSessionState,
  defaultTestEventCount,
  readMontChiliadCounterEvent,
  recordEventStatistics,
  resolveLikeGoalCompletionChange,
  shouldRecordActivity,
  synchronizeSessionWithTikTok
} = require("../src/main/core");

test("le simulateur envoie un seul cadeau par défaut", () => {
  assert.equal(defaultTestEventCount("gift"), 1);
  assert.equal(defaultTestEventCount("follow"), 1);
  assert.equal(defaultTestEventCount("like"), 25);

  const core = Object.create(ShenPulseCore.prototype);
  core.store = {
    getState: () => ({ settings: { tiktok: { username: "creator" } } })
  };
  assert.equal(core.createTestEvent("gift").data.repeatCount, 1);
  assert.equal(core.createTestEvent("like").data.likeCount, 25);
});

function state() {
  return {
    session: {
      running: false,
      startedAt: null,
      startedBy: "",
      tiktokRoomId: "",
      tiktokInterruptedAt: null,
      activeConnectionIds: []
    },
    statistics: {
      sessionEvents: 12,
      sessionActions: 7,
      sessionLikes: 240,
      sessionUniqueViewers: ["alice", "bob"],
      lifetimeEvents: 120,
      lifetimeActions: 70,
      gifts: 10,
      likes: 2400,
      follows: 20,
      subscribers: 5,
      uniqueViewers: ["alice", "bob", "charlie"]
    }
  };
}

test("démarre automatiquement la session quand TikTok passe en LIVE", () => {
  const value = state();
  const transition = synchronizeSessionWithTikTok(
    value,
    "live",
    { roomId: "room-a" },
    "2026-07-27T12:00:00.000Z"
  );
  assert.equal(transition, "started");
  assert.equal(value.session.running, true);
  assert.equal(value.session.startedBy, "tiktok");
  assert.equal(value.session.startedAt, "2026-07-27T12:00:00.000Z");
  assert.equal(value.session.tiktokRoomId, "room-a");
  assert.equal(value.session.tiktokInterruptedAt, null);
  assert.deepEqual(value.session.activeConnectionIds, ["source_tiktok"]);
  assert.equal(value.statistics.sessionEvents, 0);
  assert.equal(value.statistics.sessionActions, 0);
  assert.equal(value.statistics.sessionLikes, 0);
  assert.deepEqual(value.statistics.sessionUniqueViewers, []);
});

test("conserve tous les overlays pendant une coupure du même LIVE", () => {
  const value = state();
  synchronizeSessionWithTikTok(
    value,
    "live",
    { roomId: "room-a" },
    "2026-07-27T12:00:00.000Z"
  );
  value.statistics.sessionEvents = 37;
  value.statistics.sessionLikes = 4616;
  value.overlaySession.likeGoalCurrent = 4616;
  value.overlaySession.timerSeconds = 5880;
  value.overlaySession.leaderboards.tappers = [
    { id: "alice", name: "Alice", avatarUrl: "", score: 4616 }
  ];

  assert.equal(
    synchronizeSessionWithTikTok(
      value,
      "offline",
      { roomId: "room-a" },
      "2026-07-27T12:30:00.000Z"
    ),
    "interrupted"
  );
  assert.equal(value.session.running, true);
  assert.equal(value.session.startedAt, "2026-07-27T12:00:00.000Z");
  assert.equal(value.session.tiktokRoomId, "room-a");
  assert.equal(
    value.session.tiktokInterruptedAt,
    "2026-07-27T12:30:00.000Z"
  );
  assert.deepEqual(value.session.activeConnectionIds, []);
  assert.equal(value.statistics.sessionEvents, 37);
  assert.equal(value.statistics.sessionLikes, 4616);
  assert.equal(value.overlaySession.active, true);
  assert.equal(value.overlaySession.likeGoalCurrent, 4616);
  assert.equal(value.overlaySession.timerSeconds, 5880);
  assert.equal(value.overlaySession.leaderboards.tappers[0].score, 4616);

  assert.equal(
    synchronizeSessionWithTikTok(
      value,
      "live",
      { roomId: "room-a" },
      "2026-07-27T12:30:04.000Z"
    ),
    "resumed"
  );
  assert.equal(value.session.running, true);
  assert.equal(value.session.startedAt, "2026-07-27T12:00:00.000Z");
  assert.equal(value.session.tiktokInterruptedAt, null);
  assert.deepEqual(value.session.activeConnectionIds, ["source_tiktok"]);
  assert.equal(value.statistics.sessionEvents, 37);
  assert.equal(value.statistics.sessionLikes, 4616);
  assert.equal(value.overlaySession.likeGoalCurrent, 4616);
  assert.equal(value.overlaySession.timerSeconds, 5880);
  assert.equal(value.overlaySession.leaderboards.tappers[0].score, 4616);
});

test("réinitialise les overlays uniquement quand TikTok ouvre une autre salle LIVE", () => {
  const value = state();
  synchronizeSessionWithTikTok(
    value,
    "live",
    { roomId: "room-a" },
    "2026-07-27T12:00:00.000Z"
  );
  value.statistics.sessionEvents = 37;
  value.statistics.sessionLikes = 4616;
  value.overlaySession.likeGoalCurrent = 4616;
  synchronizeSessionWithTikTok(
    value,
    "offline",
    { roomId: "room-a" },
    "2026-07-27T13:00:00.000Z"
  );

  assert.equal(
    synchronizeSessionWithTikTok(
      value,
      "live",
      { roomId: "room-b" },
      "2026-07-27T18:00:00.000Z"
    ),
    "started"
  );
  assert.equal(value.session.tiktokRoomId, "room-b");
  assert.equal(value.session.startedAt, "2026-07-27T18:00:00.000Z");
  assert.equal(value.statistics.sessionEvents, 0);
  assert.equal(value.statistics.sessionLikes, 0);
  assert.equal(value.overlaySession.likeGoalCurrent, 0);
  assert.deepEqual(value.overlaySession.leaderboards, {
    donors: [],
    tappers: []
  });
});

test("efface un ancien compteur LIVE lors d’un redémarrage", () => {
  const value = state();
  value.session.running = true;
  value.session.startedAt = "2026-07-27T11:10:21.122Z";
  value.session.startedBy = "manual";
  value.session.tiktokRoomId = "room-old";
  value.session.tiktokInterruptedAt = "2026-07-27T11:20:00.000Z";
  value.session.activeConnectionIds = ["source_tiktok"];

  clearSessionState(value);

  assert.equal(value.session.running, false);
  assert.equal(value.session.startedAt, null);
  assert.equal(value.session.startedBy, "");
  assert.equal(value.session.tiktokRoomId, "");
  assert.equal(value.session.tiktokInterruptedAt, null);
  assert.deepEqual(value.session.activeConnectionIds, []);
});

test("compte les likes et viewers uniquement dans la session active", () => {
  const value = state();
  const event = {
    type: "like",
    user: { id: "diane" },
    data: { count: 25 }
  };

  recordEventStatistics(value, event);
  assert.equal(value.statistics.lifetimeEvents, 121);
  assert.equal(value.statistics.likes, 2425);
  assert.equal(value.statistics.sessionEvents, 12);
  assert.equal(value.statistics.sessionLikes, 240);
  assert.deepEqual(value.statistics.sessionUniqueViewers, ["alice", "bob"]);

  value.session.running = true;
  recordEventStatistics(value, event);
  recordEventStatistics(value, event);
  assert.equal(value.statistics.sessionEvents, 14);
  assert.equal(value.statistics.sessionLikes, 290);
  assert.deepEqual(
    value.statistics.sessionUniqueViewers,
    ["alice", "bob", "diane"]
  );
});

test("un Like Goal simulé franchit son palier même sans session active", () => {
  const unchangedRuntime = {
    previousLikeGoalCurrent: 0,
    likeGoalCurrent: 0
  };
  assert.deepEqual(
    resolveLikeGoalCompletionChange(
      {
        type: "like",
        source: "simulator",
        data: { count: 2500 }
      },
      unchangedRuntime
    ),
    {
      previousLikeGoalCurrent: 0,
      likeGoalCurrent: 2500
    }
  );
  assert.deepEqual(
    resolveLikeGoalCompletionChange(
      {
        type: "like",
        source: "tiktok",
        data: { count: 2500 }
      },
      unchangedRuntime
    ),
    unchangedRuntime
  );
});

test("transmet une seule fois chaque victoire ou mort native au compteur WINS", () => {
  const cursors = new Map();
  const pack = { id: "gtav-montchiliad" };
  const victory = {
    type: "montchiliad:victory",
    sessionId: "gta-session-1",
    counterEventId: 4,
    counterDelta: 1,
    counterEvent: "win"
  };

  assert.equal(
    readMontChiliadCounterEvent(
      pack,
      {
        ...victory,
        counterEventId: 0,
        counterDelta: 0,
        counterEvent: ""
      },
      cursors
    ),
    null
  );
  assert.deepEqual(
    readMontChiliadCounterEvent(pack, victory, cursors),
    {
      sessionId: "gta-session-1",
      eventId: 4,
      amount: 1,
      eventName: "win"
    }
  );
  assert.equal(readMontChiliadCounterEvent(pack, victory, cursors), null);
  assert.deepEqual(
    readMontChiliadCounterEvent(
      pack,
      {
        ...victory,
        counterEventId: 5,
        counterDelta: -1,
        counterEvent: "death"
      },
      cursors
    ),
    {
      sessionId: "gta-session-1",
      eventId: 5,
      amount: -1,
      eventName: "death"
    }
  );
});

test("le journal masque les reconnexions répétitives hors LIVE", () => {
  const offlineState = {
    activity: [],
    session: {
      running: false,
      game: { running: false }
    }
  };
  assert.equal(
    shouldRecordActivity(offlineState, {
      category: "connection",
      detail: "",
      level: "info",
      title: "source_tiktok : reconnecting"
    }),
    false
  );
  assert.equal(
    shouldRecordActivity(offlineState, {
      category: "tiktok",
      detail: "@viewer",
      level: "info",
      title: "Vérification du LIVE TikTok"
    }),
    false
  );

  const liveState = structuredClone(offlineState);
  liveState.session.running = true;
  assert.equal(
    shouldRecordActivity(liveState, {
      category: "connection",
      detail: "",
      level: "info",
      title: "source_tiktok : connected"
    }),
    true
  );
});

test("le journal conserve une erreur hors LIVE sans la répéter en boucle", () => {
  const timestamp = "2026-07-30T12:00:00.000Z";
  const entry = {
    category: "tiktok",
    detail: "Connexion refusée",
    level: "error",
    title: "Connexion TikTok en erreur"
  };
  const offlineState = {
    activity: [],
    session: {
      running: false,
      game: { running: false }
    }
  };
  assert.equal(
    shouldRecordActivity(
      offlineState,
      entry,
      Date.parse(timestamp)
    ),
    true
  );
  offlineState.activity.push({ ...entry, timestamp });
  assert.equal(
    shouldRecordActivity(
      offlineState,
      entry,
      Date.parse(timestamp) + 60_000
    ),
    false
  );
});
