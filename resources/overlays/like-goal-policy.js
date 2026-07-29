"use strict";

(function exposeLikeGoalPolicy(root, factory) {
  const policy = factory();
  if (typeof module === "object" && module.exports) module.exports = policy;
  if (root) root.LikeGoalPolicy = policy;
})(typeof globalThis === "object" ? globalThis : this, () => {
  const BEHAVIORS = new Set(["keep", "increase", "double", "hide"]);

  function normalizeBehavior(value) {
    const behavior = String(value || "").trim().toLowerCase();
    return BEHAVIORS.has(behavior) ? behavior : "increase";
  }

  function positiveNumber(value, fallback = 1) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function resolveCompletion(currentValue, initialTargetValue, behaviorValue) {
    const current = Math.max(0, Number(currentValue) || 0);
    const initialTarget = positiveNumber(initialTargetValue);
    const behavior = normalizeBehavior(behaviorValue);
    let target = initialTarget;
    let hidden = false;

    if (current < initialTarget) return { behavior, target, hidden };

    if (behavior === "increase") {
      const completedSteps = Math.floor(current / initialTarget);
      target = Math.min(
        Number.MAX_SAFE_INTEGER,
        initialTarget * (completedSteps + 1)
      );
    } else if (behavior === "double") {
      while (current >= target && target < Number.MAX_SAFE_INTEGER) {
        target = Math.min(Number.MAX_SAFE_INTEGER, target * 2);
      }
    } else if (behavior === "hide") {
      hidden = true;
    }

    return { behavior, target, hidden };
  }

  return {
    normalizeBehavior,
    resolveCompletion
  };
});
