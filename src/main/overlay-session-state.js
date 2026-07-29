"use strict";

const MAX_LEADERBOARD_ENTRIES = 100;
const MAX_RECENT_EVENTS = 40;

function createDefaultOverlaySession() {
  return {
    schemaVersion: 1,
    hasData: false,
    active: false,
    startedAt: null,
    endedAt: null,
    updatedAt: null,
    likeGoalCurrent: 0,
    coinJarCurrent: 0,
    winCounterCurrent: 0,
    winCounterMultiplier: 1,
    winCounterMultiplierUntil: 0,
    timerSeconds: 0,
    timerEndsAt: 0,
    timerPaused: false,
    timerLabel: "Temps restant",
    recentEvents: [],
    leaderboards: {
      donors: [],
      tappers: []
    }
  };
}

function normalizeOverlaySession(value = {}) {
  const defaults = createDefaultOverlaySession();
  const source = value && typeof value === "object" ? value : {};
  const multiplierUntil = Math.max(
    0,
    finiteNumber(source.winCounterMultiplierUntil)
  );
  const multiplierActive = multiplierUntil > Date.now();
  const leaderboards =
    source.leaderboards && typeof source.leaderboards === "object"
      ? source.leaderboards
      : {};
  const normalized = {
    ...defaults,
    ...source,
    schemaVersion: 1,
    active: Boolean(source.active),
    startedAt: source.startedAt || null,
    endedAt: source.endedAt || null,
    updatedAt: source.updatedAt || null,
    likeGoalCurrent: finiteNumber(source.likeGoalCurrent),
    coinJarCurrent: Math.max(0, finiteNumber(source.coinJarCurrent)),
    winCounterCurrent: finiteNumber(source.winCounterCurrent),
    winCounterMultiplier: multiplierActive
      ? Math.max(1, finiteNumber(source.winCounterMultiplier, 1))
      : 1,
    winCounterMultiplierUntil: multiplierActive ? multiplierUntil : 0,
    timerSeconds: Math.max(0, finiteNumber(source.timerSeconds)),
    timerEndsAt: Math.max(0, finiteNumber(source.timerEndsAt)),
    timerPaused: Boolean(source.timerPaused),
    timerLabel: String(source.timerLabel || defaults.timerLabel).slice(0, 100),
    recentEvents: Array.isArray(source.recentEvents)
      ? source.recentEvents.slice(0, MAX_RECENT_EVENTS)
      : [],
    leaderboards: {
      donors: normalizeLeaderboard(leaderboards.donors),
      tappers: normalizeLeaderboard(leaderboards.tappers)
    }
  };
  normalized.hasData = Boolean(
    source.hasData ||
      normalized.active ||
      normalized.startedAt ||
      normalized.endedAt ||
      normalized.recentEvents.length ||
      normalized.leaderboards.donors.length ||
      normalized.leaderboards.tappers.length
  );
  return normalized;
}

function resetOverlaySession(state, now = new Date().toISOString()) {
  state.overlaySession = {
    ...createDefaultOverlaySession(),
    hasData: true,
    active: true,
    startedAt: now,
    updatedAt: now
  };
  return state.overlaySession;
}

function finishOverlaySession(state, now = new Date().toISOString()) {
  state.overlaySession = normalizeOverlaySession(state.overlaySession);
  state.overlaySession.active = false;
  state.overlaySession.endedAt = now;
  state.overlaySession.updatedAt = now;
  return state.overlaySession;
}

function recordOverlayEvent(state, event, now = new Date().toISOString()) {
  if (!state.session?.running) return state.overlaySession;
  state.overlaySession = normalizeOverlaySession(state.overlaySession);
  const runtime = state.overlaySession;
  runtime.hasData = true;
  runtime.active = true;
  runtime.updatedAt = now;
  runtime.recentEvents = [compactOverlayEvent(event), ...runtime.recentEvents]
    .slice(0, MAX_RECENT_EVENTS);

  if (event.type === "like") {
    const likes = Math.max(1, finiteNumber(event.data?.count, 1));
    runtime.likeGoalCurrent = Math.max(0, runtime.likeGoalCurrent + likes);
    updateLeaderboard(runtime.leaderboards.tappers, event.user, likes);
  } else if (event.type === "gift") {
    const count = Math.max(1, finiteNumber(event.data?.count, 1));
    const coins = Math.max(1, finiteNumber(event.data?.value, 1)) * count;
    runtime.coinJarCurrent = Math.max(0, runtime.coinJarCurrent + coins);
    runtime.winCounterCurrent += 1;
    updateLeaderboard(runtime.leaderboards.donors, event.user, coins);
  }
  return runtime;
}

function applyOverlayOperation(
  state,
  channel,
  payload = {},
  now = new Date().toISOString()
) {
  state.overlaySession = normalizeOverlaySession(state.overlaySession);
  const runtime = state.overlaySession;
  runtime.hasData = true;

  const operation = String(payload.operation || "adjust");
  const amount = finiteNumber(payload.amount);
  if (channel === "like-goal") {
    runtime.likeGoalCurrent = applyNumberOperation(
      runtime.likeGoalCurrent,
      operation,
      amount,
      false
    );
  } else if (channel === "coin-jar") {
    runtime.coinJarCurrent = applyNumberOperation(
      runtime.coinJarCurrent,
      operation,
      amount,
      false
    );
  } else if (channel === "win-counter") {
    const parsedNow = Date.parse(now);
    const nowMs = Number.isFinite(parsedNow) ? parsedNow : Date.now();
    if (
      runtime.winCounterMultiplierUntil &&
      runtime.winCounterMultiplierUntil <= nowMs
    ) {
      runtime.winCounterMultiplier = 1;
      runtime.winCounterMultiplierUntil = 0;
    }
    if (operation === "multiplier") {
      const durationSeconds = Math.max(
        1,
        finiteNumber(payload.durationSeconds || payload.duration, 60)
      );
      runtime.winCounterMultiplier = Math.max(1, Math.abs(amount) || 2);
      runtime.winCounterMultiplierUntil = nowMs + durationSeconds * 1000;
    } else {
      const resolvedAmount =
        operation === "random" && Math.random() < 0.5
          ? -Math.abs(amount)
          : amount;
      const activeMultiplier =
        runtime.winCounterMultiplierUntil > nowMs
          ? Math.max(1, finiteNumber(runtime.winCounterMultiplier, 1))
          : 1;
      const multipliedAmount =
        ["adjust", "random"].includes(operation)
          ? resolvedAmount * activeMultiplier
          : resolvedAmount;
      runtime.winCounterCurrent = applyNumberOperation(
        runtime.winCounterCurrent,
        operation === "random" ? "adjust" : operation,
        multipliedAmount,
        true
      );
    }
  } else if (channel === "timer") {
    const parsedNow = Date.parse(now);
    const nowMs = Number.isFinite(parsedNow) ? parsedNow : Date.now();
    const configuredSeconds = Math.max(
      -86400,
      Math.min(86400, finiteNumber(payload.seconds))
    );
    const remainingSeconds = timerRemainingSeconds(runtime, nowMs);
    if (operation === "reset") {
      runtime.timerSeconds = 0;
      runtime.timerEndsAt = 0;
      runtime.timerPaused = false;
    } else if (operation === "pause") {
      runtime.timerSeconds = remainingSeconds;
      runtime.timerEndsAt = 0;
      runtime.timerPaused = true;
    } else if (operation === "resume") {
      runtime.timerSeconds = remainingSeconds;
      runtime.timerEndsAt =
        remainingSeconds > 0 ? nowMs + remainingSeconds * 1000 : 0;
      runtime.timerPaused = false;
    } else {
      const nextSeconds = Math.max(
        0,
        operation === "set"
          ? configuredSeconds
          : remainingSeconds + configuredSeconds
      );
      runtime.timerSeconds = nextSeconds;
      if (operation === "set") runtime.timerPaused = false;
      runtime.timerEndsAt =
        nextSeconds > 0 && !runtime.timerPaused
          ? nowMs + nextSeconds * 1000
          : 0;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "label")) {
      runtime.timerLabel = String(
        payload.label || createDefaultOverlaySession().timerLabel
      ).slice(0, 100);
    }
  }
  runtime.updatedAt = now;
  return runtime;
}

function timerRemainingSeconds(runtime, nowMs = Date.now()) {
  if (runtime.timerPaused || !runtime.timerEndsAt) {
    return Math.max(0, finiteNumber(runtime.timerSeconds));
  }
  return Math.max(
    0,
    Math.ceil((finiteNumber(runtime.timerEndsAt) - nowMs) / 1000)
  );
}

function applyNumberOperation(current, operation, amount, allowNegative) {
  const next =
    operation === "reset"
      ? 0
      : operation === "set"
        ? amount
        : current + amount;
  return allowNegative ? finiteNumber(next) : Math.max(0, finiteNumber(next));
}

function compactOverlayEvent(event = {}) {
  return {
    id: String(event.id || ""),
    type: String(event.type || "unknown"),
    source: String(event.source || ""),
    timestamp: event.timestamp || new Date().toISOString(),
    user: {
      id: String(event.user?.id || event.user?.name || "anonymous"),
      name: String(event.user?.name || "anonymous"),
      displayName: String(
        event.user?.displayName || event.user?.name || "Viewer"
      ),
      avatarUrl: String(event.user?.avatarUrl || "")
    },
    data: {
      message: String(event.data?.message || ""),
      giftName: String(event.data?.giftName || ""),
      giftImageUrl: String(event.data?.giftImageUrl || ""),
      count: Math.max(1, finiteNumber(event.data?.count, 1)),
      value: finiteNumber(event.data?.value)
    }
  };
}

function normalizeLeaderboard(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => ({
      id: String(entry?.id || entry?.name || ""),
      name: String(entry?.name || "Viewer"),
      avatarUrl: String(entry?.avatarUrl || ""),
      score: Math.max(0, finiteNumber(entry?.score))
    }))
    .filter((entry) => entry.id)
    .sort(compareLeaderboardEntries)
    .slice(0, MAX_LEADERBOARD_ENTRIES);
}

function updateLeaderboard(entries, user = {}, amount = 0) {
  const id = String(user.id || user.name || user.displayName || "anonymous");
  const name = String(user.displayName || user.name || "Viewer");
  const index = entries.findIndex((entry) => entry.id === id);
  const current = index >= 0
    ? entries[index]
    : { id, name, avatarUrl: "", score: 0 };
  const next = {
    ...current,
    id,
    name,
    avatarUrl: String(user.avatarUrl || current.avatarUrl || ""),
    score: current.score + Math.max(0, finiteNumber(amount))
  };
  if (index >= 0) entries[index] = next;
  else entries.push(next);
  entries.sort(compareLeaderboardEntries);
  entries.splice(MAX_LEADERBOARD_ENTRIES);
}

function compareLeaderboardEntries(left, right) {
  return (
    right.score - left.score ||
    left.name.localeCompare(right.name, "fr", { sensitivity: "base" })
  );
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

module.exports = {
  applyOverlayOperation,
  createDefaultOverlaySession,
  finishOverlaySession,
  normalizeOverlaySession,
  recordOverlayEvent,
  resetOverlaySession
};
