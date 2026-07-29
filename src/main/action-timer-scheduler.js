"use strict";

const { EventEmitter } = require("node:events");
const { renderValue } = require("./template");
const { safeString } = require("./utils");

const MIN_INTERVAL_MS = 1000;
const MAX_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

class ActionTimerScheduler extends EventEmitter {
  constructor({ store, actionRunner }) {
    super();
    this.store = store;
    this.actionRunner = actionRunner;
    this.schedules = new Map();
    this.interval = null;
  }

  start() {
    if (this.interval) return;
    this.interval = setInterval(() => {
      this.tick().catch((error) =>
        this.emit("error", { timer: null, error })
      );
    }, 500);
    this.interval.unref?.();
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.schedules.clear();
  }

  runtime() {
    return [...this.schedules.entries()].map(([key, entry]) => ({
      id: key.slice(key.indexOf(":") + 1),
      nextRunAt: new Date(entry.nextAt).toISOString(),
      running: Boolean(entry.running)
    }));
  }

  async tick(now = Date.now()) {
    const state = this.store.getState();
    const profileId = safeString(state.session?.profileId || "default", 160);
    const timers = Array.isArray(state.timers) ? state.timers : [];
    const activeKeys = new Set(
      timers
        .filter((timer) => timer.enabled !== false)
        .map((timer) => `${profileId}:${timer.id}`)
    );
    let runtimeChanged = false;

    for (const key of this.schedules.keys()) {
      if (!activeKeys.has(key)) {
        this.schedules.delete(key);
        runtimeChanged = true;
      }
    }

    const runs = [];
    for (const timer of timers) {
      if (timer.enabled === false) continue;
      const key = `${profileId}:${timer.id}`;
      const intervalMs = normalizeInterval(timer.intervalMs);
      const signature = JSON.stringify({
        updatedAt: timer.updatedAt || "",
        intervalMs,
        actionIds: normalizeActionIds(timer.actionIds),
        repeatCount: normalizeRepeatCount(timer.repeatCount),
        repeatDelayMs: normalizeRepeatDelay(timer.repeatDelayMs)
      });
      let entry = this.schedules.get(key);
      if (!entry || entry.signature !== signature) {
        entry = {
          signature,
          nextAt: now + intervalMs,
          running: false
        };
        this.schedules.set(key, entry);
        runtimeChanged = true;
        continue;
      }
      if (entry.running || now < entry.nextAt) continue;
      do {
        entry.nextAt += intervalMs;
      } while (entry.nextAt <= now);
      entry.running = true;
      runtimeChanged = true;
      const run = this.#execute(timer, state)
        .catch((error) => {
          this.emit("error", { timer, error });
          return null;
        })
        .finally(() => {
          entry.running = false;
          this.emit("runtime-changed", this.runtime());
        });
      runs.push(run);
    }
    if (runtimeChanged) this.emit("runtime-changed", this.runtime());
    await Promise.all(runs);
  }

  async run(timerId) {
    const state = this.store.getState();
    const timer = (state.timers || []).find(
      (item) => item.id === safeString(timerId, 160)
    );
    if (!timer) throw new Error("Timer introuvable.");
    return this.#execute(timer, state);
  }

  async #execute(timer, state) {
    const actionIds = normalizeActionIds(timer.actionIds);
    const actions = (state.rules || [])
      .flatMap((rule) => rule.actions || [])
      .filter((action) => actionIds.includes(action.id))
      .sort(
        (first, second) =>
          actionIds.indexOf(first.id) - actionIds.indexOf(second.id)
      );
    if (!actions.length) {
      throw new Error("Ce timer ne contient aucune action disponible.");
    }

    const repeatCount = normalizeRepeatCount(timer.repeatCount);
    const repeatDelayMs = normalizeRepeatDelay(timer.repeatDelayMs);
    const results = [];
    for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) {
      const event = createTimerEvent(timer, repeatIndex, repeatCount);
      const context = {
        ...event,
        event,
        timer,
        now: event.timestamp
      };
      for (const action of actions) {
        results.push(
          await this.actionRunner.run(
            {
              ...action,
              config: renderValue(action.config || {}, context)
            },
            context
          )
        );
      }
      if (repeatIndex + 1 < repeatCount && repeatDelayMs > 0) {
        await wait(repeatDelayMs);
      }
    }

    const lastRunAt = new Date().toISOString();
    this.store.mutate((nextState) => {
      const stored = (nextState.timers || []).find(
        (item) => item.id === timer.id
      );
      if (stored) stored.lastRunAt = lastRunAt;
    });
    const payload = {
      timerId: timer.id,
      timerName: timer.name,
      actionCount: actions.length,
      repeatCount,
      resultCount: results.length,
      lastRunAt
    };
    this.emit("fired", payload);
    return payload;
  }
}

function createTimerEvent(timer, repeatIndex, repeatCount) {
  return {
    id: `timer_${timer.id}_${Date.now()}_${repeatIndex + 1}`,
    type: "timer",
    source: "scheduler",
    timestamp: new Date().toISOString(),
    user: {
      id: "shenpulse-timer",
      name: "shenpulse",
      displayName: "Timer ShenPulse"
    },
    data: {
      timerId: timer.id,
      timerName: timer.name,
      repeatIndex: repeatIndex + 1,
      repeatCount
    }
  };
}

function normalizeInterval(value) {
  return Math.min(
    MAX_INTERVAL_MS,
    Math.max(MIN_INTERVAL_MS, Number(value) || 60000)
  );
}

function normalizeRepeatCount(value) {
  return Math.min(100, Math.max(1, Math.floor(Number(value) || 1)));
}

function normalizeRepeatDelay(value) {
  return Math.min(60000, Math.max(0, Number(value) || 0));
}

function normalizeActionIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))];
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

module.exports = {
  ActionTimerScheduler,
  normalizeInterval,
  normalizeRepeatCount,
  normalizeRepeatDelay
};
