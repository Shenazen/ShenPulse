"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createDefaultState } = require("../src/main/defaults");
const { PublicOverlayRelay } = require("../src/main/public-overlay-relay");

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

function createStore() {
  const state = createDefaultState();
  const secrets = new Map();
  return {
    getState: () => state,
    mutate(callback) {
      callback(state);
    },
    setSecret(secretId, value) {
      const id = secretId || `secret-${secrets.size + 1}`;
      secrets.set(id, String(value));
      return id;
    },
    getSecret(secretId) {
      return secrets.get(secretId) || "";
    }
  };
}

test("PublicOverlayRelay authentifie l'installation puis publie état et lots", async () => {
  const store = createStore();
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({
      url: String(url),
      method: options.method,
      body: options.body ? String(options.body) : ""
    });
    if (String(url).includes("accounts:signUp")) {
      return response(200, {
        idToken: "id-token",
        refreshToken: "refresh-token",
        expiresIn: "3600",
        localId: "uid-installation"
      });
    }
    return response(200, {});
  };
  const relay = new PublicOverlayRelay({
    store,
    fetchImpl,
    appVersion: "1.2.3"
  });

  await relay.start();
  assert.equal(relay.status().connected, true);
  assert.equal(
    store.getState().settings.publicOverlayRelay.uid,
    "uid-installation"
  );
  assert.match(relay.urls().timer, /^https:\/\/shenpulse-overlays\.web\.app/);

  store.mutate((state) => {
    Object.assign(state.settings.overlayConfigs.likeGoal, {
      theme: "naruto",
      title: "PING-PONG",
      target: 2500,
      likeGoalContentOffsetY: -25,
      likeGoalContentScale: 200
    });
  });

  relay.publish("timer", {
    operation: "set",
    seconds: 10,
    url: "http://127.0.0.1:17654/overlay/media/sounds/click.ogg?token=x"
  });
  relay.publish("configuration", {
    overlayKey: "likeGoal",
    config: { theme: "naruto", title: "PING-PONG", target: "2500" }
  });
  await new Promise((resolve) => setTimeout(resolve, 90));

  const writes = requests.filter(
    (entry) =>
      entry.method === "PATCH" &&
      entry.url.includes("/publicOverlayRelay/")
  );
  assert.ok(writes.length >= 2);
  const batch = writes
    .map((entry) => JSON.parse(entry.body))
    .find((entry) => entry.lastBatch);
  assert.equal(batch.lastBatch.messages[0].channel, "timer");
  assert.match(
    batch.lastBatch.messages[0].payload.url,
    /^https:\/\/shenpulse-overlays\.web\.app\/media\//
  );
  assert.doesNotMatch(JSON.stringify(batch), /token=x/);
  assert.equal(batch.configurations.likeGoal.theme, "naruto");
  assert.equal(batch.configurations.likeGoal.title, "PING-PONG");
  assert.equal(batch.configurations.likeGoal.target, 2500);
  assert.equal(batch.configurations.likeGoal.contentY, -25);
  assert.equal(batch.configurations.likeGoal.contentScale, 200);

  await relay.stop();
  assert.equal(relay.status().status, "stopped");
});

test("PublicOverlayRelay conserve une URL stable et sait la régénérer", async () => {
  const store = createStore();
  const fetchImpl = async (url) => {
    if (String(url).includes("accounts:signUp")) {
      return response(200, {
        idToken: "id-token",
        refreshToken: "refresh-token",
        expiresIn: "3600",
        localId: "uid-installation"
      });
    }
    return response(200, {});
  };
  const relay = new PublicOverlayRelay({ store, fetchImpl });
  const previous = relay.urls().alerts;
  await relay.start();
  await relay.rotateChannel();
  assert.notEqual(relay.urls().alerts, previous);
  assert.equal(relay.status().connected, true);
  await relay.stop();
});
