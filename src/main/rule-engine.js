"use strict";

const { EventEmitter } = require("node:events");
const { getPath, id } = require("./utils");
const { renderValue } = require("./template");

class RuleEngine extends EventEmitter {
  constructor({ store, actionRunner }) {
    super();
    this.store = store;
    this.actionRunner = actionRunner;
    this.cooldowns = new Map();
    this.thresholds = new Map();
    this.queue = [];
    this.processing = false;
    this.activeJobs = 0;
    this.maxConcurrentJobs = 8;
  }

  resetProfileState() {
    this.cooldowns.clear();
    this.thresholds.clear();
    for (const job of this.queue.splice(0)) job.resolveCompletion();
  }

  async process(event) {
    const state = this.store.getState();
    const profile = state.profiles.find((item) => item.id === state.session.profileId);
    const enabledIds = new Set(profile?.enabledRuleIds || state.rules.map((rule) => rule.id));
    const globalRules = state.rules.filter(
      (rule) => rule.enabled && enabledIds.has(rule.id)
    );
    const gameRules = activeGameInteractionRules(state).filter(
      (rule) => rule.enabled
    );
    const matchingRules = [...globalRules, ...gameRules]
      .filter((rule) => this.#matches(rule, event))
      .sort((first, second) => Number(second.priority || 0) - Number(first.priority || 0));

    const completions = [];
    for (const rule of matchingRules) {
      const executionCount = this.#thresholdExecutionCount(rule, event);
      if (executionCount <= 0) continue;
      if (this.#onCooldown(rule, event)) continue;
      this.#consumeThreshold(rule, event, executionCount);
      let acceptedExecutionCount = 0;
      for (let index = 0; index < executionCount; index += 1) {
        if (Math.random() <= Number(rule.chance ?? 1)) {
          acceptedExecutionCount += 1;
        }
      }
      if (!acceptedExecutionCount) continue;
      this.#startCooldown(rule, event);
      completions.push(
        this.#enqueue(
          rule,
          event,
          Number(rule.priority || 0),
          "job",
          {
            executionCount: acceptedExecutionCount,
            giftUnitCount: Math.max(
              1,
              Number(rule.trigger?.threshold || 1)
            )
          }
        )
      );
    }
    this.queue.sort((first, second) => second.priority - first.priority);
    this.#pump();
    await Promise.all(completions);
  }

  async test(ruleId, event) {
    const rule = this.store.getState().rules.find((item) => item.id === ruleId);
    if (!rule) throw new Error("Règle introuvable.");
    const completion = this.#enqueue(
      rule,
      { ...event, test: true },
      999,
      "test"
    );
    this.queue.sort((first, second) => second.priority - first.priority);
    this.#pump();
    await completion;
  }

  #matches(rule, event) {
    const trigger = rule.trigger || {};
    if (trigger.enabled === false) return false;
    if (trigger.type !== "*" && trigger.type !== event.type) return false;
    return (rule.conditions || []).every((condition) => {
      const left = getPath(event, condition.field);
      const right = condition.value;
      switch (condition.operator) {
        case "equals":
          return String(left).toLowerCase() === String(right).toLowerCase();
        case "notEquals":
          return String(left).toLowerCase() !== String(right).toLowerCase();
        case "contains":
          return String(left).toLowerCase().includes(String(right).toLowerCase());
        case "startsWith":
          return String(left).toLowerCase().startsWith(String(right).toLowerCase());
        case "greaterOrEqual":
          return Number(left) >= Number(right);
        case "lessOrEqual":
          return Number(left) <= Number(right);
        case "matches":
          try {
            return new RegExp(String(right), "i").test(String(left));
          } catch {
            return false;
          }
        case "truthy":
          return Boolean(left);
        default:
          return true;
      }
    });
  }

  #thresholdExecutionCount(rule, event) {
    const threshold = Math.max(1, Number(rule.trigger?.threshold || 1));
    if (threshold <= 1) {
      return event.type === "gift" || event.type === "like"
        ? interactionEventCount(event)
        : 1;
    }
    const key = this.#thresholdKey(rule, event);
    const increment =
      event.type === "like" || event.type === "gift"
        ? Number(event.data?.count || 1)
        : 1;
    const accumulated = (this.thresholds.get(key) || 0) + increment;
    this.thresholds.set(key, accumulated);
    if (event.type === "gift" || event.type === "like") {
      return Math.floor(accumulated / threshold);
    }
    return accumulated >= threshold ? 1 : 0;
  }

  #consumeThreshold(rule, event, executionCount = 1) {
    const threshold = Math.max(1, Number(rule.trigger?.threshold || 1));
    if (threshold <= 1) return;
    const key = this.#thresholdKey(rule, event);
    this.thresholds.set(
      key,
      Math.max(
        0,
        (this.thresholds.get(key) || 0) -
          threshold * Math.max(1, Number(executionCount) || 1)
      )
    );
  }

  #thresholdKey(rule, event) {
    const scope =
      event.type === "like" ? "global" : event.user?.id || "global";
    return `${rule.id}:${scope}`;
  }

  #onCooldown(rule, event) {
    if (event.type === "gift" || event.type === "like") return false;
    const now = Date.now();
    const globalUntil = this.cooldowns.get(`${rule.id}:global`) || 0;
    const userUntil =
      this.cooldowns.get(`${rule.id}:user:${event.user?.id || "anonymous"}`) || 0;
    return now < globalUntil || now < userUntil;
  }

  #startCooldown(rule, event) {
    if (event.type === "gift" || event.type === "like") return;
    const now = Date.now();
    const globalMs = Math.max(0, Number(rule.cooldown?.globalMs || 0));
    const perUserMs = Math.max(0, Number(rule.cooldown?.perUserMs || 0));
    if (globalMs) this.cooldowns.set(`${rule.id}:global`, now + globalMs);
    if (perUserMs) {
      this.cooldowns.set(
        `${rule.id}:user:${event.user?.id || "anonymous"}`,
        now + perUserMs
      );
    }
  }

  #enqueue(
    rule,
    event,
    priority,
    prefix,
    {
      executionCount = 1,
      giftUnitCount = 1
    } = {}
  ) {
    let resolveCompletion;
    const completion = new Promise((resolve) => {
      resolveCompletion = resolve;
    });
    this.queue.push({
      id: id(prefix),
      rule,
      event,
      priority,
      queuedAt: Date.now(),
      executionCount: Math.max(1, Math.floor(Number(executionCount) || 1)),
      giftUnitCount: Math.max(1, Math.floor(Number(giftUnitCount) || 1)),
      resolveCompletion
    });
    return completion;
  }

  #pump() {
    while (
      this.activeJobs < this.maxConcurrentJobs &&
      this.queue.length
    ) {
      const job = this.queue.shift();
      this.activeJobs += 1;
      this.processing = true;
      this.#runJob(job)
        .catch(() => {})
        .finally(() => {
          this.activeJobs -= 1;
          job.resolveCompletion();
          this.processing = this.activeJobs > 0 || this.queue.length > 0;
          this.#pump();
        });
    }
  }

  async #runJob(job) {
    for (let index = 0; index < job.executionCount; index += 1) {
      const executionEvent = interactionExecutionEvent(
        job.event,
        index,
        job.executionCount,
        job.giftUnitCount
      );
      const context = {
        ...executionEvent,
        event: executionEvent,
        rule: job.rule,
        now: new Date().toISOString()
      };
      this.emit("rule-fired", {
        rule: job.rule,
        event: executionEvent,
        jobId: job.id
      });
      for (const action of job.rule.actions || []) {
        const hydratedAction = {
          ...action,
          config: renderValue(action.config || {}, context)
        };
        try {
          const result = await this.actionRunner.run(
            hydratedAction,
            context
          );
          this.emit("action-result", {
            ok: true,
            action: hydratedAction,
            result,
            rule: job.rule,
            event: executionEvent
          });
        } catch (error) {
          this.emit("action-result", {
            ok: false,
            action: hydratedAction,
            error,
            rule: job.rule,
            event: executionEvent
          });
        }
      }
    }
  }
}

function giftEventCount(event = {}) {
  if (event.type !== "gift") return 1;
  const count = Number(event.data?.count || 1);
  return Number.isFinite(count)
    ? Math.max(1, Math.floor(count))
    : 1;
}

function likeEventCount(event = {}) {
  if (event.type !== "like") return 1;
  const count = Number(event.data?.count || 1);
  return Number.isFinite(count)
    ? Math.max(1, Math.floor(count))
    : 1;
}

function interactionEventCount(event = {}) {
  if (event.type === "gift") return giftEventCount(event);
  if (event.type === "like") return likeEventCount(event);
  return 1;
}

function interactionExecutionEvent(
  event,
  index,
  executionCount,
  unitCount = 1
) {
  if (event.type !== "gift" && event.type !== "like") return event;
  const batchCount = interactionEventCount(event);
  const normalizedUnitCount = Math.max(
    1,
    Math.floor(Number(unitCount) || 1)
  );
  if (
    batchCount === 1 &&
    executionCount === 1 &&
    normalizedUnitCount === 1
  ) {
    return event;
  }
  return {
    ...event,
    id: `${event.id || event.type}_unit_${index + 1}`,
    data: {
      ...(event.data || {}),
      count: normalizedUnitCount,
      batchCount,
      batchIndex: index + 1,
      batchSize: executionCount
    }
  };
}

function giftExecutionEvent(
  event,
  index,
  executionCount,
  giftUnitCount = 1
) {
  if (event.type !== "gift") return event;
  return interactionExecutionEvent(
    event,
    index,
    executionCount,
    giftUnitCount
  );
}

function activeGameInteractionRules(state) {
  const gameSession = state.session?.game || {};
  if (
    gameSession.running !== true ||
    !gameSession.packId ||
    gameSession.profileId !== state.session?.profileId
  ) {
    return [];
  }
  const rules =
    state.game?.interactionRulesByPack?.[gameSession.packId];
  return Array.isArray(rules) ? rules : [];
}

module.exports = {
  RuleEngine,
  activeGameInteractionRules,
  giftEventCount,
  giftExecutionEvent,
  interactionEventCount,
  interactionExecutionEvent,
  likeEventCount
};
