"use strict";

const MAX_TRACKED_FOLLOW_EVENTS = 2000;
const FOLLOW_DUPLICATE_WINDOW_MS = 15000;
const SYNTHETIC_SOURCES = new Set([
  "manual-preview",
  "rule-test",
  "simulator",
  "test"
]);

/**
 * Écarte uniquement les deux livraisons techniques d'un même message TikTok.
 * Un nouvel événement natif reste accepté, même si le spectateur a déjà suivi,
 * s'est désabonné puis a suivi à nouveau pendant le même LIVE.
 */
class FollowSessionGuard {
  constructor({
    duplicateWindowMs = FOLLOW_DUPLICATE_WINDOW_MS,
    maxTrackedEvents = MAX_TRACKED_FOLLOW_EVENTS,
    now = Date.now
  } = {}) {
    this.duplicateWindowMs = Math.max(
      1000,
      Math.trunc(Number(duplicateWindowMs) || FOLLOW_DUPLICATE_WINDOW_MS)
    );
    this.maxTrackedEvents = Math.max(
      1,
      Math.trunc(Number(maxTrackedEvents) || MAX_TRACKED_FOLLOW_EVENTS)
    );
    this.now = now;
    this.seenAtByEvent = new Map();
  }

  accept(_state, event) {
    if (event?.type !== "follow") return true;
    if (SYNTHETIC_SOURCES.has(normalizeKey(event.source))) return true;

    const identity = followEventIdentity(event);
    if (!identity) return true;
    const now = Number(this.now()) || Date.now();
    this.#evictExpired(now);
    const previous = this.seenAtByEvent.get(identity);
    if (previous != null && now - previous <= this.duplicateWindowMs) {
      return false;
    }
    this.seenAtByEvent.delete(identity);
    this.seenAtByEvent.set(identity, now);
    this.#evictOverflow();
    return true;
  }

  clear() {
    this.seenAtByEvent.clear();
  }

  #evictExpired(now) {
    for (const [identity, seenAt] of this.seenAtByEvent) {
      if (now - seenAt <= this.duplicateWindowMs) break;
      this.seenAtByEvent.delete(identity);
    }
  }

  #evictOverflow() {
    while (this.seenAtByEvent.size > this.maxTrackedEvents) {
      this.seenAtByEvent.delete(this.seenAtByEvent.keys().next().value);
    }
  }
}

function followEventIdentity(event = {}) {
  const raw = event?.data?.raw || {};
  const eventId = normalizeKey(
    raw.common?.msgId || raw.msgId || raw.id || event.id
  );
  if (!eventId) return "";
  return `${normalizeKey(event.source) || "unknown"}:${eventId}`;
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("en");
}

module.exports = {
  FOLLOW_DUPLICATE_WINDOW_MS,
  FollowSessionGuard,
  followEventIdentity
};
