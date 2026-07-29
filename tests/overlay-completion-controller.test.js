const test = require("node:test");
const assert = require("node:assert/strict");

const {
  OverlayCompletionController,
  likeGoalThresholdCrossed,
  timerRemainingAt,
} = require("../src/main/overlay-completion-controller");

function createHarness({
  likeGoal = {},
  timer = {},
  overlaySession = {},
  now = 1_000,
} = {}) {
  const state = {
    settings: {
      overlayConfigs: {
        likeGoal: {
          target: 100,
          whenReached: "increase",
          completionActionId: "completion-action",
          ...likeGoal,
        },
        timer: {
          seconds: 30,
          completionActionId: "completion-action",
          ...timer,
        },
      },
    },
    rules: [
      {
        id: "rule-1",
        name: "Animations",
        actions: [
          {
            id: "completion-action",
            type: "overlay.media",
            config: { title: "Objectif atteint" },
          },
        ],
      },
    ],
    overlaySession: {
      likeGoalCurrent: 0,
      timerSeconds: 0,
      timerEndsAt: 0,
      timerPaused: true,
      ...overlaySession,
    },
  };
  const runs = [];
  const publications = [];
  const timers = [];
  const clearedTimers = [];
  let currentTime = now;

  const controller = new OverlayCompletionController({
    store: {
      getState: () => state,
      mutateRuntime: (mutator) => mutator(state),
    },
    actionRunner: {
      run: async (action, context) => {
        runs.push({ action, context });
        return true;
      },
    },
    overlayServer: {
      publish: (channel, payload) => publications.push({ channel, payload }),
    },
    now: () => currentTime,
    setTimeoutImpl: (callback, delay) => {
      const handle = {
        callback,
        delay,
        unref() {},
      };
      timers.push(handle);
      return handle;
    },
    clearTimeoutImpl: (handle) => clearedTimers.push(handle),
  });

  return {
    controller,
    state,
    runs,
    publications,
    timers,
    clearedTimers,
    setNow: (value) => {
      currentTime = value;
    },
  };
}

test("likeGoalThresholdCrossed respects every completion behavior", () => {
  const config = (whenReached) => ({ target: 100, whenReached });
  assert.equal(likeGoalThresholdCrossed(99, 100, config("keep")), true);
  assert.equal(likeGoalThresholdCrossed(100, 101, config("keep")), false);
  assert.equal(likeGoalThresholdCrossed(99, 100, config("hide")), true);

  assert.equal(likeGoalThresholdCrossed(199, 200, config("increase")), true);
  assert.equal(likeGoalThresholdCrossed(200, 250, config("increase")), false);
  assert.equal(likeGoalThresholdCrossed(250, 301, config("increase")), true);

  assert.equal(likeGoalThresholdCrossed(199, 200, config("double")), true);
  assert.equal(likeGoalThresholdCrossed(200, 399, config("double")), false);
  assert.equal(likeGoalThresholdCrossed(399, 400, config("double")), true);
  assert.equal(likeGoalThresholdCrossed(120, 80, config("increase")), false);
});

test("like goal completion runs the selected existing action once", async () => {
  const harness = createHarness();

  const ran = await harness.controller.handleLikeGoalChange(
    99,
    100,
    { username: "viewer" },
  );
  const repeated = await harness.controller.handleLikeGoalChange(100, 110);

  assert.equal(ran, true);
  assert.equal(repeated, false);
  assert.equal(harness.runs.length, 1);
  assert.equal(harness.runs[0].action.id, "completion-action");
  assert.equal(harness.runs[0].context.username, "viewer");
  assert.equal(harness.runs[0].context.completion.kind, "likeGoal");
});

test("like goal completion prevents direct recursion through its selected action", async () => {
  const harness = createHarness();

  const ran = await harness.controller.handleLikeGoalChange(
    99,
    100,
    {},
    "completion-action",
  );

  assert.equal(ran, false);
  assert.equal(harness.runs.length, 0);
});

test("timerRemainingAt reads the persisted deadline", () => {
  assert.equal(
    timerRemainingAt(
      { timerSeconds: 10, timerEndsAt: 11_000, timerPaused: false },
      1_000,
    ),
    10,
  );
  assert.equal(
    timerRemainingAt(
      { timerSeconds: 10, timerEndsAt: 500, timerPaused: false },
      1_000,
    ),
    0,
  );
  assert.equal(
    timerRemainingAt(
      { timerSeconds: 7, timerEndsAt: 11_000, timerPaused: true },
      1_000,
    ),
    7,
  );
});

test("standard timer schedules and runs the selected action at zero", async () => {
  const harness = createHarness({
    overlaySession: {
      timerSeconds: 10,
      timerEndsAt: 11_000,
      timerPaused: false,
    },
  });

  await harness.controller.handleOperation({
    channel: "timer",
    payload: { operation: "set" },
    runtime: harness.state.overlaySession,
  });

  assert.equal(harness.timers.length, 1);
  assert.equal(harness.timers[0].delay, 10_000);

  harness.setNow(11_000);
  const ran = await harness.controller.checkTimerCompletion(11_000);

  assert.equal(ran, true);
  assert.equal(harness.state.overlaySession.timerSeconds, 0);
  assert.equal(harness.state.overlaySession.timerEndsAt, 0);
  assert.equal(harness.state.overlaySession.timerPaused, false);
  assert.equal(harness.runs.length, 1);
  assert.equal(harness.runs[0].context.completion.kind, "timer");
  assert.equal(harness.publications.at(-1).channel, "timer");
  assert.equal(harness.publications.at(-1).payload.operation, "set");
  assert.equal(harness.publications.at(-1).payload.seconds, 0);
});

test("timer reset cancels completion scheduling", async () => {
  const harness = createHarness({
    overlaySession: {
      timerSeconds: 10,
      timerEndsAt: 11_000,
      timerPaused: false,
    },
  });

  await harness.controller.handleOperation({
    channel: "timer",
    payload: { operation: "set" },
    runtime: harness.state.overlaySession,
  });
  await harness.controller.handleOperation({
    channel: "timer",
    payload: { operation: "reset" },
    runtime: {
      timerSeconds: 0,
      timerEndsAt: 0,
      timerPaused: true,
    },
  });

  assert.equal(harness.clearedTimers.length, 1);
  assert.equal(harness.runs.length, 0);
});

test("timer action also fires when a timer adjustment reaches zero immediately", async () => {
  const harness = createHarness({
    overlaySession: {
      timerSeconds: 0,
      timerEndsAt: 0,
      timerPaused: true,
    },
  });

  await harness.controller.handleOperation({
    channel: "timer",
    payload: { operation: "add", seconds: -10 },
    previous: {
      timerSeconds: 10,
      timerEndsAt: 11_000,
      timerPaused: false,
    },
    runtime: harness.state.overlaySession,
  });

  assert.equal(harness.runs.length, 1);
  assert.equal(harness.runs[0].context.completion.kind, "timer");
});
