"use strict";

/** Contrat pur des Matchs : configuration par profil et état public borné.
 * Aucun rendu, réseau ou déclenchement d’action n’est effectué ici.
 */
(function exposeMatches(root, factory) {
  const matchCatalog = typeof module === "object" && module.exports
    ? require("../../resources/overlays/catalog/matches") : null;
  const contract = factory(() => matchCatalog || root.ShenPulseOverlayMatchCatalog);
  if (typeof module === "object" && module.exports) module.exports = contract;
  if (root) root.ShenPulseMatches = contract;
})(typeof globalThis === "object" ? globalThis : this, (getMatchCatalog) => {
  const MATCH_MOMENTS = Object.freeze([
    { id: "battleStart", label: "Début du match" }, { id: "multiplierX2", label: "Multiplicateur ×2" },
    { id: "multiplierX3", label: "Multiplicateur ×3" }, { id: "card", label: "Carte de match" },
    { id: "lead", label: "Vous passez devant" }, { id: "comeback", label: "Grande remontée" },
    { id: "tieEnd", label: "Égalité dans la dernière minute" }, { id: "likeRush", label: "Rafale de likes" },
    { id: "snipe", label: "Dernières secondes" }, { id: "victory", label: "Victoire" }, { id: "defeat", label: "Défaite" }
  ]);
  const MATCH_WIDGETS = Object.freeze([
    { id: "wins", label: "Manches gagnées" }, { id: "starDonor", label: "Donateur vedette" },
    { id: "topDonor", label: "Plus gros donateur" }, { id: "donors", label: "Classement des donateurs" },
    { id: "timer", label: "Chronomètre du match" }, { id: "victory", label: "Victoire" },
    { id: "scoreboard", label: "Scores du match" }
  ]);
  const ANIMATIONS = Object.freeze(["x2", "x3", "guantes", "cofre", "snipe", "taptap", "quiereme", "enigma"]);
  const CARDS = Object.freeze(["glove", "fog", "hammer", "time"]);
  const text = (value, max = 160) => String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
  const number = (value, fallback, min = 0, max = 1000000000) => {
    const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  function mediaUrl(value) {
    const url = text(value, 2000);
    if (/^\/overlay\/[a-z0-9_./%-]+$/i.test(url) && !url.includes("..")) return url;
    try { const parsed = new URL(url); return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : ""; }
    catch { return ""; }
  }
  function normalizeReaction(input = {}) {
    const type = text(input.type, 30);
    if (type === "bundle") {
      const rows = input.reactions;
      if (!Array.isArray(rows) || rows.length > 4) throw new Error("Une réaction de match accepte au maximum quatre sorties.");
      const types = new Set();
      const reactions = rows.map((row) => {
        if (!row || !["animation", "media", "sound", "action"].includes(row.type) || types.has(row.type)) {
          throw new Error("Chaque sortie de match doit avoir un type distinct, sans groupe imbriqué.");
        }
        types.add(row.type);
        return normalizeReaction(row);
      });
      return { type, reactions };
    }
    if (type === "action") {
      const actionId = text(input.actionId); if (!actionId) throw new Error("Choisissez une action existante.");
      return { type, actionId };
    }
    if (type === "animation") {
      if (!ANIMATIONS.includes(input.match)) throw new Error("Animation de match invalide.");
      const variant = getMatchCatalog().normalizeAnimationVariant(input.match, input.variant);
      if (!variant) throw new Error("Cette variante d’animation n’est pas disponible pour ce match.");
      return { type, match: input.match, variant, fit: input.fit === "cover" ? "cover" : "contain" };
    }
    if (type === "sound") {
      const url = mediaUrl(input.url); if (!url) throw new Error("Choisissez un son valide.");
      return { type, url, volume: number(input.volume, 1, 0, 1), outputMode: input.outputMode === "live" ? "live" : "local", screen: Math.round(number(input.screen, 1, 1, 8)) };
    }
    if (type === "media") {
      const url = mediaUrl(input.mediaUrl); if (!url) throw new Error("Choisissez un média valide.");
      return { type, mediaUrl: url, soundUrl: mediaUrl(input.soundUrl), durationMs: Math.round(number(input.durationMs, 5000, 500, 60000)), screen: Math.round(number(input.screen, 1, 1, 8)) };
    }
    throw new Error("Réaction de match invalide.");
  }
  function normalizeMatchAutomation(input = {}) {
    if (!MATCH_MOMENTS.some((entry) => entry.id === input.moment)) throw new Error("Moment de match invalide.");
    return { id: text(input.id), name: text(input.name || MATCH_MOMENTS.find((entry) => entry.id === input.moment).label),
      enabled: input.enabled === true, moment: input.moment, card: input.card === "any" || CARDS.includes(input.card) ? input.card : "glove",
      threshold: Math.round(number(input.threshold, input.moment === "comeback" ? 1000 : 300, 1, 1000000)), windowSeconds: number(input.windowSeconds, 5, 1, 60),
      remainingSeconds: number(input.remainingSeconds, input.moment === "tieEnd" ? 60 : 30, 1, 120), cooldownMs: Math.round(number(input.cooldownMs, 5000, 0, 3600000)),
      reaction: normalizeReaction(input.reaction) };
  }
  function normalizeMatchesConfig(input = {}) {
    const widgets = Object.fromEntries(MATCH_WIDGETS.map(({ id, label }) => {
      const widget = input.widgets?.[id] || {};
      const colors = Object.fromEntries(["primary", "secondary", "text"].filter((key) => /^#[0-9a-f]{6}$/i.test(widget.colors?.[key] || "")).map((key) => [key, widget.colors[key]]));
      return [id, { enabled: widget.enabled === true, title: text(widget.title || label, 100), theme: ["classic", "neon", "gold", "minimal"].includes(widget.theme) ? widget.theme : "classic", colors,
        backgroundOpacity: number(widget.backgroundOpacity, 50, 0, 100), borderRadius: number(widget.borderRadius, 12, 0, 64),
        animation: ["fade", "slide", "zoom"].includes(widget.animation) ? widget.animation : "none",
        ...(id === "wins" ? { donorPhoto: (widget.donorPhoto ?? widget.showDonorPhoto) !== false, showScores: widget.showScores !== false, switchSeconds: number(widget.switchSeconds, 6, 1, 60) } : {}),
        ...(id === "starDonor" ? { likeMessage: text(widget.likeMessage || "Merci pour {n} likes !", 300), giftMessage: text(widget.giftMessage || "Merci pour {gift} x{n} !", 300) } : {}),
        ...(id === "timer" ? { showSnipe: widget.showSnipe !== false, snipeSeconds: number(widget.snipeSeconds, 30, 1, 120), showStreak: widget.showStreak !== false } : {}),
        ...(id === "victory" ? { durationSeconds: number(widget.durationSeconds, 5, 1, 15) } : {}),
        ...(widget.goal !== undefined ? { goal: Math.round(number(widget.goal, 10, 1, 100000)) } : {}),
        ...(widget.customText !== undefined ? { customText: text(widget.customText, 300) } : {}) }];
    }));
    const seen = new Set(), automations = [];
    for (const item of (Array.isArray(input.automations) ? input.automations : []).slice(0, 100)) {
      try {
        const normalized = normalizeMatchAutomation(item);
        if (!normalized.id || seen.has(normalized.id)) continue;
        seen.add(normalized.id); automations.push(normalized);
      } catch { /* Une ancienne référence malformée n’est jamais activée automatiquement. */ }
    }
    return { schemaVersion: 1, widgets, automations };
  }
  function createMatchSession(input = {}, { disconnected = false } = {}) {
    const session = input.session || {};
    const history = (Array.isArray(input.history) ? input.history : []).slice(-20).map((entry) => ({
      battleId: text(entry.battleId), endedAtMs: number(entry.endedAtMs, 0, 0, Number.MAX_SAFE_INTEGER),
      result: ["win", "lose", "draw"].includes(entry.result) ? entry.result : null,
      ownScore: entry.ownScore == null ? null : number(entry.ownScore, 0), rivalScore: entry.rivalScore == null ? null : number(entry.rivalScore, 0)
    }));
    return { schemaVersion: 1, scope: {}, status: disconnected ? "disconnected" : "idle", battleId: "", startedAtMs: 0, endsAtMs: 0,
      participants: [], liveContributors: [], lastGift: null, lastContribution: null, ownUserId: "", result: null, multiplier: 1, lastMoment: "", lastEventAtMs: 0, endedAtMs: 0,
      rounds: { own: null, opponent: null }, manualWins: input.manualWins == null ? null : Math.round(number(input.manualWins, 0, 0, 100000)),
      pairRounds: (Array.isArray(input.pairRounds) ? input.pairRounds : []).slice(-20).map((entry) => ({ opponentId: text(entry.opponentId, 120), own: Math.round(number(entry.own, 0, 0, 100000)), opponent: Math.round(number(entry.opponent, 0, 0, 100000)) })).filter((entry) => entry.opponentId),
      session: { battles: Math.round(number(session.battles, 0)), wins: Math.round(number(session.wins, 0)),
        losses: Math.round(number(session.losses, 0)), draws: Math.round(number(session.draws, 0)), winStreak: Math.round(number(session.winStreak, 0, 0, 100000)) }, history,
      capabilities: { battle: true, scores: true, multiplier: true, cards: false } };
  }
  return { MATCH_MOMENTS, MATCH_WIDGETS, ANIMATIONS, CARDS, normalizeMatchAutomation, normalizeMatchesConfig, createMatchSession, normalizeReaction };
});
