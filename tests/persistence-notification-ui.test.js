"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("persistence failures warn without a modal, spam or raw filesystem error and confirm only recovery", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/renderer/app/core/events/runtime.js"), "utf8");
  const start = source.indexOf("let persistenceWarningShown = false;");
  const end = source.indexOf('api.on("song-requests-changed"', start);
  assert.ok(start >= 0 && end > start);
  const calls = [], listeners = {};
  vm.runInNewContext(source.slice(start, end), {
    api: { on: (channel, callback) => { listeners[channel] = callback; } },
    toast: (...args) => calls.push(args)
  });
  const notify = listeners["persistence-status"];
  notify(null); notify({ pending: "yes" }); notify({ pending: false });
  assert.equal(calls.length, 0);
  notify({ pending: true, errorCode: "EPERM", attempts: 0, retryScheduled: true,
    message: "sensitive filesystem path" });
  notify({ pending: true, attempts: 1 }); notify({ pending: true, retryScheduled: false, attempts: 3 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2], true);
  assert.doesNotMatch(JSON.stringify(calls), /sensitive|EPERM|undefined/);
  notify({ pending: false }); notify({ pending: false });
  assert.equal(calls.length, 2);
  assert.match(calls[1][0], /rétablie/);
  notify({ pending: true });
  assert.equal(calls.length, 3);
});

test("persistence notification is wired explicitly from the store to the allowed preload event", () => {
  const main = fs.readFileSync(path.join(__dirname, "../src/main/main.js"), "utf8");
  const preload = fs.readFileSync(path.join(__dirname, "../src/main/preload.js"), "utf8");
  assert.match(main, /onPersistenceStatus:\s*\(status\) => notifyRenderer\("persistence-status", status\)/);
  assert.match(preload, /"renderer-visibility",\s*"persistence-status"/);
});
