"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createRelayState,
  publicMediaUrl,
  publicOverlayUrls,
  relayDatabaseUrl
} = require("../src/shared/public-overlay-protocol");

test("publicOverlayUrls crée des sources HTTPS stables sans jeton local", () => {
  const urls = publicOverlayUrls({
    baseUrl: "https://overlays.example.test/",
    channelId: "canal-secret",
    proAccess: true
  });
  assert.equal(urls.mediaScreens.length, 8);
  assert.equal(
    urls.timer,
    "https://overlays.example.test/?view=timer&channel=canal-secret"
  );
  assert.match(urls.mediaScreens[7], /screen=8/);
  assert.doesNotMatch(JSON.stringify(urls), /127\.0\.0\.1|token=/);
});

test("publicOverlayUrls masque les sources Pro sans droit actif", () => {
  const urls = publicOverlayUrls({
    channelId: "canal-secret",
    proAccess: false
  });
  assert.equal(urls.winCounter, "");
  assert.equal(urls.matchX2, "");
  assert.match(urls.likeGoal, /^https:\/\//);
});

test("publicMediaUrl remplace seulement les médias du serveur local", () => {
  assert.equal(
    publicMediaUrl(
      "http://127.0.0.1:17654/overlay/media/widgets/test image.png?token=x",
      "https://cdn.example.test/"
    ),
    "https://cdn.example.test/media/widgets/test%20image.png"
  );
  assert.equal(
    publicMediaUrl(
      "/overlay/media/lottie/12345-test.json",
      "https://cdn.example.test"
    ),
    "https://tikfinity.zerody.one/assets/lotties/12345-test.json"
  );
  assert.equal(
    publicMediaUrl("https://cdn.other.test/video.webm"),
    "https://cdn.other.test/video.webm"
  );
});

test("createRelayState n'expose que l'état nécessaire aux widgets", () => {
  const state = createRelayState({
    goals: [{ id: "goal-1", current: 10 }],
    session: { running: true },
    overlaySession: { hasData: true, winCounterCurrent: 4 },
    statistics: { sessionLikes: 200 },
    settings: {
      apiToken: "ne-doit-jamais-sortir",
      overlayToken: "secret"
    },
    commerce: { subscription: { tier: "premium" } }
  });
  assert.equal(state.overlaySession.winCounterCurrent, 4);
  assert.equal(state.statistics.sessionLikes, 200);
  assert.equal(state.statistics.sessionUniqueViewers, 0);
  assert.equal(state.settings, undefined);
  assert.doesNotMatch(JSON.stringify(state), /ne-doit-jamais-sortir|secret/);
});

test("relayDatabaseUrl encode le canal et les sous-chemins", () => {
  assert.equal(
    relayDatabaseUrl(
      "https://db.example.test/",
      "a/b",
      "lastBatch/messages"
    ),
    "https://db.example.test/publicOverlayRelay/a%2Fb/lastBatch/messages.json"
  );
});
