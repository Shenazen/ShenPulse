"use strict";

const { renderValue } = require("./template");
const { safeString } = require("./utils");

class OverlayCompletionController {
  constructor({
    store,
    actionRunner,
    overlayServer,
    onFired = () => {},
    onError = () => {},
    now = () => Date.now(),
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout
  }) {
    this.store = store;
    this.actionRunner = actionRunner;
    this.overlayServer = overlayServer;
    this.onFired = onFired;
    this.onError = onError;
    this.now = now;
    this.setTimeoutImpl = setTimeoutImpl;
    this.clearTimeoutImpl = clearTimeoutImpl;
    this.timerHandle = null;
    this.timerEndsAt = 0;
  }

  async initialize() {
    const runtime = this.store.getState().overlaySession || {};
    const endsAt = Math.max(0, Number(runtime.timerEndsAt || 0));
    if (
      endsAt > this.now() &&
      runtime.timerPaused !== true
    ) {
      this.#scheduleTimerCompletion(endsAt);
      return;
    }
    if (endsAt > 0) this.#clearExpiredTimer(endsAt);
    await this.startConfiguredTimer("application-start");
  }

  stop() {
    if (this.timerHandle) this.clearTimeoutImpl(this.timerHandle);
    this.timerHandle = null;
    this.timerEndsAt = 0;
  }

  handleOperation({
    channel,
    context = {},
    originActionId = "",
    payload = {},
    previous = {},
    runtime = {}
  }) {
    if (channel === "like-goal") {
      return this.handleLikeGoalChange(
        Number(previous.likeGoalCurrent || 0),
        Number(runtime.likeGoalCurrent || 0),
        context,
        originActionId
      );
    }
    if (channel === "timer") {
      if (payload.operation === "reset") {
        this.stop();
        return Promise.resolve(false);
      }
      const previousRemaining = timerRemainingAt(previous, this.now());
      const currentRemaining = timerRemainingAt(runtime, this.now());
      if (
        payload.operation === "add" &&
        previousRemaining > 0 &&
        currentRemaining <= 0
      ) {
        this.stop();
        return this.#runConfiguredAction(
          "timer",
          context,
          originActionId,
          { remainingSeconds: 0 }
        );
      }
      this.#synchronizeTimer(runtime);
    }
    return Promise.resolve(false);
  }

  async handleLikeGoalChange(
    previousCurrent,
    current,
    context = {},
    originActionId = ""
  ) {
    const config =
      this.store.getState().settings?.overlayConfigs?.likeGoal || {};
    if (!likeGoalThresholdCrossed(previousCurrent, current, config)) {
      return false;
    }
    return this.#runConfiguredAction(
      "likeGoal",
      context,
      originActionId,
      {
        current: Math.max(0, Number(current) || 0),
        previousCurrent: Math.max(0, Number(previousCurrent) || 0),
        target: Math.max(1, Number(config.target) || 1)
      }
    );
  }

  async startConfiguredTimer(reason = "manual") {
    const config =
      this.store.getState().settings?.overlayConfigs?.timer || {};
    if (
      config.timerAutoStart !== true ||
      Math.max(0, Number(config.seconds || 0)) <= 0
    ) {
      this.#synchronizeTimer(this.store.getState().overlaySession || {});
      return false;
    }
    await this.actionRunner.run(
      {
        id: `overlay_timer_auto_${reason}`,
        type: "timer.add",
        config: {
          operation: "set",
          seconds: Math.max(0, Number(config.seconds || 0)),
          label: safeString(config.title || "Temps restant", 100)
        }
      },
      completionContext("timer", { reason })
    );
    return true;
  }

  async settingsChanged(previousSettings = {}, nextSettings = {}) {
    const previous =
      previousSettings.overlayConfigs?.timer || {};
    const next = nextSettings.overlayConfigs?.timer || {};
    const shouldRestart =
      next.timerAutoStart === true &&
      (
        previous.timerAutoStart !== true ||
        Number(previous.seconds || 0) !== Number(next.seconds || 0)
      );
    if (shouldRestart) {
      return this.startConfiguredTimer("settings-change");
    }
    this.#synchronizeTimer(this.store.getState().overlaySession || {});
    return false;
  }

  async checkTimerCompletion(expectedEndsAt = this.timerEndsAt) {
    const runtime = this.store.getState().overlaySession || {};
    const actualEndsAt = Math.max(0, Number(runtime.timerEndsAt || 0));
    if (
      !expectedEndsAt ||
      actualEndsAt !== Number(expectedEndsAt) ||
      runtime.timerPaused === true
    ) {
      return false;
    }
    if (actualEndsAt > this.now()) {
      this.#scheduleTimerCompletion(actualEndsAt);
      return false;
    }

    this.stop();
    this.#clearExpiredTimer(actualEndsAt);
    const nextRuntime = this.store.getState().overlaySession || {};
    this.overlayServer.publish("timer", {
      operation: "set",
      seconds: 0,
      remainingSeconds: 0,
      endsAt: 0,
      paused: false,
      label: nextRuntime.timerLabel || "Temps restant"
    });
    return this.#runConfiguredAction(
      "timer",
      completionContext("timer", { endsAt: actualEndsAt }),
      "",
      { endsAt: actualEndsAt, remainingSeconds: 0 }
    );
  }

  #synchronizeTimer(runtime = {}) {
    const endsAt = Math.max(0, Number(runtime.timerEndsAt || 0));
    if (
      runtime.timerPaused === true ||
      endsAt <= this.now()
    ) {
      this.stop();
      return;
    }
    this.#scheduleTimerCompletion(endsAt);
  }

  #scheduleTimerCompletion(endsAt) {
    if (this.timerHandle) this.clearTimeoutImpl(this.timerHandle);
    this.timerEndsAt = endsAt;
    const delay = Math.max(0, endsAt - this.now());
    this.timerHandle = this.setTimeoutImpl(() => {
      this.timerHandle = null;
      this.checkTimerCompletion(endsAt).catch((error) =>
        this.onError({ error, kind: "timer" })
      );
    }, delay);
    this.timerHandle?.unref?.();
  }

  #clearExpiredTimer(expectedEndsAt) {
    const update = (state) => {
      const runtime = state.overlaySession || {};
      if (Number(runtime.timerEndsAt || 0) !== Number(expectedEndsAt)) return;
      runtime.timerSeconds = 0;
      runtime.timerEndsAt = 0;
      runtime.timerPaused = false;
      runtime.updatedAt = new Date(this.now()).toISOString();
    };
    if (typeof this.store.mutateRuntime === "function") {
      this.store.mutateRuntime(update);
    } else {
      const state = this.store.getState?.();
      if (state && typeof state === "object") update(state);
    }
  }

  async #runConfiguredAction(
    kind,
    context,
    originActionId,
    completion
  ) {
    const state = this.store.getState();
    const config = state.settings?.overlayConfigs?.[kind] || {};
    const actionId = safeString(config.completionActionId, 160);
    if (!actionId || actionId === originActionId) return false;
    const action = (state.rules || [])
      .flatMap((rule) => rule.actions || [])
      .find((candidate) => candidate.id === actionId);
    if (!action) {
      this.onError({
        error: new Error(
          "L’action sélectionnée n’existe plus dans le profil actif."
        ),
        kind
      });
      return false;
    }

    const resolvedContext = {
      ...completionContext(kind, completion),
      ...context,
      completion: {
        kind,
        ...completion
      },
      event: context.event || context
    };
    try {
      await this.actionRunner.run(
        {
          ...action,
          config: renderValue(action.config || {}, resolvedContext)
        },
        resolvedContext
      );
      this.onFired({ action, completion, kind });
      return true;
    } catch (error) {
      this.onError({ action, error, kind });
      return false;
    }
  }
}

function likeGoalThresholdCrossed(previousValue, currentValue, config = {}) {
  const previous = Math.max(0, Number(previousValue) || 0);
  const current = Math.max(0, Number(currentValue) || 0);
  const initialTarget = Math.max(1, Number(config.target) || 1);
  if (current <= previous) return false;

  const behavior = String(config.whenReached || "increase");
  if (["keep", "hide"].includes(behavior)) {
    return previous < initialTarget && current >= initialTarget;
  }
  if (behavior === "double") {
    let threshold = initialTarget;
    while (threshold <= previous && threshold < Number.MAX_SAFE_INTEGER) {
      threshold = Math.min(Number.MAX_SAFE_INTEGER, threshold * 2);
    }
    return previous < threshold && current >= threshold;
  }
  const threshold =
    (Math.floor(previous / initialTarget) + 1) * initialTarget;
  return current >= threshold;
}

function completionContext(kind, data = {}) {
  const timestamp = new Date().toISOString();
  return {
    id: `overlay_completion_${kind}_${Date.now()}`,
    type: "overlay-completion",
    source: "overlay-completion",
    timestamp,
    now: timestamp,
    data,
    user: {
      id: "shenpulse",
      name: "shenpulse",
      displayName: "ShenPulse"
    }
  };
}

function timerRemainingAt(runtime = {}, nowMs = Date.now()) {
  if (runtime.timerPaused === true || !Number(runtime.timerEndsAt || 0)) {
    return Math.max(0, Number(runtime.timerSeconds || 0));
  }
  return Math.max(
    0,
    Math.ceil((Number(runtime.timerEndsAt || 0) - nowMs) / 1000)
  );
}

module.exports = {
  OverlayCompletionController,
  likeGoalThresholdCrossed,
  timerRemainingAt
};
