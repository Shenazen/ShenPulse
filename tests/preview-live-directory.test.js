"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const vm = require("node:vm");
const { createPreviewLiveDirectory } = require("../scripts/preview/live-directory");
const { bridgeSource } = require("../scripts/preview/browser-bridge");

test("l’aperçu transmet le vrai statut et les changements de l’annuaire, sans données de publication", async () => {
  const service = new EventEmitter();
  let status = { available: true, connected: true, rows: [], capped: false, error: "", publishing: true, enabled: true };
  service.status = () => status;
  service.start = () => {};
  service.stop = async () => {};
  const directory = createPreviewLiveDirectory({ service });
  const request = new EventEmitter();
  const writes = [];
  const response = { writeHead(code, headers) { assert.equal(code, 200); assert.equal(headers["Content-Type"], "text/event-stream"); },
    write: value => writes.push(value), end() {}, writableLength: 0 };
  directory.connect(request, response);
  assert.match(writes[0], /live-directory-status/);
  assert.doesNotMatch(writes[0], /publishing|enabled/);
  const row = { id: "public_creator", platform: "TikTok", username: "public_creator", viewers: 12 };
  status = { ...status, rows: [row] };
  service.emit("changed");
  assert.deepEqual(directory.status().rows, [row]);
  assert.match(writes[1], /public_creator/);
  request.emit("close");
  service.emit("changed");
  assert.equal(writes.length, 2, "Un onglet fermé ne reste pas abonné.");
  await directory.stop();
});

test("le pont navigateur reçoit les présences en direct et ferme son abonnement", () => {
  const feeds = [];
  class Feed {
    constructor(url) { this.url = url; this.listeners = new Map(); feeds.push(this); }
    addEventListener(channel, callback) { this.listeners.set(channel, callback); }
    close() { this.closed = true; }
  }
  const window = {};
  vm.runInNewContext(bridgeSource(), { window, document: { documentElement: { dataset: {} } }, EventSource: Feed });
  window.shenPulse.on("unrelated-event", () => {});
  assert.equal(feeds.length, 0);
  const received = [];
  const unsubscribe = window.shenPulse.on("live-directory-status", value => received.push(value));
  assert.equal(feeds[0].url, "/__codex-preview-api/live-directory/events");
  const update = feeds[0].listeners.get("live-directory-status");
  update({ data: JSON.stringify({ available: true, connected: true, rows: [{ username: "public_creator" }] }) });
  assert.equal(received[0].rows[0].username, "public_creator");
  update({ data: "invalid" });
  assert.equal(received.length, 1);
  unsubscribe();
  assert.equal(feeds[0].closed, true);
});
