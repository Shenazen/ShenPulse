"use strict";

/** Passive clock estimate from the current TikTok connection's container.now.
 * Only an observed positive server lead is corrective. Delayed packets never
 * introduce extra waiting, and no OS clock, request or timer is involved.
 */
const MAX_OFFSET_MS = 30000;
const WINDOW_MS = 60000;
const MAX_SAMPLES = 32;
const MAX_DATE_MS = 8.64e15;

function absoluteMilliseconds(value) {
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() !== value || !/^[1-9]\d{12,15}$/.test(value))) return 0;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 1e12 && number <= MAX_DATE_MS ? number : 0;
}

class TikTokMatchClock {
  #samples = [];
  #lastServerNow = 0;
  #lastReceivedAt = 0;
  #lastLocalNow = 0;

  constructor({ now = Date.now } = {}) { this.now = now; }

  reset() {
    this.#samples = [];
    this.#lastServerNow = 0;
    this.#lastReceivedAt = 0;
    this.#lastLocalNow = 0;
  }

  #localNow() {
    let current;
    try { current = absoluteMilliseconds(this.now()); } catch { current = 0; }
    // A changed host clock invalidates this connection's earlier estimate.
    if (!current || this.#lastLocalNow && current < this.#lastLocalNow) this.reset();
    this.#lastLocalNow = current;
    return current;
  }

  #prune(now) {
    while (this.#samples.length && this.#samples[0].receivedAtMs <= now - WINDOW_MS) this.#samples.shift();
  }

  observe(serverNow, receivedAtMs) {
    const now = this.#localNow();
    const server = absoluteMilliseconds(serverNow), received = absoluteMilliseconds(receivedAtMs);
    if (!now || !server || !received || received > now || received <= now - WINDOW_MS ||
      server <= this.#lastServerNow || received < this.#lastReceivedAt) return false;
    const offsetMs = server - received;
    if (offsetMs < 0 || offsetMs > MAX_OFFSET_MS) return false;
    this.#prune(now);
    this.#lastServerNow = server;
    this.#lastReceivedAt = received;
    // Monotonic candidates retain the maximum and forget dominated samples.
    while (this.#samples.length && this.#samples[this.#samples.length - 1].offsetMs <= offsetMs) this.#samples.pop();
    this.#samples.push({ offsetMs, receivedAtMs: received });
    // Keep the maximum plus the newest candidates. After its expiry, any
    // discarded candidate can only make the estimate smaller, never larger.
    if (this.#samples.length > MAX_SAMPLES) this.#samples.splice(1, this.#samples.length - MAX_SAMPLES);
    return true;
  }

  get offsetMs() {
    const now = this.#localNow();
    if (!now) return 0;
    this.#prune(now);
    return this.#samples[0]?.offsetMs || 0;
  }
}

module.exports = { TikTokMatchClock };
