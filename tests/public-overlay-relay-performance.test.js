"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createDefaultState } = require("../src/main/defaults");
const { PublicOverlayRelay } = require("../src/main/public-overlay-relay");
const { selectStatePaths } = require("../src/main/state-projection");

const pause = (milliseconds = 75) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const response = (status, body = {}) => ({
  ok: status >= 200 && status < 300, status,
  text: async () => JSON.stringify(body)
});

function harness({ fetchPatch, requestTimeoutMs } = {}) {
  const state = createDefaultState();
  state.logs = [{ privateLargeHistory: "local-only".repeat(300_000) }];
  state.accountWorkspaces = { other: { private: "never inspect" } };
  const secrets = new Map();
  const projections = [];
  const store = {
    getState() { throw new Error("The relay must never clone the complete workspace"); },
    getStateProjection(paths) {
      projections.push(paths);
      return selectStatePaths(state, paths);
    },
    mutate(callback) { callback(state); },
    getSecret(key) { return secrets.get(key) || ""; },
    setSecret(key, value) {
      const next = key || `secret-${secrets.size + 1}`;
      secrets.set(next, String(value));
      return next;
    }
  };
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    const request = { url: String(url), method: options.method,
      signal: options.signal,
      body: options.body && (options.headers?.["Content-Type"] === "application/x-www-form-urlencoded"
        ? Object.fromEntries(new URLSearchParams(options.body)) : JSON.parse(options.body)) };
    requests.push(request);
    if (request.url.includes("accounts:signUp")) return response(200, {
      idToken: "installation-token", refreshToken: "refresh-token",
      localId: "installation-uid", expiresIn: "3600"
    });
    if (request.url.includes("securetoken.googleapis.com")) return response(200, {
      id_token: "refreshed-token", refresh_token: "refresh-token",
      user_id: "installation-uid", expires_in: "3600"
    });
    return fetchPatch && options.method === "PATCH"
      ? fetchPatch(request) : response(200);
  };
  const relay = new PublicOverlayRelay({ store, fetchImpl, requestTimeoutMs });
  const writes = () => requests.filter((request) => request.method === "PATCH");
  return { relay, state, store, requests, projections, writes };
}

test("relay: unchanged state produces no Firebase PATCH and no full-store clone", async (t) => {
  const h = harness();
  t.after(() => h.relay.stop());
  await h.relay.start();
  assert.equal(h.relay.status().connected, true);
  assert.ok(h.relay.urls().timer);
  h.requests.length = 0;
  h.projections.length = 0;
  for (let index = 0; index < 100; index += 1) h.relay.publishState();
  await pause();
  assert.equal(h.writes().length, 0);
  assert.equal(h.projections.filter((paths) => paths.includes("overlaySession")).length, 1);
  assert.ok(h.projections.every((paths) => !paths.includes("logs") && !paths.includes("settings")));
  assert.ok(h.projections.every((paths) => !paths.includes("settings.overlayConfigs")));
});

test("relay: coalesced genuine changes publish one current state, not the match alias", async (t) => {
  const h = harness();
  t.after(() => h.relay.stop());
  await h.relay.start();
  h.requests.length = 0;
  for (let current = 1; current <= 20; current += 1) {
    h.state.overlaySession.likeGoalCurrent = current;
    h.relay.publishState();
  }
  await pause();
  assert.equal(h.writes().length, 1);
  assert.equal(h.writes()[0].body.state.overlaySession.likeGoalCurrent, 20);
  h.requests.length = 0;
  h.relay.publishState();
  await pause();
  assert.equal(h.writes().length, 0);
});

test("relay: unrelated history changes are ignored; every protocol statistic is preserved", async (t) => {
  const h = harness();
  t.after(() => h.relay.stop());
  await h.relay.start();
  h.requests.length = 0;
  h.state.updatedAt = "new-local-write";
  h.state.logs.push({ message: "not for browser sources" });
  h.relay.publishState();
  await pause();
  assert.equal(h.writes().length, 0);
  Object.assign(h.state.statistics, { sessionEvents: 12, sessionActions: 9,
    sessionLikes: 140, sessionUniqueViewers: ["a", "b"], lifetimeEvents: 27,
    likes: 190, gifts: 5, follows: 3, subscribers: 2 });
  h.relay.publishState();
  await pause();
  assert.deepEqual(h.writes()[0].body.state.statistics, {
    sessionEvents: 12, sessionActions: 9, sessionLikes: 140,
    sessionUniqueViewers: 2, lifetimeEvents: 27, likes: 190,
    gifts: 5, follows: 3, subscribers: 2
  });
  assert.doesNotMatch(JSON.stringify(h.writes()), /local-only|never inspect|privateLargeHistory/);
});

test("relay: explicit state snapshots are owned and coalesced before sanitization", async (t) => {
  const h = harness();
  t.after(() => h.relay.stop());
  await h.relay.start();
  h.requests.length = 0;
  h.state.overlaySession.likeGoalCurrent = 15;
  h.relay.publishState(h.state);
  h.state.overlaySession.likeGoalCurrent = 99;
  await pause();
  assert.equal(h.writes().length, 1);
  assert.equal(h.writes()[0].body.state.overlaySession.likeGoalCurrent, 15);
});

test("relay: account, port and Pro changes invalidate only the effective match alias", async (t) => {
  const h = harness();
  t.after(() => h.relay.stop());
  await h.relay.start();
  h.requests.length = 0;
  h.state.settings.account.uid = "changed-account";
  h.state.settings.overlayPort = 19001;
  h.relay.publishState();
  await pause();
  assert.equal(h.writes().length, 1);
  assert.equal(h.writes()[0].body.matchSource.localPort, 19001);
  assert.equal(h.writes()[0].body.matchSource.accountNumber.length, 12);
  h.requests.length = 0;
  h.state.commerce.subscription = { tier: "pro", source: "paid", status: "active" };
  h.relay.publishState();
  await pause();
  assert.equal(h.writes().length, 2);
  assert.equal(h.writes().find((entry) => entry.body.matchSource).body.matchSource.enabled, true);
  assert.equal(h.writes().find((entry) => entry.body.state?.overlayScene).body.state.overlayScene.proAccess, true);
  h.requests.length = 0;
  h.relay.publishState();
  await pause();
  assert.equal(h.writes().length, 0);
  h.state.commerce.subscription = { tier: "pro", source: "trial", status: "trial", expiresAtMs: Date.now() - 1 };
  h.relay.publishState();
  await pause();
  assert.equal(h.writes().find((entry) => entry.body.matchSource).body.matchSource.enabled, false);
});

test("relay: URL rotation and restart cannot reuse a previous channel signature", async (t) => {
  const h = harness();
  t.after(() => h.relay.stop());
  await h.relay.start();
  const firstChannel = h.relay.status().channelId;
  h.requests.length = 0;
  await h.relay.rotateChannel();
  assert.notEqual(h.relay.status().channelId, firstChannel);
  assert.equal(h.writes().length, 2);
  assert.ok(h.writes().some((entry) => entry.body.configurations));
  h.requests.length = 0;
  const previousMatch = h.relay.status().matchChannelId;
  await h.relay.rotateMatchChannel();
  assert.notEqual(h.relay.status().matchChannelId, previousMatch);
  assert.equal(h.writes().length, 1);
  await h.relay.stop();
  h.requests.length = 0;
  await h.relay.start();
  assert.equal(h.writes().length, 2);
  assert.ok(h.writes().every((entry) => entry.body.presence.connected));
});

test("relay: event batches preserve message order and atomic root state without redundant writes", async (t) => {
  const h = harness();
  t.after(() => h.relay.stop());
  await h.relay.start();
  h.requests.length = 0;
  h.state.overlaySession.likeGoalCurrent = 21;
  // An explicitly older snapshot must not roll back the current atomic batch.
  h.relay.publishState(h.state);
  h.state.overlaySession.likeGoalCurrent = 22;
  for (let seconds = 1; seconds <= 3; seconds += 1) h.relay.publish("timer", { seconds });
  await pause();
  assert.equal(h.writes().length, 1);
  const batch = h.writes()[0].body;
  assert.deepEqual(batch.lastBatch.messages.map((message) => message.payload.seconds), [1, 2, 3]);
  assert.deepEqual(batch.lastBatch.state, batch.state);
  assert.equal(batch.state.overlaySession.likeGoalCurrent, 22);
});

test("relay: state and event writes are serialized so slow requests cannot roll back a newer batch", async (t) => {
  let release;
  let delayNextState = false;
  const gate = new Promise((resolve) => { release = resolve; });
  const h = harness({ fetchPatch: async (request) => {
    if (delayNextState && request.body.state && !request.body.lastBatch) {
      delayNextState = false;
      await gate;
    }
    return response(200);
  } });
  t.after(() => { release(); return h.relay.stop(); });
  await h.relay.start();
  h.requests.length = 0;
  delayNextState = true;
  h.state.overlaySession.likeGoalCurrent = 1;
  h.relay.publishState();
  await pause(45);
  h.state.overlaySession.likeGoalCurrent = 2;
  h.relay.publish("timer", { seconds: 5 });
  h.relay.publishState();
  await pause(45);
  assert.equal(h.writes().length, 1);
  release();
  await pause();
  assert.equal(h.writes().length, 2);
  const latest = h.writes().at(-1).body;
  assert.ok(latest.lastBatch);
  assert.equal(latest.state.overlaySession.likeGoalCurrent, 2);
  assert.deepEqual(latest.state, latest.lastBatch.state);
});

test("relay: event failures retain ordered messages and reconnect with the newest state", async (t) => {
  let failBatch = true;
  const h = harness({ fetchPatch: async (request) => {
    if (request.body.lastBatch && failBatch) {
      failBatch = false;
      return response(500, { error: "temporary outage" });
    }
    return response(200);
  } });
  t.after(() => h.relay.stop());
  await h.relay.start();
  h.requests.length = 0;
  h.relay.publish("timer", { seconds: 1 });
  await pause();
  assert.equal(h.relay.status().status, "offline");
  assert.equal(h.relay.eventQueue.length, 1);
  h.state.overlaySession.likeGoalCurrent = 88;
  h.relay.publishState();
  h.relay.publish("timer", { seconds: 2 });
  await pause(1150);
  assert.equal(h.relay.status().connected, true);
  assert.equal(h.relay.eventQueue.length, 0);
  const recovered = h.writes().filter((entry) => entry.body.lastBatch).at(-1).body;
  assert.deepEqual(recovered.lastBatch.messages.map((message) => message.payload.seconds), [1, 2]);
  assert.equal(recovered.state.overlaySession.likeGoalCurrent, 88);
});

test("relay: denied writes refresh authentication and stop publishes both offline presences", async (t) => {
  let denyOnce = false;
  const h = harness({ fetchPatch: async () => {
    if (denyOnce) { denyOnce = false; return response(401); }
    return response(200);
  } });
  t.after(() => h.relay.stop());
  await h.relay.start();
  h.requests.length = 0;
  denyOnce = true;
  h.state.overlaySession.likeGoalCurrent = 7;
  h.relay.publishState();
  await pause();
  assert.equal(h.relay.status().connected, true);
  assert.equal(h.requests.filter((request) => request.url.includes("securetoken.googleapis.com")).length, 1);
  assert.equal(h.writes().length, 2);
  assert.match(h.writes().at(-1).url, /auth=refreshed-token/);
  h.requests.length = 0;
  await h.relay.stop();
  assert.equal(h.writes().length, 2);
  assert.ok(h.writes().every((entry) => entry.body.presence.connected === false));
});

test("relay: unchanged state still has two forced 45-second heartbeat presences", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const h = harness();
  t.after(() => h.relay.stop());
  await h.relay.start();
  h.requests.length = 0;
  t.mock.timers.tick(45_000);
  await pause(5);
  assert.equal(h.writes().length, 2);
  assert.ok(h.writes().every((entry) => entry.body.presence.connected === true));
  assert.ok(h.writes().some((entry) => entry.body.matchSource));
  assert.ok(h.writes().every((entry) => !entry.body.state));
});

test("relay: overlay configuration is projected only for connection/configuration batches", async (t) => {
  const h = harness();
  t.after(() => h.relay.stop());
  await h.relay.start();
  h.requests.length = 0;
  h.projections.length = 0;
  h.relay.publish("timer", { seconds: 1 });
  await pause();
  assert.ok(h.projections.every((paths) => !paths.includes("settings.overlayConfigs")));
  h.state.settings.overlayConfigs.likeGoal.title = "NEW WORKSPACE";
  h.state.settings.publicOverlayRelay.publicBaseUrl = "https://my-new-host.example";
  h.relay.publish("configuration", { overlayKey: "likeGoal" });
  await pause();
  assert.ok(h.projections.some((paths) => paths.includes("settings.overlayConfigs")));
  assert.equal(h.writes().at(-1).body.configurations.likeGoal.title, "NEW WORKSPACE");
  assert.match(h.relay.urls().timer, /^https:\/\/my-new-host\.example\//);
});

test("relay: offline queues and failed reinsertions remain bounded", async (t) => {
  let rejectBatch = false;
  const h = harness({ fetchPatch: async (request) => {
    return request.body.lastBatch && rejectBatch ? response(500) : response(200);
  } });
  t.after(() => h.relay.stop());
  await h.relay.start();
  rejectBatch = true;
  h.relay.publish("timer", { seconds: 1 });
  await pause();
  assert.equal(h.relay.status().status, "offline");
  for (let index = 0; index < 1200; index += 1) h.relay.publish("timer", { index });
  await pause();
  assert.equal(h.relay.eventQueue.length, 1000);
  assert.equal(h.relay.eventQueue[0].payload.index, 200);
  assert.equal(h.relay.eventQueue.at(-1).payload.index, 1199);
});

test("relay: stop aborts a slow state publication, then offline presence is always last", async (t) => {
  let stallNextState = false;
  let stalledRequest;
  const h = harness({ fetchPatch: async (request) => {
    if (stallNextState && request.body.state) {
      stallNextState = false;
      stalledRequest = request;
      return new Promise((resolve, reject) => request.signal.addEventListener("abort",
        () => reject(request.signal.reason), { once: true }));
    }
    return response(204);
  } });
  t.after(() => h.relay.stop());
  await h.relay.start();
  h.requests.length = 0;
  stallNextState = true;
  h.state.overlaySession.likeGoalCurrent = 19;
  h.relay.publishState();
  await pause(45);
  assert.ok(stalledRequest);
  await h.relay.stop();
  assert.equal(stalledRequest.signal.aborted, true);
  assert.equal(h.relay.status().status, "stopped");
  assert.equal(h.writes().length, 3);
  assert.ok(h.writes().slice(-2).every((entry) => entry.body.presence.connected === false));
  await pause();
  assert.equal(h.writes().length, 3);
});

test("relay: rotation aborts an in-flight batch before deleting its channel and reconnecting", async (t) => {
  let stallNextBatch = false;
  let stalledRequest;
  const h = harness({ fetchPatch: async (request) => {
    if (stallNextBatch && request.body.lastBatch) {
      stallNextBatch = false;
      stalledRequest = request;
      return new Promise((resolve, reject) => request.signal.addEventListener("abort",
        () => reject(request.signal.reason), { once: true }));
    }
    return response(204);
  } });
  t.after(() => h.relay.stop());
  await h.relay.start();
  const oldChannel = h.relay.status().channelId;
  h.requests.length = 0;
  stallNextBatch = true;
  h.relay.publish("timer", { seconds: 3 });
  await pause(20);
  assert.ok(stalledRequest);
  await h.relay.rotateChannel();
  assert.equal(stalledRequest.signal.aborted, true);
  assert.notEqual(h.relay.status().channelId, oldChannel);
  assert.equal(h.relay.status().connected, true);
  const deletionIndex = h.requests.findIndex((entry) => entry.method === "DELETE");
  assert.ok(deletionIndex > 0);
  assert.ok(h.requests[deletionIndex].url.includes(`/${oldChannel}.json`));
  assert.ok(h.requests.slice(deletionIndex + 1).every((entry) => !entry.url.includes(`/${oldChannel}.json`)));
  assert.equal(h.relay.eventQueue.length, 0);
  assert.equal(h.relay.reconnectTimer, null);
});

test("relay: request timeout bounds a stalled response and preserves state for reconnect", async (t) => {
  let stallNextState = false;
  let stalledRequest;
  const h = harness({ requestTimeoutMs: 20, fetchPatch: async (request) => {
    if (stallNextState && request.body.state) {
      stallNextState = false;
      stalledRequest = request;
      // A dependency ignoring AbortSignal must not hold up the relay indefinitely.
      return new Promise(() => {});
    }
    return response(204);
  } });
  t.after(() => h.relay.stop());
  await h.relay.start();
  stallNextState = true;
  h.state.overlaySession.likeGoalCurrent = 27;
  h.relay.publishState();
  await pause();
  assert.ok(stalledRequest.signal.aborted);
  assert.equal(h.relay.status().status, "offline");
  assert.match(h.relay.status().lastError, /délai/);
  assert.ok(h.relay.pendingState);
  assert.equal(h.relay.requestControllers.size, 0);
});

test("relay: match alias rotation aborts its old in-flight write without interrupting root events", async (t) => {
  let stallNextAlias = false;
  let stalledRequest;
  const h = harness({ fetchPatch: async (request) => {
    if (stallNextAlias && request.body.matchSource) {
      stallNextAlias = false;
      stalledRequest = request;
      return new Promise((resolve, reject) => request.signal.addEventListener("abort",
        () => reject(request.signal.reason), { once: true }));
    }
    return response(204);
  } });
  t.after(() => h.relay.stop());
  await h.relay.start();
  const mainChannel = h.relay.status().channelId;
  const oldAlias = h.relay.status().matchChannelId;
  h.requests.length = 0;
  stallNextAlias = true;
  h.state.settings.account.uid = "new-account";
  h.relay.publishState();
  await pause(45);
  assert.ok(stalledRequest);
  await h.relay.rotateMatchChannel();
  assert.equal(stalledRequest.signal.aborted, true);
  assert.notEqual(h.relay.status().matchChannelId, oldAlias);
  assert.equal(h.relay.status().channelId, mainChannel);
  assert.equal(h.relay.status().connected, true);
  const deletionIndex = h.requests.findIndex((entry) => entry.method === "DELETE");
  assert.ok(deletionIndex > 0);
  assert.ok(h.requests.slice(deletionIndex + 1).every((entry) => !entry.url.includes(`/${oldAlias}.json`)));
  h.relay.publish("timer", { seconds: 5 });
  await pause();
  assert.ok(h.writes().at(-1).body.lastBatch);
  assert.equal(h.relay.eventQueue.length, 0);
});

test("relay: slow network coalesces pending flushes instead of building a timer/promise backlog", async (t) => {
  let release;
  let stallNextState = false;
  const gate = new Promise((resolve) => { release = resolve; });
  const h = harness({ fetchPatch: async (request) => {
    if (stallNextState && request.body.state && !request.body.lastBatch) {
      stallNextState = false;
      await gate;
    }
    return response(204);
  } });
  t.after(() => { release(); return h.relay.stop(); });
  await h.relay.start();
  h.requests.length = 0;
  stallNextState = true;
  h.state.overlaySession.likeGoalCurrent = 1;
  h.relay.publishState();
  await pause(45);
  const activeStateFlush = h.relay.stateFlushPromise;
  for (let index = 0; index < 100; index += 1) {
    h.state.overlaySession.likeGoalCurrent = index + 2;
    h.relay.publishState();
    h.relay.publish("timer", { index });
  }
  await pause(45);
  const pendingEventFlush = h.relay.eventFlushPromise;
  assert.ok(activeStateFlush && pendingEventFlush);
  h.relay.publish("timer", { index: 100 });
  h.relay.publishState();
  assert.equal(h.relay.stateFlushPromise, activeStateFlush);
  assert.equal(h.relay.eventFlushPromise, pendingEventFlush);
  assert.equal(h.relay.stateTimer, null);
  assert.equal(h.relay.eventTimer, null);
  assert.equal(h.writes().length, 1);
  release();
  await pause();
  assert.equal(h.writes().length, 2);
  assert.equal(h.writes().at(-1).body.state.overlaySession.likeGoalCurrent, 101);
  assert.equal(h.writes().at(-1).body.lastBatch.messages.length, 101);
  assert.equal(h.relay.eventQueue.length, 0);
});


test("relay: Minecraft round clocks publish scoped timestamps without session internals", async (t) => {
  const h = harness();
  t.after(() => h.relay.stop());
  h.state.commerce.subscription = { tier: "pro", status: "active", source: "paid" };
  const ids = ["minecraft-bedrock-box", "minecraft-sandbox-3"];
  h.state.game.roundSettingsByPack = Object.fromEntries(ids.map(id => [id, { durationMinutes: 17, autoRestart: true }]));
  h.state.game.interactionRulesByPack = Object.fromEntries(ids.map(id => [id, []]));
  h.state.session.game = {
    running: true, packId: ids[0], profileId: h.state.session.profileId,
    roundStatus: "running", roundEndsAt: new Date(Date.now() + 600000).toISOString(),
    serverPath: "private-server-path", token: "private-session-token"
  };
  await h.relay.start();
  const published = h.writes().find(request => request.body.state?.gamePacks).body.state;
  const clock = published.gamePacks.packs[ids[0]].wins.roundTimer;
  assert.equal(clock.status, "running");
  assert.equal(clock.endsAt, Date.parse(h.state.session.game.roundEndsAt));
  assert.equal(clock.durationSeconds, 17 * 60);
  assert.equal(published.gamePacks.packs[ids[1]].wins.roundTimer.status, "stopped");
  assert.doesNotMatch(JSON.stringify(published), /private-server-path|private-session-token/);
  h.requests.length = 0;
  h.state.session.game.roundEndsAt = null;
  h.state.session.game.roundStatus = "timeout";
  h.relay.publishState();
  await pause();
  assert.equal(h.writes().at(-1).body.state.gamePacks.packs[ids[0]].wins.roundTimer.status, "timeout");
});
