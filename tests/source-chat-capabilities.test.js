"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { SourceHub } = require("../src/main/source-hub");

test("Kick ne déclare pas prêt un envoi révoqué ou une permission connue manquante", () => {
  const state = { connections: [{ id: "kick", type: "kick-native", enabled: true, status: "connected" }] };
  let status = { connected: true, scopes: [] };
  const kickService = Object.assign(new EventEmitter(), { status: () => status });
  const hub = new SourceHub({ store: { getState: () => state }, kickService });
  hub.runtimes.set("kick", { closed: false, send: () => {} });
  assert.equal(hub.getChatCapabilities("kick").canSend, true); // Ancienne portée inconnue.
  status = { connected: true, scopes: [], scopesKnown: true };
  assert.equal(hub.getChatCapabilities("kick").canSend, false);
  assert.equal(hub.getChatCapabilities("kick").reason, "kick-scope-missing");
  status = { connected: true, scopes: ["chat:write"], scopesKnown: true };
  assert.equal(hub.getChatCapabilities("kick").canSend, true);
  status.connected = false;
  assert.equal(hub.getChatCapabilities("kick").canSend, false);
  status.connected = true;
  state.connections[0].enabled = false;
  assert.equal(hub.getChatCapabilities("kick").canSend, false);
});
