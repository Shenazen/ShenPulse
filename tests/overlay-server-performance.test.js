"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const path = require("node:path");
const { OverlayServer } = require("../src/main/overlay-server");
const { MatchSourceService } = require("../src/main/match-source-service");
const { matchAccountNumber } = require("../src/main/match-access");
const { selectStatePaths } = require("../src/main/state-projection");
const sceneLayout = require("../resources/overlays/scene-layout");

function fixture() {
  const state = {
    settings: {
      overlayPort: 17654, apiPort: 21213,
      overlayToken: "overlay-secret", apiToken: "api-secret",
      account: { uid: "projection-account", email: "private@example.invalid" },
      matchAccess: { accessKey: "a".repeat(32) },
      publicOverlayRelay: {
        publicBaseUrl: "https://shenpulse-overlays.web.app",
        matchChannelId: "m".repeat(24)
      },
      overlayScene: {
        ...sceneLayout.createDefaultScene(),
        widgets: [{ id: "likes", key: "likeGoal" }, { id: "wins", key: "winCounter" }]
      },
      overlayConfigs: { likeGoal: { title: "Projected LIVE" } }
    },
    commerce: { subscription: { tier: "pro", status: "active" } },
    session: { running: true }, overlaySession: { likes: 12 },
    goals: [{ id: "goal-1" }], statistics: { likes: 12 },
    profiles: [{ id: "large-workspace-must-not-be-read" }]
  };
  const reads = [];
  const store = {
    getState() { throw new Error("Full snapshot forbidden on overlay runtime paths"); },
    getStateProjection(paths) {
      reads.push([...paths]);
      return selectStatePaths(state, paths);
    }
  };
  return { state, store, reads };
}

function createServer(store, overrides = {}) {
  return new OverlayServer({
    store, staticDirectory: path.join(__dirname, "../resources/overlays"),
    onInboundEvent: async () => {}, onEffectRequest: async () => ({}),
    ...overrides
  });
}

function responseRecorder() {
  return {
    writes: [], ended: false, status: 0, headers: {},
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    write(value) { this.writes.push(value); },
    end(value = "") { this.ended = true; this.writes.push(value); }
  };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

test("LIVE publications without SSE clients perform no state reads and preserve delivery", () => {
  const { store, reads } = fixture();
  const relay = [];
  const sockets = [];
  const apiSockets = [];
  const server = createServer(store, {
    publicRelay: { publish: (...args) => relay.push(args) }
  });
  server.webSockets = { broadcast: (message) => sockets.push(message) };
  server.apiWebSockets = { broadcast: (message) => apiSockets.push(message) };
  server.publishEvent({ type: "gift", count: 1 });
  server.refreshAccess();
  assert.deepEqual(reads, []);
  assert.equal(sockets[0].channel, "event");
  assert.deepEqual(relay, [["event", { type: "gift", count: 1 }]]);
  assert.deepEqual(apiSockets, [{ event: "gift", data: { type: "gift", count: 1 } }]);
});

test("one access projection serves all scene clients and revocation preserves free widgets", () => {
  const { store, state, reads } = fixture();
  const server = createServer(store);
  const scenes = [responseRecorder(), responseRecorder()];
  for (const response of scenes) {
    server.sseClients.add({ response, view: "scene", sceneProAccess: true });
  }
  const paid = responseRecorder();
  server.sseClients.add({ response: paid, view: "win-counter" });

  server.publish("like-goal", { amount: 1 });
  assert.deepEqual(reads, [["commerce.subscription"]]);
  assert.ok(scenes.every((response) => /event: like-goal/.test(response.writes.join(""))));

  reads.length = 0;
  state.commerce.subscription.status = "revoked";
  server.publish("win-counter", { operation: "add", amount: 1 });
  assert.deepEqual(reads, [
    ["commerce.subscription"], ["settings.overlayScene", "commerce.subscription"]
  ]);
  for (const response of scenes) {
    const output = response.writes.join("");
    assert.match(output, /event: scene/);
    assert.match(output, /likeGoal/);
    assert.doesNotMatch(output, /winCounter/);
    assert.equal(response.ended, false);
  }
  assert.match(paid.writes.join(""), /subscription-required/);
  assert.equal(paid.ended, true);
  assert.equal(server.sseClients.size, 2);
});

test("overlay HTTP bootstrap uses projections while the authenticated local API retains its full contract", { timeout: 10000 }, async () => {
  const { store, state } = fixture();
  state.settings.overlayPort = await freePort();
  state.settings.apiPort = await freePort();
  const server = createServer(store);
  let fullReads = 0;
  try {
    const urls = await server.start();
    assert.match(urls.matchPlayer, /\/match\/\d{12}\/a{32}$/);
    const base = `http://127.0.0.1:${state.settings.overlayPort}`;
    const denied = await fetch(`${base}/api/state?token=wrong`);
    assert.equal(denied.status, 401);
    const response = await fetch(`${base}/api/state?token=overlay-secret`);
    assert.equal(response.status, 200);
    const bootstrap = await response.json();
    assert.deepEqual(bootstrap.session, state.session);
    assert.deepEqual(bootstrap.overlaySession, state.overlaySession);
    assert.equal(bootstrap.configurations.likeGoal.title, "Projected LIVE");
    assert.equal(bootstrap.overlayScene.proAccess, true);
    assert.equal(bootstrap.profiles, undefined);
    assert.doesNotMatch(JSON.stringify(bootstrap), /secret|private@example/);

    const matchResponse = await fetch(`${urls.matchPlayer}/state`);
    assert.equal(matchResponse.status, 200);
    assert.deepEqual(await matchResponse.json(), {
      session: state.session, overlaySession: state.overlaySession
    });

    store.getState = () => { fullReads += 1; return structuredClone(state); };
    const apiBase = `http://127.0.0.1:${state.settings.apiPort}`;
    const deniedApi = await fetch(`${apiBase}/api/state?token=wrong`);
    assert.equal(deniedApi.status, 401);
    assert.equal(fullReads, 0);
    const fullResponse = await fetch(`${apiBase}/api/state?token=api-secret`);
    assert.equal(fullResponse.status, 200);
    assert.deepEqual(await fullResponse.json(), state);
    assert.equal(fullReads, 1);
  } finally {
    await server.stop();
  }
});

test("Match permissions, state and bridge origin remain intact without full snapshots", () => {
  const { store, state, reads } = fixture();
  const service = new MatchSourceService({
    store, staticDirectory: "unused", hasAccess: () => true,
    normalizePlayback: () => ({ match: "x2", variant: "tikcontrol" })
  });
  const accountNumber = matchAccountNumber(state.settings.account.uid);
  const credentials = { accountNumber, accessKey: state.settings.matchAccess.accessKey };
  assert.match(service.sourceUrl("http://127.0.0.1:17654"), /\/match\/\d{12}\/a{32}$/);
  assert.equal(service.isAuthorized(credentials), true);
  assert.equal(service.isAuthorized({ ...credentials, accessKey: "wrong" }), false);
  assert.equal(service.isAuthorized({ ...credentials, accountNumber: "000000000000" }), false);
  const bridge = { accountNumber, channelId: state.settings.publicOverlayRelay.matchChannelId, resource: "ticket" };
  assert.equal(service.isBridgeAuthorized(bridge), true);
  assert.equal(service.isBridgeAuthorized({ ...bridge, channelId: "wrong" }), false);

  const response = responseRecorder();
  service.handleBridgeRequest({ credentials: bridge,
    url: new URL("http://127.0.0.1/ticket"),
    request: { method: "OPTIONS", headers: { origin: "https://shenpulse-overlays.web.app" } }, response });
  assert.equal(response.status, 204);
  assert.equal(response.headers["Access-Control-Allow-Origin"], "https://shenpulse-overlays.web.app");
  const refused = responseRecorder();
  service.handleBridgeRequest({ credentials: bridge,
    url: new URL("http://127.0.0.1/ticket"),
    request: { method: "OPTIONS", headers: { origin: "https://untrusted.example" } }, response: refused });
  assert.equal(refused.status, 403);
  assert.ok(reads.every((paths) => paths.every((key) => key.startsWith("settings."))));
});
