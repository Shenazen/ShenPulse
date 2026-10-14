"use strict";

/** Projection publique minimale des sept widgets Matchs, locaux et HTTPS.
 * Ni UID/room ID, ni actions/automatisations/historique ne quittent le moteur.
 * La projection ne modifie jamais l'état ni les compteurs réels.
 */
const MATCH_WIDGET_KEYS = Object.freeze(["wins", "starDonor", "topDonor", "donors", "timer", "victory", "scoreboard"]);
const MATCH_OVERLAY_STATE_PATHS = Object.freeze(["settings.matches.widgets", ...["status", "startedAtMs", "endsAtMs", "timing", "result", "manualWins", "participants", "session", "preview", "liveContributors", "lastGift", "lastContribution", "endedAtMs", "rounds"].map((key) => `matchSession.${key}`)]);
const THEMES = new Set(["classic", "neon", "gold", "minimal"]);
const AVATAR_DOMAINS = Object.freeze(["tiktokcdn.com", "tiktokcdn-us.com", "tiktokcdn-eu.com", "ibyteimg.com", "byteimg.com", "byteoversea.com", "muscdn.com", "kick.com"]);
const titles = Object.freeze({ wins: "COMPTEUR DE MANCHES", starDonor: "MERCI POUR TON CADEAU", topDonor: "TOP DONATEUR", donors: "CLASSEMENT DONATEURS", timer: "CHRONO DU MATCH", victory: "VICTOIRE", scoreboard: "SCORE DU MATCH" });
const text = (value, limit = 120) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, limit) : "";
const count = (value) => (typeof value === "number" || typeof value === "string") && Number.isFinite(Number(value)) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(Number(value)))) : 0;
const score = (value) => value !== null && value !== undefined && value !== "" && (typeof value === "number" || typeof value === "string") && Number.isFinite(Number(value)) && Number(value) >= 0 ? count(value) : null;
const color = (value, fallback) => /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(String(value || "")) ? value : fallback;
const bounded = (value, fallback, min, max) => typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

function matchAvatarUrl(value) {
  try {
    const url = new URL(text(value, 2000));
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      AVATAR_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`)) ? url.href : "";
  } catch { return ""; }
}

function publicParticipant(row = {}) {
  return { username: text(row.username).replace(/^@+/, ""), displayName: text(row.displayName, 160), avatarUrl: matchAvatarUrl(row.avatarUrl), score: score(row.score), own: row.own === true,
    result: ["win", "lose", "draw"].includes(row.result) ? row.result : null,
    donors: (Array.isArray(row.donors) ? row.donors : []).slice(0, 10).map((donor) => ({ username: text(donor?.username).replace(/^@+/, ""), displayName: text(donor?.displayName, 160),
      avatarUrl: matchAvatarUrl(donor?.avatarUrl), score: score(donor?.score), diamonds: score(donor?.diamonds) })) };
}

function projectMatchesOverlayState(state = {}, nowMs = Date.now()) {
  const rawWidgets = state.settings?.matches?.widgets || {};
  const widgets = Object.fromEntries(MATCH_WIDGET_KEYS.map((key) => {
    const row = rawWidgets[key] || {};
    const theme = THEMES.has(row.theme) ? row.theme : "classic";
    const defaults = theme === "gold" ? ["#f3c769", "#e76da0"] : ["#b865ff", "#22d3ee"];
    return [key, { enabled: row.enabled === true, title: text(row.title, 100) || titles[key], theme,
      animation: ["none", "fade", "slide", "zoom"].includes(row.animation) ? row.animation : "none",
      backgroundOpacity: bounded(row.backgroundOpacity, 50, 0, 100), borderRadius: bounded(row.borderRadius, 12, 0, 64),
      ...(key === "wins" ? { donorPhoto: row.donorPhoto !== false, showScores: row.showScores !== false, switchSeconds: bounded(row.switchSeconds, 6, 1, 60) } : {}),
      ...(key === "starDonor" ? { likeMessage: text(row.likeMessage, 300) || "Merci pour {n} likes", giftMessage: text(row.giftMessage, 300) || "Merci pour {gift} ×{n}" } : {}),
      ...(key === "timer" ? { showSnipe: row.showSnipe !== false, snipeSeconds: bounded(row.snipeSeconds, 30, 1, 120), showStreak: row.showStreak !== false } : {}),
      ...(key === "victory" ? { durationSeconds: bounded(row.durationSeconds, 5, 1, 15) } : {}),
      ...(row.goal !== undefined ? { goal: bounded(row.goal, 10, 1, 100000) } : {}),
      ...(row.customText !== undefined ? { customText: text(row.customText, 300) } : {}),
      colors: { primary: color(row.colors?.primary, defaults[0]), secondary: color(row.colors?.secondary, defaults[1]), text: color(row.colors?.text, "#ffffff") } }];
  }));
  const raw = state.matchSession || {};
  const timing = raw.timing || {};
  const preview = raw.preview;
  const validPreview = MATCH_WIDGET_KEYS.includes(preview?.widget) && Number(preview.expiresAtMs) > nowMs && Number(preview.expiresAtMs) <= nowMs + 10000;
  return { config: { widgets }, session: {
    status: ({ running: "active", finished: "ended" })[raw.status] || (["idle", "live", "active", "ended", "cancelled", "disconnected"].includes(raw.status) ? raw.status : "idle"),
    timing: { startsAtMs: count(timing.startsAtMs ?? raw.startedAtMs), endsAtMs: count(timing.endsAtMs ?? raw.endsAtMs) },
    result: ["win", "lose", "draw"].includes(raw.result) ? raw.result : null,
    participants: (Array.isArray(raw.participants) ? raw.participants : []).slice(0, 16).map((row) => publicParticipant(row || {})),
    session: Object.fromEntries(["battles", "wins", "losses", "draws", "winStreak"].map((key) => [key, count(raw.session?.[key])])),
    rounds: { own: score(raw.rounds?.own), opponent: score(raw.rounds?.opponent) }, manualWins: score(raw.manualWins), endedAtMs: count(raw.endedAtMs),
    liveContributors: (Array.isArray(raw.liveContributors) ? raw.liveContributors : []).slice(0, 200).map((row) => ({ username: text(row?.username).replace(/^@+/, ""), displayName: text(row?.displayName, 160), avatarUrl: matchAvatarUrl(row?.avatarUrl),
      likes: count(row?.likes), gifts: count(row?.gifts), diamonds: count(row?.diamonds), lastGiftAtMs: count(row?.lastGiftAtMs) })),
    ...(raw.lastGift?.user ? { lastGift: { user: { username: text(raw.lastGift.user.username).replace(/^@+/, ""), displayName: text(raw.lastGift.user.displayName, 160), avatarUrl: matchAvatarUrl(raw.lastGift.user.avatarUrl) },
      giftName: text(raw.lastGift.giftName, 100), count: count(raw.lastGift.count), value: count(raw.lastGift.value), atMs: count(raw.lastGift.atMs) } } : {}),
    ...(["gift", "like"].includes(raw.lastContribution?.type) && raw.lastContribution?.user ? { lastContribution: { type: raw.lastContribution.type,
      user: { username: text(raw.lastContribution.user.username).replace(/^@+/, ""), displayName: text(raw.lastContribution.user.displayName, 160), avatarUrl: matchAvatarUrl(raw.lastContribution.user.avatarUrl) },
      giftName: text(raw.lastContribution.giftName, 100), count: count(raw.lastContribution.count), atMs: count(raw.lastContribution.atMs) } } : {}),
    ...(validPreview ? { preview: { widget: preview.widget, expiresAtMs: Number(preview.expiresAtMs) } } : {})
  } };
}

/** Un producteur de SSE ne peut introduire un champ supplémentaire par erreur. */
function projectMatchesOverlayPayload(payload = {}, nowMs = Date.now()) {
  return projectMatchesOverlayState({ settings: { matches: { widgets: payload.config?.widgets } }, matchSession: payload.session }, nowMs);
}

module.exports = { MATCH_WIDGET_KEYS, MATCH_OVERLAY_STATE_PATHS, matchAvatarUrl, projectMatchesOverlayState, projectMatchesOverlayPayload };
