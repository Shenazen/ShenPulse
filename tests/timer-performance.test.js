"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ActionTimerScheduler } = require("../src/main/action-timer-scheduler");

test("scheduler polls only timers and profile, reading rules only when firing", async () => {
  const projections = [];
  const calls = [];
  const state = { session: { profileId: "profile" }, timers: [{ id: "timer", intervalMs: 1000,
    actionIds: ["action"], enabled: true }], rules: [{ actions: [{ id: "action", type: "test", config: {} }] }] };
  const store = {
    getState() { throw new Error("A full snapshot must not be taken."); },
    getStateProjection(paths) {
      projections.push(paths);
      return structuredClone(paths.includes("rules") ? { rules: state.rules } : { session: state.session, timers: state.timers });
    },
    mutateRuntime(mutator) { mutator(state); },
    mutate() { throw new Error("A timer runtime timestamp must not save configuration."); }
  };
  const scheduler = new ActionTimerScheduler({ store, actionRunner: { async run(action) { calls.push(action.id); } } });
  await scheduler.tick(10000);
  await scheduler.tick(10500);
  assert.deepEqual(projections, [["session.profileId", "timers"], ["session.profileId", "timers"]]);
  await scheduler.tick(11000);
  assert.deepEqual(projections.at(-1), ["rules"]);
  assert.deepEqual(calls, ["action"]);
  assert.ok(state.timers[0].lastRunAt);
});

test("manual timer execution requests only its timer and rules", async () => {
  const pathsRead = [];
  const state = { timers: [{ id: "timer", actionIds: ["action"] }], rules: [{ actions: [{ id: "action", type: "test" }] }] };
  const scheduler = new ActionTimerScheduler({ store: {
    getStateProjection(paths) { pathsRead.push(paths); return structuredClone(state); },
    mutateRuntime(mutator) { mutator(state); }
  }, actionRunner: { async run() {} } });
  await scheduler.run("timer");
  assert.deepEqual(pathsRead, [["timers"], ["rules"]]);
});
