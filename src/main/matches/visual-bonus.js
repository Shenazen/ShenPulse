"use strict";

// Pure interpretation of two separately cropped OCR regions. This module does
// not capture an image, perform OCR, send a request, log text or write a file.
const MAX_FRAME_AGE_MS = 1000;
const MAX_FRAME_GAP_MS = 2000;
const MAX_END_DRIFT_MS = 1200;
const SAME_PERIOD_END_MS = 2000;
const CONTEXT_IDS = ["sourceId", "windowId", "accountUid", "profileId", "roomId", "battleId", "ownerUserId"];
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const absolute = (value) => Number.isSafeInteger(value) && value > 1e12 && value <= 8.64e15;
const opaqueId = (value) => typeof value === "string" && /^[A-Za-z0-9_.:-]{1,160}$/.test(value);
const exactTikTokId = (value) => typeof value === "string" && /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= 18446744073709551615n;
const username = (value) => typeof value === "string" && /^@?[a-z0-9._]{1,24}$/i.test(value)
  ? value.replace(/^@/, "").toLowerCase() : "";

function lines(value) {
  const input = typeof value === "string" ? value.split(/\r?\n/) : value;
  if (!Array.isArray(input) || !input.length || input.length > 6 ||
    input.some((line) => typeof line !== "string" || line.length > 180 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(line)) ||
    input.join(" ").length > 512) return null;
  return input.map((line) => line.normalize("NFKC").trim()).filter(Boolean);
}

function parseVisualBonusBanner(input) {
  const inputLines = lines(input);
  if (!inputLines?.length) return null;
  const text = inputLines.join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/×/g, "x").replace(/\s+/g, " ").toLowerCase();
  // Match only the complete active TikTok banner, never an animation's ×2,
  // WIN counter, mission announcement, gift target or "available soon" text.
  if (/bientot|defi|envoy|objectif|gagn|atteign|obten|mission|disponib|prochain|\bwin\b/.test(text)) return null;
  const suffix = "(?:\\s*\\|\\s*|\\s+)([1-9]\\d{0,3})\\s*(?:s|sec|secs|seconde|secondes)\\.?$";
  const match = new RegExp("^x\\s*([23])\\s+points?\\s+cadeaux?" + suffix).exec(text) ||
    new RegExp("^points?\\s+cadeaux?\\s+x\\s*([23])(?:\\s+par\\s+premier\\s+cadeau)?" + suffix).exec(text);
  if (!match) return null;
  const remainingSeconds = Number(match[2]);
  return remainingSeconds <= 7200 ? { multiplier: Number(match[1]), remainingSeconds } : null;
}

function normalizedContext(input, now) {
  if (!object(input) || CONTEXT_IDS.some((key) => !opaqueId(input[key])) ||
    ["roomId", "battleId", "ownerUserId"].some((key) => !exactTikTokId(input[key])) ||
    !username(input.ownerUsername) || !absolute(input.startedAtMs) || !absolute(input.endsAtMs) ||
    input.startedAtMs > now || input.endsAtMs <= Math.max(input.startedAtMs, now) ||
    input.status !== undefined && input.status !== "running") return null;
  return { ...Object.fromEntries(CONTEXT_IDS.map((key) => [key, input[key]])), ownerUsername: username(input.ownerUsername),
    startedAtMs: input.startedAtMs, endsAtMs: input.endsAtMs };
}

function ownerMatches(input, expected) {
  const ownerLines = lines(input);
  if (!ownerLines?.length) return false;
  const handles = ownerLines.filter((line) => line.includes("@"));
  return handles.length === 1 && handles[0].toLowerCase() === `@${expected}`;
}

class VisualBonusTracker {
  constructor() { this.sequence = 0; this.reset(); }
  reset() { this.identity = ""; this.candidate = null; this.periods = []; this.lastCapturedAtMs = 0; this.frameIds = new Set(); }
  observe(input, nowMs = Date.now()) {
    if (!object(input) || !absolute(nowMs)) { this.candidate = null; return null; }
    const context = normalizedContext(input.context, nowMs);
    if (!context) { this.reset(); return null; }
    // An extension changes the safety bound, not the account/window identity
    // or the already observed bonus end. A new battle/start does change it.
    const identity = JSON.stringify([...CONTEXT_IDS.map((key) => context[key]), context.ownerUsername, context.startedAtMs]);
    if (identity !== this.identity) { this.reset(); this.identity = identity; }
    if (!opaqueId(input.frameId) || !absolute(input.capturedAtMs) || input.capturedAtMs > nowMs ||
      nowMs - input.capturedAtMs > MAX_FRAME_AGE_MS || input.capturedAtMs < context.startedAtMs ||
      !ownerMatches(input.ownerLines, context.ownerUsername)) { this.candidate = null; return null; }
    if (this.frameIds.has(input.frameId) || input.capturedAtMs <= this.lastCapturedAtMs) return null;
    this.frameIds.add(input.frameId);
    while (this.frameIds.size > 64) this.frameIds.delete(this.frameIds.values().next().value);
    this.lastCapturedAtMs = input.capturedAtMs;
    const banner = parseVisualBonusBanner(input.bannerLines);
    if (!banner) { this.candidate = null; return null; }
    const estimatedEndMs = input.capturedAtMs + banner.remainingSeconds * 1000;
    if (!absolute(estimatedEndMs) || estimatedEndMs > context.endsAtMs + 1000) { this.candidate = null; return null; }
    const endsAtMs = Math.min(estimatedEndMs, context.endsAtMs);
    const previous = this.candidate;
    const consistent = previous && previous.multiplier === banner.multiplier &&
      input.capturedAtMs - previous.lastCapturedAtMs <= MAX_FRAME_GAP_MS &&
      banner.remainingSeconds <= previous.lastRemainingSeconds &&
      Math.abs(estimatedEndMs - previous.referenceEndMs) <= MAX_END_DRIFT_MS;
    if (!consistent) {
      this.candidate = { ...banner, firstCapturedAtMs: input.capturedAtMs, lastCapturedAtMs: input.capturedAtMs,
        lastRemainingSeconds: banner.remainingSeconds, referenceEndMs: estimatedEndMs };
      return null;
    }
    previous.lastCapturedAtMs = input.capturedAtMs;
    previous.lastRemainingSeconds = banner.remainingSeconds;
    // A falling countdown, rather than two copies of a static poster, is
    // required. Closely spaced equal frames can wait for the next real tick.
    if (banner.remainingSeconds >= previous.remainingSeconds) return null;
    this.periods = this.periods.filter((period) => period.endsAtMs + SAME_PERIOD_END_MS >= nowMs).slice(-32);
    if (this.periods.some((period) => period.multiplier === banner.multiplier &&
      Math.abs(period.endsAtMs - endsAtMs) <= SAME_PERIOD_END_MS)) return null;
    const knownPeriods = Array.isArray(input.knownPeriods) ? input.knownPeriods.slice(0, 32) : [];
    const known = knownPeriods.some((period) => object(period) && period.confirmed === true &&
      period.multiplier === banner.multiplier && absolute(period.startsAtMs) && absolute(period.endsAtMs) &&
      period.startsAtMs <= input.capturedAtMs && period.endsAtMs > input.capturedAtMs &&
      period.startsAtMs >= context.startedAtMs && period.endsAtMs <= context.endsAtMs &&
      Math.abs(period.endsAtMs - endsAtMs) <= SAME_PERIOD_END_MS);
    const period = { multiplier: banner.multiplier, startsAtMs: previous.firstCapturedAtMs, endsAtMs,
      periodKey: `visual:${++this.sequence}`, context };
    this.periods.push({ multiplier: period.multiplier, endsAtMs: period.endsAtMs });
    if (known) return null;
    return period;
  }
}

module.exports = { parseVisualBonusBanner, VisualBonusTracker };
