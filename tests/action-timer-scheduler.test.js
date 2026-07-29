"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ActionTimerScheduler
} = require("../src/main/action-timer-scheduler");

function createState() {
  return {
    session: { profileId: "profile_test" },
    timers: [
      {
        id: "timer_test",
        name: "Cycle test",
        enabled: true,
        intervalMs: 1000,
        repeatCount: 3,
        repeatDelayMs: 0,
        actionIds: ["action_one", "action_two"]
      }
    ],
    rules: [
      {
        id: "rule_actions",
        actions: [
          { id: "action_one", type: "test", config: { order: 1 } },
          { id: "action_two", type: "test", config: { order: 2 } }
        ]
      }
    ]
  };
}

function createStore(state) {
  return {
    getState() {
      return structuredClone(state);
    },
    mutate(mutator) {
      mutator(state);
      return structuredClone(state);
    }
  };
}

test("un timer exécute plusieurs actions plusieurs fois à la suite", async () => {
  const state = createState();
  const calls = [];
  const scheduler = new ActionTimerScheduler({
    store: createStore(state),
    actionRunner: {
      async run(action, context) {
        calls.push([action.id, context.data.repeatIndex]);
        return action.id;
      }
    }
  });

  const result = await scheduler.run("timer_test");
  assert.deepEqual(calls, [
    ["action_one", 1],
    ["action_two", 1],
    ["action_one", 2],
    ["action_two", 2],
    ["action_one", 3],
    ["action_two", 3]
  ]);
  assert.equal(result.actionCount, 2);
  assert.equal(result.repeatCount, 3);
  assert.equal(result.resultCount, 6);
  assert.ok(state.timers[0].lastRunAt);
});

test("le planificateur arme puis déclenche le timer à l'intervalle prévu", async () => {
  const state = createState();
  state.timers[0].repeatCount = 1;
  const calls = [];
  const scheduler = new ActionTimerScheduler({
    store: createStore(state),
    actionRunner: {
      async run(action) {
        calls.push(action.id);
      }
    }
  });

  await scheduler.tick(10000);
  assert.deepEqual(calls, []);
  assert.equal(scheduler.runtime()[0].nextRunAt, new Date(11000).toISOString());

  await scheduler.tick(11000);
  assert.deepEqual(calls, ["action_one", "action_two"]);
  assert.equal(scheduler.runtime()[0].nextRunAt, new Date(12000).toISOString());
});
