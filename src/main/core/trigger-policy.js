"use strict";

/** Politiques pures des déclencheurs, tests, objectifs et entrées du journal. */
const { giftValueFilterMatches, normalizeGiftValueFilter } = require("../../shared/gift-value-filter");
const { giftConditionMatches } = require("../../shared/gift-identity");

function wheelGiftTriggerMatches(wheel, event, gifts = []) {
  if (wheel?.enabled === false || event?.type !== "gift") return false;
  const trigger = String(wheel?.trigger || "")
    .trim()
    .toLocaleLowerCase("fr");
  const filter = normalizeGiftValueFilter(wheel?.giftValueFilter);
  if (!trigger && !filter) return false;
  if (filter) return giftValueFilterMatches(filter, event.data?.value);
  return giftConditionMatches(
    {
      field: "data.giftName",
      operator: "equals",
      value: wheel.trigger,
      giftId: wheel.triggerGift?.giftId,
      giftIds: wheel.triggerGift?.giftIds,
      giftFamily: wheel.triggerGift?.giftFamily,
      giftCost: wheel.triggerGift?.giftCost,
      giftImageUrl: wheel.triggerGift?.giftImageUrl
    },
    event,
    gifts
  );
}

function defaultTestEventCount(type) {
  return type === "like" ? 25 : 1;
}

function resolveLikeGoalCompletionChange(event, change = {}) {
  const previousLikeGoalCurrent = Math.max(
    0,
    Number(change.previousLikeGoalCurrent || 0)
  );
  let likeGoalCurrent = Math.max(
    0,
    Number(change.likeGoalCurrent || 0)
  );
  if (
    event?.type === "like" &&
    event?.source === "simulator" &&
    likeGoalCurrent === previousLikeGoalCurrent
  ) {
    likeGoalCurrent += Math.max(1, Number(event.data?.count || 1));
  }
  return { previousLikeGoalCurrent, likeGoalCurrent };
}

function shouldRecordActivity(state, entry, nowMs = Date.now()) {
  const category = String(entry?.category || "").trim().toLowerCase();
  if (!["connection", "tiktok"].includes(category)) return true;
  if (
    state?.session?.running === true ||
    state?.session?.game?.running === true
  ) {
    return true;
  }
  if (String(entry?.level || "").trim().toLowerCase() !== "error") {
    return false;
  }
  const title = String(entry?.title || "");
  const detail = String(entry?.detail || "");
  return !(state?.activity || []).some((previous) => {
    if (
      String(previous?.category || "").trim().toLowerCase() !== category ||
      String(previous?.level || "").trim().toLowerCase() !== "error" ||
      String(previous?.title || "") !== title ||
      String(previous?.detail || "") !== detail
    ) {
      return false;
    }
    const timestampMs = Date.parse(String(previous?.timestamp || ""));
    return (
      Number.isFinite(timestampMs) &&
      nowMs - timestampMs >= 0 &&
      nowMs - timestampMs < 15 * 60 * 1000
    );
  });
}

module.exports = { wheelGiftTriggerMatches, defaultTestEventCount, resolveLikeGoalCompletionChange, shouldRecordActivity };
