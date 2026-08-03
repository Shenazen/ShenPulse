"use strict";

const GIFT_VALUE_OPERATORS = new Set([
  "less",
  "lessOrEqual",
  "equals",
  "notEquals",
  "greaterOrEqual",
  "greater"
]);

function normalizeGiftValueOperator(value, fallback = "greaterOrEqual") {
  const operator = String(value || "").trim();
  return GIFT_VALUE_OPERATORS.has(operator) ? operator : fallback;
}

function normalizeGiftValueFilter(filter) {
  if (!filter || typeof filter !== "object") return null;
  const value = Number(filter.value);
  if (!Number.isFinite(value) || value <= 0) return null;
  return {
    operator: normalizeGiftValueOperator(filter.operator),
    value
  };
}

function compareGiftValue(actualValue, operatorValue, expectedValue) {
  const actual = Number(actualValue);
  const expected = Number(expectedValue);
  if (!Number.isFinite(actual) || actual <= 0 || !Number.isFinite(expected)) {
    return false;
  }
  const operator = normalizeGiftValueOperator(operatorValue);
  if (operator === "less") return actual < expected;
  if (operator === "lessOrEqual") return actual <= expected;
  if (operator === "equals") return actual === expected;
  if (operator === "notEquals") return actual !== expected;
  if (operator === "greater") return actual > expected;
  return actual >= expected;
}

function giftValueFilterMatches(filter, actualValue) {
  const normalized = normalizeGiftValueFilter(filter);
  return normalized
    ? compareGiftValue(actualValue, normalized.operator, normalized.value)
    : false;
}

module.exports = {
  GIFT_VALUE_OPERATORS,
  compareGiftValue,
  giftValueFilterMatches,
  normalizeGiftValueFilter,
  normalizeGiftValueOperator
};
